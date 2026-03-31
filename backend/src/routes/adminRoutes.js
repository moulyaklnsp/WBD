const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.use(express.json());

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin dashboard, user management, payments, and analytics
 */

// ─── Dashboard ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get admin dashboard stats (revenue, player counts, meetings)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *       403:
 *         description: Unauthorized
 */
router.get('/api/dashboard', adminController.getDashboard);

// ─── Contact messages ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/contact:
 *   get:
 *     summary: List all contact/support messages
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Contact messages
 */
router.get('/api/contact', adminController.getContactMessages);

/**
 * @swagger
 * /api/contact/{id}/status:
 *   patch:
 *     summary: Update status of a contact message
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:        { type: string, enum: [open, resolved, pending] }
 *               internal_note: { type: string }
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/api/contact/:id/status', adminController.updateContactMessageStatus);

// ─── Tournaments ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/tournaments:
 *   get:
 *     summary: List all tournaments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament list
 */
router.get('/api/tournaments', adminController.getTournaments);

/**
 * @swagger
 * /api/tournaments/{id}/details:
 *   get:
 *     summary: Get tournament details
 *     tags: [Admin]
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
 *       404:
 *         description: Tournament not found
 */
router.get('/api/tournaments/:id/details', adminController.getTournamentDetails);

/**
 * @swagger
 * /api/tournaments/{id}:
 *   delete:
 *     summary: Remove a tournament
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tournament removed
 */
router.delete('/api/tournaments/:id', adminController.removeTournament);

// ─── Coordinator management ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/coordinators:
 *   get:
 *     summary: List all coordinators
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coordinator list
 */
router.get('/api/coordinators', adminController.getCoordinators);

/**
 * @swagger
 * /api/coordinators/{email}:
 *   delete:
 *     summary: Soft-delete a coordinator
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coordinator removed
 */
router.delete('/api/coordinators/:email', adminController.removeCoordinator);

/**
 * @swagger
 * /api/coordinators/restore/{email}:
 *   patch:
 *     summary: Restore a soft-deleted coordinator
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Coordinator restored
 */
router.patch('/api/coordinators/restore/:email', adminController.restoreCoordinator);

// Get Coordinator Details
/**
 * @swagger
 * /api/coordinators/{email}/details:
 *   get:
 *     summary: Get coordinator details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Coordinator details
 *       404:
 *         description: Coordinator not found
 */
router.get('/api/coordinators/:email/details', adminController.getCoordinatorDetails);

// ─── Organizer management ─────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/api/organizers:
 *   get:
 *     summary: List all organizers
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organizer list
 */
router.get('/api/organizers', adminController.getOrganizers);

/**
 * @swagger
 * /admin/api/organizers/{email}/details:
 *   get:
 *     summary: Get organizer details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Organizer details
 *       404:
 *         description: Organizer not found
 */
router.get('/api/organizers/:email/details', adminController.getOrganizerDetails);

/**
 * @swagger
 * /admin/api/organizers/{email}:
 *   delete:
 *     summary: Soft-delete an organizer
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organizer removed
 */
router.delete('/api/organizers/:email', adminController.removeOrganizer);

/**
 * @swagger
 * /admin/api/organizers/restore/{email}:
 *   patch:
 *     summary: Restore a soft-deleted organizer
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organizer restored
 */
router.patch('/api/organizers/restore/:email', adminController.restoreOrganizer);

// ─── Player management ────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/api/players:
 *   get:
 *     summary: List all players with purchase history
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player list
 */
router.get('/api/players', adminController.getPlayers);

/**
 * @swagger
 * /admin/api/players/{email}:
 *   delete:
 *     summary: Soft-delete a player
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Player removed
 */
router.delete('/api/players/:email', adminController.removePlayer);

/**
 * @swagger
 * /admin/api/players/restore/{email}:
 *   patch:
 *     summary: Restore a soft-deleted player
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Player restored
 */
router.patch('/api/players/restore/:email', adminController.restorePlayer);

// Get player details profile
/**
 * @swagger
 * /admin/api/players/{email}/details:
 *   get:
 *     summary: Get player profile details
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Player details
 *       404:
 *         description: Player not found
 */
router.get('/api/players/:email/details', adminController.getPlayerDetails);

// Get player stats details specifically for graphs
/**
 * @swagger
 * /admin/api/players/{playerId}/stats:
 *   get:
 *     summary: Get player stats for graphs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: playerId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Player stats data
 *       404:
 *         description: Player not found
 */
router.get('/api/players/:playerId/stats', adminController.getPlayerStatsVisualDetails);

// ─── Payments & Analytics ─────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/api/payments:
 *   get:
 *     summary: Revenue analytics with date filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Payment data
 */
router.get('/api/payments', adminController.getPayments);

/**
 * @swagger
 * /admin/api/analytics/organizers:
 *   get:
 *     summary: Organizer performance rankings
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organizer analytics
 */
router.get('/api/analytics/organizers', adminController.getOrganizerAnalytics);

/**
 * @swagger
 * /admin/api/analytics/growth:
 *   get:
 *     summary: Platform growth trends
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Growth analytics
 */
router.get('/api/analytics/growth', adminController.getGrowthAnalytics);

module.exports = router;
