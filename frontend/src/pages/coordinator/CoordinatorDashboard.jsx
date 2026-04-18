
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import '../../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalLoader } from '../../components/ChessTransformation';

import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';

const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  })
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.12 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }
};

function CoordinatorDashboard() {
  const [isDark, toggleTheme] = usePlayerTheme();

  const [name, setName] = useState('Coordinator');
  const [meetings, setMeetings] = useState([]);
  const [upcomingTournaments, setUpcomingTournaments] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleMeetings, setVisibleMeetings] = useState(5);
  const notifRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetchAsCoordinator('/coordinator/api/dashboard');
        const data = await res.json();
        setName(data.coordinatorName || 'Coordinator');
        setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
        setUpcomingTournaments(Array.isArray(data.upcomingTournaments) ? data.upcomingTournaments : []);
        setStockAlerts(Array.isArray(data.stockAlerts) ? data.stockAlerts : []);
        setUnreadCount(data.unreadNotificationCount || 0);
      } catch (e) {
        console.error(e);
        setError('Error loading dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetchAsCoordinator('/coordinator/api/notifications');
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  }, []);

  const toggleNotifDropdown = useCallback(() => {
    setShowNotifDropdown(prev => {
      if (!prev) loadNotifications();
      return !prev;
    });
  }, [loadNotifications]);

  const markAllRead = useCallback(async () => {
    try {
      await fetchAsCoordinator('/coordinator/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error('Error marking notifications:', e);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const shownMeetings = useMemo(() => meetings.slice(0, visibleMeetings), [meetings, visibleMeetings]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display: flex; color: var(--text-color); }
        .content { flex-grow: 1; margin-left: 0; padding: 2rem; }
        h1 { font-family: 'Cinzel', serif; color: var(--sea-green); margin-bottom: 2rem; font-size: 2.5rem; display: flex; align-items: center; gap: 1rem; }
        .updates-section { background: var(--card-bg); border-radius: 15px; padding: 2rem; margin-bottom: 2rem; box-shadow: none; border: 1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .updates-section h3 { font-family: 'Cinzel', serif; color: var(--sea-green); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.8rem; font-size: 1.5rem; }
        .updates-section ul { list-style: none; }
        .updates-section li { padding: 1rem; border-bottom: 1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); transition: all 0.3s ease; display: flex; align-items: center; gap: 1rem; }
        .updates-section li:last-child { border-bottom: none; }
        .updates-section li:hover { background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); transform: translateX(5px); border-radius: 8px; }
        .meeting-info { flex-grow: 1; }
        .join-link { background: linear-gradient(90deg, rgba(235, 87, 87, 1), rgba(6, 56, 80, 1)); color: var(--on-accent); padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem; }
        .date-tag { color: var(--sea-green); font-style: italic; }
        .more-btn { padding: 0.6rem 1rem; border: none; border-radius: 8px; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold; transition: all 0.3s ease; display: flex; align-items: center; gap: 0.5rem; background-color: var(--sea-green); color: var(--on-accent); }
        .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2rem; margin-bottom: 2rem; }
        .stock-alert-item { padding: 0.8rem 1rem; border-radius: 8px; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; }
        .stock-low { background: rgba(220, 53, 69, 0.15); border: 1px solid rgba(220, 53, 69, 0.3); color: #dc3545; }
        .notif-badge { position: absolute; top: -6px; right: -6px; background: #dc3545; color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold; }
        .notif-dropdown { position: absolute; top: 50px; right: 0; width: 350px; max-height: 400px; overflow-y: auto; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2); z-index: 1002; padding: 0.5rem; }
        .notif-item { padding: 0.8rem; border-bottom: 1px solid var(--card-border); cursor: pointer; border-radius: 6px; transition: background 0.2s; }
        .notif-item:hover { background: rgba(var(--sea-green-rgb), 0.1); }
        .notif-item.unread { background: rgba(var(--sea-green-rgb), 0.05); font-weight: 600; }
        .tournament-card { padding: 1rem; border-radius: 10px; background: rgba(var(--sea-green-rgb), 0.08); border: 1px solid rgba(var(--sea-green-rgb), 0.2); margin-bottom: 0.8rem; }
        .status-badge { padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: bold; display: inline-block; }
        .status-pending { background: rgba(255, 193, 7, 0.2); color: #ffc107; }
        .status-approved { background: rgba(46, 139, 87, 0.2); color: #2E8B57; }
        .status-ongoing { background: rgba(0, 123, 255, 0.2); color: #007bff; }
        @media(max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr; }
          h1 { font-size: 1.8rem; flex-direction: column; text-align: center; }
          .notif-dropdown { width: 280px; right: -50px; }
        }
      `}</style>

      <div className="page player-neo">
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-chess-rook" />
        </motion.div>

        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        {/* Header: theme toggle + notifications + welcome */}
        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Notification Bell */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <motion.button
              type="button"
              onClick={toggleNotifDropdown}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-color)',
                width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '1.1rem', position: 'relative'
              }}
            >
              <i className="fas fa-bell" />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </motion.button>

            <AnimatePresence>
              {showNotifDropdown && (
                <motion.div
                  className="notif-dropdown"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid var(--card-border)' }}>
                    <strong style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}>Notifications</strong>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--sea-green)', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', opacity: 0.7 }}>No notifications</div>
                  ) : (
                    notifications.slice(0, 10).map((n, i) => (
                      <div key={n._id || i} className={`notif-item ${!n.read ? 'unread' : ''}`}>
                        <div style={{ fontSize: '0.85rem' }}>
                          <i className="fas fa-bell" style={{ marginRight: 6, color: 'var(--sea-green)' }} />
                          {n.type === 'feedback_request' ? `Feedback requested for ${n.tournament_name}` : n.type}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: 4 }}>
                          {new Date(n.date).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-color)',
              width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
          <div style={{ color: 'var(--sea-green)', fontWeight: '600' }}>Welcome, {name}</div>
        </div>

        {/* Content */}
        <div className="content chess-dash-checkerboard">
          {error && (
            <div style={{ background: '#ffdddd', color: '#cc0000', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
              <i className="fas fa-chess-queen chess-king-glow chess-piece-breathe" />
            </motion.span>
            Welcome to ChessHive, {name}!
          </motion.h1>

          <div className="dashboard-grid">
            {/* A. Upcoming Meetings */}
            <motion.div className="updates-section" custom={0} variants={sectionVariants} initial="hidden" animate="visible">
              <h3><i className="fas fa-calendar chess-piece-breathe" /> Upcoming Meetings</h3>
              <motion.ul variants={listVariants} initial="hidden" animate="visible">
                {loading ? (
                  <motion.li variants={itemVariants}><GlobalLoader style={{padding: '0.5rem'}} /></motion.li>
                ) : meetings.length === 0 ? (
                  <motion.li variants={itemVariants}><i className="fas fa-info-circle" /> No upcoming meetings.</motion.li>
                ) : (
                  shownMeetings.map((m, idx) => (
                    <motion.li key={`${m.title}-${idx}`} custom={idx} variants={itemVariants}>
                      <i className="fas fa-video" style={{ color: 'var(--sea-green)' }} />
                      <div className="meeting-info">
                        <strong>{m.title}</strong>
                        <div className="date-tag">
                          <i className="fas fa-calendar-alt" /> {new Date(m.date).toLocaleDateString()} at {m.time}
                        </div>
                      </div>
                      <a href={m.link} target="_blank" rel="noreferrer" className="join-link">
                        <i className="fas fa-video" /> Join
                      </a>
                    </motion.li>
                  ))
                )}
              </motion.ul>
              {meetings.length > 5 && (
                <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                  {visibleMeetings < meetings.length && (
                    <button className="more-btn" onClick={() => setVisibleMeetings(c => Math.min(c + 5, meetings.length))}>
                      <i className="fas fa-chevron-down" /> More
                    </button>
                  )}
                  {visibleMeetings > 5 && (
                    <button className="more-btn" onClick={() => setVisibleMeetings(5)}>
                      <i className="fas fa-chevron-up" /> Hide
                    </button>
                  )}
                </div>
              )}
            </motion.div>

            {/* B. Upcoming Tournaments */}
            <motion.div className="updates-section" custom={1} variants={sectionVariants} initial="hidden" animate="visible">
              <h3><i className="fas fa-trophy chess-piece-breathe" /> Upcoming Tournaments</h3>
              {loading ? (
                <GlobalLoader style={{padding: '1rem'}} />
              ) : upcomingTournaments.length === 0 ? (
                <div style={{ opacity: 0.7 }}><i className="fas fa-info-circle" /> No upcoming tournaments in the next 3 days.</div>
              ) : (
                upcomingTournaments.map((t, i) => (
                  <motion.div key={t._id || i} className="tournament-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--sea-green)' }}>{t.name}</strong>
                      <span className={`status-badge status-${(t.status || '').toLowerCase()}`}>{t.status}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: '0.9rem', opacity: 0.8 }}>
                      <i className="fas fa-calendar-alt" /> {new Date(t.date).toLocaleDateString()} at {t.time}
                      <span style={{ marginLeft: 12 }}><i className="fas fa-map-marker-alt" /> {t.location}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>

            {/* C. Stock Alerts */}
            <motion.div className="updates-section" custom={2} variants={sectionVariants} initial="hidden" animate="visible">
              <h3><i className="fas fa-exclamation-triangle" style={{ color: '#dc3545' }} /> Stock Alerts</h3>
              {loading ? (
                <GlobalLoader style={{ padding: '1rem' }} />
              ) : stockAlerts.length === 0 ? (
                <div style={{ opacity: 0.7 }}><i className="fas fa-check-circle" style={{ color: 'var(--sea-green)' }} /> All products have sufficient stock.</div>
              ) : (
                stockAlerts.map((p, i) => (
                  <motion.div key={p._id || i} className="stock-alert-item stock-low" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.08 }}>
                    <span><i className="fas fa-box" /> {p.name}</span>
                    <span style={{ fontWeight: 'bold' }}>{p.availability} left</span>
                  </motion.div>
                ))
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorDashboard;


