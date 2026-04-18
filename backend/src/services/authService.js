/**
 * AuthService – business logic for authentication flows.
 * Controllers call these methods; they delegate DB work to models.
 */
const bcrypt = require('bcryptjs');
const { getModel } = require('../models');
const UserModel = getModel('users');
const TokenModel = getModel('refresh_tokens');
const { generateTokenPair, verifyRefreshToken, verifyAccessToken, extractTokenFromHeader } = require('../utils/jwt');

const AuthService = {
  /**
   * Authenticate a user with email + password.
   * Returns { user, tokens, redirectUrl } on success.
   * Throws an Error (with .statusCode) on failure.
   */
  async login(db, email, password, session) {
    const user = await UserModel.findByEmail(db, email);
    if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 400 });

    const passwordOk = await UserModel.verifyPassword(db, user, password);
    if (!passwordOk) throw Object.assign(new Error('Invalid credentials'), { statusCode: 400 });

    if (user.isDeleted) {
      if (!UserModel.isSelfDeleted(user)) {
        throw Object.assign(
          new Error('This account was removed by an administrator and cannot be restored through login. Please contact support.'),
          { statusCode: 403 }
        );
      }
      throw Object.assign(
        new Error('This account was deleted by you. Use Restore Account to reactivate.'),
        { statusCode: 403, restoreRequired: true, deletedUserId: user._id.toString(), deletedUserRole: user.role }
      );
    }

    // Session hydration
    if (session) {
      session.userID = user._id;
      session.userEmail = user.email;
      session.userRole = user.role;
      session.username = user.name;
      session.playerName = user.name;
      session.userCollege = user.college;
      session.collegeName = user.college;
      session.isSuperAdmin = Boolean(user.isSuperAdmin);
    }

    const tokens = generateTokenPair(user);
    await TokenModel.create(db, { userId: user._id, email: user.email, token: tokens.refreshToken });

    const redirectMap = {
      admin: '/admin/admin_dashboard',
      organizer: '/organizer/organizer_dashboard',
      coordinator: '/coordinator/coordinator_dashboard',
      player: '/player/player_dashboard?success-message=Player Login Successful'
    };
    const redirectUrl = redirectMap[user.role];
    if (!redirectUrl) throw Object.assign(new Error('Invalid Role'), { statusCode: 400 });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        isSuperAdmin: Boolean(user.isSuperAdmin),
        username: user.name,
        college: user.college
      },
      tokens,
      redirectUrl
    };
  },

  /**
   * Logout – revoke refresh token and destroy session.
   */
  async logout(db, refreshToken, session) {
    if (refreshToken) {
      await TokenModel.revokeByToken(db, refreshToken);
    }
    if (session) {
      await new Promise((resolve) => session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
        resolve();
      }));
    }
  },

  /**
   * Rotate refresh token – returns new token pair.
   */
  async rotateRefreshToken(db, refreshToken, session) {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401, code: 'INVALID_REFRESH_TOKEN' });

    const stored = await TokenModel.findByToken(db, refreshToken);
    if (!stored) throw Object.assign(new Error('Refresh token has been revoked'), { statusCode: 401, code: 'REVOKED_REFRESH_TOKEN' });

    const user = await UserModel.findOne(db, { email: decoded.email, isDeleted: { $ne: 1 } });
    if (!user) throw Object.assign(new Error('User no longer exists'), { statusCode: 401, code: 'USER_NOT_FOUND' });

    // Revoke old token (rotation)
    await TokenModel.revoke(db, stored._id);

    const tokens = generateTokenPair(user);
    await TokenModel.create(db, { userId: user._id, email: user.email, token: tokens.refreshToken });

    if (session) {
      session.userID = user._id;
      session.userEmail = user.email;
      session.userRole = user.role;
      session.username = user.name;
      session.userCollege = user.college;
      session.isSuperAdmin = Boolean(user.isSuperAdmin);
    }

    return {
      tokens,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        isSuperAdmin: Boolean(user.isSuperAdmin),
        username: user.name,
        college: user.college
      }
    };
  },

  /**
   * Revoke all active refresh tokens for the authenticated user.
   */
  async revokeAllTokens(db, req) {
    const token = extractTokenFromHeader(req);
    let userEmail = null;

    if (token) {
      const decoded = verifyAccessToken(token);
      if (decoded) userEmail = decoded.email;
    }
    if (!userEmail && req.session) userEmail = req.session.userEmail;
    if (!userEmail) throw Object.assign(new Error('Authentication required'), { statusCode: 401 });

    await TokenModel.revokeAll(db, userEmail);
  },

  /**
   * Restore a self-deleted account.
   * Returns { redirectUrl } on success.
   */
  async restoreAccount(db, { id, email, password }, session) {
    const { ObjectId } = require('mongodb');
    if (!ObjectId.isValid(id)) throw Object.assign(new Error('Invalid user id'), { statusCode: 400 });

    const user = await UserModel.findByIdAndEmail(db, id, email);
    if (!user) throw Object.assign(new Error('User not found or invalid credentials'), { statusCode: 400 });

    const passwordOk = await UserModel.verifyPassword(db, user, password);
    if (!passwordOk) throw Object.assign(new Error('User not found or invalid credentials'), { statusCode: 400 });

    if (!user.isDeleted) throw Object.assign(new Error('Account is already active'), { statusCode: 400 });
    if (!UserModel.isSelfDeleted(user)) {
      throw Object.assign(
        new Error('This account was removed by an administrator and cannot be self-restored.'),
        { statusCode: 403 }
      );
    }

    const upd = await UserModel.updateOne(
      db,
      { _id: new ObjectId(id) },
      { $set: { isDeleted: 0, restored_date: new Date(), restored_by: email }, $unset: { deleted_date: '', deleted_by: '' } }
    );
    if (upd.modifiedCount === 0) throw Object.assign(new Error('Failed to restore account'), { statusCode: 500 });

    if (session) {
      session.userID = user._id;
      session.userEmail = user.email;
      session.userRole = user.role;
      session.username = user.name;
      session.playerName = user.name;
      session.userCollege = user.college;
      session.collegeName = user.college;
      session.isSuperAdmin = Boolean(user.isSuperAdmin);
    }

    const redirectMap = {
      admin: '/admin/admin_dashboard',
      organizer: '/organizer/organizer_dashboard',
      coordinator: '/coordinator/coordinator_dashboard',
      player: '/player/player_dashboard?success-message=' + encodeURIComponent('Account restored successfully! Welcome back!')
    };
    return { redirectUrl: redirectMap[user.role] || '/' };
  },

  /**
   * Return session/JWT info for the current request.
   */
  getSession(req) {
    const token = extractTokenFromHeader(req);
    if (token) {
      const decoded = verifyAccessToken(token);
      if (decoded) {
        return {
          userEmail: decoded.email,
          userRole: decoded.role,
          isSuperAdmin: Boolean(decoded.isSuperAdmin),
          username: decoded.username,
          userId: decoded.userId,
          college: decoded.college,
          authenticated: true
        };
      }
    }
    return {
      userEmail: req.session?.userEmail || null,
      userRole: req.session?.userRole || null,
      isSuperAdmin: Boolean(req.session?.isSuperAdmin),
      username: req.session?.username || null,
      authenticated: !!(req.session?.userEmail)
    };
  }
};

module.exports = AuthService;
