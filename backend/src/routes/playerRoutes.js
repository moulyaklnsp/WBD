const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');

router.use(express.json());

/**
 * @swagger
 * tags:
 *   name: Player
 *   description: Player dashboard, tournaments, store, profile, settings, pairings, and rankings
 */

// ─── Dashboard & Tournaments ──────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/dashboard:
 *   get:
 *     summary: Player dashboard with tournament status
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/api/dashboard', playerController.getDashboard);

/**
 * @swagger
 * /player/api/tournaments:
 *   get:
 *     summary: List available tournaments to join
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament list
 */
router.get('/api/tournaments', playerController.getTournaments);

/**
 * @swagger
 * /player/api/join-individual:
 *   post:
 *     summary: Join a tournament as an individual player
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tournamentId]
 *             properties:
 *               tournamentId: { type: string }
 *     responses:
 *       200:
 *         description: Joined tournament
 */
router.post('/api/join-individual', playerController.joinIndividual);

/**
 * @swagger
 * /player/api/join-team:
 *   post:
 *     summary: Join a tournament as a team captain
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tournamentId, teamName, player1, player2, player3]
 *             properties:
 *               tournamentId: { type: string }
 *               teamName:     { type: string }
 *               player1:      { type: string }
 *               player2:      { type: string }
 *               player3:      { type: string }
 *     responses:
 *       200:
 *         description: Team join request submitted
 */
router.post('/api/join-team', playerController.joinTeam);

// ─── Store & Subscription ─────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/store:
 *   get:
 *     summary: Browse available store products
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product list
 */
router.get('/api/store', playerController.getStore);

/**
 * @swagger
 * /player/api/subscription:
 *   get:
 *     summary: Get current subscription details
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription details
 */
router.get('/api/subscription', playerController.getSubscription);

// ─── Growth ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/growth:
 *   get:
 *     summary: Player growth overview (wins, losses, rating trend)
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Growth data
 */
router.get('/api/growth', playerController.getGrowth);
router.get('/api/growth_analytics', playerController.getGrowthAnalytics);

// ─── Profile ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/profile:
 *   get:
 *     summary: Get player profile
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *   put:
 *     summary: Update player profile
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.get('/api/profile', playerController.getProfile);
router.post('/api/profile/photo', playerController.uploadPhotoMiddleware, playerController.uploadPhoto);
router.put('/api/profile', playerController.updateProfile);

/**
 * @swagger
 * /player/api/deleteAccount:
 *   delete:
 *     summary: Permanently delete player account
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/api/deleteAccount', playerController.deleteAccount);
router.post('/players/restore/:id', playerController.restorePlayer);

// ─── Compare ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/compare:
 *   get:
 *     summary: Compare your stats with another player
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Comparison data
 */
router.get('/api/compare', playerController.comparePlayer);

// ─── Funds ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/add-funds:
 *   post:
 *     summary: Top up wallet balance
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, minimum: 1 }
 *     responses:
 *       200:
 *         description: Funds added
 */
router.post('/api/add-funds', playerController.addFunds);

// ─── Pairings & Rankings ──────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/pairings:
 *   get:
 *     summary: Get individual pairings for your enrolled tournament
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pairings data
 */
router.get('/api/pairings', playerController.getPairings);
router.get('/api/rankings', playerController.getRankings);
router.get('/api/team-pairings', playerController.getTeamPairings);
router.get('/api/team-rankings', playerController.getTeamRankings);

// ─── Team approval ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/approve-team-request:
 *   post:
 *     summary: Accept or decline a team join request
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Request processed
 */
router.post('/api/approve-team-request', playerController.approveTeamRequest);

// ─── Store actions ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/buy:
 *   post:
 *     summary: Purchase a product from the store
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId]
 *             properties:
 *               productId: { type: string }
 *     responses:
 *       200:
 *         description: Purchase successful
 */
router.post('/api/buy', playerController.buyProduct);

/**
 * @swagger
 * /player/api/subscribe:
 *   post:
 *     summary: Subscribe to a plan
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan: { type: string, enum: [basic, pro, premium] }
 *     responses:
 *       200:
 *         description: Subscribed
 */
router.post('/api/subscribe', playerController.subscribePlan);

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/notifications:
 *   get:
 *     summary: Get player notifications
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notifications list
 */
router.get('/api/notifications', playerController.getNotifications);
router.post('/api/mark-notification-read', playerController.markNotificationRead);

// ─── Feedback ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/submit-feedback:
 *   post:
 *     summary: Submit tournament feedback
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tournamentId, rating]
 *             properties:
 *               tournamentId: { type: string }
 *               rating:       { type: integer, minimum: 1, maximum: 5 }
 *               comments:     { type: string }
 *     responses:
 *       200:
 *         description: Feedback submitted
 */
router.post('/api/submit-feedback', playerController.submitFeedback);

// ─── Streams ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/streams:
 *   get:
 *     summary: Get available live chess streams
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Streams list
 */
router.get('/api/streams', playerController.getPlayerStreams);

// ─── Tournament Calendar ──────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/tournament-calendar:
 *   get:
 *     summary: Tournament calendar events
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendar events
 */
router.get('/api/tournament-calendar', playerController.getTournamentCalendar);

// ─── Subscription history & plan change ──────────────────────────────────────

/**
 * @swagger
 * /player/api/subscription/history:
 *   get:
 *     summary: Get subscription history
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription history
 */
router.get('/api/subscription/history', playerController.getSubscriptionHistory);

/**
 * @swagger
 * /player/api/subscription/change:
 *   post:
 *     summary: Change subscription plan
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan: { type: string, enum: [basic, pro, premium] }
 *     responses:
 *       200:
 *         description: Plan changed
 */
router.post('/api/subscription/change', playerController.changeSubscriptionPlan);

// ─── Cart ─────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/cart:
 *   get:
 *     summary: Get cart contents
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart items
 */
router.get('/api/cart', playerController.getCart);
router.post('/api/cart/add', playerController.addToCart);
router.delete('/api/cart/remove', playerController.removeFromCart);
router.delete('/api/cart/clear', playerController.clearCart);

// ─── Orders ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/orders:
 *   get:
 *     summary: List player's orders
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Orders list
 *   post:
 *     summary: Place an order from cart
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Order placed
 */
router.get('/api/orders', playerController.getOrders);
router.post('/api/orders', playerController.createOrder);
router.post('/api/orders/:orderId/cancel', playerController.cancelOrder);
router.get('/api/orders/:orderId/tracking', playerController.getOrderTracking);
router.post('/api/verify-delivery-otp', playerController.verifyDeliveryOtp);

// ─── Store suggestions ────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/store/suggestions:
 *   get:
 *     summary: Get personalised product suggestions
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Suggestions list
 */
router.get('/api/store/suggestions', playerController.getStoreSuggestions);

// ─── Settings ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/settings:
 *   get:
 *     summary: Get player settings (notifications, piece style, wallpaper)
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings data
 *   put:
 *     summary: Update player settings
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings saved
 */
router.get('/api/settings', playerController.getSettings);
router.put('/api/settings', playerController.updateSettings);
router.post('/api/settings/wallpaper', playerController.uploadWallpaperMiddleware, playerController.uploadWallpaper);

// ─── Account ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/deactivateAccount:
 *   post:
 *     summary: Temporarily deactivate account
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated
 */
router.post('/api/deactivateAccount', playerController.deactivateAccount);

// ─── Complaints ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/complaints:
 *   post:
 *     summary: Submit a tournament complaint
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complaint submitted
 *   get:
 *     summary: Get my complaints
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complaint list
 */
router.post('/api/complaints', playerController.submitComplaint);
router.get('/api/complaints', playerController.getMyComplaints);

// ─── Reviews ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/reviews:
 *   post:
 *     summary: Submit a product review
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, rating]
 *             properties:
 *               productId: { type: string }
 *               rating:    { type: integer, minimum: 1, maximum: 5 }
 *               comment:   { type: string }
 *     responses:
 *       200:
 *         description: Review submitted
 */
router.post('/api/reviews', playerController.submitReview);
router.get('/api/reviews/:productId', playerController.getProductReviews);

// ─── Announcements ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/announcements:
 *   get:
 *     summary: Get platform announcements for players
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Announcements list
 */
router.get('/api/announcements', playerController.getAnnouncements);

// ─── News / Upcoming Events ──────────────────────────────────────────────────

/**
 * @swagger
 * /player/api/news:
 *   get:
 *     summary: Get platform updates and upcoming chess events for the dashboard
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: News with updates and events arrays
 */
router.get('/api/news', playerController.getNews);

module.exports = router;
