/**
 * SchedulerService – background jobs for tournament status updates.
 * Called once from app.js after DB is ready.
 */
const { getModel } = require('../models');
const TournamentModel = getModel('tournaments');
const { connectDB } = require('../config/database');

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
        const list = await TournamentModel.findAll(db, { status: { $in: ['Approved', 'Ongoing'] } });

        const toOngoing = [];
        const toCompleted = [];

        for (const t of list) {
          if (!t || !t.date) continue;
          const dateOnly = new Date(t.date);
          const timeStr = (t.time || '00:00').toString();
          const [hh, mm] = timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00'];
          const start = new Date(dateOnly);
          start.setHours(parseInt(hh, 10) || 0, parseInt(mm, 10) || 0, 0, 0);
          const end = new Date(start.getTime() + 60 * 60 * 1000);

          if (now >= end) {
            if (t.status !== 'Completed') toCompleted.push(t._id);
          } else if (now >= start && now < end) {
            if (t.status !== 'Ongoing') toOngoing.push(t._id);
          }
        }

        if (toOngoing.length) {
          await TournamentModel.updateStatus(db, toOngoing, 'Ongoing');
        }
        if (toCompleted.length) {
          await TournamentModel.updateStatus(db, toCompleted, 'Completed', { completed_at: new Date() });
        }
      } catch (e) {
        console.error('Tournament status scheduler error:', e);
      }
    }

    tick();
    setInterval(tick, 60 * 1000);
  }
};

module.exports = SchedulerService;
