/**
 * LogsController – receives browser-side log entries and writes them
 * to the rotating frontend log stream.
 *
 * The frontendLogStream is injected via setStream() during app startup
 * so this controller stays decoupled from the logging infrastructure.
 */

let _frontendLogStream = null;

const LogsController = {
  /** Called once from app.js after the RFS stream is created. */
  setStream(stream) {
    _frontendLogStream = stream;
  },

  /** POST /api/logs/frontend */
  logFrontend(req, res) {
    try {
      const { level = 'info', message, context } = req.body || {};
      if (!message) {
        return res.status(400).json({ success: false, message: 'message is required' });
      }

      const allowed = ['info', 'warn', 'error', 'debug'];
      const safeLevel = allowed.includes(level) ? level : 'info';
      const timestamp = new Date().toISOString();
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '-';
      const line = JSON.stringify({ timestamp, level: safeLevel, ip, message, context }) + '\n';

      if (_frontendLogStream) {
        _frontendLogStream.write(line, (err) => {
          if (err) console.error('Frontend log write error:', err);
        });
      } else {
        // Fallback: mirror to server console if stream not yet initialised
        console.log('[frontend-log]', line.trim());
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('LogsController.logFrontend error:', err);
      return res.status(500).json({ success: false, message: 'Failed to write log' });
    }
  }
};

module.exports = LogsController;
