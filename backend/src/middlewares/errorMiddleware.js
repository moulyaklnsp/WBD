/**
 * errorMiddleware.js
 * ==================
 * Centralised 404 and error-handling middleware.
 *
 * Mount order in app.js (must be LAST, after all routes):
 *   app.use(notFound);
 *   app.use(errorHandler);
 */

const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

/** Resolve the React client base URL for redirects. */
function clientBase(req) {
  const isDev   = (process.env.NODE_ENV || 'development') !== 'production';
  const origin  = req.get('origin');
  return process.env.CLIENT_ORIGIN
    || (origin && ALLOWED_ORIGINS.includes(origin) ? origin : null)
    || (isDev ? 'http://localhost:3000' : '');
}

/** Determine whether the caller expects a JSON response. */
function wantsJson(req) {
  return (req.path && req.path.startsWith('/api'))
    || req.xhr
    || !!(req.accepts && req.accepts('json'));
}

// ─────────────────────────────────────────────────────────────────────────────
// 404 – No route matched
// ─────────────────────────────────────────────────────────────────────────────

/**
 * notFound middleware – called when no route handler matched.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
function notFound(req, res) {
  if (wantsJson(req)) {
    return res.status(404).json({ success: false, message: 'Not Found' });
  }
  if (req.path === '/error') return res.status(404).send('Not Found');

  const base = clientBase(req);
  const qs   = 'title=Not%20Found&message=The%20page%20you%20requested%20does%20not%20exist.&code=404';
  return res.status(404).redirect(`${base}/error?${qs}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Global error handler – called via next(err)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * errorHandler middleware – four-argument signature required by Express.
 * @param {Error}                      err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);

  const status  = err?.status || err?.statusCode || 500;
  const message = err?.message || 'Internal Server Error';

  if (wantsJson(req)) {
    return res.status(status).json({ success: false, message });
  }

  const base = clientBase(req);
  return res.status(status).redirect(
    `${base}/error?title=${encodeURIComponent('Error')}&message=${encodeURIComponent(message)}&code=${encodeURIComponent(String(status))}`
  );
}

module.exports = { notFound, errorHandler };
