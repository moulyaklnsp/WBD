const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const NotificationsModel = getModel('notifications');
const AnnouncementsModel = getModel('announcements');
const PlatformUpdatesModel = getModel('platform_updates');
const ChessEventsModel = getModel('chess_events');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const NotificationsService = {
  async getNotifications(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player' });
    if (!userDoc) throw createError('Player not found', 404);

    const notifications = await NotificationsModel.aggregate(database, [
      { $match: { user_id: userDoc._id } },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $unwind: '$tournament' },
      {
        $project: {
          _id: 1,
          type: 1,
          read: 1,
          date: 1,
          tournamentName: '$tournament.name',
          tournament_id: '$tournament._id'
        }
      }
    ]);

    const formattedNotifications = notifications.map(n => ({
      ...n,
      _id: n._id.toString(),
      tournament_id: n.tournament_id.toString()
    }));

    return { notifications: formattedNotifications };
  },

  async markNotificationRead(db, user, notificationId) {
    requirePlayer(user);
    if (!notificationId) throw createError('Notification ID required', 400);
    const database = await resolveDb(db);
    await NotificationsModel.updateOne(
      database,
      { _id: new ObjectId(notificationId) },
      { $set: { read: true } }
    );
    return { success: true };
  },

  async getAnnouncements(db) {
    const database = await resolveDb(db);
    const announcements = await AnnouncementsModel.findMany(
      database,
      {
        is_active: true,
        target_role: { $in: ['all', 'player'] }
      },
      { sort: { posted_date: -1 }, limit: 10 }
    );
    return announcements;
  },

  async getNews(db) {
    const database = await resolveDb(db);

    const updates = await PlatformUpdatesModel.findMany(
      database,
      {},
      { sort: { date: -1 }, limit: 10 }
    );

    const events = await ChessEventsModel.findMany(
      database,
      { active: true, date: { $gte: new Date() } },
      { sort: { date: 1 }, limit: 20 }
    );

    return { updates, events };
  }
};

module.exports = NotificationsService;
