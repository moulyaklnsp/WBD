import React, { useEffect, useMemo, useState } from 'react';

// React conversion of views/coordinator/coordinator_dashboard.html

function CoordinatorDashboard() {
  const [name, setName] = useState('Coordinator');
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  const isMobile = width <= 768;

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [nameRes, meetRes] = await Promise.all([
          fetch('/coordinator/api/name', { credentials: 'include' }),
          fetch('/coordinator/api/meetings/upcoming', { credentials: 'include' }),
        ]);
        const nameData = await nameRes.json();
        const meetingsData = await meetRes.json();
        setName(nameData?.name || 'Coordinator');
        setMeetings(Array.isArray(meetingsData) ? meetingsData : []);
      } catch (e) {
        console.error(e);
        setError('Error loading data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!isMobile) setSidebarOpen(true);
    else setSidebarOpen(false);
  }, [isMobile]);

  const styles = {
    root: { display: 'flex', minHeight: '100vh', backgroundColor: '#FFFDD0', fontFamily: 'Playfair Display, serif' },
    sidebar: {
      width: 280,
      backgroundColor: '#2E8B57',
      color: '#fff',
      height: '100vh',
      position: isMobile ? 'fixed' : 'fixed',
      left: isMobile ? (sidebarOpen ? 0 : '-100%') : 0,
      top: 0,
      paddingTop: '1rem',
      zIndex: 1000,
      boxShadow: '4px 0 10px rgba(0,0,0,0.1)',
      transition: 'left 0.3s ease',
    },
    sidebarHeader: { textAlign: 'center', padding: '1rem', borderBottom: '2px solid rgba(255,255,255,0.1)', marginBottom: '1rem' },
    navSection: { marginBottom: '1rem', padding: '0 1rem' },
    navTitle: { color: '#FFFDD0', fontSize: '0.9rem', textTransform: 'uppercase', padding: '0.5rem 1rem', opacity: 0.7 },
    link: { display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', transition: 'all 0.3s ease', borderRadius: 5, margin: '0.2rem 0' },
    content: { flexGrow: 1, marginLeft: isMobile ? 0 : 280, padding: '2rem' },
    h1: { fontFamily: 'Cinzel, serif', color: '#2E8B57', marginBottom: '2rem', fontSize: isMobile ? '1.8rem' : '2.5rem', display: 'flex', alignItems: isMobile ? 'start' : 'center', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' },
    formContainer: { background: 'var(--card-bg)', padding: '2rem', borderRadius: 15, boxShadow: 'none', marginBottom: '2rem', border: '1px solid var(--card-border)' },
    joinLink: { backgroundColor: '#87CEEB', color: '#2E8B57', padding: '0.5rem 1rem', borderRadius: 20, textDecoration: 'none', fontWeight: 'bold', transition: 'all 0.3s ease', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    moreRow: { textAlign: 'center', margin: '1rem 0', display: 'flex', justifyContent: 'center', gap: '1rem' },
    moreBtn: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#87CEEB', color: '#2E8B57', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, transition: 'all 0.3s ease', fontFamily: 'Cinzel, serif', fontWeight: 'bold', cursor: 'pointer', border: 'none' },
    logoutBox: { position: 'absolute', bottom: '2rem', width: '100%', padding: '0 2rem' },
    logoutBtn: { width: '100%', background: '#87CEEB', color: '#2E8B57', border: 'none', padding: '1rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
    menuBtn: { display: isMobile ? 'block' : 'none', position: 'fixed', left: '1rem', top: '1rem', background: '#2E8B57', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: 8, cursor: 'pointer', zIndex: 1001 },
    ul: { listStyle: 'none', paddingLeft: 0, display: 'grid', gap: '0.5rem' },
    li: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid rgba(0,0,0,0.06)' },
    emptyText: { color: '#666' },
  };

  const visibleMeetings = useMemo(() => meetings.slice(0, visibleCount), [meetings, visibleCount]);

  return (
    <div style={styles.root}>
      <button style={styles.menuBtn} onClick={() => setSidebarOpen((v) => !v)} aria-label="Open menu">
        <i className="fas fa-bars" />
      </button>

      <aside style={styles.sidebar} aria-hidden={!sidebarOpen && isMobile}>
        <div style={styles.sidebarHeader}>
          <h2><i className="fas fa-chess" /> ChessHive</h2>
        </div>
          <div style={styles.navSection}>
          <div style={styles.navTitle}>Main Menu</div>
          {/* Keep server routes for now to avoid SPA 404s for pages not yet migrated */}
          <a href="/coordinator/coordinator_profile" style={styles.link}><i className="fas fa-user" /> Profile</a>
          <a href="/coordinator/tournament_management" style={styles.link}><i className="fas fa-trophy" /> Tournaments</a>
          <a href="/coordinator/player_stats" style={styles.link}><i className="fas fa-chess" /> Player Stats</a>
          <a href="/coordinator/store_management" style={styles.link}><i className="fas fa-store" /> Store</a>
          <a href="/coordinator/coordinator_meetings" style={styles.link}><i className="fas fa-calendar" /> Meetings</a>
          <a href="/coordinator/coordinator_chat" style={styles.link}><i className="fas fa-comments" /> Live Chat</a>
        </div>
        <div style={styles.logoutBox}>
          <button style={styles.logoutBtn} onClick={() => { window.location.href = '/login'; }}>
            <i className="fas fa-sign-out-alt" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main style={styles.content}>
        <h1>
          Welcome, <span>{name}</span>!
        </h1>

        <section style={styles.formContainer}>
          <h2 style={{ fontFamily: 'Cinzel, serif', marginBottom: '1rem', color: '#2E8B57' }}>Upcoming Meetings (Next 3 Days)</h2>

          {loading ? (
            <p>Loading…</p>
          ) : error ? (
            <p style={{ color: 'crimson' }}>{error}</p>
          ) : meetings.length === 0 ? (
            <p style={styles.emptyText}>No upcoming meetings.</p>
          ) : (
            <>
              <ul style={styles.ul}>
                {visibleMeetings.map((m, idx) => (
                  <li key={`${m.title}-${m.date}-${idx}`} style={styles.li}>
                    <span>
                      <strong>{m.title}</strong> — {new Date(m.date).toLocaleDateString()} at {m.time}
                    </span>
                    <a href={m.link} target="_blank" rel="noreferrer" style={styles.joinLink}>
                      <i className="fas fa-video" /> Join
                    </a>
                  </li>
                ))}
              </ul>

              {meetings.length > 5 ? (
                <div style={styles.moreRow}>
                  {visibleCount < meetings.length ? (
                    <button type="button" style={styles.moreBtn} onClick={() => setVisibleCount((c) => Math.min(c + 5, meetings.length))}>
                      <i className="fas fa-chevron-down" /> More
                    </button>
                  ) : null}
                  {visibleCount > 5 ? (
                    <button type="button" style={styles.moreBtn} onClick={() => setVisibleCount((c) => Math.max(5, c - 5))}>
                      <i className="fas fa-chevron-up" /> Hide
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default CoordinatorDashboard;
