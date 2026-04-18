/**
 * ChatService – business logic for chat operations.
 * Extracted from inline handlers in app.js.
 */
const { uploadImageBuffer } = require('../utils/cloudinary');

const ChatService = {
  /**
   * Fetch the last 50 messages for a given room.
   */
  async getHistory(db, room = 'global') {
    return db.collection('chat_messages')
      .find({ room })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
  },

  /**
   * Build a contacts summary for a given username.
   * Returns recent contacts with last message info.
   */
  async getContacts(db, username) {
    if (!username) throw Object.assign(new Error('username required'), { statusCode: 400 });

    const recent = await db.collection('chat_messages').find({
      $or: [
        { room: 'global' },
        { room: { $regex: '^pm:' } }
      ],
      $or: [
        { sender: username },
        { receiver: username },
        { room: { $regex: username } }
      ]
    }).sort({ timestamp: -1 }).limit(500).toArray();

    const contactsMap = new Map();
    for (const m of recent) {
      if (m.room === 'global') {
        if (!contactsMap.has('All')) {
          contactsMap.set('All', { contact: 'All', lastMessage: m.message, timestamp: m.timestamp, room: 'global' });
        }
        continue;
      }
      const parts = (m.room || '').replace(/^pm:/, '').split(':');
      const other = parts.find(p => p !== username) || parts[0] || 'Unknown';
      if (!contactsMap.has(other)) {
        contactsMap.set(other, { contact: other, lastMessage: m.message, timestamp: m.timestamp, room: m.room });
      }
    }

    return Array.from(contactsMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  /**
   * Upload a chat image buffer to Cloudinary.
   * Returns the secure_url.
   */
  async uploadImage(fileBuffer) {
    const result = await uploadImageBuffer(fileBuffer, {
      folder: 'chesshive/chat-media',
      resource_type: 'image'
    });
    if (!result?.secure_url) throw Object.assign(new Error('Upload to cloud failed'), { statusCode: 500 });
    return result.secure_url;
  }
};

module.exports = ChatService;
