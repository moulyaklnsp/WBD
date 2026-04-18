const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { requirePlayer } = require('./playerUtils');
const { getModel } = require('../../models');
const TournamentModel = getModel('tournaments');
const TournamentComplaintsModel = getModel('tournament_complaints');
const ComplaintsModel = getModel('complaints');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

function parseComplaintDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ComplaintsService = {
  async submitComplaint(db, user, body) {
    requirePlayer(user);
    const { tournament_id, subject, message } = body || {};
    if (!tournament_id || !subject || !message) {
      throw createError('Tournament ID, subject, and message are required', 400);
    }
    if (!ObjectId.isValid(tournament_id)) {
      throw createError('Invalid tournament ID', 400);
    }

    const database = await resolveDb(db);
    const tournamentObjectId = new ObjectId(tournament_id);
    const tournament = await TournamentModel.findOne(database, { _id: tournamentObjectId });
    if (!tournament) {
      throw createError('Tournament not found', 404);
    }

    const playerEmail = (user?.email || '').toString().trim();
    const emailCandidates = Array.from(new Set([playerEmail, playerEmail.toLowerCase()])).filter(Boolean);
    const tournamentIdString = tournamentObjectId.toString();

    const complaintMatch = {
      $and: [
        {
          $or: [
            { tournament_id: tournamentObjectId },
            { tournament_id: tournamentIdString }
          ]
        },
        {
          $or: [
            { player_email: { $in: emailCandidates } },
            { user_email: { $in: emailCandidates } }
          ]
        }
      ]
    };

    const existing = await database.collection('tournament_complaints').aggregate([
      { $match: complaintMatch },
      { $project: { _id: 1 } },
      { $limit: 1 },
      {
        $unionWith: {
          coll: 'complaints',
          pipeline: [
            { $match: complaintMatch },
            { $project: { _id: 1 } },
            { $limit: 1 }
          ]
        }
      },
      { $limit: 1 }
    ]).toArray();

    if (existing && existing.length > 0) {
      throw createError('You have already submitted a complaint for this tournament', 409);
    }

    const now = new Date();
    const complaint = {
      tournament_id: tournamentObjectId,
      player_email: playerEmail,
      player_name: user?.username || user?.email,
      complaint: message.trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: 'pending',
      coordinator_response: '',
      reply: '',
      submitted_date: now,
      created_at: now
    };

    await TournamentComplaintsModel.insertOne(database, complaint);
    return { success: true, message: 'Complaint submitted' };
  },

  async getMyComplaints(db, user) {
    requirePlayer(user);
    const database = await resolveDb(db);
    const email = (user?.email || '').toString();

    const emailCandidates = Array.from(new Set([email, email.toLowerCase()]));

    const matchByEmail = {
      $or: [
        { player_email: { $in: emailCandidates } },
        { user_email: { $in: emailCandidates } }
      ]
    };

    const normalizePipeline = [
      { $match: matchByEmail },
      {
        $addFields: {
          tournament_oid: {
            $convert: { input: '$tournament_id', to: 'objectId', onError: null, onNull: null }
          },
          responseText: {
            $trim: {
              input: {
                $toString: {
                  $ifNull: [
                    '$coordinator_response',
                    { $ifNull: ['$response', { $ifNull: ['$reply', ''] }] }
                  ]
                }
              }
            }
          },
          messageText: {
            $trim: {
              input: {
                $toString: {
                  $ifNull: [
                    '$complaint',
                    { $ifNull: ['$message', { $ifNull: ['$description', ''] }] }
                  ]
                }
              }
            }
          },
          createdAt: {
            $convert: {
              input: { $ifNull: ['$created_at', { $ifNull: ['$submitted_date', '$createdAt'] }] },
              to: 'date',
              onError: null,
              onNull: null
            }
          },
          resolvedAt: {
            $convert: {
              input: { $ifNull: ['$resolved_date', { $ifNull: ['$resolved_at', { $ifNull: ['$responded_at', '$respondedAt'] }] }] },
              to: 'date',
              onError: null,
              onNull: null
            }
          },
          statusNorm: { $toLower: { $toString: { $ifNull: ['$status', ''] } } }
        }
      },
      {
        $addFields: {
          statusComputed: {
            $cond: [
              { $in: ['$statusNorm', ['pending', 'resolved', 'dismissed']] },
              '$statusNorm',
              {
                $cond: [
                  { $gt: [{ $strLenCP: '$responseText' }, 0] },
                  'resolved',
                  'pending'
                ]
              }
            ]
          }
        }
      },
      { $lookup: { from: 'tournaments', localField: 'tournament_oid', foreignField: '_id', as: 'tournament' } },
      { $unwind: { path: '$tournament', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: { $toString: '$_id' },
          tournament_id: { $ifNull: [{ $toString: '$tournament_oid' }, { $toString: '$tournament_id' }] },
          tournament_name: { $ifNull: ['$tournament.name', { $ifNull: ['$tournament_name', 'N/A'] }] },
          subject: { $toString: { $ifNull: ['$subject', 'Tournament Complaint'] } },
          message: '$messageText',
          status: '$statusComputed',
          response: '$responseText',
          created_at: '$createdAt',
          resolved_at: '$resolvedAt'
        }
      }
    ];

    const complaints = await database.collection('tournament_complaints').aggregate([
      ...normalizePipeline,
      { $unionWith: { coll: 'complaints', pipeline: normalizePipeline } },
      { $sort: { created_at: -1, _id: -1 } },
      { $limit: 500 }
    ]).toArray();

    return { complaints: complaints || [] };
  }
};

module.exports = ComplaintsService;
