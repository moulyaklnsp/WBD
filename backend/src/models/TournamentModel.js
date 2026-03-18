/**
 * TournamentModel – MongoDB repository for the `tournaments` collection.
 */
const { ObjectId } = require('mongodb');

const TournamentModel = {
  /** Find all tournaments matching a filter. */
  findAll(db, filter = {}) {
    return db.collection('tournaments').find(filter).toArray();
  },

  /** Find many tournaments with optional projection / sort / limit. */
  findMany(db, filter = {}, options = {}) {
    const { projection, sort, limit, skip } = options;
    let cursor = db.collection('tournaments').find(filter);
    if (projection) cursor = cursor.project(projection);
    if (sort) cursor = cursor.sort(sort);
    if (skip) cursor = cursor.skip(skip);
    if (limit) cursor = cursor.limit(limit);
    return cursor.toArray();
  },

  /** Find a single tournament by id. */
  findById(db, id) {
    const oid = ObjectId.isValid(id) ? new ObjectId(id) : id;
    return db.collection('tournaments').findOne({ _id: oid });
  },

  /** Find one tournament with arbitrary filter. */
  findOne(db, filter) {
    return db.collection('tournaments').findOne(filter);
  },

  /** Create a new tournament. */
  create(db, data) {
    return db.collection('tournaments').insertOne({ ...data, createdAt: new Date() });
  },

  /** Insert a tournament without mutating fields. */
  insertOne(db, data, options) {
    return db.collection('tournaments').insertOne(data, options);
  },

  /** Update a single tournament matched by filter. */
  updateOne(db, filter, update, options) {
    return db.collection('tournaments').updateOne(filter, update, options);
  },

  /** Update multiple tournaments matched by filter. */
  updateMany(db, filter, update, options) {
    return db.collection('tournaments').updateMany(filter, update, options);
  },

  /** Update a single tournament by id. */
  updateById(db, id, update) {
    const oid = ObjectId.isValid(id) ? new ObjectId(id) : id;
    return db.collection('tournaments').updateOne({ _id: oid }, update);
  },

  /** Bulk-update status for an array of ObjectIds. */
  updateStatus(db, ids, status, extraFields = {}) {
    if (!ids || ids.length === 0) return Promise.resolve({ modifiedCount: 0 });
    return db.collection('tournaments').updateMany(
      { _id: { $in: ids } },
      { $set: { status, ...extraFields } }
    );
  },

  /** Delete a tournament by id. */
  deleteById(db, id) {
    const oid = ObjectId.isValid(id) ? new ObjectId(id) : id;
    return db.collection('tournaments').deleteOne({ _id: oid });
  },

  /** Delete a single tournament matched by filter. */
  deleteOne(db, filter, options) {
    return db.collection('tournaments').deleteOne(filter, options);
  },

  /** Run an aggregate pipeline for tournaments. */
  aggregate(db, pipeline = [], options) {
    return db.collection('tournaments').aggregate(pipeline, options).toArray();
  },

  /** Count tournaments matching a filter. */
  countDocuments(db, filter = {}, options) {
    return db.collection('tournaments').countDocuments(filter, options);
  }
};

module.exports = TournamentModel;
