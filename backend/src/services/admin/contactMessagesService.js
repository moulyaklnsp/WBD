const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { createSolrService } = require('../../solr/SolrService');
const { isSolrEnabled } = require('../../solr/solrEnabled');

const CONTACT_STATUSES = ['pending', 'open', 'resolved'];

function safeTrim(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeStatus(value) {
  let v = safeTrim(value).toLowerCase();
  if (v === 'new') v = 'pending';
  return CONTACT_STATUSES.includes(v) ? v : '';
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function normalizeFacets(value) {
  const raw = Array.isArray(value) ? value : (safeTrim(value) ? safeTrim(value).split(',') : []);
  const allow = new Set(['contact_status_s']);
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

const ContactMessagesService = {
  async list(db, session, query = {}, { solrService } = {}) {
    const database = db || (await connectDB());

    const status = normalizeStatus(query?.status);
    const q = safeTrim(query?.q || query?.search);

    const pageSize = Math.min(toPositiveInt(query?.pageSize ?? query?.limit, 200), 200);
    const page = toPositiveInt(query?.page, 1);
    const skip = (page - 1) * pageSize;

    const facets = normalizeFacets(query?.facets);

    if (isSolrEnabled()) {
      const solr = solrService || createSolrService();
      const fq = [];
      if (status) fq.push(`contact_status_s:${status}`);

      const sort = q ? 'score desc, contact_submission_date_dt desc' : 'contact_submission_date_dt desc';
      const solrResult = await solr.search('contact', {
        q,
        role: 'admin',
        page,
        pageSize,
        facets,
        sort,
        fq
      });

      if (solrResult?.success === true) {
        const mongoIdStrings = (solrResult.docs || [])
          .map((d) => parseMongoIdFromSolrId('contact', d?.id))
          .filter((idStr) => ObjectId.isValid(idStr));
        const objectIds = mongoIdStrings.map((idStr) => new ObjectId(idStr));

        const messages = objectIds.length
          ? await database.collection('contact').find({ _id: { $in: objectIds } }).toArray()
          : [];

        const sorted = sortByIdOrder(messages, objectIds);
        const response = { messages: sorted, _meta: { engine: 'solr' } };
        if (facets.length) response.facetCounts = solrResult.facetCounts || {};
        response.totalResults = solrResult.total || sorted.length;
        return response;
      }

      console.error('ContactMessagesService.list solr failed:', solrResult?.error || 'unknown');
    }

    // DB fallback (existing behavior)
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.$text = { $search: q };

    const cursor = database.collection('contact').find(filter);
    if (q) {
      cursor.project({ score: { $meta: 'textScore' } });
      cursor.sort({ score: { $meta: 'textScore' }, submission_date: -1 });
    } else {
      cursor.sort({ submission_date: -1 });
    }

    const messages = await cursor.skip(skip).limit(pageSize).toArray();
    return { messages, _meta: { engine: 'db' } };
  }
};

module.exports = { ContactMessagesService, CONTACT_STATUSES };

