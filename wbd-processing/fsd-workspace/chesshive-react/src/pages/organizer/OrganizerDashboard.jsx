import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// React conversion of views/organizer/organizer_dashboard.html

const PAGE_SIZE = 5;

function OrganizerDashboard() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  const [organizerName, setOrganizerName] = useState('Organizer');
  const [meetings, setMeetings] = useState([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/organizer/api/dashboard', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
      setOrganizerName(data.organizerName || 'Organizer');
      setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
      setVisible(PAGE_SIZE);
    } catch (e) {
      console.error('Dashboard load error:', e);
      setError('Error loading dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const showMeetings = useMemo(() => meetings.slice(0, visible), [meetings, visible]);

  const handleLogout = () => navigate('/login');

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', display: 'flex' },
    sidebar: (open) => ({
      width: 280,
      backgroundColor: '#2E8B57',
      color: '#fff',
      height: '100vh',
      position: 'fixed',
      left: isMobile ? (open ? 0 : -280) : 0,
      top: 0,
      paddingTop: '1rem',
      zIndex: 1000,
      boxShadow: '4px 0 10px rgba(0,0,0,0.1)',
      transition: 'left 0.3s ease'
    }),
    sidebarHeader: { textAlign: 'center', padding: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', marginBottom: '1rem' },
    navTitle: { color: '#FFFDD0', fontSize: '0.9rem', textTransform: 'uppercase', padding: '0.5rem 1rem', opacity: 0.7 },
    navLink: { display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', transition: 'all 0.3s ease', borderRadius: 5, margin: '0.2rem 0' },
    navLinkHover: { background: 'rgba(135,206,235,0.2)', color: '#FFFDD0', transform: 'translateX(5px)' },
    content: { flexGrow: 1, marginLeft: isMobile ? 0 : 280, padding: '2rem', width: '100%' },
    h1: { fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '2rem', fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' },
    logoutBox: { position: 'absolute', bottom: '2rem', width: '100%', padding: '0 2rem' },
    logoutBtn: { width: '100%', background: '#87CEEB', color: '#2E8B57', border: 'none', padding: '1rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
    menuBtn: { display: isMobile ? 'block' : 'none', position: 'fixed', left: 16, top: 16, background: '#2E8B57', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: 8, cursor: 'pointer', zIndex: 1100 },
    card: { background: 'var(--card-bg)', padding: '2rem', borderRadius: 15, boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    list: { listStyle: 'none', padding: 0, margin: 0 },
    listItem: { padding: '0.6rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' },
    join: { backgroundColor: '#87CEEB', color: '#2E8B57', padding: '0.5rem 1rem', borderRadius: 20, textDecoration: 'none', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    moreWrap: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    msg: { color: '#c62828' }
  };

  return (
    <div style={styles.root}>
      <button style={styles.menuBtn} onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle menu">
        <i className="fas fa-bars" aria-hidden="true"></i>
      </button>

      <aside style={styles.sidebar(isMobile ? sidebarOpen : true)}>
        <div style={styles.sidebarHeader}>
          <h2 style={{ margin: 0 }}><i className="fas fa-chess" aria-hidden="true"></i> ChessHive</h2>
        </div>
        <div style={{ padding: '0 1rem', marginBottom: '1rem' }}>
          <div style={styles.navTitle}>Main Menu</div>
          <Link to="/organizer/organizer_profile" style={styles.navLink}><i className="fas fa-user" aria-hidden="true"></i> Profile Page</Link>
          <Link to="/organizer/coordinator_management" style={styles.navLink}><i className="fas fa-users-cog" aria-hidden="true"></i> Manage Coordinators</Link>
          <Link to="/organizer/organizer_tournament" style={styles.navLink}><i className="fas fa-trophy" aria-hidden="true"></i> Tournament Oversight</Link>
          <Link to="/organizer/college_stats" style={styles.navLink}><i className="fas fa-chart-bar" aria-hidden="true"></i> College Performance Stats</Link>
          <Link to="/organizer/store_monitoring" style={styles.navLink}><i className="fas fa-store" aria-hidden="true"></i> Store Monitoring</Link>
          <Link to="/organizer/meetings" style={styles.navLink}><i className="fas fa-calendar-alt" aria-hidden="true"></i> Schedule Meetings</Link>
        </div>
        <div style={styles.logoutBox}>
          <button style={styles.logoutBtn} onClick={handleLogout}>
            <i className="fas fa-sign-out-alt" aria-hidden="true"></i>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main style={styles.content}>
        <h1 style={styles.h1}>Welcome, <span>{organizerName}</span>!</h1>

        <div style={styles.card}>
          <h2 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', marginTop: 0 }}>Upcoming Meetings (Next 3 Days)</h2>
          {loading && <div>Loading…</div>}
          {!loading && !!error && <div style={styles.msg}>{error}</div>}
          {!loading && !error && (
            <>
              {showMeetings.length === 0 ? (
                <p>No upcoming meetings.</p>
              ) : (
                <ul style={styles.list}>
                  {showMeetings.map((m, idx) => (
                    <li key={(m._id || m.title || idx) + ''} style={styles.listItem}>
                      <div>
                        <strong>{m.title}</strong> — {m.date ? new Date(m.date).toLocaleDateString() : ''} at {m.time}
                      </div>
                      {m.link && (
                        <a href={m.link} target="_blank" rel="noreferrer" style={styles.join}>
                          <i className="fas fa-video" aria-hidden="true"></i> Join
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div style={styles.moreWrap}>
                {visible < meetings.length && (
                  <button style={styles.moreBtn} onClick={() => setVisible((v) => Math.min(v + PAGE_SIZE, meetings.length))}>
                    <i className="fas fa-chevron-down" aria-hidden="true"></i> More
                  </button>
                )}
                {visible > PAGE_SIZE && (
                  <button style={styles.moreBtn} onClick={() => setVisible(PAGE_SIZE)}>
                    <i className="fas fa-chevron-up" aria-hidden="true"></i> Hide
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default OrganizerDashboard;
