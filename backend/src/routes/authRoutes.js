const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication – signup, login, OTP, password reset, token management
 */

// ─── Signup ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/signup:
 *   post:
 *     summary: Register a new user (sends OTP for verification)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, dob, gender, college, email, phone, password, role]
 *             properties:
 *               name:     { type: string }
 *               dob:      { type: string, format: date }
 *               gender:   { type: string, enum: [male, female, other] }
 *               college:  { type: string }
 *               email:    { type: string, format: email }
 *               phone:    { type: string }
 *               password: { type: string, minLength: 8 }
 *               role:     { type: string, enum: [admin, organizer, coordinator, player] }
 *               aicf_id:  { type: string }
 *               fide_id:  { type: string }
 *     responses:
 *       200:
 *         description: OTP sent – call /api/verify-signup-otp to complete
 *       400:
 *         description: Validation errors
 *       409:
 *         description: Email already registered
 */
router.post('/api/signup', authController.apiSignup);

/**
 * @swagger
 * /api/verify-signup-otp:
 *   post:
 *     summary: Verify OTP to complete signup
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string }
 *               otp:   { type: string }
 *     responses:
 *       200:
 *         description: Account created successfully
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/api/verify-signup-otp', authController.verifySignupOtp);

// ─── Login / Logout / Session ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful – returns access token, refresh token, and redirect URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:      { type: boolean }
 *                 accessToken:  { type: string }
 *                 refreshToken: { type: string }
 *                 expiresIn:    { type: number }
 *                 redirectUrl:  { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:       { type: string }
 *                     email:    { type: string }
 *                     role:     { type: string, enum: [admin, organizer, coordinator, player] }
 *                     username: { type: string }
 *                     college:  { type: string }
 *       400:
 *         description: Invalid credentials
 *       403:
 *         description: Account deleted or banned
 */
router.post('/api/login', authController.login);

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Logout and revoke the refresh token
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/api/logout', authController.logout);

/**
 * @swagger
 * /api/session:
 *   get:
 *     summary: Get current session / JWT info
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userEmail:     { type: string }
 *                 userRole:      { type: string }
 *                 username:      { type: string }
 *                 authenticated: { type: boolean }
 */
router.get('/api/session', authController.getSession);

// ─── Token management ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/token/refresh:
 *   post:
 *     summary: Rotate refresh token – get a new access + refresh token pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New token pair issued
 *       400:
 *         description: Refresh token required
 *       401:
 *         description: Invalid or revoked token
 */
router.post('/api/token/refresh', authController.refreshToken);

/**
 * @swagger
 * /api/token/revoke-all:
 *   post:
 *     summary: Revoke all sessions for the authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked
 *       401:
 *         description: Authentication required
 */
router.post('/api/token/revoke-all', authController.revokeAllTokens);

// ─── Account restore ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/restore-account:
 *   post:
 *     summary: Restore a self-deleted account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, email, password]
 *             properties:
 *               id:       { type: string }
 *               email:    { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Account restored
 *       400:
 *         description: Invalid credentials or already active
 *       403:
 *         description: Admin-removed account – cannot self-restore
 */
router.post('/api/restore-account', authController.restoreAccount);

/**
 * @swagger
 * /api/verify-reactivation-otp:
 *   post:
 *     summary: Deprecated – use /api/restore-account
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       410:
 *         description: Endpoint removed
 */
router.post('/api/verify-reactivation-otp', authController.verifyReactivationOtp);

// ─── Forgot password ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/forgot-password:
 *   post:
 *     summary: Request a password-reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       404:
 *         description: Email not found
 */
router.post('/api/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/verify-forgot-password-otp:
 *   post:
 *     summary: Verify password-reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string }
 *               otp:   { type: string }
 *     responses:
 *       200:
 *         description: OTP verified
 *       400:
 *         description: Invalid OTP
 */
router.post('/api/verify-forgot-password-otp', authController.verifyForgotPasswordOtp);

/**
 * @swagger
 * /api/reset-password:
 *   post:
 *     summary: Set a new password after OTP verification
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email:       { type: string }
 *               otp:         { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid OTP or weak password
 */
router.post('/api/reset-password', authController.resetPassword);

// ─── Contact ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/contactus:
 *   post:
 *     summary: Submit a contact/support message
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, message]
 *             properties:
 *               name:    { type: string }
 *               email:   { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Message submitted
 */
router.post('/api/contactus', authController.apiContactus);

/**
 * @swagger
 * /api/contactus/my:
 *   get:
 *     summary: Get the authenticated user's own contact queries
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of contact queries
 */
router.get('/api/contactus/my', authController.getMyContactQueries);

// ─── Theme ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/theme:
 *   get:
 *     summary: Get the current user's theme preference
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Theme preference
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 theme:   { type: string, enum: [light, dark] }
 *   post:
 *     summary: Save the current user's theme preference
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [theme]
 *             properties:
 *               theme: { type: string, enum: [light, dark] }
 *     responses:
 *       200:
 *         description: Theme saved
 *       400:
 *         description: Invalid theme value
 *       401:
 *         description: Not logged in
 */
router.get('/api/theme', authController.getTheme);
router.post('/api/theme', authController.setTheme);

// ─── Legacy EJS routes (backward-compatibility) ───────────────────────────────
/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Legacy signup (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/signup', authController.signup);
/**
 * @swagger
 * /contactus:
 *   post:
 *     summary: Legacy contact form (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/contactus', authController.contactus);
/**
 * @swagger
 * /player/add-funds:
 *   post:
 *     summary: Legacy add funds (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/player/add-funds', authController.addFunds);
/**
 * @swagger
 * /player/subscribe:
 *   post:
 *     summary: Legacy subscribe (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/player/subscribe', authController.subscribe);
/**
 * @swagger
 * /tournament_management:
 *   post:
 *     summary: Legacy tournament management (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/tournament_management', authController.tournamentManagement);
/**
 * @swagger
 * /organizer/approve-tournament:
 *   post:
 *     summary: Legacy organizer approval (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/organizer/approve-tournament', authController.approveTournament);
/**
 * @swagger
 * /organizer/reject-tournament:
 *   post:
 *     summary: Legacy organizer rejection (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/organizer/reject-tournament', authController.rejectTournament);
/**
 * @swagger
 * /player/join-tournament:
 *   post:
 *     summary: Legacy join tournament (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/player/join-tournament', authController.joinTournament);
/**
 * @swagger
 * /player/approve-team-request:
 *   post:
 *     summary: Legacy approve team request (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/player/approve-team-request', authController.approveTeamRequest);
/**
 * @swagger
 * /coordinator/add-product:
 *   post:
 *     summary: Legacy coordinator add product (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/coordinator/add-product', authController.addProduct);
/**
 * @swagger
 * /buy:
 *   post:
 *     summary: Legacy buy product (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/buy', authController.buyProduct);
/**
 * @swagger
 * /coordinator/coordinator_meetings/schedule:
 *   post:
 *     summary: Legacy coordinator meeting schedule (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/coordinator/coordinator_meetings/schedule', authController.scheduleMeetingCoordinator);
/**
 * @swagger
 * /meetings/schedule:
 *   post:
 *     summary: Legacy organizer meeting schedule (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/meetings/schedule', authController.scheduleMeetingOrganizer);
/**
 * @swagger
 * /admin_meetings/schedule:
 *   post:
 *     summary: Legacy admin meeting schedule (EJS)
 *     tags: [Auth]
 *     deprecated: true
 *     responses:
 *       200:
 *         description: Legacy flow response
 */
router.post('/admin_meetings/schedule', authController.scheduleMeetingAdmin);

module.exports = router;
