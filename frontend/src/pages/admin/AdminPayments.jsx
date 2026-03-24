import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAsAdmin } from '../../utils/fetchWithRole';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';


const StoreAnalyticsModal = ({ store, selectedProduct, onClose }) => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  
  let prodBuyers = {};
  let prodTotalCount = 0;
  let prodTotalRevenue = 0;
  let rev30 = 0, rev60 = 0, rev120 = 0, rev180 = 0, rev365 = 0;

  let allProducts = {};
  let allBuyers = {};

  store.forEach(s => {
    const price = Number(s.amount) || Number(s.price) || 0;
    const item = s.item || 'Unknown';
    const buyer = s.boughtBy || s.buyer || s.user || 'Unknown';
    const seller = s.soldBy || 'Admin';
    const pDate = new Date(s.date || s.purchase_date || s.createdAt || Date.now()).getTime();

    if (!allProducts[item]) allProducts[item] = { name: item, seller, count: 0, rev: 0 };
    allProducts[item].count += 1;
    allProducts[item].rev += price;

    if (!allBuyers[buyer]) allBuyers[buyer] = { name: buyer, count: 0, spent: 0 };
    allBuyers[buyer].count += 1;
    allBuyers[buyer].spent += price;

    if (item === selectedProduct) {
      prodTotalCount += 1;
      prodTotalRevenue += price;

      if (!prodBuyers[buyer]) prodBuyers[buyer] = { name: buyer, count: 0, spent: 0 };
      prodBuyers[buyer].count += 1;
      prodBuyers[buyer].spent += price;

      const diff = now - pDate;
      if (diff <= 30 * DAY) rev30 += price;
      if (diff <= 60 * DAY) rev60 += price;
      if (diff <= 120 * DAY) rev120 += price;
      if (diff <= 180 * DAY) rev180 += price;
      if (diff <= 365 * DAY) rev365 += price;
    }
  });

  const topPurchasers = Object.values(prodBuyers).sort((a,b) => b.count - a.count);
  const topProducts = Object.values(allProducts).sort((a,b) => b.count - a.count).slice(0, 3);
  const topGlobalBuyers = Object.values(allBuyers).sort((a,b) => b.spent - a.spent).slice(0, 3);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 9999, padding: '2rem'
    }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--page-bg, #1a1a1a)', border: '1px solid var(--card-border, #333)',
          borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '800px',
          maxHeight: '90vh', overflowY: 'auto', position: 'relative',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)', color: 'var(--text-color, #fff)'
        }}
      >
        <button onClick={onClose} style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent',
          border: 'none', color: 'var(--text-color, #fff)', fontSize: '1.5rem', cursor: 'pointer'
        }}><i className="fas fa-times" />×</button>

        <h2 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green, #20c997)', marginBottom: '1.5rem' }}>
          <i className="fas fa-chart-pie" /> {selectedProduct} Analytics
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)' }}>
            <h4 style={{ color: 'var(--text-color, #fff)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border, #444)', paddingBottom: '0.5rem' }}>Revenue Timeline</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 30 Days:</span> <strong>₹{rev30.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 2 Months:</span> <strong>₹{rev60.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 4 Months:</span> <strong>₹{rev120.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 6 Months:</span> <strong>₹{rev180.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}><span>Past 1 Year:</span> <strong>₹{rev365.toFixed(2)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '2px dashed var(--sea-green, #20c997)' }}>
              <span style={{ color: 'var(--sea-green, #20c997)' }}>Total All Time:</span> <strong style={{ color: 'var(--sea-green, #20c997)' }}>₹{prodTotalRevenue.toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
              <span>Total Units Sold:</span> <strong>{prodTotalCount}</strong>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)', maxHeight: '320px', overflowY: 'auto' }}>
            <h4 style={{ color: 'var(--text-color, #fff)', marginBottom: '1rem', borderBottom: '1px solid var(--card-border, #444)', paddingBottom: '0.5rem' }}>Purchased By</h4>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead><tr><th style={{ paddingBottom: '0.5rem' }}>Buyer</th><th style={{ paddingBottom: '0.5rem' }}>Times</th><th style={{ paddingBottom: '0.5rem', textAlign: 'right' }}>Spent</th></tr></thead>
              <tbody>
                {topPurchasers.length === 0 && <tr><td colSpan={3} style={{ opacity: 0.6, paddingTop: '1rem', textAlign: 'center' }}>No purchasers found</td></tr>}
                {topPurchasers.map((b, i) => (
                  <tr key={i} style={{ borderBottom: i === topPurchasers.length - 1 ? 'none' : '1px solid var(--card-border, #444)' }}>
                    <td style={{ padding: '0.6rem 0' }}>{b.name}</td>
                    <td>{b.count}</td>
                    <td style={{ textAlign: 'right' }}>₹{b.spent.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green, #20c997)', margin: '2rem 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid var(--card-border, #444)' }}>
           Global Top 3 (All Products)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)' }}>
            <h4 style={{ color: '#f39c12', marginBottom: '1rem' }}><i className="fas fa-medal" /> Top Sold Products</h4>
            {topProducts.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', paddingBottom: '0.5rem', borderBottom: i === topProducts.length - 1 ? 'none' : '1px solid var(--card-border, #444)' }}>
                <div>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Sold by: {p.seller}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--sea-green, #20c997)', fontWeight: 'bold' }}>{p.count} units</div>
                  <div style={{ fontSize: '0.85rem' }}>₹{p.rev.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--card-bg, #2a2a2a)', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--card-border, #444)' }}>
            <h4 style={{ color: '#3498db', marginBottom: '1rem' }}><i className="fas fa-crown" /> Top Buyers</h4>
            {topGlobalBuyers.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.8rem', paddingBottom: '0.5rem', borderBottom: i === topGlobalBuyers.length - 1 ? 'none' : '1px solid var(--card-border, #444)' }}>
                <strong>{b.name}</strong>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--sea-green, #20c997)', fontWeight: 'bold' }}>₹{b.spent.toFixed(2)}</div>
                  <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{b.count} orders</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  );
};

const AdminPayments = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [walletRecharges, setWalletRecharges] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
    const [tournamentsList, setTournamentsList] = useState([]);
  
  const [store, setStore] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

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
        setTournamentsList(Array.isArray(payload.tournaments) ? payload.tournaments : []);
      
      setStore(Array.isArray(payload.store) ? payload.store : []);
      
      setPageWallet(1); setPageSubs(1);  setPageStore(1);
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
  
  const totalPageStore = Math.ceil(store.length / itemsPerPage) || 1;

  const walletShown = walletRecharges.slice((pageWallet - 1) * itemsPerPage, pageWallet * itemsPerPage);
  const subsShown = subscriptions.slice((pageSubs - 1) * itemsPerPage, pageSubs * itemsPerPage);
  
  const storeShown = store.slice((pageStore - 1) * itemsPerPage, pageStore * itemsPerPage);

  
  const totalWallet = walletRecharges.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalSubs = subscriptions.reduce((sum, item) => sum + (Number(item.price) || Number(item.amount) || 0), 0);
  const totalStore = store.reduce((sum, item) => sum + (Number(item.price) || Number(item.amount) || 0), 0);
  const totalTournaments = tournamentsList.reduce((sum, item) => sum + (Number(item.totalRevenue) || 0), 0);
  const grandTotal = totalWallet + totalSubs + totalStore + totalTournaments;

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
                        cursor: 'pointer',
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--sea-green)', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-wallet" /> Wallet</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalWallet.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--sky-blue)', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-trophy" /> Tournaments</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalTournaments.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: 'var(--orange)', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-crown" /> Subscriptions</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalSubs.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--card-border)', textAlign: 'center' }}>
              <div style={{ color: '#e74c3c', fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-shopping-cart" /> Store</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>₹{totalStore.toFixed(2)}</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} style={{ background: 'var(--sea-green)', color: 'var(--on-accent)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem', fontFamily: 'Cinzel, serif' }}><i className="fas fa-chart-line" /> Total Platform Revenue</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>₹{grandTotal.toFixed(2)}</div>
            </motion.div>
          </div>


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
                      onClick={() => setSelectedProduct(s.item)}
                      whileHover={{ translateY: -5 }}
                      role="button"
                      tabIndex={0}
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
        {selectedProduct && <StoreAnalyticsModal store={store} selectedProduct={selectedProduct} onClose={() => setSelectedProduct(null)} />}
      </div>
    </div>
  );
};

export default AdminPayments;
