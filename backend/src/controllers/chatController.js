/**
 * ChatController – handles HTTP requests for chat endpoints.
 * Delegates business logic to ChatService.
 */
const { connectDB } = require('../config/database');
const ChatService = require('../services/chatService');

let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

const ChatController = {
  /** GET /api/chat/history?room=global */
  async getHistory(req, res) {
    try {
      const room = (req.query.room || 'global').toString();
      const db = await connectDB();
      const history = await ChatService.getHistory(db, room);
      return res.json({ success: true, history });
    } catch (err) {
      console.error('ChatController.getHistory error:', err);
      return res.status(500).json({ success: false, message: 'Unexpected server error' });
    }
  },

  /** GET /api/chat/contacts?username=<name> */
  async getContacts(req, res) {
    try {
      const username = (req.query.username || '').toString();
      const db = await connectDB();
      const contacts = await ChatService.getContacts(db, username);
      return res.json({ success: true, contacts });
    } catch (err) {
      console.error('ChatController.getContacts error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Unexpected server error' });
    }
  },

  /** POST /api/chat/upload  (multipart form-data, field: media) */
  uploadImage(req, res) {
    if (!multer) {
      return res.status(500).json({ success: false, message: 'Upload support not available' });
    }

    const uploader = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_r, file, cb) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
          .includes((file.mimetype || '').toLowerCase());
        if (!ok) return cb(new Error('Only image files are allowed'));
        cb(null, true);
      }
    }).single('media');

    uploader(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

      try {
        const url = await ChatService.uploadImage(req.file.buffer);
        return res.json({ success: true, url });
      } catch (e) {
        console.error('ChatController.uploadImage error:', e);
        return res.status(e.statusCode || 500).json({ success: false, message: e.message || 'Upload failed' });
      }
    });
  }
};

module.exports = ChatController;
