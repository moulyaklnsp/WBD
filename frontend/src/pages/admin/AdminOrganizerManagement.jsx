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

const AdminOrganizerManagement = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [attr, setAttr] = useState('name');
  const [query, setQuery] = useState('');

  const fetchOrganizers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsAdmin('/admin/api/organizers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrganizers(Array.isArray(data) ? data : (Array.isArray(data?.organizers) ? data.organizers : []));
      setCurrentPage(1);
    } catch (e) {
      setError('Failed to load organizers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrganizers(); }, [fetchOrganizers]);

  const filtered = useMemo(() => {
    if (!query.trim()) return organizers;
    const q = query.toLowerCase();
    const getVal = (o) => {
      switch (attr) {
        case 'name': return o.name;
        case 'email': return o.email;
        case 'college': return o.college;
        case 'status': return o.isDeleted ? 'removed' : 'active';
        default: return '';
      }
    };
    return organizers.filter((o) => (getVal(o) || '').toString().toLowerCase().includes(q));
  }, [organizers, query, attr]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const shown = filtered.slice(startIndex, startIndex + itemsPerPage);

  const isSelfDeleted = (user) => {
    const email = String(user?.email || '').trim().toLowerCase();
    const deletedBy = String(user?.deleted_by || '').trim().toLowerCase();
    return Boolean(email && deletedBy && email === deletedBy);
  };

  const handleRemove = async (email) => {
    if (!window.confirm(`Are you sure you want to remove organizer: ${email}?`)) return;
    try {
      const res = await fetchAsAdmin(`/admin/api/organizers/${encodeURIComponent(email)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to remove organizer.');
      setOrganizers((prev) => prev.map((o) => (o.email === email ? { ...o, isDeleted: true } : o)));
      setNotice(body?.message || 'Organizer removed successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError(e.message || 'Failed to remove organizer.');
      setTimeout(() => setError(''), 2500);
    }
  };

  const handleRestore = async (email) => {
    if (!window.confirm(`Are you sure you want to restore organizer: ${email}?`)) return;
    try {
      const res = await fetchAsAdmin(`/admin/api/organizers/restore/${encodeURIComponent(email)}`, { method: 'PATCH' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to restore organizer.');
      setOrganizers((prev) => prev.map((o) => (o.email === email ? { ...o, isDeleted: false } : o)));
      setNotice(body?.message || 'Organizer restored successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError(e.message || 'Failed to restore organizer.');
      setTimeout(() => setError(''), 2500);
    }
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
        .th { background:var(--sea-green); color:var(--on-accent); padding:1rem 1.2rem; text-align:left; font-family:'Cinzel', serif; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .action-btn { background-color:#ff6b6b; color:#fff; border:none; padding:0.6rem 1rem; border-radius:5px; cursor:pointer; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .restore-btn { background-color:var(--sea-green); color:var(--on-accent); }
        .locked-tag { color:#c62828; font-weight:bold; font-family:'Cinzel', serif; display:inline-flex; align-items:center; gap:0.4rem; }
        .pagination { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
        .page-btn { background-color: var(--sea-green); color: var(--on-accent); border: none; padding: 0.6rem 1.2rem; border-radius: 5px; cursor: pointer; font-family: 'Cinzel', serif; font-weight: bold; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 0.5rem; opacity: 0.9; }
        .page-btn:hover:not(:disabled) { transform: translateY(-2px); opacity: 1; box-shadow: 0 4px 12px rgba(var(--sea-green-rgb, 27, 94, 63), 0.3); }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-family: 'Cinzel', serif; font-weight: bold; color: var(--sea-green); font-size: 1.1rem; }
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
          <i className="fas fa-users-cog" />
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
            <i className="fas fa-users-cog" /> Organizer Management
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
              <span className="row-counter">{`${filtered.length > 0 ? startIndex + 1 : 0} - ${Math.min(startIndex + itemsPerPage, filtered.length)} of ${filtered.length}`}</span>
            </div>

            <div className="search-bar">
              <select aria-label="Attribute" value={attr} onChange={(e) => { setAttr(e.target.value); setCurrentPage(1); }} className="select">
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="college">College</option>
                <option value="status">Status</option>
              </select>
              <input aria-label="Search" placeholder="Search…" value={query} onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }} className="input" />
            </div>

            {loading ? (
              <table className="table"><tbody><tr><td colSpan={6} className="empty"><i className="fas fa-info-circle" /> Loading organizers…</td></tr></tbody></table>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th className="th"><i className="fas fa-user" /> Name</th>
                      <th className="th"><i className="fas fa-envelope" /> Email</th>
                      <th className="th"><i className="fas fa-phone" /> Phone</th>
                      <th className="th"><i className="fas fa-university" /> College</th>
                      <th className="th"><i className="fas fa-info-circle" /> Status</th>
                      <th className="th"><i className="fas fa-cog" /> Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 ? (
                      <tr><td colSpan={6} className="empty"><i className="fas fa-info-circle" /> No organizers available.</td></tr>
                    ) : (
                      shown.map((o, idx) => {
                        const selfDeleted = isSelfDeleted(o);
                        const isRemoved = o.isDeleted && !selfDeleted;
                        return (
                        <tr key={`${o.email}-${idx}`}>
                          <td className="td">
                            <Link to={`/admin/organizer/${encodeURIComponent(o.email)}`} style={{ color: 'inherit', fontWeight: 'bold', textDecoration: 'none' }}>
                               {o.name} <i className="fas fa-external-link-alt" style={{ fontSize: '0.8rem', opacity: 0.6, marginLeft: '4px' }} />
                            </Link>
                          </td>
                          <td className="td">{o.email}</td>
                          <td className="td">{o.phone || 'N/A'}</td>
                          <td className="td">{o.college}</td>
                          <td className="td">
                            {selfDeleted ? (
                               <span style={{color: '#d97706', fontWeight: 'bold'}}><i className="fas fa-door-open" /> Left Platform</span>
                            ) : isRemoved ? (
                               <span style={{color: '#dc2626', fontWeight: 'bold'}}><i className="fas fa-ban" /> Removed</span>
                            ) : (
                               <span style={{color: '#16a34a', fontWeight: 'bold'}}><i className="fas fa-check-circle" /> Active</span>
                            )}
                          </td>
                          <td className="td">
                            {!selfDeleted && (
                              isRemoved ? (
                                <button type="button" className="action-btn restore-btn" onClick={() => handleRestore(o.email)}>
                                  <i className="fas fa-undo" /> Restore
                                </button>
                              ) : (
                                <button type="button" className="action-btn" onClick={() => handleRemove(o.email)}>
                                  <i className="fas fa-trash" /> Remove
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>

                <div className="pagination">
                  <button type="button" className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>
                    <i className="fas fa-chevron-left" /> Previous
                  </button>
                  <span className="page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button type="button" className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>
                    Next <i className="fas fa-chevron-right" />
                  </button>
                </div>
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

export default AdminOrganizerManagement;

