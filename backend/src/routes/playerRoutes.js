const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
const paymentController = require('../controllers/paymentController');

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

/**
 * @swagger
 * /player/api/growth_analytics:
 *   get:
 *     summary: Get detailed growth analytics
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Growth analytics data
 */
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

/**
 * @swagger
 * /player/api/profile/photo:
 *   post:
 *     summary: Upload player profile photo
 *     tags: [Player]
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

/**
 * @swagger
 * /player/players/restore/{id}:
 *   post:
 *     summary: Legacy player restore (EJS)
 *     tags: [Player]
 *     deprecated: true
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Account restored
 */
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

/**
 * @swagger
 * /player/api/wallet-transactions:
 *   get:
 *     summary: Get wallet transaction history
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet transactions list sorted by date (newest first)
 */
router.get('/api/wallet-transactions', playerController.getWalletTransactions);
// Razorpay endpoints (create order, verify payment)
/**
 * @swagger
 * /player/api/razorpay/create-order:
 *   post:
 *     summary: Create a Razorpay order
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Razorpay order created
 */
router.post('/api/razorpay/create-order', paymentController.createRazorpayOrder);

/**
 * @swagger
 * /player/api/razorpay/verify:
 *   post:
 *     summary: Verify a Razorpay payment
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment verified
 */
router.post('/api/razorpay/verify', paymentController.verifyRazorpayPayment);

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

/**
 * @swagger
 * /player/api/rankings:
 *   get:
 *     summary: Get individual rankings
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rankings data
 */
router.get('/api/rankings', playerController.getRankings);

/**
 * @swagger
 * /player/api/team-pairings:
 *   get:
 *     summary: Get team pairings
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team pairings data
 */
router.get('/api/team-pairings', playerController.getTeamPairings);

/**
 * @swagger
 * /player/api/team-rankings:
 *   get:
 *     summary: Get team rankings
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team rankings data
 */
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

/**
 * @swagger
 * /player/api/mark-notification-read:
 *   post:
 *     summary: Mark a notification as read
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
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

/**
 * @swagger
 * /player/api/cart/add:
 *   post:
 *     summary: Add an item to the cart
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Item added to cart
 */
router.post('/api/cart/add', playerController.addToCart);

/**
 * @swagger
 * /player/api/cart/remove:
 *   delete:
 *     summary: Remove an item from the cart
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Item removed from cart
 */
router.delete('/api/cart/remove', playerController.removeFromCart);

/**
 * @swagger
 * /player/api/cart/clear:
 *   delete:
 *     summary: Clear the cart
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
 */
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

/**
 * @swagger
 * /player/api/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel an order
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order cancelled
 */
router.post('/api/orders/:orderId/cancel', playerController.cancelOrder);

/**
 * @swagger
 * /player/api/orders/{orderId}/tracking:
 *   get:
 *     summary: Get order tracking details
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order tracking details
 */
router.get('/api/orders/:orderId/tracking', playerController.getOrderTracking);

/**
 * @swagger
 * /player/api/verify-delivery-otp:
 *   post:
 *     summary: Verify delivery OTP
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delivery verified
 */
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

/**
 * @swagger
 * /player/api/settings/wallpaper:
 *   post:
 *     summary: Upload a wallpaper image
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               wallpaper: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Wallpaper uploaded
 */
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

/**
 * @swagger
 * /player/api/reviews/{productId}:
 *   get:
 *     summary: Get reviews for a product
 *     tags: [Player]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product reviews
 */
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
