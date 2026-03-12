const express = require('express');
const router = express.Router();
const coordinatorController = require('../controllers/coordinatorController');

router.use(express.json());

/**
 * @swagger
 * tags:
 *   name: Coordinator
 *   description: Tournament management, store, pairings, rankings, blogs, meetings, and streams
 */

// ─── Streams ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/streams:
 *   get:
 *     summary: List all live streams
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Streams list
 *   post:
 *     summary: Create a new stream
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, url, platform]
 *             properties:
 *               title:    { type: string }
 *               url:      { type: string }
 *               platform: { type: string, enum: [youtube, twitch, other] }
 *               isLive:   { type: boolean }
 *     responses:
 *       201:
 *         description: Stream created
 */
router.get('/api/streams', coordinatorController.getStreams);
router.post('/api/streams', coordinatorController.createStream);

/**
 * @swagger
 * /coordinator/api/streams/{id}:
 *   patch:
 *     summary: Update a stream
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Stream updated
 *   delete:
 *     summary: Delete a stream
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Stream deleted
 */
router.patch('/api/streams/:id', coordinatorController.updateStream);
router.delete('/api/streams/:id', coordinatorController.deleteStream);

// ─── Dashboard & Profile ──────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/name:
 *   get:
 *     summary: Get coordinator display name
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coordinator name
 */
router.get('/api/name', coordinatorController.getName);

/**
 * @swagger
 * /coordinator/api/dashboard:
 *   get:
 *     summary: Coordinator dashboard with notifications
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/api/dashboard', coordinatorController.getDashboard);

/**
 * @swagger
 * /coordinator/api/notifications:
 *   get:
 *     summary: Get coordinator notifications
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications list
 */
router.get('/api/notifications', coordinatorController.getNotifications);
router.post('/api/notifications/mark-read', coordinatorController.markNotificationsRead);

/**
 * @swagger
 * /coordinator/api/profile:
 *   get:
 *     summary: Get coordinator profile
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *   put:
 *     summary: Update coordinator profile
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated
 *   delete:
 *     summary: Delete coordinator account
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.get('/api/profile', coordinatorController.getProfile);
router.put('/api/profile', coordinatorController.updateProfile);
router.post('/api/upload-photo', coordinatorController.uploadPhoto);
router.delete('/api/profile', coordinatorController.deleteProfile);

// ─── Tournaments ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/tournaments:
 *   get:
 *     summary: List coordinator's tournaments
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament list
 *   post:
 *     summary: Create a tournament
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, date, time, location, entry_fee, no_of_rounds, type]
 *             properties:
 *               name:         { type: string }
 *               date:         { type: string, format: date }
 *               time:         { type: string }
 *               location:     { type: string }
 *               entry_fee:    { type: number }
 *               no_of_rounds: { type: integer }
 *               type:         { type: string, enum: [individual, team] }
 *     responses:
 *       201:
 *         description: Tournament created
 */
router.get('/api/tournaments', coordinatorController.getTournaments);
router.get('/api/tournaments/:id', coordinatorController.getTournamentById);
router.post('/api/tournaments', coordinatorController.createTournament);
router.put('/api/tournaments/:id', coordinatorController.updateTournament);
router.delete('/api/tournaments/:id', coordinatorController.deleteTournament);
router.post('/api/tournaments/:id/upload', coordinatorController.uploadTournamentFileMiddleware, coordinatorController.uploadTournamentFile);
router.get('/api/tournaments/:id/files', coordinatorController.getTournamentFiles);
router.delete('/api/tournaments/:tournamentId/files/:fileId', coordinatorController.deleteTournamentFile);

// ─── Calendar ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/calendar:
 *   get:
 *     summary: Get calendar events
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendar events
 *   post:
 *     summary: Create a calendar event
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Event created
 */
router.get('/api/calendar', coordinatorController.getCalendarEvents);
router.post('/api/calendar', coordinatorController.createCalendarEvent);
router.get('/api/calendar/check-conflict', coordinatorController.checkDateConflict);
router.post('/api/calendar/check-conflict', coordinatorController.checkDateConflict);
router.delete('/api/calendar/:id', coordinatorController.deleteCalendarEvent);

// ─── Complaints ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/complaints:
 *   get:
 *     summary: List tournament complaints
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complaints list
 */
router.get('/api/complaints', coordinatorController.getComplaints);
router.patch('/api/complaints/:id/resolve', coordinatorController.resolveComplaint);
router.post('/api/complaints/:id/resolve', coordinatorController.resolveComplaint);
router.post('/api/complaints/:id/respond', coordinatorController.respondComplaint);

// ─── Store / Products ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/store/products:
 *   get:
 *     summary: List products in the coordinator's store
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product list
 */
router.get('/api/store/products', coordinatorController.getProducts);
router.post('/api/store/addproducts', coordinatorController.addProduct);
router.put('/api/store/products/:id', coordinatorController.updateProduct);
router.delete('/api/store/products/:id', coordinatorController.deleteProduct);
router.patch('/api/store/products/:id/toggle-comments', coordinatorController.toggleComments);

// ─── Store / Orders & Analytics ───────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/store/orders:
 *   get:
 *     summary: List store orders
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders list
 */
router.get('/api/store/orders', coordinatorController.getOrders);
router.post('/api/store/orders/:id/send-delivery-otp', coordinatorController.sendDeliveryOtp);
router.patch('/api/store/orders/:id/status', coordinatorController.updateOrderStatus);
router.get('/api/store/analytics', coordinatorController.getOrderAnalytics);
router.get('/api/store/analytics/products/:productId', coordinatorController.getProductAnalyticsDetails);
router.get('/api/store/reviews', coordinatorController.getProductReviews);
router.get('/api/store/complaints', coordinatorController.getOrderComplaints);
router.patch('/api/store/complaints/:complaintId/resolve', coordinatorController.resolveOrderComplaint);

// ─── Blogs ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/blogs:
 *   get:
 *     summary: List blog posts
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blog list
 *   post:
 *     summary: Create a blog post
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Blog created
 */
router.get('/api/blogs/public', coordinatorController.getPublishedBlogsPublic);
router.get('/api/blogs', coordinatorController.getBlogs);
router.post('/api/blogs', coordinatorController.createBlog);
router.put('/api/blogs/:id', coordinatorController.updateBlog);
router.delete('/api/blogs/:id', coordinatorController.deleteBlog);

// ─── Meetings ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/meetings:
 *   post:
 *     summary: Schedule a meeting
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Meeting scheduled
 */
router.post('/api/meetings', coordinatorController.scheduleMeeting);
router.get('/api/meetings/organized', coordinatorController.getOrganizedMeetings);
router.get('/api/meetings/upcoming', coordinatorController.getUpcomingMeetings);
router.get('/api/meetings/received', coordinatorController.getReceivedMeetings);

// ─── Announcements ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/announcements:
 *   post:
 *     summary: Post an announcement to players
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message, target_role]
 *             properties:
 *               title:       { type: string }
 *               message:     { type: string }
 *               target_role: { type: string, enum: [player, all] }
 *     responses:
 *       200:
 *         description: Announcement posted
 */
router.post('/api/announcements', coordinatorController.postAnnouncement);

// ─── Player stats & enrolled players ─────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/player-stats:
 *   get:
 *     summary: Get player stats for the coordinator's tournament
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player stats
 */
router.get('/api/player-stats', coordinatorController.getPlayerStats);
router.get('/api/player-stats/:playerId/details', coordinatorController.getPlayerStatsDetails);

/**
 * @swagger
 * /coordinator/api/enrolled-players:
 *   get:
 *     summary: Get enrolled players list
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Enrolled players
 */
router.get('/api/enrolled-players', coordinatorController.getEnrolledPlayers);

// ─── Pairings & Rankings ──────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/pairings:
 *   get:
 *     summary: Get individual pairings (Swiss algorithm)
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pairings data
 */
router.get('/api/pairings', coordinatorController.getPairings);
router.get('/api/rankings', coordinatorController.getRankings);
router.get('/api/team-pairings', coordinatorController.getTeamPairings);
router.get('/api/team-rankings', coordinatorController.getTeamRankings);

// ─── Feedback ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /coordinator/api/tournaments/{id}/request-feedback:
 *   post:
 *     summary: Send feedback request to enrolled players
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Feedback request sent
 */
router.post('/api/tournaments/:id/request-feedback', coordinatorController.requestFeedback);

/**
 * @swagger
 * /coordinator/api/feedbacks:
 *   get:
 *     summary: Get feedback for coordinator's tournaments
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feedback list
 */
router.get('/api/feedbacks', coordinatorController.getFeedbacks);
router.get('/feedback_view', coordinatorController.getFeedbackView);

// ─── Chess Events (Upcoming Events for Player Dashboard) ──────────────────────

/**
 * @swagger
 * /coordinator/api/chess-events:
 *   get:
 *     summary: List all chess events created by this coordinator
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chess events list
 *   post:
 *     summary: Create a chess event (talks, alerts, announcements, etc.)
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, date, category]
 *             properties:
 *               title:       { type: string }
 *               description: { type: string }
 *               date:        { type: string, format: date-time }
 *               category:    { type: string, enum: [Chess Talk, Tournament Alert, Live Announcement, Workshop, Webinar, Exhibition Match, Other] }
 *               location:    { type: string }
 *               link:        { type: string }
 *     responses:
 *       201:
 *         description: Event created
 */
router.get('/api/chess-events', coordinatorController.getChessEvents);
router.post('/api/chess-events', coordinatorController.createChessEvent);

/**
 * @swagger
 * /coordinator/api/chess-events/{id}:
 *   put:
 *     summary: Update a chess event
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event updated
 *   delete:
 *     summary: Delete a chess event
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Event deleted
 */
router.put('/api/chess-events/:id', coordinatorController.updateChessEvent);
router.delete('/api/chess-events/:id', coordinatorController.deleteChessEvent);

module.exports = router;

