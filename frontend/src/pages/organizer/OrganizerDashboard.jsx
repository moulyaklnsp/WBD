import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { organizerLinks } from '../../constants/organizerLinks';

const PAGE_SIZE = 5;

function OrganizerDashboard() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [organizerName, setOrganizerName] = useState('Organizer');
  const [meetings, setMeetings] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [visibleMeetings, setVisibleMeetings] = useState(PAGE_SIZE);
  const [visibleApprovals, setVisibleApprovals] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Widgets Data
  const [revenueData, setRevenueData] = useState(null);
  const [topCoordinators, setTopCoordinators] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Basic Dashboard Data
      const res = await fetchAsOrganizer('/organizer/api/dashboard');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
      setOrganizerName(data.organizerName || 'Organizer');
      setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
      setPendingApprovals(Array.isArray(data.pendingApprovals) ? data.pendingApprovals : []);

      // 2. Revenue Insights (for Widget)
      const resRev = await fetchAsOrganizer('/organizer/api/sales/insights');
      const dataRev = await resRev.json();
      if (resRev.ok) setRevenueData(dataRev);

      // 3. Top Coordinators
      const resCoord = await fetchAsOrganizer('/organizer/api/coordinator-performance');
      const dataCoord = await resCoord.json();
      if (resCoord.ok && dataCoord.coordinators) {
        // Sort by revenue impact and take top 5
        const sorted = [...dataCoord.coordinators].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);
        setTopCoordinators(sorted);
      }

    } catch (e) {
      console.error('Dashboard load error:', e);
      setError('Error loading dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const showMeetings = useMemo(() => meetings.slice(0, visibleMeetings), [meetings, visibleMeetings]);
  const showApprovals = useMemo(() => pendingApprovals.slice(0, visibleApprovals), [pendingApprovals, visibleApprovals]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-3px); }
        .updates-section h3 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; display:flex; align-items:center; gap:0.8rem; font-size:1.5rem; }
        .updates-section ul { list-style:none; }
        .updates-section li { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); transition:all 0.3s ease; display:flex; align-items:center; gap:1rem; }
        .updates-section li:last-child { border-bottom:none; }
        .updates-section li:hover { background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); transform: translateX(5px); border-radius:8px; }
        .meeting-info { flex-grow:1; }
        .join-link { background: linear-gradient(90deg, rgba(235,87,87,1), rgba(6,56,80,1)); color: var(--on-accent); padding:0.5rem 1rem; border-radius:20px; font-size:0.9rem; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:0.5rem; }
        .date-tag { color:var(--sea-green); font-style: italic; }
        .more-btn{ padding:0.6rem 1rem; border:none; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.3s ease; display:flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); }
        .widgets-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:2rem; margin-top:2rem; }
        .widget-card { background:var(--card-bg); border-radius:15px; padding:1.5rem; border:1px solid var(--card-border); }
        .stat-val { font-size:2rem; font-weight:bold; color:var(--sea-green); }
        .stat-trend { font-size:0.9rem; margin-left:0.5rem; }
        .stat-trend.up { color:#4caf50; }
        .stat-trend.down { color:#f44336; }
        .coord-item { display:flex; justify-content:space-between; align-items:center; padding:0.8rem 0; border-bottom:1px solid var(--card-border); }
        .coord-item:last-child { border-bottom:none; }
        .approval-status { display:inline-flex; align-items:center; gap:0.4rem; font-family:'Cinzel', serif; font-size:0.85rem; background:rgba(255,193,7,0.15); color:#ffc107; padding:0.35rem 0.7rem; border-radius:999px; }
      `}</style>

      <div className="page player-neo">
        <motion.div className="chess-knight-float" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 0.14, scale: 1 }} transition={{ delay: 0.9, duration: 0.6 }} style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}>
          <i className="fas fa-chess-king" />
        </motion.div>

        <AnimatedSidebar links={organizerLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="organizer-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button type="button" onClick={toggleTheme} className="more-btn" style={{ width: 40, height: 40, padding: 0, justifyContent: 'center' }}>
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
          <div style={{ color: 'var(--sea-green)', fontWeight: '600' }}>Welcome, {organizerName}</div>
        </div>

        <div className="content">
          <motion.div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <i className="fas fa-chess-king chess-king-glow chess-piece-breathe" />
              Welcome to ChessHive, {organizerName}!
            </h1>
          </motion.div>

          {/* Widgets Row */}
          <div className="widgets-grid">
            {/* Revenue Widget */}
            <motion.div className="widget-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>Revenue Insights</h3>
              {revenueData ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span className="stat-val">₹{revenueData.demandTrend && revenueData.demandTrend.length > 0 ? revenueData.demandTrend[revenueData.demandTrend.length - 1].revenue : 0}</span>
                    <span className={`stat-trend ${revenueData.growthPercentage >= 0 ? 'up' : 'down'}`}>
                      <i className={`fas fa-arrow-${revenueData.growthPercentage >= 0 ? 'up' : 'down'}`} /> {Math.abs(revenueData.growthPercentage)}%
                    </span>
                  </div>
                  <p style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: '0.5rem' }}>Current Month Revenue</p>
                  <div style={{ marginTop: '1rem' }}>
                    {revenueData.insights && revenueData.insights.slice(0, 2).map((insight, i) => (
                      <div key={i} style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                        <i className="fas fa-info-circle" style={{ color: 'var(--sea-green)' }} /> {insight}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p>Loading...</p>
              )}
            </motion.div>

            {/* Top Coordinators Widget */}
            <motion.div className="widget-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>Top Performers</h3>
              {topCoordinators.length > 0 ? (
                <div>
                  {topCoordinators.map((c, i) => (
                    <div key={i} className="coord-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--sea-green)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{i + 1}</div>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>{c.college || 'N/A'}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--sea-green)', fontWeight: 'bold' }}>₹{c.totalRevenue}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Revenue</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No data available.</p>
              )}
            </motion.div>
          </div>

          {/* Upcoming Meetings */}
          <motion.div
            className="updates-section"
            style={{ marginTop: '2rem' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3><i className="fas fa-calendar" /> Upcoming Meetings (Next 5 Days)</h3>
            <ul style={{ padding: 0 }}>
              {loading ? (
                <li>Loading meetings...</li>
              ) : error ? (
                <li style={{ color: 'crimson' }}>{error}</li>
              ) : meetings.length === 0 ? (
                <li>No upcoming meetings.</li>
              ) : (
                showMeetings.map((m, idx) => (
                  <li key={idx}>
                    <i className="fas fa-video" style={{ fontSize: '1.2rem', color: 'var(--sea-green)' }} />
                    <div className="meeting-info">
                      <strong>{m.title}</strong>
                      <div className="date-tag">{new Date(m.date).toLocaleDateString()} at {m.time}</div>
                    </div>
                    <a href={m.link} target="_blank" rel="noreferrer" className="join-link">Join</a>
                  </li>
                ))
              )}
            </ul>
            {meetings.length > PAGE_SIZE && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button className="more-btn" onClick={() => setVisibleMeetings(v => v >= meetings.length ? PAGE_SIZE : v + PAGE_SIZE)}>
                  {visibleMeetings >= meetings.length ? 'Show Less' : 'Show More'}
                </button>
              </div>
            )}
          </motion.div>

          {/* Pending Tournament Approvals */}
          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3><i className="fas fa-clipboard-check" /> Tournament Approvals (Next 5 Days)</h3>
            <ul style={{ padding: 0 }}>
              {loading ? (
                <li>Loading approvals...</li>
              ) : error ? (
                <li style={{ color: 'crimson' }}>{error}</li>
              ) : pendingApprovals.length === 0 ? (
                  <li>No tournament approvals due within the next 5 days.</li>
              ) : (
                showApprovals.map((t, idx) => (
                  <li key={t._id || idx}>
                    <i className="fas fa-trophy" style={{ fontSize: '1.2rem', color: 'var(--sea-green)' }} />
                    <div className="meeting-info">
                      <strong>{t.name || 'Tournament'}</strong>
                      <div className="date-tag">
                        {t.date ? new Date(t.date).toLocaleDateString() : 'Date unavailable'}
                        {t.coordinator ? ` • Coordinator: ${t.coordinator}` : ''}
                      </div>
                    </div>
                    <span className="approval-status"><i className="fas fa-hourglass-half" /> Pending</span>
                  </li>
                ))
              )}
            </ul>
            {pendingApprovals.length > PAGE_SIZE && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button className="more-btn" onClick={() => setVisibleApprovals(v => v >= pendingApprovals.length ? PAGE_SIZE : v + PAGE_SIZE)}>
                  {visibleApprovals >= pendingApprovals.length ? 'Show Less' : 'Show More'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default OrganizerDashboard;
