const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const ChessEventsModel = getModel('chess_events');
const { createSolrService } = require('../../solr/SolrService');
const { isSolrEnabled } = require('../../solr/solrEnabled');
const { mapChessEventToSolrDoc } = require('../../solr/mappers/chessEventMapper');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const requireCoordinatorById = async (database, userId) => {
  if (!userId || !ObjectId.isValid(userId)) {
    throw createError('Unauthorized', 401);
  }
  const coordinator = await UserModel.findOne(database, {
    _id: new ObjectId(userId),
    role: 'coordinator'
  });
  if (!coordinator) throw createError('Forbidden', 403);
  return coordinator;
};

const ChessEventsService = {
  async getChessEvents(db, { userId }) {
    const database = await resolveDb(db);
    await requireCoordinatorById(database, userId);
    const events = await ChessEventsModel.findMany(
      database,
      { coordinatorId: userId },
      { sort: { date: 1 } }
    );

    return events;
  },

  async createChessEvent(db, { userId, body }) {
    const { title, description, date, category, location, link } = body || {};
    if (!title || !date || !category) {
      throw createError('Title, date and category are required', 400);
    }
    const validCategories = ['Chess Talk', 'Tournament Alert', 'Live Announcement', 'Workshop', 'Webinar', 'Exhibition Match', 'Other'];
    if (!validCategories.includes(category)) {
      throw createError('Invalid category. Must be one of: ' + validCategories.join(', '), 400);
    }

    const database = await resolveDb(db);
    const coordinator = await requireCoordinatorById(database, userId);
    const event = {
      title: title.trim(),
      description: (description || '').trim(),
      date: new Date(date),
      category,
      location: (location || '').trim(),
      link: (link || '').trim(),
      coordinatorId: userId,
      coordinatorName: coordinator ? coordinator.name : 'Coordinator',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await ChessEventsModel.insertOne(database, event);

    const created = { ...event, _id: result.insertedId };
    if (isSolrEnabled()) {
      try {
        const solr = createSolrService();
        await solr.indexDocument('chess_events', mapChessEventToSolrDoc(created));
      } catch (e) {
        console.error('[solr] Failed to index chess event create:', e?.message || e);
      }
    }

    return created;
  },

  async updateChessEvent(db, { userId, id, body }) {
    const { title, description, date, category, location, link, active } = body || {};
    const database = await resolveDb(db);
    await requireCoordinatorById(database, userId);

    const existing = await ChessEventsModel.findOne(database, { _id: new ObjectId(id), coordinatorId: userId });
    if (!existing) throw createError('Event not found', 404);

    const update = { updatedAt: new Date() };
    if (title !== undefined) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    if (date !== undefined) update.date = new Date(date);
    if (category !== undefined) {
      const validCategories = ['Chess Talk', 'Tournament Alert', 'Live Announcement', 'Workshop', 'Webinar', 'Exhibition Match', 'Other'];
      if (!validCategories.includes(category)) throw createError('Invalid category', 400);
      update.category = category;
    }
    if (location !== undefined) update.location = location.trim();
    if (link !== undefined) update.link = link.trim();
    if (active !== undefined) update.active = !!active;

    await ChessEventsModel.updateOne(database, { _id: new ObjectId(id) }, { $set: update });
    const updated = await ChessEventsModel.findOne(database, { _id: new ObjectId(id) });

    if (isSolrEnabled() && updated) {
      try {
        const solr = createSolrService();
        await solr.indexDocument('chess_events', mapChessEventToSolrDoc(updated));
      } catch (e) {
        console.error('[solr] Failed to index chess event update:', e?.message || e);
      }
    }
    return updated;
  },

  async deleteChessEvent(db, { userId, id }) {
    const database = await resolveDb(db);
    await requireCoordinatorById(database, userId);
    const result = await ChessEventsModel.deleteOne(database, { _id: new ObjectId(id), coordinatorId: userId });
    if (result.deletedCount === 0) throw createError('Event not found', 404);

    if (isSolrEnabled()) {
      try {
        const solr = createSolrService();
        await solr.deleteDocument('chess_events', `chess_events:${id}`);
      } catch (e) {
        console.error('[solr] Failed to delete chess event from index:', e?.message || e);
      }
    }
    return { success: true };
  }
};

module.exports = ChessEventsService;
