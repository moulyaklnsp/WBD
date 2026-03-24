import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import '../../styles/playerNeoNoir.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

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

const AdminPlayerDetail = () => {
  const { email } = useParams();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState({ player: null, tournaments: [], meetings: [], topups: [], subscriptions: [], sales: [] });
  const [playerStatsInfo, setPlayerStatsInfo] = useState(null);

  const [pageSubs, setPageSubs] = useState(1);
  const [pageWallet, setPageWallet] = useState(1);
  const [pageStore, setPageStore] = useState(1);
  const [pageTournaments, setPageTournaments] = useState(1);
  const itemsPerPage = 5;

  const totalPageSubs = Math.ceil((details.subscriptions?.length || 0) / itemsPerPage) || 1;
  const totalPageWallet = Math.ceil((details.topups?.length || 0) / itemsPerPage) || 1;
  const totalPageStore = Math.ceil((details.sales?.length || 0) / itemsPerPage) || 1;
  const totalPageTournaments = Math.ceil((details.tournaments?.length || 0) / itemsPerPage) || 1;

  const adminLinks = [
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-users-cog' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/player_management', label: 'Manage Players', icon: 'fas fa-user-tie' },
    { path: '/admin/admin_tournament_management', label: 'Tournament Approvals', icon: 'fas fa-trophy' },
    { path: '/admin/payments', label: 'Payments & Subscriptions', icon: 'fas fa-money-bill-wave' },
    { path: '/admin/growth_analytics', label: 'Growth Analytics', icon: 'fas fa-chart-area' },
    { path: '/admin/player_analytics', label: 'Player Analytics', icon: 'fas fa-chart-line' }
  ];

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetchAsAdmin(`/admin/api/players/${encodeURIComponent(email)}/details`);
        if (!res.ok) throw new Error('Failed to load details');
        const data = await res.json();
        setDetails(data);
        
        if (data.player && data.player.name) {
          try {
            const playerIdToUse = data.player._id || data.player.id || data.player.playerId || email;
            const statsRes = await fetchAsAdmin(`/admin/api/players/${encodeURIComponent(playerIdToUse)}/stats`);
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              setPlayerStatsInfo(statsData);
            }
          } catch(e) {
             console.error('Failed to fetch player specific stats for graphs');
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [email]);

  const detailSummary = useMemo(() => {
    const summary = playerStatsInfo?.summary || {};
    const gamesPlayed = Number(summary.gamesPlayed || 0);
    const wins = Number(summary.wins || 0);
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    return {
      gamesPlayed,
      wins,
      losses: Number(summary.losses || 0),
      draws: Number(summary.draws || 0),
      rating: Number(summary.rating || 0),
      winRate
    };
  }, [playerStatsInfo]);
  const ratingDisplay = detailSummary.rating > 0 ? detailSummary.rating : 'N/A';

  const ratingChartData = useMemo(() => {
    const points = Array.isArray(playerStatsInfo?.ratingProgression) ? playerStatsInfo.ratingProgression : [];
    return {
      labels: points.map((point) => point.date),
      datasets: [
        {
          label: 'Rating',
          data: points.map((point) => Number(point.rating || 0)),
          borderColor: '#2E8B57',
          backgroundColor: 'rgba(46, 139, 87, 0.15)',
          tension: 0.3
        }
      ]
    };
  }, [playerStatsInfo]);

  const performanceChartData = useMemo(() => {
    const rows = Array.isArray(playerStatsInfo?.performanceHistory) ? playerStatsInfo.performanceHistory : [];
    return {
      labels: rows.map((row) => row.month),
      datasets: [
        {
          label: 'Wins',
          data: rows.map((row) => Number(row.wins || 0)),
          backgroundColor: 'rgba(46, 139, 87, 0.75)'
        },
        {
          label: 'Losses',
          data: rows.map((row) => Number(row.losses || 0)),
          backgroundColor: 'rgba(198, 40, 40, 0.7)'
        },
        {
          label: 'Draws',
          data: rows.map((row) => Number(row.draws || 0)),
          backgroundColor: 'rgba(29, 126, 168, 0.7)'
        }
      ]
    };
  }, [playerStatsInfo]);

  const isSelfDeleted = (org) => {
    const orgEmail = String(org?.email || '').trim().toLowerCase();
    const deletedBy = String(org?.deleted_by || '').trim().toLowerCase();
    return Boolean(orgEmail && deletedBy && orgEmail === deletedBy);
  };

  const handleRemove = async () => {
    if (!window.confirm(`Are you sure you want to remove player: ${email}?`)) return;
    try {
      setActionLoading(true);
      const res = await fetchAsAdmin(`/admin/api/players/${encodeURIComponent(email)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to remove player.');
      setDetails((prev) => ({ ...prev, player: { ...prev.player, isDeleted: true, deleted_by: 'admin' } }));
      setNotice(body?.message || 'Player removed successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError(e.message || 'Failed to remove player.');
      setTimeout(() => setError(''), 2500);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm(`Are you sure you want to restore player: ${email}?`)) return;
    try {
      setActionLoading(true);
      const res = await fetchAsAdmin(`/admin/api/players/restore/${encodeURIComponent(email)}`, { method: 'PATCH' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Failed to restore player.');
      setDetails((prev) => ({ ...prev, player: { ...prev.player, isDeleted: false, deleted_by: null } }));
      setNotice(body?.message || 'Player restored successfully.');
      setTimeout(() => setNotice(''), 2500);
    } catch (e) {
      setError(e.message || 'Failed to restore player.');
      setTimeout(() => setError(''), 2500);
    } finally {
      setActionLoading(false);
    }
  };

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
        .pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem; }
        .page-btn { background: rgba(30, 41, 59, 0.8); color: var(--text-color); border: 1px solid var(--card-border); padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
        .page-btn:hover:not(:disabled) { background: var(--sea-green); color: #fff; }
        .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .page-info { font-family: 'Cinzel', serif; color: var(--text-color); font-weight: bold; }
        
        /* Chart Styles */
        .chart-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:1rem; margin-bottom:2rem; }
        .chart-card { border:1px solid var(--card-border); border-radius:12px; padding:1.5rem; background:rgba(30, 41, 59, 0.6); height:350px; }
        .detail-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:1rem; margin-top: 1.5rem; }
        .mini-card { border:1px solid var(--card-border); border-radius:10px; padding:1rem; background:rgba(20, 184, 166, 0.06); text-align: center; }
        .mini-label { font-size:0.85rem; opacity:0.75; margin-bottom:0.4rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .mini-value { font-size:1.6rem; font-weight:bold; color:var(--sea-green); font-family: 'Cinzel', serif; }
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
               <p>Loading player summary...</p>
             </div>
          ) : error ? (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <i className="fas fa-exclamation-triangle" /> {error}
            </div>
          ) : details.player ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              
              <motion.div variants={itemVariants} style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h1 className="header-title">{details.player.name}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: 0.8 }}>
                    <span><i className="fas fa-envelope" /> {details.player.email}</span>
                    <span>|</span>
                    <span><i className="fas fa-university" /> {details.player.college || 'N/A'}</span>
                    <span>|</span>
                    <span className={`status-pill ${details.player.isDeleted ? 'status-removed' : 'status-active'}`}>
                      {details.player.isDeleted ? 'Removed' : 'Active'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                   {details.player.status === 'Left Platform' ? (
                       <span style={{color: 'gray', fontStyle: 'italic', fontWeight: 'bold'}}><i className="fas fa-user-slash"/> User Self-Deleted</span>
                   ) : details.player.isDeleted || details.player.status === 'Removed' ? (
                       <button className="restore-btn" onClick={handleRestore} disabled={actionLoading}>
                           {actionLoading ? 'Restoring...' : <><i className="fas fa-undo"/> Restore Player</>}
                       </button>
                   ) : (
                       <button className="action-btn" onClick={handleRemove} disabled={actionLoading}>
                           {actionLoading ? 'Removing...' : <><i className="fas fa-trash-alt"/> Remove Player</>}
                       </button>
                   )}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="stat-grid">
                <div className="stat-box">
                  <h4>Subscriptions</h4>
                  <p>{details.subscriptions?.length || 0}</p>
                </div>
                <div className="stat-box">
                  <h4>Total Recharged</h4>
                  <p>₹{details.stats?.totalRecharged || 0} <span style={{fontSize: '1rem', opacity: 0.7}}>({details.topups?.length || 0} times)</span></p>
                </div>
                <div className="stat-box">
                  <h4>Store Items Bought</h4>
                  <p>{details.sales?.length || 0}</p>
                </div>
                <div className="stat-box">
                  <h4>Tournaments Participated</h4>
                  <p>{details.tournaments?.length || 0}</p>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-id-badge" /> Player Profile</h2>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', opacity: 0.9 }}>
                  <div><strong>Wallet Balance:</strong> ₹{details.stats?.walletBalance || 0}</div>
                  <div><strong>FIDE ID:</strong> {details.stats?.fideId || 'N/A'}</div>
                  <div><strong>AICF ID:</strong> {details.stats?.aicfId || 'N/A'}</div>
                  <div><strong>DOB:</strong> {details.player?.dob ? new Date(details.player.dob).toLocaleDateString() : 'N/A'}</div>
                  <div><strong>Rating:</strong> {ratingDisplay}</div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-crown" /> Subscription History</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Plan Level</th>
                        <th className="th">Amount</th>
                        <th className="th">Start Date</th>
                        <th className="th">End Date</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.subscriptions || details.subscriptions.length === 0 ? (
                         <tr><td colSpan={5} className="empty">No subscriptions found.</td></tr>
                      ) : (
                        details.subscriptions.slice((pageSubs - 1) * itemsPerPage, pageSubs * itemsPerPage).map((sub, idx) => (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>{sub.plan_level || sub.plan || 'Unknown'}</td>
                            <td className="td">₹{sub.amount || sub.price || 0}</td>
                            <td className="td">{sub.start_date ? new Date(sub.start_date).toLocaleDateString() : 'N/A'}</td>
                            <td className="td">{sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}</td>
                            <td className="td">
                              <span className={`status-pill ${(sub.status === 'active' || (!sub.status && sub.end_date && new Date(sub.end_date) >= new Date())) ? 'status-active' : 'status-removed'}`}>
                                {sub.status || (sub.end_date && new Date(sub.end_date) >= new Date() ? 'active' : 'expired')}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {details.subscriptions && details.subscriptions.length > itemsPerPage && (
                  <div className="pagination">
                    <button className="page-btn" disabled={pageSubs === 1} onClick={() => setPageSubs(p => Math.max(1, p - 1))}>
                      <i className="fas fa-chevron-left"></i> Prev
                    </button>
                    <span className="page-info">Page {pageSubs} of {totalPageSubs}</span>
                    <button className="page-btn" disabled={pageSubs === totalPageSubs} onClick={() => setPageSubs(p => Math.min(totalPageSubs, p + 1))}>
                      Next <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-wallet" /> Wallet Recharges</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Date</th>
                        <th className="th">Amount</th>
                        <th className="th">Payment ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.topups || details.topups.length === 0 ? (
                         <tr><td colSpan={3} className="empty">No wallet recharges found.</td></tr>
                      ) : (
                        details.topups.slice((pageWallet - 1) * itemsPerPage, pageWallet * itemsPerPage).map((t, idx) => (
                          <tr key={idx}>
                            <td className="td">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A'}</td>
                            <td className="td" style={{ fontWeight: 'bold', color: 'var(--sea-green)' }}>₹{t.amount}</td>
                            <td className="td">{t.payment_id || t._id}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {details.topups && details.topups.length > itemsPerPage && (
                  <div className="pagination">
                    <button className="page-btn" disabled={pageWallet === 1} onClick={() => setPageWallet(p => Math.max(1, p - 1))}>
                      <i className="fas fa-chevron-left"></i> Prev
                    </button>
                    <span className="page-info">Page {pageWallet} of {totalPageWallet}</span>
                    <button className="page-btn" disabled={pageWallet === totalPageWallet} onClick={() => setPageWallet(p => Math.min(totalPageWallet, p + 1))}>
                      Next <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-shopping-cart" /> Store Items Bought</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Product Name</th>
                        <th className="th">Sold By</th>
                        <th className="th">Quantity</th>
                        <th className="th">Total Price</th>
                        <th className="th">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.sales || details.sales.length === 0 ? (
                         <tr><td colSpan={5} className="empty">No store items purchased.</td></tr>
                      ) : (
                        details.sales.slice((pageStore - 1) * itemsPerPage, pageStore * itemsPerPage).map((s, idx) => (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>{s.product_name || 'Removed Product'}</td>
                            <td className="td">{s.coordinator || 'N/A'}</td>
                            <td className="td">{s.quantity || 1}</td>
                            <td className="td">₹{s.price || 0}</td>
                            <td className="td">{s.purchase_date ? new Date(s.purchase_date).toLocaleDateString() : 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {details.sales && details.sales.length > itemsPerPage && (
                  <div className="pagination">
                    <button className="page-btn" disabled={pageStore === 1} onClick={() => setPageStore(p => Math.max(1, p - 1))}>
                      <i className="fas fa-chevron-left"></i> Prev
                    </button>
                    <span className="page-info">Page {pageStore} of {totalPageStore}</span>
                    <button className="page-btn" disabled={pageStore === totalPageStore} onClick={() => setPageStore(p => Math.min(totalPageStore, p + 1))}>
                      Next <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="section-card">
                <h2 className="section-title"><i className="fas fa-trophy" /> Tournaments Participated</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="th">Tournament Name</th>
                        <th className="th">Type</th>
                        <th className="th">Date</th>
                        <th className="th">Fee</th>
                        <th className="th">Position</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!details.tournaments || details.tournaments.length === 0 ? (
                         <tr><td colSpan={6} className="empty">No tournaments participated.</td></tr>
                      ) : (
                        details.tournaments.slice((pageTournaments - 1) * itemsPerPage, pageTournaments * itemsPerPage).map((t, idx) => {
                          const statusLabel = String(t.status || '').trim();
                          const statusKey = statusLabel.toLowerCase();
                          return (
                          <tr key={idx}>
                            <td className="td" style={{ fontWeight: 'bold' }}>{t.name || t.title}</td>
                            <td className="td">{t.type}</td>
                            <td className="td">{t.date ? new Date(t.date).toLocaleDateString() : (t.start_date ? new Date(t.start_date).toLocaleDateString() : 'TBD')}</td>
                            <td className="td">₹{t.entry_fee || 0}</td>
                            <td className="td">{t.position || 'N/A'}</td>
                            <td className="td"><span className={`status-pill ${statusKey === 'rejected' || statusKey === 'removed' ? 'status-removed' : 'status-active'}`}>{statusLabel || 'N/A'}</span></td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {details.tournaments && details.tournaments.length > itemsPerPage && (
                  <div className="pagination">
                    <button className="page-btn" disabled={pageTournaments === 1} onClick={() => setPageTournaments(p => Math.max(1, p - 1))}>
                      <i className="fas fa-chevron-left"></i> Prev
                    </button>
                    <span className="page-info">Page {pageTournaments} of {totalPageTournaments}</span>
                    <button className="page-btn" disabled={pageTournaments === totalPageTournaments} onClick={() => setPageTournaments(p => Math.min(totalPageTournaments, p + 1))}>
                      Next <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                )}
              </motion.div>

              <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                <Link to="/admin/player_management" className="back-link">
                  <i className="fas fa-arrow-left" /> Back to Players
                </Link>
              </div>

            </motion.div>
          ) : null}

        </div>
      </div>
    </div>
  );
};

export default AdminPlayerDetail;

