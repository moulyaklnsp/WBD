const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { insertWalletTransaction, normalizeProductImages, requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const UserModel = getModel('users');
const UserBalancesModel = getModel('user_balances');
const SubscriptionsModel = getModel('subscriptionstable');
const ProductsModel = getModel('products');
const SalesModel = getModel('sales');
const OrdersModel = getModel('orders');
const ReviewsModel = getModel('reviews');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const StoreService = {
  async getStore(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const rowResults = await UserModel.aggregate(database, [
      { $match: { email: user?.email, role: 'player', isDeleted: 0 } },
      { $lookup: { from: 'user_balances', localField: '_id', foreignField: 'user_id', as: 'balance' } },
      { $unwind: { path: '$balance', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, name: 1, college: 1, wallet_balance: '$balance.wallet_balance' } }
    ]);
    const row = rowResults?.[0];

    if (!row) {
      throw createError('User not found', 404);
    }

    const subscription = await SubscriptionsModel.findOne(database, { username: user?.email });
    let discountPercentage = 0;
    if (subscription) {
      if (subscription.plan === 'Basic') discountPercentage = 10;
      else if (subscription.plan === 'Premium') discountPercentage = 20;
    }

    const [products, userSales, userOrders] = await Promise.all([
      ProductsModel.findMany(database, {}),
      SalesModel.findMany(
        database,
        {
          $or: [
            { buyer_id: row._id },
            { buyer: row.name }
          ]
        },
        { projection: { product_id: 1 } }
      ),
      OrdersModel.findMany(
        database,
        {
          user_email: user?.email,
          status: { $ne: 'cancelled' }
        },
        { projection: { items: 1 } }
      )
    ]);

    const purchasedProductIds = new Set();
    for (const s of userSales || []) {
      if (s?.product_id) purchasedProductIds.add(String(s.product_id));
    }
    for (const o of userOrders || []) {
      for (const item of (o?.items || [])) {
        if (item?.productId) purchasedProductIds.add(String(item.productId));
      }
    }

    const normalizedProducts = (products || []).map((p) => {
      const imageUrls = normalizeProductImages(p);
      const pid = String(p._id || '');
      return {
        ...p,
        _id: pid,
        image: imageUrls[0] || '',
        image_url: p.image_url || imageUrls[0] || '',
        image_urls: imageUrls,
        comments_enabled: !!p.comments_enabled,
        canReview: purchasedProductIds.has(pid)
      };
    });

    return {
      products: normalizedProducts,
      walletBalance: row.wallet_balance || 0,
      playerName: row.name,
      playerCollege: row.college,
      subscription: subscription || null,
      discountPercentage
    };
  },

  async buyProduct(db, user, body) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const { price, buyer, college, productId } = body || {};

    if (!price || !productId) {
      throw createError('Invalid request', 400);
    }

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

    const product = await ProductsModel.findOne(database, { _id: new ObjectId(productId) });
    if (!product || product.availability <= 0) {
      return { success: false, message: 'Product unavailable' };
    }

    await UserBalancesModel.updateOne(
      database,
      { user_id: userDoc._id },
      { $inc: { wallet_balance: -numericPrice } },
      { upsert: true }
    );

    const productName = product?.name || 'Unknown Product';
    await insertWalletTransaction(database, userDoc._id, user?.email, 'debit', numericPrice, `Store Purchase: ${productName}`);

    await ProductsModel.updateOne(
      database,
      { _id: new ObjectId(productId) },
      { $inc: { availability: -1 } }
    );

    await SalesModel.updateOne(
      database,
      { product_id: new ObjectId(productId), buyer_id: userDoc._id },
      {
        $inc: { quantity: 1, price: Number(numericPrice) },
        $set: {
          buyer: String(buyer),
          buyer_id: userDoc._id,
          college: String(college),
          purchase_date: new Date()
        },
        $setOnInsert: { product_id: new ObjectId(productId) }
      },
      { upsert: true }
    );

    try {
      const prod = await ProductsModel.findOne(database, { _id: new ObjectId(productId) });
      const orderItem = {
        productId: new ObjectId(productId),
        name: prod ? prod.name : '',
        price: Number(numericPrice),
        quantity: 1,
        coordinator: prod ? (prod.coordinator || '') : '',
        college: prod ? (prod.college || '') : ''
      };
      await OrdersModel.insertOne(database, {
        user_email: user?.email,
        items: [orderItem],
        total: Number(numericPrice),
        status: 'pending',
        delivery_verified: false,
        createdAt: new Date()
      });
    } catch (e) {
      console.warn('Failed to create order record for buy action:', e.message || e);
    }

    const newBalanceDoc = await UserBalancesModel.findOne(database, { user_id: userDoc._id });
    const updatedBalance = newBalanceDoc?.wallet_balance ?? (walletBalance - numericPrice);
    return { success: true, message: 'Purchase successful!', walletBalance: updatedBalance };
  },

  async getStoreSuggestions(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);

    const userDoc = await UserModel.findOne(database, { email: user?.email, role: 'player' });
    const buyerName = userDoc?.name || user?.username || user?.email;

    const mostOrdered = await SalesModel.aggregate(database, [
      { $group: { _id: '$product_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      { $project: { _id: '$product._id', name: '$product.name', count: 1 } }
    ]);

    const userSales = await SalesModel.findMany(database, { buyer: buyerName });
    const boughtIds = userSales.map(s => s.product_id.toString());
    const suggested = await ProductsModel.findMany(
      database,
      { availability: { $gt: 0 }, _id: { $nin: boughtIds.map(id => new ObjectId(id)) } },
      { limit: 5 }
    );

    return {
      mostOrdered: mostOrdered.map(m => ({ _id: m._id.toString(), name: m.name, count: m.count })),
      suggested: suggested.map(s => ({ _id: s._id.toString(), name: s.name, price: s.price }))
    };
  },

  async submitReview(db, user, body) {
    requirePlayer(user);
    const { product_id, rating, comment } = body || {};
    if (!product_id || !rating) throw createError('Product ID and rating are required', 400);
    if (!ObjectId.isValid(product_id)) throw createError('Invalid product ID', 400);

    const ratingNum = parseInt(rating);
    if (ratingNum < 1 || ratingNum > 5) throw createError('Rating must be 1-5', 400);

    const database = await resolveDb(db);
    const productObjectId = new ObjectId(product_id);

    const userDoc = await UserModel.findOne(database, {
      email: user?.email,
      role: 'player',
      isDeleted: 0
    });
    if (!userDoc) throw createError('Player not found', 404);

    const product = await ProductsModel.findOne(database, { _id: productObjectId });
    if (!product) throw createError('Product not found', 404);
    if (!product.comments_enabled) {
      throw createError('Reviews are disabled for this product', 403);
    }

    const [orderPurchase, directPurchase] = await Promise.all([
      OrdersModel.findOne(database, {
        user_email: user?.email,
        status: { $ne: 'cancelled' },
        'items.productId': productObjectId
      }),
      SalesModel.findOne(database, {
        product_id: productObjectId,
        $or: [
          { buyer_id: userDoc._id },
          { buyer: userDoc.name },
          { buyer: user?.username }
        ]
      })
    ]);

    if (!orderPurchase && !directPurchase) {
      throw createError('Only players who bought this product can review it', 403);
    }

    const existing = await ReviewsModel.findOne(database, {
      product_id: productObjectId,
      player_email: user?.email
    });
    if (existing) {
      await ReviewsModel.updateOne(
        database,
        { _id: existing._id },
        { $set: { rating: ratingNum, comment: (comment || '').trim(), updated_at: new Date() } }
      );
      const aggRows = await ReviewsModel.aggregate(database, [
        { $match: { product_id: productObjectId } },
        {
          $group: {
            _id: '$product_id',
            avg: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        }
      ]);
      const agg = aggRows?.[0];

      await ProductsModel.updateOne(
        database,
        { _id: productObjectId },
        {
          $set: {
            average_rating: Number((agg?.avg || ratingNum).toFixed(2)),
            total_reviews: agg?.count || 1
          }
        }
      );

      return { success: true, message: 'Review updated', created: false };
    }

    const review = {
      product_id: productObjectId,
      player_email: user?.email,
      player_name: user?.username || user?.email,
      rating: ratingNum,
      comment: (comment || '').trim(),
      created_at: new Date()
    };

    await ReviewsModel.insertOne(database, review);

    const aggRows = await ReviewsModel.aggregate(database, [
      { $match: { product_id: productObjectId } },
      {
        $group: {
          _id: '$product_id',
          avg: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);
    const agg = aggRows?.[0];

    await ProductsModel.updateOne(
      database,
      { _id: productObjectId },
      {
        $set: {
          average_rating: Number((agg?.avg || ratingNum).toFixed(2)),
          total_reviews: agg?.count || 1
        }
      }
    );

    return { success: true, message: 'Review submitted', created: true };
  },

  async getProductReviews(db, { productId }) {
    if (!ObjectId.isValid(productId)) throw createError('Invalid product ID', 400);

    const database = await resolveDb(db);
    const productObjectId = new ObjectId(productId);
    const reviews = await ReviewsModel.findMany(
      database,
      { product_id: productObjectId },
      { sort: { created_at: -1, updated_at: -1 } }
    );

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
      : 0;

    return {
      reviews: reviews.map((r) => ({
        ...r,
        user_name: r.player_name || r.user_name || r.player_email || 'User',
        review_date: r.created_at || r.review_date || r.updated_at || new Date(),
        comment: r.comment || '',
        rating: Number(r.rating || 0)
      })),
      avgRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length
    };
  }
};

module.exports = StoreService;
