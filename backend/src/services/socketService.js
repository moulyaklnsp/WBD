/**
 * Socket.IO handler for real-time chat and chess events.
 */
const { connectDB } = require('../config/database');

// In-memory maps for online user tracking
const onlineUsers = new Map();       // socket.id -> { username, role }
const usernameToSockets = new Map(); // username -> Set(socket.id)

function broadcastUsers(io) {
  const unique = Array.from(
    new Map(
      Array.from(onlineUsers.values()).map(u => [u.username, u])
    ).values()
  );
  io.emit('updateUsers', unique);
}

function privateRoomName(u1, u2) {
  return `pm:${[u1, u2].sort().join(':')}`;
}

/**
 * Initialize Socket.IO event handlers.
 * @param {import('socket.io').Server} io - The Socket.IO server instance.
 */
let ioInstance = null;

function initSocketHandlers(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    socket.on('join', ({ username, role }) => {
      if (!username) return;
      onlineUsers.set(socket.id, { username, role });
      if (role === 'organizer') {
        socket.join('organizer_room');
      }
      const set = usernameToSockets.get(username) || new Set();
      set.add(socket.id);
      usernameToSockets.set(username, set);
      broadcastUsers(io);
    });

    socket.on('join_signup', ({ email }) => {
      if (!email) return;
      socket.join(`signup_${email}`);
    });

    socket.on('disconnect', () => {
      const info = onlineUsers.get(socket.id);
      if (info && info.username) {
        const set = usernameToSockets.get(info.username);
        if (set) {
          set.delete(socket.id);
          if (set.size === 0) usernameToSockets.delete(info.username);
          else usernameToSockets.set(info.username, set);
        }
      }
      onlineUsers.delete(socket.id);
      broadcastUsers(io);
    });

    // Chat messaging
    socket.on('chatMessage', async ({ sender, receiver, message }) => {
      const socketInfo = onlineUsers.get(socket.id) || {};
      const actualSender = socketInfo.username || sender;
      if (!actualSender || !message) return;
      const payload = { sender: actualSender, message, receiver: receiver || 'All' };
      const db = await connectDB();
      try {
        if (!receiver || receiver === 'All') {
          io.emit('message', payload);
          await db.collection('chat_messages').insertOne({
            room: 'global',
            sender: actualSender,
            message,
            participants: [],
            timestamp: new Date()
          });
        } else {
          const room = privateRoomName(actualSender, receiver);
          const senderSet = usernameToSockets.get(actualSender) || new Set();
          const receiverSet = usernameToSockets.get(receiver) || new Set();
          const allIds = new Set([...senderSet, ...receiverSet]);
          for (const id of allIds) {
            const s = io.sockets.sockets.get
              ? io.sockets.sockets.get(id)
              : io.sockets.sockets[id];
            if (s && s.emit) s.emit('message', payload);
          }
          await db.collection('chat_messages').insertOne({
            room,
            sender: actualSender,
            receiver,
            message,
            participants: [actualSender, receiver].filter(Boolean).sort(),
            timestamp: new Date()
          });
        }
      } catch (e) {
        console.error('chatMessage error:', e);
      }
    });

    // Chess events
    socket.on('chessJoin', ({ room }) => {
      if (!room) return;
      socket.join(room);
    });

    socket.on('chessMove', async ({ room, move }) => {
      if (!room || !move) return;
      socket.to(room).emit('chessMove', move);
      try {
        const db = await connectDB();
        await db.collection('games').updateOne(
          { room },
          {
            $push: { moves: { ...move, timestamp: new Date() } },
            $set: { fen: move.fen, updatedAt: new Date() }
          },
          { upsert: true }
        );
      } catch (e) {
        console.error('chessMove persist error:', e);
      }
    });
  });
}

module.exports = { initSocketHandlers, getIO: () => ioInstance };
