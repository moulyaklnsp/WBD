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

    // Prefer indexed fields (participants/sender/receiver) and avoid regex scans.
    // For legacy docs without participants, sender/receiver are still available for PM messages.
    const pipeline = [
      {
        $match: {
          $or: [
            { room: 'global' },
            { participants: username },
            { sender: username },
            { receiver: username }
          ]
        }
      },
      { $sort: { timestamp: -1 } },
      { $limit: 2000 },
      {
        $addFields: {
          contact: {
            $cond: [
              { $eq: ['$room', 'global'] },
              'All',
              { $cond: [{ $eq: ['$sender', username] }, '$receiver', '$sender'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$contact',
          lastMessage: { $first: '$message' },
          timestamp: { $first: '$timestamp' },
          room: { $first: '$room' }
        }
      },
      { $sort: { timestamp: -1 } },
      {
        $project: {
          _id: 0,
          contact: '$_id',
          lastMessage: 1,
          timestamp: 1,
          room: 1
        }
      }
    ];

    return db.collection('chat_messages').aggregate(pipeline).toArray();
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
