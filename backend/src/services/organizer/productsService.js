const { connectDB } = require('../../config/database');
const { getModel } = require('../../models');
const ProductsModel = getModel('products');
const { normalizeKey } = require('../../utils/mongo');

const resolveDb = async (db) => (db ? db : connectDB());

const ProductsService = {
  async listProducts(db) {
    const database = await resolveDb(db);
    return ProductsModel.findMany(database, {}, { sort: { _id: -1 }, limit: 500 });
  },

  async listProductsByCoordinator(db, coordinatorName) {
    const database = await resolveDb(db);
    const key = normalizeKey(coordinatorName);
    if (!key) return [];
    return ProductsModel.findMany(
      database,
      {
        $or: [
          { coordinator_key: key },
          { coordinator: coordinatorName }
        ]
      },
      { sort: { _id: -1 }, limit: 500 }
    );
  }
};

module.exports = ProductsService;
