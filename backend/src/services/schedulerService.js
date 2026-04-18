/**
 * SchedulerService – background jobs for tournament status updates.
 * Called once from app.js after DB is ready.
 */
const { connectDB } = require('../config/database');

function computeTournamentWindow(doc) {
  if (!doc?.date) return null;
  const dateOnly = new Date(doc.date);
  if (Number.isNaN(dateOnly.getTime())) return null;

  const timeStr = (doc.time || '00:00').toString();
  const [hh, mm] = timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00'];

  const start = new Date(dateOnly);
  start.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start_at: start, end_at: end };
}

const SchedulerService = {
  /**
   * Start the tournament status update loop.
   * Runs immediately then every 60 seconds.
   * Updates: Approved → Ongoing → Completed based on date/time.
   */
  startTournamentScheduler() {
    async function tick() {
      try {
        const db = await connectDB();
        const now = new Date();

        // Backfill derived window fields for tournaments that predate this optimization.
        const missing = await db.collection('tournaments').find({
          status: { $in: ['Approved', 'Ongoing'] },
          date: { $type: 'date' },
          $or: [{ start_at: { $exists: false } }, { end_at: { $exists: false } }]
        }).project({ _id: 1, date: 1, time: 1 }).limit(500).toArray();

        if (missing.length) {
          const ops = [];
          for (const doc of missing) {
            const window = computeTournamentWindow(doc);
            if (!window) continue;
            ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: window } } });
          }
          if (ops.length) {
            await db.collection('tournaments').bulkWrite(ops, { ordered: false });
          }
        }

        // Approved -> Ongoing (currently live)
        await db.collection('tournaments').updateMany(
          { status: 'Approved', start_at: { $lte: now }, end_at: { $gt: now } },
          { $set: { status: 'Ongoing', updated_at: now } }
        );

        // Approved/Ongoing -> Completed (already ended)
        await db.collection('tournaments').updateMany(
          { status: { $in: ['Approved', 'Ongoing'] }, end_at: { $lte: now } },
          { $set: { status: 'Completed', completed_at: now, updated_at: now } }
        );
      } catch (e) {
        console.error('Tournament status scheduler error:', e);
      }
    }

    tick();
    setInterval(tick, 60 * 1000);
  }
};

module.exports = SchedulerService;
