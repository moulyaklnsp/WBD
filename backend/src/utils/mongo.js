const { ObjectId } = require('mongodb');

function normalizeKey(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().toLowerCase();
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof ObjectId) return value;
  const str = String(value);
  if (!ObjectId.isValid(str)) return null;
  try {
    return new ObjectId(str);
  } catch (e) {
    return null;
  }
}

function requireObjectId(value, message = 'Invalid id') {
  const oid = toObjectId(value);
  if (!oid) throw Object.assign(new Error(message), { statusCode: 400 });
  return oid;
}

function parsePagination(query, options = {}) {
  const {
    defaultLimit = 50,
    maxLimit = 200,
    defaultSkip = 0
  } = options || {};

  const limitRaw = query?.limit ?? query?.pageSize ?? query?.perPage;
  const skipRaw = query?.skip;
  const pageRaw = query?.page;

  let limit = Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = defaultLimit;
  limit = Math.min(Math.max(1, limit), maxLimit);

  let skip = Number.parseInt(skipRaw, 10);
  if (!Number.isFinite(skip) || skip < 0) skip = defaultSkip;

  const page = Number.parseInt(pageRaw, 10);
  if (Number.isFinite(page) && page > 0) {
    skip = (page - 1) * limit;
  }

  return { limit, skip };
}

function parseSort(query, allowedFields, defaultSort) {
  const sortBy = query?.sortBy || query?.sort || query?.orderBy;
  const orderRaw = query?.order || query?.direction;
  const direction = String(orderRaw || 'desc').toLowerCase() === 'asc' ? 1 : -1;

  if (!sortBy) return defaultSort || null;
  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    return { [sortBy]: direction };
  }
  if (!allowedFields.includes(sortBy)) return defaultSort || null;
  return { [sortBy]: direction };
}

function buildIdentityKeys(user, extra = []) {
  const keys = new Set();
  const add = (v) => {
    const key = normalizeKey(v);
    if (key) keys.add(key);
  };
  add(user?.email);
  add(user?.username);
  add(user?.name);
  (Array.isArray(extra) ? extra : []).forEach(add);
  return Array.from(keys);
}

module.exports = {
  normalizeKey,
  toObjectId,
  requireObjectId,
  parsePagination,
  parseSort,
  buildIdentityKeys
};
