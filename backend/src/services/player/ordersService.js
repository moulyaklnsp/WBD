const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { insertWalletTransaction, normalizeProductImages, requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const CartModel = getModel('cart');
const ProductsModel = getModel('products');
const UserModel = getModel('users');
const SubscriptionsModel = getModel('subscriptionstable');
const UserBalancesModel = getModel('user_balances');
const SalesModel = getModel('sales');
const OrdersModel = getModel('orders');
const OtpsModel = getModel('otps');
const { normalizeKey } = require('../../utils/mongo');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const OrdersService = {
  async getCart(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const cart = await CartModel.findOne(database, { user_email: user?.email });
    return { items: cart?.items || [] };
  },

  async addToCart(db, user, body) {
    requirePlayer(user);
    const { productId, quantity } = body || {};
    if (!productId) throw createError('Product ID is required', 400);
    const qty = parseInt(quantity) || 1;

    const database = await resolveDb(db);
    const product = await ProductsModel.findOne(database, { _id: new ObjectId(productId) });
    if (!product) throw createError('Product not found', 404);
    if (product.availability <= 0) throw createError('Product out of stock', 400);
    const productImages = normalizeProductImages(product);
    const productImage = productImages[0] || null;

    const cart = await CartModel.findOne(database, { user_email: user?.email });
    if (cart) {
      const existingItem = (cart.items || []).find(i => i.productId.toString() === productId);
      if (existingItem) {
        await CartModel.updateOne(
          database,
          { user_email: user?.email, 'items.productId': new ObjectId(productId) },
          { $inc: { 'items.$.quantity': qty } }
        );
      } else {
        await CartModel.updateOne(
          database,
          { user_email: user?.email },
          { $push: { items: { productId: new ObjectId(productId), name: product.name, price: product.price, image: productImage, quantity: qty } } }
        );
      }
    } else {
      await CartModel.insertOne(database, {
        user_email: user?.email,
        items: [{ productId: new ObjectId(productId), name: product.name, price: product.price, image: productImage, quantity: qty }]
      });
    }

    const updated = await CartModel.findOne(database, { user_email: user?.email });
    return { success: true, items: updated?.items || [] };
  },

  async removeFromCart(db, user, body) {
    requirePlayer(user);
    const { productId } = body || {};
    if (!productId) throw createError('Product ID is required', 400);

    const database = await resolveDb(db);
    await CartModel.updateOne(
      database,
      { user_email: user?.email },
      { $pull: { items: { productId: new ObjectId(productId) } } }
    );

    const updated = await CartModel.findOne(database, { user_email: user?.email });
    return { success: true, items: updated?.items || [] };
  },

  async clearCart(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    await CartModel.updateOne(
      database,
      { user_email: user?.email },
      { $set: { items: [] } }
    );
    return { success: true, items: [] };
  },

  async createOrder(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player', isDeleted: 0 });
    if (!userDoc) throw createError('User not found', 404);

    const cart = await CartModel.findOne(database, { user_email: user?.email });
    if (!cart || !cart.items || cart.items.length === 0) {
      throw createError('Cart is empty', 400);
    }

    const subscription = await SubscriptionsModel.findOne(database, { username: user?.email });
    let discountPercentage = 0;
    if (subscription) {
      if (subscription.plan === 'Basic') discountPercentage = 10;
      else if (subscription.plan === 'Premium') discountPercentage = 20;
    }

    let total = 0;
    for (const item of cart.items) {
      const discountedPrice = item.price * (1 - discountPercentage / 100);
      total += discountedPrice * item.quantity;
    }
    total = Math.round(total * 100) / 100;

    const balDoc = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    const wallet = balDoc?.wallet_balance || 0;
    if (wallet < total) throw createError(`Insufficient balance. Need ₹${total}, have ₹${wallet}`, 400);

    await UserBalancesModel.updateOne(database, { user_id: userDoc._id }, { $inc: { wallet_balance: -total } });
    await insertWalletTransaction(database, userDoc._id, user?.email, 'debit', total, 'Store Purchase: Cart Order');

    const now = new Date();
    const productIds = (cart.items || []).map((i) => i.productId).filter(Boolean);

    // Fetch product metadata once (avoids N+1).
    const productDocs = productIds.length
      ? await ProductsModel.findMany(database, { _id: { $in: productIds } }, { projection: { coordinator: 1, college: 1 } })
      : [];
    const productMap = new Map((productDocs || []).map((p) => [String(p._id), p]));

    // Bulk stock decrement + sales upserts (reduce round trips).
    const productOps = [];
    const salesOps = [];
    for (const item of cart.items) {
      productOps.push({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { availability: -item.quantity } }
        }
      });
      salesOps.push({
        updateOne: {
          filter: { product_id: item.productId, buyer_id: userDoc._id },
          update: {
            $inc: { quantity: item.quantity, price: item.price * item.quantity },
            $set: {
              buyer: userDoc.name,
              buyer_key: (userDoc.name || '').toString().trim().toLowerCase(),
              buyer_id: userDoc._id,
              college: userDoc.college || '',
              college_key: normalizeKey(userDoc.college || ''),
              purchase_date: now
            },
            $setOnInsert: { product_id: item.productId }
          },
          upsert: true
        }
      });
    }

    await Promise.all([
      productOps.length ? database.collection('products').bulkWrite(productOps, { ordered: false }) : Promise.resolve(),
      salesOps.length ? database.collection('sales').bulkWrite(salesOps, { ordered: false }) : Promise.resolve()
    ]);

    const enrichedItems = (cart.items || []).map((item) => {
      const prod = productMap.get(String(item.productId)) || {};
      return {
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        coordinator: prod.coordinator || '',
        college: prod.college || ''
      };
    });

    await OrdersModel.insertOne(database, {
      user_email: user?.email,
      items: enrichedItems,
      total,
      status: 'pending',
      delivery_verified: false,
      createdAt: new Date()
    });

    await CartModel.updateOne(database, { user_email: user?.email }, { $set: { items: [] } });

    const newBal = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    return { success: true, message: 'Order placed successfully!', walletBalance: newBal?.wallet_balance || 0 };
  },

  async getOrders(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const orders = await OrdersModel.findMany(
      database,
      { user_email: user?.email },
      { sort: { createdAt: -1 } }
    );

    return {
      orders: orders.map(o => ({
        _id: o._id.toString(),
        createdAt: o.createdAt,
        status: o.status,
        items: (o.items || []).map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
        total: o.total,
        delivery_slip: o.delivery_slip || null
      }))
    };
  },

  async cancelOrder(db, user, orderId) {
    requirePlayer(user);
    if (!orderId || !ObjectId.isValid(orderId)) throw createError('Invalid order ID', 400);

    const database = await resolveDb(db);
    const order = await OrdersModel.findOne(database, { _id: new ObjectId(orderId), user_email: user?.email });
    if (!order) throw createError('Order not found', 404);
    if (order.status === 'cancelled') throw createError('Order is already cancelled', 400);
    if (order.status === 'delivered') throw createError('Cannot cancel delivered order', 400);

    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player' });
    if (!userDoc) throw createError('User not found', 404);

    await UserBalancesModel.updateOne(database, { user_id: userDoc._id }, { $inc: { wallet_balance: order.total } }, { upsert: true });

    const restoreOps = (order.items || []).map((item) => ({
      updateOne: {
        filter: { _id: item.productId },
        update: { $inc: { availability: item.quantity } }
      }
    }));
    if (restoreOps.length) {
      await database.collection('products').bulkWrite(restoreOps, { ordered: false });
    }

    await OrdersModel.updateOne(database, { _id: new ObjectId(orderId) }, { $set: { status: 'cancelled', cancelledAt: new Date() } });

    const newBal = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    return { success: true, message: 'Order cancelled and refunded', walletBalance: newBal?.wallet_balance || 0 };
  },

  async getOrderTracking(db, user, orderId) {
    requirePlayer(user);
    if (!orderId || !ObjectId.isValid(orderId)) throw createError('Invalid order ID', 400);

    const database = await resolveDb(db);
    const order = await OrdersModel.findOne(database, { _id: new ObjectId(orderId), user_email: user?.email });
    if (!order) throw createError('Order not found', 404);

    const statusOrder = ['pending', 'processing', 'packed', 'shipped', 'delivered'];
    const currentIdx = statusOrder.indexOf(order.status);
    const steps = statusOrder.map((label, idx) => ({
      label: label.charAt(0).toUpperCase() + label.slice(1),
      done: order.status === 'cancelled' ? false : idx <= currentIdx,
      date: idx <= currentIdx ? (order.createdAt ? new Date(order.createdAt.getTime() + idx * 86400000).toISOString() : null) : null
    }));

    if (order.status === 'cancelled') {
      steps.push({ label: 'Cancelled', done: true, date: order.cancelledAt ? order.cancelledAt.toISOString() : null });
    }

    return { status: order.status, steps };
  },

  async verifyDeliveryOtp(db, user, body) {
    requirePlayer(user);
    const { orderId, otp } = body || {};
    if (!orderId || !otp) throw createError('orderId and otp required', 400);
    if (!ObjectId.isValid(orderId)) throw createError('Invalid orderId', 400);

    const database = await resolveDb(db);
    const order = await OrdersModel.findOne(database, { _id: new ObjectId(orderId), user_email: user?.email });
    if (!order) throw createError('Order not found', 404);

    const otpRecord = await OtpsModel.findOne(database, { email: user?.email, otp: String(otp), type: 'delivery', used: false });
    if (!otpRecord) throw createError('Invalid OTP', 400);
    if (new Date() > new Date(otpRecord.expires_at)) throw createError('OTP expired', 400);

    await OtpsModel.updateOne(database, { _id: otpRecord._id }, { $set: { used: true, used_at: new Date() } });
    await OrdersModel.updateOne(database, { _id: new ObjectId(orderId) }, { $set: { delivery_verified: true, delivery_verified_at: new Date() } });

    return { success: true, message: 'OTP verified' };
  }
};

module.exports = OrdersService;
