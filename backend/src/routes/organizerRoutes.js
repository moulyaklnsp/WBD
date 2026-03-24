const express = require('express');
const router = express.Router();
const organizerController = require('../controllers/organizerController');

router.use(express.json());

/**
 * @swagger
 * tags:
 *   name: Organizer
 *   description: Organizer dashboard, coordinator management, tournaments, sales, and meetings
 */

// ─── Dashboard & Profile ──────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/api/dashboard:
 *   get:
 *     summary: Get organizer dashboard (upcoming meetings & tournaments)
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/api/dashboard', organizerController.getDashboard);

/**
 * @swagger
 * /organizer/api/profile:
 *   get:
 *     summary: Get organizer profile
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile data
 *   put:
 *     summary: Update organizer profile
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:    { type: string }
 *               phone:   { type: string }
 *               college: { type: string }
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.get('/api/profile', organizerController.getProfile);
router.put('/api/profile', organizerController.updateProfile);

/**
 * @swagger
 * /organizer/api/upload-photo:
 *   post:
 *     summary: Upload organizer profile photo
 *     tags: [Organizer]
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
router.post('/api/upload-photo', organizerController.uploadPhoto);

// ─── Coordinator management ───────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/api/coordinators:
 *   get:
 *     summary: List coordinators under this organizer
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Coordinator list
 */
router.get('/api/coordinators', organizerController.getCoordinators);

/**
 * @swagger
 * /organizer/api/coordinators/{email}:
 *   delete:
 *     summary: Remove a coordinator
 *     tags: [Organizer]
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
router.delete('/api/coordinators/:email', organizerController.removeCoordinator);

/**
 * @swagger
 * /organizer/api/coordinators/restore/{email}:
 *   patch:
 *     summary: Restore a soft-deleted coordinator
 *     tags: [Organizer]
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
router.patch('/api/coordinators/restore/:email', organizerController.restoreCoordinator);

// ─── Tournaments ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/api/tournaments:
 *   get:
 *     summary: List tournaments pending approval
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament list
 */
router.get('/api/tournaments', organizerController.getTournaments);

/**
 * @swagger
 * /organizer/api/tournaments/approve:
 *   post:
 *     summary: Approve a tournament
 *     tags: [Organizer]
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
 *         description: Tournament approved
 */
router.post('/api/tournaments/approve', organizerController.approveTournament);

/**
 * @swagger
 * /organizer/api/tournaments/reject:
 *   post:
 *     summary: Reject a tournament
 *     tags: [Organizer]
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
 *               reason:       { type: string }
 *     responses:
 *       200:
 *         description: Tournament rejected
 */
router.post('/api/tournaments/reject', organizerController.rejectTournament);

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/api/store:
 *   get:
 *     summary: View store monitoring summary
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store data
 */
router.get('/api/store', organizerController.getStore);

// ─── Meetings ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/api/meetings:
 *   post:
 *     summary: Schedule a meeting
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, date, time, link]
 *             properties:
 *               title: { type: string }
 *               date:  { type: string, format: date }
 *               time:  { type: string }
 *               link:  { type: string }
 *     responses:
 *       200:
 *         description: Meeting scheduled
 */
router.post('/api/meetings', organizerController.scheduleMeeting);

/**
 * @swagger
 * /organizer/api/meetings/organized:
 *   get:
 *     summary: Get meetings organized by the organizer
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organized meetings
 */
router.get('/api/meetings/organized', organizerController.getOrganizedMeetings);

/**
 * @swagger
 * /organizer/api/meetings/upcoming:
 *   get:
 *     summary: Get upcoming meetings
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Upcoming meetings
 */
router.get('/api/meetings/upcoming', organizerController.getUpcomingMeetings);

// ─── Self-management ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/api/organizers/{email}:
 *   delete:
 *     summary: Organizer self-delete account
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/api/organizers/:email', organizerController.removeOrganizer);

// ─── Sales analysis ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /organizer/api/sales/monthly:
 *   get:
 *     summary: Monthly sales breakdown
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly sales data
 */
router.get('/api/sales/monthly', organizerController.getMonthlySales);

/**
 * @swagger
 * /organizer/api/sales/yearly:
 *   get:
 *     summary: Yearly sales breakdown
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Yearly sales data
 */
router.get('/api/sales/yearly', organizerController.getYearlySales);

/**
 * @swagger
 * /organizer/api/sales/tournament-revenue:
 *   get:
 *     summary: Tournament entry-fee revenue
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tournament revenue data
 */
router.get('/api/sales/tournament-revenue', organizerController.getTournamentRevenue);

/**
 * @swagger
 * /organizer/api/sales/store-revenue:
 *   get:
 *     summary: Store product sales revenue
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store revenue data
 */
router.get('/api/sales/store-revenue', organizerController.getStoreRevenue);

/**
 * @swagger
 * /organizer/api/sales/insights:
 *   get:
 *     summary: Combined revenue insights
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue insights
 */
router.get('/api/sales/insights', organizerController.getRevenueInsights);

/**
 * @swagger
 * /organizer/api/coordinator-performance:
 *   get:
 *     summary: Coordinator performance rankings
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance data
 */
router.get('/api/coordinator-performance', organizerController.getCoordinatorPerformance);

/**
 * @swagger
 * /organizer/api/growth-analysis:
 *   get:
 *     summary: Comprehensive growth metrics
 *     tags: [Organizer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Growth analysis data
 */
router.get('/api/growth-analysis', organizerController.getGrowthAnalysis);

module.exports = router;

