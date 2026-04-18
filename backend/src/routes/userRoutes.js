const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Cross-role user search
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Search users by role
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, organizer, coordinator, player]
 *         description: Filter by role (omit for all users)
 *     responses:
 *       200:
 *         description: List of users (password omitted)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       username: { type: string }
 *                       email: { type: string }
 *                       role: { type: string }
 *       500:
 *         description: Server error
 */
router.get('/api/users', UserController.getUsers);

module.exports = router;
