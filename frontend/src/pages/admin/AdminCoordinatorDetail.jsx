import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import '../../styles/playerNeoNoir.css';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const AdminCoordinatorDetail = () => {
  const { email } = useParams();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState({ coordinator: null, tournaments: [], meetings: [], students: [], productsStats: { sales: [] } });

  const [studentsPage, setStudentsPage] = useState(1);
  const [tournamentsPage, setTournamentsPage] = useState(1);
  const [salesPage, setSalesPage] = useState(1);
  const [meetingsPage, setMeetingsPage] = useState(1);
  const itemsPerPage = 5;

  const adminLinks = [
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-users-cog' },
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },
    { path: '/admin/coordinator_analytics', label: 'Coordinator Analytics', icon: 'fas fa-chart-line' }
  ];

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetchAsAdmin(`/admin/api/coordinators/${encodeURIComponent(email)}/details`);
        if (!res.ok) throw new Error('Failed to load details');
        const data = await res.json();
        setDetails(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [email]);

  const isSelfDeleted = (org) => {
    const orgEmail = String(org?.email || '').trim().toLowerCase();
    const deletedBy = String(org?.deleted_by || '').trim().toLowerCase();
    return Boolean(orgEmail && deletedBy && orgEmail === deletedBy);
  };

  const handleRemove = async () => {
    if (!window.confirm(`Are you sure you want to remove coordinator: ${email}?`)) return;
    try {
      setActionLoading(true);
      const res = await fetchAsAdmin(`/admin/api/coordinators/${encodeURIComponent(email)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to remove coordinator.');
      setDetails((prev) => ({ ...prev, coordinator: { ...prev.coordinator, isDeleted: true, deleted_by: 'admin' } }));
      setNotice(body?.message || 'Coordinator removed successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError(e.message || 'Failed to remove coordinator.');
      setTimeout(() => setError(''), 2500);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm(`Are you sure you want to restore coordinator: ${email}?`)) return;
    try {
      setActionLoading(true);
      const res = await fetchAsAdmin(`/admin/api/coordinators/restore/${encodeURIComponent(email)}`, { method: 'PATCH' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to restore coordinator.');
      setDetails((prev) => ({ ...prev, coordinator: { ...prev.coordinator, isDeleted: false, deleted_by: null } }));
      setNotice(body?.message || 'Coordinator restored successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError(e.message || 'Failed to restore coordinator.');
      setTimeout(() => setError(''), 2500);
    } finally {
      setActionLoading(false);
    }
  };

  const totalStudentsPages = Math.ceil((details.students?.length || 0) / itemsPerPage);
  const currentStudents = details.students?.slice((studentsPage - 1) * itemsPerPage, studentsPage * itemsPerPage) || [];

  const totalTournamentsPages = Math.ceil((details.tournaments?.length || 0) / itemsPerPage);
  const currentTournaments = details.tournaments?.slice((tournamentsPage - 1) * itemsPerPage, tournamentsPage * itemsPerPage) || [];

  const totalSalesPages = Math.ceil((details.productsStats?.sales?.length || 0) / itemsPerPage);
  const currentSales = details.productsStats?.sales?.slice((salesPage - 1) * itemsPerPage, salesPage * itemsPerPage) || [];

  const totalMeetingsPages = Math.ceil((details.meetings?.length || 0) / itemsPerPage);
  const currentMeetings = details.meetings?.slice((meetingsPage - 1) * itemsPerPage, meetingsPage * itemsPerPage) || [];
  const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
  const tournamentsConductedCount = (details.tournaments || []).filter(
    (t) => normalizeStatus(t?.status) !== 'rejected'
  ).length;
  const tournamentsRejectedCount = (details.tournaments || []).filter(
    (t) => normalizeStatus(t?.status) === 'rejected'
  ).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); width: 100%; }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        .back-link { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
        .back-link:hover { opacity: 0.9; transform: translateY(-2px); }
        .banner { padding:1rem; border-radius:8px; margin-bottom:1rem; text-align:center; font-weight:bold; }
        .banner.error { background:rgba(220,53,69,0.1); color:#dc3545; }
        .banner.ok { background:rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); color:var(--sea-green); }
        .header-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:2.5rem; display:flex; align-items:center; gap:1rem; margin-bottom: 0.5rem; }
        .section-card { background:rgba(30, 41, 59, 0.4); backdrop-filter: blur(8px); border:1px solid var(--card-border); border-radius:15px; padding:2rem; margin-bottom:2rem; transition: transform 0.3s ease; }
        .section-title { font-family:'Cinzel', serif; color:var(--sea-green); font-size:1.5rem; display:flex; align-items:center; gap:0.8rem; margin-bottom: 1.5rem; }
        .table { width:100%; border-collapse:collapse; }
        .th { background:rgba(20, 184, 166, 0.1); color:var(--sea-green); padding:1rem 1.2rem; text-align:left; font-family:'Cinzel', serif; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.5px; }
        .td { padding:1rem; border-bottom:1px solid var(--card-border); }
        .status-pill { padding: 0.3rem 0.8rem; border-radius: 9999px; font-size: 0.85rem; font-weight: bold; text-transform: uppercase; }
        .status-active { background: rgba(34, 197, 94, 0.2); color: #86efac; }
        .status-removed { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
        .empty { text-align:center; padding:2rem; color:var(--text-color); opacity: 0.7; font-style:italic; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-box { background: rgba(30, 41, 59, 0.6); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--card-border); }
        .stat-box h4 { font-size: 0.9rem; opacity: 0.7; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px; }
        .stat-box p { font-size: 1.8rem; color: var(--sea-green); font-family: 'Cinzel', serif; font-weight: bold; }
        .action-btn { background-color:#ff6b6b; color:#fff; border:none; padding:0.6rem 1rem; border-radius:5px; cursor:pointer; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .restore-btn { background-color:var(--sea-green); color:var(--on-accent); }
        .locked-tag { color:#c62828; font-weight:bold; font-family:'Cinzel', serif; display:inline-flex; align-items:center; gap:0.4rem; font-size: 0.9rem; }
        .pagination { display:flex; justify-content:center; align-items:center; gap:1rem; margin-top:1.5rem; font-family:'Cinzel', serif; }
        .page-btn { background:rgba(30, 41, 59, 0.7); color:var(--sea-green); border:1px solid var(--sea-green); padding:0.4rem 1rem; border-radius:5px; cursor:pointer; font-weight:bold; transition:all 0.3s; }
        .page-btn:disabled { opacity:0.3; cursor:not-allowed; }
        .page-btn:not(:disabled):hover { background:var(--sea-green); color:#fff; }
        .page-info { color:var(--text-color); font-size:0.9rem; font-weight:bold; }
      `}</style>

      <div className="page player-neo">
        <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div className="admin-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001 }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-color)', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">

          {error && <div className="banner error">{error}</div>}
          {notice && <div className="banner ok">{notice}</div>}

          {loading ? (
             <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.7 }}>
               <i className="fas fa-circle-notch fa-spin fa-3x" style={{ color: 'var(--sea-green)', marginBottom: '1rem' }} />
               <p>Loading coordinator summary...</p>
             </div>
          ) : error ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <i className="fas fa-exclamation-triangle" /> {error}
            </div>
          ) : details.coordinator ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              
              <motion.div variants={itemVariants} style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h1 className="header-title">{details.coordinator.name}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.8 }}>
                    <span><i className="fas fa-envelope" /> {details.coordinator.email}</span>
                    <span>|</span>
                    <span><i className="fas fa-university" /> {details.coordinator.college || 'N/A'}</span>
                    <span>|</span>
                    <span className={`status-pill ${details.coordinator.isDeleted ? 'status-removed' : 'status-active'}`}>
                      {details.coordinator.isDeleted ? 'Removed' : 'Active'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                   {details.coordinator.status === 'Left Platform' ? (
                       <span style={{color: 'gray', fontStyle: 'italic', fontWeight: 'bold'}}><i className="fas fa-user-slash"/> User Self-Deleted</span>
                   ) : details.coordinator.isDeleted || details.coordinator.status === 'Removed' ? (
                       <button className="restore-btn" onClick={handleRestore} disabled={actionLoading}>
                           {actionLoading ? 'Restoring...' : <><i className="fas fa-undo"/> Restore Coordinator</>}
                       </button>
                   ) : (
                       <button className="action-btn" onClick={handleRemove} disabled={actionLoading}>
                           {actionLoading ? 'Removing...' : <><i className="fas fa-trash-alt"/> Remove Coordinator</>}
                       </button>
                   )}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-grid">
                <div className="stat-box">
                  <h4>College Students</h4>
                  <p>{details.students?.length || 0}</p>
                </div>
                <div className="stat-box">
                  <h4>Tournaments Conducted</h4>
                  <p>{tournamentsConductedCount}</p>
                </div>
                <div className="stat-box">
                  <h4>Tournaments that got  Rejected</h4>
                  <p>{tournamentsRejectedCount}</p>
                </div>
                <div className="stat-box">
                  <h4>Total Earnings from store</h4>
                  <p>INR {details.productsStats?.totalEarnings || 0}</p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-users" /> College Students Under Coordinator</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Name</th>
                        <th className="th">Email</th>
                        <th className="th">FIDE ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.students || details.students.length === 0 ? (
                         <tr><td colSpan={3} className="empty">No students found.</td></tr>
                      ) : (
                        currentStudents.map((s, idx) => (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>
                               <Link to={`/admin/player/${encodeURIComponent(s.email)}`} style={{ color: 'inherit', textDecoration: 'underline' }}>
                                   {s.name}
                               </Link>
                            </td>
                            <td className="td">{s.email}</td>
                            <td className="td">{s.FIDE_ID || 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {totalStudentsPages > 1 && (
                  <div className="pagination">
                    <button 
                      className="page-btn" 
                      disabled={studentsPage === 1} 
                      onClick={() => setStudentsPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <span className="page-info">
                      Page {studentsPage} of {totalStudentsPages}
                    </span>
                    <button 
                      className="page-btn" 
                      disabled={studentsPage === totalStudentsPages} 
                      onClick={() => setStudentsPage(prev => Math.min(totalStudentsPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-trophy" /> Tournaments Conducted</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Tournament Name</th>
                        <th className="th">Type</th>
                        <th className="th">Date</th>
                        <th className="th">Fee</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.tournaments || details.tournaments.length === 0 ? (
                         <tr><td colSpan={5} className="empty">No tournaments conducted.</td></tr>
                      ) : (
                        currentTournaments.map((t, idx) => (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>{t.name || t.title}</td>
                            <td className="td">{t.type}</td>
                            <td className="td">{t.date ? new Date(t.date).toLocaleDateString() : 'TBD'}</td>
                            <td className="td">INR {t.entry_fee || 0}</td>
                            <td className="td"><span className={`status-pill ${t.status?.toLowerCase() === 'rejected' || t.status?.toLowerCase() === 'removed' ? 'status-removed' : 'status-active'}`}>{t.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {totalTournamentsPages > 1 && (
                  <div className="pagination">
                    <button 
                      className="page-btn" 
                      disabled={tournamentsPage === 1} 
                      onClick={() => setTournamentsPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <span className="page-info">
                      Page {tournamentsPage} of {totalTournamentsPages}
                    </span>
                    <button 
                      className="page-btn" 
                      disabled={tournamentsPage === totalTournamentsPages} 
                      onClick={() => setTournamentsPage(prev => Math.min(totalTournamentsPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-shopping-cart" /> Products Sold</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Product</th>
                        <th className="th">Sold To</th>
                        <th className="th">Date</th>
                        <th className="th">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.productsStats?.sales || details.productsStats.sales.length === 0 ? (
                         <tr><td colSpan={4} className="empty">No sales data available.</td></tr>
                      ) : (
                        currentSales.map((s, idx) => (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>{s.product_name}</td>
                            <td className="td">{s.buyer} {s.college ? `(${s.college})` : ''}</td>
                            <td className="td">{s.purchase_date ? new Date(s.purchase_date).toLocaleDateString() : 'N/A'}</td>
                            <td className="td" style={{ color: 'var(--sea-green)', fontWeight: 'bold' }}>INR {s.price || 0}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {totalSalesPages > 1 && (
                  <div className="pagination">
                    <button 
                      className="page-btn" 
                      disabled={salesPage === 1} 
                      onClick={() => setSalesPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <span className="page-info">
                      Page {salesPage} of {totalSalesPages}
                    </span>
                    <button 
                      className="page-btn" 
                      disabled={salesPage === totalSalesPages} 
                      onClick={() => setSalesPage(prev => Math.min(totalSalesPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-video" /> Meetings Taken</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Title</th>
                        <th className="th">Date</th>
                        <th className="th">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.meetings || details.meetings.length === 0 ? (
                         <tr><td colSpan={3} className="empty">No meetings found.</td></tr>
                      ) : (
                        currentMeetings.map((m, idx) => (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>{m.title}</td>
                            <td className="td">{m.date ? new Date(m.date).toLocaleDateString() : 'N/A'}</td>
                            <td className="td">{m.time || 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {totalMeetingsPages > 1 && (
                  <div className="pagination">
                    <button 
                      className="page-btn" 
                      disabled={meetingsPage === 1} 
                      onClick={() => setMeetingsPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <span className="page-info">
                      Page {meetingsPage} of {totalMeetingsPages}
                    </span>
                    <button 
                      className="page-btn" 
                      disabled={meetingsPage === totalMeetingsPages} 
                      onClick={() => setMeetingsPage(prev => Math.min(totalMeetingsPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </motion.div>

              <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                <Link to="/admin/coordinator_management" className="back-link">
                  <i className="fas fa-arrow-left" /> Back to Coordinators
                </Link>
              </div>

            </motion.div>
          ) : null}

        </div>
      </div>
    </div>
  );
};

export default AdminCoordinatorDetail;
