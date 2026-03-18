const { connectDB } = require('../../config/database');
const { getModel } = require('../../models');
const TournamentPlayersModel = getModel('tournament_players');

const resolveDb = async (db) => (db ? db : connectDB());

const TournamentPlayersService = {
  async countByTournamentId(db, tournamentId) {
    const database = await resolveDb(db);
    return TournamentPlayersModel.countDocuments(database, { tournament_id: tournamentId });
  },

  async listByTournamentId(db, tournamentId) {
    const database = await resolveDb(db);
    return TournamentPlayersModel.findMany(database, { tournament_id: tournamentId });
  }
};

module.exports = TournamentPlayersService;
