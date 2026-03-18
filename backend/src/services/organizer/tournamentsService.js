const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { getModel } = require('../../models');
const TournamentModel = getModel('tournaments');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const TournamentsService = {
  async listTournaments(db) {
    const database = await resolveDb(db);
    const tournaments = await TournamentModel.findMany(database, {}, { sort: { date: -1 } });

    return { tournaments: tournaments || [] };
  },

  async approveTournament(db, tournamentId, approvedBy) {
    const database = await resolveDb(db);
    const result = await TournamentModel.updateOne(
      database,
      { _id: new ObjectId(tournamentId) },
      {
        $set: {
          status: 'Approved',
          approved_by: approvedBy,
          approved_date: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Tournament approved successfully' };
    }
    throw createError('Tournament not found', 404);
  },

  async rejectTournament(db, tournamentId, rejectedBy) {
    const database = await resolveDb(db);
    const result = await TournamentModel.updateOne(
      database,
      { _id: new ObjectId(tournamentId) },
      {
        $set: {
          status: 'Rejected',
          rejected_by: rejectedBy,
          rejected_date: new Date()
        }
      }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Tournament rejected successfully' };
    }
    throw createError('Tournament not found', 404);
  }
};

module.exports = TournamentsService;
