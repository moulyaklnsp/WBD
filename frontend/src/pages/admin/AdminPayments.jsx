import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';

const AdminPayments = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [walletRecharges, setWalletRecharges] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [store, setStore] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    college: '',
    coordinator: ''
  });

  // Pagination
  const [pageWallet, setPageWallet] = useState(1);
  const [pageSubs, setPageSubs] = useState(1);
  const [pageTour, setPageTour] = useState(1);
  const [pageStore, setPageStore] = useState(1);
  const itemsPerPage = 5;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.college) params.set('college', filters.college);
      if (filters.coordinator) params.set('coordinator', filters.coordinator);
      
      const url = `/admin/api/payments${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetchAsAdmin(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const payload = data?.data || {};
      
      setWalletRecharges(Array.isArray(payload.walletRecharges) ? payload.walletRecharges : []);
      setSubscriptions(Array.isArray(payload.subscriptions) ? payload.subscriptions : []);
      setTournaments(Array.isArray(payload.tournaments) ? payload.tournaments : []);
      setStore(Array.isArray(payload.store) ? payload.store : []);
      
      setPageWallet(1); setPageSubs(1); setPageTour(1); setPageStore(1);
    } catch (e) {
      setError('Failed to load payments data.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const adminLinks = [
    { path: '/admin/organizer_management', label: 'Manage Organizers', icon: 'fas fa-users-cog' },
    { path: '/admin/coordinator_management', label: 'Manage Coordinators', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },

  ];

  const totalPageWallet = Math.ceil(walletRecharges.length / itemsPerPage) || 1;
  const totalPageSubs = Math.ceil(subscriptions.length / itemsPerPage) || 1;
  const totalPageTour = Math.ceil(tournaments.length / itemsPerPage) || 1;
  const totalPageStore = Math.ceil(store.length / itemsPerPage) || 1;

  const walletShown = walletRecharges.slice((pageWallet - 1) * itemsPerPage, pageWallet * itemsPerPage);
  const subsShown = subscriptions.slice((pageSubs - 1) * itemsPerPage, pageSubs * itemsPerPage);
  const tourShown = tournaments.slice((pageTour - 1) * itemsPerPage, pageTour * itemsPerPage);
  const storeShown = store.slice((pageStore - 1) * itemsPerPage, pageStore * itemsPerPage);

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1, h2 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        h2 { font-size:2.2rem; justify-content:center; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; overflow-x:auto; }
        .updates-section:hover { transform: translateY(-5px); }
        .table { width:100%; border-collapse:collapse; margin-bottom:2rem; }
        .th { background:var(--sea-green); color:var(--on-accent); padding:1.2rem; text-align:left; font-family:'Cinzel', serif; font-size:1.1rem; }
        .td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .status-badge { padding:0.5rem 1rem; border-radius:20px; font-size:0.9rem; font-weight:bold; display:inline-block; text-align:center; background-color:var(--sky-blue); color:var(--sea-green); }
        .more-btn { display:inline-flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; cursor:pointer; border:none; }
        .row-counter { text-align:center; margin-bottom:1rem; font-family:'Cinzel', serif; font-size:1.2rem; color:var(--sea-green); background-color:rgba(var(--sea-green-rgb, 27, 94, 63), 0.1); padding:0.5rem 1rem; border-radius:8px; display:inline-block; }
        .empty { text-align:center; padding:2rem; color:var(--sea-green); font-style:italic; }
        .banner { padding:1rem; border-radius:8px; margin-bottom:1rem; text-align:center; font-weight:bold; }
        .banner.error { background:rgba(220,53,69,0.1); color:#dc3545; }
        .filter-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:0.75rem; margin-bottom:1rem; }
        .filter-input { padding:0.55rem 0.7rem; border:1px solid var(--card-border); border-radius:8px; background:var(--page-bg); color:var(--text-color); }
        .pagination { display:flex; justify-content:center; align-items:center; gap:1rem; margin-top:1rem; }
        .page-btn { background-color:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.3s ease; }
        .page-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .page-info { font-family:'Cinzel', serif; font-weight:bold; color:var(--sea-green); }
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
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
          <i className="fas fa-money-bill-wave" />
        </motion.div>
        
        <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="admin-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              color: 'var(--text-color)', width: 40, height: 40, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} aria-hidden="true" />
          </motion.button>
        </div>

        <div className="content">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="fas fa-money-bill-wave" /> Payments & Transactions
          </motion.h2>

          {error && <div className="banner error">{error}</div>}

          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.06, duration: 0.55 }}
          >
            <h4 style={{ color: 'var(--sea-green)', fontSize: '1.2rem', marginBottom: '1rem', fontFamily: 'Cinzel, serif' }}>
              <i className="fas fa-filter" /> Advanced Filters
            </h4>
            <div className="filter-grid">
              <input className="filter-input" type="date" value={filters.startDate} onChange={(e) => setFilters((p) => ({ ...p, startDate: e.target.value }))} />
              <input className="filter-input" type="date" value={filters.endDate} onChange={(e) => setFilters((p) => ({ ...p, endDate: e.target.value }))} />
              <input className="filter-input" placeholder="College" value={filters.college} onChange={(e) => setFilters((p) => ({ ...p, college: e.target.value }))} />
              <input className="filter-input" placeholder="Coordinator" value={filters.coordinator} onChange={(e) => setFilters((p) => ({ ...p, coordinator: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: '0.7rem' }}>
              <button type="button" className="back-link" onClick={fetchAll}><i className="fas fa-sync-alt" /> Apply</button>
              <button type="button" className="back-link" onClick={() => setFilters({ startDate: '', endDate: '', college: '', coordinator: '' })}>
                <i className="fas fa-eraser" /> Reset
              </button>
            </div>
          </motion.div>

          {/* 1. Wallet Recharges */}
          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1, duration: 0.55 }}
          >
            <h4 style={{ color: 'var(--sea-green)', fontSize: '1.2rem', marginBottom: '1.5rem', fontFamily: 'Cinzel, serif' }}>
              <i className="fas fa-wallet" /> Wallet Recharges
            </h4>
            <div style={{ textAlign: 'center' }}>
              <span className="row-counter">Total Records: {walletRecharges.length}</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Player Name</th>
                  <th className="th">Email</th>
                  <th className="th">Amount</th>
                  <th className="th">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="empty"><i className="fas fa-info-circle" /> Loading wallet recharges...</td></tr>
                ) : walletShown.length === 0 ? (
                  <tr><td colSpan={4} className="empty"><i className="fas fa-info-circle" /> No wallet recharges found.</td></tr>
                ) : (
                  walletShown.map((w, idx) => (
                    <tr key={`wall-${idx}`}>
                      <td className="td">{w.playerName || 'N/A'}</td>
                      <td className="td">{w.playerEmail || 'N/A'}</td>
                      <td className="td" style={{color: 'var(--sea-green)', fontWeight: 'bold'}}>₹{w.amount || 0}</td>
                      <td className="td">{w.date ? new Date(w.date).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="pagination">
              <button className="page-btn" disabled={pageWallet === 1} onClick={() => setPageWallet(p => p - 1)}>
                <i className="fas fa-chevron-left" /> Previous
              </button>
              <span className="page-info">Page {pageWallet} of {totalPageWallet}</span>
              <button className="page-btn" disabled={pageWallet === totalPageWallet} onClick={() => setPageWallet(p => p + 1)}>
                Next <i className="fas fa-chevron-right" />
              </button>
            </div>
          </motion.div>

          {/* 2. Subscriptions */}
          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.2, duration: 0.55 }}
          >
            <h4 style={{ color: 'var(--sea-green)', fontSize: '1.2rem', marginBottom: '1.5rem', fontFamily: 'Cinzel, serif' }}>
              <i className="fas fa-crown" /> Subscriptions
            </h4>
            <div style={{ textAlign: 'center' }}>
              <span className="row-counter">Total Records: {subscriptions.length}</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Player Name</th>
                  <th className="th">Email</th>
                  <th className="th">Plan</th>
                  <th className="th">Start Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="empty"><i className="fas fa-info-circle" /> Loading subscriptions...</td></tr>
                ) : subsShown.length === 0 ? (
                  <tr><td colSpan={4} className="empty"><i className="fas fa-info-circle" /> No subscriptions found.</td></tr>
                ) : (
                  subsShown.map((s, idx) => (
                    <tr key={`sub-${idx}`}>
                      <td className="td">{s.playerName || 'N/A'}</td>
                      <td className="td">{s.playerEmail || 'N/A'}</td>
                      <td className="td"><span className="status-badge">Level {s.plan || 'Unknown'}</span></td>
                      <td className="td">{s.start_date ? new Date(s.start_date).toLocaleDateString() : 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="pagination">
              <button className="page-btn" disabled={pageSubs === 1} onClick={() => setPageSubs(p => p - 1)}>
                <i className="fas fa-chevron-left" /> Previous
              </button>
              <span className="page-info">Page {pageSubs} of {totalPageSubs}</span>
              <button className="page-btn" disabled={pageSubs === totalPageSubs} onClick={() => setPageSubs(p => p + 1)}>
                Next <i className="fas fa-chevron-right" />
              </button>
            </div>
          </motion.div>

          {/* 3. Tournaments */}
          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.3, duration: 0.55 }}
          >
            <h4 style={{ color: 'var(--sea-green)', fontSize: '1.2rem', marginBottom: '1.5rem', fontFamily: 'Cinzel, serif' }}>
              <i className="fas fa-trophy" /> Tournaments
            </h4>
            <div style={{ textAlign: 'center' }}>
              <span className="row-counter">Total Records: {tournaments.length}</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th className="th">Conducted By</th>
                  <th className="th">Name</th>
                  <th className="th">Entry Fee</th>
                  <th className="th">Type</th>
                  <th className="th">Total Enrollments</th>
                  <th className="th">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="empty"><i className="fas fa-info-circle" /> Loading tournaments...</td></tr>
                ) : tourShown.length === 0 ? (
                  <tr><td colSpan={6} className="empty"><i className="fas fa-info-circle" /> No tournaments found.</td></tr>
                ) : (
                  tourShown.map((t, idx) => (
                    <tr key={`tour-${idx}`}>
                      <td className="td">{t.conductedBy || 'N/A'}</td>
                      <td className="td">{t.name || 'N/A'}</td>
                      <td className="td">₹{t.entry_fee || 0}</td>
                      <td className="td">{t.type || 'N/A'}</td>
                      <td className="td">{t.total_enrollments || 0}</td>
                      <td className="td" style={{color: 'var(--sea-green)', fontWeight: 'bold'}}>₹{t.totalRevenue || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="pagination">
              <button className="page-btn" disabled={pageTour === 1} onClick={() => setPageTour(p => p - 1)}>
                <i className="fas fa-chevron-left" /> Previous
              </button>
              <span className="page-info">Page {pageTour} of {totalPageTour}</span>
              <button className="page-btn" disabled={pageTour === totalPageTour} onClick={() => setPageTour(p => p + 1)}>
                Next <i className="fas fa-chevron-right" />
              </button>
            </div>
          </motion.div>

          {/* 4. Store */}
          <motion.div
            className="updates-section"
            initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.4, duration: 0.55 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h4 style={{ color: 'var(--sea-green)', fontSize: '1.2rem', fontFamily: 'Cinzel, serif', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <i className="fas fa-shopping-cart" /> Store Purchases Analysis
              </h4>
              <div style={{ background: 'rgba(var(--sea-green-rgb, 27, 94, 63), 0.1)', padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.3)' }}>
                <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 'bold', color: 'var(--sea-green)' }}>
                  Total Store Revenue: ₹{store.reduce((acc, s) => acc + (Number(s.price) || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span className="row-counter">Total Records: {store.length}</span>
            </div>

            {loading ? (
              <div className="empty"><i className="fas fa-info-circle" /> Loading store...</div>
            ) : storeShown.length === 0 ? (
              <div className="empty"><i className="fas fa-info-circle" /> No store transactions found.</div>
            ) : (
              <div className="product-grid">
                {storeShown.map((s, idx) => (
                  <motion.div 
                    key={`store-${idx}`} 
                    whileHover={{ translateY: -5 }}
                    style={{ 
                      background: 'var(--card-bg)', 
                      border: '1px solid var(--card-border)', 
                      borderRadius: '12px', 
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.2rem', color: 'var(--sea-green)', margin: '0 0 0.25rem 0', fontFamily: 'Cinzel, serif' }}>{s.item || 'N/A'}</h3>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-color)' }}>₹{s.price || 0}</div>
                      </div>
                      <div style={{ background: 'var(--sea-green)', color: 'var(--on-accent)', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold', fontFamily: 'Cinzel, serif' }}>
                        PURCHASED
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.8rem', marginTop: '0.5rem', background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <i className="fas fa-user-tag" style={{ color: 'var(--sea-green)', width: '20px', textAlign: 'center' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Added By (Coordinator)</span>
                          <span style={{ fontWeight: 'bold' }}>{s.soldBy || 'N/A'}</span>
                        </div>
                      </div>
                      
                      <div style={{ width: '100%', height: '1px', background: 'var(--card-border)' }} />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <i className="fas fa-shopping-bag" style={{ color: 'var(--sky-blue)', width: '20px', textAlign: 'center' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Bought By</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--sky-blue)' }}>{s.boughtBy || 'N/A'}</span>
                        </div>
                      </div>

                      {s.purchase_date && (
                        <>
                          <div style={{ width: '100%', height: '1px', background: 'var(--card-border)' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                            <i className="fas fa-calendar-alt" style={{ color: 'gray', width: '20px', textAlign: 'center' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '1px' }}>Date</span>
                              <span style={{ fontSize: '0.9rem' }}>{new Date(s.purchase_date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            <div className="pagination" style={{ marginTop: '2rem' }}>
              <button className="page-btn" disabled={pageStore === 1} onClick={() => setPageStore(p => p - 1)}>
                <i className="fas fa-chevron-left" /> Previous
              </button>
              <span className="page-info">Page {pageStore} of {totalPageStore}</span>
              <button className="page-btn" disabled={pageStore === totalPageStore} onClick={() => setPageStore(p => p + 1)}>
                Next <i className="fas fa-chevron-right" />
              </button>
            </div>
          </motion.div>
          <div style={{ marginTop: '2rem', textAlign: 'right' }}>
            <Link to="/admin/admin_dashboard" className="back-link">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
