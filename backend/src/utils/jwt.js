/**
 * JWT Utility Module for ChessHive
 * =================================
 * Handles access token (30 min) and refresh token (7 days) generation & verification.
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Secrets – use env vars in production, fallback for development
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'chesshive_access_secret_' + crypto.randomBytes(8).toString('hex');
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'chesshive_refresh_secret_' + crypto.randomBytes(8).toString('hex');

// Token lifetimes
const ACCESS_TOKEN_EXPIRY = '30m';   // 30 minutes
const REFRESH_TOKEN_EXPIRY = '7d';   // 7 days

/**
 * Generate an access token (short-lived, 30 min)
 * @param {Object} user - User object from DB
 * @returns {string} JWT access token
 */
function generateAccessToken(user) {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    isSuperAdmin: Boolean(user.isSuperAdmin),
    username: user.name || user.username,
    college: user.college || '',
    type: 'access'
  };
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Generate a refresh token (long-lived, 7 days)
 * @param {Object} user - User object from DB
 * @returns {string} JWT refresh token
 */
function generateRefreshToken(user) {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    type: 'refresh'
  };
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Verify an access token
 * @param {string} token - JWT access token
 * @returns {Object|null} Decoded payload or null if invalid
 */
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    if (decoded.type !== 'access') return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Verify a refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object|null} Decoded payload or null if invalid
 */
function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    if (decoded.type !== 'refresh') return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Generate both access and refresh tokens for a user
 * @param {Object} user - User object from DB
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: number }}
 */
function generateTokenPair(user) {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
    expiresIn: 30 * 60 // 30 minutes in seconds
  };
}

/**
 * Extract token from Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} Token string or null
 */
function extractTokenFromHeader(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader) return null;
  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return authHeader;
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  extractTokenFromHeader,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY
};
