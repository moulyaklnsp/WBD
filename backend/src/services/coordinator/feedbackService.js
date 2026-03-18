const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const TournamentModel = getModel('tournaments');
const TournamentPlayersModel = getModel('tournament_players');
const TeamEnrollmentsModel = getModel('enrolledtournaments_team');
const UserModel = getModel('users');
const NotificationsModel = getModel('notifications');
const FeedbacksModel = getModel('feedbacks');

const createError = (message, statusCode, extra) => Object.assign(new Error(message), { statusCode, ...extra });
const resolveDb = async (db) => (db ? db : connectDB());

const FeedbackService = {
  async requestFeedback(db, user, { tournamentId }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(tournamentId)) {
      throw createError('Invalid tournament ID', 400);
    }

    const coordinator = user?.username || user?.email;

    const database = await resolveDb(db);
    const tid = new ObjectId(tournamentId);

    const tournament = await TournamentModel.findOne(database, {
      _id: tid,
      coordinator
    });
    if (!tournament) {
      throw createError('Tournament not found or you are not authorized', 404);
    }

    const tDate = new Date(tournament.date);
    const timeStr = (tournament.time || '').toString();
    const [hh, mm] = (timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00']);
    const start = new Date(tDate);
    start.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
    const now = new Date();
    if (now < start) {
      throw createError('Feedback can be requested once the tournament starts', 400);
    }

    if (tournament.feedback_requested) {
      throw createError('Feedback already requested for this tournament', 400);
    }

    const individualPlayers = await TournamentPlayersModel.findMany(database, { tournament_id: tid });
    const teamEnrollments = await TeamEnrollmentsModel.findMany(database, { tournament_id: tid });

    const playerUsernames = new Set([
      ...individualPlayers.map(p => p.username),
      ...teamEnrollments.flatMap(t => [t.player1_name, t.player2_name, t.player3_name].filter(Boolean))
    ]);
    const names = Array.from(playerUsernames).filter(Boolean);

    const players = await UserModel.findMany(database, {
      role: 'player',
      name: { $in: names }
    });

    const notifications = players.map(player => ({
      user_id: player._id,
      type: 'feedback_request',
      tournament_id: tid,
      read: false,
      date: new Date()
    }));

    if (notifications.length > 0) {
      await NotificationsModel.insertMany(database, notifications);
    }

    const result = await TournamentModel.updateOne(
      database,
      { _id: tid },
      { $set: { feedback_requested: true } }
    );

    if (result.modifiedCount > 0) {
      return { success: true, message: 'Feedback requested successfully' };
    }

    throw createError('Failed to request feedback', 400);
  },

  async getFeedbacks(db, { tournamentId }) {
    if (!tournamentId) throw createError('Tournament ID required', 400);

    const database = await resolveDb(db);
    const tid = new ObjectId(tournamentId);
    const feedbacks = await FeedbacksModel.findMany(database, { tournament_id: tid });

    return { feedbacks };
  }
};

module.exports = FeedbackService;
