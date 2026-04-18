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

const AdminPlayerManagement = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [attr, setAttr] = useState('name');
  const [query, setQuery] = useState('');

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsAdmin('/admin/api/players');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : (Array.isArray(data?.players) ? data.players : []));
      setCurrentPage(1);
    } catch (e) {
      setError('Failed to load players.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  const filtered = useMemo(() => {
    if (!query.trim()) return players;
    const q = query.toLowerCase();
    const getVal = (p) => {
      switch (attr) {
        case 'name': return p.name;
        case 'email': return p.email;
        case 'college': return p.college;
        case 'status': return Number(p.isDeleted) === 1 ? 'removed' : 'active';
        default: return '';
      }
    };
    return players.filter((p) => (getVal(p) || '').toString().toLowerCase().includes(q));
  }, [players, query, attr]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const shown = filtered.slice(startIndex, startIndex + itemsPerPage);

  const isSelfDeleted = (user) => {
    const email = String(user?.email || '').trim().toLowerCase();
    const deletedBy = String(user?.deleted_by || '').trim().toLowerCase();
    return Boolean(email && deletedBy && email === deletedBy);
  };

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
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; overflow-x:auto; }
        .updates-section:hover { transform: translateY(-5px); }
        .table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1.2rem; text-align:left; font-family:'Cinzel', serif; font-size:1.1rem; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .action-btn { background-color:#ff6b6b; color:#fff; border:none; padding:0.6rem 1rem; border-radius:5px; cursor:pointer; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .restore-btn { background-color:var(--sea-green); color:var(--on-accent); }
        .locked-tag { color:#c62828; font-weight:bold; font-family:'Cinzel', serif; display:inline-flex; align-items:center; gap:0.4rem; }
        .more-btn { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; cursor:pointer; border:none; }
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
        .banner.ok { background:rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); color:var(--sea-green); }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
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
          <i className="fas fa-chess-pawn" />
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
            <i className="fas fa-chess-pawn" /> Player Management
          </motion.h1>

          {error && <div className="banner error">{error}</div>}
          {notice && <div className="banner ok">{notice}</div>}

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <div style={{ textAlign: 'center' }}>
              <span className="row-counter">{`${Math.min(startIndex + 1, filtered.length)} - ${Math.min(startIndex + itemsPerPage, filtered.length)} of ${filtered.length}`}</span>
            </div>

            <div className="search-bar">
              <select aria-label="Attribute" value={attr} onChange={(e) => { setAttr(e.target.value); setCurrentPage(1); }} className="select">
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="college">Assigned College</option>
                <option value="status">Status</option>
              </select>
              <input aria-label="Search" placeholder="Search…" value={query} onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }} className="input" />
            </div>

            {loading ? (
              <table className="table"><tbody><tr><td colSpan={6} className="empty"><i className="fas fa-info-circle" /> Loading players…</td></tr></tbody></table>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th"><i className="fas fa-user" /> Name</th>
                      <th className="th"><i className="fas fa-id-card" /> ID / Email</th>
                      <th className="th"><i className="fas fa-info-circle" /> Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 ? (
                      <tr><td colSpan={3} className="empty"><i className="fas fa-info-circle" /> No players available.</td></tr>
                    ) : (
                      shown.map((p, idx) => {
                        const selfDeleted = isSelfDeleted(p);
                        const isRemoved = p.isDeleted && !selfDeleted;
                        return (
                        <tr key={`${p.email}-${idx}`}>
                          <td className="td">
                            <Link to={`/admin/player/${encodeURIComponent(p.email)}`} style={{ color: 'inherit', fontWeight: 'bold', textDecoration: 'none' }}>
                               {p.name} <i className="fas fa-external-link-alt" style={{ fontSize: '0.8rem', opacity: 0.6, marginLeft: '4px' }} />
                            </Link>
                          </td>
                          <td className="td">{p.email}</td>
                          <td className="td">
                            {selfDeleted ? (
                               <span style={{color: '#d97706', fontWeight: 'bold'}}><i className="fas fa-door-open" /> Left Platform</span>
                            ) : isRemoved ? (
                               <span style={{color: '#dc2626', fontWeight: 'bold'}}><i className="fas fa-ban" /> Removed</span>
                            ) : (
                               <span style={{color: '#16a34a', fontWeight: 'bold'}}><i className="fas fa-check-circle" /> Active</span>
                            )}
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="pagination" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="more-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      <i className="fas fa-chevron-left" /> Previous
                    </button>
                    <span style={{ fontFamily: "'Cinzel', serif", fontWeight: 'bold' }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="more-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                      Next <i className="fas fa-chevron-right" />
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

export default AdminPlayerManagement;
