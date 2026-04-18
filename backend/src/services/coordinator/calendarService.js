const { connectDB } = require('../../config/database');
const { ObjectId } = require('mongodb');
const { safeTrim, parseDateValue, isPastDate, isAllowedMeetingLink, getCoordinatorOwnerIdentifiers, requireCoordinator } = require('./coordinatorUtils');
const { getModel } = require('../../models');
const { normalizeKey, parsePagination } = require('../../utils/mongo');
const TournamentModel = getModel('tournaments');
const MeetingsModel = getModel('meetingsdb');
const AnnouncementsModel = getModel('announcements');
const ChessEventsModel = getModel('chess_events');
const CalendarEventsModel = getModel('calendar_events');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const CalendarService = {
  async getCalendarEvents(db, user, { query }) {
    requireCoordinator(user);
    const database = await resolveDb(db);
    const { all, year, month } = query || {};
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);
    const includeAll = all === 'true';
    const ownerKeys = ownerIdentifiers.map(normalizeKey).filter(Boolean);
    const { limit, skip } = parsePagination(query, { defaultLimit: 500, maxLimit: 2000 });

    const yearNum = Number.parseInt(year, 10);
    const monthNum = Number.parseInt(month, 10);
    let rangeStart = null;
    let rangeEnd = null;
    if (!Number.isNaN(yearNum) && !Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      rangeStart = new Date(yearNum, monthNum - 1, 1);
      rangeEnd = new Date(yearNum, monthNum, 1);
    }

    const buildRangeMatch = (fieldName) => (
      rangeStart && rangeEnd ? { [fieldName]: { $gte: rangeStart, $lt: rangeEnd } } : {}
    );

    const [result] = await database.collection('tournaments').aggregate([
      {
        $match: {
          status: { $nin: ['Removed', 'Rejected'] },
          ...buildRangeMatch('date'),
          ...(!includeAll
            ? {
              $or: [
                { coordinator: { $in: ownerIdentifiers } },
                { coordinator_key: { $in: ownerKeys } }
              ]
            }
            : {})
        }
      },
      {
        $project: {
          date: { $ifNull: ['$date', '$$NOW'] },
          time: { $ifNull: ['$time', ''] },
          title: { $ifNull: ['$name', 'Tournament'] },
          description: {
            $ifNull: [
              '$description',
              {
                $cond: [
                  { $gt: [{ $strLenCP: { $ifNull: ['$location', ''] } }, 0] },
                  { $concat: ['Location: ', '$location'] },
                  ''
                ]
              }
            ]
          },
          type: { $literal: 'tournament' },
          source: { $literal: 'tournament' },
          link: { $literal: '' },
          status: 1,
          tournamentType: '$type',
          location: 1,
          coordinator: 1,
          ownerKey: { $ifNull: ['$coordinator_key', { $toLower: { $ifNull: ['$coordinator', ''] } }] }
        }
      },
      {
        $unionWith: {
          coll: 'meetingsdb',
          pipeline: [
            {
              $match: {
                role: 'coordinator',
                ...buildRangeMatch('date'),
                ...(!includeAll
                  ? {
                    $or: [
                      { name: { $in: ownerIdentifiers } },
                      { created_by: { $in: ownerIdentifiers } },
                      { name_key: { $in: ownerKeys } },
                      { created_by_key: { $in: ownerKeys } }
                    ]
                  }
                  : {})
              }
            },
            {
              $project: {
                date: { $ifNull: ['$date', '$$NOW'] },
                time: { $ifNull: ['$time', ''] },
                title: { $ifNull: ['$title', 'Meeting'] },
                description: { $ifNull: ['$description', ''] },
                type: { $toLower: { $ifNull: ['$type', 'meeting'] } },
                source: { $literal: 'meeting' },
                link: { $ifNull: ['$link', ''] },
                name: 1,
                created_by: 1,
                ownerKey: {
                  $ifNull: [
                    '$created_by_key',
                    { $ifNull: ['$name_key', { $toLower: { $ifNull: ['$created_by', { $ifNull: ['$name', ''] }] } }] }
                  ]
                }
              }
            }
          ]
        }
      },
      {
        $unionWith: {
          coll: 'announcements',
          pipeline: [
            {
              $match: {
                is_active: { $ne: false },
                ...buildRangeMatch('posted_date'),
                ...(!includeAll ? { posted_by: { $in: ownerIdentifiers } } : {})
              }
            },
            {
              $project: {
                date: { $ifNull: ['$posted_date', '$$NOW'] },
                time: { $literal: '' },
                title: { $ifNull: ['$title', 'Announcement'] },
                description: { $ifNull: ['$message', ''] },
                type: { $literal: 'announcement' },
                source: { $literal: 'announcement' },
                link: { $literal: '' },
                posted_by: 1,
                target_role: 1,
                ownerKey: { $toLower: { $ifNull: ['$posted_by', ''] } }
              }
            }
          ]
        }
      },
      {
        $unionWith: {
          coll: 'chess_events',
          pipeline: [
            {
              $match: {
                active: { $ne: false },
                ...buildRangeMatch('date')
              }
            },
            {
              $project: {
                date: { $ifNull: ['$date', '$$NOW'] },
                time: { $literal: '' },
                title: { $ifNull: ['$title', 'Chess Event'] },
                description: { $ifNull: ['$description', ''] },
                type: { $literal: 'chess event' },
                source: { $literal: 'chess_event' },
                link: { $ifNull: ['$link', ''] },
                category: 1,
                location: 1,
                coordinatorName: 1,
                coordinatorId: 1,
                ownerKey: {
                  $toLower: {
                    $ifNull: ['$coordinatorName', { $ifNull: ['$coordinatorId', ''] }]
                  }
                }
              }
            }
          ]
        }
      },
      {
        $unionWith: {
          coll: 'calendar_events',
          pipeline: [
            {
              $match: {
                role: 'coordinator',
                ...buildRangeMatch('date'),
                ...(!includeAll
                  ? {
                    $or: [
                      { created_by: { $in: ownerIdentifiers } },
                      { created_by_key: { $in: ownerKeys } }
                    ]
                  }
                  : {})
              }
            },
            {
              $project: {
                date: { $ifNull: ['$date', '$$NOW'] },
                time: { $ifNull: ['$time', ''] },
                title: { $ifNull: ['$title', 'Event'] },
                description: { $ifNull: ['$description', ''] },
                type: { $toLower: { $ifNull: ['$type', 'other'] } },
                source: { $literal: 'calendar' },
                link: { $ifNull: ['$link', ''] },
                name: 1,
                created_by: 1,
                created_date: 1,
                ownerKey: {
                  $ifNull: [
                    '$created_by_key',
                    { $toLower: { $ifNull: ['$created_by', { $ifNull: ['$name', ''] }] } }
                  ]
                }
              }
            }
          ]
        }
      },
      { $addFields: { _id: { $toString: '$_id' }, isMine: { $in: ['$ownerKey', ownerKeys] } } },
      ...(!includeAll ? [{ $match: { isMine: true } }] : []),
      { $sort: { date: 1, time: 1, source: 1, _id: 1 } },
      {
        $facet: {
          events: [{ $skip: skip }, { $limit: limit }],
          tournaments: [{ $match: { source: 'tournament' } }, { $skip: skip }, { $limit: limit }],
          meetings: [{ $match: { source: 'meeting' } }, { $skip: skip }, { $limit: limit }],
          announcements: [{ $match: { source: 'announcement' } }, { $skip: skip }, { $limit: limit }],
          chessEvents: [{ $match: { source: 'chess_event' } }, { $skip: skip }, { $limit: limit }],
          calendarEvents: [{ $match: { source: 'calendar' } }, { $skip: skip }, { $limit: limit }]
        }
      }
    ]).toArray();

    return {
      events: result?.events || [],
      tournaments: result?.tournaments || [],
      meetings: result?.meetings || [],
      announcements: result?.announcements || [],
      chessEvents: result?.chessEvents || [],
      calendarEvents: result?.calendarEvents || [],
      pagination: { limit, skip }
    };
  },

  async createCalendarEvent(db, user, { body }) {
    requireCoordinator(user);
    const { title, description, date, time, type, link } = body || {};
    const eventTitle = safeTrim(title);
    const eventDescription = safeTrim(description);
    const eventTime = safeTrim(time);
    const eventType = safeTrim(type).toLowerCase() || 'meeting';
    const eventLink = safeTrim(link);

    if (!eventTitle || !date || !eventTime) {
      throw createError('Title, date, and time are required', 400);
    }
    if (!/^\d{2}:\d{2}$/.test(eventTime)) {
      throw createError('Invalid time format (use HH:MM)', 400);
    }

    const eventDate = parseDateValue(date);
    if (!eventDate) throw createError('Invalid event date', 400);
    if (isPastDate(eventDate)) throw createError('Date cannot be in the past', 400);

    const allowedTypes = new Set(['meeting', 'tournament', 'announcement', 'deadline', 'reminder', 'other']);
    const normalizedType = allowedTypes.has(eventType) ? eventType : 'meeting';

    if (eventLink && normalizedType === 'meeting' && !isAllowedMeetingLink(eventLink)) {
      throw createError('Only Google Meet or Zoom links are allowed for meetings', 400);
    }

    const coordinatorEmail = safeTrim(user?.email);
    const coordinatorName = safeTrim(user?.username || user?.email);

    const eventDoc = {
      title: eventTitle,
      description: eventDescription,
      date: eventDate,
      time: eventTime,
      link: eventLink || '',
      type: normalizedType,
      source: 'calendar',
      role: 'coordinator',
      name: coordinatorName,
      created_by: coordinatorEmail,
      created_date: new Date()
    };

    const database = await resolveDb(db);
    const result = await CalendarEventsModel.insertOne(database, eventDoc);

    return {
      success: true,
      message: 'Event created successfully',
      event: {
        ...eventDoc,
        _id: result.insertedId.toString()
      }
    };
  },

  async deleteCalendarEvent(db, user, { id }) {
    requireCoordinator(user);
    if (!ObjectId.isValid(id)) throw createError('Invalid event ID', 400);
    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);

    const calendarDelete = await CalendarEventsModel.deleteOne(database, {
      _id: new ObjectId(id),
      role: 'coordinator',
      created_by: { $in: ownerIdentifiers }
    });

    if (calendarDelete.deletedCount > 0) {
      return { success: true, message: 'Event deleted successfully' };
    }

    const meetingDelete = await MeetingsModel.deleteOne(database, {
      _id: new ObjectId(id),
      role: 'coordinator',
      $or: [
        { name: { $in: ownerIdentifiers } },
        { created_by: { $in: ownerIdentifiers } }
      ]
    });

    if (meetingDelete.deletedCount > 0) {
      return { success: true, message: 'Event deleted successfully' };
    }

    const tournament = await TournamentModel.findOne(database, {
      _id: new ObjectId(id),
      coordinator: { $in: ownerIdentifiers }
    });
    if (tournament) {
      throw createError('Tournament events cannot be deleted from calendar. Use Tournament Management.', 400);
    }

    throw createError('Event not found or access denied', 404);
  },

  async checkDateConflict(db, user, { payload }) {
    requireCoordinator(user);
    const { date, excludeTournamentId } = payload || {};
    if (!date) throw createError('Date is required', 400);

    const targetDate = parseDateValue(date);
    if (!targetDate) throw createError('Invalid date format', 400);

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const database = await resolveDb(db);
    const ownerIdentifiers = await getCoordinatorOwnerIdentifiers(database, user);

    const query = {
      coordinator: { $in: ownerIdentifiers },
      date: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: ['Removed', 'Rejected', 'Completed'] }
    };

    if (excludeTournamentId && ObjectId.isValid(excludeTournamentId)) {
      query._id = { $ne: new ObjectId(excludeTournamentId) };
    }

    const conflictingTournament = await TournamentModel.findOne(database, query);

    let conflict = false;
    let conflictDetails = null;
    if (conflictingTournament) {
      conflict = true;
      conflictDetails = {
        type: 'tournament',
        name: conflictingTournament.name,
        time: conflictingTournament.time
      };
    }

    return { conflict, conflictDetails };
  }
};

module.exports = CalendarService;
