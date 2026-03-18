const { connectDB } = require('../../config/database');
const { insertWalletTransaction, requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const UserBalancesModel = getModel('user_balances');
const WalletTransactionsModel = getModel('wallet_transactions');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const WalletService = {
  async addFunds(db, user, amount) {
    requirePlayer(user);
    const MAX_TOPUP_PER_REQUEST = 50000;
    const MAX_WALLET_BALANCE = 100000;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw createError('Invalid amount', 400);
    }
    if (numericAmount > MAX_TOPUP_PER_REQUEST) {
      throw createError(`You can add a maximum of ₹${MAX_TOPUP_PER_REQUEST} at once`, 400);
    }

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) {
      throw createError('User not found', 404);
    }

    const balanceDoc = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    const currentBalance = Number(balanceDoc?.wallet_balance || 0);
    if (currentBalance >= MAX_WALLET_BALANCE) {
      throw createError(`Wallet balance cannot exceed ₹${MAX_WALLET_BALANCE}`, 400);
    }
    if (currentBalance + numericAmount > MAX_WALLET_BALANCE) {
      const allowed = Math.max(0, MAX_WALLET_BALANCE - currentBalance);
      throw createError(`You can add only ₹${allowed} more. Wallet limit is ₹${MAX_WALLET_BALANCE}`, 400);
    }

    const cappedBalance = Math.min(currentBalance + numericAmount, MAX_WALLET_BALANCE);
    const result = await UserBalancesModel.updateOne(
      database,
      { user_id: userDoc._id },
      { $set: { wallet_balance: cappedBalance } },
      { upsert: true }
    );

    if (result.matchedCount === 0 && result.upsertedCount === 0) {
      throw createError('Failed to update balance', 500);
    }

    await insertWalletTransaction(database, userDoc._id, user?.email, 'credit', numericAmount, 'Add Funds to Wallet');

    return { success: true, walletBalance: cappedBalance, message: 'Funds added successfully' };
  },

  async getWalletTransactions(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) {
      throw createError('Player not found', 404);
    }

    const transactions = await WalletTransactionsModel.findMany(
      database,
      { user_id: userDoc._id },
      { sort: { date: -1 } }
    );

    return { success: true, transactions };
  }
};

module.exports = WalletService;
