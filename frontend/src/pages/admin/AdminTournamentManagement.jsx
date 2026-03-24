import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';

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

const AdminTournamentManagement = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [attr, setAttr] = useState('name');
  const [query, setQuery] = useState('');

  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsAdmin('/admin/api/tournaments');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTournaments(Array.isArray(data?.tournaments) ? data.tournaments : []);
      setCurrentPage(1);
    } catch (e) {
      setError('Failed to load tournaments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tournaments;
    const q = query.toLowerCase();
    const getVal = (t) => {
      switch (attr) {
        case 'name': return t.name;
        case 'date': return t.date;
        case 'location': return t.location;
        case 'entry_fee': return `${t.entry_fee}`;
        case 'type': return t.type;
        case 'status': return t.status;
        case 'players': return `${t.player_count}`;
        default: return '';
      }
    };
    return tournaments.filter((t) => (getVal(t) || '').toString().toLowerCase().includes(q));
  }, [tournaments, query, attr]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const shown = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const counterText = `${Math.min(filtered.length, (currentPage - 1) * itemsPerPage + shown.length)} / ${filtered.length}`;

  const adminLinks = [
    { path: '/admin/organizer_management', label: 'Manage Organizers', icon: 'fas fa-users-cog' },
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },

  ];

  // Aggregate stats
  const totalTournaments = tournaments.length;
  const totalRevenue = useMemo(() => tournaments.reduce((acc, t) => acc + (t.player_count || 0) * (Number(t.entry_fee) || 0), 0), [tournaments]);
  const topTournaments = useMemo(() => {
    return [...tournaments]
      .sort((a, b) => ((b.player_count || 0) * (Number(b.entry_fee) || 0)) - ((a.player_count || 0) * (Number(a.entry_fee) || 0)))
      .slice(0, 3);
  }, [tournaments]);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; overflow-x:auto; }
        .updates-section:hover { transform: translateY(-5px); }
        .table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1.2rem; text-align:left; font-family:'Cinzel', serif; font-size:1.1rem; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .status-badge { padding:0.5rem 1rem; border-radius:20px; font-size:0.9rem; font-weight:bold; display:inline-block; text-align:center; }
        .status-badge.active { background-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); color:var(--sea-green); }
        .status-badge.pending { background-color:rgba(255,193,7,0.1); color:#ffc107; }
        .pagination { display:flex; justify-content:center; align-items:center; gap:1rem; margin-top:2rem; }
        .page-btn { background-color:var(--sea-green); color:var(--on-accent); border:none; padding:0.5rem 1rem; border-radius:4px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:opacity 0.3s; }
        .page-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .page-info { font-family:'Cinzel', serif; color:var(--sea-green); font-weight:bold; }
        .row-counter { text-align:center; margin-bottom:1rem; font-family:'Cinzel', serif; font-size:1.2rem; color:var(--sea-green); background-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); padding:0.5rem 1rem; border-radius:8px; display:inline-block; }
        .empty { text-align:center; padding:2rem; color:var(--sea-green); font-style:italic; }
        .search-bar { display:flex; align-items:center; gap:10px; padding:12px; background:var(--card-bg); border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); width:min(100%, 860px); max-width:860px; margin:20px auto; border:1px solid var(--card-border); }
        .select { padding:10px 12px; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-size:14px; min-width:180px; }
        .input { flex:1 1 320px; min-width:320px; padding:10px 12px; border-radius:8px; border:1px solid var(--card-border); background:var(--page-bg); color:var(--text-color); font-size:15px; }
        @media (max-width: 768px) {
          .search-bar { width:100%; max-width:100%; flex-wrap:wrap; }
          .select, .input { min-width:0; width:100%; }
        }
        .banner { padding:1rem; border-radius:8px; margin-bottom:1rem; text-align:center; font-weight:bold; }
        .banner.error { background:rgba(220,53,69,0.1); color:#dc3545; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
        
        /* Dashboard Stats Additions */
        .stats-container { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          padding: 1.5rem;
          flex: 1 1 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .stat-card h3 { font-family: 'Playfair Display', serif; font-size: 1rem; opacity: 0.8; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px; }
        .stat-card p { font-family: 'Cinzel', serif; font-size: 2rem; color: var(--sea-green); font-weight: bold; }
        .top-tourneys-card { align-items: flex-start; text-align: left; }
        .top-tourneys-list { width: 100%; list-style: none; display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
        .top-tourney-item { display: flex; justify-content: space-between; padding: 0.8rem; background: rgba(20, 184, 166, 0.05); border-radius: 8px; border-left: 4px solid var(--sea-green); }
        .top-tourney-name { font-weight: bold; }
        .top-tourney-rev { color: var(--sea-green); font-weight: bold; font-family: 'Cinzel', serif; }
      `}</style>

      <div className="page player-neo">
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-trophy" />
        </motion.div>
        
        <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

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
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="fas fa-trophy" /> Tournament Oversight
          </motion.h1>

          {error && <div className="banner error">{error}</div>}

          {!loading && (
            <motion.div
              className="stats-container"
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="stat-card top-tourneys-card" style={{ flex: '2 1 400px' }}>
                <h3><i className="fas fa-medal" /> Top 3 Revenue Tournaments</h3>
                {topTournaments.length > 0 ? (
                  <ul className="top-tourneys-list">
                    {topTournaments.map((t, idx) => {
                      const rev = (t.player_count || 0) * (Number(t.entry_fee) || 0);
                      return (
                        <li key={idx} className="top-tourney-item">
                          <span className="top-tourney-name">
                             {idx + 1}. <Link to={`/admin/tournament/${t._id}`} style={{color: 'inherit', textDecoration: 'none'}}>{t.name}</Link>
                          </span>
                          <span className="top-tourney-rev">₹{rev.toLocaleString()}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ fontSize: '1rem', fontFamily: 'sans-serif', opacity: 0.7, marginTop: '1rem' }}>No data available.</p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1 1 250px' }}>
                <div className="stat-card" style={{ flex: 1 }}>
                  <h3><i className="fas fa-chess-board" /> Tournaments Conducted</h3>
                  <p>{totalTournaments}</p>
                </div>
                <div className="stat-card" style={{ flex: 1 }}>
                  <h3><i className="fas fa-coins" /> Total Revenue</h3>
                  <p>₹{totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="updates-section"
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h4 style={{ color: 'var(--sea-green)', fontSize: '1.2rem', marginBottom: '1.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-chess-board" /> Tournament Overview</h4>

            <div style={{ textAlign: 'center' }}>
              <span className="row-counter">{counterText}</span>
            </div>

            <div className="search-bar">
              <select aria-label="Attribute" value={attr} onChange={(e) => { setAttr(e.target.value); setCurrentPage(1); }} className="select">
                <option value="name">Name</option>
                <option value="date">Date</option>
                <option value="location">Location</option>
                <option value="entry_fee">Entry Fee</option>
                <option value="type">Type</option>
                <option value="status">Status</option>
                <option value="players">Players</option>
              </select>
              <input aria-label="Search" placeholder="Search…" value={query} onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }} className="input" />
            </div>

            {loading ? (
              <table className="table"><tbody><tr><td colSpan={7} className="empty"><i className="fas fa-info-circle" /> Loading tournaments…</td></tr></tbody></table>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th"><i className="fas fa-trophy" /> Name</th>
                      <th className="th"><i className="far fa-calendar" /> Date</th>
                      <th className="th"><i className="fas fa-map-marker-alt" /> Location</th>
                      <th className="th"><i className="fas fa-rupee-sign" /> Entry Fee</th>
                      <th className="th"><i className="fas fa-chess" /> Type</th>
                      <th className="th"><i className="fas fa-info-circle" /> Status</th>
                      <th className="th"><i className="fas fa-users" /> Players</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 ? (
                      <tr><td colSpan={7} className="empty"><i className="fas fa-info-circle" /> No approved tournaments available.</td></tr>
                    ) : (
                      shown.map((t, idx) => (
                        <tr key={`${t._id || t.name}-${idx}`}>
                          <td className="td">
                             <Link to={`/admin/tournament/${t._id}`} style={{ color: 'inherit', fontWeight: 'bold', textDecoration: 'none' }}>
                                {t.name} <i className="fas fa-external-link-alt" style={{ fontSize: '0.8rem', opacity: 0.6, marginLeft: '4px' }} />
                             </Link>
                          </td>
                          <td className="td">{t.date}</td>
                          <td className="td">{t.location}</td>
                          <td className="td">₹{t.entry_fee}</td>
                          <td className="td">{t.type}</td>
                          <td className="td">
                            <span className={`status-badge ${(t.status || '').toLowerCase() === 'running' ? 'active' : 'pending'}`}>{t.status}</span>
                          </td>
                          <td className="td">{t.player_count}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {filtered.length > 0 && (
                  <div className="pagination">
                    <button 
                      className="page-btn" 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      Previous
                    </button>
                    <span className="page-info">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button 
                      className="page-btn" 
                      disabled={currentPage === totalPages} 
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
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

export default AdminTournamentManagement;
