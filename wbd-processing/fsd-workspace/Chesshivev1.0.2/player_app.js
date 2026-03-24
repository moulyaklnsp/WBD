const express = require('express');
const path = require('path');
const router = express.Router();
const { connectDB } = require('./routes/databasecongi');
const utils = require('./utils');
const { ObjectId } = require('mongodb');
router.use(express.json()); // Parses JSON

class Player {
  constructor(id, username, college, gender) {
    this.id = id;
    this.username = username;
    this.college = college;
    this.gender = gender;
    this.score = 0;
    this.opponents = new Set();
  }
}

function swissPairing(players, totalRounds) {
  let allRounds = [];
  for (let round = 1; round <= totalRounds; round++) {
    players.sort((a, b) => b.score - a.score);
    let pairings = [];
    let byePlayer = null;
    let paired = new Set();
    if (players.length % 2 !== 0) {
      byePlayer = players.pop();
      byePlayer.score += 1;
    }
    for (let i = 0; i < players.length; i++) {
      if (paired.has(players[i].id)) continue;
      let player1 = players[i];
      let player2 = null;
      for (let j = i + 1; j < players.length; j++) {
        if (!paired.has(players[j].id) && !player1.opponents.has(players[j].id)) {
          player2 = players[j];
          break;
        }
      }
      if (!player2) {
        for (let j = i + 1; j < players.length; j++) {
          if (!paired.has(players[j].id)) {
            player2 = players[j];
            break;
          }
        }
      }
      if (player2) {
        paired.add(player1.id);
        paired.add(player2.id);
        player1.opponents.add(player2.id);
        player2.opponents.add(player1.id);
        let result = Math.random();
        let matchResult;
        if (result < 0.4) {
          player1.score += 1;
          matchResult = `${player1.username} Wins`;
        } else if (result < 0.8) {
          player2.score += 1;
          matchResult = `${player2.username} Wins`;
        } else {
          player1.score += 0.5;
          player2.score += 0.5;
          matchResult = "Draw";
        }
        pairings.push({ player1, player2, result: matchResult });
      }
    }
    if (byePlayer) players.push(byePlayer);
    allRounds.push({ round, pairings, byePlayer });
  }
  return allRounds;
}

// API Routes
router.get('/api/dashboard', async (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const username = req.session.username;
  const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
  if (!user) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const latestTournaments = await db.collection('tournaments')
    .find({ status: 'Approved' })
    .sort({ date: -1 })
    .limit(5)
    .toArray();

  const latestItems = await db.collection('products')
    .find({ availability: { $gt: 0 } })
    .sort({ _id: -1 })
    .limit(5)
    .toArray();

  const teamRequests = await db.collection('enrolledtournaments_team').aggregate([
    {
      $match: {
        $or: [{ player1_name: username }, { player2_name: username }, { player3_name: username }],
        approved: 0
      }
    },
    { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
    { $unwind: '$tournament' },
    { $lookup: { from: 'users', localField: 'captain_id', foreignField: '_id', as: 'captain' } },
    { $unwind: '$captain' },
    {
      $project: {
        id: '$_id',
        tournamentName: '$tournament.name',
        captainName: '$captain.name',
        player1_name: 1,
        player2_name: 1,
        player3_name: 1,
        player1_approved: 1,
        player2_approved: 1,
        player3_approved: 1
      }
    }
  ]).toArray();

  res.json({
    playerName: username,
    latestTournaments: latestTournaments || [],
    latestItems: latestItems || [],
    teamRequests: teamRequests || []
  });
});

router.get('/api/tournaments', async (req, res) => {
  if (!req.session.username) {
    console.log('No username in session'); // Debug log
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    const db = await connectDB();
    console.log('Connected to database'); // Debug log
    const username = req.session.username;
    console.log('Session username:', username); // Debug log

    const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
    if (!user) {
      console.log('User not found for username:', username); // Debug log
      return res.status(404).json({ error: 'Player not found' });
    }
    console.log('User found:', user); // Debug log

    const balance = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balance?.wallet_balance || 0;
    console.log('Wallet balance:', walletBalance); // Debug log

    const tournamentsRaw = await db.collection('tournaments').find({ status: 'Approved' }).toArray();
    const tournaments = (tournamentsRaw || []).map(t => ({ ...t, _id: t._id.toString() }));
    console.log('Fetched tournaments:', tournaments); // Debug log

    const enrolledIndividualTournamentsRaw = await db.collection('tournament_players').aggregate([
      { $match: { username } },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $unwind: '$tournament' },
      { $project: { tournament: 1 } }
    ]).toArray();
    const enrolledIndividualTournaments = (enrolledIndividualTournamentsRaw || []).map(e => ({
      ...e,
      tournament: e.tournament ? { ...e.tournament, _id: e.tournament._id.toString() } : null
    }));
    console.log('Enrolled individual tournaments:', enrolledIndividualTournaments); // Debug log

    const enrolledTeamTournamentsRaw = await db.collection('enrolledtournaments_team').aggregate([
      {
        $match: {
          $or: [{ captain_id: user._id }, { player1_name: username }, { player2_name: username }, { player3_name: username }]
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
          enrollment_date: 1
        }
      }
    ]).toArray();
    const enrolledTeamTournaments = (enrolledTeamTournamentsRaw || []).map(e => ({
      ...e,
      _id: e._id ? e._id.toString() : undefined,
      tournament: e.tournament ? { ...e.tournament, _id: e.tournament._id.toString() } : null
    }));
    console.log('Enrolled team tournaments:', enrolledTeamTournaments); // Debug log

    const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    console.log('Subscription:', subscription); // Debug log

    const response = {
      tournaments: tournaments || [],
      enrolledIndividualTournaments: enrolledIndividualTournaments || [],
      enrolledTeamTournaments: enrolledTeamTournaments || [],
      username,
      walletBalance,
      currentSubscription: subscription || null
    };
    console.log('API response:', response); // Debug log
    res.json(response);
  } catch (err) {
    console.error('Error in /api/tournaments:', err); // Debug log
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New API endpoint to join an individual tournament
router.post('/api/join-individual', async (req, res) => {
  if (!req.session.username || !req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const { tournamentId } = req.body || {};
  if (!tournamentId) return res.status(400).json({ error: 'Tournament ID is required' });
  if (!ObjectId.isValid(tournamentId)) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const db = await connectDB();
    const username = req.session.username;
    const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    // Ensure tournament exists and is approved
    const tournament = await db.collection('tournaments').findOne({ _id: new ObjectId(tournamentId), status: 'Approved' });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found or not approved' });
    if ((tournament.type || '').toLowerCase() !== 'individual') {
      return res.status(400).json({ error: 'This is not an individual tournament' });
    }

    // Subscription must be active
    const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    if (!subscription || (subscription.end_date && new Date(subscription.end_date) <= new Date())) {
      return res.status(400).json({ error: 'Subscription required' });
    }

    // Already enrolled?
    const already = await db.collection('tournament_players').findOne({ tournament_id: new ObjectId(tournamentId), username });
    if (already) return res.status(400).json({ error: 'Already enrolled' });

    // Wallet check
    const balDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balDoc?.wallet_balance || 0;
    const fee = parseFloat(tournament.entry_fee) || 0;
    if (walletBalance < fee) return res.status(400).json({ error: 'Insufficient wallet balance' });

    // Deduct and enroll
    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -fee } },
      { upsert: true }
    );

    await db.collection('tournament_players').insertOne({
      tournament_id: new ObjectId(tournamentId),
      username,
      college: user.college || '',
      gender: user.gender || ''
    });

    const newBal = await db.collection('user_balances').findOne({ user_id: user._id });
    res.json({ success: true, message: 'Joined successfully', walletBalance: newBal?.wallet_balance || (walletBalance - fee) });
  } catch (err) {
    console.error('Error in /api/join-individual:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// New API endpoint to join a team tournament
router.post('/api/join-team', async (req, res) => {
  if (!req.session.username || !req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  const { tournamentId, player1, player2, player3 } = req.body;
  if (!tournamentId || !player1 || !player2 || !player3) {
    return res.status(400).json({ error: 'Tournament ID and three player names are required' });
  }

  try {
    const db = await connectDB();
    const username = req.session.username;
    const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
    if (!user) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const tournament = await db.collection('tournaments').findOne({ _id: new ObjectId(tournamentId), status: 'Approved' });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found or not approved' });
    }

    // Verify all players exist
    const players = await db.collection('users').find({
      name: { $in: [player1, player2, player3] },
      role: 'player',
      isDeleted: 0
    }).toArray();
    if (players.length !== 3) {
      return res.status(400).json({ error: 'One or more players not found' });
    }

    // Check if already enrolled
    const existingEnrollment = await db.collection('enrolledtournaments_team').findOne({
      tournament_id: new ObjectId(tournamentId),
      $or: [{ player1_name: username }, { player2_name: username }, { player3_name: username }]
    });
    if (existingEnrollment) {
      return res.status(400).json({ error: 'You are already enrolled in this tournament' });
    }

    // Check wallet balance (only captain pays)
    const balance = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balance?.wallet_balance || 0;
    if (walletBalance < tournament.entry_fee) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Deduct entry fee from captain
    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -tournament.entry_fee } },
      { upsert: true }
    );

    // Enroll team
    await db.collection('enrolledtournaments_team').insertOne({
      tournament_id: new ObjectId(tournamentId),
      captain_id: user._id,
      player1_name: player1,
      player2_name: player2,
      player3_name: player3,
      player1_approved: username === player1 ? 1 : 0,
      player2_approved: username === player2 ? 1 : 0,
      player3_approved: username === player3 ? 1 : 0,
      approved: (username === player1 && username === player2 && username === player3) ? 1 : 0,
      enrollment_date: new Date()
    });

    const newBalance = (await db.collection('user_balances').findOne({ user_id: user._id })).wallet_balance || 0;
    res.json({ success: true, message: 'Team successfully enrolled. Awaiting approval from other players.', walletBalance: newBalance });
  } catch (err) {
    console.error('Error in /api/join-team:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/store', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const row = await db.collection('users').aggregate([
    { $match: { email: req.session.userEmail, role: 'player', isDeleted: 0 } },
    { $lookup: { from: 'user_balances', localField: '_id', foreignField: 'user_id', as: 'balance' } },
    { $unwind: { path: '$balance', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 1, name: 1, college: 1, wallet_balance: '$balance.wallet_balance' } }
  ]).next();

  if (!row) {
    return res.status(404).json({ error: 'User not found' });
  }

  req.session.userID = row._id.toString();
  req.session.username = row.name;
  req.session.userCollege = row.college;

  const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
  let discountPercentage = 0;
  if (subscription) {
    if (subscription.plan === 'Basic') discountPercentage = 10;
    else if (subscription.plan === 'Premium') discountPercentage = 20;
  }
  const products = await db.collection('products').find().toArray();

  res.json({
    products: products || [],
    walletBalance: row.wallet_balance || 0,
    playerName: row.name,
    playerCollege: row.college,
    subscription: subscription || null,
    discountPercentage
  });
});

router.get('/api/subscription', async (req, res) => {
  console.log('GET /player/api/subscription - Session:', { 
    userEmail: req.session.userEmail, 
    userRole: req.session.userRole, 
    username: req.session.username 
  });
  
  if (!req.session.userEmail) {
    console.log('GET /player/api/subscription - No userEmail in session');
    return res.status(401).json({ error: 'Please log in' });
  }
  
  try {
    const db = await connectDB();
    console.log('GET /player/api/subscription - Looking up user with email:', req.session.userEmail);
    
    const row = await db.collection('users').aggregate([
      { $match: { email: req.session.userEmail, role: 'player', isDeleted: 0 } },
      { $lookup: { from: 'user_balances', localField: '_id', foreignField: 'user_id', as: 'balance' } },
      { $unwind: { path: '$balance', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, wallet_balance: '$balance.wallet_balance' } }
    ]).next();
    
    if (!row) {
      console.log('GET /player/api/subscription - User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('GET /player/api/subscription - User found, wallet:', row.wallet_balance);
    
    let subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    console.log('GET /player/api/subscription - Subscription:', subscription);
    
    if (subscription) {
      const now = new Date();
      if (now > new Date(subscription.end_date)) {
        await db.collection('subscriptionstable').deleteOne({ username: req.session.userEmail });
        console.log('GET /player/api/subscription - Expired subscription deleted');
        subscription = null;
      }
    }
    
    const response = {
      walletBalance: row.wallet_balance || 0,
      currentSubscription: subscription || null
    };
    console.log('GET /player/api/subscription - Sending response:', response);
    res.json(response);
  } catch (err) {
    console.error('GET /player/api/subscription - Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/api/growth', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const player = await db.collection('player_stats').aggregate([
    { $lookup: { from: 'users', localField: 'player_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.email': req.session.userEmail, 'user.isDeleted': 0 } },
    { $project: { name: '$user.name', gamesPlayed: 1, wins: 1, losses: 1, draws: 1, rating: 1 } }
  ]).next();

  if (!player) {
    return res.status(404).json({ error: 'Player stats not found' });
  }

  const currentRating = player.rating && !isNaN(player.rating) ? player.rating : 400;
  const ratingHistory = player.gamesPlayed > 0
    ? [currentRating - 200, currentRating - 150, currentRating - 100, currentRating - 50, currentRating - 25, currentRating]
    : [400, 400, 400, 400, 400, 400];
  const chartLabels = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    return date.toLocaleString('default', { month: 'short' });
  });
  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

  res.json({
    player: { ...player, winRate: player.winRate || winRate },
    ratingHistory,
    chartLabels
  });
});

router.get('/api/profile', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const row = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
  if (!row) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const playerId = row._id;
  let playerStats = await db.collection('player_stats').findOne({ player_id: playerId });

  if (!playerStats) {
    const gamesPlayed = Math.floor(Math.random() * 11) + 20;
    let wins = Math.floor(Math.random() * (gamesPlayed + 1));
    let losses = Math.floor(Math.random() * (gamesPlayed - wins + 1));
    let draws = gamesPlayed - (wins + losses);
    let rating = 400 + (wins * 10) - (losses * 10);
    let winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;

    try {
      await db.collection('player_stats').updateOne(
        { player_id: playerId },
        { $set: { gamesPlayed, wins, losses, draws, winRate, rating } },
        { upsert: true }
      );
      playerStats = { gamesPlayed, wins, losses, draws, winRate, rating };
    } catch (err) {
      console.error('Error updating player stats:', err);
      return res.status(500).json({ error: 'Failed to update player stats' });
    }
  }

  const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
  const balance = await db.collection('user_balances').findOne({ user_id: playerId });
  console.log('Balance query result:', balance); // Debug log
  const walletBalance = balance?.wallet_balance || 0;

  const sales = await db.collection('sales').aggregate([
    { $match: { $or: [ { buyer_id: playerId }, { buyer: row.name } ] } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $project: { name: '$product.name' } }
  ]).toArray();

  const subscribed = subscription && new Date(subscription.end_date) > new Date();

  res.json({
    player: {
      ...row,
      subscription: subscription || { plan: 'None', price: 0, start_date: 'N/A' },
      walletBalance,
      gamesPlayed: playerStats.gamesPlayed,
      wins: playerStats.wins,
      losses: playerStats.losses,
      draws: playerStats.draws,
      winRate: playerStats.winRate,
      rating: playerStats.rating,
      sales: sales.map(sale => sale.name)
    },
    subscribed
  });
});

router.delete('/api/deleteAccount', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'player'
    });

    if (!user) return res.status(404).json({ error: 'Player not found' });

    const playerId = user._id;

    // Soft delete in users collection (includes deleted_by and deletedAt)
    await db.collection('users').updateOne(
      { _id: playerId },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: req.session.userEmail } }
    );
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Account deleted successfully (soft delete)' });
    });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});


router.post('/players/restore/:id', async (req, res) => {
  const db = await connectDB();
  const playerId = req.params.id;
  const { email, password } = req.body;

  try {
    const user = await db.collection('users').findOne({ 
      _id: new ObjectId(playerId), 
      role: 'player' 
    });

    if (!user) return res.status(404).json({ message: 'Player account not found.' });

    if (user.isDeleted === 0) {
      return res.status(400).json({ message: 'Account is already active.' });
    }

    if (user.email !== email || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 🔹 Restore by setting isDeleted back to 0
    await db.collection('users').updateOne(
      { _id: new ObjectId(playerId) },
      { $set: { isDeleted: 0 }, $unset: { deletedAt: "" } }
    );

    await db.collection('player_stats').updateOne(
      { player_id: new ObjectId(playerId) },
      { $set: { isDeleted: 0 } }
    );

    await db.collection('user_balances').updateOne(
      { user_id: new ObjectId(playerId) },
      { $set: { isDeleted: 0 } }
    );

    await db.collection('subscriptionstable').updateOne(
      { username: user.email },
      { $set: { isDeleted: 0 } }
    );

    await db.collection('sales').updateMany(
      { buyer: user.name },
      { $set: { isDeleted: 0 } }
    );

    return res.status(200).json({ message: 'Player account restored successfully! You can now log in.' });
  } catch (err) {
    console.error('Error restoring player:', err);
    return res.status(500).json({ message: 'Failed to restore player account.' });
  }
});
router.get('/api/compare', async (req, res) => {
  const db = await connectDB();
  const query = req.query.query?.trim();

  if (!query) {
    return res.status(400).json({ error: 'Please provide a name or email to compare.' });
  }

  try {
    const player = await db.collection('users').findOne({
      $or: [{ email: query }, { name: query }],
      role: 'player',
      isDeleted: { $ne: 1 }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    const stats = await db.collection('player_stats').findOne({
      player_id: player._id,
      isDeleted: { $ne: 1 }
    });

    // Dummy rating history (replace with your real match history data)
    const ratingHistory = Array.from({ length: 10 }, (_, i) => 
      (stats?.rating || 400) + Math.floor(Math.random() * 100 - 50)
    );

    res.json({
      player: {
        name: player.name,
        email: player.email,
        rating: stats?.rating || 400,
        winRate: stats?.winRate || 0,
        ratingHistory
      }
    });
  } catch (err) {
    console.error('Error comparing players:', err);
    res.status(500).json({ error: 'Failed to compare players.' });
  }
});

router.post('/api/add-funds', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const db = await connectDB();
  const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const result = await db.collection('user_balances').updateOne(
    { user_id: user._id },
    { $inc: { wallet_balance: amount } },
    { upsert: true }
  );

  if (result.matchedCount === 0 && result.upsertedCount === 0) {
    return res.status(500).json({ error: 'Failed to update balance' });
  }

  const newBalance = (await db.collection('user_balances').findOne({ user_id: user._id })).wallet_balance || amount;
  res.json({ success: true, walletBalance: newBalance });
});

router.get('/api/pairings', async (req, res) => {
  const tournamentId = req.query.tournament_id;
  const totalRounds = parseInt(req.query.rounds) || 5;
  if (!tournamentId) {
    return res.status(400).json({ error: 'Tournament ID is required' });
  }

  const db = await connectDB();
  const rows = await db.collection('tournament_players').find({ tournament_id: new ObjectId(tournamentId) }).toArray();
  if (rows.length === 0) {
    return res.json({ roundNumber: 1, allRounds: [], message: 'No players enrolled' });
  }

  let storedPairings = await db.collection('tournament_pairings').findOne({ tournament_id: new ObjectId(tournamentId) });
  let allRounds;

  // Regenerate pairings if no stored data or player count mismatch
  if (!storedPairings || storedPairings.totalRounds !== totalRounds || rows.length !== (storedPairings.rounds[0]?.pairings?.length * 2 || 0) + (storedPairings.rounds[0]?.byePlayer ? 1 : 0)) {
    console.log(`Regenerating pairings for ${rows.length} players`);
    let players = rows.map(row => new Player(row._id, row.username, row.college, row.gender));
    allRounds = swissPairing(players, totalRounds);

    await db.collection('tournament_pairings').deleteOne({ tournament_id: new ObjectId(tournamentId) }); // Remove old pairings
    await db.collection('tournament_pairings').insertOne({
      tournament_id: new ObjectId(tournamentId),
      totalRounds: totalRounds,
      rounds: allRounds.map(round => ({
        round: round.round,
        pairings: round.pairings.map(pairing => ({
          player1: { id: pairing.player1.id, username: pairing.player1.username, score: pairing.player1.score },
          player2: { id: pairing.player2.id, username: pairing.player2.username, score: pairing.player2.score },
          result: pairing.result
        })),
        byePlayer: round.byePlayer ? {
          id: round.byePlayer.id,
          username: round.byePlayer.username,
          score: round.byePlayer.score
        } : null
      }))
    });
  } else {
    console.log('Using existing stored pairings');
    allRounds = storedPairings.rounds.map(round => {
      const pairings = round.pairings.map(pairing => {
        const player1 = new Player(pairing.player1.id, pairing.player1.username);
        player1.score = pairing.player1.score;
        const player2 = new Player(pairing.player2.id, pairing.player2.username);
        player2.score = pairing.player2.score;
        return { player1, player2, result: pairing.result };
      });
      const byePlayer = round.byePlayer ? new Player(round.byePlayer.id, round.byePlayer.username) : null;
      if (byePlayer) byePlayer.score = round.byePlayer.score;
      return { round: round.round, pairings, byePlayer };
    });
  }

  res.json({ roundNumber: totalRounds, allRounds });
});


// Rankings API
router.get('/api/rankings', async (req, res) => {
  try {
    const tournamentId = req.query.tournament_id;
    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID is required' });
    }
    const db = await connectDB();
    const tid = new ObjectId(tournamentId);
    const rows = await db.collection('tournament_players').find({ tournament_id: tid }).toArray();
    if (rows.length === 0) {
      return res.json({ rankings: [], tournamentId });
    }
    let storedPairings = await db.collection('tournament_pairings').findOne({ tournament_id: tid });
    let rankings = [];
    if (!storedPairings) {
      const totalRounds = 5;
      let players = rows.map(row => new Player(row._id, row.username, row.college, row.gender));
      const allRounds = swissPairing(players, totalRounds);
      await db.collection('tournament_pairings').insertOne({
        tournament_id: tid,
        totalRounds: totalRounds,
        rounds: allRounds.map(round => ({
          round: round.round,
          pairings: round.pairings.map(pairing => ({
            player1: {
              id: pairing.player1.id,
              username: pairing.player1.username,
              score: pairing.player1.score
            },
            player2: {
              id: pairing.player2.id,
              username: pairing.player2.username,
              score: pairing.player2.score
            },
            result: pairing.result
          })),
          byePlayer: round.byePlayer ? {
            id: round.byePlayer.id,
            username: round.byePlayer.username,
            score: round.byePlayer.score
          } : null
        }))
      });
      rankings = players.sort((a, b) => b.score - a.score).map((p, index) => ({
        rank: index + 1,
        playerName: p.username,
        score: p.score
      }));
    } else {
      let playersMap = new Map();
      rows.forEach(row => {
        playersMap.set(row._id.toString(), {
          id: row._id.toString(),
          username: row.username,
          score: 0
        });
      });
      storedPairings.rounds.forEach(round => {
        round.pairings.forEach(pairing => {
          const player1 = playersMap.get(pairing.player1.id.toString());
          const player2 = playersMap.get(pairing.player2.id.toString());
          if (player1) player1.score = pairing.player1.score;
          if (player2) player2.score = pairing.player2.score;
        });
        if (round.byePlayer) {
          const byePlayer = playersMap.get(round.byePlayer.id.toString());
          if (byePlayer) byePlayer.score = round.byePlayer.score;
        }
      });
      rankings = Array.from(playersMap.values())
        .sort((a, b) => b.score - a.score)
        .map((p, index) => ({
          rank: index + 1,
          playerName: p.username,
          score: p.score
        }));
    }
    res.json({ rankings, tournamentId });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});


router.post('/api/approve-team-request', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const { requestId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'Request ID is required' });
  }

  const db = await connectDB();
  const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
  if (!user) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const teamRequest = await db.collection('enrolledtournaments_team').findOne({ _id: new ObjectId(requestId) });
  if (!teamRequest) {
    return res.status(404).json({ error: 'Team request not found' });
  }

  // Update approval based on player's role in team
  const update = {};
  if (teamRequest.player1_name === user.name) {
    update.player1_approved = 1;
  } else if (teamRequest.player2_name === user.name) {
    update.player2_approved = 1;
  } else if (teamRequest.player3_name === user.name) {
    update.player3_approved = 1;
  } else {
    return res.status(403).json({ error: 'You are not part of this team' });
  }

  // Check if all players approved
  const updatedRequest = {
    ...teamRequest,
    ...update,
    approved: (teamRequest.player1_approved || update.player1_approved) &&
              (teamRequest.player2_approved || update.player2_approved) &&
              (teamRequest.player3_approved || update.player3_approved) ? 1 : 0
  };

  await db.collection('enrolledtournaments_team').updateOne(
  { _id: new ObjectId(requestId) },
  { $set: { ...update, approved: updatedRequest.approved } }
);

  res.json({ success: true });
});

router.post('/api/buy', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ success: false, message: 'Please log in' });
  }

  try {
    const db = await connectDB();
    const { price, buyer, college, productId } = req.body;

    if (!price || !productId) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'player',
      isDeleted: 0
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const balanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balanceDoc?.wallet_balance || 0;
    const numericPrice = parseFloat(price);

    if (walletBalance < numericPrice) {
      return res.json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Check product availability
    console.log('Checking product availability');
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product || product.availability <= 0) {
      return res.json({ success: false, message: 'Product unavailable' });
    }

    // Deduct wallet balance and reduce availability
    console.log('Deducting balance and updating product availability');
    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -numericPrice } },
      { upsert: true }
    );
    console.log('Updating product availability');
    await db.collection('products').updateOne(
      { _id: new ObjectId(productId) },
      { $inc: { availability: -1 } }
    );

    // Record the sale
    await db.collection('sales').insertOne({
      product_id: new ObjectId(productId),
      price: Number(numericPrice),
      buyer: String(buyer),
      buyer_id: user._id,
      college: String(college),
      purchase_date: new Date()
    });

    // Return actual updated balance from DB
    const newBalanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const updatedBalance = newBalanceDoc?.wallet_balance ?? (walletBalance - numericPrice);
    res.json({ success: true, message: 'Purchase successful!', walletBalance: updatedBalance });

  } catch (err) {
    console.error('Error in /api/buy:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Removed duplicate /api/buy route (Teja) to avoid conflicts
router.post('/api/subscribe', async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ success: false, message: 'Please log in' });
  }

  try {
    const { plan, price } = req.body;
    if (!plan || !price) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'player',
      isDeleted: 0
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check wallet balance
    const balanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balanceDoc?.wallet_balance || 0;
    const numericPrice = parseFloat(price);

    if (walletBalance < numericPrice) {
      return res.json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Deduct funds
    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -numericPrice } }
    );

    // Set subscription duration (1 month)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + 1);

    const subscriptionDoc = {
      username: req.session.userEmail,
      plan,
      price: numericPrice,
      start_date: startDate,
      end_date: endDate
    };
    
    console.log('Attempting to save subscription:', JSON.stringify(subscriptionDoc, null, 2));

    // Save subscription
    await db.collection('subscriptionstable').updateOne(
      { username: req.session.userEmail },
      { $set: subscriptionDoc },
      { upsert: true }
    );

    const updatedBalance = walletBalance - numericPrice;
    res.json({
      success: true,
      message: 'Subscription successful!',
      walletBalance: updatedBalance
    });
  } catch (err) {
    console.error('Error in /api/subscribe:', err);
    if (err.code === 121) {
      console.error('Validation error details:', JSON.stringify(err.errInfo, null, 2));
    }
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
});
router.get('/api/growth_analytics', async (req, res) => {
  try {
    const player = {
      gamesPlayed: 42,
      winRate: 68,
      rating: 620,
      peakRating: 640
    };

    const ratingHistory = [400, 450, 500, 540, 600, 620];
    const chartLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];

    res.json({ player, ratingHistory, chartLabels });
  } catch (err) {
    console.error('Error loading growth analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
router.get('/api/notifications', async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    const notifications = await db.collection('notifications').aggregate([
      { $match: { user_id: user._id } },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $unwind: '$tournament' },
      { $project: { 
        _id: 1, 
        type: 1, 
        read: 1, 
        date: 1, 
        tournamentName: '$tournament.name',
        tournament_id: '$tournament._id' // Include tournament_id
      } }
    ]).toArray();

    // Convert ObjectId to string
    const formattedNotifications = notifications.map(n => ({
      ...n,
      _id: n._id.toString(),
      tournament_id: n.tournament_id.toString()
    }));
    console.log('Sending notifications:', formattedNotifications); // Debug log
    res.json({ notifications: formattedNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
});

// New API: Submit feedback
router.post('/api/submit-feedback', async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });

  const { tournamentId, rating, comments } = req.body;
  if (!tournamentId || !rating) return res.status(400).json({ error: 'Tournament ID and rating required' });
  if (!ObjectId.isValid(tournamentId)) {
            console.error('Invalid tournamentId:', tournamentId);
            return res.status(400).json({ error: 'Invalid tournament ID' });
          }
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    // Check if already submitted
    const existing = await db.collection('feedbacks').findOne({ tournament_id: new ObjectId(tournamentId), username: user.name });
    if (existing) return res.status(400).json({ error: 'Feedback already submitted' });

    await db.collection('feedbacks').insertOne({
      tournament_id: new ObjectId(tournamentId),
      username: user.name,
      rating: parseInt(rating),
      comments: comments || '',
      submitted_date: new Date()
    });

    res.json({ success: true, message: 'Feedback submitted' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// New API: Mark notification as read
router.post('/api/mark-notification-read', async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });

  const { notificationId } = req.body;
  if (!notificationId) return res.status(400).json({ error: 'Notification ID required' });

  try {
    const db = await connectDB();
    await db.collection('notifications').updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});
// Single route for rendering HTML pages
router.get('/:subpage?', (req, res) => {
  const subpage = req.params.subpage || 'player_dashboard';

  if (!req.session.userEmail || req.session.userRole !== 'player') {
    return res.redirect("/?error-message=Please log in as a player");
  }
  // Serve HTML files from views/coordinator/
  const filePath = path.join(__dirname, '..', 'ChessHive.v1.0.2', 'views', 'player', `${subpage}.html`);
  console.log(`Serving file: ${filePath}`);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`Error serving ${subpage}.html:`, err);
      res.redirect('/player/player_dashboard?error-message=Page not found');
    }
  });
});

module.exports = {
  router,
  swissPairing,
  Player
};