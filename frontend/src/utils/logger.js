/**
 * ChessHive Frontend Logger
 * =========================
 * Sends browser-side logs to the backend, which writes them to
 * frontend/logs/frontend.log via rotating-file-stream.
 *
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.info('User logged in', { userId: '123' });
 *   logger.warn('Slow network detected');
 *   logger.error('API call failed', { endpoint: '/api/session', status: 500 });
 */

const LOG_ENDPOINT = '/api/logs/frontend';
const LEVELS = ['debug', 'info', 'warn', 'error'];
const MIN_LEVEL = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

function shouldLog(level) {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(MIN_LEVEL);
}

function send(level, message, context) {
  if (!shouldLog(level)) return;

  // Always mirror to the browser console
  const consoleFn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : level === 'debug' ? console.debug
    : console.info;
  consoleFn(`[${level.toUpperCase()}]`, message, context || '');

  // Send to backend asynchronously (fire-and-forget)
  fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message, context }),
    keepalive: true   // survives page unload (useful for error logs)
  }).catch(() => { /* silently ignore network failures in the logger itself */ });
}

const logger = {
  debug: (message, context) => send('debug', message, context),
  info:  (message, context) => send('info',  message, context),
  warn:  (message, context) => send('warn',  message, context),
  error: (message, context) => send('error', message, context),
};

// ── Optional: auto-capture uncaught errors & promise rejections ──
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logger.error(event.message || 'Uncaught error', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: event.reason?.message || String(event.reason),
      stack: event.reason?.stack
    });
  });
}

export default logger;
