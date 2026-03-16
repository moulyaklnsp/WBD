/**
 * ChessHive Backend – MVC Entry Point
 * ====================================
 * Responsibilities (only):
 *   1. Load env + packages
 *   2. Set up Morgan + RFS logging
 *   3. Create Express app, HTTP server, Socket.IO
 *   4. Configure session store
 *   5. Mount global middleware
 *   6. Mount all route files
 *   7. Serve Swagger UI at /api-docs
 *   8. Start background services (tournament scheduler, socket handlers)
 *   9. 404 + error handlers
 *  10. Listen
 */

const express        = require('express');
const path           = require('path');
const fs             = require('fs');
const http           = require('http');
const { Server }     = require('socket.io');
const session        = require('express-session');
const cors           = require('cors');
const helmet         = require('helmet');
const methodOverride = require('method-override');
const morgan         = require('morgan');
const rfs            = require('rotating-file-stream');
const swaggerUi      = require('swagger-ui-express');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// ─── Internal modules ─────────────────────────────────────────────────────────
const { connectDB }          = require('./config/database');
const swaggerSpec            = require('./config/swagger');
const { initSocketHandlers } = require('./services/socketService');
const SchedulerService       = require('./services/schedulerService');
const LogsController         = require('./controllers/logsController');
const coordinatorController  = require('./controllers/coordinatorController');

// Route files
const authRoutes        = require('./routes/authRoutes');
const adminRoutes       = require('./routes/adminRoutes');
const organizerRoutes   = require('./routes/organizerRoutes');
const coordinatorRoutes = require('./routes/coordinatorRoutes');
const playerRoutes      = require('./routes/playerRoutes');
const chatRoutes        = require('./routes/chatRoutes');
const userRoutes        = require('./routes/userRoutes');
const logsRoutes        = require('./routes/logsRoutes');

// Role middleware
const { isAdmin, isOrganizer, isCoordinator, isPlayer } = require('./middlewares/roleAuth');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

// ─── Logging setup (Morgan + Rotating File Stream) ────────────────────────────
const backendLogsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(backendLogsDir)) fs.mkdirSync(backendLogsDir, { recursive: true });

const backendAccessStream = rfs.createStream('access.log', {
  interval: '1d',
  maxFiles: 14,
  path: backendLogsDir,
  compress: 'gzip'
});

const backendErrorStream = rfs.createStream('error.log', {
  interval: '1d',
  maxFiles: 14,
  path: backendLogsDir,
  compress: 'gzip'
});

// ─── Frontend log stream ──────────────────────────────────────────────────────
const frontendLogsDir = path.join(__dirname, '..', '..', 'frontend', 'logs');
if (!fs.existsSync(frontendLogsDir)) fs.mkdirSync(frontendLogsDir, { recursive: true });

const frontendLogStream = rfs.createStream('frontend.log', {
  interval: '1d',
  maxFiles: 14,
  path: frontendLogsDir,
  compress: 'gzip'
});

// Inject the stream into the logs controller
LogsController.setStream(frontendLogStream);

// ─── Express + HTTP + Socket.IO ───────────────────────────────────────────────
const app    = express();
const server = http.createServer({ maxHeaderSize: 1048576 }, app);
const io     = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.locals.io = io;

const PORT            = process.env.PORT || 3001;
const mongoSessionUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/chesshive';

// ─── Session store (connect-mongo) ───────────────────────────────────────────
let sessionStore = null;
try {
  const MongoStoreLib = require('connect-mongo');
  if (MongoStoreLib && typeof MongoStoreLib.create === 'function') {
    sessionStore = MongoStoreLib.create({
      mongoUrl: mongoSessionUrl,
      collectionName: 'sessions',
      ttl: 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 24 * 3600
    });
  } else if (typeof MongoStoreLib === 'function') {
    sessionStore = MongoStoreLib(session)({ url: mongoSessionUrl, collection: 'sessions', ttl: 24 * 60 * 60 });
  }
} catch (e) {
  console.warn('connect-mongo not available, using memory session store:', e.message);
}

// ─── Global middleware ────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));

app.use(morgan('combined', { stream: backendAccessStream }));
app.use(morgan('combined', { stream: backendErrorStream, skip: (_req, res) => res.statusCode < 400 }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use(session({
  name: process.env.SESSION_COOKIE_NAME || 'sid',
  secret: process.env.SESSION_SECRET || 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: sessionStore,
  cookie: { secure: false, sameSite: 'lax', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(helmet());

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'ChessHive API Docs',
  swaggerOptions: { persistAuthorization: true }
}));
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use(authRoutes);                                    // /api/login, /api/signup, etc.
app.use(chatRoutes);                                    // /api/chat/*
app.use(userRoutes);                                    // /api/users
app.use(logsRoutes);                                    // /api/logs/frontend
app.get('/api/public/coordinator-blogs', coordinatorController.getPublishedBlogsPublic);
app.use('/admin',       isAdmin,       adminRoutes);
app.use('/organizer',   isOrganizer,   organizerRoutes);
app.use('/coordinator', isCoordinator, coordinatorRoutes);
app.use('/player',      isPlayer,      playerRoutes);

// ─── Static root ──────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// ─── Dev mock feedback (development only) ────────────────────────────────────
if ((process.env.NODE_ENV || 'development') !== 'production') {
  const { ObjectId } = require('mongodb');
  app.post('/dev/mock-feedback', async (req, res) => {
    try {
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
        user_id: user._id, type: 'feedback_request', tournament_id: tid, read: false, date: new Date()
      });
      return res.json({ success: true });
    } catch (e) {
      console.error('POST /dev/mock-feedback error:', e);
      return res.status(500).json({ error: 'Failed to create mock feedback notification' });
    }
  });
}

// ─── 404 + error handlers (see src/middlewares/errorMiddleware.js) ───────────
app.use(notFound);
app.use(errorHandler);

// ─── Background services ──────────────────────────────────────────────────────
initSocketHandlers(io);
SchedulerService.startTournamentScheduler();

// ─── Start server ─────────────────────────────────────────────────────────────
connectDB().catch(err => console.error('Database connection failed:', err));
server.listen(PORT, () =>
  console.log(`ChessHive server running on port ${PORT} | Swagger UI: http://localhost:${PORT}/api-docs`)
);