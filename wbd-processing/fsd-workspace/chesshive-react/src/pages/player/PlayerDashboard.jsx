import React, { useEffect, useMemo, useState, useCallback } from 'react';
import '../../styles/playerNeoNoir.css';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications, markNotificationRead } from '../../features/notifications/notificationsSlice';

import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useNavigate, Link } from 'react-router-dom';
import AnimatedSidebar from '../../components/AnimatedSidebar';

function PlayerDashboard() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();

  // UI State
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data state
  const [playerName, setPlayerName] = useState('...');
  const [teamRequests, setTeamRequests] = useState([]);
  const [latestTournaments, setLatestTournaments] = useState([]);
  const [latestItems, setLatestItems] = useState([]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Error state
  const [errorMsg, setErrorMsg] = useState('');

  // Notifications modal state (use Redux)
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dispatch = useDispatch();
  const notificationsState = useSelector((s) => s.notifications || { items: [], loading: false, error: null });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTournamentName, setFeedbackTournamentName] = useState('');
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState('');
  const [feedbackComments, setFeedbackComments] = useState('');

  const styles = useMemo(() => ({
    errorBox: {
      background: '#ffdddd',
      color: '#cc0000',
      padding: '1rem',
      borderRadius: 8,
      marginBottom: '1rem',
      display: errorMsg ? 'block' : 'none'
    }
  }), [errorMsg]);

  // Helpers
  const fetchWithRetry = useCallback(async (url, options = {}, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, { credentials: 'include', ...options });
        if (!res.ok) {
          if (res.status === 401) {
            navigate('/login');
            return null;
          }
          throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
        }
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return res.json();
        return res.text();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
    return null;
  }, [navigate]);

  const loadDashboard = useCallback(async () => {
    setErrorMsg('');
    try {
      const data = await fetchWithRetry('/player/api/dashboard');
      if (!data) return;
      setPlayerName(data.playerName || 'Player');
      setTeamRequests(Array.isArray(data.teamRequests) ? data.teamRequests : []);
      setLatestTournaments(Array.isArray(data.latestTournaments) ? data.latestTournaments : []);
      setLatestItems(Array.isArray(data.latestItems) ? data.latestItems : []);
    } catch (err) {
      setErrorMsg(err.message || 'Unknown error. Check console for details.');
      // Fallback mock for local testing
      const mockData = {
        playerName: 'Test Player',
        teamRequests: [
          {
            id: 'mock1',
            tournamentName: 'Mock Team Battle',
            captainName: 'Captain A',
            player1_name: 'Player1',
            player2_name: 'Test Player',
            player3_name: 'Player3',
            player1_approved: true,
            player2_approved: false,
            player3_approved: false
          }
        ],
        latestTournaments: [
          { name: 'October Online Blitz', date: '2025-10-15' },
          { name: 'Weekly Rapid', date: '2025-10-12' }
        ],
        latestItems: [
          { name: 'Chess Board Set', price: 1500 },
          { name: 'E-Book: Advanced Tactics', price: 299 }
        ]
      };
      setPlayerName(mockData.playerName);
      setTeamRequests(mockData.teamRequests);
      setLatestTournaments(mockData.latestTournaments);
      setLatestItems(mockData.latestItems);
    }
  }, [fetchWithRetry]);

  const approveTeamRequest = async (id) => {
    try {
      const res = await fetchWithRetry('/player/api/approve-team-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id })
      });
      if (!res) return; // handled (e.g., 401)
      alert('Team request approved!');
      loadDashboard();
    } catch (err) {
      alert(`Error approving team request: ${err.message}`);
    }
  };

  const updateUnreadCount = useCallback(() => {
    try {
      const unread = (notificationsState.items || []).filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch (err) {
      setUnreadCount(0);
    }
  }, [notificationsState.items]);

  const loadNotifications = async () => {
    try {
      await dispatch(fetchNotifications());
      setNotificationsOpen(true);
    } catch (err) {
      setNotificationsOpen(true);
    }
  };

  // Keep unread count in sync when notifications in store change
  useEffect(() => {
    updateUnreadCount();
  }, [notificationsState.items, updateUnreadCount]);

  const openFeedbackForm = (notificationId, tournamentName, tournamentId) => {
    setSelectedNotificationId(notificationId);
    setSelectedTournamentId(tournamentId);
    setFeedbackTournamentName(tournamentName);
    setFeedbackOpen(true);
  };

  const submitFeedback = async () => {
    if (!feedbackRating) {
      alert('Rating required');
      return;
    }
    try {
      const res = await fetchWithRetry('/player/api/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId, rating: feedbackRating, comments: feedbackComments })
      });
      if (!res) return;
      alert('Feedback submitted!');
      // mark notification read via Redux thunk
      await dispatch(markNotificationRead(selectedNotificationId));
      closeNotifications();
      // refresh unread count
      await dispatch(fetchNotifications());
    } catch (err) {
      alert('Error submitting feedback');
    }
  };

  const closeNotifications = () => {
    setNotificationsOpen(false);
    setFeedbackOpen(false);
    setSelectedNotificationId(null);
    setSelectedTournamentId(null);
    setFeedbackTournamentName('');
    setFeedbackRating('');
    setFeedbackComments('');
  };

  // Effects
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player_notifications_enabled');
    setNotificationsEnabled(saved === null ? true : saved === 'true');
  }, []);

  useEffect(() => {
    loadDashboard();
    updateUnreadCount();
  }, [loadDashboard, updateUnreadCount]);

  // Player-specific nav links used by AnimatedSidebar
  const playerLinks = [
    { path: '/player/player_profile', label: 'Profile', icon: 'fas fa-user' },
    { path: '/player/growth', label: 'Growth Tracking', icon: 'fas fa-chart-line' },
    { path: '/player/player_tournament', label: 'Tournaments', icon: 'fas fa-trophy' },
    { path: '/player/subscription', label: 'Manage Subscription', icon: 'fas fa-star' },
    { path: '/player/store', label: 'E-Commerce Store', icon: 'fas fa-store' },
    { path: '/player/player_chat', label: 'Live Chat', icon: 'fas fa-comments' },
    { path: '/player/settings', label: 'Settings', icon: 'fas fa-cog' }
  ];

  // Derived
  const pendingTeamRequests = useMemo(() => {
    if (!teamRequests?.length) return [];
    return teamRequests.filter(req => !(
      (req.player1_name === playerName && req.player1_approved) ||
      (req.player2_name === playerName && req.player2_approved) ||
      (req.player3_name === playerName && req.player3_approved)
    ));
  }, [teamRequests, playerName]);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Head styles (scoped) */}
      <style>{`
        /* Theme variables provided by .player-neo when on /player pages */
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        /* Sidebar replaced with site dropdown (AnimatedSidebar) */
        .sidebar { display: none; }
        .sidebar-header { display: none; }
        .nav-section { margin-bottom:1rem; padding:0 1rem; }
        .nav-section-title { color:var(--text-color); font-size:0.9rem; text-transform:uppercase; padding:0.5rem 1rem; opacity:0.7; }
        .sidebar a { display:flex; align-items:center; gap:0.8rem; color:var(--sidebar-text); text-decoration:none; padding:0.8rem 1.5rem; transition:all 0.3s ease; font-family:'Playfair Display', serif; border-radius:5px; margin:0.2rem 0; }
        .sidebar a:hover { background:rgba(var(--sea-green-rgb),0.12); color:var(--text-color); transform: translateX(5px); }
        .sidebar a i { width:20px; text-align:center; }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .updates-section h3 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; display:flex; align-items:center; gap:0.8rem; font-size:1.5rem; }
        .updates-section ul { list-style:none; }
        .updates-section li { padding:1rem; border-bottom:1px solid rgba(46,139,87,0.1); transition:all 0.3s ease; display:flex; align-items:center; gap:1rem; }
        .updates-section li:last-child { border-bottom:none; }
        .updates-section li:hover { background:rgba(135,206,235,0.1); transform: translateX(5px); border-radius:8px; }
        .tournament-info, .item-info { flex-grow:1; }
        .price-tag { background: linear-gradient(90deg, rgba(235,87,87,1), rgba(6,56,80,1)); color: var(--on-accent); padding:0.5rem 1rem; border-radius:20px; font-size:0.9rem; font-weight:600; box-shadow: inset 0 -4px 12px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.08); }
        .date-tag { color:var(--sea-green); font-style: italic; }
        .logout-box { position:absolute; bottom:2rem; width:100%; padding:0 2rem; }
        .logout-box button { width:100%; background: linear-gradient(90deg, var(--sky-blue), var(--sea-green)); color:var(--on-accent); border:none; padding:1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.25s ease; display:flex; align-items:center; justify-content:center; gap:0.5rem; }
        .logout-box button:hover { transform: translateY(-2px); box-shadow:0 8px 24px rgba(6,56,80,0.08); }
        .approve-btn{ padding:0.6rem 1rem; border:none; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.3s ease; display:flex; align-items:center; gap:0.5rem; background-color:var(--sea-green); color:var(--on-accent); }
        .approve-btn.reject{ background:#ff4d4d; }
        .approve-btn.reject:hover{ background:#cc0000; }
        @media (max-width: 768px){
          .sidebar{ width:100%; left:${sidebarOpen ? '0' : '-100%'}; transition:0.3s; }
          .content{ margin-left:0; padding:1rem; }
          .updates-section{ padding:1rem; }
          h1{ font-size:1.8rem; flex-direction:column; text-align:center; gap:0.5rem; }
          .menu-btn{ display:block; position:fixed; left:1rem; top:1rem; background:var(--sea-green); color:var(--on-accent); border:none; padding:0.8rem; border-radius:8px; cursor:pointer; z-index:1001; transition:all 0.3s ease; }
          .menu-btn:hover{ background:#236B43; transform: scale(1.05); }
        }
        .inbox-icon { position:relative; cursor:pointer; margin-left:auto; }
        .inbox-icon .unread-count { position:absolute; top:-5px; right:-5px; background: var(--sea-green); color:var(--on-accent); border-radius:50%; padding:2px 6px; font-size:0.8rem; }
        #notifications-modal { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:${notificationsOpen ? 'flex' : 'none'}; justify-content:center; align-items:center; z-index:1002; }
        .notifications-content { background:var(--card-bg); padding:2rem; border-radius:15px; max-width:500px; width:90%; border:1px solid var(--card-border); box-shadow:none; }
        .notifications-list li { margin-bottom:1rem; padding:1rem; background:rgba(135,206,235,0.1); border-radius:8px; }
        #feedback-form { display:${feedbackOpen ? 'block' : 'none'}; margin-top:1rem; }
        #feedback-form select, #feedback-form textarea{ width:100%; margin-bottom:1rem; }
        #feedback-form button{ background:var(--sea-green); color:var(--on-accent); padding:0.5rem 1rem; border:none; border-radius:8px; cursor:pointer; }
      `}</style>

      <div className="page player-neo">
        {/* Site dropdown sidebar (AnimatedSidebar) */}
        <AnimatedSidebar links={playerLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        {/* Player quick header (moved from sidebar) */}
        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          {notificationsEnabled && (
            <button className="inbox-icon" onClick={loadNotifications} aria-label={`Open notifications (${unreadCount} unread)`}>
              <i className="fas fa-inbox" aria-hidden="true" />
              <span className="unread-count" aria-hidden="true">{unreadCount}</span>
            </button>
          )}
          <div style={{ color: 'var(--sea-green)', fontWeight: '600' }}>Welcome, {playerName}</div>
        </div>

        {/* Content */}
        <div className="content">
          <div style={styles.errorBox}>
            <strong>Error loading data:</strong> <span>{errorMsg}</span>
            {errorMsg && (
              <button className="approve-btn" style={{ marginLeft: '1rem' }} onClick={loadDashboard}>Retry</button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <i className="fas fa-chess-king" />
              Welcome to ChessHive, {playerName}!
            </h1>
            <div />
          </div>

          {/* Team Requests */}
          <div className="updates-section team-requests">
            <h3>Pending Team Tournament Requests</h3>
            <ul>
              {pendingTeamRequests.length === 0 ? (
                <li><i className="fas fa-info-circle" /> No pending team requests.</li>
              ) : (
                pendingTeamRequests.map(req => (
                  <li key={req.id}>
                    <i className="fas fa-users" />
                    <div className="tournament-info">
                      <strong>{req.tournamentName}</strong><br />
                      Captain: {req.captainName} | Team: {req.player1_name}, {req.player2_name}, {req.player3_name}
                    </div>
                    <button className="approve-btn" onClick={() => approveTeamRequest(req.id)}>Approve</button>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Latest Tournaments */}
          <div className="updates-section">
            <h3><i className="fas fa-trophy" /> Latest Tournaments</h3>
            <ul>
              {(!latestTournaments || latestTournaments.length === 0) ? (
                <li><i className="fas fa-info-circle" /> No tournaments available at the moment.</li>
              ) : (
                latestTournaments.map((t, idx) => {
                  const formattedDate = new Date(t.date).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                  });
                  return (
                    <li key={idx}>
                      <i className="fas fa-chess-knight" />
                      <div className="tournament-info">
                        <strong>{t.name}</strong>
                        <div className="date-tag">
                          <i className="fas fa-calendar-alt" /> {formattedDate}
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Quick Actions removed as requested */}

          {/* Latest Store Items */}
          <div className="updates-section">
            <h3><i className="fas fa-shopping-bag" /> Latest Store Items</h3>
            <ul>
              {(!latestItems || latestItems.length === 0) ? (
                <li><i className="fas fa-info-circle" /> No items available at the moment.</li>
              ) : (
                latestItems.map((i, idx) => (
                  <li key={idx}>
                    <i className="fas fa-chess-pawn" />
                    <div className="item-info"><strong>{i.name}</strong></div>
                    <span className="price-tag"><i className="fas fa-tag" /> ₹{i.price}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>



      </div>

      {/* Notifications Modal */}
      <div id="notifications-modal">
        <div className="notifications-content">
          <h3>Notifications</h3>
          <ul id="notifications-list" className="notifications-list">
            {(notificationsState.items || []).length === 0 ? (
              <li>No notifications.</li>
            ) : (
              (notificationsState.items || []).map(n => (
                <li key={n._id}>
                  <strong>Feedback Request:</strong> {n.tournamentName}<br />
                  Date: {n.date ? new Date(n.date).toLocaleDateString() : ''} {' '}
                  {!n.read ? (
                    <button onClick={() => openFeedbackForm(n._id, n.tournamentName, n.tournament_id)}>
                      Provide Feedback
                    </button>
                  ) : (
                    <span>(Read)</span>
                  )}
                </li>
              ))
            )}
          </ul>

          {/* Feedback form */}
          <div id="feedback-form">
            <h4>Submit Feedback for <span id="feedback-tournament-name">{feedbackTournamentName}</span></h4>
            <select id="feedback-rating" value={feedbackRating} onChange={e => setFeedbackRating(e.target.value)}>
              <option value="">Select Rating (1-5)</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
            <textarea id="feedback-comments" placeholder="Comments (optional)" value={feedbackComments} onChange={e => setFeedbackComments(e.target.value)} />
            <button id="submit-feedback-btn" onClick={submitFeedback}>Submit</button>
          </div>

          <button onClick={closeNotifications} style={{ marginTop: '1rem' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default PlayerDashboard;
