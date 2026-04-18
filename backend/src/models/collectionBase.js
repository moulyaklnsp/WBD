const buildCollectionModel = (collectionName) => ({
  findOne(db, filter, options) {
    return db.collection(collectionName).findOne(filter, options);
  },
  findMany(db, filter = {}, options = {}) {
    const { projection, sort, limit, skip, hint, findOptions } = options || {};
    let cursor = db.collection(collectionName).find(filter, findOptions);
    if (projection) cursor = cursor.project(projection);
    if (sort) cursor = cursor.sort(sort);
    if (skip) cursor = cursor.skip(skip);
    if (limit) cursor = cursor.limit(limit);
    if (hint) cursor = cursor.hint(hint);
    return cursor.toArray();
  },
  insertOne(db, doc, options) {
    return db.collection(collectionName).insertOne(doc, options);
  },
  insertMany(db, docs, options) {
    return db.collection(collectionName).insertMany(docs, options);
  },
  updateOne(db, filter, update, options) {
    return db.collection(collectionName).updateOne(filter, update, options);
  },
  updateMany(db, filter, update, options) {
    return db.collection(collectionName).updateMany(filter, update, options);
  },
  deleteOne(db, filter, options) {
    return db.collection(collectionName).deleteOne(filter, options);
  },
  deleteMany(db, filter, options) {
    return db.collection(collectionName).deleteMany(filter, options);
  },
  countDocuments(db, filter = {}, options) {
    return db.collection(collectionName).countDocuments(filter, options);
  },
  aggregate(db, pipeline = [], options) {
    return db.collection(collectionName).aggregate(pipeline, options).toArray();
  }
});

module.exports = { buildCollectionModel };
