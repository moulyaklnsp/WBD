const { connectDB } = require('../../config/database');
const { requireOrganizer } = require('./organizerUtils');
const { getModel } = require('../../models');
const MeetingsModel = getModel('meetingsdb');
const { normalizeKey } = require('../../utils/mongo');

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const resolveDb = async (db) => (db ? db : connectDB());

const MeetingsService = {
  async scheduleMeeting(db, user, { title, date, time, link, role = 'organizer' }) {
    requireOrganizer(user);
    const meetingName = user?.username || user?.email || '';
    const database = await resolveDb(db);

    const meeting = {
      title: title.toString(),
      date: new Date(date),
      time: time.toString(),
      link: link.toString(),
      role: role.toString(),
      name: meetingName.toString(),
      name_key: normalizeKey(meetingName),
      created_by: user?.email || meetingName.toString(),
      created_by_key: normalizeKey(user?.email || meetingName)
    };

    const result = await MeetingsModel.insertOne(database, meeting);
    if (result.insertedId) {
      return { success: true, message: 'Meeting scheduled successfully' };
    }

    throw createError('Failed to schedule meeting', 500);
  },

  async getOrganizedMeetings(db, user) {
    requireOrganizer(user);
    const meetingName = user?.username || user?.email;
    const database = await resolveDb(db);
    return MeetingsModel.findMany(
      database,
      { role: 'organizer', name: meetingName },
      { sort: { date: 1, time: 1 } }
    );
  },

  async getUpcomingMeetings(db, user) {
    requireOrganizer(user);
    const meetingName = user?.username || user?.email;
    const database = await resolveDb(db);
    const today = new Date();

    return MeetingsModel.findMany(
      database,
      { date: { $gte: today }, name: { $ne: meetingName } },
      { sort: { date: 1, time: 1 } }
    );
  }
};

module.exports = MeetingsService;
