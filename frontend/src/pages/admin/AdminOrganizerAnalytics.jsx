import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';

const AdminOrganizerAnalytics = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totals, setTotals] = useState({
    organizers: 0,
    approvedCount: 0,
    rejectedCount: 0,
    meetingsScheduled: 0
  });
  const [organizers, setOrganizers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 5;
  const totalPages = Math.ceil(organizers.length / itemsPerPage);
  const shownOrganizers = organizers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsAdmin('/admin/api/analytics/organizers');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setTotals(data?.totals || { organizers: 0, approvedCount: 0, rejectedCount: 0, meetingsScheduled: 0 });
      setOrganizers(Array.isArray(data?.organizers) ? data.organizers : []);
    } catch (err) {
      setError(err.message || 'Failed to load organizer analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const adminLinks = [
    { path: '/admin/organizer_management', label: 'Manage Organizers', icon: 'fas fa-users-cog' },
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },

  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h2 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.25rem; font-size:2.2rem; display:flex; align-items:center; gap:1rem; justify-content:center; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:1.5rem; border:1px solid var(--card-border); overflow-x:auto; }
        .table { width:100%; border-collapse:collapse; margin-bottom:0; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1rem; text-align:left; font-family:'Cinzel', serif; font-size:1rem; }
        .td { padding:0.85rem 1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .stats { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:1rem; margin-bottom:1.2rem; }
        .stat-card { background:var(--card-bg); border:1px solid var(--card-border); border-radius:10px; padding:1rem; text-align:center; }
        .stat-value { font-size:1.4rem; font-weight:bold; color:var(--sea-green); margin-bottom:0.35rem; }
        .stat-label { opacity:0.8; font-size:0.9rem; }
        .banner { padding:1rem; border-radius:8px; margin-bottom:1rem; text-align:center; font-weight:bold; }
        .banner.error { background:rgba(220,53,69,0.1); color:#dc3545; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
        .empty { text-align:center; padding:1.5rem; color:var(--sea-green); font-style:italic; }
        .pagination { display:flex; justify-content:center; align-items:center; gap:1rem; margin-top:1rem; }
        .page-btn { background-color:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.3s ease; }
        .page-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .page-info { font-family:'Cinzel', serif; font-weight:bold; color:var(--sea-green); }
      `}</style>

      <div className="page player-neo">
        <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div className="admin-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-color)',
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="fas fa-chart-line" /> Organizer Analytics
          </motion.h2>

          {error && <div className="banner error">{error}</div>}

          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="stats">
              <div className="stat-card"><div className="stat-value">{totals.organizers}</div><div className="stat-label">Active Organizers</div></div>
              <div className="stat-card"><div className="stat-value">{totals.approvedCount}</div><div className="stat-label">Tournament Approvals</div></div>
              <div className="stat-card"><div className="stat-value">{totals.rejectedCount}</div><div className="stat-label">Tournament Rejections</div></div>
              <div className="stat-card"><div className="stat-value">{totals.meetingsScheduled}</div><div className="stat-label">Meetings Scheduled</div></div>
            </div>
          </motion.div>

          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Rank</th>
                  <th className="th">Organizer</th>
                  <th className="th">Email</th>
                  <th className="th">College</th>
                  <th className="th">Approvals</th>
                  <th className="th">Rejections</th>
                  <th className="th">Decisions</th>
                  <th className="th">Meetings</th>
                  <th className="th">Growth %</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="empty">Loading organizer analytics...</td></tr>
                ) : organizers.length === 0 ? (
                  <tr><td colSpan={9} className="empty">No organizers found.</td></tr>
                ) : (
                  shownOrganizers.map((row, idx) => (
                    <tr key={`${row.email || row.name}-${idx}`}>
                      <td className="td">{row.rank}</td>
                      <td className="td">{row.name}</td>
                      <td className="td">{row.email}</td>
                      <td className="td">{row.college || 'N/A'}</td>
                      <td className="td">{row.approvedCount}</td>
                      <td className="td">{row.rejectedCount}</td>
                      <td className="td">{row.decisions}</td>
                      <td className="td">{row.meetingsScheduled}</td>
                      <td className="td">{row.growthPercentage}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  className="page-btn" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                >
                  <i className="fas fa-chevron-left" /> Prev
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  className="page-btn" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                >
                  Next <i className="fas fa-chevron-right" />
                </button>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="back-link" onClick={fetchAnalytics}>
                <i className="fas fa-sync-alt" /> Refresh
              </button>
              <Link to="/admin/admin_dashboard" className="back-link">
                <i className="fas fa-arrow-left" /> Back to Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrganizerAnalytics;
