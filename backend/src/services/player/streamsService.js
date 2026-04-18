const { connectDB } = require('../../config/database');
const { requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const StreamsModel = getModel('streams');
const { ObjectId } = require('mongodb');
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
  const allow = new Set(['stream_platform_s', 'stream_type_s']);
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

function mapStreamToApi(stream) {
  return {
    _id: stream?._id ? stream._id.toString() : undefined,
    title: stream?.title,
    url: stream?.url,
    platform: stream?.platform,
    streamType: stream?.streamType || 'classical',
    matchLabel: stream?.matchLabel,
    description: stream?.description,
    result: stream?.result,
    isLive: stream?.isLive,
    featured: stream?.featured,
    createdByName: stream?.createdByName,
    updatedAt: stream?.updatedAt,
    createdAt: stream?.createdAt
  };
}

const StreamsService = {
  async getPlayerStreams(db, user, query = {}, { solrService } = {}) {
    requirePlayer(user);
    const database = await resolveDb(db);

    const q = safeTrim(query?.q || query?.search);
    const pageSize = Math.min(toPositiveInt(query?.pageSize ?? query?.limit, 50), 200);
    const page = toPositiveInt(query?.page, 1);
    const skip = (page - 1) * pageSize;

    const facets = normalizeFacets(query?.facets);

    if (isSolrEnabled()) {
      const solr = solrService || createSolrService();
      const role = String(user?.role || 'player').toLowerCase();

      const fq = [
        '(stream_is_live_b:true OR stream_featured_b:true)'
      ];

      const sort = q
        ? 'score desc, stream_featured_b desc, stream_updated_at_dt desc, stream_created_at_dt desc'
        : 'stream_featured_b desc, stream_updated_at_dt desc, stream_created_at_dt desc';

      const solrResult = await solr.search('streams', {
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
          .map((d) => parseMongoIdFromSolrId('streams', d?.id))
          .filter((idStr) => ObjectId.isValid(idStr));
        const objectIds = mongoIdStrings.map((idStr) => new ObjectId(idStr));

        const rows = objectIds.length
          ? await StreamsModel.findMany(database, { _id: { $in: objectIds } })
          : [];

        const ordered = sortByIdOrder(rows, objectIds);
        return {
          streams: ordered.map(mapStreamToApi),
          _meta: { engine: 'solr' }
        };
      }

      console.error('StreamsService.getPlayerStreams solr failed:', solrResult?.error || 'unknown');
    }

    const filter = { $or: [{ isLive: true }, { featured: true }] };
    if (q && q.length <= 80) {
      const re = new RegExp(escapeRegex(q), 'i');
      filter.$or = [
        { title: re },
        { description: re },
        { matchLabel: re }
      ];
    }

    const streams = await StreamsModel.findMany(
      database,
      filter,
      { sort: { featured: -1, updatedAt: -1, createdAt: -1 }, skip, limit: pageSize }
    );

    return { streams: (streams || []).map(mapStreamToApi), _meta: { engine: 'db' } };
  }
};

module.exports = StreamsService;
