const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const NotificationsModel = getModel('notifications');
const TournamentModel = getModel('tournaments');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const NotificationsService = {
  async getNotifications(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);

    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('Coordinator not found', 404);

    const notifications = await NotificationsModel.findMany(
      database,
      { user_id: coordinator._id },
      { sort: { date: -1 }, limit: 50 }
    );

    const tournamentIds = [...new Set(notifications.filter(n => n.tournament_id).map(n => n.tournament_id))];
    const tournaments = tournamentIds.length > 0
      ? await TournamentModel.findMany(database, { _id: { $in: tournamentIds } })
      : [];
    const tournamentMap = new Map(tournaments.map(t => [t._id.toString(), t.name]));

    const enriched = notifications.map(n => ({
      ...n,
      _id: n._id.toString(),
      tournament_name: n.tournament_id ? tournamentMap.get(n.tournament_id.toString()) || 'Unknown' : null
    }));

    return { notifications: enriched };
  },

  async markNotificationsRead(db, user, { notificationIds }) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);

    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('Coordinator not found', 404);

    const filter = { user_id: coordinator._id };
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      filter._id = { $in: notificationIds.map(id => new ObjectId(id)) };
    }

    await NotificationsModel.updateMany(database, filter, { $set: { read: true } });
    return { success: true };
  }
};

module.exports = NotificationsService;
