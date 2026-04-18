/**
 * TokenModel – MongoDB repository for the `refresh_tokens` collection.
 */

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const TokenModel = {
  /** Persist a new refresh token for a user. */
  create(db, { userId, email, token }) {
    return db.collection('refresh_tokens').insertOne({
      userId,
      email,
      token,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revoked: false
    });
  },

  /** Find an active (non-revoked) refresh token by its string value. */
  findByToken(db, token) {
    return db.collection('refresh_tokens').findOne({ token, revoked: false });
  },

  /** Revoke a single refresh token by its document _id. */
  revoke(db, tokenId) {
    return db.collection('refresh_tokens').updateOne(
      { _id: tokenId },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
  },

  /** Revoke a single refresh token by its string value. */
  revokeByToken(db, token) {
    return db.collection('refresh_tokens').updateOne(
      { token },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
  },

  /** Revoke all active refresh tokens for a given user email. */
  revokeAll(db, userEmail) {
    return db.collection('refresh_tokens').updateMany(
      { email: userEmail, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
  }
};

module.exports = TokenModel;
