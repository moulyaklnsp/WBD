import { getBackendBase } from './backendBase';

const API_PREFIXES = [
  '/api',
  '/admin',
  '/organizer',
  '/coordinator',
  '/player',
  '/socket.io',
  '/set-password',
  '/slips'
];

function shouldPrefix(urlPathname) {
  return API_PREFIXES.some((prefix) => urlPathname === prefix || urlPathname.startsWith(`${prefix}/`));
}

/**
 * Prefix backend calls with `REACT_APP_API_URL` at runtime.
 *
 * - Dev: leave `REACT_APP_API_URL` unset; CRA proxy handles `/api/*`.
 * - Prod: set `REACT_APP_API_URL=https://<your-railway-backend>` so `/api/*` goes to Railway.
 */
export function installBackendFetchProxy() {
  if (typeof window === 'undefined') return;

  const base = getBackendBase();
  if (!base) return;

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!originalFetch) return;

  if (window.__chesshiveBackendFetchProxyInstalled) return;
  window.__chesshiveBackendFetchProxyInstalled = true;

  window.fetch = (input, init) => {
    try {
      if (typeof input === 'string' && input.startsWith('/') && shouldPrefix(input)) {
        return originalFetch(`${base}${input}`, init);
      }
    } catch (_) {
      // Fall back to original fetch below.
    }
    return originalFetch(input, init);
  };
}

