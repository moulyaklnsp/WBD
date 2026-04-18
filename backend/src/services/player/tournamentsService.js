const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { insertWalletTransaction, requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const Cache = require('../../utils/cache');
const UserModel = getModel('users');
const UserBalancesModel = getModel('user_balances');
const TournamentModel = getModel('tournaments');
const TournamentPlayersModel = getModel('tournament_players');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');
const SubscriptionsModel = getModel('subscriptionstable');
const FeedbacksModel = getModel('feedbacks');
const TournamentPairingsModel = getModel('tournament_pairings');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const TournamentsService = {
  async getTournaments(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) {
      throw createError('Player not found', 404);
    }
    const username = userDoc.name || user?.username || user?.email;

    const balance = await UserBalancesModel.findOne(database, { user_id: user._id });
    const walletBalance = balance?.wallet_balance || 0;

    // --- Redis Caching Implementation ---
    const cacheKey = Cache.keys.tournamentsApproved();
    const { value: tournamentsRaw } = await Cache.cacheAsideJson({
      key: cacheKey,
      ttlSeconds: Cache.config.ttl.longSeconds,
      tags: ['tournaments'],
      label: 'PlayerTournaments.getTournaments approved',
      fetcher: async () => TournamentModel.findMany(database, { status: 'Approved' })
    });

    const tournaments = (tournamentsRaw || []).map(t => ({ ...t, _id: t._id.toString() }));

    const enrolledIndividualTournamentsRaw = await TournamentPlayersModel.aggregate(database, [
      { $match: { username } },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $unwind: '$tournament' },
      { $project: { tournament: 1 } }
    ]);
    const enrolledIndividualTournaments = (enrolledIndividualTournamentsRaw || []).map(e => ({
      ...e,
      tournament: e.tournament ? { ...e.tournament, _id: e.tournament._id.toString() } : null
    }));

    const enrolledTeamTournamentsRaw = await TeamEnrollmentsModel.aggregate(database, [
      {
        $match: {
          $or: [{ captain_id: userDoc._id }, { player1_name: username }, { player2_name: username }, { player3_name: username }]
        }
      },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $lookup: { from: 'users', localField: 'captain_id', foreignField: '_id', as: 'captain' } },
      { $unwind: '$tournament' },
      { $unwind: '$captain' },
      {
        $project: {
          _id: 1,
          tournament_id: '$tournament_id',
          tournament: '$tournament',
          captainName: '$captain.name',
          player1_name: 1,
          player2_name: 1,
          player3_name: 1,
          player1_approved: 1,
          player2_approved: 1,
          player3_approved: 1,
          approved: 1,
          status: 1,
          enrollment_date: 1
        }
      }
    ]);
    const enrolledTeamTournaments = (enrolledTeamTournamentsRaw || []).map(e => ({
      ...e,
      _id: e._id ? e._id.toString() : undefined,
      tournament: e.tournament ? { ...e.tournament, _id: e.tournament._id.toString() } : null
    }));

    const subscription = await SubscriptionsModel.findOne(database, { username: user?.email });

    return {
      tournaments: tournaments || [],
      enrolledIndividualTournaments: enrolledIndividualTournaments || [],
      enrolledTeamTournaments: enrolledTeamTournaments || [],
      username,
      walletBalance,
      currentSubscription: subscription || null
    };
  },

  async joinIndividual(db, user, tournamentId) {
    requirePlayer(user);
    if (!tournamentId) throw createError('Tournament ID is required', 400);
    if (!ObjectId.isValid(tournamentId)) throw createError('Invalid tournament ID', 400);

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) throw createError('Player not found', 404);
    const username = userDoc.name || user?.username || user?.email;

    const tournament = await TournamentModel.findOne(database, { _id: new ObjectId(tournamentId), status: 'Approved' });
    if (!tournament) throw createError('Tournament not found or not approved', 404);
    if ((tournament.type || '').toLowerCase() !== 'individual') {
      throw createError('This is not an individual tournament', 400);
    }

    const subscription = await SubscriptionsModel.findOne(database, { username: user?.email });
    if (!subscription || (subscription.end_date && new Date(subscription.end_date) <= new Date())) {
      throw createError('Subscription required', 400);
    }

    const already = await TournamentPlayersModel.findOne(database, { tournament_id: new ObjectId(tournamentId), username });
    if (already) throw createError('Already enrolled', 400);

    const balDoc = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    const walletBalance = balDoc?.wallet_balance || 0;
    const fee = parseFloat(tournament.entry_fee) || 0;
    if (walletBalance < fee) throw createError('Insufficient wallet balance', 400);

    await UserBalancesModel.updateOne(
      database,
      { user_id: userDoc._id },
      { $inc: { wallet_balance: -fee } },
      { upsert: true }
    );

    if (fee > 0) {
      await insertWalletTransaction(database, userDoc._id, user?.email, 'debit', fee, `Tournament Entry: ${tournament.name}`);
    }

    await TournamentPlayersModel.insertOne(database, {
      tournament_id: new ObjectId(tournamentId),
      username,
      college: userDoc.college || '',
      gender: userDoc.gender || ''
    });

    const newBal = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    return {
      success: true,
      message: 'Joined successfully',
      walletBalance: newBal?.wallet_balance || (walletBalance - fee)
    };
  },

  async joinTeam(db, user, body) {
    requirePlayer(user);
    const { tournamentId, player1, player2, player3 } = body || {};
    if (!tournamentId || !player1 || !player2 || !player3) {
      throw createError('Tournament ID and three player usernames are required', 400);
    }

    const p1 = (player1 || '').trim();
    const p2 = (player2 || '').trim();
    const p3 = (player3 || '').trim();
    if (!p1 || !p2 || !p3) {
      throw createError('All three player usernames are required', 400);
    }

    const uniquePlayers = new Set([p1, p2, p3]);
    if (uniquePlayers.size !== 3) {
      throw createError('All three players must be different', 400);
    }

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) {
      throw createError('Your player account not found', 404);
    }
    const username = userDoc.name || user?.username || user?.email;

    if (![p1, p2, p3].includes(username)) {
      throw createError('You (the captain) must be one of the three team members', 400);
    }

    if (!ObjectId.isValid(tournamentId)) {
      throw createError('Invalid tournament ID', 400);
    }

    const tournament = await TournamentModel.findOne(database, { _id: new ObjectId(tournamentId), status: 'Approved' });
    if (!tournament) {
      throw createError('Tournament not found or not approved', 404);
    }

    const tournamentType = (tournament.type || '').toLowerCase();
    if (!['team', 'group'].includes(tournamentType)) {
      throw createError('This is not a team tournament', 400);
    }

    const players = await UserModel.findMany(database, {
      name: { $in: [p1, p2, p3] },
      role: 'player',
      isDeleted: 0
    });

    if (players.length !== 3) {
      const foundNames = players.map(p => p.name);
      const missing = [p1, p2, p3].filter(n => !foundNames.includes(n));
      throw createError(`Player(s) not found: ${missing.join(', ')}. Please check the usernames.`, 400);
    }

    const existingEnrollment = await TeamEnrollmentsModel.findOne(database, {
      tournament_id: new ObjectId(tournamentId),
      $or: [
        { player1_name: { $in: [p1, p2, p3] } },
        { player2_name: { $in: [p1, p2, p3] } },
        { player3_name: { $in: [p1, p2, p3] } }
      ]
    });
    if (existingEnrollment) {
      throw createError('One or more players are already enrolled in this tournament', 400);
    }

    const balance = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    const walletBalance = balance?.wallet_balance || 0;
    const entryFee = tournament.entry_fee || 0;
    if (walletBalance < entryFee) {
      throw createError(`Insufficient wallet balance. Required: ₹${entryFee}, Available: ₹${walletBalance}`, 400);
    }

    if (entryFee > 0) {
      await UserBalancesModel.updateOne(
        database,
        { user_id: userDoc._id },
        { $inc: { wallet_balance: -entryFee } },
        { upsert: true }
      );
      const userEmail = user?.email || username + '@tournament.local';
      await insertWalletTransaction(database, userDoc._id, userEmail, 'debit', entryFee, `Team Tournament Entry: ${tournament.name}`);
    }

    const enrollment = {
      tournament_id: new ObjectId(tournamentId),
      captain_id: userDoc._id,
      captain_name: username,
      player1_name: p1,
      player2_name: p2,
      player3_name: p3,
      player1_approved: p1 === username ? 1 : 0,
      player2_approved: p2 === username ? 1 : 0,
      player3_approved: p3 === username ? 1 : 0,
      approved: 0,
      status: 'pending',
      enrollment_date: new Date()
    };

    const allApproved = enrollment.player1_approved && enrollment.player2_approved && enrollment.player3_approved;
    enrollment.approved = allApproved ? 1 : 0;
    if (allApproved) enrollment.status = 'approved';

    await TeamEnrollmentsModel.insertOne(database, enrollment);

    const newBalance = (await UserBalancesModel.findOne(database, { user_id: userDoc._id }))?.wallet_balance || 0;
    const pendingPlayers = [p1, p2, p3].filter(p => p !== username);

    return {
      success: true,
      message: `Team submitted! Waiting for approval from: ${pendingPlayers.join(', ')}`,
      walletBalance: newBalance
    };
  },

  async approveTeamRequest(db, user, requestId) {
    requirePlayer(user);
    if (!requestId) {
      throw createError('Request ID is required', 400);
    }

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) {
      throw createError('Player not found', 404);
    }

    const teamRequest = await TeamEnrollmentsModel.findOne(database, { _id: new ObjectId(requestId) });
    if (!teamRequest) {
      throw createError('Team request not found', 404);
    }

    const update = {};
    if (teamRequest.player1_name === userDoc.name) {
      update.player1_approved = 1;
    } else if (teamRequest.player2_name === userDoc.name) {
      update.player2_approved = 1;
    } else if (teamRequest.player3_name === userDoc.name) {
      update.player3_approved = 1;
    } else {
      throw createError('You are not part of this team', 403);
    }

    const updatedRequest = {
      ...teamRequest,
      ...update,
      approved: (teamRequest.player1_approved || update.player1_approved) &&
                (teamRequest.player2_approved || update.player2_approved) &&
                (teamRequest.player3_approved || update.player3_approved) ? 1 : 0
    };

    const updatedStatus = updatedRequest.approved ? 'approved' : 'pending';

    await TeamEnrollmentsModel.updateOne(
      database,
      { _id: new ObjectId(requestId) },
      { $set: { ...update, approved: updatedRequest.approved, status: updatedStatus } }
    );

    return { success: true, message: 'Team request approved' };
  },

  async rejectTeamRequest(db, user, requestId) {
    requirePlayer(user);
    if (!requestId) throw createError('Request ID is required', 400);

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) throw createError('Player not found', 404);

    const teamRequest = await TeamEnrollmentsModel.findOne(database, { _id: new ObjectId(requestId) });
    if (!teamRequest) throw createError('Team request not found', 404);

    if (teamRequest.status !== 'pending') {
      throw createError(`Team request cannot be rejected because it is already ${teamRequest.status}`, 400);
    }

    if (![teamRequest.player1_name, teamRequest.player2_name, teamRequest.player3_name].includes(userDoc.name)) {
      throw createError('You are not a part of this team request', 403);
    }

    // Refund captain's entry fee
    const tournament = await TournamentModel.findOne(database, { _id: new ObjectId(teamRequest.tournament_id) });
    if (tournament && (tournament.entry_fee || 0) > 0) {
      await UserBalancesModel.updateOne(
        database,
        { user_id: teamRequest.captain_id },
        { $inc: { wallet_balance: tournament.entry_fee } },
        { upsert: true }
      );
      
      const captainDoc = await UserModel.findOne(database, { _id: teamRequest.captain_id, isDeleted: 0 });
      if (captainDoc) {
        await insertWalletTransaction(
          database, 
          captainDoc._id, 
          captainDoc.email || captainDoc.name + '@tournament.local', 
          'credit', 
          tournament.entry_fee, 
          `Refund: Team request rejected by ${userDoc.name}`
        );
      }
    }

    await TeamEnrollmentsModel.updateOne(
      database,
      { _id: new ObjectId(requestId) },
      { $set: { status: 'rejected', approved: -1 } }
    );

    return { success: true, message: 'Team request rejected' };
  },

  async cancelTeamRequest(db, user, requestId) {
    requirePlayer(user);
    if (!requestId) throw createError('Request ID is required', 400);

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) throw createError('Player not found', 404);

    const teamRequest = await TeamEnrollmentsModel.findOne(database, { _id: new ObjectId(requestId) });
    if (!teamRequest) throw createError('Team request not found', 404);

    if (teamRequest.captain_id.toString() !== userDoc._id.toString()) {
      throw createError('Only the team captain can cancel this request', 403);
    }

    if (teamRequest.status !== 'pending') {
      throw createError(`Team request cannot be cancelled because it is already ${teamRequest.status}`, 400);
    }

    // Refund captain's entry fee
    const tournament = await TournamentModel.findOne(database, { _id: new ObjectId(teamRequest.tournament_id) });
    if (tournament && (tournament.entry_fee || 0) > 0) {
      await UserBalancesModel.updateOne(
        database,
        { user_id: userDoc._id },
        { $inc: { wallet_balance: tournament.entry_fee } },
        { upsert: true }
      );

      await insertWalletTransaction(
        database, 
        userDoc._id, 
        user?.email || userDoc.name + '@tournament.local', 
        'credit', 
        tournament.entry_fee, 
        `Refund: Team request cancelled by you`
      );
    }

    await TeamEnrollmentsModel.updateOne(
      database,
      { _id: new ObjectId(requestId) },
      { $set: { status: 'cancelled', approved: -1 } }
    );

    return { success: true, message: 'Team request cancelled' };
  },

  async submitFeedback(db, user, body) {
    requirePlayer(user);
    const { tournamentId, rating, comments } = body || {};
    if (!tournamentId || !rating) throw createError('Tournament ID and rating required', 400);
    if (!ObjectId.isValid(tournamentId)) {
      throw createError('Invalid tournament ID', 400);
    }

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player' });
    if (!userDoc) throw createError('Player not found', 404);

    const existing = await FeedbacksModel.findOne(database, { tournament_id: new ObjectId(tournamentId), username: userDoc.name });
    if (existing) throw createError('Feedback already submitted', 400);

    await FeedbacksModel.insertOne(database, {
      tournament_id: new ObjectId(tournamentId),
      username: userDoc.name,
      rating: parseInt(rating),
      comments: comments || '',
      submitted_date: new Date()
    });

    return { success: true, message: 'Feedback submitted' };
  },

  async getTournamentCalendar(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const tournaments = await TournamentModel.findMany(
      database,
      { status: { $in: ['Approved', 'Ongoing'] } },
      { sort: { date: 1 } }
    );

    const pairingDocs = await TournamentPairingsModel.findMany(
      database,
      { tournament_id: { $in: tournaments.map(t => t._id) } }
    );

    const pairingsMap = {};
    for (const pd of pairingDocs) {
      const tid = pd.tournament_id?.toString();
      if (tid) {
        const matches = [];
        for (const round of (pd.rounds || [])) {
          for (const p of (round.pairings || [])) {
            matches.push({
              round: round.round,
              player1: p.player1?.username || 'TBD',
              player2: p.player2?.username || 'TBD',
              result: p.result || 'pending'
            });
          }
        }
        pairingsMap[tid] = matches;
      }
    }

    const calendar = tournaments.map(t => ({
      _id: t._id.toString(),
      name: t.name,
      date: t.date,
      type: t.type || 'individual',
      location: t.location,
      entry_fee: t.entry_fee,
      image: t.image || t.banner || null,
      description: t.description || '',
      rounds: t.rounds || 5,
      matches: pairingsMap[t._id.toString()] || []
    }));

    return { calendar };
  }
};

module.exports = TournamentsService;
