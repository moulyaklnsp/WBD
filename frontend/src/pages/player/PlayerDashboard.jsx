import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchNotifications, markNotificationRead } from '../../features/notifications/notificationsSlice';
import { motion, AnimatePresence } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useNavigate } from 'react-router-dom';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { getOrCreateSharedSocket } from '../../utils/socket';


/* ─── Background icon map for sidebar hover animations ─── */
const FEATURE_BG = {
  'Profile': { icon: 'fa-user-circle', color: '#1b5e3f' },
  'Growth Tracking': { icon: 'fa-chart-line', color: '#0e7a4b' },
  'Wallet': { icon: 'fa-wallet', color: '#1565c0' },
  'Tournaments': { icon: 'fa-trophy', color: '#b8860b' },
  'Watch': { icon: 'fa-play-circle', color: '#1565c0' },
  'Manage Subscription': { icon: 'fa-crown', color: '#c6930a' },
  'E-Commerce Store': { icon: 'fa-shopping-cart', color: '#7b1fa2' },
  'Live Chat': { icon: 'fa-comments', color: '#00838f' },
  'Settings': { icon: 'fa-cogs', color: '#37474f' },
};

/* ─── Animation variants ─── */
const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  })
};

const listVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.12 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }
};

function PlayerDashboard() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();

  // UI State
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [hoveredFeature, setHoveredFeature] = useState(null);

  // Data state
  const [playerName, setPlayerName] = useState('...');
  const [teamRequests, setTeamRequests] = useState([]);
  const [latestTournaments, setLatestTournaments] = useState([]);
  const [latestItems, setLatestItems] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // News & Updates
  const [news, setNews] = useState({ updates: [], events: [] });
  const [wallpaper, setWallpaper] = useState('default');

  // Live Announcements
  const [liveAnnouncement, setLiveAnnouncement] = useState(null);

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
  const [notifTab, setNotifTab] = useState('messages');
  const [chatMessages, setChatMessages] = useState([]);

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

  // ─── Helpers ────────────────────────────────────────────
  const fetchWithRetry = useCallback(async (url, options = {}, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, { credentials: 'include', ...options });
        if (!res.ok) {
          if (res.status === 401) { navigate('/login'); return null; }
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
      const dash = await fetchWithRetry('/player/api/dashboard');
      if (!dash) return;
      setPlayerName(dash.playerName || 'Player');
      setTeamRequests(Array.isArray(dash.teamRequests) ? dash.teamRequests : []);
      setLatestTournaments(Array.isArray(dash.latestTournaments) ? dash.latestTournaments : []);
      setLatestItems(Array.isArray(dash.latestItems) ? dash.latestItems : []);
    } catch (err) {
      setErrorMsg(err.message || 'Unknown error. Check console for details.');
      const mockData = {
        playerName: 'Test Player',
        teamRequests: [
          {
            id: 'mock1', tournamentName: 'Mock Team Battle', captainName: 'Captain A',
            player1_name: 'Player1', player2_name: 'Test Player', player3_name: 'Player3',
            player1_approved: true, player2_approved: false, player3_approved: false
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
      if (!res) return;
      alert('Team request approved!');
      loadDashboard();
    } catch (err) {
      alert(`Error approving team request: ${err.message}`);
    }
  };

  const rejectTeamRequest = async (id) => {
    if (!window.confirm("Are you sure you want to reject this team request? This will cancel the team registration.")) return;
    try {
      const res = await fetchWithRetry('/player/api/reject-team-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id })
      });
      if (!res) return;
      alert('Team request rejected!');
      loadDashboard();
    } catch (err) {
      alert(`Error rejecting team request: ${err.message}`);
    }
  };

  const cancelTeamRequest = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this team request? Your entry fee will be refunded.")) return;
    try {
      const res = await fetchWithRetry('/player/api/cancel-team-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id })
      });
      if (!res) return;
      alert('Team request cancelled!');
      loadDashboard();
    } catch (err) {
      alert(`Error cancelling team request: ${err.message}`);
    }
  };

  const updateUnreadCount = useCallback(() => {
    try {
      const unread = (notificationsState.items || []).filter(n => !n.read).length;
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  }, [notificationsState.items]);

  const loadNotifications = async () => {
    try {
      await dispatch(fetchNotifications());
    } catch { /* ignore */ }
    // Fetch unread chat messages
    try {
      const res = await fetch('/player/api/chat/unread-messages', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    setNotificationsOpen(true);
  };

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
    if (!feedbackRating) { alert('Rating required'); return; }
    try {
      const res = await fetchWithRetry('/player/api/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: selectedTournamentId, rating: feedbackRating, comments: feedbackComments })
      });
      if (!res) return;
      alert('Feedback submitted!');
      await dispatch(markNotificationRead(selectedNotificationId));
      closeNotifications();
      await dispatch(fetchNotifications());
    } catch {
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

  // ─── Effects ────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('player_notifications_enabled');
    setNotificationsEnabled(saved === null ? true : saved === 'true');
  }, []);

  const fetchLiveStreams = useCallback(async () => {
    try {
      const res = await fetch('/player/api/streams', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLiveStreams(Array.isArray(data) ? data.filter(s => s.isLive) : []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadDashboard();
    updateUnreadCount();
    fetchLiveStreams();
    // Poll live streams every 30s
    const streamInterval = setInterval(fetchLiveStreams, 30000);
    (async () => {
      try {
        const res = await fetch('/player/api/news', { credentials: 'include' });
        if (res.ok) {
          const d = await res.json();
          setNews({ updates: d.updates || [], events: d.events || [] });
        }
      } catch { /* ignore */ }
    })();
    const savedWp = localStorage.getItem('player_wallpaper');
    if (savedWp) setWallpaper(savedWp);
    return () => clearInterval(streamInterval);
  }, [loadDashboard, updateUnreadCount, fetchLiveStreams]);

  // ─── Socket listener for live announcements ────────────
  useEffect(() => {
    const socket = getOrCreateSharedSocket();
    if (!socket) return;

    const handleAnnouncement = (announcement) => {
      if (
        announcement &&
        (announcement.target_role === 'all' || announcement.target_role === 'player')
      ) {
        setLiveAnnouncement(announcement);
      }
    };

    socket.on('liveAnnouncement', handleAnnouncement);
    return () => {
      socket.off('liveAnnouncement', handleAnnouncement);
    };
  }, []);

  // Fetch most recent active announcement on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/player/api/announcements', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
            const latest = data.find(a => !dismissed.includes(a._id));
            if (latest) setLiveAnnouncement(latest);
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const dismissAnnouncement = useCallback(() => {
    if (liveAnnouncement?._id) {
      const dismissed = JSON.parse(localStorage.getItem('dismissed_announcements') || '[]');
      dismissed.push(liveAnnouncement._id);
      localStorage.setItem('dismissed_announcements', JSON.stringify(dismissed.slice(-50)));
    }
    setLiveAnnouncement(null);
  }, [liveAnnouncement]);

  // ─── Nav links for AnimatedSidebar ──────────────────────
  const playerLinks = [
    { path: '/player/player_profile', label: 'Profile', icon: 'fas fa-user' },
    { path: '/player/growth', label: 'Growth Tracking', icon: 'fas fa-chart-line' },
    { path: '/player/wallet', label: 'Wallet', icon: 'fas fa-wallet' },
    { path: '/player/player_tournament', label: 'Tournaments', icon: 'fas fa-trophy' },
    { path: '/player/watch', label: 'Watch', icon: 'fas fa-video' },
    { path: '/player/subscription', label: 'Manage Subscription', icon: 'fas fa-star' },
    { path: '/player/store', label: 'E-Commerce Store', icon: 'fas fa-store' },
    { path: '/player/player_chat', label: 'Live Chat', icon: 'fas fa-comments' },
    { path: '/player/settings', label: 'Settings', icon: 'fas fa-cog' }
  ];

  // ─── Derived ────────────────────────────────────────────
  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good Morning';
    if (hr < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const wallpaperStyle = useMemo(() => {
    if (wallpaper === 'custom') {
      const url = localStorage.getItem('player_wallpaper_url');
      if (url) {
        return {
          backgroundImage: `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        };
      }
    }
    return {};
  }, [wallpaper]);

  const hasCustomWallpaper = wallpaper === 'custom' && !!localStorage.getItem('player_wallpaper_url');

  const displayTeamRequests = useMemo(() => {
    if (!teamRequests?.length) return [];
    return teamRequests.map(req => {
      const actualStatus = req.status || (req.approved === 1 ? 'approved' : req.approved === -1 ? 'rejected' : 'pending');
      const needsMyApproval = actualStatus === 'pending' && !(
        (req.player1_name === playerName && req.player1_approved) ||
        (req.player2_name === playerName && req.player2_approved) ||
        (req.player3_name === playerName && req.player3_approved) ||
        req.captain_name === playerName
      );
      const isCaptain = req.captain_name === playerName;

      let displayStatus = actualStatus.toUpperCase();
      let isExpired = false;

      if (req.tournamentDate && actualStatus === 'pending') {
        const tDate = new Date(req.tournamentDate);
        if (req.tournamentTime && req.tournamentTime.includes(':')) {
           const [h, m] = req.tournamentTime.split(':');
           tDate.setHours(h, m, 0, 0);
        }
        if (tDate.getTime() < Date.now()) {
           isExpired = true;
           displayStatus = 'EXPIRED';
        }
      }

      if (!isExpired && actualStatus === 'pending') {
         const approvedBy = [];
         const waitingFor = [];
         if (req.player1_approved) approvedBy.push(req.player1_name); else waitingFor.push(req.player1_name);
         if (req.player2_approved) approvedBy.push(req.player2_name); else waitingFor.push(req.player2_name);
         if (req.player3_approved) approvedBy.push(req.player3_name); else waitingFor.push(req.player3_name);
         
         displayStatus = `WAITING FOR APPROVAL (Approved by: ${approvedBy.join(', ')} | Waiting for: ${waitingFor.join(', ')})`;
      } else if (actualStatus === 'approved') {
         displayStatus = 'JOINED';
      }

      return { ...req, needsMyApproval, isCaptain, status: actualStatus, displayStatus, isExpired };
    });
  }, [teamRequests, playerName]);

  // ─── Render ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .sidebar { display: none; }
        .content { flex-grow:1; margin-left:0; padding:2rem; position:relative; z-index:1; }

        /* ── Single greeting ── */
        .dash-greeting {
          font-family:'Cinzel', serif;
          color:var(--sea-green);
          margin-bottom:1.5rem;
          font-size:2.2rem;
          display:flex;
          align-items:center;
          gap:1rem;
        }

        /* ── Folder / Card Grid Layout ── */
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-top: 1.5rem;
        }
        .dashboard-grid .full-width {
          grid-column: 1 / -1;
        }
        .folder-card {
          position: relative;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 0 15px 15px 15px;
          padding: 1.5rem;
          padding-top: 1.2rem;
          margin-top: 1.8rem;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .folder-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.1);
        }
        .folder-tab {
          position: absolute;
          top: -30px;
          left: 0;
          background: var(--sea-green);
          color: var(--on-accent);
          border-radius: 10px 10px 0 0;
          padding: 0.4rem 1.2rem;
          font-family: 'Cinzel', serif;
          font-weight: bold;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
        }
        .folder-card ul { list-style: none; }
        .folder-card li {
          padding: 0.8rem;
          border-bottom: 1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.1);
          display: flex;
          align-items: center;
          gap: 0.8rem;
          transition: all 0.2s ease;
        }
        .folder-card li:last-child { border-bottom: none; }
        .folder-card li:hover {
          background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.06);
          border-radius: 8px;
        }

        /* ── Store Items Product Cards ── */
        .store-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 1rem;
        }
        .store-card {
          background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.04);
          border: 1px solid var(--card-border);
          border-radius: 12px;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          cursor: pointer;
        }
        .store-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        .store-card-img {
          width: 100%;
          height: 130px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.06);
          overflow: hidden;
        }
        .store-card-img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .store-card-body {
          padding: 0.75rem;
        }
        .store-card-name {
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 0.4rem;
        }

        /* ── News-style Sections (Updates & Events) ── */
        .news-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .news-section {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: 15px;
          overflow: hidden;
          transition: transform 0.3s ease;
        }
        .news-section:hover {
          transform: translateY(-3px);
        }
        .news-header {
          background: var(--sea-green);
          color: var(--on-accent);
          padding: 0.8rem 1.2rem;
          font-family: 'Cinzel', serif;
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 1.05rem;
        }
        .news-header.events-header {
          background: linear-gradient(90deg, #1565c0, #0d47a1);
        }
        .news-body {
          padding: 0.5rem;
          max-height: 380px;
          overflow-y: auto;
        }
        .news-item {
          padding: 0.8rem;
          border-bottom: 1px solid var(--card-border);
          transition: background 0.2s;
        }
        .news-item:last-child { border-bottom: none; }
        .news-item:hover {
          background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.06);
        }
        .news-headline {
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        .news-date {
          font-size: 0.8rem;
          color: var(--sea-green);
          font-style: italic;
        }
        .news-desc {
          font-size: 0.85rem;
          opacity: 0.8;
          margin-top: 0.3rem;
        }
        .event-item {
          display: flex;
          gap: 0.8rem;
          align-items: flex-start;
        }
        .event-date-badge {
          background: linear-gradient(135deg, #1565c0, #0d47a1);
          color: #fff;
          padding: 0.35rem 0.6rem;
          border-radius: 8px;
          font-size: 0.75rem;
          font-weight: bold;
          min-width: 58px;
          text-align: center;
          font-family: 'Cinzel', serif;
          flex-shrink: 0;
        }

        /* ── Shared / Existing ── */
        .tournament-info, .item-info { flex-grow:1; }
        .price-tag {
          background: linear-gradient(90deg, rgba(235,87,87,1), rgba(6,56,80,1));
          color: var(--on-accent);
          padding:0.4rem 0.8rem;
          border-radius:20px;
          font-size:0.85rem;
          font-weight:600;
        }
        .date-tag { color:var(--sea-green); font-style: italic; font-size: 0.85rem; }
        .approve-btn {
          padding:0.5rem 0.8rem;
          border:none;
          border-radius:8px;
          cursor:pointer;
          font-family:'Cinzel', serif;
          font-weight:bold;
          background-color:var(--sea-green);
          color:var(--on-accent);
          transition: all 0.2s;
          display:flex; align-items:center; gap:0.4rem;
        }
        .approve-btn:hover { filter: brightness(1.15); }
        .inbox-icon {
          position:relative; cursor:pointer; background:none; border:none;
          color:var(--text-color); font-size:1.2rem;
        }
        .inbox-icon .unread-count {
          position:absolute; top:-5px; right:-5px;
          background: var(--sea-green); color:var(--on-accent);
          border-radius:50%; padding:2px 6px; font-size:0.7rem;
        }

        /* ── Notifications Modal ── */
        #notifications-modal {
          position:fixed; top:0; left:0; width:100%; height:100%;
          background:rgba(0,0,0,0.5);
          display:${notificationsOpen ? 'flex' : 'none'};
          justify-content:center; align-items:center; z-index:1002;
        }
        .notifications-content {
          background:var(--card-bg); padding:2rem; border-radius:15px;
          max-width:500px; width:90%; border:1px solid var(--card-border);
        }
        .notifications-list { list-style: none; }
        .notifications-list li {
          margin-bottom:1rem; padding:1rem;
          background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.08);
          border-radius:8px;
        }
        #feedback-form { display:${feedbackOpen ? 'block' : 'none'}; margin-top:1rem; }
        #feedback-form select, #feedback-form textarea {
          width:100%; margin-bottom:1rem; padding:0.5rem;
          border-radius:8px; border:1px solid var(--card-border);
          background:var(--card-bg); color:var(--text-color);
        }
        #feedback-form button {
          background:var(--sea-green); color:var(--on-accent);
          padding:0.5rem 1rem; border:none; border-radius:8px; cursor:pointer;
        }

        /* ── Notification Tabs ── */
        .notif-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 1rem;
          border-bottom: 2px solid var(--card-border);
        }
        .notif-tab {
          flex: 1;
          padding: 0.7rem 1rem;
          background: none;
          border: none;
          color: var(--text-color);
          font-family: 'Cinzel', serif;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          opacity: 0.5;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
        }
        .notif-tab.active {
          opacity: 1;
          border-bottom-color: var(--sea-green);
          color: var(--sea-green);
        }
        .notif-tab:hover { opacity: 0.8; }
        .notif-tab-badge {
          background: #e53935;
          color: #fff;
          font-size: 0.65rem;
          padding: 1px 6px;
          border-radius: 10px;
          font-family: sans-serif;
        }
        .notif-close-btn {
          background: none;
          border: none;
          color: var(--text-color);
          font-size: 1.2rem;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .notif-close-btn:hover { opacity: 1; }
        .notif-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 2rem 1rem;
          opacity: 0.6;
          text-align: center;
        }
        .notif-msg-item {
          display: flex !important;
          align-items: flex-start;
          gap: 0.8rem;
        }
        .notif-msg-avatar {
          font-size: 1.8rem;
          color: var(--sea-green);
          flex-shrink: 0;
          margin-top: 0.1rem;
        }
        .notif-msg-body { flex: 1; }
        .notif-msg-body p {
          margin: 0.2rem 0;
          font-size: 0.9rem;
          opacity: 0.85;
        }
        .notif-msg-time {
          font-size: 0.75rem;
          opacity: 0.5;
          font-style: italic;
        }

        /* ── Feature hover bg animation (above backdrop) ── */
        .feature-bg-anim {
          position: fixed;
          top: 35%;
          left: 55%;
          transform: translate(-50%, -50%);
          font-size: 18rem;
          z-index: 2050;
          pointer-events: none;
        }
        .feature-bg-anim i {
          filter: none;
        }

        /* ── Banner with shining tilted king ── */
        .banner-wrap {
          position: relative;
          overflow: visible;
          padding: 1.5rem 0 1rem;
        }
        .king-coin {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .king-tilted {
          font-size: 2.6rem;
          color: var(--sea-green);
          transform: rotate(-15deg);
          animation: kingShine 2.5s ease-in-out infinite;
        }
        @keyframes kingShine {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(46, 139, 87, 0.4))
                    drop-shadow(0 0 20px rgba(46, 139, 87, 0.2));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(46, 139, 87, 0.8))
                    drop-shadow(0 0 40px rgba(46, 139, 87, 0.5))
                    drop-shadow(0 0 60px rgba(255, 215, 0, 0.25));
          }
        }

        /* ── Live stream card ── */
        .live-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: #e53935;
          color: #fff;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .live-badge-dot {
          width: 6px;
          height: 6px;
          background: #fff;
          border-radius: 50%;
          animation: livePulse 1.4s ease-in-out infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        .stream-item {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          padding: 0.8rem;
          border-bottom: 1px solid var(--card-border);
          transition: background 0.2s;
        }
        .stream-item:last-child { border-bottom: none; }
        .stream-item:hover { background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.06); }
        .stream-info { flex: 1; }
        .stream-title { font-weight: 600; margin-bottom: 0.2rem; }
        .stream-meta { font-size: 0.8rem; opacity: 0.7; }
        .watch-btn {
          background: var(--sea-green);
          color: var(--on-accent);
          border: none;
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          cursor: pointer;
          font-family: 'Cinzel', serif;
          font-weight: bold;
          font-size: 0.8rem;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }
        .watch-btn:hover { filter: brightness(1.15); }
        .no-streams {
          padding: 2rem 1rem;
          text-align: center;
          opacity: 0.6;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
        }
        .no-streams i { font-size: 2rem; opacity: 0.4; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .content { padding: 1rem; }
          .dash-greeting { font-size: 1.5rem; flex-direction: column; text-align: center; gap: 0.5rem; }
          .dashboard-grid { grid-template-columns: 1fr; }
          .news-grid { grid-template-columns: 1fr; }
          .store-grid { grid-template-columns: repeat(2, 1fr); }
          .feature-bg-anim { font-size: 12rem; left: 50%; }
          .king-tilted { font-size: 1.8rem; }
        }
        ${hasCustomWallpaper ? `
          .folder-card { background: rgba(0,0,0,0.45) !important; border-color: rgba(255,255,255,0.12) !important; backdrop-filter: blur(6px); }
          .news-section { background: rgba(0,0,0,0.45) !important; border-color: rgba(255,255,255,0.12) !important; backdrop-filter: blur(6px); }
          .team-requests-section { background: rgba(0,0,0,0.45) !important; backdrop-filter: blur(6px); }
          .dash-greeting { text-shadow: 0 2px 8px rgba(0,0,0,0.8); }
        ` : ''}
      `}</style>

      <div className="page">

        {/* ── Feature hover background animation (visible through sidebar backdrop) ── */}
        <AnimatePresence>
          {hoveredFeature && FEATURE_BG[hoveredFeature] && (
            <motion.div
              key={hoveredFeature}
              className="feature-bg-anim"
              initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
              animate={{ opacity: 0.45, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ color: FEATURE_BG[hoveredFeature].color }}
            >
              <i className={`fas ${FEATURE_BG[hoveredFeature].icon}`} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Decorative floating knight */}
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-chess-knight" />
        </motion.div>

        {/* AnimatedSidebar with hover callback for background animation */}
        <AnimatedSidebar
          links={playerLinks}
          logo={<i className="fas fa-chess" />}
          title="ChessHive"
          onHoverLink={setHoveredFeature}
        />

        {/* Player quick header: theme toggle + notifications */}
        <div className="player-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-color)',
              width: 40, height: 40, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} aria-hidden="true" />
          </motion.button>
          {notificationsEnabled && (
            <button className="inbox-icon" onClick={loadNotifications} aria-label={`Open notifications (${unreadCount} unread)`}>
              <i className="fas fa-inbox" aria-hidden="true" />
              <span className="unread-count" aria-hidden="true">{unreadCount}</span>
            </button>
          )}
        </div>

        {/* ── Main Content ── */}
        <div className="content chess-dash-checkerboard" style={wallpaperStyle}>
          {/* Error box */}
          <div style={styles.errorBox}>
            <strong>Error loading data:</strong> <span>{errorMsg}</span>
            {errorMsg && (
              <button className="approve-btn" style={{ marginLeft: '1rem' }} onClick={loadDashboard}>Retry</button>
            )}
          </div>

          {/* ── Banner with tilted king coin animation ── */}
          <div className="banner-wrap">
            <motion.h1
              className="dash-greeting"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.span
                className="king-coin"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <i className="fas fa-chess-king king-tilted" aria-hidden="true" />
              </motion.span>
              {greeting}, {playerName}! Welcome to ChessHive
            </motion.h1>
          </div>

          {/* ══════════ Folder-style Dashboard Grid (Feature #3) ══════════ */}
          <div className="dashboard-grid">

            {/* ── Team Requests (full width) ── */}
            <motion.div
              className="folder-card full-width"
              custom={0}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="folder-tab" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><i className="fas fa-users" /> Team Requests</span>
              </div>
              <motion.ul variants={listVariants} initial="hidden" animate="visible">
                {displayTeamRequests.length === 0 ? (
                  <motion.li variants={itemVariants}><i className="fas fa-info-circle" /> No team requests.</motion.li>
                ) : (
                  displayTeamRequests.map((req, idx) => (
                    <motion.li key={req.id} custom={idx} variants={itemVariants}>
                      <i className="fas fa-users" style={{ color: 'var(--sea-green)' }} />
                      <div className="tournament-info">
                        <strong>{req.tournamentName}</strong>
                        <span style={{ 
                          marginLeft: '0.5rem', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          backgroundColor: req.status === 'approved' ? '#d4edda' :
                                           req.status === 'rejected' ? '#f8d7da' :
                                           req.isExpired ? '#e2e3e5' :
                                           req.status === 'cancelled' ? '#fff3cd' : '#fff3cd',
                          color: req.status === 'approved' ? '#155724' :
                                 req.status === 'rejected' ? '#721c24' :
                                 req.isExpired ? '#383d41' :
                                 req.status === 'cancelled' ? '#856404' : '#856404'
                        }}>
                          {req.displayStatus}
                        </span>
                        <br />
                        Captain: {req.captainName} | Team: {req.player1_name}, {req.player2_name}, {req.player3_name}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {req.status === 'pending' && !req.isExpired && req.needsMyApproval && !req.isCaptain && (
                          <>
                            <button className="approve-btn" onClick={() => approveTeamRequest(req.id)}>Approve</button>
                            <button className="reject-btn" style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }} onClick={() => rejectTeamRequest(req.id)}>Reject</button>
                          </>
                        )}
                        {req.status === 'pending' && !req.isExpired && req.isCaptain && (
                          <button className="cancel-btn" style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }} onClick={() => cancelTeamRequest(req.id)}>Cancel Request</button>
                        )}
                      </div>
                    </motion.li>
                  ))
                )}
              </motion.ul>
            </motion.div>

            {/* ── Latest Tournaments (left column) ── */}
            <motion.div
              className="folder-card"
              custom={1}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="folder-tab">
                <i className="fas fa-trophy" /> Tournaments
              </div>
              <motion.ul variants={listVariants} initial="hidden" animate="visible">
                {(!latestTournaments || latestTournaments.length === 0) ? (
                  <motion.li variants={itemVariants}><i className="fas fa-info-circle" /> No tournaments available.</motion.li>
                ) : (
                  latestTournaments.map((t, idx) => {
                    const formattedDate = new Date(t.date).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                    });
                    return (
                      <motion.li key={idx} variants={itemVariants}>
                        <i className={`fas fa-chess-knight ${idx === 0 ? 'chess-pawn-march' : 'chess-piece-breathe'}`} style={{ color: 'var(--sea-green)' }} />
                        <div className="tournament-info">
                          <strong>{t.name}</strong>
                          <div className="date-tag"><i className="fas fa-calendar-alt" /> {formattedDate}</div>
                        </div>
                      </motion.li>
                    );
                  })
                )}
              </motion.ul>
            </motion.div>

            {/* ── New in Store (right column) – Product cards with images (Feature #5) ── */}
            <motion.div
              className="folder-card"
              custom={2}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="folder-tab">
                <i className="fas fa-shopping-bag" /> New in Store
              </div>
              {(!latestItems || latestItems.length === 0) ? (
                <p style={{ padding: '0.8rem', opacity: 0.7 }}><i className="fas fa-info-circle" /> No items available at the moment.</p>
              ) : (
                <div className="store-grid">
                  {latestItems.map((item, idx) => (
                    <motion.div
                      key={idx}
                      className="store-card"
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                      custom={idx}
                      whileHover={{ scale: 1.03 }}
                    >
                      <div className="store-card-img">
                        {(() => {
                          const imgSrc = item.image_url
                            || (Array.isArray(item.image_urls) ? item.image_urls[0] : item.image_urls)
                            || item.imageUrl
                            || item.image
                            || null;
                          return imgSrc
                            ? <img src={imgSrc} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                            : <i className="fas fa-chess-pawn" style={{ fontSize: '3rem', color: 'var(--sea-green)', opacity: 0.25 }} />;
                        })()}
                      </div>
                      <div className="store-card-body">
                        <div className="store-card-name">{item.name}</div>
                        <span className="price-tag"><i className="fas fa-tag" /> ₹{item.price}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ══════════ News-style Updates & Events (Feature #6) ══════════ */}
          <div className="news-grid">

            {/* ── Live Streams ── */}
            <motion.div
              className="news-section"
              custom={3}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="news-header" style={{ background: 'linear-gradient(90deg, #e53935, #b71c1c)' }}>
                <i className="fas fa-broadcast-tower" /> Live Streams
                {liveStreams.length > 0 && (
                  <span className="live-badge" style={{ marginLeft: 'auto', background: '#fff', color: '#e53935' }}>
                    <span className="live-badge-dot" style={{ background: '#e53935' }} />
                    {liveStreams.length} LIVE
                  </span>
                )}
              </div>
              <div className="news-body">
                {liveStreams.length === 0 ? (
                  <div className="no-streams">
                    <motion.i
                      className="fas fa-satellite-dish"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <div>No live streams right now</div>
                    <div style={{ fontSize: '0.8rem' }}>Check back later or visit the Watch section</div>
                  </div>
                ) : (
                  liveStreams.map((stream, idx) => (
                    <motion.div
                      key={stream._id || idx}
                      className="stream-item"
                      variants={itemVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <span className="live-badge">
                        <span className="live-badge-dot" />
                        LIVE
                      </span>
                      <div className="stream-info">
                        <div className="stream-title">{stream.title}</div>
                        <div className="stream-meta">
                          <i className={`fas ${stream.platform === 'youtube' ? 'fa-youtube' : stream.platform === 'twitch' ? 'fa-twitch' : 'fa-chess'}`} style={{ marginRight: '0.3rem' }} />
                          {stream.createdByName || stream.platform || 'Stream'}
                          {stream.matchLabel && <> &middot; {stream.matchLabel}</>}
                        </div>
                      </div>
                      <button className="watch-btn" onClick={() => navigate('/player/watch')}>
                        <i className="fas fa-play" /> Watch
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>

            {/* ── Upcoming Events (calendar badge style) ── */}
            <motion.div
              className="news-section"
              custom={4}
              variants={sectionVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="news-header events-header">
                <i className="fas fa-calendar-check" /> Upcoming Events
              </div>
              <div className="news-body">
                {(!news.events || news.events.length === 0) ? (
                  <div className="news-item" style={{ opacity: 0.7 }}>
                    <i className="fas fa-info-circle" /> No upcoming events.
                  </div>
                ) : (
                  news.events.map((ev, idx) => {
                    const catIcons = {
                      'Chess Talk': 'fa-comments',
                      'Tournament Alert': 'fa-trophy',
                      'Live Announcement': 'fa-bullhorn',
                      'Workshop': 'fa-chalkboard-teacher',
                      'Webinar': 'fa-video',
                      'Exhibition Match': 'fa-chess-board',
                      'Other': 'fa-calendar-alt'
                    };
                    const catIcon = catIcons[ev.category] || 'fa-calendar-alt';
                    return (
                      <motion.div
                        key={ev._id || idx}
                        className="news-item event-item"
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {ev.date && (
                          <div className="event-date-badge">
                            {new Date(ev.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <div className="news-headline">{ev.title}</div>
                            {ev.category && (
                              <span style={{
                                fontSize: '0.72rem', background: 'rgba(46,139,87,0.15)', color: 'var(--sea-green)',
                                padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 'bold',
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                              }}>
                                <i className={`fas ${catIcon}`} /> {ev.category}
                              </span>
                            )}
                          </div>
                          {ev.description && <div className="news-desc">{ev.description}</div>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', marginTop: '0.3rem' }}>
                            {ev.date && (
                              <div className="news-date">
                                <i className="fas fa-calendar-alt" /> {new Date(ev.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </div>
                            )}
                            {ev.location && (
                              <div className="news-date" style={{ opacity: 0.7 }}>
                                <i className="fas fa-map-marker-alt" /> {ev.location}
                              </div>
                            )}
                            {ev.link && (
                              <a href={ev.link} target="_blank" rel="noopener noreferrer" className="news-date" style={{ color: 'var(--sea-green)', textDecoration: 'none' }}>
                                <i className="fas fa-external-link-alt" /> Join / View
                              </a>
                            )}
                          </div>
                          {ev.coordinatorName && (
                            <div className="news-date" style={{ opacity: 0.5, marginTop: '0.2rem', fontSize: '0.78rem' }}>
                              <i className="fas fa-user" /> {ev.coordinatorName}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>

        </div>{/* end .content */}

        {/* ── Notifications Modal (Tabbed: Messages + Feedback) ── */}
        <div id="notifications-modal">
          <div className="notifications-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-bell" /> Notifications</h3>
              <button onClick={closeNotifications} className="notif-close-btn" aria-label="Close">
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Tabs */}
            <div className="notif-tabs">
              <button
                className={`notif-tab ${notifTab === 'messages' ? 'active' : ''}`}
                onClick={() => setNotifTab('messages')}
              >
                <i className="fas fa-comments" /> Messages
                {chatMessages.length > 0 && <span className="notif-tab-badge">{chatMessages.length}</span>}
              </button>
              <button
                className={`notif-tab ${notifTab === 'feedback' ? 'active' : ''}`}
                onClick={() => setNotifTab('feedback')}
              >
                <i className="fas fa-clipboard-check" /> Feedback
                {(notificationsState.items || []).filter(n => !n.read).length > 0 && (
                  <span className="notif-tab-badge">{(notificationsState.items || []).filter(n => !n.read).length}</span>
                )}
              </button>
            </div>

            {/* Messages Tab */}
            {notifTab === 'messages' && (
              <ul className="notifications-list">
                {chatMessages.length === 0 ? (
                  <li className="notif-empty">
                    <i className="fas fa-inbox" style={{ fontSize: '2rem', opacity: 0.3 }} />
                    <span>No new messages</span>
                  </li>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <li key={msg._id || idx} className="notif-msg-item">
                      <div className="notif-msg-avatar">
                        <i className="fas fa-user-circle" />
                      </div>
                      <div className="notif-msg-body">
                        <strong>{msg.senderName || 'Unknown'}</strong>
                        <p>{msg.message || msg.text || ''}</p>
                        <span className="notif-msg-time">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                        </span>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}

            {/* Feedback Tab */}
            {notifTab === 'feedback' && (
              <>
                <ul className="notifications-list">
                  {(notificationsState.items || []).length === 0 ? (
                    <li className="notif-empty">
                      <i className="fas fa-clipboard-check" style={{ fontSize: '2rem', opacity: 0.3 }} />
                      <span>No feedback requests</span>
                    </li>
                  ) : (
                    (notificationsState.items || []).map(n => (
                      <li key={n._id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <i className="fas fa-trophy" style={{ color: 'var(--sea-green)' }} />
                          <div style={{ flex: 1 }}>
                            <strong>{n.tournamentName}</strong><br />
                            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                              {n.date ? new Date(n.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </span>
                          </div>
                          {!n.read ? (
                            <button className="approve-btn" style={{ fontSize: '0.8rem' }} onClick={() => openFeedbackForm(n._id, n.tournamentName, n.tournament_id)}>
                              <i className="fas fa-pen" /> Feedback
                            </button>
                          ) : (
                            <span style={{ color: 'var(--sea-green)', fontSize: '0.85rem' }}><i className="fas fa-check" /> Done</span>
                          )}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
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
              </>
            )}
          </div>
        </div>

      </div>{/* end .page */}

      {/* ── Live Announcement Popup ── */}
      <AnimatePresence>
        {liveAnnouncement && (
          <motion.div
            key="announcement-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center',
              alignItems: 'center', zIndex: 3000
            }}
            onClick={dismissAnnouncement}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.7, opacity: 0, y: 40 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--card-bg)', border: '2px solid var(--sea-green)',
                borderRadius: 18, padding: '2rem', maxWidth: 500, width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)', position: 'relative', textAlign: 'center'
              }}
            >
              <div style={{
                position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, var(--sea-green), #2E8B57)',
                color: '#fff', padding: '0.35rem 1.2rem', borderRadius: 20,
                fontFamily: "'Cinzel', serif", fontWeight: 'bold', fontSize: '0.8rem',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(46,139,87,0.4)'
              }}>
                <i className="fas fa-bullhorn" /> LIVE ANNOUNCEMENT
              </div>
              <button
                onClick={dismissAnnouncement}
                aria-label="Close announcement"
                style={{
                  position: 'absolute', top: 10, right: 14, background: 'none',
                  border: 'none', color: 'var(--text-color)', fontSize: '1.2rem',
                  cursor: 'pointer', opacity: 0.6
                }}
              >
                <i className="fas fa-times" />
              </button>
              <div style={{ marginTop: '1rem' }}>
                <i className="fas fa-chess-king" style={{
                  fontSize: '2.5rem', color: 'var(--sea-green)', marginBottom: '0.8rem',
                  display: 'block'
                }} />
                <h3 style={{
                  fontFamily: "'Cinzel', serif", color: 'var(--sea-green)',
                  margin: '0 0 0.6rem 0', fontSize: '1.3rem'
                }}>
                  {liveAnnouncement.title}
                </h3>
                <p style={{ fontSize: '0.95rem', opacity: 0.85, lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                  {liveAnnouncement.message}
                </p>
                <div style={{ fontSize: '0.75rem', opacity: 0.5, fontStyle: 'italic' }}>
                  {liveAnnouncement.posted_date
                    ? new Date(liveAnnouncement.posted_date).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      })
                    : ''}
                </div>
              </div>
              <button
                onClick={dismissAnnouncement}
                style={{
                  marginTop: '1.2rem', background: 'var(--sea-green)', color: 'var(--on-accent)',
                  border: 'none', padding: '0.6rem 1.5rem', borderRadius: 10,
                  fontFamily: "'Cinzel', serif", fontWeight: 'bold', cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default PlayerDashboard;
