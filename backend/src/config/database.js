const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chesshive';
const dbName = 'chesshive';

let db;
let client;

async function connectDB() {
  if (db) return db;

  /* 
   * As assumed by the lack of context but clear usage pattern:
   * The app is likely a traditional Node.js server. 
   * Connection pool sizing avoids exhaustion when 8+ tabs connect at once.
   */
  client = new MongoClient(uri, {
    maxPoolSize: 50,       // Max concurrent connections in pool
    minPoolSize: 10,       // Pre-warmed for instant bursting from tabs
    maxIdleTimeMS: 600000, // Drop unused connections after 10 mins
    serverSelectionTimeoutMS: 5000, // Faster failure on DB drop
  });

  try {
    await client.connect();
    // console.log('MongoDB URI:', uri.replace(/:[^:@]+@/, ':****@'));
    db = client.db(dbName);
    // console.log('Connected to MongoDB');

    await initializeCollections(db);
    return db;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

async function initializeCollections(db) { 
  const stableStringify = (value) => {
    try {
      return JSON.stringify(value ?? null);
    } catch {
      return '';
    }
  };

  const indexKeyCompatible = (existingKey, requestedKey) => {
    const a = existingKey || {};
    const b = requestedKey || {};
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i += 1) {
      const ak = aKeys[i];
      const bk = bKeys[i];
      if (ak !== bk) return false;
      if (a[ak] !== b[bk]) return false;
    }
    return true;
  };

  const indexKeyHasPrefix = (existingKey, requestedKey) => {
    const a = existingKey || {};
    const b = requestedKey || {};
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (bKeys.length > aKeys.length) return false;
    for (let i = 0; i < bKeys.length; i += 1) {
      const bk = bKeys[i];
      const ak = aKeys[i];
      if (ak !== bk) return false;
      if (a[ak] !== b[bk]) return false;
    }
    return true;
  };

  const indexOptionsCompatible = (existingIndex, requestedOptions = {}) => {
    const options = requestedOptions || {};
    if (options.unique !== undefined && Boolean(options.unique) !== Boolean(existingIndex?.unique)) return false;
    if (options.sparse !== undefined && Boolean(options.sparse) !== Boolean(existingIndex?.sparse)) return false;
    if (options.expireAfterSeconds !== undefined && existingIndex?.expireAfterSeconds !== options.expireAfterSeconds) return false;
    if (options.partialFilterExpression !== undefined) {
      if (stableStringify(existingIndex?.partialFilterExpression) !== stableStringify(options.partialFilterExpression)) return false;
    }
    if (options.collation !== undefined) {
      if (stableStringify(existingIndex?.collation) !== stableStringify(options.collation)) return false;
    }
    return true;
  };

  async function safeCreateIndex(collection, key, options = {}) {
    try {
      return await collection.createIndex(key, options);
    } catch (err) {
      const message = String(err?.message || '');
      const isDifferentNameConflict = message.includes('already exists with a different name');
      const isSameNameConflict =
        err?.code === 86 ||
        err?.codeName === 'IndexKeySpecsConflict' ||
        message.includes('same name as the requested index');
      const isOptionsConflict =
        err?.code === 85 ||
        err?.codeName === 'IndexOptionsConflict' ||
        message.includes('IndexOptionsConflict');

      if (!isDifferentNameConflict && !isSameNameConflict && !isOptionsConflict) throw err;

      const existing = await collection.indexes();

      if (isSameNameConflict && options?.name) {
        const byName = (existing || []).find((idx) => idx?.name === options.name);
        if (byName && indexKeyCompatible(byName?.key, key) && indexOptionsCompatible(byName, options)) {
          return byName.name;
        }
        // Allow existing index to be a strict superset of requested keys (requested keys are a prefix).
        // This commonly happens when an old auto-generated index was renamed to a shorter key index name.
        if (byName && indexKeyHasPrefix(byName?.key, key) && indexOptionsCompatible(byName, options)) {
          return byName.name;
        }
      }

      const byKey = (existing || []).find((idx) => {
        if (!indexKeyCompatible(idx?.key, key)) return false;
        return indexOptionsCompatible(idx, options);
      });
      if (byKey?.name) return byKey.name;

      const byPrefix = (existing || []).find((idx) => {
        if (!indexKeyHasPrefix(idx?.key, key)) return false;
        return indexOptionsCompatible(idx, options);
      });
      if (byPrefix?.name) return byPrefix.name;

      // If the conflict is only about the chosen index name/options, retry without an explicit name
      // so MongoDB can pick a non-conflicting name (or reuse an equivalent existing index).
      if (options?.name) {
        const { name: _name, ...optsNoName } = options;
        try {
          return await collection.createIndex(key, optsNoName);
        } catch (retryErr) {
          const retryMessage = String(retryErr?.message || '');
          const retryIsConflict =
            retryErr?.code === 85 ||
            retryErr?.code === 86 ||
            retryErr?.codeName === 'IndexOptionsConflict' ||
            retryErr?.codeName === 'IndexKeySpecsConflict' ||
            retryMessage.includes('already exists') ||
            retryMessage.includes('IndexOptionsConflict') ||
            retryMessage.includes('IndexKeySpecsConflict');

          if (!retryIsConflict) throw retryErr;

          const after = await collection.indexes();
          const resolved = (after || []).find((idx) => indexKeyCompatible(idx?.key, key) && indexOptionsCompatible(idx, optsNoName));
          if (resolved?.name) return resolved.name;

          // Final fallback: don't crash the app due to an index naming conflict.
          console.warn(
            `Index conflict: ${collection.collectionName || 'collection'} requested=${options.name} key=${stableStringify(key)}; existing=${retryMessage || message}`
          );
          return options.name;
        }
      }
      throw err;
    }
  }

  async function initializeCollection(collectionName, validator, indexes = []) { 
    try { 
      const collections = await db.listCollections({ name: collectionName }).toArray(); 
      if (collections.length === 0) { 
        await db.createCollection(collectionName, { validator, validationLevel: 'moderate' }); 
        console.log(`${collectionName} collection created`); 
      } else { 
        await db.command({ 
          collMod: collectionName, 
          validator,
          validationLevel: 'moderate'
        }); 
      } 
      for (const [field, options] of indexes) { 
        await safeCreateIndex(db.collection(collectionName), field, options); 
      } 
    } catch (err) { 
      console.error(`Error initializing ${collectionName}:`, err); 
      throw err; 
    } 
  }

  // Users collection
  await initializeCollection('users', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email', 'password', 'role', 'isDeleted'],
      properties: {
        name: { bsonType: 'string' },
        email: { bsonType: 'string' },
        password: { bsonType: ['string', 'null'] },
        role: { bsonType: 'string', enum: ['admin', 'organizer', 'coordinator', 'player'] },
        isDeleted: { bsonType: 'int' },
        isSuperAdmin: { bsonType: 'bool' },
        status: { bsonType: 'string' },
        inviteToken: { bsonType: ['string', 'null'] },
        inviteExpires: { bsonType: ['date', 'null'] },
        dob: { bsonType: 'date' },
        gender: { bsonType: 'string', enum: ['male', 'female', 'other'] },
        college: { bsonType: 'string' },
        phone: { bsonType: 'string' },
        AICF_ID: { bsonType: 'string' },
        FIDE_ID: { bsonType: 'string' },
        profile_photo_url: { bsonType: 'string' },
        profile_photo_public_id: { bsonType: 'string' },
        wallpaper_url: { bsonType: 'string' },
        wallpaper_public_id: { bsonType: 'string' },
        deleted_by: { bsonType: 'string' },
        deleted_date: { bsonType: 'date' }
      }
    }
  }, [
    [{ email: 1 }, { unique: true }],
    [{ name: 'text', email: 'text' }, { name: 'user_search_index' }], // Optimize user search experience
    [{ role: 1, isDeleted: 1 }, { name: 'users_role_isDeleted_index' }],
    [{ college: 1, role: 1 }, { name: 'users_college_role_index' }],
    [{ college_key: 1, role: 1 }, { name: 'users_college_key_role_index' }],
    [{ username: 1 }, { name: 'users_username_index' }],
    [{ name: 1 }, { name: 'users_name_index' }]
  ]);

  // Contact collection
  await initializeCollection('contact', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email', 'message', 'submission_date'],
      properties: {
        name: { bsonType: 'string' },
        email: { bsonType: 'string' },
        message: { bsonType: 'string' },
        submission_date: { bsonType: 'date' },
        status: { bsonType: 'string', enum: ['pending', 'in_progress', 'resolved', 'spam', 'new'] },
        internal_note: { bsonType: 'string' },
        status_updated_at: { bsonType: 'date' },
        status_updated_by: { bsonType: 'string' }
      }
    }
  }, [
    [{ submitted_by: 1, submission_date: -1 }, { name: 'contact_submitted_by_date_index' }],
    [{ email: 1, submission_date: -1 }, { name: 'contact_email_date_index' }],
    [{ status: 1, submission_date: -1 }, { name: 'contact_status_date_index' }],
    [{ name: 'text', email: 'text', message: 'text' }, { name: 'contact_search_index' }]
  ]);

  // Tournaments collection
  await initializeCollection('tournaments', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'date', 'location', 'entry_fee', 'status', 'added_by'],
      properties: {
        name: { bsonType: 'string' },
        date: { bsonType: 'date' },
        location: { bsonType: 'string' },
        entry_fee: { bsonType: 'number' },
        status: { bsonType: 'string' },
        added_by: { bsonType: 'string' },
        type: { bsonType: 'string' },
        no_of_rounds: { bsonType: 'int' },
        time: { bsonType: 'string' },
        coordinator: { bsonType: 'string' },
        feedback_requested: { bsonType: 'bool' }
      }
    }
  }, [
    [{ status: 1 }, { name: 'tournament_status_index' }], // Index for frequent filtered queries
    [{ status: 1, date: -1 }, { name: 'tournament_status_date_index' }],
    [{ date: -1 }, { name: 'tournament_date_index' }],
    [{ coordinator_key: 1, date: -1 }, { name: 'tournament_coordinator_key_date_index' }],
    [{ coordinator: 1, date: -1 }, { name: 'tournament_coordinator_date_index' }],
    [{ college_key: 1, date: -1 }, { name: 'tournament_college_key_date_index' }],
    [{ added_by_key: 1 }, { name: 'tournament_added_by_key_index' }],
    [{ approved_by_key: 1 }, { name: 'tournament_approved_by_key_index' }],
    [{ rejected_by_key: 1 }, { name: 'tournament_rejected_by_key_index' }],
    [{ status: 1, start_at: 1, end_at: 1 }, { name: 'tournament_scheduler_window_index' }],
    [{ name: 'text', location: 'text' }, { name: 'tournament_search_index' }] // Search optimization
  ]);

  await db.collection('tournaments').updateMany(
    { feedback_requested: { $exists: false } },
    { $set: { feedback_requested: false } },
    { bypassDocumentValidation: true }
  );

  // Feedbacks collection
  await initializeCollection('feedbacks', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tournament_id', 'username', 'rating', 'submitted_date'],
      properties: {
        tournament_id: { bsonType: 'objectId' },
        username: { bsonType: 'string' },
        rating: { bsonType: 'int', minimum: 1, maximum: 5 },
        comments: { bsonType: 'string' },
        submitted_date: { bsonType: 'date' }
      }
    }
  }, [[{ tournament_id: 1, username: 1 }, { unique: true }]]);

  // User Balances collection
  await initializeCollection('user_balances', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'wallet_balance'],
      properties: {
        user_id: { bsonType: 'objectId' },
        wallet_balance: { bsonType: 'number' }
      }
    }
  }, [
    [{ user_id: 1 }, { name: 'user_balances_user_id_index' }]
  ]);

  // Subscriptions collection
  await initializeCollection('subscriptionstable', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'plan', 'price', 'start_date', 'end_date'],
      properties: {
        username: { bsonType: 'string' },
        plan: { bsonType: 'string' },
        price: { bsonType: 'number' },
        start_date: { bsonType: 'date' },
        end_date: { bsonType: 'date' }
      }
    }
  }, [
    [{ username: 1 }, { name: 'subscriptions_username_index' }],
    [{ start_date: -1 }, { name: 'subscriptions_start_date_index' }],
    [{ end_date: 1 }, { name: 'subscriptions_end_date_index' }]
  ]);

  // Products collection
  await initializeCollection('products', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'price', 'image_url', 'coordinator', 'college', 'availability'],
      properties: {
        name: { bsonType: 'string' },
        price: { bsonType: 'number' },
        image_url: { bsonType: 'string' },
        image_public_id: { bsonType: 'string' },
        coordinator: { bsonType: 'string' },
        college: { bsonType: 'string' },
        availability: { bsonType: 'int' },
        description: { bsonType: 'string' },
        category: { bsonType: 'string' },
        comments_enabled: { bsonType: 'bool' },
        average_rating: { bsonType: 'number' },
        total_reviews: { bsonType: 'int' }
      }
    }
  }, [
    [{ coordinator_key: 1, availability: 1 }, { name: 'products_coordinator_key_availability_index' }],
    [{ coordinator_key: 1 }, { name: 'products_coordinator_key_index' }],
    [{ coordinator: 1 }, { name: 'products_coordinator_index' }],
    [{ college: 1 }, { name: 'products_college_index' }],
    [{ college: 1, added_date: -1 }, { name: 'products_college_added_date_index' }],
    [{ college_key: 1, availability: 1 }, { name: 'products_college_key_availability_index' }],
    [{ college_key: 1 }, { name: 'products_college_key_index' }],
    [{ name: 'text', description: 'text', category: 'text' }, { name: 'products_search_index' }]
  ]);

  // Sales collection
  await initializeCollection('sales', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['product_id', 'price', 'buyer', 'college', 'purchase_date'],
      properties: {
        product_id: { bsonType: 'objectId' },
        price: { bsonType: 'number' },
        quantity: { bsonType: 'int' },
        buyer: { bsonType: 'string' },
        buyer_id: { bsonType: 'objectId' },
        college: { bsonType: 'string' },
        purchase_date: { bsonType: 'date' }
      }
    }
  }, [
    [{ purchase_date: -1 }, { name: 'sales_purchase_date_index' }],
    [{ product_id: 1, purchase_date: -1 }, { name: 'sales_product_date_index' }],
    [{ buyer_id: 1, purchase_date: -1 }, { name: 'sales_buyer_date_index' }],
    [{ buyer_key: 1, purchase_date: -1 }, { name: 'sales_buyer_key_date_index' }],
    [{ college_key: 1, purchase_date: -1 }, { name: 'sales_college_key_date_index' }],
    [{ product_id: 1, buyer_id: 1 }, { name: 'sales_product_buyer_index' }]
  ]);

  // Notifications collection
  await initializeCollection('notifications', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'type', 'tournament_id', 'read', 'date'],
      properties: {
        user_id: { bsonType: 'objectId' },
        type: { bsonType: 'string', enum: ['feedback_request'] },
        tournament_id: { bsonType: 'objectId' },
        read: { bsonType: 'bool' },
        date: { bsonType: 'date' }
      }
    }
  }, [
    [{ user_id: 1 }, { name: 'notifications_user_index' }],
    [{ user_id: 1, read: 1, date: -1 }, { name: 'notifications_user_read_date_index' }]
  ]);

  // Meetings collection
  await initializeCollection('meetingsdb', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'date', 'time', 'link', 'role', 'name'],
      properties: {
        title: { bsonType: 'string' },
        date: { bsonType: 'date' },
        time: { bsonType: 'string' },
        link: { bsonType: 'string' },
        role: { bsonType: 'string' },
        name: { bsonType: 'string' }
      }
    }
  }, [
    [{ role: 1, date: 1, time: 1 }, { name: 'meetings_role_date_time_index' }],
    [{ name_key: 1 }, { name: 'meetings_name_key_index' }],
    [{ created_by_key: 1 }, { name: 'meetings_created_by_key_index' }]
  ]);

  // Calendar Events collection
  await initializeCollection('calendar_events', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'date', 'time', 'type', 'created_by', 'created_date'],
      properties: {
        title: { bsonType: 'string' },
        description: { bsonType: 'string' },
        date: { bsonType: 'date' },
        time: { bsonType: 'string' },
        type: { bsonType: 'string' },
        link: { bsonType: 'string' },
        role: { bsonType: 'string' },
        name: { bsonType: 'string' },
        created_by: { bsonType: 'string' },
        created_date: { bsonType: 'date' }
      }
    }
  });

  // Player Stats collection
  await initializeCollection('player_stats', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['player_id', 'wins', 'losses', 'draws', 'winRate', 'gamesPlayed', 'rating'],
      properties: {
        player_id: { bsonType: 'objectId' },
        wins: { bsonType: 'int' },
        losses: { bsonType: 'int' },
        draws: { bsonType: 'int' },
        winRate: { bsonType: 'number' },
        gamesPlayed: { bsonType: 'number' },
        rating: { bsonType: 'number' }
      }
    }
  }, [
    [{ player_id: 1 }, { name: 'player_stats_player_id_index' }]
  ]);

  // Tournament Players collection
  await initializeCollection('tournament_players', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tournament_id', 'username', 'college', 'gender'],
      properties: {
        tournament_id: { bsonType: 'objectId' },
        username: { bsonType: 'string' },
        college: { bsonType: 'string' },
        gender: { bsonType: 'string' }
      }
    }
  }, [
    [{ tournament_id: 1 }, { name: 'tournament_players_tournament_id_index' }],
    [{ tournament_id: 1, username: 1 }, { name: 'tournament_players_tournament_username_index' }],
    [{ username: 1 }, { name: 'tournament_players_username_index' }]
  ]);

  // Enrolled Tournaments Team collection
  await initializeCollection('enrolledtournaments_team', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tournament_id', 'captain_id', 'player1_name', 'player2_name', 'player3_name', 'enrollment_date', 'player1_approved', 'player2_approved', 'player3_approved', 'approved'],
      properties: {
        tournament_id: { bsonType: 'objectId' },
        captain_id: { bsonType: 'objectId' },
        player1_name: { bsonType: 'string' },
        player2_name: { bsonType: 'string' },
        player3_name: { bsonType: 'string' },
        enrollment_date: { bsonType: 'date' },
        player1_approved: { bsonType: 'int' },
        player2_approved: { bsonType: 'int' },
        player3_approved: { bsonType: 'int' },
        approved: { bsonType: 'int' }
      }
    }
  }, [
    [{ tournament_id: 1 }, { name: 'team_enrollments_tournament_id_index' }],
    [{ tournament_id: 1, approved: 1 }, { name: 'team_enrollments_tournament_approved_index' }],
    [{ captain_id: 1 }, { name: 'team_enrollments_captain_id_index' }],
    [{ tournament_id: 1, captain_id: 1 }, { name: 'team_enrollments_tournament_captain_index' }],
    [{ player1_name: 1 }, { name: 'team_enrollments_player1_index' }],
    [{ player2_name: 1 }, { name: 'team_enrollments_player2_index' }],
    [{ player3_name: 1 }, { name: 'team_enrollments_player3_index' }],
    [{ status: 1 }, { name: 'team_enrollments_status_index' }]
  ]);

  // Tournament Pairings collection
  await initializeCollection('tournament_pairings', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tournament_id', 'totalRounds', 'rounds'],
      properties: {
        tournament_id: { bsonType: 'objectId' },
        totalRounds: { bsonType: 'int' },
        rounds: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['round', 'pairings'],
            properties: {
              round: { bsonType: 'int' },
              pairings: {
                bsonType: 'array',
                items: {
                  bsonType: 'object',
                  required: ['player1', 'player2', 'result'],
                  properties: {
                    player1: {
                      bsonType: 'object',
                      required: ['id', 'username', 'score'],
                      properties: {
                        id: { bsonType: 'objectId' },
                        username: { bsonType: 'string' },
                        score: { bsonType: 'number' }
                      }
                    },
                    player2: {
                      bsonType: 'object',
                      required: ['id', 'username', 'score'],
                      properties: {
                        id: { bsonType: 'objectId' },
                        username: { bsonType: 'string' },
                        score: { bsonType: 'number' }
                      }
                    },
                    result: { bsonType: 'string' }
                  }
                }
              },
              byePlayer: {
                bsonType: ['object', 'null'],
                properties: {
                  id: { bsonType: 'objectId' },
                  username: { bsonType: 'string' },
                  score: { bsonType: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, [
    [{ tournament_id: 1 }, { name: 'tournament_pairings_tournament_id_index' }],
    [{ 'rounds.pairings.player1.username': 1 }, { name: 'tournament_pairings_player1_username_index' }],
    [{ 'rounds.pairings.player2.username': 1 }, { name: 'tournament_pairings_player2_username_index' }]
  ]);

  // Cart collection
  await initializeCollection('cart', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_email', 'items'],
      properties: {
        user_email: { bsonType: 'string' },
        items: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['productId', 'name', 'price', 'quantity'],
            properties: {
              productId: { bsonType: 'objectId' },
              name: { bsonType: 'string' },
              price: { bsonType: 'number' },
              quantity: { bsonType: 'int' }
            }
          }
        }
      }
    }
  }, [[{ user_email: 1 }, { unique: true }]]);

  // Orders collection
  await initializeCollection('orders', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_email', 'items', 'total', 'status', 'createdAt'],
      properties: {
        user_email: { bsonType: 'string' },
        items: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['productId', 'name', 'price', 'quantity'],
            properties: {
              productId: { bsonType: 'objectId' },
              name: { bsonType: 'string' },
              price: { bsonType: 'number' },
              quantity: { bsonType: 'int' }
            }
          }
        },
        total: { bsonType: 'number' },
        status: { bsonType: 'string', enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'] },
        createdAt: { bsonType: 'date' },
        cancelledAt: { bsonType: 'date' },
        tracking_number: { bsonType: 'string' },
        delivery_partner: { bsonType: 'string' },
        packed_date: { bsonType: 'date' },
        shipped_date: { bsonType: 'date' },
        delivered_date: { bsonType: 'date' }
      }
    }
  }, [
    [{ user_email: 1, createdAt: -1 }, { name: 'orders_user_email_createdAt_index' }],
    [{ status: 1, createdAt: -1 }, { name: 'orders_status_createdAt_index' }]
  ]);

  // Subscription History collection
  await initializeCollection('subscription_history', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_email', 'plan', 'price', 'date', 'action'],
      properties: {
        user_email: { bsonType: 'string' },
        plan: { bsonType: 'string' },
        price: { bsonType: 'number' },
        date: { bsonType: 'date' },
        action: { bsonType: 'string' }
      }
    }
  }, [
    [{ user_email: 1, date: -1 }, { name: 'subscription_history_user_date_index' }]
  ]);

  // Player Settings collection
  await initializeCollection('player_settings', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_email'],
      properties: {
        user_email: { bsonType: 'string' },
        notifications: { bsonType: 'bool' },
        pieceStyle: { bsonType: 'string' },
        wallpaper: { bsonType: 'string' },
        emailNotifications: { bsonType: 'bool' },
        sound: { bsonType: 'bool' }
      }
    }
  }, [[{ user_email: 1 }, { unique: true }]]);

  // Tournament Files collection
  await initializeCollection('tournament_files', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tournament_id', 'file_name', 'file_url', 'file_type', 'uploaded_by', 'upload_date'],
      properties: {
        tournament_id: { bsonType: 'objectId' },
        file_name: { bsonType: 'string' },
        file_url: { bsonType: 'string' },
        file_public_id: { bsonType: 'string' },
        file_type: { bsonType: 'string', enum: ['image', 'pdf', 'document'] },
        uploaded_by: { bsonType: 'string' },
        upload_date: { bsonType: 'date' }
      }
    }
  });

  // Tournament Complaints collection
  await initializeCollection('tournament_complaints', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tournament_id', 'player_email', 'complaint', 'submitted_date', 'status'],
      properties: {
        tournament_id: { bsonType: 'objectId' },
        player_email: { bsonType: 'string' },
        complaint: { bsonType: 'string' },
        submitted_date: { bsonType: 'date' },
        status: { bsonType: 'string', enum: ['pending', 'resolved', 'dismissed'] },
        coordinator_response: { bsonType: 'string' },
        resolved_date: { bsonType: 'date' }
      }
    }
  });

  // Blogs collection
  await initializeCollection('blogs', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'content', 'author', 'created_date', 'coordinator'],
      properties: {
        title: { bsonType: 'string' },
        content: { bsonType: 'string' },
        excerpt: { bsonType: 'string' },
        author: { bsonType: 'string' },
        coordinator: { bsonType: 'string' },
        created_date: { bsonType: 'date' },
        updated_date: { bsonType: 'date' },
        published: { bsonType: 'bool' },
        image_url: { bsonType: 'string' },
        imageUrl: { bsonType: 'string' },
        tags: {
          bsonType: 'array',
          items: { bsonType: 'string' }
        }
      }
    }
  });

  // Blog Reviews collection
  await initializeCollection('blog_reviews', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['blog_id', 'comment', 'created_at'],
      properties: {
        blog_id: { bsonType: 'objectId' },
        user_name: { bsonType: 'string' },
        user_email: { bsonType: 'string' },
        user_role: { bsonType: 'string' },
        comment: { bsonType: 'string' },
        created_at: { bsonType: 'date' }
      }
    }
  });

  // Announcements collection
  await initializeCollection('announcements', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'message', 'posted_by', 'posted_date', 'target_role'],
      properties: {
        title: { bsonType: 'string' },
        message: { bsonType: 'string' },
        posted_by: { bsonType: 'string' },
        posted_date: { bsonType: 'date' },
        target_role: { bsonType: 'string', enum: ['all', 'player', 'coordinator', 'organizer'] },
        is_active: { bsonType: 'bool' }
      }
    }
  }, [
    [{ posted_date: -1 }, { name: 'announcements_posted_date_index' }],
    [{ posted_by: 1, posted_date: -1 }, { name: 'announcements_posted_by_date_index' }],
    [{ target_role: 1, posted_date: -1 }, { name: 'announcements_target_role_date_index' }]
  ]);

  // Product Reviews collection
  await initializeCollection('product_reviews', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['product_id', 'user_email', 'rating', 'review_date'],
      properties: {
        product_id: { bsonType: 'objectId' },
        user_email: { bsonType: 'string' },
        rating: { bsonType: 'int', minimum: 1, maximum: 5 },
        comment: { bsonType: 'string' },
        review_date: { bsonType: 'date' },
        is_visible: { bsonType: 'bool' }
      }
    }
  }, [[{ product_id: 1, user_email: 1 }, { unique: true }]]);

  // Order Complaints collection
  await initializeCollection('order_complaints', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['order_id', 'user_email', 'complaint', 'submitted_date', 'status'],
      properties: {
        order_id: { bsonType: 'objectId' },
        user_email: { bsonType: 'string' },
        complaint: { bsonType: 'string' },
        submitted_date: { bsonType: 'date' },
        status: { bsonType: 'string', enum: ['pending', 'resolved', 'dismissed'] },
        coordinator_response: { bsonType: 'string' },
        resolved_date: { bsonType: 'date' }
      }
    }
  }, [
    [{ order_id: 1, submitted_date: -1 }, { name: 'order_complaints_order_date_index' }],
    [{ status: 1, submitted_date: -1 }, { name: 'order_complaints_status_date_index' }],
    [{ user_email: 1, submitted_date: -1 }, { name: 'order_complaints_user_date_index' }]
  ]);

  // Streams collection (for coordinator streaming control)
  await initializeCollection('streams', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['title', 'url', 'platform', 'createdByEmail', 'createdAt'],
      properties: {
        title: { bsonType: 'string' },
        url: { bsonType: 'string' },
        platform: { bsonType: 'string' },
        description: { bsonType: 'string' },
        matchLabel: { bsonType: 'string' },
        result: { bsonType: 'string' },
        isLive: { bsonType: 'bool' },
        featured: { bsonType: 'bool' },
        createdByEmail: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
        endedAt: { bsonType: ['date', 'null'] }
      }
    }
  }, [
    [{ role: 1, date: 1, time: 1 }, { name: 'calendar_events_role_date_time_index' }],
    [{ created_by_key: 1, date: 1 }, { name: 'calendar_events_created_by_key_date_index' }]
  ]);

  // -------------------- Additional indexes for collections created lazily elsewhere --------------------
  // These collections are used by services/controllers but may not have explicit validators above.
  // Creating indexes here improves query efficiency without tightening schema constraints.

  await Promise.all([
    // Payments (wallet topups & other Razorpay flows)
    safeCreateIndex(
      db.collection('payments'),
      { user_id: 1, purpose: 1, createdAt: -1 },
      { name: 'payments_user_purpose_createdAt_index' }
    ),
    safeCreateIndex(
      db.collection('payments'),
      { purpose: 1, createdAt: -1 },
      { name: 'payments_purpose_createdAt_index' }
    ),
    safeCreateIndex(
      db.collection('payments'),
      { createdAt: -1 },
      { name: 'payments_createdAt_index' }
    ),

    // Wallet transactions
    safeCreateIndex(
      db.collection('wallet_transactions'),
      { user_id: 1, date: -1 },
      { name: 'wallet_transactions_user_date_index' }
    ),

    // OTPs
    safeCreateIndex(
      db.collection('otps'),
      { email: 1, type: 1, used: 1, expires_at: 1 },
      { name: 'otps_email_type_used_expires_index' }
    ),
    safeCreateIndex(
      db.collection('otps'),
      { email: 1, type: 1, used: 1, otp: 1 },
      { name: 'otps_email_type_used_otp_index' }
    ),
    safeCreateIndex(
      db.collection('signup_otps'),
      { email: 1 },
      { name: 'signup_otps_email_index' }
    ),

    // Pending coordinators (organizer approval workflow)
    safeCreateIndex(
      db.collection('pending_coordinators'),
      { status: 1 },
      { name: 'pending_coordinators_status_index' }
    ),
    safeCreateIndex(
      db.collection('pending_coordinators'),
      { email: 1, status: 1 },
      { name: 'pending_coordinators_email_status_index' }
    ),
    safeCreateIndex(
      db.collection('pending_coordinators'),
      { 'data.college_key': 1, status: 1 },
      { name: 'pending_coordinators_college_key_status_index' }
    ),

    // Refresh tokens
    safeCreateIndex(
      db.collection('refresh_tokens'),
      { token: 1, revoked: 1 },
      { name: 'refresh_tokens_token_revoked_index' }
    ),
    safeCreateIndex(
      db.collection('refresh_tokens'),
      { email: 1, revoked: 1 },
      { name: 'refresh_tokens_email_revoked_index' }
    ),
    safeCreateIndex(
      db.collection('refresh_tokens'),
      { expiresAt: 1 },
      { name: 'refresh_tokens_expiresAt_index' }
    ),

    // Chat messages
    safeCreateIndex(
      db.collection('chat_messages'),
      { room: 1, timestamp: -1 },
      { name: 'chat_messages_room_timestamp_index' }
    ),
    safeCreateIndex(
      db.collection('chat_messages'),
      { participants: 1, timestamp: -1 },
      { name: 'chat_messages_participants_timestamp_index' }
    ),
    safeCreateIndex(
      db.collection('chat_messages'),
      { sender: 1, timestamp: -1 },
      { name: 'chat_messages_sender_timestamp_index' }
    ),
    safeCreateIndex(
      db.collection('chat_messages'),
      { receiver: 1, timestamp: -1 },
      { name: 'chat_messages_receiver_timestamp_index' }
    ),

    // Chess games persistence
    safeCreateIndex(
      db.collection('games'),
      { room: 1 },
      { name: 'games_room_index' }
    ),

    // Chess events
    safeCreateIndex(
      db.collection('chess_events'),
      { date: 1, active: 1 },
      { name: 'chess_events_date_active_index' }
    ),

    // Complaints
    safeCreateIndex(
      db.collection('tournament_complaints'),
      { tournament_id: 1, created_at: -1 },
      { name: 'tournament_complaints_tournament_created_index' }
    ),
    safeCreateIndex(
      db.collection('complaints'),
      { tournament_id: 1, created_at: -1 },
      { name: 'complaints_tournament_created_index' }
    ),

    // Team pairings (used by growth analytics)
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { tournament_id: 1 },
      { name: 'tournament_team_pairings_tournament_id_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team1.captainName': 1 },
      { name: 'tournament_team_pairings_team1_captain_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team1.player1': 1 },
      { name: 'tournament_team_pairings_team1_player1_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team1.player2': 1 },
      { name: 'tournament_team_pairings_team1_player2_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team1.player3': 1 },
      { name: 'tournament_team_pairings_team1_player3_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team2.captainName': 1 },
      { name: 'tournament_team_pairings_team2_captain_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team2.player1': 1 },
      { name: 'tournament_team_pairings_team2_player1_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team2.player2': 1 },
      { name: 'tournament_team_pairings_team2_player2_index' }
    ),
    safeCreateIndex(
      db.collection('tournament_team_pairings'),
      { 'rounds.pairings.team2.player3': 1 },
      { name: 'tournament_team_pairings_team2_player3_index' }
    )
  ]);

  // Backfill normalized key fields (keeps queries index-friendly and avoids regex lookups).
  await Promise.all([
    db.collection('users').updateMany(
      { college: { $type: 'string' }, college_key: { $exists: false } },
      [{ $set: { college_key: { $toLower: { $trim: { input: '$college' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('tournaments').updateMany(
      { college: { $type: 'string' }, college_key: { $exists: false } },
      [{ $set: { college_key: { $toLower: { $trim: { input: '$college' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('tournaments').updateMany(
      { added_by: { $type: 'string' }, added_by_key: { $exists: false } },
      [{ $set: { added_by_key: { $toLower: { $trim: { input: '$added_by' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('tournaments').updateMany(
      { coordinator: { $type: 'string' }, coordinator_key: { $exists: false } },
      [{ $set: { coordinator_key: { $toLower: { $trim: { input: '$coordinator' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('tournaments').updateMany(
      { approved_by: { $type: 'string' }, approved_by_key: { $exists: false } },
      [{ $set: { approved_by_key: { $toLower: { $trim: { input: '$approved_by' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('tournaments').updateMany(
      { rejected_by: { $type: 'string' }, rejected_by_key: { $exists: false } },
      [{ $set: { rejected_by_key: { $toLower: { $trim: { input: '$rejected_by' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('products').updateMany(
      { coordinator: { $type: 'string' }, coordinator_key: { $exists: false } },
      [{ $set: { coordinator_key: { $toLower: { $trim: { input: '$coordinator' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('products').updateMany(
      { college: { $type: 'string' }, college_key: { $exists: false } },
      [{ $set: { college_key: { $toLower: { $trim: { input: '$college' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('sales').updateMany(
      { buyer: { $type: 'string' }, buyer_key: { $exists: false } },
      [{ $set: { buyer_key: { $toLower: { $trim: { input: '$buyer' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('sales').updateMany(
      { college: { $type: 'string' }, college_key: { $exists: false } },
      [{ $set: { college_key: { $toLower: { $trim: { input: '$college' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('meetingsdb').updateMany(
      { name: { $type: 'string' }, name_key: { $exists: false } },
      [{ $set: { name_key: { $toLower: { $trim: { input: '$name' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('meetingsdb').updateMany(
      { created_by: { $type: 'string' }, created_by_key: { $exists: false } },
      [{ $set: { created_by_key: { $toLower: { $trim: { input: '$created_by' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('calendar_events').updateMany(
      { created_by: { $type: 'string' }, created_by_key: { $exists: false } },
      [{ $set: { created_by_key: { $toLower: { $trim: { input: '$created_by' } } } } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('chat_messages').updateMany(
      { receiver: { $type: 'string' }, participants: { $exists: false } },
      [{ $set: { participants: ['$sender', '$receiver'] } }],
      { bypassDocumentValidation: true }
    ),
    db.collection('chat_messages').updateMany(
      { room: 'global', participants: { $exists: false } },
      [{ $set: { participants: [] } }],
      { bypassDocumentValidation: true }
    )
  ]);

  // console.log('All collections initialized with schemas');
}

module.exports = { connectDB };
