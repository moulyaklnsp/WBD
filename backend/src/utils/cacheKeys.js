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
  usersSearch({ role = 'all', q = 'none' } = {}) {
    return buildKey('users', 'search', 'role', role, 'q', q);
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
  blogsPublished() {
    return buildKey('blogs', 'published');
  },
  blogPublic(id) {
    return buildKey('blogs', 'public', id || 'none');
  },
  blogReviews(id) {
    return buildKey('blogs', id || 'none', 'reviews');
  },

  // Streams
  streamsPlayer() {
    return buildKey('streams', 'player');
  },

  // Player notifications / news
  announcementsPlayer() {
    return buildKey('announcements', 'player');
  },
  newsPlayer() {
    return buildKey('news', 'player');
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

