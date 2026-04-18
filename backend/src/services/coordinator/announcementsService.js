const { connectDB } = require('../../config/database');
const { requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const Cache = require('../../utils/cache');
const { createSolrService } = require('../../solr/SolrService');
const { isSolrEnabled } = require('../../solr/solrEnabled');
const { mapAnnouncementToSolrDoc } = require('../../solr/mappers/announcementMapper');
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

    if (isSolrEnabled()) {
      try {
        const solr = createSolrService();
        await solr.indexDocument('announcements', mapAnnouncementToSolrDoc(announcement));
      } catch (e) {
        console.error('[solr] Failed to index announcement:', e?.message || e);
      }
    }

    await Cache.invalidateTags(['announcements'], { reason: 'announcements.post' });
    return { success: true, announcement };
  }
};

module.exports = AnnouncementsService;
