const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const Player = require('../../models/Player');
const Team = require('../../models/Team');
const { swissPairing, swissTeamPairing } = require('../../utils/swissPairing');
const { getModel } = require('../../models');
const TournamentPlayersModel = getModel('tournament_players');
const TournamentPairingsModel = getModel('tournament_pairings');
const TournamentModel = getModel('tournaments');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');
const TournamentTeamPairingsModel = getModel('tournament_team_pairings');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const PairingsService = {
  async getPairings(db, { tournamentId, totalRounds }) {
    if (!tournamentId) {
      throw createError('Tournament ID is required', 400);
    }

    const database = await resolveDb(db);
    const rows = await TournamentPlayersModel.findMany(database, { tournament_id: new ObjectId(tournamentId) });
    if (rows.length === 0) {
      return { roundNumber: 1, allRounds: [], message: 'No players enrolled' };
    }

    let storedPairings = await TournamentPairingsModel.findOne(database, { tournament_id: new ObjectId(tournamentId) });
    let allRounds;

    if (!storedPairings || storedPairings.totalRounds !== totalRounds || rows.length !== (storedPairings.rounds[0]?.pairings?.length * 2 || 0) + (storedPairings.rounds[0]?.byePlayer ? 1 : 0)) {
      let players = rows.map(row => new Player(row._id, row.username, row.college, row.gender));
      allRounds = swissPairing(players, totalRounds);

      await TournamentPairingsModel.deleteOne(database, { tournament_id: new ObjectId(tournamentId) });
      await TournamentPairingsModel.insertOne(database, {
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

    return { roundNumber: totalRounds, allRounds };
  },

  async getRankings(db, { tournamentId }) {
    if (!tournamentId) throw createError('Tournament ID is required', 400);

    const database = await resolveDb(db);
    const tid = new ObjectId(tournamentId);
    const rows = await TournamentPlayersModel.findMany(database, { tournament_id: tid });
    if (rows.length === 0) {
      return { rankings: [], tournamentId };
    }

    let storedPairings = await TournamentPairingsModel.findOne(database, { tournament_id: tid });
    let rankings = [];
    if (!storedPairings) {
      const totalRounds = 5;
      let players = rows.map(row => new Player(row._id, row.username, row.college, row.gender));
      const allRounds = swissPairing(players, totalRounds);
      await TournamentPairingsModel.insertOne(database, {
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
    return { rankings, tournamentId };
  },

  async getTeamPairings(db, { tournamentId, totalRounds }) {
    if (!tournamentId) throw createError('Tournament ID is required', 400);

    const database = await resolveDb(db);
    const tid = new ObjectId(tournamentId);

    const tournament = await TournamentModel.findOne(database, { _id: tid });
    if (!tournament) {
      throw createError('Tournament not found', 404);
    }

    const tournamentType = (tournament.type || '').toLowerCase();
    if (!['team', 'group'].includes(tournamentType)) {
      throw createError('This is not a team tournament', 400);
    }

    const approvedTeams = await TeamEnrollmentsModel.findMany(database, {
      tournament_id: tid,
      approved: 1
    });

    if (approvedTeams.length === 0) {
      return { roundNumber: 1, allRounds: [], message: 'No approved teams enrolled' };
    }

    let storedPairings = await TournamentTeamPairingsModel.findOne(database, { tournament_id: tid });
    let allRounds;

    const expectedTeamCount = storedPairings?.rounds?.[0]?.pairings?.length * 2 + (storedPairings?.rounds?.[0]?.byeTeam ? 1 : 0);
    if (!storedPairings || storedPairings.totalRounds !== totalRounds || approvedTeams.length !== expectedTeamCount) {
      let teams = approvedTeams.map(enrollment => new Team(
        enrollment._id,
        `Team ${enrollment.captain_name}`,
        enrollment.captain_name,
        enrollment.player1_name,
        enrollment.player2_name,
        enrollment.player3_name
      ));

      allRounds = swissTeamPairing(teams, totalRounds);

      await TournamentTeamPairingsModel.deleteOne(database, { tournament_id: tid });
      await TournamentTeamPairingsModel.insertOne(database, {
        tournament_id: tid,
        totalRounds: totalRounds,
        rounds: allRounds.map(round => ({
          round: round.round,
          pairings: round.pairings.map(pairing => ({
            team1: {
              id: pairing.team1.id,
              teamName: pairing.team1.teamName,
              captainName: pairing.team1.captainName,
              player1: pairing.team1.player1,
              player2: pairing.team1.player2,
              player3: pairing.team1.player3,
              score: pairing.team1.score
            },
            team2: {
              id: pairing.team2.id,
              teamName: pairing.team2.teamName,
              captainName: pairing.team2.captainName,
              player1: pairing.team2.player1,
              player2: pairing.team2.player2,
              player3: pairing.team2.player3,
              score: pairing.team2.score
            },
            result: pairing.result
          })),
          byeTeam: round.byeTeam ? {
            id: round.byeTeam.id,
            teamName: round.byeTeam.teamName,
            captainName: round.byeTeam.captainName,
            player1: round.byeTeam.player1,
            player2: round.byeTeam.player2,
            player3: round.byeTeam.player3,
            score: round.byeTeam.score
          } : null
        }))
      });
    } else {
      allRounds = storedPairings.rounds.map(round => {
        const pairings = round.pairings.map(pairing => {
          const team1 = new Team(pairing.team1.id, pairing.team1.teamName, pairing.team1.captainName, pairing.team1.player1, pairing.team1.player2, pairing.team1.player3);
          team1.score = pairing.team1.score;
          const team2 = new Team(pairing.team2.id, pairing.team2.teamName, pairing.team2.captainName, pairing.team2.player1, pairing.team2.player2, pairing.team2.player3);
          team2.score = pairing.team2.score;
          return { team1, team2, result: pairing.result };
        });
        const byeTeam = round.byeTeam ? new Team(round.byeTeam.id, round.byeTeam.teamName, round.byeTeam.captainName, round.byeTeam.player1, round.byeTeam.player2, round.byeTeam.player3) : null;
        if (byeTeam) byeTeam.score = round.byeTeam.score;
        return { round: round.round, pairings, byeTeam };
      });
    }

    return { roundNumber: totalRounds, allRounds, isTeamTournament: true };
  },

  async getTeamRankings(db, { tournamentId }) {
    if (!tournamentId) throw createError('Tournament ID is required', 400);

    const database = await resolveDb(db);
    const tid = new ObjectId(tournamentId);

    const tournament = await TournamentModel.findOne(database, { _id: tid });
    if (!tournament) {
      throw createError('Tournament not found', 404);
    }

    const tournamentType = (tournament.type || '').toLowerCase();
    if (!['team', 'group'].includes(tournamentType)) {
      throw createError('This is not a team tournament', 400);
    }

    const approvedTeams = await TeamEnrollmentsModel.findMany(database, {
      tournament_id: tid,
      approved: 1
    });

    if (approvedTeams.length === 0) {
      return { rankings: [], tournamentId, isTeamTournament: true };
    }

    let storedPairings = await TournamentTeamPairingsModel.findOne(database, { tournament_id: tid });
    let rankings = [];

    if (!storedPairings) {
      const totalRounds = 5;
      let teams = approvedTeams.map(enrollment => new Team(
        enrollment._id,
        `Team ${enrollment.captain_name}`,
        enrollment.captain_name,
        enrollment.player1_name,
        enrollment.player2_name,
        enrollment.player3_name
      ));

      const allRounds = swissTeamPairing(teams, totalRounds);
      await TournamentTeamPairingsModel.insertOne(database, {
        tournament_id: tid,
        totalRounds: totalRounds,
        rounds: allRounds.map(round => ({
          round: round.round,
          pairings: round.pairings.map(pairing => ({
            team1: {
              id: pairing.team1.id,
              teamName: pairing.team1.teamName,
              captainName: pairing.team1.captainName,
              player1: pairing.team1.player1,
              player2: pairing.team1.player2,
              player3: pairing.team1.player3,
              score: pairing.team1.score
            },
            team2: {
              id: pairing.team2.id,
              teamName: pairing.team2.teamName,
              captainName: pairing.team2.captainName,
              player1: pairing.team2.player1,
              player2: pairing.team2.player2,
              player3: pairing.team2.player3,
              score: pairing.team2.score
            },
            result: pairing.result
          })),
          byeTeam: round.byeTeam ? {
            id: round.byeTeam.id,
            teamName: round.byeTeam.teamName,
            captainName: round.byeTeam.captainName,
            player1: round.byeTeam.player1,
            player2: round.byeTeam.player2,
            player3: round.byeTeam.player3,
            score: round.byeTeam.score
          } : null
        }))
      });

      rankings = teams.sort((a, b) => b.score - a.score).map((t, index) => ({
        rank: index + 1,
        teamName: t.teamName,
        captainName: t.captainName,
        players: [t.player1, t.player2, t.player3],
        score: t.score
      }));
    } else {
      let teamsMap = new Map();
      approvedTeams.forEach(enrollment => {
        teamsMap.set(enrollment._id.toString(), {
          id: enrollment._id.toString(),
          teamName: `Team ${enrollment.captain_name}`,
          captainName: enrollment.captain_name,
          players: [enrollment.player1_name, enrollment.player2_name, enrollment.player3_name],
          score: 0
        });
      });

      storedPairings.rounds.forEach(round => {
        round.pairings.forEach(pairing => {
          const team1 = teamsMap.get(pairing.team1.id.toString());
          const team2 = teamsMap.get(pairing.team2.id.toString());
          if (team1) team1.score = pairing.team1.score;
          if (team2) team2.score = pairing.team2.score;
        });
        if (round.byeTeam) {
          const byeTeam = teamsMap.get(round.byeTeam.id.toString());
          if (byeTeam) byeTeam.score = round.byeTeam.score;
        }
      });

      rankings = Array.from(teamsMap.values())
        .sort((a, b) => b.score - a.score)
        .map((t, index) => ({
          rank: index + 1,
          teamName: t.teamName,
          captainName: t.captainName,
          players: t.players,
          score: t.score
        }));
    }

    return { rankings, tournamentId, isTeamTournament: true };
  }
};

module.exports = PairingsService;
