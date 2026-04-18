const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { safeTrim, escapeRegExp } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const PlayerStatsModel = getModel('player_stats');
const RatingHistoryModel = getModel('rating_history');
const TournamentPlayersModel = getModel('tournament_players');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');
const TournamentPairingsModel = getModel('tournament_pairings');
const TournamentModel = getModel('tournaments');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const PlayerStatsService = {
  async getPlayerStats(db) {
    const database = await resolveDb(db);

    const players = await UserModel.aggregate(database, [
      {
        $match: {
          role: 'player',
          isDeleted: { $ne: 1 }
        }
      },
      {
        $lookup: {
          from: 'player_stats',
          let: {
            uid: '$_id',
            uidStr: { $toString: '$_id' }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$player_id', '$$uid'] },
                    {
                      $eq: [
                        { $convert: { input: '$player_id', to: 'string', onError: '', onNull: '' } },
                        '$$uidStr'
                      ]
                    }
                  ]
                }
              }
            },
            { $project: { wins: 1, losses: 1, draws: 1, gamesPlayed: 1, rating: 1 } },
            { $limit: 1 }
          ],
          as: 'stats'
        }
      },
      { $unwind: { path: '$stats', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          playerId: { $toString: '$_id' },
          name: {
            $ifNull: [
              '$name',
              {
                $ifNull: [
                  '$username',
                  {
                    $ifNull: [
                      { $arrayElemAt: [{ $split: ['$email', '@'] }, 0] },
                      'Unknown Player'
                    ]
                  }
                ]
              }
            ]
          },
          gamesPlayed: { $ifNull: ['$stats.gamesPlayed', 0] },
          wins: { $ifNull: ['$stats.wins', 0] },
          losses: { $ifNull: ['$stats.losses', 0] },
          draws: { $ifNull: ['$stats.draws', 0] },
          rating: { $ifNull: ['$stats.rating', 500] },
          college: { $ifNull: ['$college', 'N/A'] }
        }
      },
      { $sort: { rating: -1, name: 1 } }
    ]);

    const normalizedPlayers = (players || []).map((player) => ({
      ...player,
      playerId: player?.playerId ? String(player.playerId) : '',
      name: safeTrim(player?.name) || 'Unknown Player'
    }));

    return { players: normalizedPlayers };
  },

  async getPlayerStatsDetails(db, { playerId }) {
    if (!ObjectId.isValid(playerId)) throw createError('Invalid player ID', 400);
    const database = await resolveDb(db);
    const playerObjectId = new ObjectId(playerId);

    const playerUser = await UserModel.findOne(database, {
      _id: playerObjectId,
      role: 'player',
      isDeleted: { $ne: 1 }
    });
    if (!playerUser) throw createError('Player not found', 404);

    const playerName = safeTrim(playerUser.name || playerUser.username || (playerUser.email || '').split('@')[0]) || 'Unknown Player';

    const playerIdentifiers = Array.from(new Set([
      safeTrim(playerUser.name),
      safeTrim(playerUser.username),
      safeTrim((playerUser.email || '').split('@')[0])
    ].filter(Boolean)));
    const playerIdentifierSet = new Set(playerIdentifiers.map((value) => value.toLowerCase()));
    const playerKeys = Array.from(playerIdentifierSet);

    const [statsDoc, ratingDoc, individualEntries, teamEntries] = await Promise.all([
      PlayerStatsModel.findOne(database, {
        $or: [
          { player_id: playerObjectId },
          { player_id: String(playerObjectId) }
        ]
      }),
      RatingHistoryModel.findOne(database, {
        $or: [
          { player_id: playerObjectId },
          { player_id: String(playerObjectId) }
        ]
      }),
      TournamentPlayersModel.findMany(
        database,
        playerKeys.length > 0
          ? {
            $expr: {
              $in: [
                { $toLower: { $ifNull: ['$username', ''] } },
                playerKeys
              ]
            }
          }
          : { _id: null },
        { projection: { tournament_id: 1 } }
      ),
      TeamEnrollmentsModel.findMany(
        database,
        playerKeys.length > 0
          ? {
            $expr: {
              $or: [
                { $in: [{ $toLower: { $ifNull: ['$captain_name', ''] } }, playerKeys] },
                { $in: [{ $toLower: { $ifNull: ['$player1_name', ''] } }, playerKeys] },
                { $in: [{ $toLower: { $ifNull: ['$player2_name', ''] } }, playerKeys] },
                { $in: [{ $toLower: { $ifNull: ['$player3_name', ''] } }, playerKeys] }
              ]
            }
          }
          : { _id: null },
        { projection: { tournament_id: 1 } }
      )
    ]);

    const tournamentIds = Array.from(new Set([
      ...(individualEntries || []).map((e) => e?.tournament_id).filter(Boolean).map(String),
      ...(teamEntries || []).map((e) => e?.tournament_id).filter(Boolean).map(String)
    ]))
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const pairingDocs = tournamentIds.length > 0
      ? await TournamentPairingsModel.findMany(
        database,
        { tournament_id: { $in: tournamentIds } },
        { projection: { tournament_id: 1, rounds: 1 } }
      )
      : [];

    const summary = {
      gamesPlayed: Number(statsDoc?.gamesPlayed || 0),
      wins: Number(statsDoc?.wins || 0),
      losses: Number(statsDoc?.losses || 0),
      draws: Number(statsDoc?.draws || 0),
      rating: Number(statsDoc?.rating || 500)
    };

    let ratingProgression = Array.isArray(ratingDoc?.ratingHistory)
      ? ratingDoc.ratingHistory.map((point) => ({
          date: point?.date ? new Date(point.date) : null,
          rating: Number(point?.rating || 0)
        }))
      : [];

    ratingProgression = ratingProgression
      .filter((point) => point.date && !Number.isNaN(point.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((point) => ({
        date: point.date.toISOString().split('T')[0],
        rating: point.rating
      }));

    if (ratingProgression.length === 0) {
      ratingProgression = [{
        date: new Date().toISOString().split('T')[0],
        rating: summary.rating
      }];
    }

    const rawMatchHistory = [];
    const matchTournamentIdSet = new Set();
    const playerIdStr = String(playerObjectId);

    const normalizeId = (value) => {
      if (value == null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value.toString) return String(value);
      return String(value);
    };

    const parsePairingResult = (pairing) => {
      const player1Name = safeTrim(pairing?.player1?.username);
      const player2Name = safeTrim(pairing?.player2?.username);
      const player1Key = player1Name.toLowerCase();
      const player2Key = player2Name.toLowerCase();

      const player1Id = normalizeId(pairing?.player1?.id);
      const player2Id = normalizeId(pairing?.player2?.id);

      const isPlayer1 = playerIdentifierSet.has(player1Key) || player1Id === playerIdStr;
      const isPlayer2 = playerIdentifierSet.has(player2Key) || player2Id === playerIdStr;

      if (!isPlayer1 && !isPlayer2) return null;

      const resultCode = safeTrim(pairing?.resultCode).toLowerCase();
      const resultText = safeTrim(pairing?.result).toLowerCase();
      let result = 'pending';

      if (resultCode === '1-0' || resultText === '1-0') {
        result = isPlayer1 ? 'win' : 'loss';
      } else if (resultCode === '0-1' || resultText === '0-1') {
        result = isPlayer2 ? 'win' : 'loss';
      } else if (resultCode === '0.5-0.5' || resultText === 'draw') {
        result = 'draw';
      } else {
        const winnerMatch = safeTrim(pairing?.result).match(/^(.+)\s+wins$/i);
        if (winnerMatch) {
          const winner = safeTrim(winnerMatch[1]).toLowerCase();
          result = playerIdentifierSet.has(winner) ? 'win' : 'loss';
        }
      }

      return {
        opponent: isPlayer1 ? (player2Name || 'Unknown') : (player1Name || 'Unknown'),
        result,
        playerScore: Number(isPlayer1 ? pairing?.player1?.score : pairing?.player2?.score) || 0,
        opponentScore: Number(isPlayer1 ? pairing?.player2?.score : pairing?.player1?.score) || 0
      };
    };

    (pairingDocs || []).forEach((doc) => {
      const tournamentId = doc?.tournament_id ? String(doc.tournament_id) : '';
      if (!tournamentId) return;

      (doc.rounds || []).forEach((round) => {
        (round?.pairings || []).forEach((pairing) => {
          const parsed = parsePairingResult(pairing);
          if (!parsed) return;
          rawMatchHistory.push({
            tournamentId,
            round: round?.round || 0,
            opponent: parsed.opponent,
            result: parsed.result,
            playerScore: parsed.playerScore,
            opponentScore: parsed.opponentScore
          });
          matchTournamentIdSet.add(tournamentId);
        });
      });
    });

    const tournamentIdsFromEntries = [...individualEntries, ...teamEntries]
      .map((entry) => entry?.tournament_id)
      .filter(Boolean)
      .map((id) => (typeof id === 'string' ? id : String(id)));

    const participationTournamentIdSet = new Set([...tournamentIdsFromEntries, ...matchTournamentIdSet]);

    const allTournamentObjectIds = Array.from(participationTournamentIdSet)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const tournaments = allTournamentObjectIds.length > 0
      ? await TournamentModel.findMany(
        database,
        { _id: { $in: allTournamentObjectIds } },
        { projection: { name: 1, date: 1, status: 1, type: 1, location: 1 } }
      )
      : [];

    const tournamentMap = new Map(tournaments.map((tournament) => [String(tournament._id), tournament]));

    let matchHistory = rawMatchHistory
      .map((match) => {
        const tournament = tournamentMap.get(match.tournamentId);
        const tournamentDate = tournament?.date ? new Date(tournament.date) : null;
        let matchDate = null;
        if (tournamentDate && !Number.isNaN(tournamentDate.getTime())) {
          matchDate = new Date(tournamentDate);
          matchDate.setHours(matchDate.getHours() + Math.max(match.round, 0));
        }

        return {
          date: matchDate ? matchDate.toISOString().split('T')[0] : '',
          tournamentId: match.tournamentId,
          tournamentName: tournament?.name || 'Tournament',
          round: match.round,
          opponent: match.opponent,
          result: match.result,
          playerScore: match.playerScore,
          opponentScore: match.opponentScore
        };
      })
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        if (dateA === dateB) return a.round - b.round;
        return dateA - dateB;
      });

    if (matchHistory.length === 0 && Number(summary.gamesPlayed || 0) > 0) {
      const winsLeft = Number(summary.wins || 0);
      const lossesLeft = Number(summary.losses || 0);
      const drawsLeft = Number(summary.draws || 0);
      const results = [
        ...Array(Math.max(0, winsLeft)).fill('win'),
        ...Array(Math.max(0, lossesLeft)).fill('loss'),
        ...Array(Math.max(0, drawsLeft)).fill('draw')
      ];
      const totalGames = Math.max(Number(summary.gamesPlayed || 0), results.length);
      const now = new Date();
      for (let i = 0; i < totalGames; i += 1) {
        const result = results[i] || 'draw';
        const d = new Date(now.getTime() - (totalGames - i) * 86400000);
        matchHistory.push({
          date: d.toISOString().split('T')[0],
          tournamentId: '',
          tournamentName: 'Recorded Game',
          round: i + 1,
          opponent: 'N/A',
          result,
          playerScore: result === 'win' ? 1 : result === 'draw' ? 0.5 : 0,
          opponentScore: result === 'loss' ? 1 : result === 'draw' ? 0.5 : 0
        });
      }
    }

    if (matchHistory.some((match) => !match.date)) {
      const now = new Date();
      matchHistory = matchHistory.map((match, index) => {
        if (match.date) return match;
        const fallback = new Date(now.getTime() - (matchHistory.length - index) * 86400000);
        return { ...match, date: fallback.toISOString().split('T')[0] };
      });
    }

    const computedSummary = matchHistory.reduce((acc, match) => {
      if (match.result === 'pending') return acc;
      acc.gamesPlayed += 1;
      if (match.result === 'win') acc.wins += 1;
      else if (match.result === 'loss') acc.losses += 1;
      else if (match.result === 'draw') acc.draws += 1;
      return acc;
    }, { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });

    if (summary.gamesPlayed === 0 && computedSummary.gamesPlayed > 0) {
      summary.gamesPlayed = computedSummary.gamesPlayed;
      summary.wins = computedSummary.wins;
      summary.losses = computedSummary.losses;
      summary.draws = computedSummary.draws;
    }

    if ((!summary.rating || Number.isNaN(summary.rating)) && ratingProgression.length > 0) {
      summary.rating = Number(ratingProgression[ratingProgression.length - 1]?.rating || 500);
    }

    if (ratingProgression.length < 2 && matchHistory.length > 0) {
      const matchesForCurve = matchHistory.filter((m) => m.result !== 'pending');
      if (matchesForCurve.length > 0) {
        const totalDelta = matchesForCurve.reduce((sum, m) => {
          if (m.result === 'win') return sum + 10;
          if (m.result === 'loss') return sum - 10;
          return sum;
        }, 0);

        let running = Math.max(100, Number(summary.rating || 500) - totalDelta);
        const generated = [];
        matchesForCurve.forEach((match, idx) => {
          if (match.result === 'win') running += 10;
          else if (match.result === 'loss') running -= 10;
          generated.push({
            date: match.date || new Date(Date.now() - (matchesForCurve.length - idx) * 86400000).toISOString().split('T')[0],
            rating: Math.max(100, Math.round(running))
          });
        });
        ratingProgression = generated;
      }
    }

    if (ratingProgression.length === 0) {
      ratingProgression = [{
        date: new Date().toISOString().split('T')[0],
        rating: Number(summary.rating || 500)
      }];
    }

    const performanceByMonth = {};
    matchHistory.forEach((match) => {
      if (!match.date || match.result === 'pending') return;
      const monthKey = match.date.slice(0, 7);
      if (!performanceByMonth[monthKey]) {
        performanceByMonth[monthKey] = {
          month: monthKey,
          wins: 0,
          losses: 0,
          draws: 0,
          matches: 0
        };
      }
      if (match.result === 'win') performanceByMonth[monthKey].wins += 1;
      else if (match.result === 'loss') performanceByMonth[monthKey].losses += 1;
      else if (match.result === 'draw') performanceByMonth[monthKey].draws += 1;
      performanceByMonth[monthKey].matches += 1;
    });

    const performanceHistory = Object.values(performanceByMonth)
      .sort((a, b) => a.month.localeCompare(b.month));

    const tournamentsByStatus = {};
    tournaments.forEach((tournament) => {
      const status = safeTrim(tournament?.status || 'unknown').toLowerCase() || 'unknown';
      tournamentsByStatus[status] = (tournamentsByStatus[status] || 0) + 1;
    });

    const participationStats = {
      totalTournaments: participationTournamentIdSet.size,
      individualEntries: individualEntries.length,
      teamEntries: teamEntries.length,
      byStatus: tournamentsByStatus
    };

    return {
      player: {
        playerId: String(playerUser._id),
        name: playerName,
        college: playerUser.college || 'N/A',
        email: playerUser.email || ''
      },
      summary,
      ratingProgression,
      matchHistory,
      performanceHistory,
      participationStats
    };
  },

  async getEnrolledPlayers(db, { tournamentId }) {
    if (!tournamentId) throw createError('Tournament ID is required', 400);

    const database = await resolveDb(db);
    const tid = new ObjectId(tournamentId);
    const tournament = await TournamentModel.findOne(database, { _id: tid });
    if (!tournament) throw createError('Tournament not found', 404);

    const individualPlayers = await TournamentPlayersModel.findMany(database, { tournament_id: tid });
    const teamEnrollments = await TeamEnrollmentsModel.aggregate(database, [
      { $match: { tournament_id: tid } },
      { $lookup: { from: 'users', localField: 'captain_id', foreignField: '_id', as: 'captain' } },
      { $unwind: '$captain' },
      { $project: { player1_name: 1, player2_name: 1, player3_name: 1, player1_approved: 1, player2_approved: 1, player3_approved: 1, captain_name: '$captain.name' } }
    ]);

    return {
      tournamentName: tournament.name,
      tournamentType: tournament.type,
      individualPlayers: individualPlayers || [],
      teamEnrollments: teamEnrollments || []
    };
  }
};

module.exports = PlayerStatsService;
