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
 * /api/streams:
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
 * /api/streams/{id}:
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
 * /api/name:
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
 * /api/dashboard:
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
 * /api/notifications:
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

/**
 * @swagger
 * /api/notifications/mark-read:
 *   post:
 *     summary: Mark coordinator notifications as read
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications marked as read
 */
router.post('/api/notifications/mark-read', coordinatorController.markNotificationsRead);

/**
 * @swagger
 * /api/profile:
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

/**
 * @swagger
 * /api/upload-photo:
 *   post:
 *     summary: Upload coordinator profile photo
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Photo uploaded
 */
router.post('/api/upload-photo', coordinatorController.uploadPhoto);
router.delete('/api/profile', coordinatorController.deleteProfile);

// ─── Tournaments ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/tournaments:
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

/**
 * @swagger
 * /api/tournaments/{id}:
 *   get:
 *     summary: Get tournament details
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
 *         description: Tournament details
 *   put:
 *     summary: Update a tournament
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
 *         description: Tournament updated
 *   delete:
 *     summary: Delete a tournament
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
 *         description: Tournament deleted
 */
router.get('/api/tournaments/:id', coordinatorController.getTournamentById);
router.post('/api/tournaments', coordinatorController.createTournament);
router.put('/api/tournaments/:id', coordinatorController.updateTournament);
router.delete('/api/tournaments/:id', coordinatorController.deleteTournament);

/**
 * @swagger
 * /api/tournaments/{id}/upload:
 *   post:
 *     summary: Upload tournament file (pairings, results, etc.)
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: File uploaded
 */
router.post('/api/tournaments/:id/upload', coordinatorController.uploadTournamentFileMiddleware, coordinatorController.uploadTournamentFile);

/**
 * @swagger
 * /api/tournaments/{id}/files:
 *   get:
 *     summary: List tournament files
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
 *         description: Tournament files
 */
router.get('/api/tournaments/:id/files', coordinatorController.getTournamentFiles);

/**
 * @swagger
 * /api/tournaments/{tournamentId}/files/{fileId}:
 *   delete:
 *     summary: Delete a tournament file
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tournamentId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: fileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: File deleted
 */
router.delete('/api/tournaments/:tournamentId/files/:fileId', coordinatorController.deleteTournamentFile);

// ─── Calendar ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/calendar:
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

/**
 * @swagger
 * /api/calendar/check-conflict:
 *   get:
 *     summary: Check calendar conflicts for a date
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conflict check result
 *   post:
 *     summary: Check calendar conflicts for a date
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conflict check result
 */
router.get('/api/calendar/check-conflict', coordinatorController.checkDateConflict);
router.post('/api/calendar/check-conflict', coordinatorController.checkDateConflict);

/**
 * @swagger
 * /api/calendar/{id}:
 *   delete:
 *     summary: Delete a calendar event
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

/**
 * @swagger
 * /coordinator/api/complaints/{id}/resolve:
 *   patch:
 *     summary: Resolve a complaint
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
 *         description: Complaint resolved
 *   post:
 *     summary: Resolve a complaint (legacy method)
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
 *         description: Complaint resolved
 */
router.patch('/api/complaints/:id/resolve', coordinatorController.resolveComplaint);
router.post('/api/complaints/:id/resolve', coordinatorController.resolveComplaint);

/**
 * @swagger
 * /coordinator/api/complaints/{id}/respond:
 *   post:
 *     summary: Respond to a complaint
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
 *         description: Response sent
 */
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

/**
 * @swagger
 * /coordinator/api/store/addproducts:
 *   post:
 *     summary: Add a product to the store
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Product added
 */
router.post('/api/store/addproducts', coordinatorController.addProduct);

/**
 * @swagger
 * /coordinator/api/store/products/{id}:
 *   put:
 *     summary: Update a product
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
 *         description: Product updated
 *   delete:
 *     summary: Delete a product
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
 *         description: Product deleted
 */
router.put('/api/store/products/:id', coordinatorController.updateProduct);
router.delete('/api/store/products/:id', coordinatorController.deleteProduct);

/**
 * @swagger
 * /coordinator/api/store/products/{id}/toggle-comments:
 *   patch:
 *     summary: Enable or disable product comments
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
 *         description: Comment settings updated
 */
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

/**
 * @swagger
 * /coordinator/api/store/orders/{id}/send-delivery-otp:
 *   post:
 *     summary: Send delivery OTP for an order
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
 *         description: OTP sent
 */
router.post('/api/store/orders/:id/send-delivery-otp', coordinatorController.sendDeliveryOtp);

/**
 * @swagger
 * /coordinator/api/store/orders/{id}/status:
 *   patch:
 *     summary: Update an order status
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
 *         description: Order status updated
 */
router.patch('/api/store/orders/:id/status', coordinatorController.updateOrderStatus);

/**
 * @swagger
 * /coordinator/api/store/analytics:
 *   get:
 *     summary: Get store order analytics
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store analytics
 */
router.get('/api/store/analytics', coordinatorController.getOrderAnalytics);

/**
 * @swagger
 * /coordinator/api/store/analytics/products/{productId}:
 *   get:
 *     summary: Get analytics for a product
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product analytics
 */
router.get('/api/store/analytics/products/:productId', coordinatorController.getProductAnalyticsDetails);

/**
 * @swagger
 * /coordinator/api/store/reviews:
 *   get:
 *     summary: Get product reviews
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product reviews
 */
router.get('/api/store/reviews', coordinatorController.getProductReviews);

/**
 * @swagger
 * /coordinator/api/store/complaints:
 *   get:
 *     summary: Get store order complaints
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order complaints
 */
router.get('/api/store/complaints', coordinatorController.getOrderComplaints);

/**
 * @swagger
 * /coordinator/api/store/complaints/{complaintId}/resolve:
 *   patch:
 *     summary: Resolve a store complaint
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: complaintId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Complaint resolved
 */
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
/**
 * @swagger
 * /coordinator/api/blogs/public:
 *   get:
 *     summary: List published blogs (public)
 *     tags: [Coordinator]
 *     responses:
 *       200:
 *         description: Published blogs
 */
router.get('/api/blogs/public', coordinatorController.getPublishedBlogsPublic);
router.get('/api/blogs', coordinatorController.getBlogs);
router.post('/api/blogs', coordinatorController.createBlog);

/**
 * @swagger
 * /coordinator/api/blogs/upload-images:
 *   post:
 *     summary: Upload images for a blog post
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images: { type: array, items: { type: string, format: binary } }
 *     responses:
 *       200:
 *         description: Images uploaded
 */
router.post('/api/blogs/upload-images', coordinatorController.uploadBlogImagesMiddleware, coordinatorController.uploadBlogImages);

/**
 * @swagger
 * /coordinator/api/blogs/{id}:
 *   get:
 *     summary: Get a blog post
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
 *         description: Blog post
 *   put:
 *     summary: Update a blog post
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
 *         description: Blog updated
 *   delete:
 *     summary: Delete a blog post
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
 *         description: Blog deleted
 */
router.get('/api/blogs/:id', coordinatorController.getBlogById);
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

/**
 * @swagger
 * /coordinator/api/meetings/organized:
 *   get:
 *     summary: Get meetings organized by the coordinator
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organized meetings
 */
router.get('/api/meetings/organized', coordinatorController.getOrganizedMeetings);

/**
 * @swagger
 * /coordinator/api/meetings/upcoming:
 *   get:
 *     summary: Get upcoming meetings
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming meetings
 */
router.get('/api/meetings/upcoming', coordinatorController.getUpcomingMeetings);

/**
 * @swagger
 * /coordinator/api/meetings/received:
 *   get:
 *     summary: Get received meeting requests
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Received meetings
 */
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

/**
 * @swagger
 * /coordinator/api/player-stats/{playerId}/details:
 *   get:
 *     summary: Get detailed stats for a player
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Player stats details
 */
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

/**
 * @swagger
 * /coordinator/api/rankings:
 *   get:
 *     summary: Get individual rankings
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rankings data
 */
router.get('/api/rankings', coordinatorController.getRankings);

/**
 * @swagger
 * /coordinator/api/team-pairings:
 *   get:
 *     summary: Get team pairings
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team pairings data
 */
router.get('/api/team-pairings', coordinatorController.getTeamPairings);

/**
 * @swagger
 * /coordinator/api/team-rankings:
 *   get:
 *     summary: Get team rankings
 *     tags: [Coordinator]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team rankings data
 */
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

/**
 * @swagger
 * /coordinator/feedback_view:
 *   get:
 *     summary: Legacy feedback view page
 *     tags: [Coordinator]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Feedback view page
 */
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

