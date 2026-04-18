const { connectDB } = require('../../config/database');
const { getModel } = require('../../models');
const ProductsModel = getModel('products');

const resolveDb = async (db) => (db ? db : connectDB());

const ProductsService = {
  async listProducts(db) {
    const database = await resolveDb(db);
    return ProductsModel.findMany(database, {});
  },

  async listProductsByCoordinator(db, coordinatorName) {
    const database = await resolveDb(db);
    return ProductsModel.findMany(database, { coordinator: coordinatorName });
  }
};

module.exports = ProductsService;
