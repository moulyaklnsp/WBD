export function getSocketServerUrl() {
  if (typeof window === 'undefined') return '';

  const explicit = (process.env.REACT_APP_SOCKET_URL || '').toString().trim();
  if (explicit) return explicit;

  const { protocol, hostname, port } = window.location;

  // Use same-origin (works with CRA proxy in dev and direct backend in prod).
  const origin = window.location.origin;
  return origin || `${protocol}//${hostname}${port ? `:${port}` : ''}`;
}

export function createSocket(ioOptions = {}) {
  if (typeof window === 'undefined') return null;
  if (!window.io) return null;

  const url = getSocketServerUrl();
  try {
    return window.io(url, { withCredentials: true, ...ioOptions });
  } catch (_) {
    return null;
  }
}

export function getOrCreateSharedSocket(globalKey = '__chesshiveLiveSocket', ioOptions = {}) {
  if (typeof window === 'undefined') return null;
  if (window[globalKey]) return window[globalKey];

  const sock = createSocket(ioOptions);
  if (!sock) return null;

  window[globalKey] = sock;
  return sock;
}
