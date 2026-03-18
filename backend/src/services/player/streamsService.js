const { connectDB } = require('../../config/database');
const { requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const StreamsModel = getModel('streams');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const StreamsService = {
  async getPlayerStreams(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const streams = await StreamsModel.findMany(
      database,
      { $or: [{ isLive: true }, { featured: true }] },
      { sort: { featured: -1, updatedAt: -1, createdAt: -1 } }
    );

    return (streams || []).map(s => ({
      _id: s._id ? s._id.toString() : undefined,
      title: s.title,
      url: s.url,
      platform: s.platform,
      streamType: s.streamType || 'classical',
      matchLabel: s.matchLabel,
      description: s.description,
      result: s.result,
      isLive: s.isLive,
      featured: s.featured,
      createdByName: s.createdByName,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt
    }));
  }
};

module.exports = StreamsService;
