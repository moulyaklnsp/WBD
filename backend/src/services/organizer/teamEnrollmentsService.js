const { connectDB } = require('../../config/database');
const { getModel } = require('../../models');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');

const resolveDb = async (db) => (db ? db : connectDB());

const TeamEnrollmentsService = {
  async countByTournamentId(db, tournamentId) {
    const database = await resolveDb(db);
    return TeamEnrollmentsModel.countDocuments(database, { tournament_id: tournamentId });
  },

  async listByTournamentId(db, tournamentId) {
    const database = await resolveDb(db);
    return TeamEnrollmentsModel.findMany(database, { tournament_id: tournamentId });
  }
};

module.exports = TeamEnrollmentsService;
