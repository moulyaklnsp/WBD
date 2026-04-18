import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAsOrganizer } from '../../utils/fetchWithRole';
import { GlobalLoader } from '../../components/ChessTransformation';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { organizerLinks } from '../../constants/organizerLinks';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

const PAGE_SIZE = 5;

const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.12,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  })
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

function CoordinatorManagement() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [coordinators, setCoordinators] = useState([]);
  const [pendingCoordinators, setPendingCoordinators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | removed
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [statsMap, setStatsMap] = useState({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const fetchCoordinators = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // Fetch active coordinators
      const res = await fetchAsOrganizer('/organizer/api/coordinators');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch coordinators');
      
      // Fetch pending coordinators
      const resPending = await fetchAsOrganizer('/organizer/api/coordinators/pending');
      const dataPending = await resPending.json();
      
      setCoordinators(Array.isArray(data) ? data : []);
      setPendingCoordinators(Array.isArray(dataPending) ? dataPending : []);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error('Fetch coordinators error:', e);
      setError('Failed to load coordinators.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCoordinatorApproval = async (email, approved) => {
    try {
      const res = await fetchAsOrganizer('/organizer/api/coordinators/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, approved })
      });
      if (res.ok) {
        setPendingCoordinators(prev => prev.filter(c => c.email !== email));
        if (approved) {
          fetchCoordinators(); // Refresh the list if approved
        }
      }
    } catch(err) {
      console.error(err);
    }
  };

  const fetchCoordinatorStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      setStatsError('');
      const res = await fetchAsOrganizer('/organizer/api/coordinator-performance');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch coordinator stats');
      const list = Array.isArray(data) ? data : (Array.isArray(data?.coordinators) ? data.coordinators : []);
      const map = {};
      list.forEach((c) => {
        const emailKey = normalizeKey(c?.email);
        const nameKey = normalizeKey(c?.name);
        if (emailKey) map[emailKey] = c;
        if (nameKey) map[nameKey] = c;
      });
      setStatsMap(map);
    } catch (e) {
      console.error('Fetch coordinator stats error:', e);
      setStatsError('Failed to load coordinator stats.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoordinators();
    fetchCoordinatorStats();
  }, [fetchCoordinators, fetchCoordinatorStats]);

  const openCoordinatorDetail = useCallback((coord) => {
    setSelectedCoordinator(coord);
  }, []);

  const closeCoordinatorDetail = useCallback(() => {
    setSelectedCoordinator(null);
  }, []);

  useEffect(() => {
    if (!selectedCoordinator) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape') closeCoordinatorDetail();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [selectedCoordinator, closeCoordinatorDetail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return coordinators.filter((c) => {
      const matchesText = !q || [c.name, c.email, c.college, c.team].some((v) => (v || '').toLowerCase().includes(q));
      const isDeleted = !!c.isDeleted;
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' && !isDeleted) || (statusFilter === 'removed' && isDeleted);
      return matchesText && matchesStatus;
    });
  }, [coordinators, query, statusFilter]);
  const isSelfDeleted = (user) => {
    const email = String(user?.email || '').trim().toLowerCase();
    const deletedBy = String(user?.deleted_by || '').trim().toLowerCase();
    return Boolean(email && deletedBy && email === deletedBy);
  };

  const onRemove = async (email) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;
    try {
      const res = await fetchAsOrganizer(`/organizer/api/coordinators/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove coordinator');
      // update locally
      setCoordinators((prev) => prev.map((c) => (c.email === email ? { ...c, isDeleted: true } : c)));
      alert('Coordinator removed successfully.');
    } catch (e) {
      console.error('Remove error:', e);
      alert('Failed to remove coordinator.');
    }
  };

  const onRestore = async (email) => {
    if (!window.confirm(`Are you sure you want to restore ${email}?`)) return;
    try {
      const res = await fetchAsOrganizer(`/organizer/api/coordinators/restore/${encodeURIComponent(email)}`, {
        method: 'PATCH'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || 'Failed to restore coordinator');
      setCoordinators((prev) => prev.map((c) => (c.email === email ? { ...c, isDeleted: false } : c)));
      alert(data?.message || 'Coordinator restored successfully.');
    } catch (e) {
      console.error('Restore error:', e);
      alert(e.message || 'Failed to restore coordinator.');
    }
  };

  const visibleRows = filtered.slice(0, visible);
  const selectedStats = useMemo(() => {
    if (!selectedCoordinator) return null;
    const emailKey = normalizeKey(selectedCoordinator.email);
    const nameKey = normalizeKey(selectedCoordinator.name);
    return statsMap[emailKey] || statsMap[nameKey] || null;
  }, [selectedCoordinator, statsMap]);
  const formatCurrency = (n) => `INR ${(Number(n ?? 0)).toFixed(2)}`;
  const revenueChartData = useMemo(() => {
    if (!selectedStats) return null;
    return {
      labels: ['Store Revenue', 'Tournament Revenue'],
      datasets: [
        {
          label: 'Revenue (INR)',
          data: [Number(selectedStats.storeRevenue || 0), Number(selectedStats.tournamentRevenue || 0)],
          backgroundColor: ['rgba(46, 139, 87, 0.75)', 'rgba(29, 126, 168, 0.75)'],
          borderColor: ['#2E8B57', '#1d7ea8'],
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    };
  }, [selectedStats]);
  const revenueChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'Revenue Breakdown',
        color: '#2E8B57',
        font: { family: 'Cinzel, serif', size: 14, weight: 'bold' }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `INR ${(ctx.raw ?? 0).toFixed(2)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: '#2E8B57' },
        grid: { color: 'rgba(46,139,87,0.12)' }
      },
      x: {
        ticks: { color: '#2E8B57' },
        grid: { color: 'rgba(46,139,87,0.12)' }
      }
    }
  }), []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .table { width:100%; border-collapse:collapse; margin-bottom:1rem; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1.2rem; text-align:left; font-family:'Cinzel', serif; font-size:1.1rem; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .search-row { display:flex; align-items:center; gap:10px; padding:10px; background:var(--card-bg); border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); max-width:500px; margin:0 auto 20px; border:1px solid var(--card-border); }
        .input { flex:1; padding:10px 14px; border-radius:8px; border:1px solid var(--card-border); font-size:16px; background:var(--page-bg); color:var(--text-color); min-width:300px; }
        .select { padding:8px 12px; border-radius:8px; border:1px solid var(--card-border); font-size:14px; background:var(--page-bg); color:var(--text-color); }
        .more-btn { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; cursor:pointer; border:none; }
        .row-counter { text-align:center; margin-bottom:1rem; font-family:'Cinzel', serif; font-size:1.2rem; color:var(--sea-green); background-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); padding:0.5rem 1rem; border-radius:8px; display:inline-block; }
        .empty { text-align:center; padding:2rem; color:var(--sea-green); font-style:italic; }
        .remove-btn { background-color:#ff6b6b; color:#fff; border:none; padding:0.6rem 1rem; border-radius:5px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        .restore-btn { background-color:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:5px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        .locked-tag { color:#c62828; font-weight:bold; font-family:'Cinzel', serif; display:inline-flex; align-items:center; gap:0.4rem; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; }
        .name-link { background:none; border:none; color:var(--sea-green); cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; padding:0; text-align:left; }
        .name-link:hover { text-decoration:underline; }
        .stats-panel { margin-top:1.5rem; padding:1.5rem; border-radius:12px; border:1px solid var(--card-border); background:var(--card-bg); }
        .stats-header { display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
        .stats-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.2rem; margin:0; }
        .stats-subtitle { opacity:0.7; font-size:0.9rem; margin-top:0.2rem; }
        .stats-close { background:transparent; border:1px solid var(--card-border); color:var(--text-color); width:32px; height:32px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; }
        .stats-item { padding:0.9rem 1rem; border-radius:10px; border:1px solid var(--card-border); background:rgba(var(--sea-green-rgb, 27, 94, 63), 0.06); }
        .stats-label { font-family:'Cinzel', serif; font-size:0.85rem; color:var(--sea-green); margin-bottom:0.4rem; display:block; }
        .stats-value { font-weight:bold; color:var(--text-color); }
        .stats-highlight { color:var(--sea-green); font-weight:700; }
        .chart-card { border:1px solid var(--card-border); border-radius:12px; padding:1rem; background:var(--card-bg); height:280px; margin-top:1.2rem; }
        .coord-detail-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.78);
          z-index: 3000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.2rem;
        }
        .coord-detail-panel {
          width: min(900px, 96vw);
          max-height: 90vh;
          overflow-y: auto;
          background: var(--card-bg);
          color: var(--text-color);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 1.25rem;
          position: relative;
          box-shadow: 0 18px 50px rgba(0,0,0,0.32);
        }
        .detail-close-btn {
          position: sticky;
          top: 0.2rem;
          margin-left: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-color);
          cursor: pointer;
          z-index: 2;
        }
        .detail-close-btn:hover { border-color: var(--sea-green); color: var(--sea-green); }
      `}</style>

      <div className="page player-neo">
        <AnimatedSidebar links={organizerLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button onClick={toggleTheme} className="more-btn" style={{ width: 40, height: 40, padding: 0, justifyContent: 'center' }}>
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          {pendingCoordinators.length > 0 && (
            <div style={{ marginBottom: '3rem' }}>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <i className="fas fa-user-clock" /> Pending Approvals
              </motion.h1>
              <motion.div
                className="updates-section"
                custom={0}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th">Name</th>
                      <th className="th">Email</th>
                      <th className="th">Requested At</th>
                      <th className="th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingCoordinators.map((c, idx) => (
                      <tr key={c.email || idx}>
                        <td className="td">{c.data?.name || c.name || 'Unnamed'}</td>
                        <td className="td">{c.email}</td>
                        <td className="td">{new Date(c.created_at || c.createdAt).toLocaleDateString()}</td>
                        <td className="td">
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="more-btn"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                              onClick={() => handleCoordinatorApproval(c.email, true)}
                            >
                              <i className="fas fa-check" /> Approve
                            </button>
                            <button
                              className="remove-btn"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                              onClick={() => handleCoordinatorApproval(c.email, false)}
                            >
                              <i className="fas fa-times" /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            </div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <i className="fas fa-users-cog" /> Coordinator Management
          </motion.h1>

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <div className="row-counter">
                {Math.min(visibleRows.length, filtered.length)} / {filtered.length}
              </div>
            </div>
            <div className="search-row">
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="removed">Removed</option>
              </select>
              <input className="input" placeholder="Search name, email or college…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>

            {loading && <GlobalLoader />}
            {!loading && !!error && <div className="empty">{error}</div>}

            {!loading && !error && (
              <table className="table">
                <thead>
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Email</th>
                    <th className="th">Assigned Team/College</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.length === 0 && (
                    <tr><td className="td" colSpan={4}><div className="empty">No coordinators found.</div></td></tr>
                  )}
                  {visibleRows.map((c, idx) => (
                    <tr key={c.email || idx}>
                      <td className="td">
                        <button
                          type="button"
                          className="name-link"
                          onClick={() => openCoordinatorDetail(c)}
                        >
                          {c.name || 'Unnamed'}
                        </button>
                      </td>
                      <td className="td">{c.email}</td>
                      <td className="td">{c.team || c.college || 'Unassigned'}</td>
                      <td className="td">
                        {c.isDeleted ? (
                          isSelfDeleted(c) ? (
                            <span className="locked-tag">
                              <i className="fas fa-lock" /> Self deleted
                            </span>
                          ) : (
                            <button className="restore-btn" onClick={() => onRestore(c.email)}>
                              <i className="fas fa-user-plus" /> Restore
                            </button>
                          )
                        ) : (
                          <button className="remove-btn" onClick={() => onRemove(c.email)}>
                            <i className="fas fa-user-minus" /> Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!loading && !error && selectedCoordinator && (
              <div className="coord-detail-modal" onClick={closeCoordinatorDetail}>
                <motion.div
                  className="coord-detail-panel"
                  onClick={(event) => event.stopPropagation()}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.98 }}
                  transition={{ duration: 0.22 }}
                >
                  <button type="button" className="detail-close-btn" onClick={closeCoordinatorDetail} aria-label="Close coordinator details">
                    <i className="fas fa-times" />
                  </button>

                  <h3 className="stats-title" style={{ marginBottom: '0.4rem' }}>
                    <i className="fas fa-user-tie" /> Coordinator Stats
                  </h3>
                  <div className="stats-subtitle" style={{ marginBottom: '1rem' }}>
                    {selectedCoordinator.name || 'Unnamed'} - {selectedCoordinator.email || 'N/A'}
                  </div>

                  {statsLoading && <div className="empty">Loading stats...</div>}
                  {!statsLoading && statsError && (
                    <div className="empty">
                      {statsError}
                      <div style={{ marginTop: '0.8rem' }}>
                        <button type="button" className="more-btn" onClick={fetchCoordinatorStats}>
                          <i className="fas fa-rotate-right" /> Retry
                        </button>
                      </div>
                    </div>
                  )}
                  {!statsLoading && !statsError && !selectedStats && (
                    <div className="empty">No stats available for this coordinator.</div>
                  )}
                  {!statsLoading && !statsError && selectedStats && (
                    <>
                      <div className="stats-grid">
                        <div className="stats-item">
                          <span className="stats-label">Rank</span>
                          <span className="stats-value stats-highlight">{selectedStats.rank ?? 'N/A'}</span>
                        </div>
                        <div className="stats-item">
                          <span className="stats-label">College</span>
                          <span className="stats-value">{selectedStats.college || 'N/A'}</span>
                        </div>
                        <div className="stats-item">
                          <span className="stats-label">Tournaments</span>
                          <span className="stats-value">{selectedStats.totalTournaments ?? 0}</span>
                        </div>
                        <div className="stats-item">
                          <span className="stats-label">Products Sold</span>
                          <span className="stats-value">{selectedStats.totalProductsSold ?? 0}</span>
                        </div>
                        <div className="stats-item">
                          <span className="stats-label">Store Revenue</span>
                          <span className="stats-value">{formatCurrency(selectedStats.storeRevenue)}</span>
                        </div>
                        <div className="stats-item">
                          <span className="stats-label">Tournament Revenue</span>
                          <span className="stats-value">{formatCurrency(selectedStats.tournamentRevenue)}</span>
                        </div>
                        <div className="stats-item">
                          <span className="stats-label">Total Revenue</span>
                          <span className="stats-value stats-highlight">{formatCurrency(selectedStats.totalRevenue)}</span>
                        </div>
                        <div className="stats-item">
                          <span className="stats-label">Growth Trend</span>
                          <span className="stats-value" style={{ color: (selectedStats.growthPercentage ?? 0) < 0 ? '#ff6b6b' : 'var(--sea-green)' }}>
                            {(selectedStats.growthPercentage ?? 0).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="chart-card">
                        {revenueChartData && (
                          <Bar data={revenueChartData} options={revenueChartOptions} />
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              </div>
            )}

            <div style={{ textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              {visible < filtered.length && (
                <button className="more-btn" onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length))}>More</button>
              )}
            </div>

            <div style={{ textAlign: 'right', marginTop: '2rem' }}>
              <Link to="/organizer/organizer_dashboard" className="back-to-dashboard">
                <i className="fas fa-arrow-left" /> Back to Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorManagement;
