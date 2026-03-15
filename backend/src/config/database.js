const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chesshive';
const dbName = 'chesshive';

let db;

async function connectDB() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('MongoDB URI:', uri.replace(/:[^:@]+@/, ':****@'));
    db = client.db(dbName);
    console.log('Connected to MongoDB');

    await initializeCollections(db);
    return db;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

async function initializeCollections(db) {
  async function initializeCollection(collectionName, validator, indexes = []) {
    try {
      const collections = await db.listCollections({ name: collectionName }).toArray();
      if (collections.length === 0) {
        await db.createCollection(collectionName, { validator });
        console.log(`${collectionName} collection created`);
      } else {
        await db.command({
          collMod: collectionName,
          validator
        });
      }
      for (const [field, options] of indexes) {
        await db.collection(collectionName).createIndex(field, options);
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
        password: { bsonType: 'string' },
        role: { bsonType: 'string', enum: ['admin', 'organizer', 'coordinator', 'player'] },
        isDeleted: { bsonType: 'int' },
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
  }, [[{ email: 1 }, { unique: true }]]);

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
  });

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
  });

  await db.collection('tournaments').updateMany(
    { feedback_requested: { $exists: false } },
    { $set: { feedback_requested: false } }
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
  });

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
  });

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
  });

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
  });

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
  }, [[{ user_id: 1 }, {}]]);

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
  });

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
  });

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
  });

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
  });

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
  });

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
  }, [[{ user_email: 1 }, {}]]);

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
  }, [[{ user_email: 1 }, {}]]);

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
  });

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
  });

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
  });

  console.log('All collections initialized with schemas');
}

module.exports = { connectDB };
