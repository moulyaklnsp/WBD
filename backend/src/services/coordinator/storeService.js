const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const StorageModel = require('../../models/StorageModel');
const OrderFilesModel = require('../../models/OrderFilesModel');
const { sendOtpEmail } = require('../emailService');
const {
  safeTrim,
  escapeRegExp,
  normalizeOrderStatus,
  getAllowedOrderStatusTransitions,
  PLAYER_ORDER_STATUSES,
  getCoordinatorOwnerIdentifiers,
  getCoordinatorOwnerCandidates,
  requireCoordinator
} = require('./coordinatorUtils');
const { getModel } = require('../../models');
const Cache = require('../../utils/cache');
const UserModel = getModel('users');
const ProductsModel = getModel('products');
const OrdersModel = getModel('orders');
const SalesModel = getModel('sales');
const ReviewsModel = getModel('reviews');
const OrderComplaintsModel = getModel('order_complaints');
const OtpsModel = getModel('otps');
const { normalizeKey, parsePagination } = require('../../utils/mongo');
const { createSolrService } = require('../../solr/SolrService');
const { isSolrEnabled } = require('../../solr/solrEnabled');
const { mapProductToSolrDoc } = require('../../solr/mappers/productMapper');

const createError = (message, statusCode, extra) => Object.assign(new Error(message), { statusCode, ...extra });
const resolveDb = async (db) => (db ? db : connectDB());

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function solrPhrase(value) {
  const raw = safeTrim(value);
  const escaped = raw.replace(/(["\\])/g, '\\$1');
  return `"${escaped}"`;
}

function normalizeFacets(value) {
  const raw = Array.isArray(value) ? value : (safeTrim(value) ? safeTrim(value).split(',') : []);
  const allow = new Set(['product_category_s', 'product_college_s', 'product_comments_enabled_b']);
  return raw.map((v) => safeTrim(v)).filter((v) => allow.has(v));
}

function parseMongoIdFromSolrId(entity, solrId) {
  const raw = safeTrim(solrId);
  const prefix = `${entity}:`;
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  return raw;
}

function sortByIdOrder(items, ids) {
  const order = new Map(ids.map((id, idx) => [String(id), idx]));
  return (items || [])
    .slice()
    .sort((a, b) => (order.get(String(a?._id)) ?? 1e9) - (order.get(String(b?._id)) ?? 1e9));
}

function parseProductSort(value, { hasQuery } = {}) {
  const raw = safeTrim(value?.sort || value?.sortBy || value?.orderBy).toLowerCase();
  const direction = safeTrim(value?.order || value?.direction).toLowerCase() === 'asc' ? 'asc' : 'desc';

  if (!raw) return hasQuery ? 'score desc, created_at_dt desc' : 'created_at_dt desc';
  if (raw === 'newest') return 'created_at_dt desc';
  if (raw === 'oldest') return 'created_at_dt asc';
  if (raw === 'name' || raw === 'name_asc') return `product_name_s asc, created_at_dt desc`;
  if (raw === 'name_desc') return `product_name_s desc, created_at_dt desc`;
  if (raw === 'price' || raw === 'price_asc') return `product_price_f asc, created_at_dt desc`;
  if (raw === 'price_desc') return `product_price_f desc, created_at_dt desc`;
  if (raw === 'availability' || raw === 'availability_desc') return `product_availability_l desc, created_at_dt desc`;
  if (raw === 'availability_asc') return `product_availability_l asc, created_at_dt desc`;

  if (raw === 'product_name_s') return `product_name_s ${direction}, created_at_dt desc`;
  if (raw === 'product_price_f') return `product_price_f ${direction}, created_at_dt desc`;
  if (raw === 'product_availability_l') return `product_availability_l ${direction}, created_at_dt desc`;

  return hasQuery ? 'score desc, created_at_dt desc' : 'created_at_dt desc';
}

const StoreService = {
  async getProducts(db, user, query = {}) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const college = user?.college || user?.collegeName;
    const { limit, skip } = parsePagination(query, { defaultLimit: 50, maxLimit: 200 });
    const onlyAvailable = String(query?.available || '').toLowerCase() === 'true';
    const q = safeTrim(query?.q || query?.search);
    const facets = normalizeFacets(query?.facets);

    if (isSolrEnabled() && college) {
      const solr = createSolrService();
      const fq = [
        `product_college_s:${solrPhrase(college)}`,
        ...(onlyAvailable ? ['product_availability_l:[1 TO *]'] : []),
        ...toArray(query?.fq).map((v) => safeTrim(v)).filter(Boolean)
      ];
      const sort = parseProductSort(query, { hasQuery: Boolean(q) });
      const role = safeTrim(user?.role || 'coordinator').toLowerCase();

      const solrResult = await solr.search('products', {
        q,
        role,
        page: 1,
        pageSize: limit,
        start: skip,
        facets,
        sort,
        fq
      });

      if (solrResult?.success === true) {
        const idStrings = (solrResult.docs || [])
          .map((d) => parseMongoIdFromSolrId('products', d?.id))
          .filter((idStr) => ObjectId.isValid(idStr));
        const objectIds = idStrings.map((idStr) => new ObjectId(idStr));

        const rows = objectIds.length
          ? await ProductsModel.findMany(database, { _id: { $in: objectIds }, college: college }, {
            projection: {
              name: 1,
              category: 1,
              price: 1,
              image_url: 1,
              image_urls: 1,
              availability: 1,
              coordinator: 1,
              college: 1,
              comments_enabled: 1
            }
          })
          : [];

        const ordered = sortByIdOrder(rows, objectIds);
        const normalized = (ordered || []).map((p) => ({
          ...p,
          _id: p._id ? p._id.toString() : '',
          imageUrl: p.image_url || p.imageUrl || (Array.isArray(p.image_urls) ? p.image_urls[0] : ''),
          image_urls: Array.from(new Set([
            ...(Array.isArray(p.image_urls)
              ? p.image_urls
              : (typeof p.image_urls === 'string'
                  ? p.image_urls.split(',').map((s) => s.trim())
                  : [])),
            p.image_url,
            p.imageUrl
          ].filter(Boolean))),
          comments_enabled: !!p.comments_enabled
        }));

        const response = { products: normalized, totalProducts: solrResult.total || 0, pagination: { limit, skip } };
        if (facets.length) response.facetCounts = solrResult.facetCounts || {};
        return response;
      }

      console.error('coordinator.storeService.getProducts solr failed:', solrResult?.error || 'unknown');
    }

    const filter = {
      college: college,
      ...(onlyAvailable ? { availability: { $gt: 0 } } : {})
    };

    const { items: products, total } = await ProductsModel.findManyPaginated(database, filter, {
      projection: {
        name: 1,
        category: 1,
        price: 1,
        image_url: 1,
        image_urls: 1,
        availability: 1,
        coordinator: 1,
        college: 1,
        comments_enabled: 1
      },
      sort: { added_date: -1, _id: -1 },
      limit,
      skip
    });

    const normalized = (products || []).map((p) => ({
      ...p,
      _id: p._id ? p._id.toString() : '',
      imageUrl: p.image_url || p.imageUrl || (Array.isArray(p.image_urls) ? p.image_urls[0] : ''),
      image_urls: Array.from(new Set([
        ...(Array.isArray(p.image_urls)
          ? p.image_urls
          : (typeof p.image_urls === 'string'
              ? p.image_urls.split(',').map((s) => s.trim())
              : [])),
        p.image_url,
        p.imageUrl
      ].filter(Boolean))),
      comments_enabled: !!p.comments_enabled
    }));

    return { products: normalized, totalProducts: total || 0, pagination: { limit, skip } };
  },

  async addProduct(db, user, { body, files }) {
    requireCoordinator(user);
    const productName = (body.productName ?? body.name ?? '').toString();
    const productCategory = (body.productCategory ?? body.category ?? '').toString();
    const price = body.price;
    let imageUrl = (body.imageUrl ?? body.image_url ?? '').toString();
    let imagePublicId = (body.imagePublicId ?? body.image_public_id ?? '').toString();
    const imageUrlsFromBody = Array.isArray(body.imageUrls)
      ? body.imageUrls
      : (typeof body.imageUrls === 'string'
          ? body.imageUrls.split(',').map((s) => s.trim()).filter(Boolean)
          : []);
    const availability = (body.availability !== undefined ? body.availability : body.stock);

    const uploadedImageUrls = [];
    const uploadedPublicIds = [];

    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        const result = await StorageModel.uploadImageBuffer(file.buffer, {
          folder: 'chesshive/product-images',
          public_id: `product_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          overwrite: false
        });
        if (result?.secure_url) uploadedImageUrls.push(result.secure_url);
        if (result?.public_id) uploadedPublicIds.push(result.public_id);
      }
      if (uploadedImageUrls.length > 0) {
        imageUrl = uploadedImageUrls[0];
        imagePublicId = uploadedPublicIds[0] || '';
      }
    }

    const allImageUrls = [...new Set([imageUrl, ...imageUrlsFromBody, ...uploadedImageUrls].filter(Boolean))];

    if (!productName || !productCategory || price === undefined || price === '' || (!imageUrl && allImageUrls.length === 0) || availability === undefined) {
      throw createError('All fields are required', 400);
    }
    const priceNum = parseFloat(price);
    const availNum = parseInt(availability);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      throw createError('Invalid price value', 400);
    }
    if (Number.isNaN(availNum) || availNum < 0) {
      throw createError('Invalid availability value', 400);
    }

    const database = await resolveDb(db);
    const coordinator = await UserModel.findOne(database, {
      email: user?.email,
      role: 'coordinator'
    });
    if (!coordinator) throw createError('User not logged in', 401);
    const username = coordinator.name || user?.username || user?.email;
    const college = coordinator.college || user?.college;

    if (!college) throw createError('College info missing', 401);

    const product = {
      name: productName.trim(),
      category: productCategory.trim(),
      price: priceNum,
      image_url: (imageUrl || allImageUrls[0] || '').trim(),
      image_urls: (allImageUrls.length > 0 ? allImageUrls : [imageUrl]).filter(Boolean),
      image_public_id: imagePublicId ? imagePublicId.toString() : undefined,
      image_public_ids: uploadedPublicIds.length > 0 ? uploadedPublicIds : undefined,
      availability: availNum || 0,
      college: college.toString(),
      college_key: normalizeKey(college),
      coordinator: username.toString(),
      coordinator_key: normalizeKey(username),
      added_date: new Date()
    };

    Object.keys(product).forEach((k) => product[k] === undefined && delete product[k]);

    const result = await ProductsModel.insertOne(database, product);
    if (result.insertedId) {
      if (isSolrEnabled()) {
        const solr = createSolrService();
        await solr.indexDocument('products', mapProductToSolrDoc({ ...product, _id: result.insertedId }));
      }
      await Cache.invalidateTags(['store'], { reason: 'coordinator.store.addProduct' });
      return { success: true, message: 'Product added successfully' };
    }

    throw createError('Failed to add product', 500);
  },
  async updateProduct(db, user, { productId, body, files }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(productId)) throw createError('Invalid product ID', 400);
    const database = await resolveDb(db);

    const product = await ProductsModel.findOne(database, { _id: new ObjectId(productId) });
    if (!product) throw createError('Product not found', 404);

    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const productOwner = String(product.coordinator || '').trim();
    const ownerKeys = (ownerIdentifiers || []).map(normalizeKey).filter(Boolean);
    if (!ownerKeys.includes(normalizeKey(productOwner))) {
      throw createError('Access denied', 403);
    }

    const updates = {};
    if (body.name != null) updates.name = safeTrim(body.name);
    if (body.category != null) updates.category = safeTrim(body.category);
    if (body.price != null && body.price !== '') {
      const p = parseFloat(body.price);
      if (!Number.isNaN(p) && p >= 0) updates.price = p;
    }
    if (body.availability != null && body.availability !== '') {
      const a = parseInt(body.availability);
      if (!Number.isNaN(a) && a >= 0) updates.availability = a;
    }
    if (body.description != null) updates.description = safeTrim(body.description);
    if (body.comments_enabled != null) updates.comments_enabled = !!(body.comments_enabled === true || body.comments_enabled === 'true' || body.comments_enabled === '1' || body.comments_enabled === 1);

    const uploadedImageUrls = [];
    const uploadedPublicIds = [];
    if (Array.isArray(files) && files.length > 0) {
      for (const file of files) {
        try {
          const result = await StorageModel.uploadImageBuffer(file.buffer, {
            folder: 'chesshive/product-images',
            public_id: `product_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            overwrite: false
          });
          if (result?.secure_url) uploadedImageUrls.push(result.secure_url);
          if (result?.public_id) uploadedPublicIds.push(result.public_id);
        } catch (e) {
          console.warn('Failed to upload product image:', e.message);
        }
      }
    }

    const bodyImageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : (typeof body.imageUrls === 'string' ? body.imageUrls.split(',').map(s => s.trim()).filter(Boolean) : []);
    const bodyPublicIds = Array.isArray(body.imagePublicIds) ? body.imagePublicIds : (typeof body.imagePublicIds === 'string' ? body.imagePublicIds.split(',').map(s => s.trim()).filter(Boolean) : []);

    const removeImagePublicIds = Array.isArray(body.removeImagePublicIds) ? body.removeImagePublicIds : (typeof body.removeImagePublicIds === 'string' ? body.removeImagePublicIds.split(',').map(s => s.trim()).filter(Boolean) : []);
    const removeImageUrls = Array.isArray(body.removeImageUrls) ? body.removeImageUrls : (typeof body.removeImageUrls === 'string' ? body.removeImageUrls.split(',').map(s => s.trim()).filter(Boolean) : []);

    const dbUpdate = {};
    if (Object.keys(updates).length > 0) dbUpdate.$set = { ...updates, updated_date: new Date() };

    const addToSet = {};
    if (uploadedImageUrls.length > 0 || bodyImageUrls.length > 0) {
      addToSet.image_urls = { $each: [...new Set([...(bodyImageUrls || []), ...uploadedImageUrls]) ] };
      if (!product.image_url && (uploadedImageUrls.length > 0 || bodyImageUrls.length > 0)) {
        dbUpdate.$set = dbUpdate.$set || {};
        dbUpdate.$set.image_url = (bodyImageUrls[0] || uploadedImageUrls[0] || '').toString();
      }
    }
    if (uploadedPublicIds.length > 0 || bodyPublicIds.length > 0) {
      addToSet.image_public_ids = { $each: [...new Set([...(bodyPublicIds || []), ...uploadedPublicIds]) ] };
    }
    if (Object.keys(addToSet).length > 0) dbUpdate.$addToSet = addToSet;

    if (removeImagePublicIds.length > 0) {
      dbUpdate.$pull = dbUpdate.$pull || {};
      dbUpdate.$pull.image_public_ids = { $in: removeImagePublicIds };
      for (const pid of removeImagePublicIds) {
        try { await StorageModel.destroyImage(pid); } catch (e) { console.warn('Failed to destroy image:', pid, e.message); }
      }
    }
    if (removeImageUrls.length > 0) {
      dbUpdate.$pull = dbUpdate.$pull || {};
      dbUpdate.$pull.image_urls = { $in: removeImageUrls };
    }

    if (body.imageUrl || body.image_url) {
      dbUpdate.$set = dbUpdate.$set || {};
      dbUpdate.$set.image_url = (body.imageUrl || body.image_url).toString();
    }

    if (Object.keys(dbUpdate).length > 0) {
      await ProductsModel.updateOne(database, { _id: new ObjectId(productId) }, dbUpdate);
    }

    const updated = await ProductsModel.findOne(database, { _id: new ObjectId(productId) });
    if (isSolrEnabled()) {
      const solr = createSolrService();
      await solr.indexDocument('products', mapProductToSolrDoc(updated));
    }
    await Cache.invalidateTags(['store'], { reason: 'coordinator.store.updateProduct' });
    return { success: true, product: updated };
  },

  async deleteProduct(db, user, { productId }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(productId)) throw createError('Invalid product ID', 400);
    const database = await resolveDb(db);

    const product = await ProductsModel.findOne(database, { _id: new ObjectId(productId) });
    if (!product) throw createError('Product not found', 404);

    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const productOwner = String(product.coordinator || '').trim();
    const ownerSet = new Set((ownerIdentifiers || []).map((v) => String(v).trim()));
    if (!ownerSet.has(productOwner) && !ownerSet.has(productOwner.toLowerCase())) {
      throw createError('Access denied', 403);
    }

    const publicIds = Array.isArray(product.image_public_ids)
      ? product.image_public_ids
      : (product.image_public_id ? [product.image_public_id] : []);
    for (const pid of publicIds) {
      try {
        await StorageModel.destroyImage(pid);
      } catch (e) {
        console.warn('Failed deleting product image from Cloudinary:', pid, e.message);
      }
    }

    await ProductsModel.deleteOne(database, { _id: new ObjectId(productId) });
    if (isSolrEnabled()) {
      const solr = createSolrService();
      await solr.deleteDocument('products', productId);
    }
    await Cache.invalidateTags(['store'], { reason: 'coordinator.store.deleteProduct' });
    return { success: true };
  },

  async toggleComments(db, user, { productId }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(productId)) throw createError('Invalid product ID', 400);
    const database = await resolveDb(db);

    const ownerCandidates = await getCoordinatorOwnerCandidates(database, user);
    const product = await ProductsModel.findOne(database, { _id: new ObjectId(productId) });
    if (!product) throw createError('Product not found', 404);

    const productOwner = String(product.coordinator || '').trim().toLowerCase();
    if (!ownerCandidates.includes(productOwner)) {
      throw createError('Product not found or access denied', 403);
    }

    const nextValue = !Boolean(product.comments_enabled);

    await ProductsModel.updateOne(
      database,
      { _id: new ObjectId(productId) },
      { $set: { comments_enabled: nextValue } }
    );

    if (isSolrEnabled()) {
      const solr = createSolrService();
      await solr.indexDocument('products', mapProductToSolrDoc({ ...product, comments_enabled: nextValue, updated_date: new Date() }));
    }

    await Cache.invalidateTags(['store'], { reason: 'coordinator.store.toggleComments' });
    return { success: true, comments_enabled: nextValue };
  },

  async getOrders(db, user) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);
    if (ownerKeys.length === 0 && ownerIdentifiers.length === 0) {
      return { orders: [] };
    }

    const products = await ProductsModel.findMany(
      database,
      {
        $or: [
          { coordinator_key: { $in: ownerKeys } },
          { coordinator: { $in: ownerIdentifiers } }
        ]
      },
      { projection: { _id: 1 } }
    );

    const productIdStrings = products
      .map((product) => product?._id)
      .filter(Boolean)
      .map((id) => id.toString());
    if (productIdStrings.length === 0) {
      return { orders: [] };
    }

    const orders = await OrdersModel.aggregate(database, [
        {
          $addFields: {
            coordinator_items: {
              $filter: {
                input: { $ifNull: ['$items', []] },
                as: 'item',
                cond: {
                  $in: [{ $toString: '$$item.productId' }, productIdStrings]
                }
              }
            }
          }
        },
        {
          $match: {
            $expr: { $gt: [{ $size: '$coordinator_items' }, 0] }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user_email',
            foreignField: 'email',
            as: 'user'
          }
        },
        {
          $unwind: { path: '$user', preserveNullAndEmptyArrays: true }
        },
        {
          $sort: { createdAt: -1 }
        }
      ]);

    const normalizedOrders = (orders || []).map((o) => ({
      _id: o._id ? o._id.toString() : '',
      user: o.user || null,
      user_email: o.user_email || '',
      items: Array.isArray(o.coordinator_items) ? o.coordinator_items : [],
      totalAmount: Number(o.totalAmount ?? o.total ?? 0),
      coordinatorAmount: Number((Array.isArray(o.coordinator_items) ? o.coordinator_items : []).reduce(
        (sum, item) => sum + (Number(item?.price || 0) * Number(item?.quantity || 1)),
        0
      )),
      createdAt: o.createdAt || o.created_date || new Date(),
      status: normalizeOrderStatus(o.status)
    }));

    return { orders: normalizedOrders };
  },
  async updateOrderStatus(db, user, { orderId, body }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(orderId)) throw createError('Invalid order ID', 400);

    const database = await resolveDb(db);
    const requestedStatus = safeTrim(body?.status).toLowerCase();
    if (!requestedStatus) throw createError('Status is required', 400);
    if (!PLAYER_ORDER_STATUSES.includes(requestedStatus)) {
      throw createError(`Invalid status value. Allowed values: ${PLAYER_ORDER_STATUSES.join(', ')}`, 400);
    }

    const order = await OrdersModel.findOne(database, { _id: new ObjectId(orderId) });
    if (!order) throw createError('Order not found', 404);

    const productIdStrings = (order.items || [])
      .map((item) => item?.productId)
      .filter(Boolean)
      .map((pid) => pid.toString());
    const productObjectIds = productIdStrings
      .filter((pid) => ObjectId.isValid(pid))
      .map((pid) => new ObjectId(pid));

    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);

    const coordinatorProducts = await ProductsModel.findMany(
      database,
      {
        _id: { $in: productObjectIds },
        $or: [
          { coordinator_key: { $in: ownerKeys } },
          { coordinator: { $in: ownerIdentifiers } }
        ]
      }
    );

    if (coordinatorProducts.length === 0) {
      throw createError('Access denied', 403);
    }

    const currentStatus = normalizeOrderStatus(order.status);
    if (['delivered', 'cancelled'].includes(currentStatus)) {
      throw createError(`Order is already ${currentStatus} and cannot be updated`, 400);
    }

    const allowedTransitions = getAllowedOrderStatusTransitions(currentStatus);
    if (!allowedTransitions.includes(requestedStatus)) {
      const err = createError(`Invalid status transition from "${currentStatus}" to "${requestedStatus}"`, 400);
      err.allowedNextStatuses = allowedTransitions;
      throw err;
    }

    const normalizedStatus = normalizeOrderStatus(requestedStatus);

    const updateData = { status: normalizedStatus };
    const now = new Date();

    if (normalizedStatus === 'processing') updateData.processing_date = now;
    else if (normalizedStatus === 'packed') updateData.packed_date = now;
    else if (normalizedStatus === 'shipped') {
      updateData.shipped_date = now;
      if (body?.trackingNumber) updateData.tracking_number = body.trackingNumber;
      if (body?.deliveryPartner) updateData.delivery_partner = body.deliveryPartner;
    } else if (normalizedStatus === 'delivered') {
      updateData.delivered_date = now;
      try {
        const slipId = (new ObjectId()).toString();
        const slip = {
          slip_id: slipId,
          generatedAt: now,
          delivered_by: body?.deliveryPartner || user?.email || '',
          items: order.items || [],
          total: order.total || 0,
          orderId: order._id ? order._id.toString() : String(orderId),
          note: `Delivery confirmed on ${now.toISOString()}`
        };

        const pdfUrl = await OrderFilesModel.writeDeliverySlipPdf(slip);
        if (pdfUrl) slip.pdf_url = pdfUrl;

        updateData.delivery_slip = slip;
      } catch (e) {
        console.error('Failed to generate delivery slip:', e);
      }
    }
    else if (normalizedStatus === 'cancelled') updateData.cancelledAt = now;

    await OrdersModel.updateOne(
      database,
      { _id: new ObjectId(orderId) },
      { $set: updateData }
    );

    return { success: true, status: normalizedStatus };
  },

  async getOrderAnalytics(db, user) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const emptyAnalytics = {
      mostSoldProduct: null,
      totalRevenue: 0,
      monthlyRevenue: [],
      productRevenue: [],
      customerLogs: []
    };

    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);
    if (ownerKeys.length === 0 && ownerIdentifiers.length === 0) {
      return emptyAnalytics;
    }

    const products = await ProductsModel.findMany(
      database,
      {
        $or: [
          { coordinator_key: { $in: ownerKeys } },
          { coordinator: { $in: ownerIdentifiers } }
        ]
      },
      { projection: { _id: 1 } }
    );

    const productIds = (products || []).map((p) => p?._id).filter(Boolean);
    if (productIds.length === 0) {
      return emptyAnalytics;
    }
    const productIdStrings = productIds.map((id) => id.toString());

    const salesMatch = {
      $or: [
        { product_id: { $in: productIds } },
        { productId: { $in: productIds } },
        {
          $expr: {
            $in: [{ $toString: { $ifNull: ['$product_id', '$productId'] } }, productIdStrings]
          }
        }
      ]
    };

    const priceAsNumber = {
      $convert: {
        input: '$price',
        to: 'double',
        onError: 0,
        onNull: 0
      }
    };
    const quantityAsNumber = {
      $convert: {
        input: { $ifNull: ['$quantity', 1] },
        to: 'double',
        onError: 1,
        onNull: 1
      }
    };

    const purchaseDate = {
      $convert: {
        input: { $ifNull: ['$purchase_date', '$createdAt'] },
        to: 'date',
        onError: '$$NOW',
        onNull: '$$NOW'
      }
    };

    const mostSoldProduct = await SalesModel.aggregate(database, [
        { $match: salesMatch },
        {
          $group: {
            _id: { $toString: { $ifNull: ['$product_id', '$productId'] } },
            totalSold: { $sum: quantityAsNumber },
            totalRevenue: { $sum: priceAsNumber }
          }
        },
        {
          $addFields: {
            productObjectId: {
              $convert: {
                input: '$_id',
                to: 'objectId',
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productObjectId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $sort: { totalSold: -1, totalRevenue: -1 } },
        { $limit: 1 }
      ]);

    const totalRevenueResult = await SalesModel.aggregate(database, [
        { $match: salesMatch },
        {
          $group: {
            _id: null,
            total: { $sum: priceAsNumber }
          }
        }
      ]);
    const totalRevenue = totalRevenueResult.length > 0 ? Number(totalRevenueResult[0].total || 0) : 0;

    const monthlyRevenue = await SalesModel.aggregate(database, [
        { $match: salesMatch },
        {
          $group: {
            _id: {
              year: { $year: purchaseDate },
              month: { $month: purchaseDate }
            },
            revenue: { $sum: priceAsNumber }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]);

    const productRevenue = await SalesModel.aggregate(database, [
        { $match: salesMatch },
        {
          $group: {
            _id: { $toString: { $ifNull: ['$product_id', '$productId'] } },
            revenue: { $sum: priceAsNumber },
            sold: { $sum: quantityAsNumber }
          }
        },
        {
          $addFields: {
            productObjectId: {
              $convert: {
                input: '$_id',
                to: 'objectId',
                onError: null,
                onNull: null
              }
            }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productObjectId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        { $sort: { revenue: -1 } }
      ]);

    const customerLogs = await SalesModel.aggregate(database, [
        { $match: salesMatch },
        {
          $lookup: {
            from: 'users',
            localField: 'buyer_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$buyer', 'Customer'] },
            totalPurchases: { $sum: quantityAsNumber },
            totalSpent: { $sum: priceAsNumber },
            lastPurchase: { $max: purchaseDate },
            user: { $first: '$user' }
          }
        },
        { $sort: { totalSpent: -1 } }
      ]);

    return {
      mostSoldProduct: mostSoldProduct[0] || null,
      totalRevenue,
      monthlyRevenue,
      productRevenue,
      customerLogs: (customerLogs || []).map((c) => ({
        ...c,
        name: c?.user?.name || c?._id || 'Customer',
        email: c?.user?.email || ''
      }))
    };
  },
  async sendDeliveryOtp(db, user, { orderId }) {
    requireCoordinator(user);
    if (!orderId || !ObjectId.isValid(orderId)) throw createError('Invalid order ID', 400);

    const database = await resolveDb(db);
    const order = await OrdersModel.findOne(database, { _id: new ObjectId(orderId) });
    if (!order) throw createError('Order not found', 404);

    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);
    const productIds = (order.items || []).map(i => i.productId).filter(Boolean).map(String);
    const productObjectIds = productIds.filter(pid => ObjectId.isValid(pid)).map(pid => new ObjectId(pid));
    const coordinatorProducts = await ProductsModel.findMany(
      database,
      {
        _id: { $in: productObjectIds },
        $or: [
          { coordinator_key: { $in: ownerKeys } },
          { coordinator: { $in: ownerIdentifiers } }
        ]
      }
    );
    if ((coordinatorProducts || []).length === 0) throw createError('Access denied', 403);

    const playerEmail = String(order.user_email || '').trim();
    if (!playerEmail) throw createError('Player email not available for order', 400);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OtpsModel.insertOne(database, { email: playerEmail, otp, type: 'delivery', expires_at: expiresAt, used: false, orderId: order._id });

    const mailResult = await sendOtpEmail(playerEmail, otp, `Delivery OTP for Order ${String(order._id).slice(-8)}`);
    const emailSent = Boolean(mailResult?.sent);

    return {
      success: true,
      message: emailSent ? 'OTP sent to player email' : 'OTP generated but email failed',
      emailSent
    };
  },

  async getProductAnalyticsDetails(db, user, { productId }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(productId)) throw createError('Invalid product ID', 400);

    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);

    const product = await ProductsModel.findOne(database, {
      _id: new ObjectId(productId),
      $or: [
        { coordinator_key: { $in: ownerKeys } },
        { coordinator: { $in: ownerIdentifiers } }
      ]
    });
    if (!product) throw createError('Product not found or access denied', 404);

    const productObjectId = new ObjectId(productId);

    const [orderAggRows, salesAggRows] = await Promise.all([
      database.collection('orders').aggregate([
        { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
        { $match: { 'items.productId': productObjectId } },
        {
          $project: {
            orderDate: { $convert: { input: { $ifNull: ['$createdAt', '$created_date'] }, to: 'date', onError: null, onNull: null } },
            quantity: { $convert: { input: { $ifNull: ['$items.quantity', 1] }, to: 'double', onError: 0, onNull: 0 } },
            unitPrice: { $convert: { input: { $ifNull: ['$items.price', 0] }, to: 'double', onError: 0, onNull: 0 } }
          }
        },
        {
          $addFields: {
            revenue: { $multiply: ['$quantity', '$unitPrice'] },
            dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } }
          }
        },
        { $group: { _id: '$dateKey', unitsSold: { $sum: '$quantity' }, revenue: { $sum: '$revenue' } } },
        { $sort: { _id: 1 } },
        {
          $group: {
            _id: null,
            dateWiseSales: { $push: { date: '$_id', unitsSold: { $round: ['$unitsSold', 2] }, revenue: { $round: ['$revenue', 2] } } },
            unitsSold: { $sum: '$unitsSold' },
            totalRevenue: { $sum: '$revenue' }
          }
        },
        { $project: { _id: 0, dateWiseSales: 1, unitsSold: { $round: ['$unitsSold', 2] }, totalRevenue: { $round: ['$totalRevenue', 2] } } }
      ]).toArray(),
      database.collection('sales').aggregate([
        { $match: { product_id: productObjectId } },
        {
          $project: {
            quantity: { $convert: { input: { $ifNull: ['$quantity', 1] }, to: 'double', onError: 1, onNull: 1 } },
            revenue: { $convert: { input: { $ifNull: ['$price', 0] }, to: 'double', onError: 0, onNull: 0 } },
            saleDate: { $convert: { input: { $ifNull: ['$purchase_date', '$createdAt'] }, to: 'date', onError: null, onNull: null } }
          }
        },
        { $addFields: { dateKey: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } } } },
        { $group: { _id: '$dateKey', unitsSold: { $sum: '$quantity' }, revenue: { $sum: '$revenue' } } },
        { $sort: { _id: 1 } },
        {
          $group: {
            _id: null,
            dateWiseSales: { $push: { date: '$_id', unitsSold: { $round: ['$unitsSold', 2] }, revenue: { $round: ['$revenue', 2] } } },
            unitsSold: { $sum: '$unitsSold' },
            totalRevenue: { $sum: '$revenue' }
          }
        },
        { $project: { _id: 0, dateWiseSales: 1, unitsSold: { $round: ['$unitsSold', 2] }, totalRevenue: { $round: ['$totalRevenue', 2] } } }
      ]).toArray()
    ]);

    const orderAgg = orderAggRows?.[0] || null;
    const salesAgg = salesAggRows?.[0] || null;
    const preferred = orderAgg?.dateWiseSales?.length ? orderAgg : (salesAgg || { dateWiseSales: [], unitsSold: 0, totalRevenue: 0 });

    return {
      product: {
        _id: String(product._id),
        name: product.name || 'Product',
        category: product.category || '',
        price: Number(product.price || 0)
      },
      productName: product.name || 'Product',
      unitsSold: Number((preferred.unitsSold || 0).toFixed(2)),
      totalSales: Number((preferred.unitsSold || 0).toFixed(2)),
      totalRevenue: Number((preferred.totalRevenue || 0).toFixed(2)),
      dateWiseSales: preferred.dateWiseSales || []
    };
  },

  async getProductReviews(db, { productId }) {
    if (!productId || !ObjectId.isValid(productId)) {
      throw createError('Invalid product ID', 400);
    }

    const database = await resolveDb(db);
    const reviews = await ReviewsModel.findMany(
      database,
      { product_id: new ObjectId(productId) },
      { sort: { created_at: -1, updated_at: -1 } }
    );

    return {
      reviews: reviews.map((r) => ({
        ...r,
        user_name: r.player_name || r.user_name || r.player_email || 'User',
        review_date: r.created_at || r.review_date || r.updated_at || new Date(),
        comment: r.comment || '',
        rating: Number(r.rating || 0)
      }))
    };
  },

  async getOrderComplaints(db, user, query = {}) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);
    const { limit, skip } = parsePagination(query, { defaultLimit: 100, maxLimit: 300 });

    const complaints = await database.collection('order_complaints').aggregate([
      { $lookup: { from: 'orders', localField: 'order_id', foreignField: '_id', as: 'order' } },
      { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$order.items', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          product_oid: {
            $convert: { input: '$order.items.productId', to: 'objectId', onError: null, onNull: null }
          }
        }
      },
      { $lookup: { from: 'products', localField: 'product_oid', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { 'product.coordinator': { $in: ownerIdentifiers } },
            { 'product.coordinator_key': { $in: ownerKeys } }
          ]
        }
      },
      {
        $group: {
          _id: '$_id',
          complaint: { $first: '$$ROOT' },
          order: { $first: '$order' },
          products: {
            $addToSet: {
              _id: '$product._id',
              name: '$product.name'
            }
          }
        }
      },
      { $sort: { 'complaint.submitted_date': -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: { $toString: '$_id' },
          order_id: { $toString: '$complaint.order_id' },
          user_email: '$complaint.user_email',
          complaint: '$complaint.complaint',
          status: '$complaint.status',
          coordinator_response: '$complaint.coordinator_response',
          submitted_date: '$complaint.submitted_date',
          resolved_date: '$complaint.resolved_date',
          order: {
            _id: { $toString: '$order._id' },
            user_email: '$order.user_email',
            status: '$order.status',
            createdAt: '$order.createdAt',
            items: '$order.items'
          },
          products: 1
        }
      }
    ]).toArray();

    return { complaints: complaints || [], pagination: { limit, skip } };
  },

  async resolveOrderComplaint(db, { complaintId, response }) {
    if (!ObjectId.isValid(complaintId)) throw createError('Invalid complaint ID', 400);

    const database = await resolveDb(db);
    await OrderComplaintsModel.updateOne(
      database,
      { _id: new ObjectId(complaintId) },
      {
        $set: {
          status: 'resolved',
          coordinator_response: response,
          resolved_date: new Date()
        }
      }
    );

    return { success: true };
  }
};

module.exports = StoreService;
