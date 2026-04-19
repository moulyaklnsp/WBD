export function getBackendBase() {
  const raw =
    (process.env.REACT_APP_API_URL || '').toString().trim() ||
    (process.env.REACT_APP_API_BASE_URL || '').toString().trim();

  return raw.replace(/\/+$/, '');
}

