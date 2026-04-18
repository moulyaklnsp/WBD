const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Real-time chat history, contacts, and media uploads
 */

/**
 * @swagger
 * /api/chat/history:
 *   get:
 *     summary: Get chat message history for a room
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: room
 *         schema:
 *           type: string
 *           default: global
 *         description: Room name (global or pm:<user1>:<user2>)
 *     responses:
 *       200:
 *         description: Last 50 messages in the room
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sender: { type: string }
 *                       message: { type: string }
 *                       timestamp: { type: string, format: date-time }
 *       500:
 *         description: Server error
 */
router.get('/api/chat/history', ChatController.getHistory);

/**
 * @swagger
 * /api/chat/contacts:
 *   get:
 *     summary: Get recent chat contacts for a user
 *     tags: [Chat]
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *         description: Username to fetch contacts for
 *     responses:
 *       200:
 *         description: List of recent contacts with last message info
 *       400:
 *         description: username is required
 *       500:
 *         description: Server error
 */
router.get('/api/chat/contacts', ChatController.getContacts);

/**
 * @swagger
 * /api/chat/upload:
 *   post:
 *     summary: Upload a chat image (max 5 MB)
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Uploaded image URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 url: { type: string }
 *       400:
 *         description: Invalid file or no file provided
 *       500:
 *         description: Upload failed
 */
router.post('/api/chat/upload', ChatController.uploadImage);

module.exports = router;
