const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { normalizePlatform, normalizeStreamType, safeTrim, requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const Cache = require('../../utils/cache');
const { createSolrService } = require('../../solr/SolrService');
const { isSolrEnabled } = require('../../solr/solrEnabled');
const { mapStreamToSolrDoc } = require('../../solr/mappers/streamMapper');
const StreamsModel = getModel('streams');
const UserModel = getModel('users');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const StreamsService = {
  async getStreams(db, user) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const database = await resolveDb(db);
    const streams = await StreamsModel.findMany(
      database,
      { createdByEmail: userEmail },
      { sort: { updatedAt: -1, createdAt: -1 } }
    );

    return (streams || []).map(s => ({
      ...s,
      _id: s._id ? s._id.toString() : undefined
    }));
  },

  async createStream(db, user, { body }) {
    requireCoordinator(user);
    const userEmail = user?.email;
    const username = user?.username;

    const title = safeTrim(body?.title);
    const url = safeTrim(body?.url);
    const platform = normalizePlatform(body?.platform);
    const streamType = normalizeStreamType(body?.streamType);
    const description = safeTrim(body?.description);
    const isLive = !!body?.isLive;
    const featured = !!body?.featured;
    const matchLabel = safeTrim(body?.matchLabel);

    if (!title) throw createError('Title is required', 400);
    if (!url) throw createError('Stream URL is required', 400);
    if (!streamType) throw createError('Stream type is required (Classical, Rapid, or Blitz)', 400);

    const database = await resolveDb(db);

    const coordinator = await UserModel.findOne(database, {
      email: userEmail,
      role: 'coordinator'
    });

    const now = new Date();
    const doc = {
      title,
      url,
      platform,
      streamType,
      description,
      matchLabel,
      result: safeTrim(body?.result) || '',
      isLive,
      featured,
      createdByEmail: userEmail,
      createdByName: coordinator?.name || username || userEmail,
      createdAt: now,
      updatedAt: now
    };

    if (!isLive) {
      doc.endedAt = now;
    }

    const result = await StreamsModel.insertOne(database, doc);
    await Cache.invalidateTags(['streams'], { reason: 'streams.create' });

    if (isSolrEnabled()) {
      try {
        const solr = createSolrService();
        await solr.indexDocument('streams', mapStreamToSolrDoc({ ...doc, _id: result.insertedId }));
      } catch (e) {
        console.error('[solr] Failed to index stream create:', e?.message || e);
      }
    }
    return { ...doc, _id: result.insertedId.toString() };
  },

  async updateStream(db, user, { id, body }) {
    requireCoordinator(user);
    const userEmail = user?.email;
    if (!ObjectId.isValid(id)) throw createError('Invalid id', 400);

    const updates = {};
    if (body?.title != null) updates.title = safeTrim(body.title);
    if (body?.url != null) updates.url = safeTrim(body.url);
    if (body?.platform != null) updates.platform = normalizePlatform(body.platform);
    if (body?.streamType != null) updates.streamType = normalizeStreamType(body.streamType);
    if (body?.description != null) updates.description = safeTrim(body.description);
    if (body?.matchLabel != null) updates.matchLabel = safeTrim(body.matchLabel);
    if (body?.result != null) updates.result = safeTrim(body.result);
    if (body?.isLive != null) updates.isLive = !!body.isLive;
    if (body?.featured != null) updates.featured = !!body.featured;
    updates.updatedAt = new Date();

    if ('title' in updates && !updates.title) throw createError('Title cannot be empty', 400);
    if ('url' in updates && !updates.url) throw createError('Stream URL cannot be empty', 400);
    if ('streamType' in updates && !updates.streamType) {
      throw createError('Invalid stream type. Use Classical, Rapid, or Blitz', 400);
    }

    const database = await resolveDb(db);

    const filter = { _id: new ObjectId(id), createdByEmail: userEmail };
    const existing = await StreamsModel.findOne(database, filter);
    if (!existing) throw createError('Stream not found', 404);

    const unsetOps = {};
    if ('isLive' in updates) {
      if (updates.isLive === false && existing.isLive === true) {
        updates.endedAt = new Date();
      }
      if (updates.isLive === true && existing.isLive === false) {
        unsetOps.endedAt = '';
      }
    }

    const updateDoc = { $set: updates };
    if (Object.keys(unsetOps).length > 0) {
      updateDoc.$unset = unsetOps;
    }

    await StreamsModel.updateOne(database, filter, updateDoc);
    const updated = await StreamsModel.findOne(database, filter);

    await Cache.invalidateTags(['streams'], { reason: 'streams.update' });

    if (isSolrEnabled() && updated) {
      try {
        const solr = createSolrService();
        await solr.indexDocument('streams', mapStreamToSolrDoc(updated));
      } catch (e) {
        console.error('[solr] Failed to index stream update:', e?.message || e);
      }
    }
    return {
      ...(updated || {}),
      _id: updated?._id ? updated._id.toString() : undefined
    };
  },

  async deleteStream(db, user, { id }) {
    requireCoordinator(user);
    const userEmail = user?.email;
    if (!ObjectId.isValid(id)) throw createError('Invalid id', 400);

    const database = await resolveDb(db);
    const result = await StreamsModel.deleteOne(database, { _id: new ObjectId(id), createdByEmail: userEmail });

    if (result.deletedCount === 0) throw createError('Stream not found', 404);
    await Cache.invalidateTags(['streams'], { reason: 'streams.delete' });

    if (isSolrEnabled()) {
      try {
        const solr = createSolrService();
        await solr.deleteDocument('streams', `streams:${id}`);
      } catch (e) {
        console.error('[solr] Failed to delete stream from index:', e?.message || e);
      }
    }
    return { success: true };
  }
};

module.exports = StreamsService;
