const buildCollectionModel = (collectionName) => ({
  findOne(db, filter, options) {
    return db.collection(collectionName).findOne(filter, options);
  },
  findManyCursor(db, filter = {}, options = {}) {
    const { projection, sort, limit, skip, hint, findOptions } = options || {};
    let cursor = db.collection(collectionName).find(filter, findOptions);
    if (projection) cursor = cursor.project(projection);
    if (sort) cursor = cursor.sort(sort);
    if (skip !== undefined && skip !== null) cursor = cursor.skip(skip);
    if (limit !== undefined && limit !== null) cursor = cursor.limit(limit);
    if (hint) cursor = cursor.hint(hint);
    return cursor;
  },
  findMany(db, filter = {}, options = {}) {
    return this.findManyCursor(db, filter, options).toArray();
  },
  async findManyPaginated(db, filter = {}, options = {}) {
    const { projection, sort, limit = 50, skip = 0, hint, findOptions } = options || {};
    const safeLimit = Math.max(0, Number(limit) || 0);
    const safeSkip = Math.max(0, Number(skip) || 0);

    const cursor = this.findManyCursor(db, filter, {
      projection,
      sort,
      limit: safeLimit,
      skip: safeSkip,
      hint,
      findOptions
    });

    const [items, total] = await Promise.all([
      cursor.toArray(),
      db.collection(collectionName).countDocuments(filter, findOptions)
    ]);

    return { items, total, limit: safeLimit, skip: safeSkip };
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
