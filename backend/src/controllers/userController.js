/**
 * UserController - handles generic user endpoints (cross-role).
 */
const { connectDB } = require('../config/database');
const UserModel = require('../models/UserModel');
const Cache = require('../utils/cache');

const UserController = {
  /** GET /api/users?role=<role>&search=<query> */
  async getUsers(req, res) {
    try {
      const role = (req.query.role || '').toString().toLowerCase();
      const search = (req.query.search || '').toString();
      
      const filter = {};
      if (role) filter.role = role;
      
      // Text Search Optimization
      if (search) {
        filter.$text = { $search: search }; 
      }

      const cacheKey = Cache.keys.usersSearch({
        role: role || 'all',
        q: (search || 'none').toLowerCase()
      });

      const { value: list, meta } = await Cache.cacheAsideJson({
        key: cacheKey,
        ttlSeconds: Cache.config.ttl.defaultSeconds,
        tags: ['users'],
        res,
        label: 'GET /api/users',
        fetcher: async () => {
          const db = await connectDB();
          const users = await UserModel.findMany(db, filter, {
            projection: search ? { password: 0, mfaSecret: 0, score: { $meta: "textScore" } } : { password: 0, mfaSecret: 0 },
            sort: search ? { score: { $meta: "textScore" } } : { name: 1, email: 1 },
            limit: 200
          });

          return (users || []).map(u => ({
            id: u._id,
            username: u.name || u.username || u.email,
            email: u.email || null,
            role: u.role
          }));
        }
      });

      return res.json({ success: true, cached: meta.hit === true, users: list || [] });
    } catch (err) {
      console.error('UserController.getUsers error:', err);
      return res.status(500).json({ success: false, message: 'Unexpected server error' });
    }
  }
};

module.exports = UserController;
