/**
 * UserController - handles generic user endpoints (cross-role).
 */
const { connectDB } = require('../config/database');
const Cache = require('../utils/cache');
const UsersSearchService = require('../services/usersSearchService');
const { isSolrEnabled } = require('../solr/solrEnabled');

const UserController = {
  /** GET /api/users?role=<role>&search=<query> */
  async getUsers(req, res) {
    try {
      const role = (req.query.role || '').toString().toLowerCase();
      const q = (req.query.q || req.query.search || '').toString();
      const sort = (req.query.sort || '').toString();
      const page = req.query.page != null ? parseInt(String(req.query.page), 10) : 1;
      const pageSize = req.query.pageSize != null ? parseInt(String(req.query.pageSize), 10) : 200;
      const facets = req.query.facets || '';

      const sessionUser = req.session?.userEmail
        ? { email: req.session.userEmail, role: req.session.userRole }
        : null;

      const engine = isSolrEnabled() ? 'solr' : 'db';
      const cacheKey = Cache.keys.usersSearch({
        role: role || 'all',
        q: (q || 'none').toLowerCase(),
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 200,
        sort: (sort || 'default').toLowerCase(),
        facets: typeof facets === 'string' ? facets : 'multi',
        engine
      });

      const { value, meta } = await Cache.cacheAsideJson({
        key: cacheKey,
        ttlSeconds: Cache.config.ttl.defaultSeconds,
        tags: ['users'],
        res,
        label: 'GET /api/users',
        fetcher: async () => {
          const db = await connectDB();
          return UsersSearchService.getUsers(db, sessionUser, { role, q, search: q, sort, page, pageSize, facets });
        },
        cacheWhen: (result) => String(result?._meta?.engine || 'db') === engine
      });

      const users = value?.users || [];
      const payload = { success: true, cached: meta.hit === true, users };
      if (value?.facetCounts) payload.facetCounts = value.facetCounts;
      if (value?.totalResults != null) payload.totalResults = value.totalResults;
      return res.json(payload);
    } catch (err) {
      console.error('UserController.getUsers error:', err);
      return res.status(500).json({ success: false, message: 'Unexpected server error' });
    }
  }
};

module.exports = UserController;
