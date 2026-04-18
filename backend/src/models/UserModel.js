/**
 * UserModel – MongoDB repository for the `users` collection.
 * Controllers and services call these methods instead of hitting the DB directly.
 */
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;
const isBcryptHash = (v) => typeof v === 'string' && /^\$2[aby]\$/.test(v);

const UserModel = {
  /** Find a single user by email (case-insensitive stored as lowercase). */
  findByEmail(db, email) {
    return db.collection('users').findOne({ email });
  },

  /** Find a single user by MongoDB ObjectId string or ObjectId. */
  findById(db, id) {
    const oid = ObjectId.isValid(id) ? new ObjectId(id) : id;
    return db.collection('users').findOne({ _id: oid });
  },

  /** Find a user by id + email (used for account restore). */
  findByIdAndEmail(db, id, email) {
    const oid = ObjectId.isValid(id) ? new ObjectId(id) : id;
    return db.collection('users').findOne({ _id: oid, email });
  },

  /** Generic find-one with arbitrary filter. */
  findOne(db, filter, options) {
    return db.collection('users').findOne(filter, options);
  },

  /** Fetch many users with optional projection / limit. */
  find(db, filter = {}, options = {}) {
    const { projection, limit = 200 } = options;
    let cursor = db.collection('users').find(filter);
    if (projection) cursor = cursor.project(projection);
    return cursor.limit(limit).toArray();
  },

  /** Fetch many users with optional projection / sort / limit. */
  findMany(db, filter = {}, options = {}) {
    const { projection, sort, limit, skip } = options;
    let cursor = db.collection('users').find(filter);
    if (projection) cursor = cursor.project(projection);
    if (sort) cursor = cursor.sort(sort);
    if (skip !== undefined && skip !== null) cursor = cursor.skip(skip);
    if (limit !== undefined && limit !== null) cursor = cursor.limit(limit);
    return cursor.toArray();
  },

  /** Apply an update to a single user matched by filter. */
  updateOne(db, filter, update, options) {
    return db.collection('users').updateOne(filter, update, options);
  },

  /** Apply an update to multiple users matched by filter. */
  updateMany(db, filter, update, options) {
    return db.collection('users').updateMany(filter, update, options);
  },

  /** Create a new user document. */
  create(db, data) {
    return db.collection('users').insertOne({ ...data, createdAt: new Date() });
  },

  /** Run an aggregate pipeline for users. */
  aggregate(db, pipeline = [], options) {
    return db.collection('users').aggregate(pipeline, options).toArray();
  },

  /** Count users matching a filter. */
  countDocuments(db, filter = {}, options) {
    return db.collection('users').countDocuments(filter, options);
  },

  /**
   * Verify a plain or bcrypt password and migrate legacy plain-text on success.
   * Returns true if password matches, false otherwise.
   */
  async verifyPassword(db, user, plainPassword) {
    const stored = user?.password;
    if (!stored || typeof stored !== 'string') return false;
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) return false;

    if (isBcryptHash(stored)) {
      return bcrypt.compare(plainPassword, stored);
    }

    // Legacy plain-text – migrate on successful match
    if (stored === plainPassword) {
      const hashed = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { password: hashed } }
      );
      return true;
    }
    return false;
  },

  /** Check if an account was self-deleted (email === deleted_by). */
  isSelfDeleted(user) {
    const email = (user?.email || '').trim().toLowerCase();
    const deletedBy = (user?.deleted_by || '').trim().toLowerCase();
    return Boolean(email && deletedBy && email === deletedBy);
  }
};

module.exports = UserModel;
