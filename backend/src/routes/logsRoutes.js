const express = require('express');
const router = express.Router();
const LogsController = require('../controllers/logsController');

/**
 * @swagger
 * tags:
 *   name: Logs
 *   description: Frontend browser log ingestion
 */

/**
 * @swagger
 * /api/logs/frontend:
 *   post:
 *     summary: Receive a browser-side log entry and write it to frontend/logs/frontend.log
 *     tags: [Logs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               level:
 *                 type: string
 *                 enum: [debug, info, warn, error]
 *                 default: info
 *               message:
 *                 type: string
 *               context:
 *                 type: object
 *                 description: Any extra structured data to log
 *     responses:
 *       200:
 *         description: Log written successfully
 *       400:
 *         description: message field is required
 *       500:
 *         description: Failed to write log
 */
router.post('/api/logs/frontend', LogsController.logFrontend.bind(LogsController));

module.exports = router;
