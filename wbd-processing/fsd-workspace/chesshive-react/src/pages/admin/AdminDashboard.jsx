import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [adminName, setAdminName] = useState('Admin');
  const [messages, setMessages] = useState([]);
  const [visibleRows, setVisibleRows] = useState(10);
  const rowsPerPage = 10;

  const onResize = useCallback(() => {
    const mobile = window.innerWidth <= 768;
    setIsMobile(mobile);
    if (!mobile) setSidebarOpen(true);
  }, []);

  useEffect(() => {
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onResize]);

  useEffect(() => {
    // Open sidebar by default on desktop
    if (!isMobile) setSidebarOpen(true);
  }, [isMobile]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/admin/api/dashboard', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAdminName(data?.adminName || 'Admin');
      setMessages(Array.isArray(data?.contactMessages) ? data.contactMessages : []);
      setVisibleRows(10);
    } catch (e) {
      // Fail silently but keep basic UI responsive
      // Optionally, could set an error banner
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const canNext = useMemo(() => visibleRows < messages.length, [visibleRows, messages.length]);
  const canPrev = useMemo(() => visibleRows > rowsPerPage, [visibleRows]);

  const styles = {
    page: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', display: 'flex' },
    sidebar: (open) => ({
      width: 280, backgroundColor: '#2E8B57', color: '#fff', height: '100vh', position: 'fixed', left: open ? 0 : -280,
      top: 0, paddingTop: '1rem', zIndex: 1000, boxShadow: '4px 0 10px rgba(0,0,0,0.1)', transition: 'left .3s ease'
    }),
    sidebarHeader: { textAlign: 'center', padding: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', marginBottom: '1rem' },
    navSection: { marginBottom: '1rem', padding: '0 1rem' },
    navTitle: { color: '#FFFDD0', fontSize: '.9rem', textTransform: 'uppercase', padding: '.5rem 1rem', opacity: .7 },
    navItem: { display: 'flex', alignItems: 'center', gap: '.8rem', color: '#fff', textDecoration: 'none', padding: '.8rem 1.5rem', transition: 'all .3s ease', fontFamily: 'Playfair Display, serif', borderRadius: 5, margin: '.2rem 0' },
    navItemHover: { background: 'rgba(135,206,235,0.2)', color: '#FFFDD0', transform: 'translateX(5px)' },
    content: { flexGrow: 1, marginLeft: 280, padding: '2rem' },
    h1: { fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '2rem', fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
    menuBtn: { display: isMobile ? 'block' : 'none', position: 'fixed', left: '1rem', top: '1rem', background: '#2E8B57', color: '#fff', border: 'none', padding: '.8rem', borderRadius: 8, cursor: 'pointer', zIndex: 1001, transition: 'all .3s ease' },
    formContainer: { background: 'var(--card-bg)', padding: '2rem', borderRadius: 15, boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    row: { marginBottom: '1rem', padding: '1rem', borderBottom: '1px solid rgba(46,139,87,0.2)' },
    rowCounter: { textAlign: 'center', marginBottom: '1rem', fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#2E8B57', backgroundColor: 'rgba(46,139,87,0.1)', padding: '.5rem 1rem', borderRadius: 8, display: 'inline-block' },
    pager: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    pageBtn: { display: 'inline-flex', alignItems: 'center', gap: '.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '.8rem 1.5rem', borderRadius: 8, transition: 'all .3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer' },
    logoutBox: { position: 'absolute', bottom: '2rem', width: '100%', padding: '0 2rem' },
    logoutBtn: { width: '100%', background: '#87CEEB', color: '#2E8B57', border: 'none', padding: '1rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', transition: 'all .3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' },
  };

  const handleLogout = () => navigate('/login');

  const visibleMessages = useMemo(() => messages.slice(0, Math.min(visibleRows, messages.length)), [messages, visibleRows]);

  return (
    <div style={styles.page}>
      <button style={styles.menuBtn} onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle Menu">
        <i className="fas fa-bars" />
      </button>

      <aside style={styles.sidebar(sidebarOpen)}>
        <div style={styles.sidebarHeader}>
          <h2><i className="fas fa-chess" /> ChessHive</h2>
          <p>{`Welcome, ${adminName}!`}</p>
        </div>

        <div style={styles.navSection}>
          <div style={styles.navTitle}>Main Menu</div>
          <Link to="/admin/organizer_management" style={styles.navItem}><i className="fas fa-users-cog" /> Manage Organizers</Link>
          <Link to="/admin/coordinator_management" style={styles.navItem}><i className="fas fa-user-tie" /> Manage Coordinators</Link>
          <Link to="/admin/player_management" style={styles.navItem}><i className="fas fa-user-tie" /> Manage Players</Link>
          <Link to="/admin/admin_tournament_management" style={styles.navItem}><i className="fas fa-trophy" /> Tournament Approvals</Link>
          <Link to="/admin/payments" style={styles.navItem}><i className="fas fa-money-bill-wave" /> Payments &amp; Subscriptions</Link>
        </div>

        <div style={styles.logoutBox}>
          <button type="button" style={styles.logoutBtn} onClick={handleLogout}>
            <i className="fas fa-sign-out-alt" /> <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main style={{ ...styles.content, marginLeft: isMobile ? 0 : 280 }}>
        <h1 style={styles.h1}>Welcome, {adminName}!</h1>

        <div style={styles.formContainer}>
          <h2 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '1rem' }}>Contact Messages</h2>
          <div style={{ textAlign: 'center' }}>
            <span style={styles.rowCounter}>{`${Math.min(visibleRows, messages.length)}/10`}</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {visibleMessages.length === 0 ? (
              <li style={styles.row}>No messages.</li>
            ) : (
              visibleMessages.map((m, idx) => (
                <li key={idx} style={styles.row}>
                  <strong style={{ color: '#2E8B57', backgroundColor: 'rgba(135,206,235,0.2)', padding: '.2rem .5rem', borderRadius: 4 }}>Name:</strong>{' '}
                  <span style={{ color: '#236B43', backgroundColor: '#87CEEB', padding: '.3rem .6rem', borderRadius: 4, fontWeight: 'bold', fontFamily: 'Cinzel, serif' }} className="person-name">{m.name}</span>
                  <br />
                  <strong style={{ color: '#2E8B57', backgroundColor: 'rgba(46,139,87,0.1)', padding: '.2rem .5rem', borderRadius: 4 }}>Message:</strong>{' '}
                  <span>{m.message}</span>
                </li>
              ))
            )}
          </ul>

          <div style={styles.pager}>
            {canNext && (
              <button type="button" style={styles.pageBtn} onClick={() => setVisibleRows((v) => v + rowsPerPage)}>
                <i className="fas fa-chevron-right" /> Next
              </button>
            )}
            {canPrev && (
              <button type="button" style={styles.pageBtn} onClick={() => setVisibleRows((v) => Math.max(rowsPerPage, v - rowsPerPage))}>
                <i className="fas fa-chevron-left" /> Previous
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
