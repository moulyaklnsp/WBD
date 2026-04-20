const { connectDB } = require('../config/database');
const { ObjectId } = require('mongodb');
const { swissPairing } = require('../utils/swissPairing');
const Player = require('../models/Player');
const { uploadImageBuffer } = require('../utils/cloudinary');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const AuthApiService = require('../services/authApiService');
const { normalizeKey } = require('../utils/mongo');
const { createSolrService } = require('../solr/SolrService');
const { isSolrEnabled } = require('../solr/solrEnabled');
const { mapUserToSolrDoc } = require('../solr/mappers/userMapper');
const { mapContactToSolrDoc } = require('../solr/mappers/contactMapper');

let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

const BCRYPT_ROUNDS = 12;

function computeTournamentWindow(dateValue, timeValue) {
  if (!dateValue) return null;
  const dateOnly = new Date(dateValue);
  if (Number.isNaN(dateOnly.getTime())) return null;

  const timeStr = (timeValue || '00:00').toString();
  const [hh, mm] = timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00'];

  const start = new Date(dateOnly);
  start.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start_at: start, end_at: end };
}

module.exports = {
  // ===================== API SIGNUP =====================
  apiSignup: async (req, res) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.apiSignup(db, req.body || {});
      return res.json({
        success: true,
        message: result.message,
        pendingApproval: result.pendingApproval,
        emailSent: result.emailSent
      });
    } catch (err) {
      console.error('Signup API error:', err);
      const status = err.statusCode || 500;
      const body = { success: false, message: err.message || 'Unexpected server error' };
      if (err.errors) body.errors = err.errors;
      return res.status(status).json(body);
    }
  },

  // ===================== VERIFY SIGNUP OTP =====================
  verifySignupOtp: async (req, res) => {
    const { email, otp } = req.body || {};
    try {
      const db = await connectDB();
      const result = await AuthApiService.verifySignupOtp(db, { email, otp }, req.session);
      return res.json({
        success: true,
        redirectUrl: result.redirectUrl,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        user: result.user
      });
    } catch (err) {
      console.error('Signup OTP verify error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Unexpected server error' });
    }
  },

  // ===================== LEGACY SIGNUP (EJS) =====================
  signup: async (req, res) => {
    const { name, dob, gender, college, email, phone, password, role, aicf_id, fide_id } = req.body;
    let errors = {};

    // if (!name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) errors.name = "Valid full name is required (letters only)";
    if (!dob) errors.dob = "Date of Birth is required";
    else {
      const birthDate = new Date(dob);
      const age = Math.floor((Date.now() - birthDate) / (365.25 * 24 * 60 * 60 * 1000));
      if (age < 16) errors.dob = "You must be at least 16 years old";
    }
    if (!gender || !['male', 'female', 'other'].includes(gender)) errors.gender = "Gender is required";
    if (!/^[A-Za-z\s']+$/.test(college.trim())) errors.college = "College name must contain only letters, spaces, or apostrophes";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Valid email is required";
    else if (/[A-Z]/.test(email)) errors.email = "Email should only contain lowercase letters";
    if (!phone || !/^[0-9]{10}$/.test(phone)) errors.phone = "Valid 10-digit phone number is required";
    if (!password || password.length < 8) errors.password = "Password must be at least 8 characters";
    if (!role || !['organizer', 'coordinator', 'player'].includes(role)) errors.role = "Valid role is required";
    if (role === 'admin') errors.role = "Admin signup is disabled. Please request an invite.";

    if (Object.keys(errors).length > 0) {
      console.log('Signup validation errors:', errors);
      return res.render('signup', { errors, name, dob, gender, college, email, phone, role });
    }

    const db = await connectDB();
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      errors.email = "Email already registered";
      console.log('Signup failed: Email already exists:', email);
      return res.render('signup', { errors, name, dob, gender, college, email, phone, role });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = {
      name,
      dob: new Date(dob),
      gender,
      college,
      college_key: normalizeKey(college),
      email,
      phone,
      password: hashedPassword,
      role,
      isSuperAdmin: false,
      isDeleted: 0,
      AICF_ID: aicf_id || '',
      FIDE_ID: fide_id || ''
    };
    const result = await db.collection('users').insertOne(user);
    const userId = result.insertedId;
    console.log('New user signed up:', { email, role, userId });

    if (isSolrEnabled()) {
      try {
        const solr = createSolrService();
        await solr.indexDocument('users', mapUserToSolrDoc({ ...user, _id: userId }));
      } catch (e) {
        console.error('[solr] Failed to index legacy signup user:', e?.message || e);
      }
    }

    if (role === "player") {
      await db.collection('user_balances').insertOne({ user_id: userId, wallet_balance: 0 });
      console.log('Initialized wallet balance for player:', userId);
    }

    res.redirect("/login");
  },

  // ===================== CONTACT US (LEGACY EJS) =====================
  contactus: async (req, res) => {
    const { name, email, message } = req.body || {};
    console.log("Raw req.body:", req.body);
    console.log("Destructured:", { name, email, message });
    let errors = {};

    // Validate name
    if (!name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
      errors.name = "Name should only contain letters";
    }

    // Validate email
    if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      errors.email = "Please enter a valid email address";
    }

    // Validate message
    if (!message || message.trim() === '') {
      errors.message = "Message cannot be empty";
    } else {
      // Count words in the message
      const wordCount = message.trim().split(/\s+/).length;
      if (wordCount > 200) {
        errors.message = "Message cannot exceed 200 words";
      }
    }

    // If there are any validation errors, render the form with errors
    if (Object.keys(errors).length > 0) {
      console.log('Contact us validation errors:', errors);
      return res.render('contactus', { name, email, message, errors, successMessage: null });
    }

    // Connect to database
    const db = await connectDB();

    // Insert the message into the database
    const doc = {
      name,
      email,
      message,
      submission_date: new Date(),
      status: 'pending'
    };
    const insert = await db.collection('contact').insertOne(doc);

    if (isSolrEnabled()) {
      try {
        const solr = createSolrService();
        await solr.indexDocument('contact', mapContactToSolrDoc({ ...doc, _id: insert.insertedId }));
      } catch (e) {
        console.error('[solr] Failed to index legacy contact message:', e?.message || e);
      }
    }
    console.log('Contact message submitted:', { name, email });

    // Redirect with success message
    res.redirect('/contactus?success-message=Message sent successfully!');
  },

  // ===================== CONTACT US (API / JSON) =====================
  apiContactus: async (req, res) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.apiContactus(db, req.body || {}, req.session);
      return res.json({ success: true, message: result.message });
    } catch (e) {
      console.error('API /api/contactus error:', e);
      const status = e.statusCode || 500;
      const body = { success: false, message: e.message || 'Failed to send message.' };
      if (e.errors) body.errors = e.errors;
      return res.status(status).json(body);
    }
  },

  // ===================== CONTACT US STATUS (API / JSON) =====================
  getMyContactQueries: async (req, res) => {
    try {
      const db = await connectDB();
      const result = await AuthApiService.getMyContactQueries(db, req.session);
      return res.json({ success: true, queries: result.queries });
    } catch (e) {
      console.error('API /api/contactus/my error:', e);
      const status = e.statusCode || 500;
      return res.status(status).json({ success: false, message: e.message || 'Failed to fetch your contact queries.' });
    }
  },

  // ===================== ADD FUNDS =====================
  addFunds: async (req, res) => {
    console.log('Add funds request body:', req.body);
    if (!req.session.userEmail) {
      console.log('Add funds failed: User not logged in');
      return res.redirect('/player/store?error-message=Please log in to add funds');
    }

    const { amount, redirectTo } = req.body;
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      console.log('Add funds failed: Invalid amount:', amount);
      return res.redirect(`${redirectTo}?error-message=Please enter a valid amount greater than 0`);
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, isDeleted: 0 });
    if (!user) {
      console.log('Add funds failed: User not found:', req.session.userEmail);
      return res.redirect(`${redirectTo}?error-message=User not found`);
    }

    try {
      await db.collection('user_balances').updateOne(
        { user_id: user._id },
        { $inc: { wallet_balance: amountNum } },
        { upsert: true }
      );
      console.log(`Funds added for user ${user.email}: ${amountNum}`);
      res.redirect(`${redirectTo}?success-message=Funds added successfully`);
    } catch (err) {
      console.error('Database error adding funds:', err);
      res.redirect(`${redirectTo}?error-message=Failed to add funds due to a server error`);
    }
  },

  // ===================== SUBSCRIBE =====================
  subscribe: async (req, res) => {
    if (!req.session.userEmail) {
      console.log('Subscription failed: User not logged in');
      return res.redirect('/?error-message=Please log in');
    }
    const { plan, price } = req.body;
    const priceNum = parseFloat(price);

    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, isDeleted: 0 });
    if (!user) {
      console.log('Subscription failed: User not found:', req.session.userEmail);
      return res.redirect('/player/subscription?error-message=User not found');
    }

    const balance = await db.collection('user_balances').findOne({ user_id: user._id });
    if (!balance || balance.wallet_balance < priceNum) {
      console.log('Subscription failed: Insufficient funds for', user.email);
      return res.redirect('/player/subscription?error-message=Insufficient funds');
    }

    // Check existing subscription and remove if expired
    const existingSubscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    if (existingSubscription && new Date() > new Date(existingSubscription.end_date)) {
      await db.collection('subscriptionstable').deleteOne({ username: req.session.userEmail });
      console.log(`Expired subscription removed for ${user.email}`);
    }

    // Proceed with new subscription
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30); // Set expiry to 30 days from start

    await db.collection('user_balances').updateOne(
      { user_id: user._id },
      { $inc: { wallet_balance: -priceNum } }
    );
    await db.collection('subscriptionstable').updateOne(
      { username: req.session.userEmail },
      { 
        $set: { 
          plan, 
          price: priceNum, 
          start_date: startDate, 
          end_date: endDate 
        } 
      },
      { upsert: true }
    );
    console.log(`User ${user.email} subscribed to ${plan} plan for ${priceNum}, expires on ${endDate}`);
    res.redirect('/player/subscription?success-message=Subscribed successfully');
  },

  // ===================== TOURNAMENT MANAGEMENT =====================
  tournamentManagement: async (req, res) => {
    const name = req.session.username;
    console.log('Adding tournament by:', name);
    console.log("Received request to add tournament:", req.body);
    const { tournamentName, tournamentDate, tournamentLocation, entryFee, type, noOfRounds, tournamentTime } = req.body;
    let errors = {};
    if (!tournamentName.trim()) errors.name = "Tournament Name is required.";
    if (!tournamentDate.trim()) errors.date = "Tournament Date is required.";
    if (!tournamentLocation.trim()) errors.location = "Location is required.";
    if (!entryFee || isNaN(entryFee) || entryFee < 0) errors.entryFee = "Valid Entry Fee is required.";

    const db = await connectDB();
    if (Object.keys(errors).length > 0) {
      console.log('Tournament addition failed due to validation errors:', errors);
      const tournaments = await db.collection('tournaments')
        .find({ added_by: name })
        .project({ name: 1, date: 1, time: 1, location: 1, entry_fee: 1, status: 1, type: 1, no_of_rounds: 1 })
        .sort({ date: -1 })
        .limit(200)
        .toArray();
      return res.render('coordinator/tournament_management', {
        errors,
        tournamentName,
        tournamentDate,
        tournamentLocation,
        tournamentTime,
        entryFee,
        type,
        noOfRounds,
        tournaments,
        successMessage: '',
        errorMessage: 'Please correct the errors below'
      });
    }

    const dateValue = new Date(tournamentDate);
    const doc = {
      name: tournamentName,
      date: dateValue,
      time: tournamentTime,
      location: tournamentLocation,
      entry_fee: parseFloat(entryFee),
      type,
      no_of_rounds: parseInt(noOfRounds),
      status: 'Pending',
      coordinator: name,
      coordinator_key: normalizeKey(name),
      added_by: name,
      added_by_key: normalizeKey(name),
      submitted_date: new Date()
    };
    const window = computeTournamentWindow(doc.date, doc.time);
    if (window) Object.assign(doc, window);
    await db.collection('tournaments').insertOne(doc);
    console.log('Tournament added:', { tournamentName, added_by: name });
    res.redirect("/coordinator/tournament_management?success-message=Tournament added successfully");
  },

  // ===================== APPROVE TOURNAMENT =====================
  approveTournament: async (req, res) => {
    const name = req.session.username;
    const { tournamentId } = req.body;

    // Step 1: Check if tournamentId exists
    if (!tournamentId) {
      console.log('Missing tournamentId in request body');
      return res.redirect('/organizer/organizer_tournament?error-message=Missing tournament ID');
    }

    // Step 2: Validate tournamentId format
    if (!ObjectId.isValid(tournamentId)) {
      console.log('Invalid tournamentId:', tournamentId);
      return res.redirect('/organizer/organizer_tournament?error-message=Invalid tournament ID');
    }

    // Step 3: Safely construct ObjectId and update the database
    const db = await connectDB();
    await db.collection('tournaments').updateOne(
      { _id: new ObjectId(tournamentId) },
      { $set: { status: 'Approved', approved_by: name, approved_by_key: normalizeKey(name), approved_date: new Date() } }
    );
    console.log(`Tournament ${tournamentId} approved by ${name}`);
    res.redirect('/organizer/organizer_tournament?success-message=Tournament approved successfully');
  },

  // ===================== REJECT TOURNAMENT =====================
  rejectTournament: async (req, res) => {
    const { tournamentId } = req.body;

    if (!tournamentId || !ObjectId.isValid(tournamentId)) {
      console.log('Invalid or missing tournamentId:', tournamentId);
      return res.redirect('/organizer/organizer_tournament?error-message=Invalid tournament ID');
    }

    const db = await connectDB();
    await db.collection('tournaments').updateOne(
      { _id: new ObjectId(tournamentId) },
      { $set: { status: 'Rejected', rejected_by: req.session?.username || req.session?.userEmail || '', rejected_by_key: normalizeKey(req.session?.username || req.session?.userEmail || ''), rejected_date: new Date() } }
    );
    console.log(`Tournament ${tournamentId} rejected`);
    res.redirect('/organizer/organizer_tournament?success-message=Tournament rejected successfully');
  },

  // ===================== JOIN TOURNAMENT =====================
  joinTournament: async (req, res) => {
    const { tournamentId, player1, player2, player3 } = req.body;

    if (!req.session.userEmail) {
      console.log('Join tournament failed: User not logged in');
      return res.redirect("/player/player_tournament?error-message=Please log in");
    }

    if (!tournamentId || typeof tournamentId !== 'string' || !ObjectId.isValid(tournamentId)) {
      console.log('Invalid or missing tournamentId:', tournamentId);
      return res.redirect('/player/player_tournament?error-message=Invalid tournament ID');
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ email: req.session.userEmail, role: 'player', isDeleted: 0 });
    if (!user) {
      console.log('Join tournament failed: User not found:', req.session.userEmail);
      return res.redirect('/player/player_tournament?error-message=User not found');
    }

    const tournament = await db.collection('tournaments').findOne({ _id: new ObjectId(tournamentId), status: 'Approved' });
    if (!tournament) {
      console.log('Join tournament failed: Tournament not found or not approved:', tournamentId);
      return res.redirect('/player/player_tournament?error-message=Tournament not found or not approved');
    }

    const balance = await db.collection('user_balances').findOne({ user_id: user._id });
    const currentBalance = parseFloat(balance?.wallet_balance || 0);
    const entryFee = parseFloat(tournament.entry_fee);
    if (currentBalance < entryFee) {
      console.log('Join tournament failed: Insufficient balance for', user.email);
      return res.redirect('/player/player_tournament?error-message=Insufficient wallet balance');
    }

    const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
    if (!subscription) {
      console.log('Join tournament failed: No subscription for', req.session.userEmail);
      return res.redirect('/player/player_tournament?error-message=Subscription required');
    }

    const newBalance = currentBalance - entryFee;
    await db.collection('user_balances').updateOne({ user_id: user._id }, { $set: { wallet_balance: newBalance } });

    if (player1 && player2 && player3) {
      let errors = {};
      if (!player1.trim()) errors.player1 = "Player 1 name is required";
      if (!player2.trim()) errors.player2 = "Player 2 name is required";
      if (!player3.trim()) errors.player3 = "Player 3 name is required";
      if (Object.keys(errors).length > 0) {
        console.log('Team join failed: Validation errors:', errors);
        return res.redirect("/player/player_tournament?error-message=All player names are required");
      }
      if (tournament.type !== 'Team') {
        console.log('Team join failed: Tournament is not a team event:', tournamentId);
        return res.redirect('/player/player_tournament?error-message=This is not a team tournament');
      }

      await db.collection('enrolledtournaments_team').insertOne({
        tournament_id: new ObjectId(tournamentId),
        captain_id: user._id,
        player1_name: player1,
        player2_name: player2,
        player3_name: player3,
        enrollment_date: new Date(),
        player1_approved: 0,
        player2_approved: 0,
        player3_approved: 0,
        approved: 0
      });
      await db.collection('tournaments').updateOne(
        { _id: new ObjectId(tournamentId) },
        { $inc: { team_enrollment_count: 1, revenue_total: entryFee }, $set: { updated_at: new Date() } }
      );
      console.log(`Team enrolled for tournament ${tournamentId} by captain ${user._id}`);
      res.redirect("/player/player_tournament?success-message=Team enrolled successfully");
    } else {
      if (tournament.type !== 'Individual') {
        console.log('Individual join failed: Tournament is not an individual event:', tournamentId);
        return res.redirect('/player/player_tournament?error-message=This is not an individual tournament');
      }

      await db.collection('tournament_players').insertOne({
        tournament_id: new ObjectId(tournamentId),
        username: req.session.username,
        college: user.college,
        gender: user.gender
      });
      await db.collection('tournaments').updateOne(
        { _id: new ObjectId(tournamentId) },
        { $inc: { individual_enrollment_count: 1, revenue_total: entryFee }, $set: { updated_at: new Date() } }
      );
      console.log(`Player ${user.email} joined tournament ${tournamentId}`);

      const updatedPlayers = await db.collection('tournament_players')
        .find({ tournament_id: new ObjectId(tournamentId) })
        .project({ _id: 1, username: 1, college: 1, gender: 1 })
        .toArray();

      const totalRounds = tournament.no_of_rounds || 5;
      const players = updatedPlayers.map(row => new Player(row._id, row.username, row.college, row.gender));
      const newPairings = swissPairing(players, totalRounds);

      await db.collection('tournament_pairings').updateOne(
        { tournament_id: new ObjectId(tournamentId) },
        {
          $set: {
            totalRounds: totalRounds,
            rounds: newPairings.map(round => ({
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
              byePlayer: round.byePlayer
                ? { id: round.byePlayer.id, username: round.byePlayer.username, score: round.byePlayer.score }
                : null
            }))
          }
        },
        { upsert: true }
      );

      console.log(`Pairings regenerated and stored for tournament ${tournamentId}`);
      res.redirect("/player/player_tournament?success-message=Joined tournament successfully");
    }
  },

  // ===================== APPROVE TEAM REQUEST =====================
  approveTeamRequest: async (req, res) => {
    const { requestId } = req.body;
    const username = req.session.username;
    if (!req.session.userEmail) {
      console.log('Approve request failed: User not logged in');
      return res.redirect('/login?error-message=Please log in');
    }

    if (!requestId || !ObjectId.isValid(requestId)) {
      console.log('Approve request failed: Invalid requestId:', requestId);
      return res.redirect('/player/player_dashboard?error-message=Invalid request ID');
    }

    const db = await connectDB();
    try {
      const request = await db.collection('enrolledtournaments_team').findOne({ _id: new ObjectId(requestId) });
      if (!request) {
        console.log('Approve request failed: Request not found:', requestId);
        return res.redirect('/player/player_dashboard?error-message=Request not found');
      }

      let updateField = {};
      if (request.player1_name === username) updateField.player1_approved = 1;
      else if (request.player2_name === username) updateField.player2_approved = 1;
      else if (request.player3_name === username) updateField.player3_approved = 1;
      else {
        console.log('Approve request failed: User not part of team:', { username, request });
        return res.redirect('/player/player_dashboard?error-message=You are not part of this team');
      }

      const result = await db.collection('enrolledtournaments_team').updateOne(
        { _id: new ObjectId(requestId) },
        { $set: updateField }
      );

      if (result.modifiedCount === 0) {
        console.log('Approve request failed: No changes made:', { requestId, updateField });
        return res.redirect('/player/player_dashboard?error-message=Failed to approve request');
      }

      const updatedRequest = await db.collection('enrolledtournaments_team').findOne({ _id: new ObjectId(requestId) });
      if (updatedRequest.player1_approved && updatedRequest.player2_approved && updatedRequest.player3_approved) {
        const approvalResult = await db.collection('enrolledtournaments_team').updateOne(
          { _id: new ObjectId(requestId), approved: { $ne: 1 } },
          { $set: { approved: 1 } }
        );
        if (approvalResult.modifiedCount > 0 && updatedRequest.tournament_id) {
          let tid = updatedRequest.tournament_id;
          try {
            if (typeof tid === 'string' && ObjectId.isValid(tid)) tid = new ObjectId(tid);
          } catch (e) { /* ignore */ }
          await db.collection('tournaments').updateOne(
            { _id: tid },
            { $inc: { team_approved_count: 1 }, $set: { updated_at: new Date() } }
          );
        }
        console.log(`Team fully approved for request: ${requestId}`);
      }

      console.log(`Team request approved by ${username} for request: ${requestId}`);
      res.redirect('/player/player_dashboard?success-message=Request approved successfully');
    } catch (err) {
      console.error('Error approving team request:', err);
      res.redirect('/player/player_dashboard?error-message=An error occurred while approving the request');
    }
  },

  // ===================== ADD PRODUCT =====================
  addProduct: async (req, res) => {
    // Optional multipart support for image file upload (field name: "productImage")
    try {
      if (multer && (req.headers['content-type'] || '').includes('multipart/form-data')) {
        const uploader = multer({
          storage: multer.memoryStorage(),
          limits: { fileSize: 2 * 1024 * 1024 },
          fileFilter: (r, file, cb) => {
            const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes((file.mimetype || '').toLowerCase());
            if (!ok) return cb(new Error('Only image files (jpg, png, webp, gif) are allowed.'));
            cb(null, true);
          }
        }).single('productImage');

        await new Promise((resolve, reject) => {
          uploader(req, res, (err) => (err ? reject(err) : resolve()));
        });
      }
    } catch (e) {
      console.error('Product image upload parse error:', e);
      return res.status(400).send(e.message || 'Invalid upload');
    }

    const { productName, productPrice, productImage, availability } = req.body;
    const coordinatorName = req.session.username;
    const collegeName = req.session.userCollege;

    let productImageUrl = (productImage || '').toString();
    let imagePublicId = '';

    if (req.file) {
      try {
        const result = await uploadImageBuffer(req.file.buffer, {
          folder: 'chesshive/product-images',
          public_id: `product_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          overwrite: false
        });
        productImageUrl = result?.secure_url || '';
        imagePublicId = result?.public_id || '';
      } catch (e) {
        console.error('Cloudinary upload failed:', e);
        return res.status(500).send('Failed to upload product image');
      }
    }

    if (!productName || !productPrice || !productImageUrl) {
      console.log('Add product failed: Missing fields');
      return res.send("All fields are required.");
    }

    const db = await connectDB();
    await db.collection('products').insertOne({
      name: productName,
      price: parseFloat(productPrice),
      image_url: productImageUrl,
      image_public_id: imagePublicId || undefined,
      coordinator: coordinatorName,
      coordinator_key: normalizeKey(coordinatorName),
      college: collegeName,
      college_key: normalizeKey(collegeName),
      availability: parseInt(availability)
    });
    console.log('Product added:', { productName, coordinator: coordinatorName });
    res.redirect('/coordinator/store_management');
  },

  // ===================== BUY PRODUCT =====================
  buyProduct: async (req, res) => {
    console.log("req.body:", req.body);
    console.log('Session:', req.session);
    const { productId, price, buyer, college } = req.body;

    if (!req.session.userEmail || !req.session.username || !req.session.userID) {
      console.log('Buy product failed: User not logged in');
      return res.redirect("/player/store?error-message=Please log in to make a purchase");
    }

    if (!productId || !ObjectId.isValid(productId)) {
      console.log('Invalid or missing productId:', productId);
      return res.redirect("/player/store?error-message=Invalid product ID");
    }

    if (!price || !buyer || !college) {
      console.log('Buy product failed: Missing required fields:', req.body);
      return res.redirect("/player/store?error-message=Missing required fields");
    }

    const originalPrice = parseFloat(price);
    if (isNaN(originalPrice) || originalPrice <= 0) {
      console.log('Buy product failed: Invalid price:', price);
      return res.redirect("/player/store?error-message=Invalid price");
    }

    if (buyer !== req.session.username) {
      console.log('Buy product failed: Unauthorized purchase attempt by', buyer);
      return res.redirect("/player/store?error-message=Unauthorized purchase attempt");
    }

    const userId = req.session.userID;
    const db = await connectDB();

    try {
      const product = await db.collection('products').findOne({ _id: new ObjectId(productId) });
      if (!product || product.availability <= 0) {
        console.log('Buy product failed: Product unavailable:', productId, product);
        return res.redirect("/player/store?error-message=Product is out of stock");
      }

      const subscription = await db.collection('subscriptionstable').findOne({ username: req.session.userEmail });
      let discountPercentage = 0;
      if (subscription) {
        if (subscription.plan === "Basic") discountPercentage = 10;
        else if (subscription.plan === "Premium") discountPercentage = 20;
      }

      const discountAmount = (originalPrice * discountPercentage) / 100;
      const finalPrice = originalPrice - discountAmount;
      console.log('Price details:', { originalPrice, discountPercentage, discountAmount, finalPrice });

      const balance = await db.collection('user_balances').findOne({ user_id: new ObjectId(userId) });
      const walletBalance = balance?.wallet_balance || 0;
      console.log('User balance from DB:', { userId, walletBalance });

      if (walletBalance < finalPrice) {
        console.log('Buy product failed: Insufficient funds for', req.session.userEmail, { walletBalance, finalPrice });
        return res.redirect("/player/store?error-message=Insufficient funds");
      }

      await db.collection('user_balances').updateOne(
        { user_id: new ObjectId(userId) },
        { $inc: { wallet_balance: -finalPrice } }
      );
      await db.collection('products').updateOne(
        { _id: new ObjectId(productId) },
        { $inc: { availability: -1 } }
      );
      await db.collection('sales').updateOne(
        { product_id: new ObjectId(productId), buyer_id: new ObjectId(userId) },
        {
          $inc: { quantity: 1, price: finalPrice },
          $set: {
            buyer,
            buyer_key: normalizeKey(buyer),
            college,
            purchase_date: new Date(),
            buyer_id: new ObjectId(userId)
          },
          $setOnInsert: { product_id: new ObjectId(productId) }
        },
        { upsert: true }
      );

      console.log(`Product ${productId} purchased by ${buyer} for ${finalPrice}`);
      res.redirect("/player/store?success-message=Purchase successful");
    } catch (err) {
      console.error('Buy product failed: Database error:', err);
      res.redirect("/player/store?error-message=Failed to process purchase due to a server error");
    }
  },

  // ===================== SCHEDULE MEETING (COORDINATOR) =====================
  scheduleMeetingCoordinator: async (req, res) => {
    const { title, date, time, link } = req.body;
    const db = await connectDB();
    await db.collection('meetingsdb').insertOne({
      title,
      date: new Date(date),
      time,
      link,
      role: req.session.userRole,
      name: req.session.username,
      name_key: normalizeKey(req.session.username),
      created_by: req.session.userEmail,
      created_by_key: normalizeKey(req.session.userEmail)
    });
    console.log('Meeting scheduled by coordinator:', { title, date });
    res.redirect('/coordinator/coordinator_meetings');
  },

  // ===================== SCHEDULE MEETING (ORGANIZER) =====================
  scheduleMeetingOrganizer: async (req, res) => {
    const { title, date, time, link } = req.body;
    const db = await connectDB();
    await db.collection('meetingsdb').insertOne({
      title,
      date: new Date(date),
      time,
      link,
      role: req.session.userRole,
      name: req.session.username,
      name_key: normalizeKey(req.session.username),
      created_by: req.session.userEmail,
      created_by_key: normalizeKey(req.session.userEmail)
    });
    console.log('Meeting scheduled by organizer:', { title, date });
    res.redirect('/organizer/meetings');
  },

  // ===================== SCHEDULE MEETING (ADMIN) =====================
  scheduleMeetingAdmin: async (req, res) => {
    const { title, date, time, link } = req.body;
    const db = await connectDB();
    await db.collection('meetingsdb').insertOne({
      title,
      date: new Date(date),
      time,
      link,
      role: req.session.userRole,
      name: req.session.username,
      name_key: normalizeKey(req.session.username),
      created_by: req.session.userEmail,
      created_by_key: normalizeKey(req.session.userEmail)
    });
    console.log('Meeting scheduled by admin:', { title, date });
    res.redirect('/admin/admin_meetings');
  },

  // ===================== FORGOT PASSWORD =====================
  forgotPassword: async (req, res) => {
    const { email } = req.body || {};
    try {
      const db = await connectDB();
      const result = await AuthApiService.forgotPassword(db, { email });
      return res.json({ success: true, message: result.message, emailSent: result.emailSent });
    } catch (err) {
      console.error('Forgot password error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Server error. Please try again.' });
    }
  },

  // ===================== VERIFY FORGOT PASSWORD OTP =====================
  verifyForgotPasswordOtp: async (req, res) => {
    const { email, otp } = req.body || {};
    try {
      const db = await connectDB();
      const result = await AuthApiService.verifyForgotPasswordOtp(db, { email, otp });
      return res.json({
        success: true,
        message: result.message,
        resetToken: result.resetToken
      });
    } catch (err) {
      console.error('Verify forgot password OTP error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Server error. Please try again.' });
    }
  },

  // ===================== RESET PASSWORD =====================
  resetPassword: async (req, res) => {
    const { email, resetToken, newPassword, confirmPassword } = req.body || {};
    try {
      const db = await connectDB();
      const result = await AuthApiService.resetPassword(db, { email, resetToken, newPassword, confirmPassword });
      return res.json({ success: true, message: result.message });
    } catch (err) {
      console.error('Reset password error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Server error. Please try again.' });
    }
  },

  // ===================== SET PASSWORD (ADMIN INVITE) =====================
  setPassword: async (req, res) => {
    const { token, password, confirmPassword } = req.body || {};
    try {
      const rawToken = String(token || '').trim();
      if (!rawToken) {
        return res.status(400).json({ success: false, message: 'Invite token is required' });
      }
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ success: false, message: 'Password is required' });
      }
      if (confirmPassword && password !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match' });
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters with one uppercase, one lowercase, and one special character'
        });
      }

      const db = await connectDB();
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const user = await db.collection('users').findOne({ inviteToken: tokenHash, role: 'admin' });
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid or expired invite token' });
      }
      const expiresAt = user.inviteExpires ? new Date(user.inviteExpires) : null;
      if (!expiresAt || Number.isNaN(expiresAt.getTime()) || new Date() > expiresAt) {
        return res.status(400).json({ success: false, message: 'Invite token has expired' });
      }
      if (user.status && user.status !== 'pending') {
        return res.status(400).json({ success: false, message: 'Invite already used' });
      }

      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            password: hashedPassword,
            status: 'active',
            inviteToken: null,
            inviteExpires: null
          }
        }
      );

      return res.json({ success: true, message: 'Password set successfully' });
    } catch (err) {
      console.error('Set password error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Server error. Please try again.' });
    }
  },

  // ===================== AUTH SERVICE METHODS (extracted from app.js) =====================

  /** POST /api/login */
  async login(req, res) {
    const { email, password } = req.body || {};
    try {
      const AuthService = require('../services/authService');
      const db = await connectDB();
      const result = await AuthService.login(db, email, password, req.session);
      return res.json({
        success: true,
        redirectUrl: result.redirectUrl,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
        user: result.user
      });
    } catch (err) {
      console.error('Login error:', err);
      const status = err.statusCode || 500;
      const body = { success: false, message: err.message || 'Unexpected server error' };
      if (err.restoreRequired) {
        body.restoreRequired = true;
        body.deletedUserId = err.deletedUserId;
        body.deletedUserRole = err.deletedUserRole;
      }
      return res.status(status).json(body);
    }
  },

  /** POST /api/logout */
  async logout(req, res) {
    try {
      const AuthService = require('../services/authService');
      const db = await connectDB();
      const { refreshToken } = req.body || {};
      await AuthService.logout(db, refreshToken, req.session);
      return res.json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      console.error('Logout error:', err);
      return res.json({ success: true, message: 'Logged out' });
    }
  },

  /** POST /api/token/refresh */
  async refreshToken(req, res) {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required', code: 'NO_REFRESH_TOKEN' });
    }
    try {
      const AuthService = require('../services/authService');
      const db = await connectDB();
      const result = await AuthService.rotateRefreshToken(db, refreshToken, req.session);
      return res.json({
        success: true,
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
        user: result.user
      });
    } catch (err) {
      console.error('Token refresh error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Server error', code: err.code });
    }
  },

  /** POST /api/token/revoke-all */
  async revokeAllTokens(req, res) {
    try {
      const AuthService = require('../services/authService');
      const db = await connectDB();
      await AuthService.revokeAllTokens(db, req);
      return res.json({ success: true, message: 'All sessions revoked' });
    } catch (err) {
      console.error('Revoke all tokens error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Server error' });
    }
  },

  /** POST /api/restore-account */
  async restoreAccount(req, res) {
    const { id, email, password } = req.body || {};
    if (!id || !email || !password) {
      return res.status(400).json({ success: false, message: 'id, email and password are required' });
    }
    try {
      const AuthService = require('../services/authService');
      const db = await connectDB();
      const result = await AuthService.restoreAccount(db, { id, email, password }, req.session);
      console.log(`Account restored for user: ${email}`);
      return res.json({ success: true, message: 'Account restored successfully!', redirectUrl: result.redirectUrl });
    } catch (err) {
      console.error('Restore account error:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, message: err.message || 'Unexpected server error' });
    }
  },

  /** GET /api/session */
  getSession(req, res) {
    const AuthService = require('../services/authService');
    return res.json(AuthService.getSession(req));
  },

  /** POST /api/verify-reactivation-otp – deprecated */
  verifyReactivationOtp(_req, res) {
    try {
      AuthApiService.verifyReactivationOtp();
      return res.json({ success: true });
    } catch (err) {
      const status = err.statusCode || 410;
      return res.status(status).json({
        success: false,
        message: err.message || 'Reactivation OTP flow has been removed. Please use Restore Account.'
      });
    }
  },

  /** GET /api/theme */
  async getTheme(req, res) {
    try {
      const db = await connectDB();
      const result = await AuthApiService.getTheme(db, req.session);
      return res.json({ success: true, theme: result.theme });
    } catch (e) {
      console.error('GET /api/theme error:', e);
      return res.status(500).json({ success: false, message: 'Failed to load theme' });
    }
  },

  /** POST /api/theme */
  async setTheme(req, res) {
    try {
      const db = await connectDB();
      const result = await AuthApiService.setTheme(db, req.body || {}, req.session);
      return res.json({ success: true, message: result.message || 'Theme saved' });
    } catch (e) {
      console.error('POST /api/theme error:', e);
      const status = e.statusCode || 500;
      return res.status(status).json({ success: false, message: e.message || 'Failed to save theme' });
    }
  }
};
