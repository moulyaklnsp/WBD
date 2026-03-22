const express = require('express');
const path = require('path');
const session = require('express-session');
const methodOverride = require('method-override');
const http = require('http');
const { Server } = require('socket.io');
// nodemailer is optional. If not installed or SMTP not configured, magic link will be logged to console.
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }
require('dotenv').config();
const { connectDB } = require('./routes/databasecongi');

const adminRouter = require('./admin_app');
const organizerRouter = require('./organizer_app');
const coordinatorRouter = require('./coordinator_app');
const playerRouter = require('./player_app');

const utils = require('./utils');
const { ObjectId } = require('mongodb');

const app = express();
const cors = require('cors');
// Allow CORS from common React dev ports (proxy or direct)
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
// Increase maxHeaderSize to accept larger request headers (fixes 431 errors)
// Default Node limit can be too small when many/large cookies or headers are present.
// Raise to 1MB to tolerate larger Cookie headers from development environments.
const server = http.createServer({ maxHeaderSize: 1048576 }, app);
const io = new Server(server, { cors: { origin: ['http://localhost:3000', 'http://localhost:3001'], methods: ['GET', 'POST'] } });
const PORT = process.env.PORT || 3001;

app.use(session({
  name: process.env.SESSION_COOKIE_NAME || 'sid',
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  rolling: false,
  cookie: { secure: false, sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// mount optional auth router
try { const authrouter = require('./routes/auth'); app.use(authrouter); } catch (e) { /* optional */ }

// Role middleware
const isAdmin = (req, res, next) => { if (req.session.userRole === 'admin') next(); else res.status(403).send('Unauthorized'); };
const isOrganizer = (req, res, next) => { if (req.session.userRole === 'organizer') next(); else res.status(403).send('Unauthorized'); };
const isCoordinator = (req, res, next) => {
  if (req.session.userRole === 'coordinator') return next();
  // Dev convenience: allow header override to unblock local React without breaking production
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const headerRole = (req.get('x-dev-role') || '').toLowerCase();
  const headerEmail = req.get('x-dev-email');
  if (isDev && headerRole === 'coordinator' && headerEmail) {
    req.session.userRole = 'coordinator';
    req.session.userEmail = headerEmail;
    // username is optional but helps downstream queries
    req.session.username = req.session.username || headerEmail;
    return next();
  }
  return res.status(403).send('Unauthorized');
};
const isPlayer = (req, res, next) => {
  // Dev mode: allow override with headers (helps local React dev)
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const headerRole = (req.get('x-dev-role') || '').toLowerCase();
  const headerEmail = req.get('x-dev-email');
  const headerUsername = req.get('x-dev-username');
  if (isDev && headerRole === 'player' && headerEmail) {
    req.session.userRole = 'player';
    req.session.userEmail = headerEmail;
    req.session.username = headerUsername || headerEmail.split('@')[0];
    console.log('DEV: isPlayer bypass enabled for', req.session.userEmail);
  }
  if (req.session.userRole === 'player') next(); else res.status(403).send('Unauthorized');
};
const isAdminOrOrganizer = (req, res, next) => { if (req.session.userRole === 'admin' || req.session.userRole === 'organizer') next(); else res.status(403).json({ success: false, message: 'Unauthorized' }); };

// Mount routers
app.use('/admin', isAdmin, adminRouter);
app.use('/organizer', isOrganizer, organizerRouter);
app.use('/coordinator', isCoordinator, coordinatorRouter);
app.use('/player', isPlayer, playerRouter.router);

// Serve index
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Login with OTP
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email, password });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid credentials' });
    if (user.isDeleted) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deleted',
        restoreRequired: true,
        deletedUserId: user._id.toString(),
        deletedUserRole: user.role || null
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database
    await db.collection('otps').insertOne({
      email,
      otp,
      type: 'login',
      expires_at: expiresAt,
      used: false
    });

    // Send OTP via email
    async function sendOtpEmail(to, otp) {
      if (!nodemailer) {
        console.log(`nodemailer not installed. OTP for ${to}: ${otp}`);
        return { previewUrl: null, messageId: null, info: null };
      }

      // If no SMTP configured, use Ethereal test account for local testing
      if (!process.env.SMTP_HOST) {
        try {
          const testAccount = await nodemailer.createTestAccount();
          const transporter = nodemailer.createTransport({ host: testAccount.smtp.host, port: testAccount.smtp.port, secure: testAccount.smtp.secure, auth: { user: testAccount.user, pass: testAccount.pass } });
          const info = await transporter.sendMail({ from: process.env.SMTP_FROM || '', to, subject: 'Your ChessHive OTP', text: `Your OTP is: ${otp}. It expires in 5 minutes.` });
          const previewUrl = nodemailer.getTestMessageUrl(info);
          console.log(`Ethereal OTP preview for ${to}: ${previewUrl}`);
          return { previewUrl, messageId: info && info.messageId, info };
        } catch (err) {
          console.error('Failed to send via Ethereal, falling back to console:', err);
          console.log(`OTP for ${to}: ${otp}`);
          return { previewUrl: null, messageId: null, info: null };
        }
      }

      // SMTP configured path
      try {
        const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587', 10), secure: (process.env.SMTP_SECURE === 'true'), auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
        // attempt to verify transporter (helps surfacing auth/connectivity issues early)
        try {
          await transporter.verify();
          console.log('SMTP transporter verified');
        } catch (verErr) {
          console.warn('SMTP transporter verification failed:', verErr);
        }
        const info = await transporter.sendMail({ from: process.env.SMTP_FROM || '', to, subject: 'Your ChessHive OTP', text: `Your OTP is: ${otp}. It expires in 5 minutes.` });
        console.log('OTP email sent:', info && info.messageId, 'envelope:', info && info.envelope);
        return { previewUrl: null, messageId: info && info.messageId, info };
      } catch (err) {
        console.error('Failed to send OTP email, falling back to console:', err);
        console.log(`OTP for ${to}: ${otp}`);
        return { previewUrl: null, messageId: null, info: null };
      }
    }

    // Send OTP
    let preview = null;
    let messageId = null;
    try {
      const result = await sendOtpEmail(user.email, otp);
      if (result) {
        if (result.previewUrl) preview = result.previewUrl;
        if (result.messageId) messageId = result.messageId;
      }
    } catch (e) {
      console.error('sendOtpEmail error:', e);
    }

    // Tell frontend that OTP was sent
    const responsePayload = { success: true, message: 'OTP sent to registered email' };
    if (preview) responsePayload.previewUrl = preview;
    if (messageId) responsePayload.messageId = messageId;
    return res.json(responsePayload);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'An unexpected error occurred' });
  }
});

// Restore deleted account
app.post('/api/restore-account', async (req, res) => {
  try {
    const { id, email, password } = req.body || {};
    if (!id || !email || !password) {
      return res.status(400).json({ success: false, message: 'id, email and password are required' });
    }
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const db = await connectDB();
    const user = await db.collection('users').findOne({ _id: new ObjectId(id), email, password });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found or invalid credentials' });
    }
    if (!user.isDeleted) {
      return res.status(400).json({ success: false, message: 'Account is already active' });
    }
    const upd = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: { isDeleted: 0, restored_date: new Date(), restored_by: email }, $unset: { deleted_date: '', deleted_by: '' } }
    );
    if (upd.modifiedCount === 0) {
      return res.status(500).json({ success: false, message: 'Failed to restore account' });
    }
    return res.json({ success: true, message: 'Account restored successfully. Please login again to continue.' });
  } catch (err) {
    console.error('Restore account error:', err);
    return res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
});

// Verify login OTP
app.post('/api/verify-login-otp', async (req, res) => {
  const { email, otp } = req.body || {};
  try {
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

    const db = await connectDB();
    const otpRecord = await db.collection('otps').findOne({ email, otp, type: 'login', used: false });
    if (!otpRecord) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (new Date() > otpRecord.expires_at) return res.status(400).json({ success: false, message: 'OTP expired' });

    // Mark OTP as used
    await db.collection('otps').updateOne({ _id: otpRecord._id }, { $set: { used: true } });

    // Fetch user and establish session
    const user = await db.collection('users').findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'User not found' });

    req.session.userID = user._id;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;
    req.session.username = user.name;
    req.session.playerName = user.name;
    req.session.userCollege = user.college;
    req.session.collegeName = user.college;

    let redirectUrl = '';
    switch (user.role) {
      case 'admin': redirectUrl = '/admin/admin_dashboard'; break;
      case 'organizer': redirectUrl = '/organizer/organizer_dashboard'; break;
      case 'coordinator': redirectUrl = '/coordinator/coordinator_dashboard'; break;
      case 'player': redirectUrl = '/player/player_dashboard?success-message=Player Login Successful'; break;
      default: return res.status(400).json({ success: false, message: 'Invalid Role' });
    }
    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
});



// Session info
app.get('/api/session', (req, res) => {
  res.json({ userEmail: req.session.userEmail || null, userRole: req.session.userRole || null, username: req.session.username || null });
});

// Player notifications (root-level aliases for React client)
app.get('/api/notifications', async (req, res) => {
  try {
    console.log('GET /api/notifications - Session:', { email: req.session.userEmail, role: req.session.userRole });
    if (!req.session.userEmail || req.session.userRole !== 'player') {
      return res.status(401).json({ error: 'Please log in' });
    }
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) {
      console.log('GET /api/notifications - User not found for email:', req.session.userEmail);
      return res.status(404).json({ error: 'Player not found' });
    }
    console.log('GET /api/notifications - Found user:', { _id: user._id, name: user.name, email: user.email });

    const notifications = await db.collection('notifications').aggregate([
      { $match: { user_id: user._id } },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $unwind: '$tournament' },
      { $project: { _id: 1, type: 1, read: 1, date: 1, tournamentName: '$tournament.name', tournament_id: '$tournament._id' } }
    ]).toArray();

    console.log('GET /api/notifications - Found notifications:', notifications.length, notifications.map(n => ({ type: n.type, read: n.read, tournament: n.tournamentName })));

    const formatted = notifications.map(n => ({
      ...n,
      _id: n._id.toString(),
      tournament_id: n.tournament_id.toString()
    }));
    return res.json({ notifications: formatted });
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/mark-read', async (req, res) => {
  try {
    if (!req.session.userEmail || req.session.userRole !== 'player') {
      return res.status(401).json({ error: 'Please log in' });
    }
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const db = await connectDB();
    await db.collection('notifications').updateOne({ _id: new ObjectId(id) }, { $set: { read: true } });
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/notifications/mark-read error:', err);
    return res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Dev-only: inject a feedback_request notification for the logged-in player
app.post('/dev/mock-feedback', async (req, res) => {
  try {
    if ((process.env.NODE_ENV || 'development') === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }
    if (!req.session.userEmail || req.session.userRole !== 'player') {
      return res.status(401).json({ error: 'Please log in as player' });
    }
    const { tournamentId } = req.body || {};
    if (!tournamentId || !ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Valid tournamentId required' });
    }
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });
    const tid = new ObjectId(tournamentId);
    const tournament = await db.collection('tournaments').findOne({ _id: tid });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    await db.collection('notifications').insertOne({
      user_id: user._id,
      type: 'feedback_request',
      tournament_id: tid,
      read: false,
      date: new Date()
    });
    return res.json({ success: true });
  } catch (e) {
    console.error('POST /dev/mock-feedback error:', e);
    return res.status(500).json({ error: 'Failed to create mock feedback notification' });
  }
});

// Theme preference (persist per user)
app.get('/api/theme', async (req, res) => {
  try {
    if (!req.session.userEmail) return res.json({ success: true, theme: null });
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail }, { projection: { theme: 1 } });
    const theme = (user && user.theme === 'dark') ? 'dark' : 'light';
    return res.json({ success: true, theme });
  } catch (e) {
    console.error('GET /api/theme error:', e);
    return res.status(500).json({ success: false, message: 'Failed to load theme' });
  }
});

app.post('/api/theme', async (req, res) => {
  try {
    const { theme } = req.body || {};
    if (!req.session.userEmail) return res.status(401).json({ success: false, message: 'Not logged in' });
    if (!['dark', 'light'].includes(theme)) return res.status(400).json({ success: false, message: 'Invalid theme value' });
    const db = await connectDB();
    await db.collection('users').updateOne({ email: req.session.userEmail }, { $set: { theme } });
    return res.json({ success: true });
  } catch (e) {
    console.error('POST /api/theme error:', e);
    return res.status(500).json({ success: false, message: 'Failed to save theme' });
  }
});



// Chat history
app.get('/api/chat/history', async (req, res) => {
  try {
    const room = (req.query.room || 'global').toString();
    const db = await connectDB();
    const history = await db.collection('chat_messages').find({ room }).sort({ timestamp: -1 }).limit(50).toArray();
    res.json({ success: true, history });
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
});

// Search users by role (registered users) - returns basic public info (no password/mfaSecret)
app.get('/api/users', async (req, res) => {
  console.log('API /api/users called with query:', req.query);
  try {
    const role = (req.query.role || '').toString().toLowerCase();
    const q = {};
    if (role) q.role = role;
    const db = await connectDB();
    const users = await db.collection('users').find(q, { projection: { password: 0, mfaSecret: 0 } }).limit(200).toArray();
    // normalize name field to username for frontend compatibility
    const list = users.map(u => ({ id: u._id, username: u.name || u.username || u.email, email: u.email || null, role: u.role }));
    res.json({ success: true, users: list });
  } catch (err) {
    console.error('User search error:', err);
    res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
});

// Contacts summary for a given username: returns last message per contact (global + PMs)
app.get('/api/chat/contacts', async (req, res) => {
  try {
    const username = (req.query.username || '').toString();
    if (!username) return res.status(400).json({ success: false, message: 'username required' });
    const db = await connectDB();
    // fetch recent messages involving this user (global + pm rooms containing username)
    const recent = await db.collection('chat_messages').find({
      $or: [
        { room: 'global' },
        { room: { $regex: `^pm:` } }
      ],
      $or: [ { sender: username }, { receiver: username }, { room: { $regex: username } } ]
    }).sort({ timestamp: -1 }).limit(500).toArray();

    const contactsMap = new Map();
    for (const m of recent) {
      if (m.room === 'global') {
        if (!contactsMap.has('All')) contactsMap.set('All', { contact: 'All', lastMessage: m.message, timestamp: m.timestamp, room: 'global' });
        continue;
      }
      // room is pm:UserA:UserB
      const parts = (m.room || '').replace(/^pm:/, '').split(':');
      const other = parts.find(p => p !== username) || parts[0] || 'Unknown';
      if (!contactsMap.has(other)) contactsMap.set(other, { contact: other, lastMessage: m.message, timestamp: m.timestamp, room: m.room });
    }

    const contacts = Array.from(contactsMap.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, contacts });
  } catch (err) {
    console.error('chat contacts error:', err);
    res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
});

// ------------- Socket.IO chat & chess -------------
const onlineUsers = new Map(); // socket.id -> { username, role }
const usernameToSockets = new Map(); // username -> Set(socket.id)

function broadcastUsers() {
  const unique = Array.from(new Map(Array.from(onlineUsers.values()).map(u => [u.username, u])).values());
  io.emit('updateUsers', unique);
}

function privateRoomName(u1, u2) {
  return `pm:${[u1, u2].sort().join(':')}`;
}

io.on('connection', (socket) => {
  socket.on('join', ({ username, role }) => {
    if (!username) return;
    onlineUsers.set(socket.id, { username, role });
    const set = usernameToSockets.get(username) || new Set();
    set.add(socket.id);
    usernameToSockets.set(username, set);
    broadcastUsers();
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
    broadcastUsers();
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
        await db.collection('chat_messages').insertOne({ room: 'global', sender: actualSender, message, timestamp: new Date() });
      } else {
        const room = privateRoomName(actualSender, receiver);
        const senderSet = usernameToSockets.get(actualSender) || new Set();
        const receiverSet = usernameToSockets.get(receiver) || new Set();
        const allIds = new Set([...senderSet, ...receiverSet]);
        for (const id of allIds) {
          const s = io.sockets.sockets.get ? io.sockets.sockets.get(id) : io.sockets.sockets[id];
          if (s && s.emit) s.emit('message', payload);
        }
        await db.collection('chat_messages').insertOne({ room, sender: actualSender, receiver, message, timestamp: new Date() });
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
      await db.collection('games').updateOne({ room }, { $push: { moves: { ...move, timestamp: new Date() } }, $set: { fen: move.fen, updatedAt: new Date() } }, { upsert: true });
    } catch (e) {
      // ignore persistence errors for now
      console.error('chessMove persist error:', e);
    }
  });
});

// 404 handler
app.use((req, res) => res.status(404).redirect('/?error-message=Page not found'));

// Error-handling middleware (must have 4 args)
// Ensures unexpected errors return a consistent response instead of crashing the server.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);

  const status = (err && (err.status || err.statusCode)) ? (err.status || err.statusCode) : 500;
  const wantsJson = (req.path && req.path.startsWith('/api')) || req.xhr || (req.accepts && req.accepts('json'));
  const message = (err && err.message) ? err.message : 'Internal Server Error';

  if (wantsJson) {
    return res.status(status).json({ success: false, message });
  }

  return res.status(status).send(message);
});

connectDB().catch(err => console.error('Database connection failed:', err));
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// --- Tournament status scheduler: mark Ongoing and auto-complete after 1 hour ---
(function scheduleTournamentStatusUpdater() {
  async function tick() {
    try {
      const db = await connectDB();
      const now = new Date();
      const list = await db.collection('tournaments').find({ status: { $in: ['Approved', 'Ongoing'] } }).toArray();
      const toOngoing = [];
      const toCompleted = [];
      for (const t of list) {
        if (!t || !t.date) continue;
        const dateOnly = new Date(t.date);
        const timeStr = (t.time || '00:00').toString();
        const [hh, mm] = (timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00']);
        const start = new Date(dateOnly);
        start.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        if (now >= end) {
          if (t.status !== 'Completed') toCompleted.push(t._id);
        } else if (now >= start && now < end) {
          if (t.status !== 'Ongoing') toOngoing.push(t._id);
        }
      }
      if (toOngoing.length) {
        await db.collection('tournaments').updateMany(
          { _id: { $in: toOngoing } },
          { $set: { status: 'Ongoing' } }
        );
      }
      if (toCompleted.length) {
        await db.collection('tournaments').updateMany(
          { _id: { $in: toCompleted } },
          { $set: { status: 'Completed', completed_at: new Date() } }
        );
      }
    } catch (e) {
      console.error('Tournament status scheduler error:', e);
    }
  }
  // run immediately and every minute
  tick();
  setInterval(tick, 60 * 1000);
})();