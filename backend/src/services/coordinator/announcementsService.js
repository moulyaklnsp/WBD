const { connectDB } = require('../../config/database');
const { requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const Cache = require('../../utils/cache');
const AnnouncementsModel = getModel('announcements');
const resolveDb = async (db) => (db ? db : connectDB());

const AnnouncementsService = {
  async postAnnouncement(db, user, { body, io }) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const { title, message, targetRole } = body || {};

    const announcement = {
      title,
      message,
      posted_by: userEmail,
      posted_date: new Date(),
      target_role: targetRole || 'player',
      is_active: true
    };

    const database = await resolveDb(db);
    const result = await AnnouncementsModel.insertOne(database, announcement);
    announcement._id = result.insertedId;

    if (io) {
      io.emit('liveAnnouncement', announcement);
    }

    await Cache.invalidateTags(['announcements'], { reason: 'announcements.post' });
    return { success: true, announcement };
  }
};

module.exports = AnnouncementsService;
