const { connectDB } = require('../../config/database');
const { insertWalletTransaction, requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const UserBalancesModel = getModel('user_balances');
const SubscriptionsModel = getModel('subscriptionstable');
const SubscriptionHistoryModel = getModel('subscription_history');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const SubscriptionService = {
  async getSubscription(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const rowResults = await UserModel.aggregate(database, [
      { $match: { email: user?.email, role: 'player', isDeleted: 0 } },
      { $lookup: { from: 'user_balances', localField: '_id', foreignField: 'user_id', as: 'balance' } },
      { $unwind: { path: '$balance', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, wallet_balance: '$balance.wallet_balance' } }
    ]);
    const row = rowResults?.[0];

    if (!row) {
      throw createError('User not found', 404);
    }

    let subscription = await SubscriptionsModel.findOne(database, { username: user?.email });
    if (subscription) {
      const now = new Date();
      if (now > new Date(subscription.end_date)) {
        await SubscriptionsModel.deleteOne(database, { username: user?.email });
        subscription = null;
      }
    }

    return {
      walletBalance: row.wallet_balance || 0,
      currentSubscription: subscription || null
    };
  },

  async subscribePlan(db, user, body) {
    requirePlayer(user);
    const { plan, price } = body || {};
    if (!plan || !price) {
      throw createError('Invalid request', 400);
    }

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, {
      email: user?.email,
      role: 'player',
      isDeleted: 0
    });

    if (!userDoc) {
      throw createError('User not found', 404);
    }

    const balanceDoc = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    const walletBalance = balanceDoc?.wallet_balance || 0;
    const numericPrice = parseFloat(price);

    if (walletBalance < numericPrice) {
      return { success: false, message: 'Insufficient wallet balance' };
    }

    await UserBalancesModel.updateOne(
      database,
      { user_id: userDoc._id },
      { $inc: { wallet_balance: -numericPrice } }
    );
    await insertWalletTransaction(database, userDoc._id, user?.email, 'debit', numericPrice, `Subscription to ${plan} Plan`);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(startDate.getMonth() + 1);

    const subscriptionDoc = {
      username: user?.email,
      plan,
      price: numericPrice,
      start_date: startDate,
      end_date: endDate
    };

    await SubscriptionsModel.updateOne(
      database,
      { username: user?.email },
      { $set: subscriptionDoc },
      { upsert: true }
    );

    await SubscriptionHistoryModel.insertOne(database, {
      user_email: user?.email,
      plan,
      price: numericPrice,
      date: startDate,
      action: 'new'
    });

    const updatedBalance = walletBalance - numericPrice;
    return {
      success: true,
      message: 'Subscription successful!',
      walletBalance: updatedBalance
    };
  },

  async getSubscriptionHistory(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const history = await SubscriptionHistoryModel.findMany(
      database,
      { user_email: user?.email },
      { sort: { date: -1 } }
    );

    return { history: history.map(h => ({ plan: h.plan, price: h.price, date: h.date, action: h.action })) };
  },

  async changeSubscriptionPlan(db, user, body) {
    requirePlayer(user);
    const { newPlan } = body || {};
    if (!newPlan) throw createError('New plan is required', 400);

    const planPrices = { Basic: 99, Premium: 199 };
    const newPrice = planPrices[newPlan];
    if (newPrice === undefined) throw createError('Invalid plan', 400);

    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) throw createError('User not found', 404);

    const currentSub = await SubscriptionsModel.findOne(database, { username: user?.email });
    if (!currentSub) throw createError('No active subscription to change', 400);

    const currentPrice = currentSub.price || 0;
    const diff = newPrice - currentPrice;
    const action = diff > 0 ? 'upgrade' : 'downgrade';

    if (diff > 0) {
      const balDoc = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
      const wallet = balDoc?.wallet_balance || 0;
      if (wallet < diff) throw createError(`Insufficient wallet balance. Need ₹${diff} more.`, 400);
      await UserBalancesModel.updateOne(database, { user_id: userDoc._id }, { $inc: { wallet_balance: -diff } });
    } else if (diff < 0) {
      await UserBalancesModel.updateOne(database, { user_id: userDoc._id }, { $inc: { wallet_balance: Math.abs(diff) } }, { upsert: true });
    }

    await SubscriptionsModel.updateOne(
      database,
      { username: user?.email },
      { $set: { plan: newPlan, price: newPrice } }
    );

    await SubscriptionHistoryModel.insertOne(database, {
      user_email: user?.email,
      plan: newPlan,
      price: newPrice,
      date: new Date(),
      action
    });

    return { success: true, message: `Plan ${action}d to ${newPlan} successfully!` };
  }
};

module.exports = SubscriptionService;
