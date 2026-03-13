const { connectDB } = require('../config/database');
const { uploadImageBuffer, destroyImage } = require('../utils/cloudinary');
const { ObjectId } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs');
const Player = require('../models/Player');
const Team = require('../models/Team');
const { swissPairing, swissTeamPairing } = require('../utils/swissPairing');
let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

const BCRYPT_ROUNDS = 12;
const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);
const verifyPasswordAndMaybeMigrate = async (db, user, plainPassword) => {
  const stored = user?.password;
  if (!stored || typeof stored !== 'string') return false;
  if (typeof plainPassword !== 'string' || plainPassword.length === 0) return false;
  if (isBcryptHash(stored)) {
    return bcrypt.compare(plainPassword, stored);
  }
  if (stored === plainPassword) {
    const hashed = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    await db.collection('users').updateOne({ _id: user._id }, { $set: { password: hashed } });
    return true;
  }
  return false;
};

const normalizeEmail = (value) => (value == null ? '' : String(value).trim().toLowerCase());
const isSelfDeletedUser = (user) => {
  const email = normalizeEmail(user?.email);
  const deletedBy = normalizeEmail(user?.deleted_by);
  return Boolean(email && deletedBy && email === deletedBy);
};

function normalizeProductImages(product = {}) {
  const fromArray = Array.isArray(product.image_urls)
    ? product.image_urls
    : (typeof product.image_urls === 'string'
        ? product.image_urls.split(',').map((s) => s.trim())
        : []);

  const urls = Array.from(new Set([
    ...fromArray,
    product.image_url,
    product.imageUrl,
    product.image
  ].filter(Boolean)));

  return urls;
}

// 1. GET /api/dashboard
const getDashboard = async (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const username = req.session.username;
  const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
  if (!user) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const latestTournaments = await db.collection('tournaments')
    .find({ status: 'Approved' })
    .sort({ date: -1 })
    .limit(5)
    .toArray();

  const latestItems = await db.collection('products')
    .find({ availability: { $gt: 0 } })
    .sort({ _id: -1 })
    .limit(5)
    .toArray();

  const teamRequests = await db.collection('enrolledtournaments_team').aggregate([
    {
      $match: {
        $or: [{ player1_name: username }, { player2_name: username }, { player3_name: username }],
        approved: 0
      }
    },
    { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
    { $unwind: '$tournament' },
    { $lookup: { from: 'users', localField: 'captain_id', foreignField: '_id', as: 'captain' } },
    { $unwind: '$captain' },
    {
      $project: {
        id: '$_id',
        tournamentName: '$tournament.name',
        captainName: '$captain.name',
        player1_name: 1,
        player2_name: 1,
        player3_name: 1,
        player1_approved: 1,
        player2_approved: 1,
        player3_approved: 1
      }
    }
  ]).toArray();

  res.json({
    playerName: username,
    latestTournaments: latestTournaments || [],
    latestItems: latestItems || [],
    teamRequests: teamRequests || []
  });
};

// 2. GET /api/tournaments
const getTournaments = async (req, res) => {
  if (!req.session.username) {
    console.log('No username in session');
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    const db = await connectDB();
    console.log('Connected to database');
    const username = req.session.username;
    console.log('Session username:', username);

    const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
    if (!user) {
      console.log('User not found for username:', username);
      return res.status(404).json({ error: 'Player not found' });
    }
    console.log('User found:', user);

    const balance = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balance?.wallet_balance || 0;
    console.log('Wallet balance:', walletBalance);

    const tournamentsRaw = await db.collection('tournaments').find({ status: 'Approved' }).toArray();
    const tournaments = (tournamentsRaw || []).map(t => ({ ...t, _id: t._id.toString() }));
    console.log('Fetched tournaments:', tournaments);

    const enrolledIndividualTournamentsRaw = await db.collection('tournament_players').aggregate([
      { $match: { username } },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $unwind: '$tournament' },
      { $project: { tournament: 1 } }
    ]).toArray();
    const enrolledIndividualTournaments = (enrolledIndividualTournamentsRaw || []).map(e => ({
      ...e,
      tournament: e.tournament ? { ...e.tournament, _id: e.tournament._id.toString() } : null
    }));
    console.log('Enrolled individual tournaments:', enrolledIndividualTournaments);

    const enrolledTeamTournamentsRaw = await db.collection('enrolledtournaments_team').aggregate([
      {
        $match: {
          $or: [{ captain_id: user._id }, { player1_name: username }, { player2_name: username }, { player3_name: username }]
        }
      },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $lookup: { from: 'users', localField: 'captain_id', foreignField: '_id', as: 'captain' } },
      { $unwind: '$tournament' },
      { $unwind: '$captain' },
      {
        $project: {
          _id: 1,
          tournament_id: '$tournament_id',
          tournament: '$tournament',
          captainName: '$captain.name',
          player1_name: 1,
          player2_name: 1,
          player3_name: 1,
          player1_approved: 1,
          player2_approved: 1,
          player3_approved: 1,
          approved: 1,
          enrollment_date: 1
        }
      }
    ]).toArray();
    const enrolledTeamTournaments = (enrolledTeamTournamentsRaw || []).map(e => ({
      ...e,
      _id: e._id ? e._id.toString() : undefined,
      tournament: e.tournament ? { ...e.tournament, _id: e.tournament._id.toString() } : null
    }));
    console.log('Enrolled team tournaments:', enrolledTeamTournaments);

    const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    console.log('Subscription:', subscription);

    const response = {
      tournaments: tournaments || [],
      enrolledIndividualTournaments: enrolledIndividualTournaments || [],
      enrolledTeamTournaments: enrolledTeamTournaments || [],
      username,
      walletBalance,
      currentSubscription: subscription || null
    };
    console.log('API response:', response);
    res.json(response);
  } catch (err) {
    console.error('Error in /api/tournaments:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 3. POST /api/join-individual
const joinIndividual = async (req, res) => {
  if (!req.session.username || !req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const { tournamentId } = req.body || {};
  if (!tournamentId) return res.status(400).json({ error: 'Tournament ID is required' });
  if (!ObjectId.isValid(tournamentId)) return res.status(400).json({ error: 'Invalid tournament ID' });

  try {
    const db = await connectDB();
    const username = req.session.username;
    const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    // Ensure tournament exists and is approved
    const tournament = await db.collection('tournaments').findOne({ _id: new ObjectId(tournamentId), status: 'Approved' });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found or not approved' });
    if ((tournament.type || '').toLowerCase() !== 'individual') {
      return res.status(400).json({ error: 'This is not an individual tournament' });
    }

    // Subscription must be active
    const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    if (!subscription || (subscription.end_date && new Date(subscription.end_date) <= new Date())) {
      return res.status(400).json({ error: 'Subscription required' });
    }

    // Already enrolled?
    const already = await db.collection('tournament_players').findOne({ tournament_id: new ObjectId(tournamentId), username });
    if (already) return res.status(400).json({ error: 'Already enrolled' });

    // Wallet check
    const balDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balDoc?.wallet_balance || 0;
    const fee = parseFloat(tournament.entry_fee) || 0;
    if (walletBalance < fee) return res.status(400).json({ error: 'Insufficient wallet balance' });

    // Deduct and enroll
    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -fee } },
      { upsert: true }
    );

    await db.collection('tournament_players').insertOne({
      tournament_id: new ObjectId(tournamentId),
      username,
      college: user.college || '',
      gender: user.gender || ''
    });

    const newBal = await db.collection('user_balances').findOne({ user_id: user._id });
    res.json({ success: true, message: 'Joined successfully', walletBalance: newBal?.wallet_balance || (walletBalance - fee) });
  } catch (err) {
    console.error('Error in /api/join-individual:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 4. POST /api/join-team
const joinTeam = async (req, res) => {
  if (!req.session.username || !req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  const { tournamentId, player1, player2, player3 } = req.body;
  console.log('join-team request:', { tournamentId, player1, player2, player3, captain: req.session.username });

  if (!tournamentId || !player1 || !player2 || !player3) {
    return res.status(400).json({ error: 'Tournament ID and three player usernames are required' });
  }

  // Trim whitespace from player names
  const p1 = (player1 || '').trim();
  const p2 = (player2 || '').trim();
  const p3 = (player3 || '').trim();

  if (!p1 || !p2 || !p3) {
    return res.status(400).json({ error: 'All three player usernames are required' });
  }

  // Check all players are distinct
  const uniquePlayers = new Set([p1, p2, p3]);
  if (uniquePlayers.size !== 3) {
    return res.status(400).json({ error: 'All three players must be different' });
  }

  try {
    const db = await connectDB();
    const username = req.session.username;
    const user = await db.collection('users').findOne({ name: username, role: 'player', isDeleted: 0 });
    if (!user) {
      return res.status(404).json({ error: 'Your player account not found' });
    }

    // Captain must be one of the 3 players
    if (![p1, p2, p3].includes(username)) {
      return res.status(400).json({ error: 'You (the captain) must be one of the three team members' });
    }

    if (!ObjectId.isValid(tournamentId)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const tournament = await db.collection('tournaments').findOne({ _id: new ObjectId(tournamentId), status: 'Approved' });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found or not approved' });
    }

    // Check tournament is team type
    const tournamentType = (tournament.type || '').toLowerCase();
    if (!['team', 'group'].includes(tournamentType)) {
      return res.status(400).json({ error: 'This is not a team tournament' });
    }

    // Verify all players exist - find by name (username)
    const players = await db.collection('users').find({
      name: { $in: [p1, p2, p3] },
      role: 'player',
      isDeleted: 0
    }).toArray();

    console.log('Found players:', players.map(p => p.name));

    if (players.length !== 3) {
      const foundNames = players.map(p => p.name);
      const missing = [p1, p2, p3].filter(n => !foundNames.includes(n));
      return res.status(400).json({ error: `Player(s) not found: ${missing.join(', ')}. Please check the usernames.` });
    }

    // Check if any of these players are already enrolled in this tournament
    const existingEnrollment = await db.collection('enrolledtournaments_team').findOne({
      tournament_id: new ObjectId(tournamentId),
      $or: [
        { player1_name: { $in: [p1, p2, p3] } },
        { player2_name: { $in: [p1, p2, p3] } },
        { player3_name: { $in: [p1, p2, p3] } }
      ]
    });
    if (existingEnrollment) {
      return res.status(400).json({ error: 'One or more players are already enrolled in this tournament' });
    }

    // Check wallet balance (only captain pays)
    const balance = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balance?.wallet_balance || 0;
    const entryFee = tournament.entry_fee || 0;
    if (walletBalance < entryFee) {
      return res.status(400).json({ error: `Insufficient wallet balance. Required: ₹${entryFee}, Available: ₹${walletBalance}` });
    }

    // Deduct entry fee from captain
    if (entryFee > 0) {
      await db.collection('user_balances').updateOne(
        { user_id: user._id },
        { $inc: { wallet_balance: -entryFee } },
        { upsert: true }
      );
    }

    // Enroll team - captain is auto-approved
    const enrollment = {
      tournament_id: new ObjectId(tournamentId),
      captain_id: user._id,
      captain_name: username,
      player1_name: p1,
      player2_name: p2,
      player3_name: p3,
      player1_approved: p1 === username ? 1 : 0,
      player2_approved: p2 === username ? 1 : 0,
      player3_approved: p3 === username ? 1 : 0,
      approved: 0,
      enrollment_date: new Date()
    };

    // Check if all players are auto-approved
    const allApproved = enrollment.player1_approved && enrollment.player2_approved && enrollment.player3_approved;
    enrollment.approved = allApproved ? 1 : 0;

    await db.collection('enrolledtournaments_team').insertOne(enrollment);

    const newBalance = (await db.collection('user_balances').findOne({ user_id: user._id }))?.wallet_balance || 0;

    const pendingPlayers = [p1, p2, p3].filter(p => p !== username);
    res.json({
      success: true,
      message: `Team submitted! Waiting for approval from: ${pendingPlayers.join(', ')}`,
      walletBalance: newBalance
    });
  } catch (err) {
    console.error('Error in /api/join-team:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 5. GET /api/store
const getStore = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const row = await db.collection('users').aggregate([
    { $match: { email: req.session.userEmail, role: 'player', isDeleted: 0 } },
    { $lookup: { from: 'user_balances', localField: '_id', foreignField: 'user_id', as: 'balance' } },
    { $unwind: { path: '$balance', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 1, name: 1, college: 1, wallet_balance: '$balance.wallet_balance' } }
  ]).next();

  if (!row) {
    return res.status(404).json({ error: 'User not found' });
  }

  req.session.userID = row._id.toString();
  req.session.username = row.name;
  req.session.userCollege = row.college;

  const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
  let discountPercentage = 0;
  if (subscription) {
    if (subscription.plan === 'Basic') discountPercentage = 10;
    else if (subscription.plan === 'Premium') discountPercentage = 20;
  }

  const [products, userSales, userOrders] = await Promise.all([
    db.collection('products').find().toArray(),
    db.collection('sales')
      .find({
        $or: [
          { buyer_id: row._id },
          { buyer: row.name }
        ]
      })
      .project({ product_id: 1 })
      .toArray(),
    db.collection('orders')
      .find({
        user_email: req.session.userEmail,
        status: { $ne: 'cancelled' }
      })
      .project({ items: 1 })
      .toArray()
  ]);

  const purchasedProductIds = new Set();
  for (const s of userSales || []) {
    if (s?.product_id) purchasedProductIds.add(String(s.product_id));
  }
  for (const o of userOrders || []) {
    for (const item of (o?.items || [])) {
      if (item?.productId) purchasedProductIds.add(String(item.productId));
    }
  }

  const normalizedProducts = (products || []).map((p) => {
    const imageUrls = normalizeProductImages(p);
    const pid = String(p._id || '');
    return {
      ...p,
      _id: pid,
      image: imageUrls[0] || '',
      image_url: p.image_url || imageUrls[0] || '',
      image_urls: imageUrls,
      comments_enabled: !!p.comments_enabled,
      canReview: purchasedProductIds.has(pid)
    };
  });

  res.json({
    products: normalizedProducts,
    walletBalance: row.wallet_balance || 0,
    playerName: row.name,
    playerCollege: row.college,
    subscription: subscription || null,
    discountPercentage
  });
};

// 6. GET /api/subscription
const getSubscription = async (req, res) => {
  console.log('GET /player/api/subscription - Session:', {
    userEmail: req.session.userEmail,
    userRole: req.session.userRole,
    username: req.session.username
  });

  if (!req.session.userEmail) {
    console.log('GET /player/api/subscription - No userEmail in session');
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    const db = await connectDB();
    console.log('GET /player/api/subscription - Looking up user with email:', req.session.userEmail);

    const row = await db.collection('users').aggregate([
      { $match: { email: req.session.userEmail, role: 'player', isDeleted: 0 } },
      { $lookup: { from: 'user_balances', localField: '_id', foreignField: 'user_id', as: 'balance' } },
      { $unwind: { path: '$balance', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, wallet_balance: '$balance.wallet_balance' } }
    ]).next();

    if (!row) {
      console.log('GET /player/api/subscription - User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('GET /player/api/subscription - User found, wallet:', row.wallet_balance);

    let subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    console.log('GET /player/api/subscription - Subscription:', subscription);

    if (subscription) {
      const now = new Date();
      if (now > new Date(subscription.end_date)) {
        await db.collection('subscriptionstable').deleteOne({ username: req.session.userEmail });
        console.log('GET /player/api/subscription - Expired subscription deleted');
        subscription = null;
      }
    }

    const response = {
      walletBalance: row.wallet_balance || 0,
      currentSubscription: subscription || null
    };
    console.log('GET /player/api/subscription - Sending response:', response);
    res.json(response);
  } catch (err) {
    console.error('GET /player/api/subscription - Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// 7. GET /api/growth
const getGrowth = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const player = await db.collection('player_stats').aggregate([
    { $lookup: { from: 'users', localField: 'player_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.email': req.session.userEmail, 'user.isDeleted': 0 } },
    { $project: { name: '$user.name', gamesPlayed: 1, wins: 1, losses: 1, draws: 1, rating: 1, player_id: 1 } }
  ]).next();

  if (!player) {
    return res.status(404).json({ error: 'Player stats not found' });
  }

  const currentRating = player.rating && !isNaN(player.rating) ? player.rating : 400;

  // Try to get real rating history
  const historyDoc = await db.collection('rating_history').findOne({ player_id: player.player_id });
  let ratingHistory, chartLabels;

  if (historyDoc && historyDoc.ratingHistory && historyDoc.ratingHistory.length > 1) {
    // Use real stored history
    const points = historyDoc.ratingHistory.slice(-6);
    ratingHistory = points.map(p => p.rating);
    chartLabels = points.map(p => {
      const d = new Date(p.date);
      return d.toLocaleString('default', { month: 'short', day: 'numeric' });
    });
  } else {
    // Fabricate a plausible progression
    ratingHistory = player.gamesPlayed > 0
      ? [currentRating - 200, currentRating - 150, currentRating - 100, currentRating - 50, currentRating - 25, currentRating]
      : [400, 400, 400, 400, 400, 400];
    chartLabels = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return date.toLocaleString('default', { month: 'short' });
    });
  }

  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

  res.json({
    player: { ...player, winRate: player.winRate || winRate },
    ratingHistory,
    chartLabels
  });
};

// 8. GET /api/profile
const getProfile = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const db = await connectDB();
  const row = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
  if (!row) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const playerId = row._id;
  let playerStats = await db.collection('player_stats').findOne({ player_id: playerId });

  if (!playerStats) {
    const gamesPlayed = Math.floor(Math.random() * 11) + 20;
    let wins = Math.floor(Math.random() * (gamesPlayed + 1));
    let losses = Math.floor(Math.random() * (gamesPlayed - wins + 1));
    let draws = gamesPlayed - (wins + losses);
    let rating = 400 + (wins * 10) - (losses * 10);
    let winRate = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;

    try {
      await db.collection('player_stats').updateOne(
        { player_id: playerId },
        { $set: { gamesPlayed, wins, losses, draws, winRate, rating } },
        { upsert: true }
      );
      playerStats = { gamesPlayed, wins, losses, draws, winRate, rating };
    } catch (err) {
      console.error('Error updating player stats:', err);
      return res.status(500).json({ error: 'Failed to update player stats' });
    }
  }

  const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
  const balance = await db.collection('user_balances').findOne({ user_id: playerId });
  console.log('Balance query result:', balance);
  const walletBalance = balance?.wallet_balance || 0;

  const sales = await db.collection('sales').aggregate([
    { $match: { $or: [{ buyer_id: playerId }, { buyer: row.name }] } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: '$product' },
    { $project: { name: '$product.name' } }
  ]).toArray();

  const subscribed = subscription && new Date(subscription.end_date) > new Date();

  res.json({
    player: {
      ...row,
      subscription: subscription || { plan: 'None', price: 0, start_date: 'N/A' },
      walletBalance,
      gamesPlayed: playerStats.gamesPlayed,
      wins: playerStats.wins,
      losses: playerStats.losses,
      draws: playerStats.draws,
      winRate: playerStats.winRate,
      rating: playerStats.rating,
      sales: sales.map(sale => sale.name)
    },
    subscribed
  });
};

// 9. POST /api/profile/photo
const uploadPhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo uploaded. Use field name "photo".' });
  }

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    const existingPublicId = (user.profile_photo_public_id || '').toString();
    const desiredPublicId = existingPublicId || `chesshive/profile-photos/player_${user._id}`;

    const result = await uploadImageBuffer(req.file.buffer, {
      folder: 'chesshive/profile-photos',
      public_id: desiredPublicId.split('/').pop(),
      overwrite: true,
      invalidate: true
    });

    const newUrl = result?.secure_url;
    const newPublicId = result?.public_id;
    if (!newUrl || !newPublicId) {
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
    return res.status(500).json({ error: 'Failed to update profile photo' });
  }
};

// Multer middleware for photo upload
const uploadPhotoMiddleware = (req, res, next) => {
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

  uploader(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    return next();
  });
};

// 10. PUT /api/profile
const updateProfile = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    const { name, dob, phone, AICF_ID, FIDE_ID } = req.body || {};

    const set = {};
    const unset = {};

    if (name !== undefined) {
      const v = (name ?? '').toString().trim();
      if (!v) return res.status(400).json({ error: 'Name is required' });
      set.name = v;
    }

    if (phone !== undefined) {
      const v = (phone ?? '').toString().trim();
      if (!v) unset.phone = '';
      else set.phone = v;
    }

    if (AICF_ID !== undefined) {
      const v = (AICF_ID ?? '').toString().trim();
      if (!v) unset.AICF_ID = '';
      else set.AICF_ID = v;
    }

    if (FIDE_ID !== undefined) {
      const v = (FIDE_ID ?? '').toString().trim();
      if (!v) unset.FIDE_ID = '';
      else set.FIDE_ID = v;
    }

    if (dob !== undefined) {
      const v = (dob ?? '').toString().trim();
      if (!v) {
        unset.dob = '';
      } else {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ error: 'Invalid dob. Use YYYY-MM-DD.' });
        }
        set.dob = d;
      }
    }

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    const updateDoc = {};
    if (Object.keys(set).length) updateDoc.$set = { ...set, updated_date: new Date() };
    if (Object.keys(unset).length) updateDoc.$unset = unset;
    await db.collection('users').updateOne({ _id: user._id }, updateDoc);

    return res.json({ success: true });
  } catch (err) {
    console.error('Error updating player profile:', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

// 11. DELETE /api/deleteAccount
const deleteAccount = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'player'
    });

    if (!user) return res.status(404).json({ error: 'Player not found' });

    const playerId = user._id;

    // Soft delete in users collection (includes deleted_by and deletedAt)
    await db.collection('users').updateOne(
      { _id: playerId },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: req.session.userEmail } }
    );
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Account deleted successfully (soft delete)' });
    });
  } catch (err) {
    console.error('Error deleting account:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
};

// 12. POST /players/restore/:id
const restorePlayer = async (req, res) => {
  const db = await connectDB();
  const playerId = req.params.id;
  const { email, password } = req.body;

  try {
    const user = await db.collection('users').findOne({
      _id: new ObjectId(playerId),
      role: 'player'
    });

    if (!user) return res.status(404).json({ message: 'Player account not found.' });

    if (user.isDeleted === 0) {
      return res.status(400).json({ message: 'Account is already active.' });
    }

    if (user.email !== email) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const passwordOk = await verifyPasswordAndMaybeMigrate(db, user, password);
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    if (!isSelfDeletedUser(user)) {
      return res.status(403).json({ message: 'This account was removed by an administrator and cannot be self-restored.' });
    }

    // Restore by setting isDeleted back to 0
    await db.collection('users').updateOne(
      { _id: new ObjectId(playerId) },
      {
        $set: { isDeleted: 0, restored_date: new Date(), restored_by: user.email },
        $unset: { deletedAt: '', deleted_date: '', deleted_by: '' }
      }
    );

    await db.collection('player_stats').updateOne(
      { player_id: new ObjectId(playerId) },
      { $set: { isDeleted: 0 } }
    );

    await db.collection('user_balances').updateOne(
      { user_id: new ObjectId(playerId) },
      { $set: { isDeleted: 0 } }
    );

    await db.collection('subscriptionstable').updateOne(
      { username: user.email },
      { $set: { isDeleted: 0 } }
    );

    await db.collection('sales').updateMany(
      { buyer: user.name },
      { $set: { isDeleted: 0 } }
    );

    return res.status(200).json({ message: 'Player account restored successfully! You can now log in.' });
  } catch (err) {
    console.error('Error restoring player:', err);
    return res.status(500).json({ message: 'Failed to restore player account.' });
  }
};

// 13. GET /api/compare
const comparePlayer = async (req, res) => {
  const db = await connectDB();
  const query = (req.query.opponent || req.query.query || '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Please provide a name or email to compare.' });
  }

  try {
    // Get logged-in player stats
    const currentUser = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: { $ne: 1 } });
    const currentStats = currentUser ? await db.collection('player_stats').findOne({ player_id: currentUser._id }) : null;

    // Get opponent
    const opponent = await db.collection('users').findOne({
      $or: [{ email: query }, { name: query }],
      role: 'player',
      isDeleted: { $ne: 1 }
    });

    if (!opponent) {
      return res.status(404).json({ error: 'Player not found.' });
    }

    const oppStats = await db.collection('player_stats').findOne({
      player_id: opponent._id,
      isDeleted: { $ne: 1 }
    });

    // Fetch rating history for both players (stored as single doc with ratingHistory array)
    const playerHistoryDoc = await db.collection('rating_history')
      .findOne({ player_id: currentUser?._id });
    const playerHistory = playerHistoryDoc?.ratingHistory || [];

    const opponentHistoryDoc = await db.collection('rating_history')
      .findOne({ player_id: opponent._id });
    const opponentHistory = opponentHistoryDoc?.ratingHistory || [];

    const pWins = currentStats?.wins || 0;
    const pLosses = currentStats?.losses || 0;
    const pDraws = currentStats?.draws || 0;
    const pGames = currentStats?.gamesPlayed || (pWins + pLosses + pDraws);

    const oWins = oppStats?.wins || 0;
    const oLosses = oppStats?.losses || 0;
    const oDraws = oppStats?.draws || 0;
    const oGames = oppStats?.gamesPlayed || (oWins + oLosses + oDraws);

    res.json({
      player: {
        name: currentUser?.name || 'You',
        rating: currentStats?.rating || 500,
        gamesPlayed: pGames,
        wins: pWins,
        losses: pLosses,
        draws: pDraws,
        winRate: pGames > 0 ? ((pWins / pGames) * 100).toFixed(1) : '0',
        ratingHistory: playerHistory.length > 0
          ? playerHistory.map(r => ({ date: r.date, rating: r.rating }))
          : [{ date: new Date().toISOString(), rating: currentStats?.rating || 500 }]
      },
      opponent: {
        name: opponent.name,
        rating: oppStats?.rating || 500,
        gamesPlayed: oGames,
        wins: oWins,
        losses: oLosses,
        draws: oDraws,
        winRate: oGames > 0 ? ((oWins / oGames) * 100).toFixed(1) : '0',
        ratingHistory: opponentHistory.length > 0
          ? opponentHistory.map(r => ({ date: r.date, rating: r.rating }))
          : [{ date: new Date().toISOString(), rating: oppStats?.rating || 500 }]
      }
    });
  } catch (err) {
    console.error('Error comparing players:', err);
    res.status(500).json({ error: 'Failed to compare players.' });
  }
};

// 14. POST /api/add-funds
const addFunds = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const MAX_TOPUP_PER_REQUEST = 5000;
  const MAX_WALLET_BALANCE = 100000;
  const { amount } = req.body;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount', message: 'Invalid amount' });
  }
  if (numericAmount > MAX_TOPUP_PER_REQUEST) {
    return res.status(400).json({
      error: `You can add a maximum of ₹${MAX_TOPUP_PER_REQUEST} at once`,
      message: `You can add a maximum of ₹${MAX_TOPUP_PER_REQUEST} at once`
    });
  }

  const db = await connectDB();
  const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const balanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
  const currentBalance = Number(balanceDoc?.wallet_balance || 0);
  if (currentBalance >= MAX_WALLET_BALANCE) {
    return res.status(400).json({
      error: `Wallet balance cannot exceed ₹${MAX_WALLET_BALANCE}`,
      message: `Wallet balance cannot exceed ₹${MAX_WALLET_BALANCE}`
    });
  }
  if (currentBalance + numericAmount > MAX_WALLET_BALANCE) {
    const allowed = Math.max(0, MAX_WALLET_BALANCE - currentBalance);
    return res.status(400).json({
      error: `You can add only ₹${allowed} more. Wallet limit is ₹${MAX_WALLET_BALANCE}`,
      message: `You can add only ₹${allowed} more. Wallet limit is ₹${MAX_WALLET_BALANCE}`
    });
  }

  const cappedBalance = Math.min(currentBalance + numericAmount, MAX_WALLET_BALANCE);
  const result = await db.collection('user_balances').updateOne(
    { user_id: user._id },
    { $set: { wallet_balance: cappedBalance } },
    { upsert: true }
  );

  if (result.matchedCount === 0 && result.upsertedCount === 0) {
    return res.status(500).json({ error: 'Failed to update balance' });
  }

  res.json({ success: true, walletBalance: cappedBalance, message: 'Funds added successfully' });
};

// 15. GET /api/pairings
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

    await db.collection('tournament_pairings').deleteOne({ tournament_id: new ObjectId(tournamentId) });
    await db.collection('tournament_pairings').insertOne({
      tournament_id: new ObjectId(tournamentId),
      totalRounds: totalRounds,
      rounds: allRounds.map(round => ({
        round: round.round,
        pairings: round.pairings.map(pairing => ({
          player1: { id: pairing.player1.id, username: pairing.player1.username, score: pairing.player1.score },
          player2: { id: pairing.player2.id, username: pairing.player2.username, score: pairing.player2.score },
          result: pairing.result
        })),
        byePlayer: round.byePlayer ? {
          id: round.byePlayer.id,
          username: round.byePlayer.username,
          score: round.byePlayer.score
        } : null
      }))
    });
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

// 16. GET /api/rankings
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

// 17. GET /api/team-pairings
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
        `Team ${enrollment.captain_name}`,
        enrollment.captain_name,
        enrollment.player1_name,
        enrollment.player2_name,
        enrollment.player3_name
      ));

      allRounds = swissTeamPairing(teams, totalRounds);

      await db.collection('tournament_team_pairings').deleteOne({ tournament_id: tid });
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

// 18. GET /api/team-rankings
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

// 19. POST /api/approve-team-request
const approveTeamRequest = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }
  const { requestId } = req.body;
  if (!requestId) {
    return res.status(400).json({ error: 'Request ID is required' });
  }

  const db = await connectDB();
  const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
  if (!user) {
    return res.status(404).json({ error: 'Player not found' });
  }

  const teamRequest = await db.collection('enrolledtournaments_team').findOne({ _id: new ObjectId(requestId) });
  if (!teamRequest) {
    return res.status(404).json({ error: 'Team request not found' });
  }

  // Update approval based on player's role in team
  const update = {};
  if (teamRequest.player1_name === user.name) {
    update.player1_approved = 1;
  } else if (teamRequest.player2_name === user.name) {
    update.player2_approved = 1;
  } else if (teamRequest.player3_name === user.name) {
    update.player3_approved = 1;
  } else {
    return res.status(403).json({ error: 'You are not part of this team' });
  }

  // Check if all players approved
  const updatedRequest = {
    ...teamRequest,
    ...update,
    approved: (teamRequest.player1_approved || update.player1_approved) &&
              (teamRequest.player2_approved || update.player2_approved) &&
              (teamRequest.player3_approved || update.player3_approved) ? 1 : 0
  };

  await db.collection('enrolledtournaments_team').updateOne(
    { _id: new ObjectId(requestId) },
    { $set: { ...update, approved: updatedRequest.approved } }
  );

  res.json({ success: true });
};

// 20. POST /api/buy
const buyProduct = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ success: false, message: 'Please log in' });
  }

  try {
    const db = await connectDB();
    const { price, buyer, college, productId } = req.body;

    if (!price || !productId) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'player',
      isDeleted: 0
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const balanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balanceDoc?.wallet_balance || 0;
    const numericPrice = parseFloat(price);

    if (walletBalance < numericPrice) {
      return res.json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Check product availability
    console.log('Checking product availability');
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product || product.availability <= 0) {
      return res.json({ success: false, message: 'Product unavailable' });
    }

    // Deduct wallet balance and reduce availability
    console.log('Deducting balance and updating product availability');
    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -numericPrice } },
      { upsert: true }
    );
    console.log('Updating product availability');
    await db.collection('products').updateOne(
      { _id: new ObjectId(productId) },
      { $inc: { availability: -1 } }
    );

    // Record the sale
    await db.collection('sales').updateOne(
      { product_id: new ObjectId(productId), buyer_id: user._id },
      {
        $inc: { quantity: 1, price: Number(numericPrice) },
        $set: {
          buyer: String(buyer),
          buyer_id: user._id,
          college: String(college),
          purchase_date: new Date()
        },
        $setOnInsert: { product_id: new ObjectId(productId) }
      },
      { upsert: true }
    );

    // Create an order record for single-item purchase (buy now)
    try {
      const prod = await db.collection('products').findOne({ _id: new ObjectId(productId) });
      const orderItem = {
        productId: new ObjectId(productId),
        name: prod ? prod.name : '',
        price: Number(numericPrice),
        quantity: 1,
        coordinator: prod ? (prod.coordinator || '') : '',
        college: prod ? (prod.college || '') : ''
      };
      await db.collection('orders').insertOne({
        user_email: req.session.userEmail,
        items: [orderItem],
        total: Number(numericPrice),
        status: 'pending',
        delivery_verified: false,
        createdAt: new Date()
      });
    } catch (e) {
      console.warn('Failed to create order record for buy action:', e.message || e);
    }

    // Return actual updated balance from DB
    const newBalanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const updatedBalance = newBalanceDoc?.wallet_balance ?? (walletBalance - numericPrice);
    res.json({ success: true, message: 'Purchase successful!', walletBalance: updatedBalance });

  } catch (err) {
    console.error('Error in /api/buy:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// 21. POST /api/subscribe
const subscribePlan = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ success: false, message: 'Please log in' });
  }

  try {
    const { plan, price } = req.body;
    if (!plan || !price) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'player',
      isDeleted: 0
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check wallet balance
    const balanceDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const walletBalance = balanceDoc?.wallet_balance || 0;
    const numericPrice = parseFloat(price);

    if (walletBalance < numericPrice) {
      return res.json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Deduct funds
    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -numericPrice } }
    );

    // Set subscription duration (1 month)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + 1);

    const subscriptionDoc = {
      username: req.session.userEmail,
      plan,
      price: numericPrice,
      start_date: startDate,
      end_date: endDate
    };

    console.log('Attempting to save subscription:', JSON.stringify(subscriptionDoc, null, 2));

    // Save subscription
    await db.collection('subscriptionstable').updateOne(
      { username: req.session.userEmail },
      { $set: subscriptionDoc },
      { upsert: true }
    );

    // Log to subscription history
    await db.collection('subscription_history').insertOne({
      user_email: req.session.userEmail,
      plan,
      price: numericPrice,
      date: startDate,
      action: 'new'
    });

    const updatedBalance = walletBalance - numericPrice;
    res.json({
      success: true,
      message: 'Subscription successful!',
      walletBalance: updatedBalance
    });
  } catch (err) {
    console.error('Error in /api/subscribe:', err);
    if (err.code === 121) {
      console.error('Validation error details:', JSON.stringify(err.errInfo, null, 2));
    }
    res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
};

// 22. GET /api/growth_analytics
const getGrowthAnalytics = async (req, res) => {
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    let stats = await db.collection('player_stats').findOne({ player_id: user._id });

    // Ensure stats exist with initial rating
    if (!stats) {
      stats = { player_id: user._id, wins: 0, losses: 0, draws: 0, winRate: 0, gamesPlayed: 0, rating: 500 };
      await db.collection('player_stats').insertOne(stats);
    }

    // ── Elo helper: K-factor based rating change ──
    function eloChange(playerRating, opponentRating, score) {
      // score: 1 = win, 0 = loss, 0.5 = draw
      const K = 32;
      const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
      return Math.round(K * (score - expected));
    }

    // ── Parse result from pairing (supports both old & new formats) ──
    function parseOutcome(pairing, username) {
      const isP1 = pairing.player1?.username === username;
      const isP2 = pairing.player2?.username === username;
      if (!isP1 && !isP2) return null;

      const resultCode = (pairing.resultCode || '').trim();
      const resultText = (pairing.result || '').trim();
      if (!resultCode && !resultText) return null;
      if (resultText === 'pending') return null;

      let outcome;

      // Try structured resultCode first (new format)
      if (resultCode === '1-0') {
        outcome = isP1 ? 'win' : 'loss';
      } else if (resultCode === '0-1') {
        outcome = isP2 ? 'win' : 'loss';
      } else if (resultCode === '0.5-0.5') {
        outcome = 'draw';
      }
      // Fall back to text-based result (old format: "PlayerName Wins" or "Draw")
      else if (resultText.toLowerCase() === 'draw') {
        outcome = 'draw';
      } else if (resultText.toLowerCase().endsWith(' wins')) {
        const winnerName = resultText.slice(0, -5).trim();
        if (isP1 && winnerName === pairing.player1?.username) outcome = 'win';
        else if (isP2 && winnerName === pairing.player2?.username) outcome = 'win';
        else if (isP1 || isP2) outcome = 'loss';
      }
      // Legacy numeric codes
      else if (resultText === '1-0') {
        outcome = isP1 ? 'win' : 'loss';
      } else if (resultText === '0-1') {
        outcome = isP2 ? 'win' : 'loss';
      }

      if (!outcome) return null;

      return {
        outcome,
        color: isP1 ? 'white' : 'black',
        opponentName: isP1 ? (pairing.player2?.username || 'Unknown') : (pairing.player1?.username || 'Unknown'),
        opponentScore: isP1 ? (pairing.player2?.score || 0) : (pairing.player1?.score || 0)
      };
    }

    // ── Scan all tournament pairings for this player ──
    const username = user.name;
    const pairingDocs = await db.collection('tournament_pairings').find({}).toArray();
    const gameHistory = [];
    let realWins = 0, realLosses = 0, realDraws = 0;
    let whiteWins = 0, whiteLosses = 0, whiteDraws = 0;
    let blackWins = 0, blackLosses = 0, blackDraws = 0;
    let currentStreak = 0, winStreak = 0, loseStreak = 0, currentLoseStreak = 0;

    // Collect all games first, then sort by date
    const rawGames = [];

    for (const doc of pairingDocs) {
      const tournament = await db.collection('tournaments').findOne({ _id: doc.tournament_id });
      const tournamentName = tournament?.name || 'Tournament';
      const tournamentDate = tournament?.date ? new Date(tournament.date) : new Date();

      for (const round of (doc.rounds || [])) {
        for (const pairing of (round.pairings || [])) {
          const parsed = parseOutcome(pairing, username);
          if (!parsed) continue;

          // Use round number to differentiate games within same tournament
          const gameDate = new Date(tournamentDate);
          gameDate.setHours(gameDate.getHours() + (round.round || 1));

          rawGames.push({
            date: gameDate,
            dateStr: gameDate.toISOString().split('T')[0],
            ...parsed,
            tournamentName,
            round: round.round || 1
          });
        }
      }
    }

    // Sort games chronologically
    rawGames.sort((a, b) => a.date - b.date);

    // ── Build analytics from real games ──
    const hasRealGames = rawGames.length > 0;
    const BASE_RATING = 500;
    let runningRating = BASE_RATING;
    const ratingPoints = [];
    let greatestWin = null;
    let worstLoss = null;

    if (hasRealGames) {
      ratingPoints.push({ date: rawGames[0].dateStr, rating: BASE_RATING });

      for (const game of rawGames) {
        // Estimate opponent rating based on their tournament score
        const opponentRating = BASE_RATING + (game.opponentScore * 30);
        const eloScore = game.outcome === 'win' ? 1 : game.outcome === 'loss' ? 0 : 0.5;
        const ratingChange = eloChange(runningRating, opponentRating, eloScore);
        runningRating = Math.max(100, runningRating + ratingChange);

        if (game.outcome === 'win') {
          realWins++;
          if (game.color === 'white') whiteWins++; else blackWins++;
          currentStreak++;
          currentLoseStreak = 0;
          if (currentStreak > winStreak) winStreak = currentStreak;
          if (!greatestWin || opponentRating > greatestWin.oppRating) {
            greatestWin = { opponent: game.opponentName, rating: opponentRating, oppRating: opponentRating, date: game.dateStr };
          }
        } else if (game.outcome === 'loss') {
          realLosses++;
          if (game.color === 'white') whiteLosses++; else blackLosses++;
          currentLoseStreak++;
          currentStreak = 0;
          if (currentLoseStreak > loseStreak) loseStreak = currentLoseStreak;
          if (!worstLoss || opponentRating < worstLoss.oppRating) {
            worstLoss = { opponent: game.opponentName, rating: opponentRating, oppRating: opponentRating, date: game.dateStr };
          }
        } else {
          realDraws++;
          if (game.color === 'white') whiteDraws++; else blackDraws++;
          currentStreak = 0;
          currentLoseStreak = 0;
        }

        ratingPoints.push({ date: game.dateStr, rating: runningRating });
        gameHistory.push({
          date: game.dateStr,
          opponent: game.opponentName,
          result: game.outcome,
          color: game.color,
          ratingChange,
          tournament: game.tournamentName
        });
      }

      const gamesPlayed = gameHistory.length;
      const wins = realWins;
      const losses = realLosses;
      const draws = realDraws;
      const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
      const peakRating = Math.max(...ratingPoints.map(r => r.rating));

      // Update player_stats in DB with real calculated values
      await db.collection('player_stats').updateOne(
        { player_id: user._id },
        { $set: { wins, losses, draws, gamesPlayed, winRate, rating: runningRating } }
      );

      // Write to rating_history collection for persistent tracking
      await db.collection('rating_history').updateOne(
        { player_id: user._id },
        { $set: { player_id: user._id, playerName: username, ratingHistory: ratingPoints, lastUpdated: new Date() } },
        { upsert: true }
      );

      // Multi-format ratings: each format follows its own independent trajectory
      // Use a seeded PRNG so the same player always gets the same format curves
      function seededRandom(seed) {
        let s = seed;
        return function() {
          s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
          return (s >>> 0) / 0xFFFFFFFF;
        };
      }
      const playerSeed = (user._id.toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0)) * 31;

      function buildFormatCurve(baseCurve, formatSeed, baseOffset, volatility) {
        const rng = seededRandom(formatSeed);
        let drift = baseOffset;
        return baseCurve.map((r, i) => {
          if (i === 0) return { ...r, rating: Math.max(100, r.rating + baseOffset) };
          // Independent random walk per format
          drift += (rng() - 0.48) * volatility;
          drift = Math.max(baseOffset - 60, Math.min(baseOffset + 60, drift));
          const noise = Math.round((rng() - 0.5) * 12);
          return { ...r, rating: Math.max(100, Math.round(r.rating + drift + noise)) };
        });
      }

      const multiRatings = {
        classical: buildFormatCurve(ratingPoints, playerSeed + 1, 18, 8),
        blitz:     buildFormatCurve(ratingPoints, playerSeed + 2, -25, 14),
        rapid:     buildFormatCurve(ratingPoints, playerSeed + 3, 5, 10)
      };

      return res.json({
        gamesPlayed, winRate, currentRating: runningRating, peakRating,
        ratings: {
          classical: multiRatings.classical[multiRatings.classical.length - 1]?.rating || runningRating + 18,
          blitz: multiRatings.blitz[multiRatings.blitz.length - 1]?.rating || runningRating - 25,
          rapid: multiRatings.rapid[multiRatings.rapid.length - 1]?.rating || runningRating + 5
        },
        wins, losses, draws,
        whiteStats: { wins: whiteWins, losses: whiteLosses, draws: whiteDraws },
        blackStats: { wins: blackWins, losses: blackLosses, draws: blackDraws },
        ratingHistory: ratingPoints, multiRatings, winStreak, loseStreak,
        greatestWin: greatestWin ? { opponent: greatestWin.opponent, rating: greatestWin.rating, date: greatestWin.date } : null,
        worstLoss: worstLoss ? { opponent: worstLoss.opponent, rating: worstLoss.rating, date: worstLoss.date } : null,
        gameHistory
      });
    }

    // ── No real games — generate sample data seeded per player ──
    // Seeded PRNG so each player gets unique but deterministic curves
    function seededRandom(seed) {
      let s = seed;
      return function() {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
        return (s >>> 0) / 0xFFFFFFFF;
      };
    }
    const playerSeed = (user._id.toString().split('').reduce((a, c) => a + c.charCodeAt(0), 0)) * 37;
    const rng = seededRandom(playerSeed);

    const now = new Date();
    const sampleCount = 20;
    const sampleRatingHistory = [];
    const sampleGameHistory = [];
    const sampleNames = ['Arjun V', 'Sneha R', 'Karthik M', 'Priya S', 'Rahul D', 'Ananya K', 'Vikram P', 'Deepa L', 'Ravi T', 'Meera N', 'Aditya G', 'Lakshmi B'];
    const tournamentNames = ['City Open', 'Weekend Blitz', 'Rapid Championship', 'Club Masters', 'Spring Classic'];
    const baseRating = stats.rating || 500;
    let sampleRating = baseRating;
    let sWins = 0, sLosses = 0, sDraws = 0;
    let sWhiteW = 0, sWhiteL = 0, sWhiteD = 0, sBW = 0, sBL = 0, sBD = 0;
    let sWinStreak = 0, sLoseStreak = 0, sCurWin = 0, sCurLose = 0;

    // Generate player-unique outcome sequence
    function genOutcome() {
      const r = rng();
      if (r < 0.42) return 'win';
      if (r < 0.75) return 'loss';
      return 'draw';
    }

    // Shuffle opponent names per player
    const shuffledNames = [...sampleNames];
    for (let i = shuffledNames.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledNames[i], shuffledNames[j]] = [shuffledNames[j], shuffledNames[i]];
    }

    sampleRatingHistory.push({ date: new Date(now.getTime() - (sampleCount + 1) * 3 * 86400000).toISOString().split('T')[0], rating: baseRating });

    for (let i = 0; i < sampleCount; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (sampleCount - i) * 3);
      const dateStr = d.toISOString().split('T')[0];
      const outcome = genOutcome();
      const color = rng() > 0.5 ? 'white' : 'black';
      const oppRating = baseRating + Math.round((rng() - 0.5) * 140);
      const eloScore = outcome === 'win' ? 1 : outcome === 'loss' ? 0 : 0.5;
      const change = eloChange(sampleRating, oppRating, eloScore);

      sampleRating = Math.max(100, sampleRating + change);
      sampleRatingHistory.push({ date: dateStr, rating: sampleRating });

      if (outcome === 'win') { sWins++; if (color === 'white') sWhiteW++; else sBW++; sCurWin++; sCurLose = 0; if (sCurWin > sWinStreak) sWinStreak = sCurWin; }
      else if (outcome === 'loss') { sLosses++; if (color === 'white') sWhiteL++; else sBL++; sCurLose++; sCurWin = 0; if (sCurLose > sLoseStreak) sLoseStreak = sCurLose; }
      else { sDraws++; if (color === 'white') sWhiteD++; else sBD++; sCurWin = 0; sCurLose = 0; }

      sampleGameHistory.push({
        date: dateStr,
        opponent: shuffledNames[i % shuffledNames.length],
        result: outcome,
        color,
        ratingChange: change,
        tournament: tournamentNames[Math.floor(rng() * tournamentNames.length)]
      });
    }

    const totalGames = sWins + sLosses + sDraws;
    const sampleWinRate = totalGames > 0 ? Math.round((sWins / totalGames) * 100) : 0;
    const peakSample = Math.max(baseRating, ...sampleRatingHistory.map(r => r.rating));

    // Build independent format curves with per-format random walks
    function buildSampleFormatCurve(baseCurve, formatSeed, baseOffset, volatility) {
      const frng = seededRandom(formatSeed);
      let drift = baseOffset;
      return baseCurve.map((r, i) => {
        if (i === 0) return { ...r, rating: Math.max(100, r.rating + baseOffset) };
        drift += (frng() - 0.48) * volatility;
        drift = Math.max(baseOffset - 55, Math.min(baseOffset + 55, drift));
        const noise = Math.round((frng() - 0.5) * 14);
        return { ...r, rating: Math.max(100, Math.round(r.rating + drift + noise)) };
      });
    }

    const sampleMulti = {
      classical: buildSampleFormatCurve(sampleRatingHistory, playerSeed + 101, 15, 9),
      blitz:     buildSampleFormatCurve(sampleRatingHistory, playerSeed + 202, -20, 16),
      rapid:     buildSampleFormatCurve(sampleRatingHistory, playerSeed + 303, 5, 11)
    };

    res.json({
      gamesPlayed: totalGames, winRate: sampleWinRate, currentRating: sampleRating, peakRating: peakSample,
      ratings: {
        classical: sampleMulti.classical[sampleMulti.classical.length - 1]?.rating || sampleRating + 15,
        blitz: sampleMulti.blitz[sampleMulti.blitz.length - 1]?.rating || sampleRating - 20,
        rapid: sampleMulti.rapid[sampleMulti.rapid.length - 1]?.rating || sampleRating + 5
      },
      wins: sWins, losses: sLosses, draws: sDraws,
      whiteStats: { wins: sWhiteW, losses: sWhiteL, draws: sWhiteD },
      blackStats: { wins: sBW, losses: sBL, draws: sBD },
      ratingHistory: sampleRatingHistory,
      multiRatings: sampleMulti,
      winStreak: sWinStreak, loseStreak: sLoseStreak,
      greatestWin: sWins > 0 ? { opponent: sampleGameHistory.find(g => g.result === 'win')?.opponent || 'Unknown', rating: baseRating + Math.round(rng() * 50) + 20, date: sampleGameHistory.find(g => g.result === 'win')?.date } : null,
      worstLoss: sLosses > 0 ? { opponent: sampleGameHistory.find(g => g.result === 'loss')?.opponent || 'Unknown', rating: baseRating - Math.round(rng() * 30) - 10, date: sampleGameHistory.find(g => g.result === 'loss')?.date } : null,
      gameHistory: sampleGameHistory,
      isSampleData: true
    });
  } catch (err) {
    console.error('Error loading growth analytics:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

// 23. GET /api/notifications
const getNotifications = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    const notifications = await db.collection('notifications').aggregate([
      { $match: { user_id: user._id } },
      { $lookup: { from: 'tournaments', localField: 'tournament_id', foreignField: '_id', as: 'tournament' } },
      { $unwind: '$tournament' },
      {
        $project: {
          _id: 1,
          type: 1,
          read: 1,
          date: 1,
          tournamentName: '$tournament.name',
          tournament_id: '$tournament._id'
        }
      }
    ]).toArray();

    // Convert ObjectId to string
    const formattedNotifications = notifications.map(n => ({
      ...n,
      _id: n._id.toString(),
      tournament_id: n.tournament_id.toString()
    }));
    console.log('Sending notifications:', formattedNotifications);
    res.json({ notifications: formattedNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
};

// 24. POST /api/submit-feedback
const submitFeedback = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });

  const { tournamentId, rating, comments } = req.body;
  if (!tournamentId || !rating) return res.status(400).json({ error: 'Tournament ID and rating required' });
  if (!ObjectId.isValid(tournamentId)) {
    console.error('Invalid tournamentId:', tournamentId);
    return res.status(400).json({ error: 'Invalid tournament ID' });
  }
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    // Check if already submitted
    const existing = await db.collection('feedbacks').findOne({ tournament_id: new ObjectId(tournamentId), username: user.name });
    if (existing) return res.status(400).json({ error: 'Feedback already submitted' });

    await db.collection('feedbacks').insertOne({
      tournament_id: new ObjectId(tournamentId),
      username: user.name,
      rating: parseInt(rating),
      comments: comments || '',
      submitted_date: new Date()
    });

    res.json({ success: true, message: 'Feedback submitted' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
};

// 25. POST /api/mark-notification-read
const markNotificationRead = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });

  const { notificationId } = req.body;
  if (!notificationId) return res.status(400).json({ error: 'Notification ID required' });

  try {
    const db = await connectDB();
    await db.collection('notifications').updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

// 26. GET /api/streams
const getPlayerStreams = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });

  try {
    const db = await connectDB();
    // Fetch all live or featured streams (visible to players)
    const streams = await db.collection('streams')
      .find({ $or: [{ isLive: true }, { featured: true }] })
      .sort({ featured: -1, updatedAt: -1, createdAt: -1 })
      .toArray();

    const out = (streams || []).map(s => ({
      _id: s._id ? s._id.toString() : undefined,
      title: s.title,
      url: s.url,
      platform: s.platform,
      streamType: s.streamType || 'classical',
      matchLabel: s.matchLabel,
      description: s.description,
      result: s.result,
      isLive: s.isLive,
      featured: s.featured,
      createdByName: s.createdByName,
      updatedAt: s.updatedAt,
      createdAt: s.createdAt,
    }));

    return res.json(out);
  } catch (error) {
    console.error('Error fetching streams for player:', error);
    return res.status(500).json({ error: 'Failed to fetch streams' });
  }
};

// 27. GET /api/tournament-calendar
const getTournamentCalendar = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    const tournaments = await db.collection('tournaments')
      .find({ status: { $in: ['Approved', 'Ongoing'] } })
      .sort({ date: 1 })
      .toArray();
    // Also fetch matches/pairings for each tournament
    const pairingDocs = await db.collection('tournament_pairings').find({
      tournament_id: { $in: tournaments.map(t => t._id) }
    }).toArray();
    const pairingsMap = {};
    for (const pd of pairingDocs) {
      const tid = pd.tournament_id?.toString();
      if (tid) {
        const matches = [];
        for (const round of (pd.rounds || [])) {
          for (const p of (round.pairings || [])) {
            matches.push({
              round: round.round,
              player1: p.player1?.username || 'TBD',
              player2: p.player2?.username || 'TBD',
              result: p.result || 'pending'
            });
          }
        }
        pairingsMap[tid] = matches;
      }
    }

    const calendar = tournaments.map(t => ({
      _id: t._id.toString(),
      name: t.name,
      date: t.date,
      type: t.type || 'individual',
      location: t.location,
      entry_fee: t.entry_fee,
      image: t.image || t.banner || null,
      description: t.description || '',
      rounds: t.rounds || 5,
      matches: pairingsMap[t._id.toString()] || []
    }));
    res.json({ calendar });
  } catch (err) {
    console.error('Error fetching tournament calendar:', err);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
};

// 28. GET /api/subscription/history
const getSubscriptionHistory = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    const history = await db.collection('subscription_history')
      .find({ user_email: req.session.userEmail })
      .sort({ date: -1 })
      .toArray();
    res.json({ history: history.map(h => ({ plan: h.plan, price: h.price, date: h.date, action: h.action })) });
  } catch (err) {
    console.error('Error fetching subscription history:', err);
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
};

// 29. POST /api/subscription/change
const changeSubscriptionPlan = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const { newPlan } = req.body || {};
    if (!newPlan) return res.status(400).json({ error: 'New plan is required' });

    const planPrices = { Basic: 99, Premium: 199 };
    const newPrice = planPrices[newPlan];
    if (newPrice === undefined) return res.status(400).json({ error: 'Invalid plan' });

    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentSub = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    if (!currentSub) return res.status(400).json({ error: 'No active subscription to change' });

    const currentPrice = currentSub.price || 0;
    const diff = newPrice - currentPrice;
    const action = diff > 0 ? 'upgrade' : 'downgrade';

    // If upgrading, charge difference from wallet
    if (diff > 0) {
      const balDoc = await db.collection('user_balances').findOne({ user_id: user._id });
      const wallet = balDoc?.wallet_balance || 0;
      if (wallet < diff) return res.status(400).json({ error: `Insufficient wallet balance. Need ₹${diff} more.` });
      await db.collection('user_balances').updateOne({ user_id: user._id }, { $inc: { wallet_balance: -diff } });
    } else if (diff < 0) {
      // If downgrading, refund difference to wallet
      await db.collection('user_balances').updateOne({ user_id: user._id }, { $inc: { wallet_balance: Math.abs(diff) } }, { upsert: true });
    }

    // Update subscription
    await db.collection('subscriptionstable').updateOne(
      { username: req.session.userEmail },
      { $set: { plan: newPlan, price: newPrice } }
    );

    // Log to history
    await db.collection('subscription_history').insertOne({
      user_email: req.session.userEmail,
      plan: newPlan,
      price: newPrice,
      date: new Date(),
      action
    });

    res.json({ success: true, message: `Plan ${action}d to ${newPlan} successfully!` });
  } catch (err) {
    console.error('Error changing subscription plan:', err);
    res.status(500).json({ error: 'Failed to change plan' });
  }
};

// 30. GET /api/cart
const getCart = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    const cart = await db.collection('cart').findOne({ user_email: req.session.userEmail });
    res.json({ items: cart?.items || [] });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
};

// 31. POST /api/cart/add
const addToCart = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const { productId, quantity } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });
    const qty = parseInt(quantity) || 1;

    const db = await connectDB();
    const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.availability <= 0) return res.status(400).json({ error: 'Product out of stock' });
    const productImages = normalizeProductImages(product);
    const productImage = productImages[0] || null;

    const cart = await db.collection('cart').findOne({ user_email: req.session.userEmail });
    if (cart) {
      const existingItem = (cart.items || []).find(i => i.productId.toString() === productId);
      if (existingItem) {
        await db.collection('cart').updateOne(
          { user_email: req.session.userEmail, 'items.productId': new ObjectId(productId) },
          { $inc: { 'items.$.quantity': qty } }
        );
      } else {
        await db.collection('cart').updateOne(
          { user_email: req.session.userEmail },
          { $push: { items: { productId: new ObjectId(productId), name: product.name, price: product.price, image: productImage, quantity: qty } } }
        );
      }
    } else {
      await db.collection('cart').insertOne({
        user_email: req.session.userEmail,
        items: [{ productId: new ObjectId(productId), name: product.name, price: product.price, image: productImage, quantity: qty }]
      });
    }

    const updated = await db.collection('cart').findOne({ user_email: req.session.userEmail });
    res.json({ success: true, items: updated?.items || [] });
  } catch (err) {
    console.error('Error adding to cart:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
};

// 32. DELETE /api/cart/remove
const removeFromCart = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const { productId } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const db = await connectDB();
    await db.collection('cart').updateOne(
      { user_email: req.session.userEmail },
      { $pull: { items: { productId: new ObjectId(productId) } } }
    );

    const updated = await db.collection('cart').findOne({ user_email: req.session.userEmail });
    res.json({ success: true, items: updated?.items || [] });
  } catch (err) {
    console.error('Error removing from cart:', err);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
};

// 33. DELETE /api/cart/clear
const clearCart = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    await db.collection('cart').updateOne(
      { user_email: req.session.userEmail },
      { $set: { items: [] } }
    );
    res.json({ success: true, items: [] });
  } catch (err) {
    console.error('Error clearing cart:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};

// 34. POST /api/orders
const createOrder = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const cart = await db.collection('cart').findOne({ user_email: req.session.userEmail });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Check subscription discount
    const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    let discountPercentage = 0;
    if (subscription) {
      if (subscription.plan === 'Basic') discountPercentage = 10;
      else if (subscription.plan === 'Premium') discountPercentage = 20;
    }

    let total = 0;
    for (const item of cart.items) {
      const discountedPrice = item.price * (1 - discountPercentage / 100);
      total += discountedPrice * item.quantity;
    }
    total = Math.round(total * 100) / 100;

    // Check wallet balance
    const balDoc = await db.collection('user_balances').findOne({ user_id: user._id });
    const wallet = balDoc?.wallet_balance || 0;
    if (wallet < total) return res.status(400).json({ error: `Insufficient balance. Need ₹${total}, have ₹${wallet}` });

    // Deduct wallet
    await db.collection('user_balances').updateOne({ user_id: user._id }, { $inc: { wallet_balance: -total } });

    // Reduce product availability
    for (const item of cart.items) {
      await db.collection('products').updateOne(
        { _id: item.productId },
        { $inc: { availability: -item.quantity } }
      );
      // Record sale
      await db.collection('sales').updateOne(
        { product_id: item.productId, buyer_id: user._id },
        {
          $inc: { quantity: item.quantity, price: item.price * item.quantity },
          $set: {
            buyer: user.name,
            buyer_id: user._id,
            college: user.college || '',
            purchase_date: new Date()
          },
          $setOnInsert: { product_id: item.productId }
        },
        { upsert: true }
      );
    }

    // Enrich cart items with product metadata (denormalize coordinator/college)
    const enrichedItems = [];
    for (const item of cart.items) {
      let prod = null;
      try {
        prod = await db.collection('products').findOne({ _id: item.productId });
      } catch (e) {
        prod = null;
      }
      enrichedItems.push({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        coordinator: prod ? (prod.coordinator || '') : '',
        college: prod ? (prod.college || '') : ''
      });
    }

    // Create order (denormalized items)
    await db.collection('orders').insertOne({
      user_email: req.session.userEmail,
      items: enrichedItems,
      total,
      status: 'pending',
      delivery_verified: false,
      createdAt: new Date()
    });

    // Clear cart
    await db.collection('cart').updateOne({ user_email: req.session.userEmail }, { $set: { items: [] } });

    const newBal = await db.collection('user_balances').findOne({ user_id: user._id });
    res.json({ success: true, message: 'Order placed successfully!', walletBalance: newBal?.wallet_balance || 0 });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

// 35. GET /api/orders
const getOrders = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    const orders = await db.collection('orders')
      .find({ user_email: req.session.userEmail })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({
      orders: orders.map(o => ({
        _id: o._id.toString(),
        createdAt: o.createdAt,
        status: o.status,
        items: (o.items || []).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
        total: o.total
      }))
    });
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// 36. POST /api/orders/:orderId/cancel
const cancelOrder = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const { orderId } = req.params;
    if (!orderId || !ObjectId.isValid(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

    const db = await connectDB();
    const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), user_email: req.session.userEmail });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ error: 'Order is already cancelled' });
    if (order.status === 'delivered') return res.status(400).json({ error: 'Cannot cancel delivered order' });

    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Refund wallet
    await db.collection('user_balances').updateOne({ user_id: user._id }, { $inc: { wallet_balance: order.total } }, { upsert: true });

    // Restore product availability
    for (const item of (order.items || [])) {
      await db.collection('products').updateOne({ _id: item.productId }, { $inc: { availability: item.quantity } });
    }

    // Update order status
    await db.collection('orders').updateOne({ _id: new ObjectId(orderId) }, { $set: { status: 'cancelled', cancelledAt: new Date() } });

    const newBal = await db.collection('user_balances').findOne({ user_id: user._id });
    res.json({ success: true, message: 'Order cancelled and refunded', walletBalance: newBal?.wallet_balance || 0 });
  } catch (err) {
    console.error('Error cancelling order:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

// 37. GET /api/orders/:orderId/tracking
const getOrderTracking = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const { orderId } = req.params;
    if (!orderId || !ObjectId.isValid(orderId)) return res.status(400).json({ error: 'Invalid order ID' });

    const db = await connectDB();
    const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), user_email: req.session.userEmail });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const statusOrder = ['pending', 'processing', 'packed', 'shipped', 'delivered'];
    const currentIdx = statusOrder.indexOf(order.status);
    const steps = statusOrder.map((label, idx) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      done: order.status === 'cancelled' ? false : idx <= currentIdx,
      date: idx <= currentIdx ? (order.createdAt ? new Date(order.createdAt.getTime() + idx * 86400000).toISOString() : null) : null
    }));

    if (order.status === 'cancelled') {
      steps.push({ label: 'Cancelled', done: true, date: order.cancelledAt ? order.cancelledAt.toISOString() : null });
    }

    res.json({ status: order.status, steps });
  } catch (err) {
    console.error('Error fetching order tracking:', err);
    res.status(500).json({ error: 'Failed to fetch tracking' });
  }
};

// POST /player/api/verify-delivery-otp
const verifyDeliveryOtp = async (req, res) => {
  try {
    if (!req.session.userEmail) return res.status(401).json({ success: false, message: 'Please log in' });
    const { orderId, otp } = req.body || {};
    if (!orderId || !otp) return res.status(400).json({ success: false, message: 'orderId and otp required' });
    if (!ObjectId.isValid(orderId)) return res.status(400).json({ success: false, message: 'Invalid orderId' });

    const db = await connectDB();
    const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId), user_email: req.session.userEmail });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const otpRecord = await db.collection('otps').findOne({ email: req.session.userEmail, otp: String(otp), type: 'delivery', used: false });
    if (!otpRecord) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (new Date() > new Date(otpRecord.expires_at)) return res.status(400).json({ success: false, message: 'OTP expired' });

    // Mark OTP used
    await db.collection('otps').updateOne({ _id: otpRecord._id }, { $set: { used: true, used_at: new Date() } });

    // Mark order as delivery verified
    await db.collection('orders').updateOne({ _id: new ObjectId(orderId) }, { $set: { delivery_verified: true, delivery_verified_at: new Date() } });

    return res.json({ success: true, message: 'OTP verified' });
  } catch (err) {
    console.error('Error verifying delivery OTP:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify OTP' });
  }
};

// 38. GET /api/store/suggestions
const getStoreSuggestions = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();

    // Most ordered products
    const mostOrdered = await db.collection('sales').aggregate([
      { $group: { _id: '$product_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { _id: '$product._id', name: '$product.name', count: 1 } }
    ]).toArray();

    // Suggested: available products the user hasn't bought
    const userSales = await db.collection('sales').find({ buyer: req.session.username }).toArray();
    const boughtIds = userSales.map(s => s.product_id.toString());
    const suggested = await db.collection('products')
      .find({ availability: { $gt: 0 }, _id: { $nin: boughtIds.map(id => new ObjectId(id)) } })
      .limit(5)
      .toArray();

    res.json({
      mostOrdered: mostOrdered.map(m => ({ _id: m._id.toString(), name: m.name, count: m.count })),
      suggested: suggested.map(s => ({ _id: s._id.toString(), name: s.name, price: s.price }))
    });
  } catch (err) {
    console.error('Error fetching store suggestions:', err);
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
};

// 39. GET /api/settings
const getSettings = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    const settings = await db.collection('player_settings').findOne({ user_email: req.session.userEmail });
    res.json({
      settings: {
        notifications: settings?.notifications ?? true,
        pieceStyle: settings?.pieceStyle || 'classic',
        wallpaper: settings?.wallpaper || '',
        wallpaper_url: settings?.wallpaper_url || '',
        emailNotifications: settings?.emailNotifications ?? true,
        sound: settings?.sound ?? true
      }
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// 40. PUT /api/settings
const updateSettings = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const { notifications, pieceStyle, wallpaper, emailNotifications, sound } = req.body || {};
    const db = await connectDB();
    const updateDoc = { user_email: req.session.userEmail };
    if (notifications !== undefined) updateDoc.notifications = !!notifications;
    if (pieceStyle !== undefined) updateDoc.pieceStyle = String(pieceStyle);
    if (wallpaper !== undefined) updateDoc.wallpaper = String(wallpaper);
    if (emailNotifications !== undefined) updateDoc.emailNotifications = !!emailNotifications;
    if (sound !== undefined) updateDoc.sound = !!sound;

    await db.collection('player_settings').updateOne(
      { user_email: req.session.userEmail },
      { $set: updateDoc },
      { upsert: true }
    );
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// 41. POST /api/deactivateAccount
const deactivateAccount = async (req, res) => {
  if (!req.session.userEmail) return res.status(401).json({ error: 'Please log in' });
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { isDeleted: 1, deleted_date: new Date(), deleted_by: req.session.userEmail } }
    );

    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true, message: 'Account deactivated successfully' });
    });
  } catch (err) {
    console.error('Error deactivating account:', err);
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
};

// ── Wallpaper Upload ─────────────────────────────────────────────

const uploadWallpaperMiddleware = (req, res, next) => {
  if (!multer) {
    return res.status(500).json({ error: 'Upload support is not available (multer not installed).' });
  }
  if (!req.session.userEmail) {
    return res.status(401).json({ error: 'Please log in' });
  }

  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (r, file, cb) => {
      const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
      if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
      cb(null, true);
    }
  }).single('wallpaper');

  uploader(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed' });
    return next();
  });
};

const uploadWallpaper = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No wallpaper image uploaded. Use field name "wallpaper".' });
  }

  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player' });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    const settings = await db.collection('player_settings').findOne({ user_email: req.session.userEmail });
    const existingPublicId = (settings?.wallpaper_public_id || '').toString();
    const desiredPublicId = `wallpaper_${user._id}`;

    const result = await uploadImageBuffer(req.file.buffer, {
      folder: 'chesshive/wallpapers',
      public_id: desiredPublicId,
      overwrite: true,
      invalidate: true
    });

    const newUrl = result?.secure_url;
    const newPublicId = result?.public_id;
    if (!newUrl || !newPublicId) {
      return res.status(500).json({ error: 'Failed to upload wallpaper' });
    }

    if (existingPublicId && existingPublicId !== newPublicId) {
      await destroyImage(existingPublicId);
    }

    await db.collection('player_settings').updateOne(
      { user_email: req.session.userEmail },
      { $set: { wallpaper: 'custom', wallpaper_url: newUrl, wallpaper_public_id: newPublicId } },
      { upsert: true }
    );

    return res.json({ success: true, wallpaper_url: newUrl });
  } catch (err) {
    console.error('Error uploading wallpaper:', err);
    return res.status(500).json({ error: 'Failed to upload wallpaper' });
  }
};

// ── Complaints ──────────────────────────────────────────────────

const submitComplaint = async (req, res) => {
  try {
    const { tournament_id, subject, message } = req.body;
    if (!tournament_id || !subject || !message) {
      return res.status(400).json({ error: 'Tournament ID, subject, and message are required' });
    }
    if (!ObjectId.isValid(tournament_id)) {
      return res.status(400).json({ error: 'Invalid tournament ID' });
    }

    const db = await connectDB();
    const tournamentObjectId = new ObjectId(tournament_id);
    const tournament = await db.collection('tournaments').findOne({ _id: tournamentObjectId });
    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    const playerEmail = (req.session.userEmail || '').toString().trim();
    if (!playerEmail) {
      return res.status(401).json({ error: 'Please log in' });
    }
    const emailCandidates = Array.from(new Set([playerEmail, playerEmail.toLowerCase()])).filter(Boolean);
    const tournamentIdString = tournamentObjectId.toString();

    const complaintMatch = {
      $and: [
        {
          $or: [
            { tournament_id: tournamentObjectId },
            { tournament_id: tournamentIdString }
          ]
        },
        {
          $or: [
            { player_email: { $in: emailCandidates } },
            { user_email: { $in: emailCandidates } }
          ]
        }
      ]
    };

    const [existingNew, existingLegacy] = await Promise.all([
      db.collection('tournament_complaints').findOne(complaintMatch),
      db.collection('complaints').findOne(complaintMatch)
    ]);

    if (existingNew || existingLegacy) {
      return res.status(409).json({ error: 'You have already submitted a complaint for this tournament' });
    }

    const now = new Date();
    const complaint = {
      tournament_id: tournamentObjectId,
      player_email: playerEmail,
      player_name: req.session.username || req.session.userEmail,
      complaint: message.trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: 'pending',
      coordinator_response: '',
      reply: '',
      submitted_date: now,
      created_at: now
    };

    await db.collection('tournament_complaints').insertOne(complaint);
    return res.status(201).json({ success: true, message: 'Complaint submitted' });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ error: 'You have already submitted a complaint for this tournament' });
    }
    console.error('Error submitting complaint:', error);
    return res.status(500).json({ error: 'Failed to submit complaint' });
  }
};

function parseComplaintDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const getMyComplaints = async (req, res) => {
  try {
    const db = await connectDB();
    const email = (req.session.userEmail || '').toString();
    if (!email) return res.status(401).json({ error: 'Please log in' });

    const emailCandidates = Array.from(new Set([email, email.toLowerCase()]));

    const [newComplaints, legacyComplaints] = await Promise.all([
      db.collection('tournament_complaints')
        .find({
          $or: [
            { player_email: { $in: emailCandidates } },
            { user_email: { $in: emailCandidates } }
          ]
        })
        .sort({ submitted_date: -1, created_at: -1 })
        .toArray(),
      db.collection('complaints')
        .find({
          $or: [
            { player_email: { $in: emailCandidates } },
            { user_email: { $in: emailCandidates } }
          ]
        })
        .sort({ created_at: -1, submitted_date: -1 })
        .toArray()
    ]);

    const allComplaints = [...(newComplaints || []), ...(legacyComplaints || [])];

    const tournamentObjectIds = allComplaints
      .map((c) => {
        const tid = c?.tournament_id;
        if (!tid) return null;
        if (typeof tid === 'string') {
          return ObjectId.isValid(tid) ? new ObjectId(tid) : null;
        }
        return tid;
      })
      .filter(Boolean);

    const tournaments = tournamentObjectIds.length
      ? await db.collection('tournaments')
          .find({ _id: { $in: tournamentObjectIds } })
          .project({ _id: 1, name: 1 })
          .toArray()
      : [];
    const tournamentsById = new Map((tournaments || []).map((t) => [t._id.toString(), t.name]));

    const complaints = allComplaints
      .map((c) => {
        const id = c?._id ? c._id.toString() : '';
        const tournamentId = c?.tournament_id
          ? (typeof c.tournament_id === 'string' ? c.tournament_id : c.tournament_id.toString())
          : '';
        const response = (c?.coordinator_response || c?.response || c?.reply || '').toString().trim();
        const createdAt =
          parseComplaintDate(c?.created_at) ||
          parseComplaintDate(c?.submitted_date) ||
          parseComplaintDate(c?.createdAt);
        const resolvedAt =
          parseComplaintDate(c?.resolved_date) ||
          parseComplaintDate(c?.resolved_at) ||
          parseComplaintDate(c?.responded_at) ||
          parseComplaintDate(c?.respondedAt);
        const message = (c?.complaint || c?.message || c?.description || '').toString().trim();
        let status = (c?.status || '').toString().trim().toLowerCase();
        if (!status) status = response ? 'resolved' : 'pending';
        if (!['pending', 'resolved', 'dismissed'].includes(status)) status = 'pending';

        return {
          _id: id,
          tournament_id: tournamentId,
          tournament_name: tournamentsById.get(tournamentId) || c?.tournament_name || 'N/A',
          subject: (c?.subject || 'Tournament Complaint').toString(),
          message,
          status,
          response,
          created_at: createdAt,
          resolved_at: resolvedAt
        };
      })
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

    return res.json({ complaints });
  } catch (error) {
    console.error('Error fetching player complaints:', error);
    return res.status(500).json({ error: 'Failed to fetch complaints' });
  }
};

// ── Reviews ─────────────────────────────────────────────────────

const submitReview = async (req, res) => {
  try {
    const { product_id, rating, comment } = req.body;
    if (!product_id || !rating) return res.status(400).json({ error: 'Product ID and rating are required' });
    if (!ObjectId.isValid(product_id)) return res.status(400).json({ error: 'Invalid product ID' });

    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    const db = await connectDB();
    const productObjectId = new ObjectId(product_id);

    const user = await db.collection('users').findOne({
      email: req.session.userEmail,
      role: 'player',
      isDeleted: 0
    });
    if (!user) return res.status(404).json({ error: 'Player not found' });

    const product = await db.collection('products').findOne({ _id: productObjectId });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.comments_enabled) {
      return res.status(403).json({ error: 'Reviews are disabled for this product' });
    }

    const [orderPurchase, directPurchase] = await Promise.all([
      db.collection('orders').findOne({
        user_email: req.session.userEmail,
        status: { $ne: 'cancelled' },
        'items.productId': productObjectId
      }),
      db.collection('sales').findOne({
        product_id: productObjectId,
        $or: [
          { buyer_id: user._id },
          { buyer: user.name },
          { buyer: req.session.username }
        ]
      })
    ]);

    if (!orderPurchase && !directPurchase) {
      return res.status(403).json({ error: 'Only players who bought this product can review it' });
    }

    // Check if already reviewed
    const existing = await db.collection('reviews').findOne({
      product_id: productObjectId,
      player_email: req.session.userEmail
    });
    if (existing) {
      // Update existing review
      await db.collection('reviews').updateOne(
        { _id: existing._id },
        { $set: { rating: ratingNum, comment: (comment || '').trim(), updated_at: new Date() } }
      );
      const agg = await db.collection('reviews').aggregate([
        { $match: { product_id: productObjectId } },
        {
          $group: {
            _id: '$product_id',
            avg: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        }
      ]).next();

      await db.collection('products').updateOne(
        { _id: productObjectId },
        {
          $set: {
            average_rating: Number((agg?.avg || ratingNum).toFixed(2)),
            total_reviews: agg?.count || 1
          }
        }
      );

      return res.json({ success: true, message: 'Review updated' });
    }

    const review = {
      product_id: productObjectId,
      player_email: req.session.userEmail,
      player_name: req.session.username || req.session.userEmail,
      rating: ratingNum,
      comment: (comment || '').trim(),
      created_at: new Date()
    };

    await db.collection('reviews').insertOne(review);

    const agg = await db.collection('reviews').aggregate([
      { $match: { product_id: productObjectId } },
      {
        $group: {
          _id: '$product_id',
          avg: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]).next();

    await db.collection('products').updateOne(
      { _id: productObjectId },
      {
        $set: {
          average_rating: Number((agg?.avg || ratingNum).toFixed(2)),
          total_reviews: agg?.count || 1
        }
      }
    );

    res.status(201).json({ success: true, message: 'Review submitted' });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!ObjectId.isValid(productId)) return res.status(400).json({ error: 'Invalid product ID' });

    const db = await connectDB();
    const productObjectId = new ObjectId(productId);
    const reviews = await db.collection('reviews')
      .find({ product_id: productObjectId })
      .sort({ created_at: -1, updated_at: -1 })
      .toArray();

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
      : 0;

    res.json({
      reviews: reviews.map((r) => ({
        ...r,
        user_name: r.player_name || r.user_name || r.player_email || 'User',
        review_date: r.created_at || r.review_date || r.updated_at || new Date(),
        comment: r.comment || '',
        rating: Number(r.rating || 0)
      })),
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

// GET /api/announcements – Fetch active announcements for player
const getAnnouncements = async (req, res) => {
  try {
    const db = await connectDB();
    const announcements = await db.collection('announcements')
      .find({
        is_active: true,
        target_role: { $in: ['all', 'player'] }
      })
      .sort({ posted_date: -1 })
      .limit(10)
      .toArray();
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};

// ── News / Upcoming Events ────────────────────────────────────────

/**
 * GET /player/api/news
 * Returns platform updates + chess events (created by coordinators) for the
 * "Upcoming Events" section on the player dashboard.
 */
const getNews = async (req, res) => {
  try {
    const db = await connectDB();

    // Platform updates (general announcements, patch notes, etc.)
    const updates = await db.collection('platform_updates')
      .find({})
      .sort({ date: -1 })
      .limit(10)
      .toArray();

    // Chess events posted by coordinators (active & upcoming)
    const events = await db.collection('chess_events')
      .find({ active: true, date: { $gte: new Date() } })
      .sort({ date: 1 })
      .limit(20)
      .toArray();

    res.json({ updates, events });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
};

module.exports = {
  getDashboard,
  getTournaments,
  joinIndividual,
  joinTeam,
  getStore,
  getSubscription,
  getGrowth,
  getProfile,
  uploadPhoto,
  uploadPhotoMiddleware,
  updateProfile,
  deleteAccount,
  restorePlayer,
  comparePlayer,
  addFunds,
  getPairings,
  getRankings,
  getTeamPairings,
  getTeamRankings,
  approveTeamRequest,
  buyProduct,
  subscribePlan,
  getGrowthAnalytics,
  getNotifications,
  submitFeedback,
  markNotificationRead,
  getPlayerStreams,
  getTournamentCalendar,
  getSubscriptionHistory,
  changeSubscriptionPlan,
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  createOrder,
  getOrders,
  cancelOrder,
  getOrderTracking,
  verifyDeliveryOtp,
  getStoreSuggestions,
  getSettings,
  updateSettings,
  deactivateAccount,
  submitComplaint,
  getMyComplaints,
  submitReview,
  getProductReviews,
  getAnnouncements,
  uploadWallpaper,
  uploadWallpaperMiddleware,
  getNews
};
