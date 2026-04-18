const PLAYER_ORDER_STATUSES = ['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'];
const { getModel } = require('../../models');
const UserModel = getModel('users');

const createAuthError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const requireCoordinator = (user) => {
  if (!user?.email) throw createAuthError('Unauthorized', 401);
  if (!user?.role) throw createAuthError('Forbidden', 403);
  if (user.role !== 'coordinator') throw createAuthError('Forbidden', 403);
};

const safeTrim = (value) => (value == null ? '' : String(value)).trim();

const normalizePlatform = (value) => {
  const v = safeTrim(value).toLowerCase();
  if (!v) return 'other';
  if (['youtube', 'twitch', 'lichess', 'chesscom', 'chess.com'].includes(v)) {
    return v === 'chess.com' ? 'chesscom' : v;
  }
  return 'other';
};

const normalizeStreamType = (value) => {
  const v = safeTrim(value).toLowerCase();
  if (v === 'classical' || v === 'rapid' || v === 'blitz') return v;
  return '';
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeOrderStatus = (value) => {
  const raw = safeTrim(value).toLowerCase();
  if (!raw || raw === 'confirmed') return 'pending';
  return PLAYER_ORDER_STATUSES.includes(raw) ? raw : 'pending';
};

const getAllowedOrderStatusTransitions = (currentStatus) => {
  switch (currentStatus) {
    case 'pending':
      return ['processing', 'packed', 'shipped', 'delivered', 'cancelled'];
    case 'processing':
      return ['packed', 'shipped', 'delivered', 'cancelled'];
    case 'packed':
      return ['shipped', 'delivered', 'cancelled'];
    case 'shipped':
      return ['delivered'];
    default:
      return [];
  }
};

const parseDateValue = (value) => {
  const raw = safeTrim(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map((n) => Number.parseInt(n, 10));
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toStartOfDay = (value) => {
  const d = parseDateValue(value);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const isPastDate = (value) => {
  const candidate = toStartOfDay(value);
  if (!candidate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return candidate < today;
};

const isAtLeastDaysFromToday = (value, days) => {
  const candidate = toStartOfDay(value);
  if (!candidate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() + Number(days || 0));
  return candidate >= minDate;
};

const isAllowedMeetingLink = (raw) => {
  try {
    const parsed = new URL(String(raw || '').trim());
    const host = parsed.hostname.toLowerCase();
    const isGoogleMeet = host === 'meet.google.com';
    const isZoom = host === 'zoom.us' || host.endsWith('.zoom.us');
    return parsed.protocol === 'https:' && (isGoogleMeet || isZoom);
  } catch {
    return false;
  }
};

const getCoordinatorOwnerCandidates = async (db, user) => {
  const email = user?.email;
  const username = user?.username;
  const dbUser = email ? await UserModel.findOne(db, {
    email,
    role: 'coordinator'
  }) : null;

  return [email, username, dbUser?.email, dbUser?.name]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
};

const getCoordinatorOwnerIdentifiers = async (db, user) => {
  const email = user?.email;
  const username = user?.username;
  const dbUser = email ? await UserModel.findOne(db, {
    email,
    role: 'coordinator'
  }) : null;

  const raw = [email, username, dbUser?.email, dbUser?.name]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean);

  const lowered = raw.map((v) => v.toLowerCase());
  return Array.from(new Set([...raw, ...lowered]));
};

module.exports = {
  PLAYER_ORDER_STATUSES,
  requireCoordinator,
  safeTrim,
  normalizePlatform,
  normalizeStreamType,
  escapeRegExp,
  normalizeOrderStatus,
  getAllowedOrderStatusTransitions,
  parseDateValue,
  toStartOfDay,
  isPastDate,
  isAtLeastDaysFromToday,
  isAllowedMeetingLink,
  getCoordinatorOwnerCandidates,
  getCoordinatorOwnerIdentifiers
};
