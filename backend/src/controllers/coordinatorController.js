const { connectDB } = require('../config/database');
const moment = require('moment');
const helpers = require('../utils/helpers');
const { uploadImageBuffer, destroyImage, cloudinary } = require('../utils/cloudinary');
const { ObjectId } = require('mongodb');
const path = require('path');
const Player = require('../models/Player');
const Team = require('../models/Team');
const { swissPairing, swissTeamPairing } = require('../utils/swissPairing');
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF files are allowed.'), false);
    }
  }
});

// ── Middleware ──────────────────────────────────────────────────

// Middleware for tournament file uploads
const uploadTournamentFileMiddleware = (req, res, next) => {
  if (!multer) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
};

// ── Private helpers (not exported) ──────────────────────────────

function normalizePlatform(p) {
  const v = (p || '').toString().trim().toLowerCase();
  if (!v) return 'other';
  if (['youtube', 'twitch', 'lichess', 'chesscom', 'chess.com'].includes(v)) {
    return v === 'chess.com' ? 'chesscom' : v;
  }
  return 'other';
}

function normalizeStreamType(value) {
  const v = safeTrim(value).toLowerCase();
  if (v === 'classical' || v === 'rapid' || v === 'blitz') return v;
  return '';
}

function safeTrim(v) {
  return (v == null ? '' : String(v)).trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PLAYER_ORDER_STATUSES = ['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'];

function normalizeOrderStatus(value) {
  const raw = safeTrim(value).toLowerCase();
  if (!raw || raw === 'confirmed') return 'pending';
  return PLAYER_ORDER_STATUSES.includes(raw) ? raw : 'pending';
}

function getAllowedOrderStatusTransitions(currentStatus) {
  switch (currentStatus) {
    case 'pending':
      return ['processing', 'packed', 'shipped', 'delivered', 'cancelled'];
    case 'processing':
      return ['packed', 'shipped', 'delivered', 'cancelled'];
    case 'packed':
      return ['shipped', 'delivered', 'cancelled'];
    case 'shipped':
      return ['delivered'];
    default:
      return [];
  }
}

function parseDateValue(value) {
  const raw = safeTrim(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map((n) => Number.parseInt(n, 10));
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toStartOfDay(value) {
  const d = parseDateValue(value);
  if (!d) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function isPastDate(value) {
  const candidate = toStartOfDay(value);
  if (!candidate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return candidate < today;
}

function isAllowedMeetingLink(raw) {
  try {
    const parsed = new URL(String(raw || '').trim());
    const host = parsed.hostname.toLowerCase();
    const isGoogleMeet = host === 'meet.google.com';
    const isZoom = host === 'zoom.us' || host.endsWith('.zoom.us');
    return parsed.protocol === 'https:' && (isGoogleMeet || isZoom);
  } catch {
    return false;
  }
}

async function getCoordinatorOwnerCandidates(db, session) {
  const user = await db.collection('users').findOne({
    email: session.userEmail,
    role: 'coordinator'
  });

  return [session.userEmail, session.username, user?.email, user?.name]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());
}

async function getCoordinatorOwnerIdentifiers(db, session) {
  const user = await db.collection('users').findOne({
    email: session.userEmail,
    role: 'coordinator'
  });

  const raw = [session.userEmail, session.username, user?.email, user?.name]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean);

  const lowered = raw.map((v) => v.toLowerCase());
  return Array.from(new Set([...raw, ...lowered]));
}

// ── Streaming ───────────────────────────────────────────────────

const getStreams = async (req, res) => {
  try {
    const db = await connectDB();
    const createdByEmail = req.session.userEmail;
    const streams = await db.collection('streams')
      .find({ createdByEmail })
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray();
    const out = (streams || []).map(s => ({
      ...s,
      _id: s._id ? s._id.toString() : undefined,
    }));
    return res.json(out);
  } catch (error) {
    console.error('Error fetching coordinator streams:', error);
    return res.status(500).json({ error: 'Failed to fetch streams' });
  }
};

const createStream = async (req, res) => {
  try {
    const title = safeTrim(req.body?.title);
    const url = safeTrim(req.body?.url);
    const platform = normalizePlatform(req.body?.platform);
    const streamType = normalizeStreamType(req.body?.streamType);
    const description = safeTrim(req.body?.description);
    const isLive = !!req.body?.isLive;
    const featured = !!req.body?.featured;
    const matchLabel = safeTrim(req.body?.matchLabel);

    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!url) return res.status(400).json({ error: 'Stream URL is required' });
    if (!streamType) {
      return res.status(400).json({ error: 'Stream type is required (Classical, Rapid, or Blitz)' });
    }

    const db = await connectDB();

    const coordinator = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });

    const now = new Date();
    const doc = {
      title,
      url,
      platform,
      streamType,
      description,
      matchLabel,
      result: safeTrim(req.body?.result) || '',
      isLive,
      featured,
      createdByEmail: req.session.userEmail,
      createdByName: coordinator?.name || req.session.username || req.session.userEmail,
      createdAt: now,
      updatedAt: now,
    };
    if (!isLive) {
      doc.endedAt = now;
    }

    const result = await db.collection('streams').insertOne(doc);
    return res.status(201).json({ ...doc, _id: result.insertedId.toString() });
  } catch (error) {
    console.error('Error creating stream:', error);
    return res.status(500).json({ error: 'Failed to create stream' });
  }
};

const updateStream = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });

    const updates = {};
    if (req.body?.title != null) updates.title = safeTrim(req.body.title);
    if (req.body?.url != null) updates.url = safeTrim(req.body.url);
    if (req.body?.platform != null) updates.platform = normalizePlatform(req.body.platform);
    if (req.body?.streamType != null) updates.streamType = normalizeStreamType(req.body.streamType);
    if (req.body?.description != null) updates.description = safeTrim(req.body.description);
    if (req.body?.matchLabel != null) updates.matchLabel = safeTrim(req.body.matchLabel);
    if (req.body?.result != null) updates.result = safeTrim(req.body.result);
    if (req.body?.isLive != null) updates.isLive = !!req.body.isLive;
    if (req.body?.featured != null) updates.featured = !!req.body.featured;
    updates.updatedAt = new Date();

    // basic validation if present
    if ('title' in updates && !updates.title) return res.status(400).json({ error: 'Title cannot be empty' });
    if ('url' in updates && !updates.url) return res.status(400).json({ error: 'Stream URL cannot be empty' });
    if ('streamType' in updates && !updates.streamType) {
      return res.status(400).json({ error: 'Invalid stream type. Use Classical, Rapid, or Blitz' });
    }

    const db = await connectDB();

    const filter = { _id: new ObjectId(id), createdByEmail: req.session.userEmail };
    const existing = await db.collection('streams').findOne(filter);
    if (!existing) return res.status(404).json({ error: 'Stream not found' });

    // Maintain endedAt when switching live state
    const unsetOps = {};
    if ('isLive' in updates) {
      if (updates.isLive === false && existing.isLive === true) {
        updates.endedAt = new Date();
      }
      if (updates.isLive === true && existing.isLive === false) {
        unsetOps.endedAt = '';
      }
    }

    const updateDoc = { $set: updates };
    if (Object.keys(unsetOps).length > 0) {
      updateDoc.$unset = unsetOps;
    }

    await db.collection('streams').updateOne(filter, updateDoc);
    const updated = await db.collection('streams').findOne(filter);
    return res.json({
      ...(updated || {}),
      _id: updated?._id ? updated._id.toString() : undefined,
    });
  } catch (error) {
    console.error('Error updating stream:', error);
    return res.status(500).json({ error: 'Failed to update stream' });
  }
};

const deleteStream = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid id' });
    const db = await connectDB();
    const result = await db.collection('streams').deleteOne({ _id: new ObjectId(id), createdByEmail: req.session.userEmail });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Stream not found' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting stream:', error);
    return res.status(500).json({ error: 'Failed to delete stream' });
  }
};

// ── Profile ─────────────────────────────────────────────────────

const getName = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinator = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    res.json({ name: coordinator?.name || 'Coordinator' });
  } catch (error) {
    console.error('Error fetching name:', error);
    res.status(500).json({ error: 'Failed to fetch name' });
  }
};

const getDashboard = async (req, res) => {
  try {
    const db = await connectDB();
    const today = new Date();
    const threeDaysLater = moment().add(3, 'days').toDate();
    const username = req.session.username || req.session.userEmail;
    const userEmail = req.session.userEmail;

    const coordinator = await db.collection('users').findOne({
      email: userEmail,
      role: 'coordinator'
    });

    // A. Upcoming Meetings (within 3 days)
    const meetings = await db.collection('meetingsdb')
      .find({
        date: { $gte: today, $lte: threeDaysLater },
        name: { $ne: username }
      })
      .sort({ date: 1, time: 1 })
      .toArray();

    // B. Upcoming Tournaments (within 3 days)
    const upcomingTournaments = await db.collection('tournaments')
      .find({
        coordinator: username,
        date: { $gte: today, $lte: threeDaysLater },
        status: { $nin: ['Removed', 'Rejected'] }
      })
      .sort({ date: 1 })
      .toArray();

    // C. Stock Alerts (products with stock < 15)
    const stockAlerts = await db.collection('products')
      .find({
        coordinator: username,
        availability: { $lt: 15, $gte: 0 }
      })
      .toArray();

    // D. Notification count (unread)
    const unreadNotificationCount = await db.collection('notifications')
      .countDocuments({
        user_id: coordinator?._id,
        read: false
      });

    res.json({
      coordinatorName: coordinator?.name || 'Coordinator',
      meetings: meetings || [],
      upcomingTournaments: upcomingTournaments || [],
      stockAlerts: stockAlerts || [],
      unreadNotificationCount: unreadNotificationCount || 0
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

const getProfile = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinator = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });

    if (!coordinator) {
      return res.status(404).json({ error: 'Coordinator not found' });
    }

    res.json({
      name: coordinator.name,
      email: coordinator.email,
      phone: coordinator.phone || '',
      college: coordinator.college || '',
      dob: coordinator.dob || null,
      gender: coordinator.gender || '',
      AICF_ID: coordinator.AICF_ID || '',
      FIDE_ID: coordinator.FIDE_ID || '',
      profile_photo_url: coordinator.profile_photo_url || ''
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

// Upload/Update coordinator profile photo
// Expects multipart/form-data with field name: "photo"
// This handler combines multer middleware + the actual upload logic.
// When wiring routes, use it as:  router.post('/api/upload-photo', uploadPhoto);
// It internally runs multer, then processes the file.
const uploadPhoto = async (req, res) => {
  if (!multer) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (r, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
      if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
      cb(null, true);
    }
  }).single('photo');

  // Run multer as a promise
  try {
    await new Promise((resolve, reject) => {
      uploader(req, res, (err) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded. Use field name "photo".' });
  }

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'coordinator' });
    if (!user) return res.status(404).json({ error: 'Coordinator not found' });

    const existingPublicId = (user.profile_photo_public_id || '').toString();
    const desiredPublicId = existingPublicId || `chesshive/profile-photos/coordinator_${user._id}`;

    console.log('Uploading photo for coordinator:', user.email);
    const result = await uploadImageBuffer(req.file.buffer, {
      folder: 'chesshive/profile-photos',
      public_id: desiredPublicId.split('/').pop(),
      overwrite: true,
      invalidate: true
    });

    const newUrl = result?.secure_url;
    const newPublicId = result?.public_id;
    if (!newUrl || !newPublicId) {
      console.error('Cloudinary upload failed:', result);
      return res.status(500).json({ error: 'Failed to upload profile photo' });
    }

    // Best-effort cleanup of previous Cloudinary asset (if public_id changed)
    if (existingPublicId && existingPublicId !== newPublicId) {
      await destroyImage(existingPublicId);
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { profile_photo_url: newUrl, profile_photo_public_id: newPublicId, updated_date: new Date() } }
    );

    return res.json({ success: true, profile_photo_url: newUrl });
  } catch (err) {
    console.error('Error updating profile photo:', err);
    return res.status(500).json({ error: 'Failed to update profile photo: ' + err.message });
  }
};

const deleteProfile = async (req, res) => {
  try {
    const db = await connectDB();
    const usermail = req.session.userEmail;

    const result = await db.collection('users').updateOne(
      { email: req.session.userEmail, role: 'coordinator' },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: usermail } }
    );

    if (result.modifiedCount > 0) {
      console.log('Account deleted:', req.session.userEmail);
      // Clear session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session:', err);
      });
      res.json({ success: true, message: 'Account deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Account not found' });
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
};

// ── Tournaments ─────────────────────────────────────────────────

const getTournaments = async (req, res) => {
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) {
      console.log('User not found for tournaments fetch');
      return res.status(401).json({ error: 'User not logged in' });
    }
    const username = req.session.username || user.name || req.session.userEmail;

    console.log('Fetching tournaments for username:', username);

    const tournaments = await db.collection('tournaments')
      .find({ coordinator: username })
      .sort({ date: -1 })
      .toArray();

    console.log('Fetched tournaments count:', tournaments.length);

    res.json({ tournaments: tournaments || [] });
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Failed to fetch tournaments' });
  }
};

const getTournamentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const tournament = await db.collection('tournaments').findOne({ _id: new ObjectId(id) });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const ownerCandidates = [req.session.username, user.name, req.session.userEmail]
      .filter(Boolean)
      .map((v) => v.toString().trim().toLowerCase());
    const tournamentCoordinator = (tournament.coordinator || '').toString().trim().toLowerCase();
    if (!ownerCandidates.includes(tournamentCoordinator)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const tid = new ObjectId(id);
    const individualCount = await db.collection('tournament_players').countDocuments({ tournament_id: tid });
    const approvedTeamCount = await db.collection('enrolledtournaments_team').countDocuments({
      tournament_id: tid,
      approved: 1
    });
    const feedbackCount = await db.collection('feedbacks').countDocuments({ tournament_id: tid });
    const complaintsCount = await db.collection('tournament_complaints').countDocuments({ tournament_id: tid });
    const entryFee = Number(tournament.entry_fee || 0);
    const totalEnrollments = (tournament.type || '').toLowerCase() === 'team' ? approvedTeamCount : individualCount;
    const totalAmountReceived = entryFee * totalEnrollments;

    return res.json({
      tournament,
      stats: {
        individualCount,
        approvedTeamCount,
        totalEnrollments,
        feedbackCount,
        complaintsCount,
        totalAmountReceived
      }
    });
  } catch (error) {
    console.error('Error fetching tournament details:', error);
    return res.status(500).json({ error: 'Failed to fetch tournament details' });
  }
};

const createTournament = async (req, res) => {
  try {
    const { tournamentName, tournamentDate, time, location, entryFee, type, noOfRounds } = req.body;
    console.log('POST body received:', req.body);

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) {
      console.log('User not found in DB');
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }
    const username = req.session.username || user.name || req.session.userEmail;
    const college = user.college;

    const tournament = {
      name: tournamentName.toString().trim(),
      date: new Date(tournamentDate),
      time: time.toString().trim(),
      location: location.toString().trim(),
      entry_fee: parseFloat(entryFee),
      type: type.toString().trim(),
      noOfRounds: parseInt(noOfRounds),
      coordinator: username.toString(),
      status: 'Pending',
      added_by: username.toString(),
      submitted_date: new Date()
    };

    console.log('Tournament to insert:', tournament);

    const result = await db.collection('tournaments').insertOne(tournament);
    if (result.insertedId) {
      console.log('Tournament added successfully:', tournamentName);
      return res.json({ success: true, message: 'Tournament added successfully' });
    } else {
      console.log('Insert failed: No insertedId');
      return res.status(500).json({ success: false, message: 'Failed to add tournament' });
    }
  } catch (error) {
    console.error('Full validation error:', JSON.stringify(error, null, 2));
    console.error('Error details array:', JSON.stringify(error.errInfo?.details || 'No details', null, 2));
    return res.status(500).json({ success: false, error: 'Failed to add tournament' });
  }
};

const updateTournament = async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid tournament ID' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }
    const username = req.session.username || user.name || req.session.userEmail;

    // Accept both camelCase and snake_case from frontend
    const body = req.body || {};
    const name = (body.tournamentName ?? body.name);
    const date = (body.tournamentDate ?? body.date);
    const time = (body.time ?? body.tournamentTime);
    const location = (body.location ?? body.tournamentLocation);
    const entryFee = (body.entryFee ?? body.entry_fee);
    const type = body.type;
    const rounds = (body.noOfRounds ?? body.no_of_rounds);

    const $set = {};
    if (typeof name === 'string' && name.trim()) $set.name = name.trim();
    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) $set.date = d;
    }
    if (typeof time === 'string' && time.trim()) $set.time = time.trim();
    if (typeof location === 'string' && location.trim()) $set.location = location.trim();
    if (entryFee !== undefined && entryFee !== null && !isNaN(parseFloat(entryFee))) $set.entry_fee = parseFloat(entryFee);
    if (typeof type === 'string' && type.trim()) $set.type = type.trim();
    if (rounds !== undefined && rounds !== null && !isNaN(parseInt(rounds))) $set.noOfRounds = parseInt(rounds);

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided to update' });
    }

    const result = await db.collection('tournaments').updateOne(
      { _id: new ObjectId(id), coordinator: username },
      { $set }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Tournament not found or not owned by you' });
    }

    if (result.modifiedCount === 0) {
      // Nothing changed but consider it ok
      return res.json({ success: true, message: 'No changes detected' });
    }

    return res.json({ success: true, message: 'Tournament updated successfully' });
  } catch (error) {
    console.error('Error updating tournament:', error);
    return res.status(500).json({ success: false, message: 'Failed to update tournament' });
  }
};

const deleteTournament = async (req, res) => {
  try {
    const id = req.params.id;
    const username = req.session.username || req.session.userEmail;
    const result = await (await connectDB()).collection('tournaments').updateOne(
      { _id: new ObjectId(id), coordinator: username },
      { $set: { status: 'Removed', removed_date: new Date(), removed_by: username } }
    );

    if (result.modifiedCount > 0) {
      console.log('Tournament removed:', id);
      res.json({ success: true, message: 'Tournament removed successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Tournament not found' });
    }
  } catch (error) {
    console.error('Error removing tournament:', error);
    res.status(500).json({ success: false, error: 'Failed to remove tournament' });
  }
};

// ── Store ───────────────────────────────────────────────────────

const getProducts = async (req, res) => {
  try {
    const db = await connectDB();
    const college = req.session.userCollege || req.session.collegeName;
    const products = await db.collection('products')
      .find({ college: college })
      .toArray();

    const normalized = (products || []).map((p) => ({
      ...p,
      _id: p._id ? p._id.toString() : '',
      imageUrl: p.image_url || p.imageUrl || (Array.isArray(p.image_urls) ? p.image_urls[0] : ''),
      image_urls: Array.from(new Set([
        ...(Array.isArray(p.image_urls)
          ? p.image_urls
          : (typeof p.image_urls === 'string'
              ? p.image_urls.split(',').map((s) => s.trim())
              : [])),
        p.image_url,
        p.imageUrl
      ].filter(Boolean))),
      comments_enabled: !!p.comments_enabled
    }));

    res.json({ products: normalized });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

const addProduct = async (req, res) => {
  try {
    // Optional multipart support (single/multiple image file upload)
    if (multer && (req.headers['content-type'] || '').includes('multipart/form-data')) {
      const uploader = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 2 * 1024 * 1024, files: 8 },
        fileFilter: (r, file, cb) => {
          const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
          if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
          cb(null, true);
        }
      }).any();

      await new Promise((resolve, reject) => {
        uploader(req, res, (err) => (err ? reject(err) : resolve()));
      });
    }

    // Accept both camelCase and legacy names from frontend
    const productName = (req.body.productName ?? req.body.name ?? '').toString();
    const productCategory = (req.body.productCategory ?? req.body.category ?? '').toString();
    const price = req.body.price; // numeric string or number
    let imageUrl = (req.body.imageUrl ?? req.body.image_url ?? '').toString();
    let imagePublicId = (req.body.imagePublicId ?? req.body.image_public_id ?? '').toString();
    const imageUrlsFromBody = Array.isArray(req.body.imageUrls)
      ? req.body.imageUrls
      : (typeof req.body.imageUrls === 'string'
          ? req.body.imageUrls.split(',').map((s) => s.trim()).filter(Boolean)
          : []);
    const availability = (req.body.availability !== undefined ? req.body.availability : req.body.stock);

    console.log('POST body received (normalized):', { productName, productCategory, price, imageUrl, availability });
    console.log('Raw body:', req.body);
    console.log('Session data:', { userEmail: req.session.userEmail, userCollege: req.session.userCollege, collegeName: req.session.collegeName });

    const files = Array.isArray(req.files) ? req.files : [];
    const uploadedImageUrls = [];
    const uploadedPublicIds = [];

    // If image file(s) were provided, upload all to Cloudinary
    if (files.length > 0) {
      for (const file of files) {
        const result = await uploadImageBuffer(file.buffer, {
          folder: 'chesshive/product-images',
          public_id: `product_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          overwrite: false
        });
        if (result?.secure_url) uploadedImageUrls.push(result.secure_url);
        if (result?.public_id) uploadedPublicIds.push(result.public_id);
      }
      if (uploadedImageUrls.length > 0) {
        imageUrl = uploadedImageUrls[0];
        imagePublicId = uploadedPublicIds[0] || '';
      }
    }

    const allImageUrls = [...new Set([imageUrl, ...imageUrlsFromBody, ...uploadedImageUrls].filter(Boolean))];

    // Basic validation
    if (!productName || !productCategory || price === undefined || price === '' || (!imageUrl && allImageUrls.length === 0) || availability === undefined) {
      console.log('Validation failed: Missing fields');
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    const priceNum = parseFloat(price);
    const availNum = parseInt(availability);
    if (isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ success: false, message: 'Invalid price value' });
    }
    if (isNaN(availNum) || availNum < 0) {
      return res.status(400).json({ success: false, message: 'Invalid availability value' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) {
      console.log('User not found in DB');
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }
    const username = user.name || req.session.userEmail;
    const college = user.college || req.session.userCollege || req.session.collegeName;

    if (!college) {
      console.log('College not found');
      return res.status(401).json({ success: false, message: 'College info missing' });
    }

    const product = {
      name: productName.trim(),
      category: productCategory.trim(),
      price: priceNum,
      image_url: (imageUrl || allImageUrls[0] || '').trim(),
      image_urls: (allImageUrls.length > 0 ? allImageUrls : [imageUrl]).filter(Boolean),
      image_public_id: imagePublicId ? imagePublicId.toString() : undefined,
      image_public_ids: uploadedPublicIds.length > 0 ? uploadedPublicIds : undefined,
      availability: availNum || 0,
      college: college.toString(),
      coordinator: username.toString(),
      added_date: new Date()
    };

    // Remove undefined fields (keeps DB clean)
    Object.keys(product).forEach((k) => product[k] === undefined && delete product[k]);
    console.log('Product to insert:', product);

    const result = await db.collection('products').insertOne(product);
    if (result.insertedId) {
      console.log('Product added successfully:', productName);
      return res.json({ success: true, message: 'Product added successfully' });
    } else {
      console.log('Insert failed: No insertedId');
      return res.status(500).json({ success: false, message: 'Failed to add product' });
    }
  } catch (error) {
    console.error('Full validation error:', JSON.stringify(error, null, 2));
    return res.status(500).json({ success: false, error: 'Failed to add product' });
  }
};

// ── Meetings ────────────────────────────────────────────────────

const scheduleMeeting = async (req, res) => {
  try {
    const { title, date, time, link } = req.body;
    console.log('Request body:', req.body);

    const userName = req.session.username || req.session.userEmail;
    if (!userName) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const meetingTitle = safeTrim(title);
    const meetingTime = safeTrim(time);
    const meetingLink = safeTrim(link);
    const meetingDate = parseDateValue(date);

    if (!meetingTitle || !date || !meetingTime || !meetingLink) {
      return res.status(400).json({ success: false, message: 'Title, date, time, and meeting link are required' });
    }
    if (!meetingDate) {
      return res.status(400).json({ success: false, message: 'Invalid meeting date' });
    }
    if (!/^\d{2}:\d{2}$/.test(meetingTime)) {
      return res.status(400).json({ success: false, message: 'Invalid meeting time format (use HH:MM)' });
    }
    if (isPastDate(meetingDate)) {
      return res.status(400).json({ success: false, message: 'Date cannot be in the past' });
    }
    if (!isAllowedMeetingLink(meetingLink)) {
      return res.status(400).json({ success: false, message: 'Only Google Meet or Zoom links are allowed' });
    }

    const meeting = {
      title: meetingTitle,
      date: meetingDate,
      time: meetingTime,
      link: meetingLink,
      role: 'coordinator',
      name: userName.toString()
    };

    console.log('Meeting to insert:', meeting);

    const result = await (await connectDB()).collection('meetingsdb').insertOne(meeting);

    if (result.insertedId) {
      console.log('Meeting scheduled:', title);
      return res.json({ success: true, message: 'Meeting scheduled successfully' });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to schedule meeting' });
    }
  } catch (error) {
    console.error('Error scheduling meeting:', error);
    return res.status(500).json({ success: false, error: 'Failed to schedule meeting' });
  }
};

const getOrganizedMeetings = async (req, res) => {
  try {
    const db = await connectDB();
    const username = req.session.username || req.session.userEmail;
    const meetings = await db.collection('meetingsdb')
      .find({
        role: 'coordinator',
        name: username
      })
      .sort({ date: 1, time: 1 })
      .toArray();

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching organized meetings:', error);
    res.status(500).json({ error: 'Failed to fetch organized meetings' });
  }
};

const getUpcomingMeetings = async (req, res) => {
  try {
    const db = await connectDB();
    const today = new Date();
    const threeDaysLater = moment().add(3, 'days').toDate();
    const username = req.session.username || req.session.userEmail;

    const meetings = await db.collection('meetingsdb')
      .find({
        date: { $gte: today, $lte: threeDaysLater },
        name: { $ne: username }
      })
      .sort({ date: 1, time: 1 })
      .toArray();

    res.json(meetings);
  } catch (error) {
    console.error('Error fetching upcoming meetings:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming meetings' });
  }
};

// ── Player Stats & Enrolled Players ─────────────────────────────

const getPlayerStats = async (req, res) => {
  try {
    const db = await connectDB();

    const players = await db.collection('users').aggregate([
      {
        $match: {
          role: 'player',
          isDeleted: { $ne: 1 }
        }
      },
      {
        $lookup: {
          from: 'player_stats',
          let: {
            uid: '$_id',
            uidStr: { $toString: '$_id' }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$player_id', '$$uid'] },
                    {
                      $eq: [
                        { $convert: { input: '$player_id', to: 'string', onError: '', onNull: '' } },
                        '$$uidStr'
                      ]
                    }
                  ]
                }
              }
            },
            { $project: { wins: 1, losses: 1, draws: 1, gamesPlayed: 1, rating: 1 } },
            { $limit: 1 }
          ],
          as: 'stats'
        }
      },
      { $unwind: { path: '$stats', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          playerId: { $toString: '$_id' },
          name: {
            $ifNull: [
              '$name',
              {
                $ifNull: [
                  '$username',
                  {
                    $ifNull: [
                      { $arrayElemAt: [{ $split: ['$email', '@'] }, 0] },
                      'Unknown Player'
                    ]
                  }
                ]
              }
            ]
          },
          gamesPlayed: { $ifNull: ['$stats.gamesPlayed', 0] },
          wins: { $ifNull: ['$stats.wins', 0] },
          losses: { $ifNull: ['$stats.losses', 0] },
          draws: { $ifNull: ['$stats.draws', 0] },
          rating: { $ifNull: ['$stats.rating', 500] },
          college: { $ifNull: ['$college', 'N/A'] }
        }
      },
      { $sort: { rating: -1, name: 1 } }
    ]).toArray();

    const normalizedPlayers = (players || []).map((player) => ({
      ...player,
      playerId: player?.playerId ? String(player.playerId) : '',
      name: safeTrim(player?.name) || 'Unknown Player'
    }));

    return res.json({ players: normalizedPlayers });
  } catch (error) {
    console.error('Error fetching player stats:', error);
    return res.status(500).json({ error: 'Failed to fetch player stats' });
  }
};

const getPlayerStatsDetails = async (req, res) => {
  try {
    const { playerId } = req.params;
    if (!ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: 'Invalid player ID' });
    }

    const db = await connectDB();
    const playerObjectId = new ObjectId(playerId);
    const playerUser = await db.collection('users').findOne({
      _id: playerObjectId,
      role: 'player',
      isDeleted: { $ne: 1 }
    });

    if (!playerUser) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const playerName = safeTrim(playerUser.name || playerUser.username || (playerUser.email || '').split('@')[0]) || 'Unknown Player';

    const playerIdentifiers = Array.from(new Set([
      safeTrim(playerUser.name),
      safeTrim(playerUser.username),
      safeTrim((playerUser.email || '').split('@')[0])
    ].filter(Boolean)));
    const playerIdentifierSet = new Set(playerIdentifiers.map((value) => value.toLowerCase()));

    const exactRegexes = playerIdentifiers.map((value) => new RegExp(`^${escapeRegExp(value)}$`, 'i'));

    const [statsDoc, ratingDoc, individualEntries, teamEntries, pairingDocs] = await Promise.all([
      db.collection('player_stats').findOne({
        $or: [
          { player_id: playerObjectId },
          { player_id: String(playerObjectId) }
        ]
      }),
      db.collection('rating_history').findOne({
        $or: [
          { player_id: playerObjectId },
          { player_id: String(playerObjectId) }
        ]
      }),
      db.collection('tournament_players')
        .find(exactRegexes.length > 0 ? { $or: exactRegexes.map((rx) => ({ username: rx })) } : { _id: null })
        .project({ tournament_id: 1 })
        .toArray(),
      db.collection('enrolledtournaments_team')
        .find(exactRegexes.length > 0 ? {
          $or: exactRegexes.flatMap((rx) => ([
            { captain_name: rx },
            { player1_name: rx },
            { player2_name: rx },
            { player3_name: rx }
          ]))
        } : { _id: null })
        .project({ tournament_id: 1 })
        .toArray(),
      db.collection('tournament_pairings')
        .find({})
        .project({ tournament_id: 1, rounds: 1 })
        .toArray()
    ]);

    const summary = {
      gamesPlayed: Number(statsDoc?.gamesPlayed || 0),
      wins: Number(statsDoc?.wins || 0),
      losses: Number(statsDoc?.losses || 0),
      draws: Number(statsDoc?.draws || 0),
      rating: Number(statsDoc?.rating || 500)
    };

    let ratingProgression = Array.isArray(ratingDoc?.ratingHistory)
      ? ratingDoc.ratingHistory.map((point) => ({
          date: point?.date ? new Date(point.date) : null,
          rating: Number(point?.rating || 0)
        }))
      : [];

    ratingProgression = ratingProgression
      .filter((point) => point.date && !Number.isNaN(point.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((point) => ({
        date: point.date.toISOString().split('T')[0],
        rating: point.rating
      }));

    if (ratingProgression.length === 0) {
      ratingProgression = [{
        date: new Date().toISOString().split('T')[0],
        rating: summary.rating
      }];
    }

    const rawMatchHistory = [];
    const matchTournamentIdSet = new Set();
    const playerIdStr = String(playerObjectId);

    const normalizeId = (value) => {
      if (value == null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value.toString) return String(value);
      return String(value);
    };

    const parsePairingResult = (pairing) => {
      const player1Name = safeTrim(pairing?.player1?.username);
      const player2Name = safeTrim(pairing?.player2?.username);
      const player1Key = player1Name.toLowerCase();
      const player2Key = player2Name.toLowerCase();

      const player1Id = normalizeId(pairing?.player1?.id);
      const player2Id = normalizeId(pairing?.player2?.id);

      const isPlayer1 = playerIdentifierSet.has(player1Key) || player1Id === playerIdStr;
      const isPlayer2 = playerIdentifierSet.has(player2Key) || player2Id === playerIdStr;

      if (!isPlayer1 && !isPlayer2) return null;

      const resultCode = safeTrim(pairing?.resultCode).toLowerCase();
      const resultText = safeTrim(pairing?.result).toLowerCase();
      let result = 'pending';

      if (resultCode === '1-0' || resultText === '1-0') {
        result = isPlayer1 ? 'win' : 'loss';
      } else if (resultCode === '0-1' || resultText === '0-1') {
        result = isPlayer2 ? 'win' : 'loss';
      } else if (resultCode === '0.5-0.5' || resultText === 'draw') {
        result = 'draw';
      } else {
        const winnerMatch = safeTrim(pairing?.result).match(/^(.+)\s+wins$/i);
        if (winnerMatch) {
          const winner = safeTrim(winnerMatch[1]).toLowerCase();
          result = playerIdentifierSet.has(winner) ? 'win' : 'loss';
        }
      }

      return {
        opponent: isPlayer1 ? (player2Name || 'Unknown') : (player1Name || 'Unknown'),
        result,
        playerScore: Number(isPlayer1 ? pairing?.player1?.score : pairing?.player2?.score) || 0,
        opponentScore: Number(isPlayer1 ? pairing?.player2?.score : pairing?.player1?.score) || 0
      };
    };

    (pairingDocs || []).forEach((doc) => {
      const tournamentId = doc?.tournament_id ? String(doc.tournament_id) : '';
      if (!tournamentId) return;

      (doc.rounds || []).forEach((round) => {
        (round?.pairings || []).forEach((pairing) => {
          const parsed = parsePairingResult(pairing);
          if (!parsed) return;

          matchTournamentIdSet.add(tournamentId);
          rawMatchHistory.push({
            tournamentId,
            round: Number(round?.round || 0),
            ...parsed
          });
        });
      });
    });

    const participationTournamentIdSet = new Set();
    (individualEntries || []).forEach((entry) => {
      if (entry?.tournament_id) participationTournamentIdSet.add(String(entry.tournament_id));
    });
    (teamEntries || []).forEach((entry) => {
      if (entry?.tournament_id) participationTournamentIdSet.add(String(entry.tournament_id));
    });
    matchTournamentIdSet.forEach((id) => participationTournamentIdSet.add(id));

    const allTournamentObjectIds = Array.from(participationTournamentIdSet)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const tournaments = allTournamentObjectIds.length > 0
      ? await db.collection('tournaments')
        .find({ _id: { $in: allTournamentObjectIds } })
        .project({ name: 1, date: 1, status: 1, type: 1, location: 1 })
        .toArray()
      : [];

    const tournamentMap = new Map(tournaments.map((tournament) => [String(tournament._id), tournament]));

    let matchHistory = rawMatchHistory
      .map((match) => {
        const tournament = tournamentMap.get(match.tournamentId);
        const tournamentDate = tournament?.date ? new Date(tournament.date) : null;
        let matchDate = null;
        if (tournamentDate && !Number.isNaN(tournamentDate.getTime())) {
          matchDate = new Date(tournamentDate);
          matchDate.setHours(matchDate.getHours() + Math.max(match.round, 0));
        }

        return {
          date: matchDate ? matchDate.toISOString().split('T')[0] : '',
          tournamentId: match.tournamentId,
          tournamentName: tournament?.name || 'Tournament',
          round: match.round,
          opponent: match.opponent,
          result: match.result,
          playerScore: match.playerScore,
          opponentScore: match.opponentScore
        };
      })
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        if (dateA === dateB) return a.round - b.round;
        return dateA - dateB;
      });

    if (matchHistory.length === 0 && Number(summary.gamesPlayed || 0) > 0) {
      const winsLeft = Number(summary.wins || 0);
      const lossesLeft = Number(summary.losses || 0);
      const drawsLeft = Number(summary.draws || 0);
      const results = [
        ...Array(Math.max(0, winsLeft)).fill('win'),
        ...Array(Math.max(0, lossesLeft)).fill('loss'),
        ...Array(Math.max(0, drawsLeft)).fill('draw')
      ];
      const totalGames = Math.max(Number(summary.gamesPlayed || 0), results.length);
      const now = new Date();
      for (let i = 0; i < totalGames; i += 1) {
        const result = results[i] || 'draw';
        const d = new Date(now.getTime() - (totalGames - i) * 86400000);
        matchHistory.push({
          date: d.toISOString().split('T')[0],
          tournamentId: '',
          tournamentName: 'Recorded Game',
          round: i + 1,
          opponent: 'N/A',
          result,
          playerScore: result === 'win' ? 1 : result === 'draw' ? 0.5 : 0,
          opponentScore: result === 'loss' ? 1 : result === 'draw' ? 0.5 : 0
        });
      }
    }

    if (matchHistory.some((match) => !match.date)) {
      const now = new Date();
      matchHistory = matchHistory.map((match, index) => {
        if (match.date) return match;
        const fallback = new Date(now.getTime() - (matchHistory.length - index) * 86400000);
        return { ...match, date: fallback.toISOString().split('T')[0] };
      });
    }

    const computedSummary = matchHistory.reduce((acc, match) => {
      if (match.result === 'pending') return acc;
      acc.gamesPlayed += 1;
      if (match.result === 'win') acc.wins += 1;
      else if (match.result === 'loss') acc.losses += 1;
      else if (match.result === 'draw') acc.draws += 1;
      return acc;
    }, { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 });

    if (summary.gamesPlayed === 0 && computedSummary.gamesPlayed > 0) {
      summary.gamesPlayed = computedSummary.gamesPlayed;
      summary.wins = computedSummary.wins;
      summary.losses = computedSummary.losses;
      summary.draws = computedSummary.draws;
    }

    if ((!summary.rating || Number.isNaN(summary.rating)) && ratingProgression.length > 0) {
      summary.rating = Number(ratingProgression[ratingProgression.length - 1]?.rating || 500);
    }

    if (ratingProgression.length < 2 && matchHistory.length > 0) {
      const matchesForCurve = matchHistory.filter((m) => m.result !== 'pending');
      if (matchesForCurve.length > 0) {
        const totalDelta = matchesForCurve.reduce((sum, m) => {
          if (m.result === 'win') return sum + 10;
          if (m.result === 'loss') return sum - 10;
          return sum;
        }, 0);

        let running = Math.max(100, Number(summary.rating || 500) - totalDelta);
        const generated = [];
        matchesForCurve.forEach((match, idx) => {
          if (match.result === 'win') running += 10;
          else if (match.result === 'loss') running -= 10;
          generated.push({
            date: match.date || new Date(Date.now() - (matchesForCurve.length - idx) * 86400000).toISOString().split('T')[0],
            rating: Math.max(100, Math.round(running))
          });
        });
        ratingProgression = generated;
      }
    }

    if (ratingProgression.length === 0) {
      ratingProgression = [{
        date: new Date().toISOString().split('T')[0],
        rating: Number(summary.rating || 500)
      }];
    }

    const performanceByMonth = {};
    matchHistory.forEach((match) => {
      if (!match.date || match.result === 'pending') return;
      const monthKey = match.date.slice(0, 7);
      if (!performanceByMonth[monthKey]) {
        performanceByMonth[monthKey] = {
          month: monthKey,
          wins: 0,
          losses: 0,
          draws: 0,
          matches: 0
        };
      }
      if (match.result === 'win') performanceByMonth[monthKey].wins += 1;
      else if (match.result === 'loss') performanceByMonth[monthKey].losses += 1;
      else if (match.result === 'draw') performanceByMonth[monthKey].draws += 1;
      performanceByMonth[monthKey].matches += 1;
    });

    const performanceHistory = Object.values(performanceByMonth)
      .sort((a, b) => a.month.localeCompare(b.month));

    const tournamentsByStatus = {};
    tournaments.forEach((tournament) => {
      const status = safeTrim(tournament?.status || 'unknown').toLowerCase() || 'unknown';
      tournamentsByStatus[status] = (tournamentsByStatus[status] || 0) + 1;
    });

    const participationStats = {
      totalTournaments: participationTournamentIdSet.size,
      individualEntries: individualEntries.length,
      teamEntries: teamEntries.length,
      byStatus: tournamentsByStatus
    };

    return res.json({
      player: {
        playerId: String(playerUser._id),
        name: playerName,
        college: playerUser.college || 'N/A',
        email: playerUser.email || ''
      },
      summary,
      ratingProgression,
      matchHistory,
      performanceHistory,
      participationStats
    });
  } catch (error) {
    console.error('Error fetching player stats details:', error);
    return res.status(500).json({ error: 'Failed to fetch player details' });
  }
};

const getEnrolledPlayers = async (req, res) => {
  try {
    const tournamentId = req.query.tournament_id;
    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID is required' });
    }
    const db = await connectDB();
    const tid = new ObjectId(tournamentId);
    const tournament = await db.collection('tournaments').findOne({ _id: tid });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const individualPlayers = await db.collection('tournament_players').find({ tournament_id: tid }).toArray();
    const teamEnrollments = await db.collection('enrolledtournaments_team').aggregate([
      { $match: { tournament_id: tid } },
      { $lookup: { from: 'users', localField: 'captain_id', foreignField: '_id', as: 'captain' } },
      { $unwind: '$captain' },
      { $project: { player1_name: 1, player2_name: 1, player3_name: 1, player1_approved: 1, player2_approved: 1, player3_approved: 1, captain_name: '$captain.name' } }
    ]).toArray();
    res.json({
      tournamentName: tournament.name,
      tournamentType: tournament.type,
      individualPlayers: individualPlayers || [],
      teamEnrollments: teamEnrollments || []
    });
  } catch (error) {
    console.error('Error fetching enrolled players:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled players' });
  }
};

// ── Pairings & Rankings ─────────────────────────────────────────

const getPairings = async (req, res) => {
  const tournamentId = req.query.tournament_id;
  const totalRounds = parseInt(req.query.rounds) || 5;
  if (!tournamentId) {
    return res.status(400).json({ error: 'Tournament ID is required' });
  }

  const db = await connectDB();
  const rows = await db.collection('tournament_players').find({ tournament_id: new ObjectId(tournamentId) }).toArray();
  if (rows.length === 0) {
    return res.json({ roundNumber: 1, allRounds: [], message: 'No players enrolled' });
  }

  let storedPairings = await db.collection('tournament_pairings').findOne({ tournament_id: new ObjectId(tournamentId) });
  let allRounds;

  // Regenerate pairings if no stored data or player count mismatch
  if (!storedPairings || storedPairings.totalRounds !== totalRounds || rows.length !== (storedPairings.rounds[0]?.pairings?.length * 2 || 0) + (storedPairings.rounds[0]?.byePlayer ? 1 : 0)) {
    console.log(`Regenerating pairings for ${rows.length} players`);
    let players = rows.map(row => new Player(row._id, row.username, row.college, row.gender));
    allRounds = swissPairing(players, totalRounds);

    await db.collection('tournament_pairings').deleteOne({ tournament_id: new ObjectId(tournamentId) }); // Remove old pairings
    await db.collection('tournament_pairings').insertOne({
      tournament_id: new ObjectId(tournamentId),
      totalRounds: totalRounds,
      rounds: allRounds.map(round => ({
        round: round.round,
        pairings: round.pairings.map(pairing => ({
          player1: { id: pairing.player1.id, username: pairing.player1.username, score: pairing.player1.score },
          player2: { id: pairing.player2.id, username: pairing.player2.username, score: pairing.player2.score },
          result: pairing.result,
          resultCode: pairing.resultCode || null
        })),
        byePlayer: round.byePlayer ? {
          id: round.byePlayer.id,
          username: round.byePlayer.username,
          score: round.byePlayer.score
        } : null
      }))
    });

    // ── Sync player_stats after pairings generated ──
    // Aggregate wins/losses/draws per player from this tournament's results
    const playerStatsMap = {};
    for (const round of allRounds) {
      for (const pairing of round.pairings) {
        const p1 = pairing.player1.username;
        const p2 = pairing.player2.username;
        const code = pairing.resultCode || '';
        if (!playerStatsMap[p1]) playerStatsMap[p1] = { wins: 0, losses: 0, draws: 0 };
        if (!playerStatsMap[p2]) playerStatsMap[p2] = { wins: 0, losses: 0, draws: 0 };

        if (code === '1-0') {
          playerStatsMap[p1].wins++;
          playerStatsMap[p2].losses++;
        } else if (code === '0-1') {
          playerStatsMap[p2].wins++;
          playerStatsMap[p1].losses++;
        } else if (code === '0.5-0.5') {
          playerStatsMap[p1].draws++;
          playerStatsMap[p2].draws++;
        }
      }
    }
    // Update each player's cumulative stats in DB
    for (const [username, delta] of Object.entries(playerStatsMap)) {
      const playerUser = await db.collection('users').findOne({ name: username, role: 'player' });
      if (!playerUser) continue;
      await db.collection('player_stats').updateOne(
        { player_id: playerUser._id },
        {
          $inc: { wins: delta.wins, losses: delta.losses, draws: delta.draws, gamesPlayed: delta.wins + delta.losses + delta.draws },
          $setOnInsert: { rating: 500, winRate: 0 }
        },
        { upsert: true }
      );
      // Recalculate winRate
      const updatedStats = await db.collection('player_stats').findOne({ player_id: playerUser._id });
      if (updatedStats && updatedStats.gamesPlayed > 0) {
        const newWinRate = Math.round((updatedStats.wins / updatedStats.gamesPlayed) * 100);
        await db.collection('player_stats').updateOne(
          { player_id: playerUser._id },
          { $set: { winRate: newWinRate } }
        );
      }
    }
  } else {
    console.log('Using existing stored pairings');
    allRounds = storedPairings.rounds.map(round => {
      const pairings = round.pairings.map(pairing => {
        const player1 = new Player(pairing.player1.id, pairing.player1.username);
        player1.score = pairing.player1.score;
        const player2 = new Player(pairing.player2.id, pairing.player2.username);
        player2.score = pairing.player2.score;
        return { player1, player2, result: pairing.result };
      });
      const byePlayer = round.byePlayer ? new Player(round.byePlayer.id, round.byePlayer.username) : null;
      if (byePlayer) byePlayer.score = round.byePlayer.score;
      return { round: round.round, pairings, byePlayer };
    });
  }

  res.json({ roundNumber: totalRounds, allRounds });
};

const getRankings = async (req, res) => {
  try {
    const tournamentId = req.query.tournament_id;
    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID is required' });
    }
    const db = await connectDB();
    const tid = new ObjectId(tournamentId);
    const rows = await db.collection('tournament_players').find({ tournament_id: tid }).toArray();
    if (rows.length === 0) {
      return res.json({ rankings: [], tournamentId });
    }
    let storedPairings = await db.collection('tournament_pairings').findOne({ tournament_id: tid });
    let rankings = [];
    if (!storedPairings) {
      const totalRounds = 5;
      let players = rows.map(row => new Player(row._id, row.username, row.college, row.gender));
      const allRounds = swissPairing(players, totalRounds);
      await db.collection('tournament_pairings').insertOne({
        tournament_id: tid,
        totalRounds: totalRounds,
        rounds: allRounds.map(round => ({
          round: round.round,
          pairings: round.pairings.map(pairing => ({
            player1: {
              id: pairing.player1.id,
              username: pairing.player1.username,
              score: pairing.player1.score
            },
            player2: {
              id: pairing.player2.id,
              username: pairing.player2.username,
              score: pairing.player2.score
            },
            result: pairing.result
          })),
          byePlayer: round.byePlayer ? {
            id: round.byePlayer.id,
            username: round.byePlayer.username,
            score: round.byePlayer.score
          } : null
        }))
      });
      rankings = players.sort((a, b) => b.score - a.score).map((p, index) => ({
        rank: index + 1,
        playerName: p.username,
        score: p.score
      }));
    } else {
      let playersMap = new Map();
      rows.forEach(row => {
        playersMap.set(row._id.toString(), {
          id: row._id.toString(),
          username: row.username,
          score: 0
        });
      });
      storedPairings.rounds.forEach(round => {
        round.pairings.forEach(pairing => {
          const player1 = playersMap.get(pairing.player1.id.toString());
          const player2 = playersMap.get(pairing.player2.id.toString());
          if (player1) player1.score = pairing.player1.score;
          if (player2) player2.score = pairing.player2.score;
        });
        if (round.byePlayer) {
          const byePlayer = playersMap.get(round.byePlayer.id.toString());
          if (byePlayer) byePlayer.score = round.byePlayer.score;
        }
      });
      rankings = Array.from(playersMap.values())
        .sort((a, b) => b.score - a.score)
        .map((p, index) => ({
          rank: index + 1,
          playerName: p.username,
          score: p.score
        }));
    }
    res.json({ rankings, tournamentId });
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
};

const getTeamPairings = async (req, res) => {
  const tournamentId = req.query.tournament_id;
  const totalRounds = parseInt(req.query.rounds) || 5;
  if (!tournamentId) {
    return res.status(400).json({ error: 'Tournament ID is required' });
  }

  try {
    const db = await connectDB();
    const tid = new ObjectId(tournamentId);

    // Check tournament exists and is a team tournament
    const tournament = await db.collection('tournaments').findOne({ _id: tid });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournamentType = (tournament.type || '').toLowerCase();
    if (!['team', 'group'].includes(tournamentType)) {
      return res.status(400).json({ error: 'This is not a team tournament' });
    }

    // Get ONLY fully approved teams (all 3 members approved)
    const approvedTeams = await db.collection('enrolledtournaments_team').find({
      tournament_id: tid,
      approved: 1
    }).toArray();

    if (approvedTeams.length === 0) {
      return res.json({ roundNumber: 1, allRounds: [], message: 'No approved teams enrolled' });
    }

    let storedPairings = await db.collection('tournament_team_pairings').findOne({ tournament_id: tid });
    let allRounds;

    // Regenerate pairings if no stored data or team count mismatch
    const expectedTeamCount = storedPairings?.rounds?.[0]?.pairings?.length * 2 + (storedPairings?.rounds?.[0]?.byeTeam ? 1 : 0);
    if (!storedPairings || storedPairings.totalRounds !== totalRounds || approvedTeams.length !== expectedTeamCount) {
      console.log(`Regenerating team pairings for ${approvedTeams.length} teams`);

      // Create Team objects from approved enrollments
      let teams = approvedTeams.map(enrollment => new Team(
        enrollment._id,
        `Team ${enrollment.captain_name}`, // Team name = "Team CaptainName"
        enrollment.captain_name,
        enrollment.player1_name,
        enrollment.player2_name,
        enrollment.player3_name
      ));

      allRounds = swissTeamPairing(teams, totalRounds);

      await db.collection('tournament_team_pairings').deleteOne({ tournament_id: tid }); // Remove old pairings
      await db.collection('tournament_team_pairings').insertOne({
        tournament_id: tid,
        totalRounds: totalRounds,
        rounds: allRounds.map(round => ({
          round: round.round,
          pairings: round.pairings.map(pairing => ({
            team1: {
              id: pairing.team1.id,
              teamName: pairing.team1.teamName,
              captainName: pairing.team1.captainName,
              player1: pairing.team1.player1,
              player2: pairing.team1.player2,
              player3: pairing.team1.player3,
              score: pairing.team1.score
            },
            team2: {
              id: pairing.team2.id,
              teamName: pairing.team2.teamName,
              captainName: pairing.team2.captainName,
              player1: pairing.team2.player1,
              player2: pairing.team2.player2,
              player3: pairing.team2.player3,
              score: pairing.team2.score
            },
            result: pairing.result
          })),
          byeTeam: round.byeTeam ? {
            id: round.byeTeam.id,
            teamName: round.byeTeam.teamName,
            captainName: round.byeTeam.captainName,
            player1: round.byeTeam.player1,
            player2: round.byeTeam.player2,
            player3: round.byeTeam.player3,
            score: round.byeTeam.score
          } : null
        }))
      });
    } else {
      console.log('Using existing stored team pairings');
      allRounds = storedPairings.rounds.map(round => {
        const pairings = round.pairings.map(pairing => {
          const team1 = new Team(pairing.team1.id, pairing.team1.teamName, pairing.team1.captainName, pairing.team1.player1, pairing.team1.player2, pairing.team1.player3);
          team1.score = pairing.team1.score;
          const team2 = new Team(pairing.team2.id, pairing.team2.teamName, pairing.team2.captainName, pairing.team2.player1, pairing.team2.player2, pairing.team2.player3);
          team2.score = pairing.team2.score;
          return { team1, team2, result: pairing.result };
        });
        const byeTeam = round.byeTeam ? new Team(round.byeTeam.id, round.byeTeam.teamName, round.byeTeam.captainName, round.byeTeam.player1, round.byeTeam.player2, round.byeTeam.player3) : null;
        if (byeTeam) byeTeam.score = round.byeTeam.score;
        return { round: round.round, pairings, byeTeam };
      });
    }

    res.json({ roundNumber: totalRounds, allRounds, isTeamTournament: true });
  } catch (error) {
    console.error('Error fetching team pairings:', error);
    res.status(500).json({ error: 'Failed to fetch team pairings' });
  }
};

const getTeamRankings = async (req, res) => {
  try {
    const tournamentId = req.query.tournament_id;
    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament ID is required' });
    }
    const db = await connectDB();
    const tid = new ObjectId(tournamentId);

    // Check tournament exists and is a team tournament
    const tournament = await db.collection('tournaments').findOne({ _id: tid });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const tournamentType = (tournament.type || '').toLowerCase();
    if (!['team', 'group'].includes(tournamentType)) {
      return res.status(400).json({ error: 'This is not a team tournament' });
    }

    // Get approved teams
    const approvedTeams = await db.collection('enrolledtournaments_team').find({
      tournament_id: tid,
      approved: 1
    }).toArray();

    if (approvedTeams.length === 0) {
      return res.json({ rankings: [], tournamentId, isTeamTournament: true });
    }

    let storedPairings = await db.collection('tournament_team_pairings').findOne({ tournament_id: tid });
    let rankings = [];

    if (!storedPairings) {
      const totalRounds = 5;
      let teams = approvedTeams.map(enrollment => new Team(
        enrollment._id,
        `Team ${enrollment.captain_name}`,
        enrollment.captain_name,
        enrollment.player1_name,
        enrollment.player2_name,
        enrollment.player3_name
      ));

      const allRounds = swissTeamPairing(teams, totalRounds);
      await db.collection('tournament_team_pairings').insertOne({
        tournament_id: tid,
        totalRounds: totalRounds,
        rounds: allRounds.map(round => ({
          round: round.round,
          pairings: round.pairings.map(pairing => ({
            team1: {
              id: pairing.team1.id,
              teamName: pairing.team1.teamName,
              captainName: pairing.team1.captainName,
              player1: pairing.team1.player1,
              player2: pairing.team1.player2,
              player3: pairing.team1.player3,
              score: pairing.team1.score
            },
            team2: {
              id: pairing.team2.id,
              teamName: pairing.team2.teamName,
              captainName: pairing.team2.captainName,
              player1: pairing.team2.player1,
              player2: pairing.team2.player2,
              player3: pairing.team2.player3,
              score: pairing.team2.score
            },
            result: pairing.result
          })),
          byeTeam: round.byeTeam ? {
            id: round.byeTeam.id,
            teamName: round.byeTeam.teamName,
            captainName: round.byeTeam.captainName,
            player1: round.byeTeam.player1,
            player2: round.byeTeam.player2,
            player3: round.byeTeam.player3,
            score: round.byeTeam.score
          } : null
        }))
      });

      rankings = teams.sort((a, b) => b.score - a.score).map((t, index) => ({
        rank: index + 1,
        teamName: t.teamName,
        captainName: t.captainName,
        players: [t.player1, t.player2, t.player3],
        score: t.score
      }));
    } else {
      let teamsMap = new Map();
      approvedTeams.forEach(enrollment => {
        teamsMap.set(enrollment._id.toString(), {
          id: enrollment._id.toString(),
          teamName: `Team ${enrollment.captain_name}`,
          captainName: enrollment.captain_name,
          players: [enrollment.player1_name, enrollment.player2_name, enrollment.player3_name],
          score: 0
        });
      });

      storedPairings.rounds.forEach(round => {
        round.pairings.forEach(pairing => {
          const team1 = teamsMap.get(pairing.team1.id.toString());
          const team2 = teamsMap.get(pairing.team2.id.toString());
          if (team1) team1.score = pairing.team1.score;
          if (team2) team2.score = pairing.team2.score;
        });
        if (round.byeTeam) {
          const byeTeam = teamsMap.get(round.byeTeam.id.toString());
          if (byeTeam) byeTeam.score = round.byeTeam.score;
        }
      });

      rankings = Array.from(teamsMap.values())
        .sort((a, b) => b.score - a.score)
        .map((t, index) => ({
          rank: index + 1,
          teamName: t.teamName,
          captainName: t.captainName,
          players: t.players,
          score: t.score
        }));
    }

    res.json({ rankings, tournamentId, isTeamTournament: true });
  } catch (error) {
    console.error('Error fetching team rankings:', error);
    res.status(500).json({ error: 'Failed to fetch team rankings' });
  }
};

// ── Feedback ────────────────────────────────────────────────────

const requestFeedback = async (req, res) => {
  console.log('Route hit: /api/tournaments/:id/request-feedback', 'ID:', req.params.id, 'Session:', req.session);
  try {
    const tournamentId = req.params.id;
    if (!ObjectId.isValid(tournamentId)) {
      console.error('Invalid tournament ID:', tournamentId);
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const coordinator = req.session.username;
    console.log('Coordinator username:', coordinator);
    if (!coordinator) {
      console.error('No coordinator username in session');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const db = await connectDB();
    console.log('Database connected');
    const tid = new ObjectId(tournamentId);

    const tournament = await db.collection('tournaments').findOne({
      _id: tid,
      coordinator
    });
    console.log('Tournament found:', tournament);
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found or you are not authorized' });
    }

    // Allow feedback request once tournament has started (ongoing or completed)
    // Build start datetime from stored date + time (HH:MM expected)
    const tDate = new Date(tournament.date);
    const timeStr = (tournament.time || '').toString();
    const [hh, mm] = (timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00']);
    const start = new Date(tDate);
    start.setHours(parseInt(hh || '0', 10), parseInt(mm || '0', 10), 0, 0);
    const now = new Date();
    console.log('Tournament start:', start, 'Now:', now);
    if (now < start) {
      return res.status(400).json({ error: 'Feedback can be requested once the tournament starts' });
    }

    // Check if feedback was already requested
    if (tournament.feedback_requested) {
      return res.status(400).json({ error: 'Feedback already requested for this tournament' });
    }

    // Get all unique enrolled players
    const individualPlayers = await db.collection('tournament_players').find({ tournament_id: tid }).toArray();
    const teamEnrollments = await db.collection('enrolledtournaments_team').find({ tournament_id: tid }).toArray();
    console.log('Individual players:', individualPlayers.length, 'Team enrollments:', teamEnrollments.length);
    const playerUsernames = new Set([
      ...individualPlayers.map(p => p.username),
      ...teamEnrollments.flatMap(t => [t.player1_name, t.player2_name, t.player3_name].filter(Boolean))
    ]);
    const names = Array.from(playerUsernames).filter(Boolean);
    console.log('Player names extracted from enrollments:', names);

    // Get user_ids for players by name (case-insensitive exact match)
    const players = await db.collection('users').find({
      role: 'player',
      name: { $in: names }
    }).toArray();
    console.log('Players found in users collection:', players.length, 'Names:', players.map(p => p.name));
    const notifications = players.map(player => ({
      user_id: player._id,
      type: 'feedback_request',
      tournament_id: tid,
      read: false,
      date: new Date()
    }));

    // Insert notifications only if there are players
    if (notifications.length > 0) {
      await db.collection('notifications').insertMany(notifications);
      console.log('Notifications inserted:', notifications.length);
    } else {
      console.log('No players enrolled, skipping notification insertion');
    }

    // Update tournament regardless of notifications
    const result = await db.collection('tournaments').updateOne(
      { _id: tid },
      { $set: { feedback_requested: true } }
    );
    console.log('Update result:', result);

    if (result.modifiedCount > 0) {
      res.json({ success: true, message: 'Feedback requested successfully' });
    } else {
      res.status(400).json({ error: 'Failed to request feedback' });
    }
  } catch (error) {
    console.error('Error requesting feedback:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const getFeedbacks = async (req, res) => {
  try {
    const { tournament_id } = req.query;
    if (!tournament_id) return res.status(400).json({ error: 'Tournament ID required' });

    const db = await connectDB();
    const tid = new ObjectId(tournament_id);
    const feedbacks = await db.collection('feedbacks').find({ tournament_id: tid }).toArray();

    res.json({ feedbacks });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({ error: 'Failed to fetch feedbacks' });
  }
};

const getFeedbackView = async (req, res) => {
  if (!req.session.userEmail || req.session.userRole !== 'coordinator') {
    return res.redirect("/?error-message=Please log in as a coordinator");
  }
  const filePath = path.join(__dirname, '..', 'views', 'coordinator', 'feedback_view.html');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending feedback_view.html:', err);
      res.status(500).send('Error loading page');
    }
  });
};

// ── Notifications ─────────────────────────────────────────────────

const getNotifications = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinator = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!coordinator) return res.status(404).json({ error: 'Coordinator not found' });

    const notifications = await db.collection('notifications')
      .find({ user_id: coordinator._id })
      .sort({ date: -1 })
      .limit(50)
      .toArray();

    // Enrich with tournament names
    const tournamentIds = [...new Set(notifications.filter(n => n.tournament_id).map(n => n.tournament_id))];
    const tournaments = tournamentIds.length > 0
      ? await db.collection('tournaments').find({ _id: { $in: tournamentIds } }).toArray()
      : [];
    const tournamentMap = new Map(tournaments.map(t => [t._id.toString(), t.name]));

    const enriched = notifications.map(n => ({
      ...n,
      _id: n._id.toString(),
      tournament_name: n.tournament_id ? tournamentMap.get(n.tournament_id.toString()) || 'Unknown' : null
    }));

    res.json({ notifications: enriched });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinator = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!coordinator) return res.status(404).json({ error: 'Coordinator not found' });

    const { notificationIds } = req.body;
    const filter = { user_id: coordinator._id };
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      filter._id = { $in: notificationIds.map(id => new ObjectId(id)) };
    }

    await db.collection('notifications').updateMany(filter, { $set: { read: true } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications:', error);
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
};

// ── Profile Update ──────────────────────────────────────────────

const updateProfile = async (req, res) => {
  try {
    console.log('updateProfile called with body:', req.body);
    console.log('Session userEmail:', req.session?.userEmail);

    const db = await connectDB();
    const userEmail = req.session?.userEmail;
    if (!userEmail) {
      console.error('No userEmail in session');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const coordinator = await db.collection('users').findOne({ email: userEmail, role: 'coordinator' });
    if (!coordinator) {
      console.error('Coordinator not found for email:', userEmail);
      return res.status(404).json({ error: 'Coordinator not found' });
    }

    const body = req.body || {};
    const allowedFields = ['name', 'phone', 'college', 'dob', 'gender', 'AICF_ID', 'FIDE_ID'];
    const set = {};
    const unset = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'dob') {
          const rawDob = safeTrim(body[field]);
          if (!rawDob) {
            unset.dob = '';
            continue;
          }
          const date = new Date(rawDob);
          if (isNaN(date.getTime())) {
            console.error('Invalid date for dob:', body[field]);
            return res.status(400).json({ error: 'Invalid date format for dob' });
          }
          set.dob = date;
          continue;
        }

        if (field === 'name') {
          const name = safeTrim(body[field]);
          if (!name) {
            return res.status(400).json({ error: 'Name is required' });
          }
          set.name = name;
        } else {
          const value = safeTrim(body[field]);
          if (!value) {
            unset[field] = '';
          } else {
            set[field] = value;
          }
        }
      }
    }

    console.log('Set object:', set);
    console.log('Unset object:', unset);

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    set.updated_date = new Date();

    const updateDoc = { $set: set };
    if (Object.keys(unset).length > 0) {
      updateDoc.$unset = unset;
    }

    const result = await db.collection('users').updateOne({ _id: coordinator._id }, updateDoc);
    console.log('Update result:', result);

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: 'No changes made' });
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
};

// ── Tournament File Upload ──────────────────────────────────────

// ── Tournament File Upload ──────────────────────────────────────

// ── Calendar ────────────────────────────────────────────────────

// ── Complaints ──────────────────────────────────────────────────

// ── Store: Orders, Analytics, Edit, Delete ──────────────────────

// Duplicate functions removed (getOrderAnalytics, Blogs, Meetings, Announcements) - used newer versions at the end of file

// ── Tournament File Upload ──────────────────────────────────────

const uploadTournamentFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { id: tournamentId } = req.params;
    if (!ObjectId.isValid(tournamentId)) return res.status(400).json({ error: 'Invalid tournament ID' });

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) return res.status(401).json({ error: 'User not logged in' });
    const coordinatorEmail = req.session.username || user.name || req.session.userEmail;

    // Verify coordinator owns the tournament
    const tournament = await db.collection('tournaments').findOne({
      _id: new ObjectId(tournamentId),
      coordinator: coordinatorEmail
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found or access denied' });

    // Determine file type
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let fileType = 'document';
    if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension)) {
      fileType = 'image';
    } else if (fileExtension === '.pdf') {
      fileType = 'pdf';
    }

    // Upload to Cloudinary
    const result = await uploadImageBuffer(req.file.buffer, {
      folder: `tournaments/${tournamentId}`,
      resource_type: fileType === 'pdf' ? 'raw' : 'image',
      public_id: `${Date.now()}_${req.file.originalname}`,
      format: fileType === 'pdf' ? 'pdf' : undefined
    });

    // Save to database
    const fileDoc = {
      tournament_id: new ObjectId(tournamentId),
      file_name: req.file.originalname,
      file_url: result.secure_url,
      file_public_id: result.public_id,
      file_type: fileType,
      uploaded_by: coordinatorEmail,
      upload_date: new Date()
    };

    await db.collection('tournament_files').insertOne(fileDoc);
    res.json({ success: true, file: fileDoc });
  } catch (error) {
    console.error('Error uploading tournament file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

const getTournamentFiles = async (req, res) => {
  try {
    const { id: tournamentId } = req.params;
    if (!ObjectId.isValid(tournamentId)) return res.status(400).json({ error: 'Invalid tournament ID' });

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) return res.status(401).json({ error: 'User not logged in' });
    const coordinatorEmail = req.session.username || user.name || req.session.userEmail;

    // Verify coordinator owns the tournament
    const tournament = await db.collection('tournaments').findOne({
      _id: new ObjectId(tournamentId),
      coordinator: coordinatorEmail
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found or access denied' });

    const files = await db.collection('tournament_files')
      .find({ tournament_id: new ObjectId(tournamentId) })
      .sort({ upload_date: -1 })
      .toArray();

    // Map to expected frontend format
    const mappedFiles = files.map(file => ({
      _id: file._id.toString(),
      filename: file.file_name,
      url: file.file_url,
      upload_date: file.upload_date
    }));

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ files: mappedFiles });
  } catch (error) {
    console.error('Error fetching tournament files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

const deleteTournamentFile = async (req, res) => {
  try {
    const { tournamentId, fileId } = req.params;
    if (!ObjectId.isValid(tournamentId) || !ObjectId.isValid(fileId)) {
      return res.status(400).json({ error: 'Invalid tournament or file ID' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'coordinator'
    });
    if (!user) return res.status(401).json({ error: 'User not logged in' });
    const coordinatorEmail = req.session.username || user.name || req.session.userEmail;

    // Verify coordinator owns the tournament
    const tournament = await db.collection('tournaments').findOne({
      _id: new ObjectId(tournamentId),
      coordinator: coordinatorEmail
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found or access denied' });

    // Find and delete the file
    const file = await db.collection('tournament_files').findOne({
      _id: new ObjectId(fileId),
      tournament_id: new ObjectId(tournamentId)
    });
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Delete from Cloudinary if it exists
    if (file.file_public_id) {
      try {
        const resourceType = file.file_type === 'pdf' ? 'raw' : 'image';
        await cloudinary.uploader.destroy(file.file_public_id, { resource_type: resourceType });
      } catch (cloudinaryError) {
        console.warn('Failed to delete from Cloudinary:', cloudinaryError);
      }
    }

    // Delete from database
    await db.collection('tournament_files').deleteOne({ _id: new ObjectId(fileId) });

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting tournament file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

// ── Tournament Complaints ───────────────────────────────────────

function parseMaybeDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeComplaintRecord(rawComplaint, tournamentsById = new Map()) {
  const c = rawComplaint || {};
  const id = c._id ? c._id.toString() : undefined;
  const tournamentId = c.tournament_id ? c.tournament_id.toString() : '';
  const tournament = tournamentsById.get(tournamentId) || c.tournament || null;
  const createdAt =
    parseMaybeDate(c.created_at) ||
    parseMaybeDate(c.submitted_date) ||
    parseMaybeDate(c.createdAt);
  const resolvedAt =
    parseMaybeDate(c.resolved_date) ||
    parseMaybeDate(c.resolved_at) ||
    parseMaybeDate(c.responded_at) ||
    parseMaybeDate(c.respondedAt);
  const responseText = safeTrim(c.coordinator_response || c.response || c.reply);
  let status = safeTrim(c.status).toLowerCase();
  if (!status) status = responseText ? 'resolved' : 'pending';
  if (!['pending', 'resolved', 'dismissed'].includes(status)) {
    status = 'pending';
  }
  const description = safeTrim(c.complaint || c.message || c.description);
  const playerName = safeTrim(c.player_name || c.player?.name) || 'Unknown Player';
  const playerEmail = safeTrim(c.player_email || c.player?.email);

  return {
    _id: id,
    id,
    tournament_id: tournamentId,
    tournament: tournament
      ? {
          _id: tournament._id ? tournament._id.toString() : tournamentId,
          name: tournament.name || 'N/A'
        }
      : undefined,
    tournament_name: tournament?.name || safeTrim(c.tournament_name) || 'N/A',
    player_name: playerName,
    player_email: playerEmail,
    player: {
      name: playerName,
      email: playerEmail || undefined
    },
    subject: safeTrim(c.subject) || 'Tournament Complaint',
    message: description,
    complaint: description,
    description,
    status,
    reply: responseText,
    response: responseText,
    created_at: createdAt,
    createdAt,
    submitted_date: parseMaybeDate(c.submitted_date) || createdAt,
    responded_at: parseMaybeDate(c.responded_at) || parseMaybeDate(c.respondedAt) || resolvedAt,
    respondedAt: parseMaybeDate(c.respondedAt) || parseMaybeDate(c.responded_at) || resolvedAt,
    resolved_at: parseMaybeDate(c.resolved_at) || parseMaybeDate(c.resolved_date) || null,
    resolved_date: parseMaybeDate(c.resolved_date) || parseMaybeDate(c.resolved_at) || null
  };
}

async function findCoordinatorComplaint(db, session, complaintId) {
  const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, session);
  const ownerIdentifiersLower = new Set(ownerIdentifiers.map((v) => v.toLowerCase()));
  const objectId = new ObjectId(complaintId);

  for (const collectionName of ['tournament_complaints', 'complaints']) {
    const complaint = await db.collection(collectionName).findOne({ _id: objectId });
    if (!complaint) continue;

    if (!complaint.tournament_id) {
      return { error: 'Complaint tournament is missing', status: 404 };
    }

    let tournamentId = complaint.tournament_id;
    if (typeof tournamentId === 'string' && ObjectId.isValid(tournamentId)) {
      tournamentId = new ObjectId(tournamentId);
    }

    const tournament = await db.collection('tournaments').findOne({ _id: tournamentId });
    if (!tournament) {
      return { error: 'Complaint tournament not found', status: 404 };
    }

    const coordinatorValue = safeTrim(tournament.coordinator).toLowerCase();
    if (!ownerIdentifiersLower.has(coordinatorValue)) {
      return { error: 'Complaint not found or access denied', status: 404 };
    }

    return { collectionName, complaint, tournament };
  }

  return { error: 'Complaint not found or access denied', status: 404 };
}

const getComplaints = async (req, res) => {
  try {
    const db = await connectDB();
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);

    let tournaments = await db.collection('tournaments')
      .find({ coordinator: { $in: ownerIdentifiers } })
      .project({ _id: 1, name: 1, coordinator: 1 })
      .toArray();

    // Fallback for older records where coordinator value casing/format differs.
    if (tournaments.length === 0) {
      const ownerIdentifiersLower = new Set(ownerIdentifiers.map((v) => v.toLowerCase()));
      const allTournaments = await db.collection('tournaments')
        .find({})
        .project({ _id: 1, name: 1, coordinator: 1 })
        .toArray();
      tournaments = allTournaments.filter((t) =>
        ownerIdentifiersLower.has(safeTrim(t.coordinator).toLowerCase())
      );
    }

    const tournamentIds = tournaments.map((t) => t._id);
    const tournamentIdStrings = tournamentIds.map((t) => t.toString());
    const tournamentsById = new Map(tournaments.map((t) => [t._id.toString(), t]));

    if (tournamentIds.length === 0) {
      return res.json({ complaints: [] });
    }

    const [tournamentComplaints, legacyComplaints] = await Promise.all([
      db.collection('tournament_complaints')
        .find({
          $or: [
            { tournament_id: { $in: tournamentIds } },
            { tournament_id: { $in: tournamentIdStrings } }
          ]
        })
        .sort({ submitted_date: -1, created_at: -1 })
        .toArray(),
      db.collection('complaints')
        .find({
          $or: [
            { tournament_id: { $in: tournamentIds } },
            { tournament_id: { $in: tournamentIdStrings } }
          ]
        })
        .sort({ created_at: -1, submitted_date: -1 })
        .toArray()
    ]);

    const complaints = [
      ...(tournamentComplaints || []).map((c) => normalizeComplaintRecord(c, tournamentsById)),
      ...(legacyComplaints || []).map((c) => normalizeComplaintRecord(c, tournamentsById))
    ].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return res.json({ complaints });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return res.status(500).json({ error: 'Failed to fetch complaints' });
  }
};

const resolveComplaint = async (req, res) => {
  try {
    const complaintId = req.params.complaintId || req.params.id;
    const responseText = safeTrim(req.body?.response || req.body?.reply);

    if (!ObjectId.isValid(complaintId)) return res.status(400).json({ error: 'Invalid complaint ID' });

    const db = await connectDB();
    const complaintContext = await findCoordinatorComplaint(db, req.session, complaintId);
    if (complaintContext.error) {
      return res.status(complaintContext.status || 404).json({ error: complaintContext.error });
    }

    const now = new Date();
    const setFields = {
      status: 'resolved',
      resolved_date: now,
      resolved_at: now
    };
    if (responseText) {
      setFields.coordinator_response = responseText;
      setFields.response = responseText;
      setFields.reply = responseText;
      setFields.respondedAt = now;
      setFields.responded_at = now;
    }

    await db.collection(complaintContext.collectionName).updateOne(
      { _id: new ObjectId(complaintId) },
      { $set: setFields }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    return res.status(500).json({ error: 'Failed to resolve complaint' });
  }
};

const respondComplaint = async (req, res) => {
  try {
    const complaintId = req.params.complaintId || req.params.id;
    const responseText = safeTrim(req.body?.response || req.body?.reply);

    if (!ObjectId.isValid(complaintId)) return res.status(400).json({ error: 'Invalid complaint ID' });
    if (!responseText) return res.status(400).json({ error: 'Response is required' });

    const db = await connectDB();
    const complaintContext = await findCoordinatorComplaint(db, req.session, complaintId);
    if (complaintContext.error) {
      return res.status(complaintContext.status || 404).json({ error: complaintContext.error });
    }

    const now = new Date();
    const setFields = {
      coordinator_response: responseText,
      response: responseText,
      reply: responseText,
      respondedAt: now,
      responded_at: now
    };

    await db.collection(complaintContext.collectionName).updateOne(
      { _id: new ObjectId(complaintId) },
      { $set: setFields }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Error responding to complaint:', error);
    return res.status(500).json({ error: 'Failed to respond to complaint' });
  }
};

// ── Calendar ────────────────────────────────────────────────────

const getCalendarEvents = async (req, res) => {
  try {
    const { all, year, month } = req.query;
    const db = await connectDB();
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);
    const ownerIdentifiersLower = ownerIdentifiers.map((v) => v.toLowerCase());
    const includeAll = all === 'true';

    const yearNum = Number.parseInt(year, 10);
    const monthNum = Number.parseInt(month, 10);
    let rangeStart = null;
    let rangeEnd = null;
    if (!Number.isNaN(yearNum) && !Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      rangeStart = new Date(yearNum, monthNum - 1, 1);
      rangeEnd = new Date(yearNum, monthNum, 1);
    }

    const tournamentQuery = {
      status: { $nin: ['Removed', 'Rejected'] }
    };
    if (rangeStart && rangeEnd) {
      tournamentQuery.date = { $gte: rangeStart, $lt: rangeEnd };
    }
    if (!includeAll) {
      tournamentQuery.coordinator = { $in: ownerIdentifiers };
    }

    const meetingQuery = { role: 'coordinator' };
    if (rangeStart && rangeEnd) {
      meetingQuery.date = { $gte: rangeStart, $lt: rangeEnd };
    }
    if (!includeAll) {
      meetingQuery.$or = [
        { name: { $in: ownerIdentifiers } },
        { created_by: { $in: ownerIdentifiers } }
      ];
    }

    const announcementQuery = { is_active: { $ne: false } };
    if (rangeStart && rangeEnd) {
      announcementQuery.posted_date = { $gte: rangeStart, $lt: rangeEnd };
    }
    if (!includeAll) {
      announcementQuery.posted_by = { $in: ownerIdentifiers };
    }

    const [tournaments, meetings, announcements, chessEvents] = await Promise.all([
      db.collection('tournaments')
        .find(tournamentQuery)
        .project({
          name: 1,
          date: 1,
          time: 1,
          location: 1,
          description: 1,
          status: 1,
          type: 1,
          coordinator: 1
        })
        .toArray(),
      db.collection('meetingsdb')
        .find(meetingQuery)
        .project({
          title: 1,
          description: 1,
          date: 1,
          time: 1,
          link: 1,
          type: 1,
          name: 1,
          created_by: 1
        })
        .toArray(),
      db.collection('announcements')
        .find(announcementQuery)
        .project({
          title: 1,
          message: 1,
          posted_date: 1,
          posted_by: 1,
          target_role: 1,
          is_active: 1
        })
        .toArray(),
      db.collection('chess_events')
        .find(rangeStart && rangeEnd ? { date: { $gte: rangeStart, $lt: rangeEnd } } : {})
        .project({
          title: 1,
          description: 1,
          date: 1,
          category: 1,
          location: 1,
          link: 1,
          coordinatorName: 1,
          coordinatorId: 1,
          active: 1
        })
        .toArray()
    ]);

    const mappedTournaments = tournaments.map((t) => ({
      ...t,
      _id: t._id.toString(),
      title: t.name || 'Tournament',
      description: t.description || (t.location ? `Location: ${t.location}` : ''),
      type: 'tournament',
      source: 'tournament',
      isMine: ownerIdentifiersLower.includes(String(t.coordinator || '').trim().toLowerCase())
    }));

    const mappedMeetings = meetings.map((m) => ({
      ...m,
      _id: m._id.toString(),
      type: safeTrim(m.type || 'meeting').toLowerCase() || 'meeting',
      source: 'meeting',
      isMine: ownerIdentifiersLower.includes(String(m.name || m.created_by || '').trim().toLowerCase())
    }));

    const mappedAnnouncements = (announcements || []).map((a) => ({
      ...a,
      _id: a._id.toString(),
      title: safeTrim(a.title) || 'Announcement',
      description: safeTrim(a.message),
      date: a.posted_date || new Date(),
      type: 'announcement',
      source: 'announcement',
      isMine: ownerIdentifiersLower.includes(String(a.posted_by || '').trim().toLowerCase())
    }));

    const mappedChessEvents = (chessEvents || [])
      .filter((ev) => ev?.active !== false)
      .map((ev) => {
        const ownerKey = String(ev.coordinatorName || ev.coordinatorId || '').trim().toLowerCase();
        return {
          ...ev,
          _id: ev._id.toString(),
          date: ev.date || new Date(),
          time: ev.time || '',
          type: 'chess event',
          source: 'chess_event',
          isMine: ownerIdentifiersLower.includes(ownerKey)
        };
      });

    const events = [
      ...mappedTournaments,
      ...mappedMeetings,
      ...mappedAnnouncements,
      ...mappedChessEvents
    ]
      .filter((event) => includeAll || event.isMine)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({
      events,
      tournaments: mappedTournaments,
      meetings: mappedMeetings,
      announcements: mappedAnnouncements,
      chessEvents: mappedChessEvents
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
};

const createCalendarEvent = async (req, res) => {
  try {
    const { title, description, date, time, type, link } = req.body || {};
    const eventTitle = safeTrim(title);
    const eventDescription = safeTrim(description);
    const eventTime = safeTrim(time);
    const eventType = safeTrim(type).toLowerCase() || 'meeting';
    const eventLink = safeTrim(link);

    if (!eventTitle || !date || !eventTime) {
      return res.status(400).json({ success: false, message: 'Title, date, and time are required' });
    }
    if (!/^\d{2}:\d{2}$/.test(eventTime)) {
      return res.status(400).json({ success: false, message: 'Invalid time format (use HH:MM)' });
    }

    const eventDate = parseDateValue(date);
    if (!eventDate) {
      return res.status(400).json({ success: false, message: 'Invalid event date' });
    }
    if (isPastDate(eventDate)) {
      return res.status(400).json({ success: false, message: 'Date cannot be in the past' });
    }

    const allowedTypes = new Set(['meeting', 'tournament', 'announcement', 'deadline', 'reminder', 'other']);
    const normalizedType = allowedTypes.has(eventType) ? eventType : 'meeting';

    if (eventLink && normalizedType === 'meeting' && !isAllowedMeetingLink(eventLink)) {
      return res.status(400).json({ success: false, message: 'Only Google Meet or Zoom links are allowed for meetings' });
    }

    const coordinatorEmail = safeTrim(req.session.userEmail);
    const coordinatorName = safeTrim(req.session.username || req.session.userEmail);
    if (!coordinatorEmail || !coordinatorName) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const eventDoc = {
      title: eventTitle,
      description: eventDescription,
      date: eventDate,
      time: eventTime,
      link: eventLink || '',
      type: normalizedType,
      role: 'coordinator',
      name: coordinatorName,
      created_by: coordinatorEmail,
      created_date: new Date()
    };

    const db = await connectDB();
    const result = await db.collection('meetingsdb').insertOne(eventDoc);

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      event: {
        ...eventDoc,
        _id: result.insertedId.toString()
      }
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return res.status(500).json({ success: false, error: 'Failed to create event' });
  }
};

const deleteCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID' });
    }

    const db = await connectDB();
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);

    const deleteResult = await db.collection('meetingsdb').deleteOne({
      _id: new ObjectId(id),
      role: 'coordinator',
      $or: [
        { name: { $in: ownerIdentifiers } },
        { created_by: { $in: ownerIdentifiers } }
      ]
    });

    if (deleteResult.deletedCount > 0) {
      return res.json({ success: true, message: 'Event deleted successfully' });
    }

    const tournament = await db.collection('tournaments').findOne({
      _id: new ObjectId(id),
      coordinator: { $in: ownerIdentifiers }
    });
    if (tournament) {
      return res.status(400).json({
        success: false,
        message: 'Tournament events cannot be deleted from calendar. Use Tournament Management.'
      });
    }

    return res.status(404).json({ success: false, message: 'Event not found or access denied' });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
};

const checkDateConflict = async (req, res) => {
  try {
    const payload = (req.method === 'GET' ? req.query : req.body) || {};
    const { date, excludeTournamentId } = payload;
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const targetDate = parseDateValue(date);
    if (!targetDate) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const db = await connectDB();
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);

    let query = {
      coordinator: { $in: ownerIdentifiers },
      date: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: ['Removed', 'Rejected', 'Completed'] }
    };

    if (excludeTournamentId && ObjectId.isValid(excludeTournamentId)) {
      query._id = { $ne: new ObjectId(excludeTournamentId) };
    }

    const conflictingTournament = await db.collection('tournaments').findOne(query);

    let conflict = false;
    let conflictDetails = null;

    if (conflictingTournament) {
      conflict = true;
      conflictDetails = {
        type: 'tournament',
        name: conflictingTournament.name,
        time: conflictingTournament.time
      };
    }

    res.json({ conflict, conflictDetails });
  } catch (error) {
    console.error('Error checking date conflict:', error);
    res.status(500).json({ error: 'Failed to check date conflict' });
  }
};

// ── Store Management ────────────────────────────────────────────

const updateProduct = async (req, res) => {
  try {
    const productId = req.params.productId || req.params.id;
    const updates = req.body;

    if (!ObjectId.isValid(productId)) return res.status(400).json({ error: 'Invalid product ID' });

    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    // Verify coordinator owns the product
    const product = await db.collection('products').findOne({
      _id: new ObjectId(productId),
      coordinator: coordinatorEmail
    });
    if (!product) return res.status(404).json({ error: 'Product not found or access denied' });

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.coordinator;
    delete updates.college;

    await db.collection('products').updateOne(
      { _id: new ObjectId(productId) },
      { $set: updates }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.productId || req.params.id;
    if (!ObjectId.isValid(productId)) return res.status(400).json({ error: 'Invalid product ID' });

    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    // Verify coordinator owns the product
    const product = await db.collection('products').findOne({
      _id: new ObjectId(productId),
      coordinator: coordinatorEmail
    });
    if (!product) return res.status(404).json({ error: 'Product not found or access denied' });

    // Delete associated image(s) from Cloudinary
    const publicIds = Array.isArray(product.image_public_ids)
      ? product.image_public_ids
      : (product.image_public_id ? [product.image_public_id] : []);
    for (const pid of publicIds) {
      try {
        await destroyImage(pid);
      } catch (e) {
        console.warn('Failed deleting product image from Cloudinary:', pid, e.message);
      }
    }

    await db.collection('products').deleteOne({ _id: new ObjectId(productId) });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

const toggleComments = async (req, res) => {
  try {
    const productId = req.params.productId || req.params.id;
    if (!ObjectId.isValid(productId)) return res.status(400).json({ error: 'Invalid product ID' });

    const db = await connectDB();
    const ownerCandidates = await getCoordinatorOwnerCandidates(db, req.session);
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const productOwner = String(product.coordinator || '').trim().toLowerCase();
    if (!ownerCandidates.includes(productOwner)) {
      return res.status(403).json({ error: 'Product not found or access denied' });
    }

    const nextValue = !Boolean(product.comments_enabled);

    await db.collection('products').updateOne(
      { _id: new ObjectId(productId) },
      { $set: { comments_enabled: nextValue } }
    );

    res.json({ success: true, comments_enabled: nextValue });
  } catch (error) {
    console.error('Error toggling comments:', error);
    res.status(500).json({ error: 'Failed to toggle comments' });
  }
};

const getOrders = async (req, res) => {
  try {
    const db = await connectDB();
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);
    const ownerRegexes = ownerIdentifiers.map((value) => new RegExp(`^${escapeRegExp(value)}$`, 'i'));
    if (ownerRegexes.length === 0) {
      return res.json({ orders: [] });
    }

    const products = await db.collection('products')
      .find({ coordinator: { $in: ownerRegexes } })
      .project({ _id: 1 })
      .toArray();

    const productIdStrings = products
      .map((product) => product?._id)
      .filter(Boolean)
      .map((id) => id.toString());
    if (productIdStrings.length === 0) {
      return res.json({ orders: [] });
    }

    const orders = await db.collection('orders')
      .aggregate([
        {
          $addFields: {
            coordinator_items: {
              $filter: {
                input: { $ifNull: ['$items', []] },
                as: 'item',
                cond: {
                  $in: [{ $toString: '$$item.productId' }, productIdStrings]
                }
              }
            }
          }
        },
        {
          $match: {
            $expr: { $gt: [{ $size: '$coordinator_items' }, 0] }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_email',
            foreignField: 'email',
            as: 'user'
          }
        },
        {
          $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
        },
        {
          $sort: { createdAt: -1 }
        }
      ])
      .toArray();
    const normalizedOrders = (orders || []).map((o) => ({
      _id: o._id ? o._id.toString() : '',
      user: o.user || null,
      user_email: o.user_email || '',
      items: Array.isArray(o.coordinator_items) ? o.coordinator_items : [],
      totalAmount: Number(o.totalAmount ?? o.total ?? 0),
      coordinatorAmount: Number((Array.isArray(o.coordinator_items) ? o.coordinator_items : []).reduce(
        (sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 1)),
        0
      )),
      createdAt: o.createdAt || o.created_date || new Date(),
      status: normalizeOrderStatus(o.status)
    }));

    res.json({ orders: normalizedOrders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId || req.params.id;
    const { status, trackingNumber, deliveryPartner } = req.body;

    if (!ObjectId.isValid(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

    const db = await connectDB();
    const requestedStatus = safeTrim(status).toLowerCase();
    if (!requestedStatus) {
      return res.status(400).json({ error: 'Status is required' });
    }
    if (!PLAYER_ORDER_STATUSES.includes(requestedStatus)) {
      return res.status(400).json({ error: `Invalid status value. Allowed values: ${PLAYER_ORDER_STATUSES.join(', ')}` });
    }

    // Verify coordinator has products in this order
    const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const productIdStrings = (order.items || [])
      .map((item) => item?.productId)
      .filter(Boolean)
      .map((pid) => pid.toString());
    const productObjectIds = productIdStrings
      .filter((pid) => ObjectId.isValid(pid))
      .map((pid) => new ObjectId(pid));

    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);
    const ownerRegexes = ownerIdentifiers.map((value) => new RegExp(`^${escapeRegExp(value)}$`, 'i'));

    const coordinatorProducts = await db.collection('products')
      .find({
        _id: { $in: productObjectIds },
        coordinator: { $in: ownerRegexes }
      })
      .toArray();

    if (coordinatorProducts.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const currentStatus = normalizeOrderStatus(order.status);
    if (['delivered', 'cancelled'].includes(currentStatus)) {
      return res.status(400).json({ error: `Order is already ${currentStatus} and cannot be updated` });
    }

    const allowedTransitions = getAllowedOrderStatusTransitions(currentStatus);
    if (!allowedTransitions.includes(requestedStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from "${currentStatus}" to "${requestedStatus}"`,
        allowedNextStatuses: allowedTransitions
      });
    }

    const normalizedStatus = normalizeOrderStatus(requestedStatus);

    const updateData = { status: normalizedStatus };
    const now = new Date();

    if (normalizedStatus === 'processing') updateData.processing_date = now;
    else if (normalizedStatus === 'packed') updateData.packed_date = now;
    else if (normalizedStatus === 'shipped') {
      updateData.shipped_date = now;
      if (trackingNumber) updateData.tracking_number = trackingNumber;
      if (deliveryPartner) updateData.delivery_partner = deliveryPartner;
    } else if (normalizedStatus === 'delivered') updateData.delivered_date = now;
    else if (normalizedStatus === 'cancelled') updateData.cancelledAt = now;

    await db.collection('orders').updateOne(
      { _id: new ObjectId(orderId) },
      { $set: updateData }
    );

    res.json({ success: true, status: normalizedStatus });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

const getOrderAnalytics = async (req, res) => {
  try {
    const db = await connectDB();
    const emptyAnalytics = {
      mostSoldProduct: null,
      totalRevenue: 0,
      monthlyRevenue: [],
      productRevenue: [],
      customerLogs: []
    };

    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);
    const ownerRegexes = ownerIdentifiers.map((value) => new RegExp(`^${escapeRegExp(value)}$`, 'i'));
    if (ownerRegexes.length === 0) {
      return res.json(emptyAnalytics);
    }

    const products = await db.collection('products')
      .find({ coordinator: { $in: ownerRegexes } })
      .project({ _id: 1 })
      .toArray();

    const productIds = (products || []).map((p) => p?._id).filter(Boolean);
    if (productIds.length === 0) {
      return res.json(emptyAnalytics);
    }
    const productIdStrings = productIds.map((id) => id.toString());

    const salesMatch = {
      $or: [
        { product_id: { $in: productIds } },
        { productId: { $in: productIds } },
        {
          $expr: {
            $in: [{ $toString: { $ifNull: ['$product_id', '$productId'] } }, productIdStrings]
          }
        }
      ]
    };

    const priceAsNumber = {
      $convert: {
        input: '$price',
        to: 'double',
        onError: 0,
        onNull: 0
      }
    };
    const quantityAsNumber = {
      $convert: {
        input: { $ifNull: ['$quantity', 1] },
        to: 'double',
        onError: 1,
        onNull: 1
      }
    };

    const purchaseDate = {
      $convert: {
        input: { $ifNull: ['$purchase_date', '$createdAt'] },
        to: 'date',
        onError: '$$NOW',
        onNull: '$$NOW'
      }
    };

    const mostSoldProduct = await db.collection('sales')
      .aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: { $toString: { $ifNull: ['$product_id', '$productId'] } },
            totalSold: { $sum: quantityAsNumber },
            totalRevenue: { $sum: priceAsNumber }
          }
        },
        {
          $addFields: {
            productObjectId: {
              $convert: {
                input: '$_id',
                to: 'objectId',
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productObjectId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $sort: { totalSold: -1, totalRevenue: -1 } },
        { $limit: 1 }
      ])
      .toArray();

    const totalRevenueResult = await db.collection('sales')
      .aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: null,
            total: { $sum: priceAsNumber }
          }
        }
      ])
      .toArray();
    const totalRevenue = totalRevenueResult.length > 0 ? Number(totalRevenueResult[0].total || 0) : 0;

    const monthlyRevenue = await db.collection('sales')
      .aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: {
              year: { $year: purchaseDate },
              month: { $month: purchaseDate }
            },
            revenue: { $sum: priceAsNumber }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
      .toArray();

    const productRevenue = await db.collection('sales')
      .aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: { $toString: { $ifNull: ['$product_id', '$productId'] } },
            revenue: { $sum: priceAsNumber },
            sold: { $sum: quantityAsNumber }
          }
        },
        {
          $addFields: {
            productObjectId: {
              $convert: {
                input: '$_id',
                to: 'objectId',
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productObjectId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $sort: { revenue: -1 } }
      ])
      .toArray();

    const customerLogs = await db.collection('sales')
      .aggregate([
        { $match: salesMatch },
        {
          $lookup: {
            from: 'users',
            localField: 'buyer_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$buyer', 'Customer'] },
            totalPurchases: { $sum: quantityAsNumber },
            totalSpent: { $sum: priceAsNumber },
            lastPurchase: { $max: purchaseDate },
            user: { $first: '$user' }
          }
        },
        { $sort: { totalSpent: -1 } }
      ])
      .toArray();

    return res.json({
      mostSoldProduct: mostSoldProduct[0] || null,
      totalRevenue,
      monthlyRevenue,
      productRevenue,
      customerLogs: (customerLogs || []).map((c) => ({
        ...c,
        name: c?.user?.name || c?._id || 'Customer',
        email: c?.user?.email || ''
      }))
    });
  } catch (error) {
    console.error('Error fetching order analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// ── Blogs ───────────────────────────────────────────────────────

const getProductAnalyticsDetails = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const db = await connectDB();
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(db, req.session);
    const ownerRegexes = ownerIdentifiers.map((value) => new RegExp(`^${escapeRegExp(value)}$`, 'i'));

    const product = await db.collection('products').findOne({
      _id: new ObjectId(productId),
      coordinator: { $in: ownerRegexes }
    });
    if (!product) {
      return res.status(404).json({ error: 'Product not found or access denied' });
    }

    const productObjectId = new ObjectId(productId);

    const orderRows = await db.collection('orders')
      .aggregate([
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
        {
          $match: {
            $or: [
              { 'items.productId': productObjectId },
              { 'items.productId': productId },
              {
                $expr: {
                  $eq: [{ $toString: '$items.productId' }, productId]
                }
              }
            ]
          }
        },
        {
          $project: {
            orderDate: { $ifNull: ['$createdAt', '$created_date'] },
            quantity: {
              $convert: {
                input: { $ifNull: ['$items.quantity', 1] },
                to: 'double',
                onError: 0,
                onNull: 0
              }
            },
            unitPrice: {
              $convert: {
                input: { $ifNull: ['$items.price', 0] },
                to: 'double',
                onError: 0,
                onNull: 0
              }
            }
          }
        }
      ])
      .toArray();

    const salesRows = await db.collection('sales')
      .aggregate([
        {
          $match: {
            $or: [
              { product_id: productObjectId },
              { product_id: productId },
              { productId: productObjectId },
              { productId: productId },
              {
                $expr: {
                  $eq: [{ $toString: { $ifNull: ['$product_id', '$productId'] } }, productId]
                }
              }
            ]
          }
        },
        {
          $project: {
            quantity: {
              $convert: {
                input: { $ifNull: ['$quantity', 1] },
                to: 'double',
                onError: 1,
                onNull: 1
              }
            },
            revenue: {
              $convert: {
                input: { $ifNull: ['$price', 0] },
                to: 'double',
                onError: 0,
                onNull: 0
              }
            },
            saleDate: {
              $convert: {
                input: { $ifNull: ['$purchase_date', '$createdAt'] },
                to: 'date',
                onError: null,
                onNull: null
              }
            }
          }
        }
      ])
      .toArray();

    const totals = { unitsSold: 0, totalRevenue: 0 };
    const dateWiseMap = {};

    orderRows.forEach((row) => {
      const qty = Number(row?.quantity || 0);
      const price = Number(row?.unitPrice || 0);
      const revenue = qty * price;
      totals.unitsSold += qty;
      totals.totalRevenue += revenue;

      const rowDate = row?.orderDate ? new Date(row.orderDate) : null;
      const dateKey = rowDate && !Number.isNaN(rowDate.getTime())
        ? rowDate.toISOString().split('T')[0]
        : 'Unknown';

      if (!dateWiseMap[dateKey]) {
        dateWiseMap[dateKey] = {
          date: dateKey,
          unitsSold: 0,
          revenue: 0
        };
      }
      dateWiseMap[dateKey].unitsSold += qty;
      dateWiseMap[dateKey].revenue += revenue;
    });

    // Fallback date-wise aggregation from sales collection if order-based rows are unavailable
    if (Object.keys(dateWiseMap).length === 0) {
      salesRows.forEach((row) => {
        const qty = Number(row?.quantity || 0);
        const revenue = Number(row?.revenue || 0);
        totals.unitsSold += qty;
        totals.totalRevenue += revenue;

        const rowDate = row?.saleDate ? new Date(row.saleDate) : null;
        const dateKey = rowDate && !Number.isNaN(rowDate.getTime())
          ? rowDate.toISOString().split('T')[0]
          : 'Unknown';

        if (!dateWiseMap[dateKey]) {
          dateWiseMap[dateKey] = {
            date: dateKey,
            unitsSold: 0,
            revenue: 0
          };
        }
        dateWiseMap[dateKey].unitsSold += qty;
        dateWiseMap[dateKey].revenue += revenue;
      });
    } else {
      // If date-wise comes from orders, still align totals with sales collection when available.
      if ((salesRows || []).length > 0) {
        totals.unitsSold = salesRows.reduce((sum, row) => sum + Number(row?.quantity || 0), 0);
        totals.totalRevenue = salesRows.reduce((sum, row) => sum + Number(row?.revenue || 0), 0);
      }
    }

    const dateWiseSales = Object.values(dateWiseMap)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        ...entry,
        unitsSold: Number(entry.unitsSold.toFixed(2)),
        revenue: Number(entry.revenue.toFixed(2))
      }));

    return res.json({
      product: {
        _id: String(product._id),
        name: product.name || 'Product',
        category: product.category || '',
        price: Number(product.price || 0)
      },
      productName: product.name || 'Product',
      unitsSold: Number(totals.unitsSold.toFixed(2)),
      totalSales: Number(totals.unitsSold.toFixed(2)),
      totalRevenue: Number(totals.totalRevenue.toFixed(2)),
      dateWiseSales
    });
  } catch (error) {
    console.error('Error fetching product analytics details:', error);
    return res.status(500).json({ error: 'Failed to fetch product analytics details' });
  }
};

function normalizeImageUrlValue(rawValue) {
  if (typeof rawValue !== 'string') return '';
  const value = rawValue.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return value;
  if (/^www\./i.test(value)) return `https://${value}`;
  // Keep the value unchanged so we don't transform it to an unintended URL.
  return value;
}

function normalizeBlogResponse(blog) {
  const imageCandidate = [
    blog?.image_url,
    blog?.imageUrl,
    blog?.image,
    blog?.coverImage,
    blog?.cover_image
  ].find((v) => typeof v === 'string' && v.trim());

  const normalizedImage = normalizeImageUrlValue(imageCandidate);

  return {
    ...blog,
    image_url: normalizedImage || blog?.image_url || '',
    imageUrl: normalizedImage || blog?.imageUrl || '',
  };
}

const getBlogs = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    const blogs = await db.collection('blogs')
      .find({ coordinator: coordinatorEmail })
      .sort({ created_date: -1 })
      .toArray();

    res.json({ blogs: (blogs || []).map(normalizeBlogResponse) });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
};

const getPublishedBlogsPublic = async (req, res) => {
  try {
    const db = await connectDB();
    const blogs = await db.collection('blogs')
      .find({
        $or: [
          { status: 'published' },
          { published: true }
        ]
      })
      .sort({
        published_at: -1,
        updated_date: -1,
        created_date: -1
      })
      .toArray();

    res.json({ blogs: (blogs || []).map(normalizeBlogResponse) });
  } catch (error) {
    console.error('Error fetching published blogs:', error);
    res.status(500).json({ error: 'Failed to fetch published blogs' });
  }
};
const createBlog = async (req, res) => {
  try {
    const { title, content, excerpt, tags, published, status, imageUrl, image_url, image, coverImage, cover_image } = req.body || {};
    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    if (!coordinatorEmail) {
      return res.status(401).json({ error: 'User not logged in' });
    }

    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedContent = typeof content === 'string' ? content.trim() : '';
    if (!normalizedTitle || !normalizedContent) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const normalizedExcerpt = typeof excerpt === 'string' ? excerpt.trim() : '';
    const normalizedTags = Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : (typeof tags === 'string'
          ? tags.split(',').map((t) => t.trim()).filter(Boolean)
          : []);
    const normalizedStatus = typeof status === 'string' && status.trim() ? status.trim().toLowerCase() : null;
    const normalizedPublished = normalizedStatus
      ? normalizedStatus === 'published'
      : (typeof published === 'boolean'
          ? published
          : (typeof published === 'string' ? published.toLowerCase() === 'true' : false));
    const rawImageInput = [imageUrl, image_url, image, coverImage, cover_image]
      .find((v) => typeof v === 'string' && v.trim()) || '';
    const normalizedImageUrl = normalizeImageUrlValue(rawImageInput);


    const blog = {
      title: normalizedTitle,
      content: normalizedContent,
      author: coordinatorEmail,
      coordinator: coordinatorEmail,
      created_date: new Date(),
      updated_date: new Date(),
      published: normalizedPublished,
      status: normalizedPublished ? 'published' : 'draft',
      published_at: normalizedPublished ? new Date() : null,
      tags: normalizedTags
    };

    if (normalizedExcerpt) blog.excerpt = normalizedExcerpt;
    if (normalizedImageUrl) {
      blog.image_url = normalizedImageUrl;
      blog.imageUrl = normalizedImageUrl;
    }
    Object.keys(blog).forEach((k) => blog[k] === undefined && delete blog[k]);

    const result = await db.collection('blogs').insertOne(blog);
    blog._id = result.insertedId;

    res.json({ success: true, blog: normalizeBlogResponse(blog) });
  } catch (error) {
    console.error('Error creating blog:', error);
    if (error && error.errInfo) {
      console.error('Error creating blog details:', JSON.stringify(error.errInfo, null, 2));
    }
    res.status(500).json({ error: 'Failed to create blog' });
  }
};

const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid blog ID' });

    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    // Verify coordinator owns the blog
    const blog = await db.collection('blogs').findOne({
      _id: new ObjectId(id),
      coordinator: coordinatorEmail
    });
    if (!blog) return res.status(404).json({ error: 'Blog not found or access denied' });

    const $set = { updated_date: new Date() };
    const $unset = {};

    if (updates.title !== undefined) {
      if (typeof updates.title !== 'string' || !updates.title.trim()) {
        return res.status(400).json({ error: 'Title must be a non-empty string' });
      }
      $set.title = updates.title.trim();
    }

    if (updates.content !== undefined) {
      if (typeof updates.content !== 'string' || !updates.content.trim()) {
        return res.status(400).json({ error: 'Content must be a non-empty string' });
      }
      $set.content = updates.content.trim();
    }

    if (updates.excerpt !== undefined) {
      if (updates.excerpt === null || (typeof updates.excerpt === 'string' && !updates.excerpt.trim())) {
        $unset.excerpt = '';
      } else if (typeof updates.excerpt === 'string') {
        $set.excerpt = updates.excerpt.trim();
      } else {
        return res.status(400).json({ error: 'Excerpt must be a string' });
      }
    }

    if (updates.tags !== undefined) {
      if (Array.isArray(updates.tags)) {
        $set.tags = updates.tags.map((t) => String(t).trim()).filter(Boolean);
      } else if (typeof updates.tags === 'string') {
        $set.tags = updates.tags.split(',').map((t) => t.trim()).filter(Boolean);
      } else {
        return res.status(400).json({ error: 'Tags must be an array or comma-separated string' });
      }
    }

    if (updates.published !== undefined) {
      if (typeof updates.published === 'boolean') {
        $set.published = updates.published;
      } else if (typeof updates.published === 'string') {
        $set.published = updates.published.toLowerCase() === 'true';
      } else {
        return res.status(400).json({ error: 'Published must be a boolean' });
      }
      $set.status = $set.published ? 'published' : 'draft';
      $set.published_at = $set.published ? new Date() : null;
    }

    if (updates.status !== undefined) {
      if (typeof updates.status !== 'string') {
        return res.status(400).json({ error: 'Status must be a string' });
      }
      const normalizedStatus = updates.status.trim().toLowerCase();
      if (!['draft', 'published'].includes(normalizedStatus)) {
        return res.status(400).json({ error: 'Status must be either draft or published' });
      }
      $set.status = normalizedStatus;
      $set.published = normalizedStatus === 'published';
      $set.published_at = normalizedStatus === 'published' ? new Date() : null;
    }

    const incomingImageUrl = updates.imageUrl !== undefined ? updates.imageUrl : (updates.image_url !== undefined ? updates.image_url : (updates.image !== undefined ? updates.image : (updates.coverImage !== undefined ? updates.coverImage : updates.cover_image)));
    if (incomingImageUrl !== undefined) {
      if (incomingImageUrl === null || (typeof incomingImageUrl === 'string' && !incomingImageUrl.trim())) {
        $unset.image_url = '';
        $unset.imageUrl = '';
      } else if (typeof incomingImageUrl === 'string') {
        const normalizedIncomingImage = normalizeImageUrlValue(incomingImageUrl);
        $set.image_url = normalizedIncomingImage;
        $set.imageUrl = normalizedIncomingImage;
      } else {
        return res.status(400).json({ error: 'Image URL must be a string' });
      }
    }

    const updateDoc = { $set };
    if (Object.keys($unset).length > 0) updateDoc.$unset = $unset;

    await db.collection('blogs').updateOne(
      { _id: new ObjectId(id), coordinator: coordinatorEmail },
      updateDoc
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({ error: 'Failed to update blog' });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid blog ID' });

    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    // Verify coordinator owns the blog
    const blog = await db.collection('blogs').findOne({
      _id: new ObjectId(id),
      coordinator: coordinatorEmail
    });
    if (!blog) return res.status(404).json({ error: 'Blog not found or access denied' });

    await db.collection('blogs').deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ error: 'Failed to delete blog' });
  }
};

// ── Meetings ────────────────────────────────────────────────────

const getReceivedMeetings = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    const meetings = await db.collection('meetingsdb')
      .find({
        name: coordinatorEmail,
        role: 'coordinator'
      })
      .sort({ date: -1, time: -1 })
      .toArray();

    res.json({ meetings });
  } catch (error) {
    console.error('Error fetching received meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
};

// ── Announcements ───────────────────────────────────────────────

const postAnnouncement = async (req, res) => {
  try {
    const { title, message, targetRole } = req.body;
    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    const announcement = {
      title,
      message,
      posted_by: coordinatorEmail,
      posted_date: new Date(),
      target_role: targetRole || 'player',
      is_active: true
    };

    const result = await db.collection('announcements').insertOne(announcement);
    announcement._id = result.insertedId;

    // Broadcast announcement to all connected clients via Socket.IO
    const io = req.app.locals.io;
    if (io) {
      io.emit('liveAnnouncement', announcement);
    }

    res.json({ success: true, announcement });
  } catch (error) {
    console.error('Error posting announcement:', error);
    res.status(500).json({ error: 'Failed to post announcement' });
  }
};

// ── Exports ─────────────────────────────────────────────────────

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId || !ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const db = await connectDB();
    // Player-side reviews are saved in "reviews" collection
    const reviews = await db.collection('reviews')
      .find({ product_id: new ObjectId(productId) })
      .sort({ created_at: -1, updated_at: -1 })
      .toArray();

    res.json({
      reviews: reviews.map((r) => ({
        ...r,
        user_name: r.player_name || r.user_name || r.player_email || 'User',
        review_date: r.created_at || r.review_date || r.updated_at || new Date(),
        comment: r.comment || '',
        rating: Number(r.rating || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching product reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

const getOrderComplaints = async (req, res) => {
  try {
    const db = await connectDB();
    const coordinatorEmail = req.session.userEmail;

    // Get products by this coordinator
    const products = await db.collection('products')
      .find({ coordinator: coordinatorEmail })
      .project({ _id: 1 })
      .toArray();
    const productIds = products.map(p => p._id);

    // Find orders containing these products
    const orders = await db.collection('orders')
      .find({ 'items.productId': { $in: productIds } })
      .project({ _id: 1 })
      .toArray();
    const orderIds = orders.map(o => o._id);

    const complaints = await db.collection('order_complaints')
      .aggregate([
        { $match: { order_id: { $in: orderIds } } },
        {
          $lookup: {
            from: 'orders',
            localField: 'order_id',
            foreignField: '_id',
            as: 'order'
          }
        },
        { $unwind: '$order' },
        { $sort: { submitted_date: -1 } }
      ])
      .toArray();

    res.json({ complaints });
  } catch (error) {
    console.error('Error fetching order complaints:', error);
    res.status(500).json({ error: 'Failed to fetch order complaints' });
  }
};

const resolveOrderComplaint = async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { response } = req.body;

    if (!ObjectId.isValid(complaintId)) return res.status(400).json({ error: 'Invalid complaint ID' });

    const db = await connectDB();
    // Assuming check logic is done or acceptable to resolve if they can see it
    await db.collection('order_complaints').updateOne(
      { _id: new ObjectId(complaintId) },
      {
        $set: {
          status: 'resolved',
          coordinator_response: response,
          resolved_date: new Date()
        }
      }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error resolving order complaint:', error);
    res.status(500).json({ error: 'Failed to resolve order complaint' });
  }
};

// ── Chess Events (Upcoming Events for Players) ─────────────────────────────

/**
 * GET /coordinator/api/chess-events
 * List all chess events created by this coordinator
 */
const getChessEvents = async (req, res) => {
  try {
    const db = await connectDB();
    const events = await db.collection('chess_events')
      .find({ coordinatorId: req.user.id })
      .sort({ date: 1 })
      .toArray();
    res.json(events);
  } catch (error) {
    console.error('Error fetching chess events:', error);
    res.status(500).json({ error: 'Failed to fetch chess events' });
  }
};

/**
 * POST /coordinator/api/chess-events
 * Create a new chess event (chess talk, tournament alert, etc.)
 */
const createChessEvent = async (req, res) => {
  try {
    const { title, description, date, category, location, link } = req.body;
    if (!title || !date || !category) {
      return res.status(400).json({ error: 'Title, date and category are required' });
    }
    const validCategories = ['Chess Talk', 'Tournament Alert', 'Live Announcement', 'Workshop', 'Webinar', 'Exhibition Match', 'Other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category. Must be one of: ' + validCategories.join(', ') });
    }
    const db = await connectDB();
    const coordinator = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    const event = {
      title: title.trim(),
      description: (description || '').trim(),
      date: new Date(date),
      category,
      location: (location || '').trim(),
      link: (link || '').trim(),
      coordinatorId: req.user.id,
      coordinatorName: coordinator ? coordinator.name : 'Coordinator',
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const result = await db.collection('chess_events').insertOne(event);
    res.status(201).json({ ...event, _id: result.insertedId });
  } catch (error) {
    console.error('Error creating chess event:', error);
    res.status(500).json({ error: 'Failed to create chess event' });
  }
};

/**
 * PUT /coordinator/api/chess-events/:id
 * Update a chess event
 */
const updateChessEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, category, location, link, active } = req.body;
    const db = await connectDB();
    const existing = await db.collection('chess_events').findOne({ _id: new ObjectId(id), coordinatorId: req.user.id });
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    const update = { updatedAt: new Date() };
    if (title !== undefined) update.title = title.trim();
    if (description !== undefined) update.description = description.trim();
    if (date !== undefined) update.date = new Date(date);
    if (category !== undefined) {
      const validCategories = ['Chess Talk', 'Tournament Alert', 'Live Announcement', 'Workshop', 'Webinar', 'Exhibition Match', 'Other'];
      if (!validCategories.includes(category)) return res.status(400).json({ error: 'Invalid category' });
      update.category = category;
    }
    if (location !== undefined) update.location = location.trim();
    if (link !== undefined) update.link = link.trim();
    if (active !== undefined) update.active = !!active;
    await db.collection('chess_events').updateOne({ _id: new ObjectId(id) }, { $set: update });
    const updated = await db.collection('chess_events').findOne({ _id: new ObjectId(id) });
    res.json(updated);
  } catch (error) {
    console.error('Error updating chess event:', error);
    res.status(500).json({ error: 'Failed to update chess event' });
  }
};

/**
 * DELETE /coordinator/api/chess-events/:id
 * Delete a chess event
 */
const deleteChessEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    const result = await db.collection('chess_events').deleteOne({ _id: new ObjectId(id), coordinatorId: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chess event:', error);
    res.status(500).json({ error: 'Failed to delete chess event' });
  }
};

// ── Exports ─────────────────────────────────────────────────────

module.exports = {
  // Middleware
  uploadTournamentFileMiddleware,
  // Streaming
  getStreams,
  createStream,
  updateStream,
  deleteStream,
  // Profile
  getName,
  getDashboard,
  getProfile,
  updateProfile,
  uploadPhoto,
  deleteProfile,
  // Notifications
  getNotifications,
  markNotificationsRead,
  // Tournaments
  getTournaments,
  getTournamentById,
  createTournament,
  updateTournament,
  deleteTournament,
  uploadTournamentFile,
  getTournamentFiles,
  deleteTournamentFile,
  // Calendar
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  checkDateConflict,
  // Complaints
  getComplaints,
  resolveComplaint,
  respondComplaint,
  // Store
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  toggleComments,
  getOrders,
  updateOrderStatus,
  getOrderAnalytics,
  getProductAnalyticsDetails,
  // Blogs
  getBlogs,
  getPublishedBlogsPublic,
  createBlog,
  updateBlog,
  deleteBlog,
  // Meetings
  scheduleMeeting,
  getOrganizedMeetings,
  getUpcomingMeetings,
  getReceivedMeetings,
  // Announcements
  postAnnouncement,
  // Player Stats & Enrolled Players
  getPlayerStats,
  getPlayerStatsDetails,
  getEnrolledPlayers,
  // Pairings & Rankings
  getPairings,
  getRankings,
  getTeamPairings,
  getTeamRankings,
  // Feedback
  requestFeedback,
  getFeedbacks,
  getFeedbackView,
  // Product Reviews
  getProductReviews,
  // Order Complaints
  getOrderComplaints,
  resolveOrderComplaint,
  // Chess Events
  getChessEvents,
  createChessEvent,
  updateChessEvent,
  deleteChessEvent,
};







