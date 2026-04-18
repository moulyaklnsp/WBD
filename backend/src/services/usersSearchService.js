const { connectDB } = require('../config/database');
const UserModel = require('../models/UserModel');
const { createSolrService } = require('../solr/SolrService');
const { isSolrEnabled } = require('../solr/solrEnabled');

function safeTrim(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeRole(value) {
  const v = safeTrim(value).toLowerCase();
  if (['admin', 'organizer', 'coordinator', 'player'].includes(v)) return v;
  return '';
}

function toPositiveInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function normalizeFacets(value) {
  const raw = Array.isArray(value) ? value : (safeTrim(value) ? safeTrim(value).split(',') : []);
  const allow = new Set(['user_role_s', 'user_college_s']);
  return raw.map((v) => safeTrim(v)).filter((v) => allow.has(v));
}

function parseSort(value, { hasQuery } = {}) {
  const v = safeTrim(value).toLowerCase();
  if (!v) {
    if (hasQuery) return null; // let Solr default to score desc
    return 'user_name_s asc, user_email_s asc';
  }
  if (v === 'name' || v === 'name_asc') return 'user_name_s asc, user_email_s asc';
  if (v === 'name_desc') return 'user_name_s desc, user_email_s asc';
  if (v === 'email' || v === 'email_asc') return 'user_email_s asc';
  if (v === 'email_desc') return 'user_email_s desc';
  return null;
}

function parseMongoIdFromSolrId(entity, solrId) {
  const raw = safeTrim(solrId);
  const prefix = `${entity}:`;
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  return raw;
}

function mapSolrUserDocToApiUser(doc) {
  const id = parseMongoIdFromSolrId('users', doc?.id);
  const username =
    safeTrim(doc?.user_name_txt) ||
    safeTrim(doc?.user_username_s) ||
    safeTrim(doc?.user_email_s);
  return {
    id: id || null,
    username: username || null,
    email: safeTrim(doc?.user_email_s) || null,
    role: safeTrim(doc?.user_role_s) || null
  };
}

const UsersSearchService = {
  async getUsers(db, sessionUser, query = {}, { solrService } = {}) {
    const database = db || (await connectDB());

    const roleFilter = normalizeRole(query?.role);
    const q = safeTrim(query?.q || query?.search);

    const pageSize = Math.min(toPositiveInt(query?.pageSize ?? query?.limit, 200), 200);
    const page = toPositiveInt(query?.page, 1);
    const hasQuery = Boolean(q);
    const skip = (page - 1) * pageSize;

    const facets = normalizeFacets(query?.facets);
    const sort = parseSort(query?.sort, { hasQuery });

    const engineWanted = isSolrEnabled() ? 'solr' : 'db';

    if (engineWanted === 'solr') {
      const solr = solrService || createSolrService();
      const fq = [];
      if (roleFilter) fq.push(`user_role_s:${roleFilter}`);

      const roleForVisibility = normalizeRole(sessionUser?.role) || 'public';
      const solrResult = await solr.search('users', {
        q,
        role: roleForVisibility,
        page,
        pageSize,
        facets,
        sort,
        fq
      });

      if (solrResult?.success === true) {
        const users = (solrResult.docs || []).map(mapSolrUserDocToApiUser);
        const response = { users };
        if (facets.length) response.facetCounts = solrResult.facetCounts || {};
        response.totalResults = solrResult.total || users.length;
        response._meta = { engine: 'solr' };
        return response;
      }

      // Solr unavailable or error -> fallback to DB query (do not crash caller).
      console.error('UsersSearchService.getUsers solr failed:', solrResult?.error || 'unknown');
    }

    const filter = {};
    if (roleFilter) filter.role = roleFilter;
    if (q) filter.$text = { $search: q };

    const sortBy = (() => {
      const raw = safeTrim(query?.sort).toLowerCase();
      if (raw === 'email' || raw === 'email_asc') return { email: 1 };
      if (raw === 'email_desc') return { email: -1 };
      if (raw === 'name_desc') return { name: -1, email: 1 };
      if (raw === 'name' || raw === 'name_asc') return { name: 1, email: 1 };
      return null;
    })();

    const users = await UserModel.findMany(database, filter, {
      projection: q
        ? { password: 0, mfaSecret: 0, score: { $meta: 'textScore' } }
        : { password: 0, mfaSecret: 0 },
      sort: q
        ? { score: { $meta: 'textScore' }, ...(sortBy || {}) }
        : (sortBy || { name: 1, email: 1 }),
      skip,
      limit: pageSize
    });

    return {
      users: (users || []).map((u) => ({
        id: u?._id != null ? String(u._id) : null,
        username: u?.name || u?.username || u?.email,
        email: u?.email || null,
        role: u?.role || null
      })),
      _meta: { engine: 'db' }
    };
  }
};

module.exports = UsersSearchService;
