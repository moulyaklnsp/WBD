const crypto = require('crypto');
const cacheConfig = require('../config/cache');

function normalizeSegment(value) {
  if (value == null) return 'none';
  const raw = String(value).trim();
  if (!raw) return 'none';

  // Keep keys readable but safe: encode and cap length.
  const encoded = encodeURIComponent(raw);
  if (encoded.length <= 80) return encoded;

  const hash = crypto.createHash('sha1').update(encoded).digest('hex').slice(0, 10);
  return `${encoded.slice(0, 40)}~${hash}`;
}

function buildKey(...parts) {
  const prefix = cacheConfig.prefix;
  return [prefix, ...parts.map(normalizeSegment)].join(':');
}

const keys = {
  // Users
  usersSearch({ role = 'all', q = 'none', page = 1, pageSize = 200, sort = 'default', facets = 'none', engine = 'db' } = {}) {
    return buildKey('users', 'search', 'engine', engine, 'role', role, 'q', q, 'page', page, 'pageSize', pageSize, 'sort', sort, 'facets', facets);
  },

  // Tournaments
  tournamentsApproved() {
    return buildKey('tournaments', 'approved');
  },
  tournamentsAll() {
    return buildKey('tournaments', 'all');
  },
  tournamentsByCoordinator(email) {
    return buildKey('tournaments', 'coordinator', email || 'none');
  },

  // Blogs
  blogsPublished({ q = 'none', page = 1, pageSize = 0, sort = 'default', facets = 'none', engine = 'db' } = {}) {
    // Keep the old key for the legacy "no query params" call path.
    const hasQuery = Boolean((q && q !== 'none') || page !== 1 || (pageSize && pageSize !== 0) || (sort && sort !== 'default') || (facets && facets !== 'none') || (engine && engine !== 'db'));
    if (!hasQuery) return buildKey('blogs', 'published');
    return buildKey('blogs', 'published', 'engine', engine, 'q', q, 'page', page, 'pageSize', pageSize, 'sort', sort, 'facets', facets);
  },
  blogPublic(id) {
    return buildKey('blogs', 'public', id || 'none');
  },
  blogReviews(id) {
    return buildKey('blogs', id || 'none', 'reviews');
  },

  // Streams
  streamsPlayer({ q = 'none', page = 1, pageSize = 0, sort = 'default', facets = 'none', engine = 'db' } = {}) {
    const hasQuery = Boolean((q && q !== 'none') || page !== 1 || (pageSize && pageSize !== 0) || (sort && sort !== 'default') || (facets && facets !== 'none') || (engine && engine !== 'db'));
    if (!hasQuery) return buildKey('streams', 'player');
    return buildKey('streams', 'player', 'engine', engine, 'q', q, 'page', page, 'pageSize', pageSize, 'sort', sort, 'facets', facets);
  },

  // Player notifications / news
  announcementsPlayer({ q = 'none', page = 1, pageSize = 0, sort = 'default', facets = 'none', engine = 'db' } = {}) {
    const hasQuery = Boolean((q && q !== 'none') || page !== 1 || (pageSize && pageSize !== 0) || (sort && sort !== 'default') || (facets && facets !== 'none') || (engine && engine !== 'db'));
    if (!hasQuery) return buildKey('announcements', 'player');
    return buildKey('announcements', 'player', 'engine', engine, 'q', q, 'page', page, 'pageSize', pageSize, 'sort', sort, 'facets', facets);
  },
  newsPlayer() {
    return buildKey('news', 'player');
  },
  newsPlayerV2({ engine = 'db' } = {}) {
    if (!engine || engine === 'db') return buildKey('news', 'player');
    return buildKey('news', 'player', 'engine', engine);
  },

  // Store
  storeMostOrdered() {
    return buildKey('store', 'most_ordered');
  },
  storeSuggestionsByUser(email) {
    return buildKey('store', 'suggestions', 'user', email || 'none');
  },

  // Tags
  tag(tagName) {
    return buildKey('tag', tagName || 'none');
  }
};

module.exports = {
  buildKey,
  normalizeSegment,
  keys
};

