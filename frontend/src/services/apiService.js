/**
 * API Service – Centralized API Layer
 * =====================================
 * Clean facade over fetchWithRole utilities.
 * Provides structured, role-aware API access with built-in
 * caching, retries, JWT handling, and multi-tab safety.
 *
 * Usage:
 *   import api from '../services/apiService';
 *   const res = await api.player.get('/api/player/profile');
 *   const data = await api.post('/api/auth/login', { email, otp });
 */

import {
  fetchAsAdmin,
  fetchAsOrganizer,
  fetchAsCoordinator,
  fetchAsPlayer,
  fetchAndMerge,
  loadWithoutOverwrite,
  safePost,
  safePut,
  safePatch,
  clearRequestCache,
} from '../utils/fetchWithRole';

// ─── Generic helpers (no role header) ────────────────────────────
const get  = (url, opts) => fetchAsPlayer(url, opts); // default fetch
const post = (url, data, opts) => safePost(url, data, opts);
const put  = (url, data, opts) => safePut(url, data, opts);
const patch = (url, data, opts) => safePatch(url, data, opts);

// ─── Role-scoped namespaces ──────────────────────────────────────
const admin = {
  get: (url, opts) => fetchAsAdmin(url, opts),
  post,
  put,
  patch,
};

const organizer = {
  get: (url, opts) => fetchAsOrganizer(url, opts),
  post,
  put,
  patch,
};

const coordinator = {
  get: (url, opts) => fetchAsCoordinator(url, opts),
  post,
  put,
  patch,
};

const player = {
  get: (url, opts) => fetchAsPlayer(url, opts),
  post,
  put,
  patch,
};

// ─── Public API ──────────────────────────────────────────────────
const api = {
  get,
  post,
  put,
  patch,
  admin,
  organizer,
  coordinator,
  player,
  fetchAndMerge,
  loadWithoutOverwrite,
  clearCache: clearRequestCache,
};

export default api;
