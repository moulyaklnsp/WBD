const { connectDB } = require('../../config/database');
const { requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const TournamentModel = getModel('tournaments');
const ProductsModel = getModel('products');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const DashboardService = {
  async getDashboard(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) {
      throw createError('Player not found', 404);
    }
    const username = userDoc.name || user?.username || user?.email;

    const latestTournaments = await TournamentModel.findMany(
      database,
      { status: 'Approved' },
      { sort: { date: -1 }, limit: 5 }
    );

    const latestItems = await ProductsModel.findMany(
      database,
      { availability: { $gt: 0 } },
      { sort: { _id: -1 }, limit: 5 }
    );

    const teamRequests = await TeamEnrollmentsModel.aggregate(database, [
      {
        $match: {
          $or: [{ player1_name: username }, { player2_name: username }, { player3_name: username }, { captain_name: username }]
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
          tournamentDate: '$tournament.date',
          tournamentTime: '$tournament.time',
          captainName: '$captain.name',
          captain_id: 1,
          player1_name: 1,
          player2_name: 1,
          player3_name: 1,
          player1_approved: 1,
          player2_approved: 1,
          player3_approved: 1,
          approved: 1,
          status: 1
        }
      },
      { $sort: { _id: -1 } }
    ]);

    return {
      playerName: username,
      latestTournaments: latestTournaments || [],
      latestItems: latestItems || [],
      teamRequests: teamRequests || []
    };
  }
};

module.exports = DashboardService;
