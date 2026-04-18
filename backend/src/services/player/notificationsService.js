const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const NotificationsModel = getModel('notifications');
const AnnouncementsModel = getModel('announcements');
const PlatformUpdatesModel = getModel('platform_updates');
const ChessEventsModel = getModel('chess_events');
const { createSolrService } = require('../../solr/SolrService');
const { isSolrEnabled } = require('../../solr/solrEnabled');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

function safeTrim(value) {
  return String(value == null ? '' : value).trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function normalizeFacets(value) {
  const raw = Array.isArray(value) ? value : (safeTrim(value) ? safeTrim(value).split(',') : []);
  const allow = new Set(['announcement_target_role_ss']);
  return raw.map((v) => safeTrim(v)).filter((v) => allow.has(v));
}

function parseMongoIdFromSolrId(entity, solrId) {
  const raw = safeTrim(solrId);
  const prefix = `${entity}:`;
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  return raw;
}

function sortByIdOrder(items, ids) {
  const order = new Map(ids.map((id, idx) => [String(id), idx]));
  return (items || [])
    .slice()
    .sort((a, b) => (order.get(String(a?._id)) ?? 1e9) - (order.get(String(b?._id)) ?? 1e9));
}

function parseMongoIdFromSolrDocId(entity, solrDocId) {
  const raw = safeTrim(solrDocId);
  const prefix = `${entity}:`;
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  return raw;
}

function toSolrIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

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

  async getAnnouncements(db, user, query = {}, { solrService } = {}) {
    const database = await resolveDb(db);
    const q = safeTrim(query?.q || query?.search);
    const pageSize = Math.min(toPositiveInt(query?.pageSize ?? query?.limit, 10), 50);
    const page = toPositiveInt(query?.page, 1);
    const skip = (page - 1) * pageSize;

    const facets = normalizeFacets(query?.facets);

    if (isSolrEnabled()) {
      const solr = solrService || createSolrService();
      const role = String(user?.role || 'player').toLowerCase();

      const fq = [
        'announcement_is_active_b:true',
        'announcement_target_role_ss:(all OR player)'
      ];

      const sort = 'announcement_posted_date_dt desc';
      const solrResult = await solr.search('announcements', {
        q,
        role,
        page,
        pageSize,
        facets,
        sort,
        fq
      });

      if (solrResult?.success === true) {
        const mongoIdStrings = (solrResult.docs || [])
          .map((d) => parseMongoIdFromSolrId('announcements', d?.id))
          .filter((idStr) => ObjectId.isValid(idStr));
        const objectIds = mongoIdStrings.map((idStr) => new ObjectId(idStr));

        const rows = objectIds.length
          ? await AnnouncementsModel.findMany(database, { _id: { $in: objectIds } })
          : [];

        const ordered = sortByIdOrder(rows, objectIds);
        return {
          announcements: ordered,
          _meta: { engine: 'solr' }
        };
      }

      console.error('NotificationsService.getAnnouncements solr failed:', solrResult?.error || 'unknown');
    }

    const filter = {
      is_active: true,
      target_role: { $in: ['all', 'player'] }
    };

    if (q && q.length <= 80) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ title: re }, { message: re }];
    }

    const announcements = await AnnouncementsModel.findMany(
      database,
      filter,
      { sort: { posted_date: -1 }, skip, limit: pageSize }
    );
    return { announcements, _meta: { engine: 'db' } };
  },

  async getNews(db) {
    const database = await resolveDb(db);

    const updates = await PlatformUpdatesModel.findMany(
      database,
      {},
      { sort: { date: -1 }, limit: 10 }
    );

    if (isSolrEnabled()) {
      const solr = createSolrService();
      const nowIso = toSolrIsoDate(new Date());
      const fq = [
        'chess_event_active_b:true',
        nowIso ? `chess_event_date_dt:[${nowIso} TO *]` : null
      ].filter(Boolean);

      const solrResult = await solr.search('chess_events', {
        q: '',
        role: 'public',
        page: 1,
        pageSize: 20,
        sort: 'chess_event_date_dt asc',
        fq
      });

      if (solrResult?.success === true) {
        const mongoIdStrings = (solrResult.docs || [])
          .map((d) => parseMongoIdFromSolrDocId('chess_events', d?.id))
          .filter((idStr) => ObjectId.isValid(idStr));
        const objectIds = mongoIdStrings.map((idStr) => new ObjectId(idStr));

        const rows = objectIds.length
          ? await ChessEventsModel.findMany(database, { _id: { $in: objectIds } })
          : [];

        const ordered = sortByIdOrder(rows, objectIds);
        return { updates, events: ordered, _meta: { engine: 'solr' } };
      }

      console.error('NotificationsService.getNews solr failed:', solrResult?.error || 'unknown');
    }

    const events = await ChessEventsModel.findMany(
      database,
      { active: true, date: { $gte: new Date() } },
      { sort: { date: 1 }, limit: 20 }
    );

    return { updates, events, _meta: { engine: 'db' } };
  }
};

module.exports = NotificationsService;
