import React, { useCallback, useEffect, useMemo, useState } from 'react';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useNavigate } from 'react-router-dom';
import { fetchAsPlayer } from '../../utils/fetchWithRole';
import { GlobalLoader } from '../../components/ChessTransformation';


const ROWS_PER_PAGE = 5;
const TAB_OPTIONS = ['Individual', 'Team', 'Calendar', 'History', 'Complaints'];
const MAX_WALLET_BALANCE = 100000;

function PlayerTournament() {
  usePlayerTheme();
  const navigate = useNavigate();

  // UI/messages
  const [message, setMessage] = useState(null); // { text, isError }
  const [loading, setLoading] = useState(false);

  // Wallet/subscription
  const [walletBalance, setWalletBalance] = useState(0);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  // Tournaments raw data
  const [raw, setRaw] = useState({ tournaments: [], enrolledIndividualTournaments: [], enrolledTeamTournaments: [], currentSubscription: null, username: '' });

  // Filters
  const [searchIndividual, setSearchIndividual] = useState('');
  const [searchIndividualType, setSearchIndividualType] = useState('name');
  const [searchTeam, setSearchTeam] = useState('');
  const [searchTeamType, setSearchTeamType] = useState('name');
  const [searchHistory, setSearchHistory] = useState('');
  const [searchHistoryType, setSearchHistoryType] = useState('name');

  // Pagination visible counts
  const [individualVisibleCount, setIndividualVisibleCount] = useState(ROWS_PER_PAGE);
  const [teamVisibleCount, setTeamVisibleCount] = useState(ROWS_PER_PAGE);
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);

  // Helpers
  const fetchJson = useCallback(async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (res.status === 401) {
      navigate('/login');
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }, [navigate]);

  const loadWalletAndSubscription = async () => {
    const out = await fetchJson('/player/api/profile');
    if (!out) return;
    const { res, data } = out;
    if (!res.ok) {
      setMessage({ text: 'Failed to load wallet balance and subscription status.', isError: true });
      setWalletBalance(0);
      return;
    }
    setWalletBalance(Math.min(data.player?.walletBalance ?? 0, MAX_WALLET_BALANCE));
    const subscribed = !!(data.player?.subscription && new Date(data.player.subscription.end_date) > new Date());
    setSubscriptionActive(subscribed);
  };

  const loadTournaments = async () => {
    setLoading(true);
    try {
      const out = await fetchJson('/player/api/tournaments', { headers: { 'Cache-Control': 'no-cache' } });
      if (!out) return;
      const { res, data } = out;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRaw({
        tournaments: data.tournaments || [],
        enrolledIndividualTournaments: data.enrolledIndividualTournaments || [],
        enrolledTeamTournaments: data.enrolledTeamTournaments || [],
        currentSubscription: data.currentSubscription || null,
        username: data.username || ''
      });
      // If API also returns subscription, prefer it
      const subscribed = !!(data.currentSubscription && new Date(data.currentSubscription.end_date) > new Date());
      if (subscribed !== subscriptionActive) setSubscriptionActive(subscribed);
    } catch (err) {
      setMessage({ text: `Failed to load tournaments: ${err.message}`, isError: true });
    } finally {
      setLoading(false);
    }
  };

  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const out = await fetchJson('/player/api/complaints', { headers: { 'Cache-Control': 'no-cache' } });
      if (!out) return;
      const { res, data } = out;
      if (res.ok) {
        setComplaints(Array.isArray(data.complaints) ? data.complaints : []);
      } else {
        setComplaints([]);
      }
    } catch {
      setComplaints([]);
    } finally {
      setComplaintsLoading(false);
    }
  }, [fetchJson]);

  useEffect(() => {
    loadWalletAndSubscription();
    loadTournaments();
    loadComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!message?.autoHideMs) return undefined;
    const timer = setTimeout(() => setMessage(null), message.autoHideMs);
    return () => clearTimeout(timer);
  }, [message]);

  // Derived tournaments with enrollment flags
  const individualTournaments = useMemo(() => {
    return (raw.tournaments || [])
      .filter(t => {
        const type = (t.type || 'individual').toLowerCase();
        return type === 'individual' || type === 'solo';
      })
      .map(t => {
        const alreadyEnrolled = (raw.enrolledIndividualTournaments || []).some(e => e.tournament?._id?.toString() === t._id?.toString());
        const date = new Date(t.date);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isPast = date < now && !isToday;
        const status = isPast ? 'Completed' : isToday ? 'Ongoing' : 'Upcoming';
        const statusClass = isPast ? 'status-completed' : isToday ? 'status-ongoing' : 'status-yet-to-start';
        return { ...t, alreadyEnrolled, status, statusClass, date };
      });
  }, [raw]);

  const teamTournaments = useMemo(() => {
    const currentUser = raw.username;
    return (raw.tournaments || [])
      .filter(t => ['team', 'group'].includes((t.type || '').toLowerCase()))
      .map(t => {
        const enrollment = (raw.enrolledTeamTournaments || []).find(e => e.tournament?._id?.toString() === t._id?.toString());
        const alreadyJoined = !!enrollment;
        const approved = enrollment ? !!enrollment.approved : false;
        const needsApproval = !!(enrollment && (
          (enrollment.player1_name === currentUser && !enrollment.player1_approved) ||
          (enrollment.player2_name === currentUser && !enrollment.player2_approved) ||
          (enrollment.player3_name === currentUser && !enrollment.player3_approved)
        ));
        const date = new Date(t.date);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        const isPast = date < now && !isToday;
        const status = isPast ? 'Completed' : isToday ? 'Ongoing' : 'Upcoming';
        const statusClass = isPast ? 'status-completed' : isToday ? 'status-ongoing' : 'status-yet-to-start';
        return {
          ...t,
          alreadyJoined,
          approved,
          needsApproval,
          enrollmentId: enrollment?._id || null,
          player1_name: enrollment?.player1_name || null,
          player2_name: enrollment?.player2_name || null,
          player3_name: enrollment?.player3_name || null,
          player1_approved: !!enrollment?.player1_approved,
          player2_approved: !!enrollment?.player2_approved,
          player3_approved: !!enrollment?.player3_approved,
          date,
          status,
          statusClass,
        };
      });
  }, [raw]);

  const complaintTournamentIds = useMemo(() => {
    return new Set(
      (complaints || [])
        .map((c) => (c?.tournament_id != null ? String(c.tournament_id) : ''))
        .filter(Boolean)
    );
  }, [complaints]);

  // Filtering helpers
  const applyFilter = (list, search, type) => {
    const ft = (search || '').toLowerCase().trim();
    if (!ft) return list;
    return list.filter(row => {
      // Handle History tab format where data is nested under 'tournament'
      const data = row.tournament ? row.tournament : row;
      if (type === 'name') return (data.name || '').toLowerCase().includes(ft);
      if (type === 'location') return (data.location || '').toLowerCase().includes(ft);
      if (type === 'status') {
        const rawStatus = (data.status || '').toLowerCase();
        const displayStatus = rawStatus === 'approved' ? 'joined' : rawStatus;
        return displayStatus.includes(ft);
      }
      return true;
    });
  };

  const filteredIndividuals = applyFilter(individualTournaments, searchIndividual, searchIndividualType);
  const filteredTeams = applyFilter(teamTournaments, searchTeam, searchTeamType);

  const filteredHistoryIndividuals = applyFilter(
    raw.enrolledIndividualTournaments.filter(e => e && e.tournament),
    searchHistory,
    searchHistoryType
  );

  const filteredHistoryTeams = applyFilter(
    raw.enrolledTeamTournaments.filter(e => e && e.tournament),
    searchHistory,
    searchHistoryType
  );

  // Join handlers
  const joinIndividual = async (tournamentId) => {
    if (loading) return;
    setLoading(true);
    try {
      const out = await fetchJson('/player/api/join-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId })
      });
      if (!out) return;
      const { res, data } = out;
      if (res.ok) {
        setMessage({ text: data.message || 'Joined successfully', isError: false });
        if (typeof data.walletBalance !== 'undefined') setWalletBalance(Math.min(data.walletBalance, MAX_WALLET_BALANCE));
        await loadTournaments();
      } else {
        setMessage({ text: data.error || 'Failed to join tournament', isError: true });
      }
    } catch (err) {
      setMessage({ text: 'Error joining tournament.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  const joinTeam = async (tournamentId, players) => {
    if (loading) return;
    setLoading(true);
    try {
      const out = await fetchJson('/player/api/join-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, ...players })
      });
      if (!out) return;
      const { res, data } = out;
      if (res.ok) {
        setMessage({ text: data.message || 'Team submitted successfully', isError: false });
        if (typeof data.walletBalance !== 'undefined') setWalletBalance(Math.min(data.walletBalance, MAX_WALLET_BALANCE));
        setOpenJoinFormId(null);
        await loadTournaments();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setMessage({ text: data.error || 'Failed to join team tournament', isError: true });
        alert(data.error || 'Failed to join team tournament'); // Ensure user sees it if scrolled down
      }
    } catch (err) {
      setMessage({ text: 'Error joining team tournament.', isError: true });
      alert('Error joining team tournament.');
    } finally {
      setLoading(false);
    }
  };

  const approveTeamRequest = async (requestId) => {
    if (loading) return;
    setLoading(true);
    try {
      const out = await fetchJson('/player/api/approve-team-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        body: JSON.stringify({ requestId })
      });
      if (!out) return;
      const { res, data } = out;
      if (res.ok) {
        setMessage({ text: 'Team request approved successfully!', isError: false });
        // slight delay to allow backend to update
        setTimeout(loadTournaments, 800);
      } else {
        setMessage({ text: data.error || 'Failed to approve team request', isError: true });
      }
    } catch (err) {
      setMessage({ text: 'Error approving team request.', isError: true });
    } finally {
      setLoading(false);
    }
  };


  // Local UI state: which team join form is open
  const [openJoinFormId, setOpenJoinFormId] = useState(null);
  const [activeTab, setActiveTab] = useState('Individual');
  const [calendar, setCalendar] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // Complaint Modal State
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [selectedTournamentForComplaint, setSelectedTournamentForComplaint] = useState(null);
  const [complaintForm, setComplaintForm] = useState({ subject: '', message: '' });

  const openComplaintModal = (tournamentId) => {
    if (complaintTournamentIds.has(String(tournamentId))) {
      setMessage({ text: 'You already submitted a complaint for this tournament.', isError: true });
      setActiveTab('Complaints');
      return;
    }
    setSelectedTournamentForComplaint(tournamentId);
    setComplaintForm({ subject: '', message: '' });
    setComplaintModalOpen(true);
  };

  const closeComplaintModal = () => {
    setComplaintModalOpen(false);
    setSelectedTournamentForComplaint(null);
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTournamentForComplaint) return;
    if (!complaintForm.subject.trim() || !complaintForm.message.trim()) {
      setMessage({ text: 'Please fill in all fields', isError: true });
      return;
    }

    setLoading(true);
    try {
      const out = await fetchJson('/player/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournament_id: selectedTournamentForComplaint,
          subject: complaintForm.subject,
          message: complaintForm.message
        })
      });
      if (!out) return;
      const { res, data } = out;
      if (res.ok) {
        setMessage({ text: 'Complaint submitted successfully', isError: false, autoHideMs: 6000 });
        await loadComplaints();
        setActiveTab('Complaints');
        closeComplaintModal();
      } else {
        setMessage({ text: data.error || 'Failed to submit complaint', isError: true });
      }
    } catch (err) {
      setMessage({ text: 'Error submitting complaint', isError: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Calendar') {
      setCalendarLoading(true);
      fetchAsPlayer('/player/api/tournament-calendar')
        .then(res => res.ok ? res.json() : { calendar: [] })
        .then(data => setCalendar(data.calendar || []))
        .catch(() => setCalendar([]))
        .finally(() => setCalendarLoading(false));
      return;
    }
    if (activeTab === 'Complaints') {
      loadComplaints();
    }
  }, [activeTab, loadComplaints]);



  return (
    <div>
      <style>{`
        /* Theme-aware page styling */
        *{ margin:0; padding:0; box-sizing:border-box; }
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem clamp(1rem,2vw,2rem); }
        h1,h2{ font-family:'Cinzel', serif; color:var(--sea-green); margin:0 0 1rem 0; letter-spacing:.5px; }
        .black-h2{ color:var(--sea-green); font-family:'Cinzel', serif; margin-top:2rem; margin-bottom:.75rem; }
        .form-container{ background:var(--card-bg); padding:20px; border-radius:15px; box-shadow:var(--card-shadow); margin-bottom:24px; overflow-x:auto; border:1px solid var(--card-border); }
        table{ width:100%; border-collapse:collapse; background:var(--card-bg); min-width:760px; font-family:'Playfair Display', serif; }
        th{ background:var(--sea-green); color:var(--on-accent); padding:12px; text-align:left; font-weight:600; font-size:.9rem; letter-spacing:.5px; }
        td{ padding:12px; border:1px solid var(--border-color); color:var(--text-color); font-size:.9rem; }
        tbody tr:nth-child(even){ background:var(--row-hover-bg); }
        tr:hover{ background:var(--row-hover-bg); }
        .status-ongoing{ color:var(--yellow); font-weight:bold; }
        .status-yet-to-start{ color:var(--sea-green); font-weight:bold; }
        .status-completed{ color:var(--sky-blue); font-weight:bold; }
        .tab-bar{ display:flex; gap:0.5rem; margin-bottom:1.5rem; }
        .tab-btn{ padding:0.6rem 1.2rem; border-radius:8px; border:1px solid var(--card-border); background:var(--card-bg); color:var(--text-color); cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; transition:all 0.2s; }
        .tab-btn.active{ background:var(--sea-green); color:var(--on-accent); border-color:var(--sea-green); }
        .tab-btn:hover:not(.active){ background:rgba(46,139,87,0.15); }
        .calendar-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:1rem; }
        .cal-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1.25rem; transition:transform 0.2s; }
        .cal-card:hover{ transform:translateY(-3px); }
        .cal-img{ width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:0.5rem; background:rgba(46,139,87,0.05); }
        .cal-img-placeholder{ width:100%; height:120px; border-radius:8px; margin-bottom:0.5rem; background:rgba(46,139,87,0.08); display:flex; align-items:center; justify-content:center; color:var(--sea-green); opacity:0.4; font-size:2.5rem; }
        .cal-date{ font-family:'Cinzel',serif; color:var(--sea-green); font-size:0.9rem; margin-bottom:0.3rem; }
        .cal-name{ font-weight:bold; font-size:1.05rem; margin-bottom:0.3rem; }
        .cal-type{ font-size:0.8rem; opacity:0.7; text-transform:uppercase; }
        .cal-type-badge{ display:inline-block; padding:0.2rem 0.6rem; border-radius:12px; font-size:0.7rem; font-weight:bold; font-family:'Cinzel',serif; letter-spacing:0.3px; text-transform:uppercase; }
        .cal-type-individual{ background:rgba(46,139,87,0.15); color:#2E8B57; }
        .cal-type-team{ background:rgba(52,152,219,0.15); color:#3498db; }
        .cal-type-solo{ background:rgba(243,156,18,0.15); color:#f39c12; }
        .cal-matches{ margin-top:0.5rem; max-height:150px; overflow-y:auto; }
        .cal-match-item{ display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; border-bottom:1px solid var(--card-border); font-size:0.8rem; }
        .cal-match-item:last-child{ border-bottom:none; }
        .cal-match-result{ font-weight:bold; font-size:0.75rem; padding:0.1rem 0.4rem; border-radius:4px; }
        .cal-match-pending{ background:rgba(243,156,18,0.12); color:#f39c12; }
        .cal-match-done{ background:rgba(46,139,87,0.12); color:#2E8B57; }
        .wallet-section{ background:var(--sea-green); color:var(--on-accent); padding:24px 28px; border-radius:18px; text-align:center; margin-bottom:2rem; position:relative; overflow:hidden; }
        .wallet-section::after{ content:""; position:absolute; inset:0; background:radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 70%); pointer-events:none; }
        .wallet-section h3{ color:var(--on-accent); margin:0 0 1.25rem 0; font-family:'Cinzel', serif; font-size:1.1rem; }
        .wallet-balance-label{ color:var(--on-accent); font-family:'Cinzel', serif; font-size:1rem; letter-spacing:.6px; margin-bottom:0.35rem; text-transform:uppercase; }
        .wallet-balance-value{ color:var(--on-accent); font-family:'Playfair Display', serif; font-size:2rem; font-weight:700; text-shadow:0 2px 6px rgba(0,0,0,0.25); margin-bottom:1rem; }
        .wallet-section form{ display:flex; flex-direction:column; gap:12px; max-width:340px; margin:0 auto; }
        .wallet-section input[type='number']{ width:100%; padding:12px; border:2px solid rgba(255,255,255,0.7); border-radius:10px; font-size:16px; background:#ffffff; color:#1C1917; outline:none; font-family:'Playfair Display', serif; }
        .wallet-section input[type='number']:focus{ box-shadow:0 0 0 3px var(--input-focus); }
        .wallet-section button{ background:#B8860B; color:#FFFFFF; border:1px solid rgba(255,255,255,0.6); padding:14px 24px; border-radius:10px; cursor:pointer; font-weight:700; transition:background .25s, transform .25s, box-shadow .25s; font-family:'Cinzel', serif; letter-spacing:.6px; box-shadow:0 6px 16px rgba(0,0,0,0.25); }
        .wallet-section button:hover{ background:#C99716; transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,0.3); }
        button,.btn{ background:var(--sea-green); color:var(--on-accent); border:none; padding:10px 18px; border-radius:10px; cursor:pointer; transition:background .25s, transform .25s; font-family:'Cinzel', serif; font-weight:600; letter-spacing:.4px; }
        button:hover,.btn:hover{ filter:brightness(1.1); transform:translateY(-2px); }
        button[disabled]{ background:#3d4b60; cursor:not-allowed; opacity:.6; }
        .subscription-message{ background:var(--card-bg); color:var(--sea-green); padding:16px 20px; border-radius:12px; margin-bottom:26px; font-weight:600; font-family:'Playfair Display', serif; border:1px solid var(--card-border); }
        .subscription-message a{ color:var(--sea-green); text-decoration:underline; }
        .search-box{ margin-bottom:1rem; display:flex; gap:1rem; align-items:center; flex-wrap:nowrap; }
        .search-box input{ flex:1 1 320px; min-width:0; padding:0.65rem 1rem; width:auto; max-width:none; border:2px solid var(--input-border); border-radius:10px; font-size:.95rem; transition:all 0.25s ease; font-family:'Playfair Display', serif; background:var(--input-bg); color:var(--text-color); outline:none; }
        .search-box input::placeholder{ color:var(--muted-text); opacity:0.9; }
        .search-box input:focus{ box-shadow:0 0 0 3px var(--input-focus); }
        .search-box select{ flex:0 0 190px; width:190px; max-width:190px; min-width:160px; padding:0.65rem 1rem; border:2px solid var(--input-border); border-radius:10px; font-size:.95rem; background:var(--input-bg); color:var(--text-color); font-family:'Cinzel', serif; cursor:pointer; transition:all 0.25s ease; }
        .search-box select:focus{ outline:none; box-shadow:0 0 0 3px var(--input-focus); }
        body.player:not(.player-dark) .search-box input,
        body.player:not(.player-dark) .search-box select{
          background:#ffffff;
          color:#1C1917;
          border-color:rgba(27,94,63,0.4);
        }
        body.player:not(.player-dark) .search-box select{
          width:190px;
          max-width:190px;
        }
        body.player:not(.player-dark) .search-box input:focus,
        body.player:not(.player-dark) .search-box select:focus{
          border-color:#1B5E3F;
          box-shadow:0 0 0 3px rgba(27,94,63,0.2);
        }
        body.player-dark .search-box input,
        body.player-dark .search-box select{
          background:rgba(12,18,28,0.96);
          color:#eef3fb;
          border-color:rgba(255,255,255,0.5);
        }
        body.player-dark .search-box select{
          width:190px;
          max-width:190px;
        }
        body.player-dark .search-box input::placeholder{
          color:rgba(233,239,248,0.68);
          opacity:1;
        }
        body.player-dark .search-box input:focus,
        body.player-dark .search-box select:focus{
          border-color:#ffffff;
          box-shadow:0 0 0 3px rgba(255,255,255,0.18);
        }
        body.player-dark .search-box select option{
          background:#111a27;
          color:#eef3fb;
        }
        .more-container{ text-align:center; margin:1.25rem 0 1.75rem; display:flex; justify-content:center; gap:1rem; }
        .more,.hide{ display:inline-flex; align-items:center; gap:0.6rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.85rem 1.6rem; border-radius:10px; transition:all 0.25s ease; font-family:'Cinzel', serif; font-weight:600; letter-spacing:.4px; }
        .more:hover,.hide:hover{ filter:brightness(1.1); transform:translateY(-2px); }
        .empty-message{ text-align:center; padding:2.25rem; color:var(--sea-green); font-style:italic; font-family:'Playfair Display', serif; }
        .loading{ opacity:0.5; pointer-events:none; }
        .join-team-btn{
          background:#B8860B !important;
          color:#FFFFFF !important;
          border:1px solid rgba(255,255,255,0.5) !important;
          padding:10px 18px;
          border-radius:10px;
          cursor:pointer;
          font-family:'Cinzel', serif;
          font-weight:600;
          letter-spacing:.4px;
          box-shadow:0 4px 14px rgba(0,0,0,0.3);
          transition:background .25s ease, transform .25s ease, box-shadow .25s ease;
        }
        .join-team-btn:hover:not([disabled]){
          background:#C99716 !important;
          transform:translateY(-2px);
          box-shadow:0 6px 16px rgba(0,0,0,0.35);
        }
        .join-team-btn[disabled]{
          background:#3d4b60 !important;
          color:#d9dee7 !important;
          cursor:not-allowed;
          opacity:.7;
          box-shadow:none;
          transform:none;
        }
        .enrolled-actions{ display:flex; flex-wrap:wrap; align-items:center; gap:0.6rem; }
        .status-pill{ display:inline-block; padding:6px 14px; border-radius:18px; font-size:.7rem; letter-spacing:.4px; font-weight:700; font-family:'Cinzel', serif; box-shadow:0 2px 6px rgba(0,0,0,0.25); }
        .status-pill.enrolled{ background:var(--sky-blue); color:var(--on-accent); }
        .status-pill.pending{ background:var(--yellow); color:#000; }
        .btn.small{ padding:8px 14px; font-size:.7rem; border-radius:8px; }
        .join-form{ margin-top:10px; background:var(--card-bg); border:1px solid var(--card-border); padding:14px; border-radius:10px; }
        .join-form label{ color: var(--text-color); font-weight:600; font-size:.8rem; font-family:'Cinzel', serif; }
        .join-form input{ background:var(--input-bg); color: var(--text-color); border:2px solid var(--input-border); padding:8px 10px; border-radius:8px; font-family:'Playfair Display', serif; margin-bottom:8px; }
        .join-form input::placeholder{ color: var(--muted-text); opacity: 0.9; }
        .join-form input:focus{ box-shadow:0 0 0 3px var(--input-focus); }
        body.player-dark .join-form input{
          background: rgba(18, 24, 34, 0.95);
          color: #eef3fb;
          border-color: rgba(255,255,255,0.42);
        }
        body.player-dark .join-form input::placeholder{
          color: rgba(235,242,252,0.62);
          opacity: 1;
        }
        body.player-dark .join-form input:focus{
          border-color: rgba(255,255,255,0.9);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.16);
        }
        .complaint-action-btn{
          background:var(--sky-blue) !important;
          color:var(--on-accent) !important;
        }
        .complaint-action-btn:hover:not([disabled]){
          background:var(--sky-blue-hover) !important;
        }
        .complaint-modal-overlay{
          position:fixed;
          inset:0;
          background:rgba(0,0,0,0.72);
          z-index:2000;
          display:flex;
          align-items:center;
          justify-content:center;
          padding:1rem;
        }
        .complaint-modal{
          background:var(--card-bg);
          border:1px solid var(--sea-green);
          border-radius:12px;
          width:100%;
          max-width:520px;
          padding:1.75rem;
          position:relative;
          box-shadow:0 14px 36px rgba(0,0,0,0.35);
        }
        .complaint-close-btn{
          position:absolute;
          top:10px;
          right:10px;
          background:transparent;
          border:none;
          color:var(--text-color);
          font-size:1.2rem;
          cursor:pointer;
          padding:6px 8px;
        }
        .complaint-modal-title{
          font-family:'Cinzel', serif;
          color:var(--sea-green);
          margin-bottom:1.2rem;
          text-align:center;
        }
        .complaint-form-group{
          margin-bottom:1rem;
        }
        .complaint-form-group:last-of-type{
          margin-bottom:1.35rem;
        }
        .complaint-form-label{
          display:block;
          margin-bottom:0.5rem;
          color:var(--text-color);
          font-family:'Cinzel', serif;
          font-weight:600;
          font-size:0.88rem;
        }
        .complaint-modal-input,
        .complaint-modal-textarea{
          width:100%;
          padding:0.8rem 0.9rem;
          border-radius:8px;
          border:2px solid var(--input-border);
          background:var(--input-bg);
          color:var(--text-color);
          font-family:'Playfair Display', serif;
          outline:none;
          transition:border-color .2s ease, box-shadow .2s ease, background .2s ease;
        }
        .complaint-modal-textarea{
          min-height:120px;
          resize:vertical;
        }
        .complaint-modal-input::placeholder,
        .complaint-modal-textarea::placeholder{
          color:var(--muted-text);
          opacity:0.92;
        }
        .complaint-modal-input:focus,
        .complaint-modal-textarea:focus{
          border-color:rgba(255,255,255,0.85);
          box-shadow:0 0 0 3px rgba(255,255,255,0.16);
        }
        .complaint-submit-btn{
          width:100%;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:#B8860B !important;
          color:#FFFFFF !important;
          border:1px solid rgba(255,255,255,0.5) !important;
          padding:10px 18px !important;
          border-radius:10px !important;
          font-family:'Cinzel', serif;
          font-weight:600;
          letter-spacing:.4px;
          box-shadow:0 4px 14px rgba(0,0,0,0.3);
          transition:background .25s ease, transform .25s ease, box-shadow .25s ease;
        }
        .complaint-submit-btn:hover:not([disabled]){
          background:#C99716 !important;
          transform:translateY(-2px);
          box-shadow:0 6px 16px rgba(0,0,0,0.35);
        }
        .complaint-submit-btn[disabled]{
          background:#3d4b60 !important;
          color:#d9dee7 !important;
          cursor:not-allowed;
          opacity:.75;
          box-shadow:none;
          transform:none;
        }
        body.player-dark .complaint-modal-input,
        body.player-dark .complaint-modal-textarea{
          background:rgba(16,22,31,0.96);
          color:#eef3fb;
          border-color:rgba(255,255,255,0.5);
        }
        body.player-dark .complaint-modal-input::placeholder,
        body.player-dark .complaint-modal-textarea::placeholder{
          color:rgba(233,239,248,0.64);
          opacity:1;
        }
        body.player-dark .complaint-modal-input:focus,
        body.player-dark .complaint-modal-textarea:focus{
          border-color:#ffffff;
          box-shadow:0 0 0 3px rgba(255,255,255,0.18);
        }
        .player-complaints-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1rem; }
        .player-complaint-card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:12px; padding:1rem; }
        .player-complaint-header{ display:flex; align-items:center; justify-content:space-between; gap:.75rem; margin-bottom:.65rem; }
        .player-complaint-title{ font-family:'Cinzel', serif; color:var(--sea-green); font-size:1rem; }
        .player-complaint-status{ padding:4px 10px; border-radius:999px; font-size:.72rem; font-family:'Cinzel', serif; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }
        .player-complaint-status.pending{ background:rgba(243,156,18,0.2); color:#f39c12; }
        .player-complaint-status.resolved{ background:rgba(76,175,80,0.2); color:#4caf50; }
        .player-complaint-status.dismissed{ background:rgba(229,57,53,0.18); color:#e53935; }
        .player-complaint-meta{ font-size:.83rem; opacity:.8; margin-bottom:.6rem; display:grid; gap:.2rem; }
        .player-complaint-message{ font-size:.9rem; line-height:1.45; margin-bottom:.6rem; }
        .player-complaint-response{ border-left:3px solid var(--sea-green); padding:.55rem .7rem; border-radius:0 8px 8px 0; background:rgba(46,139,87,0.08); font-size:.88rem; }
        .player-complaint-response-label{ font-family:'Cinzel', serif; color:var(--sea-green); font-size:.78rem; margin-bottom:.25rem; }
        @media (max-width:768px){
          .content{ padding:1.25rem 1rem 4rem; width:100vw; }
          table{ min-width:640px; }
          .wallet-section{ padding:20px; }
          .search-box{ flex-wrap:wrap; }
          .search-box input,.search-box select{ max-width:100%; width:100%; }
          .search-box select{ flex:1 1 100%; }
          .player-complaints-grid{ grid-template-columns:1fr; }
        }
      `}</style>

      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1><i className="fas fa-trophy" /> Tournaments</h1>
        </div>

        {/* Message banner */}
        {message && (
          <div style={{
            padding: 15,
            borderRadius: 8,
            marginBottom: 20,
            backgroundColor: message.isError ? 'var(--red)' : 'var(--sky-blue)',
            color: message.isError ? 'var(--on-accent)' : 'var(--sea-green)',
            fontWeight: 'bold',
            ...(message.autoHideMs ? {
              position: 'fixed',
              top: '18px',
              right: '18px',
              zIndex: 2600,
              minWidth: '280px',
              maxWidth: '420px',
              boxShadow: '0 12px 28px rgba(0,0,0,0.35)'
            } : {})
          }}>
            {message.text}
          </div>
        )}

        {/* Subscription message */}
        {!subscriptionActive && (
          <div className="subscription-message">
            YOU MUST BE SUBSCRIBED TO JOIN TOURNAMENTS. <a href="/player/subscription">Subscribe Now</a>
          </div>
        )}

        {/* Wallet section */}
        <div className="wallet-section">
          <span className="wallet-icon" role="img" aria-label="wallet">💰</span>
          <div className="wallet-balance-label">Wallet Balance</div>
          <div className="wallet-balance-value">₹{walletBalance.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem', fontFamily: "'M PLUS 1', sans-serif" }}>
            Manage funds in your Profile
          </div>
        </div>

        {/* Tab Bar */}
        <div className="tab-bar">
          {TAB_OPTIONS.map(t => (
            <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t === 'Calendar' ? <><i className="fas fa-calendar-alt" /> Calendar</> : t}</button>
          ))}
        </div>

        {/* Calendar Tab */}
        {activeTab === 'Calendar' && (
          <div>
            <h2 className="black-h2"><i className="fas fa-calendar" /> Tournament Calendar</h2>
            {calendarLoading ? <p>Loading calendar...</p> : calendar.length === 0 ? (
              <div className="empty-message">No upcoming tournaments on the calendar</div>
            ) : (
              <div className="calendar-grid">
                {calendar.map((t, i) => {
                  const typeClass = (t.type || 'individual').toLowerCase().includes('team') ? 'cal-type-team' : (t.type || '').toLowerCase() === 'solo' ? 'cal-type-solo' : 'cal-type-individual';
                  const matches = t.matches || [];
                  return (
                    <div key={i} className="cal-card">
                      {t.image ? (
                        <img className="cal-img" src={t.image} alt={t.name} onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                      ) : (
                        <div className="cal-img-placeholder"><i className="fas fa-trophy" /></div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                        <span className={`cal-type-badge ${typeClass}`}>{t.type || 'Individual'}</span>
                        {t.rounds && <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{t.rounds} rounds</span>}
                      </div>
                      <div className="cal-date"><i className="fas fa-calendar-day" /> {new Date(t.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="cal-name">{t.name}</div>
                      <div className="cal-type">{t.location || 'Online'}</div>
                      {t.entry_fee != null && <div style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>Entry: ₹{t.entry_fee}</div>}
                      {t.description && <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', opacity: 0.7 }}>{t.description}</div>}
                      {matches.length > 0 && (
                        <div className="cal-matches">
                          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: 'var(--sea-green)', marginBottom: '0.3rem' }}>
                            <i className="fas fa-chess-board" /> Matches ({matches.length})
                          </div>
                          {matches.slice(0, 10).map((m, mi) => (
                            <div key={mi} className="cal-match-item">
                              <span>R{m.round}: {m.player1} vs {m.player2}</span>
                              <span className={`cal-match-result ${m.result === 'pending' ? 'cal-match-pending' : 'cal-match-done'}`}>
                                {m.result === 'pending' ? 'Pending' : m.result}
                              </span>
                            </div>
                          ))}
                          {matches.length > 10 && <div style={{ fontSize: '0.75rem', textAlign: 'center', opacity: 0.6, paddingTop: '0.3rem' }}>+{matches.length - 10} more matches</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Individual Tournaments */}
        {activeTab === 'Individual' && (
          <>
            <h2 className="black-h2">Available Individual Tournaments</h2>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search individual tournaments..."
                value={searchIndividual}
                onChange={(e) => setSearchIndividual(e.target.value)}
              />
              <select
                value={searchIndividualType}
                onChange={(e) => setSearchIndividualType(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="location">Location</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className={`form-container ${loading ? 'loading' : ''}`}>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Coordinator</th>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Entry Fee</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIndividuals.length === 0 ? (
                      <tr><td colSpan="7" className="empty-message">No individual tournaments available</td></tr>
                    ) : (
                      filteredIndividuals.slice(0, individualVisibleCount).map(t => (
                        <tr key={t._id}>
                          <td>{t.name}</td>
                          <td>{t.coordinator}</td>
                          <td>{t.date ? new Date(t.date).toLocaleDateString() : ''}</td>
                          <td>{t.location}</td>
                          <td>₹{t.entry_fee}</td>
                          <td className={t.statusClass}>{t.status}</td>
                          <td>
                            {!t.alreadyEnrolled ? (
                              <form onSubmit={(e) => { e.preventDefault(); joinIndividual(t._id); }}>
                                <button type="submit" disabled={!subscriptionActive || loading}>
                                  Join {!subscriptionActive ? '(SUBSCRIPTION REQUIRED)' : ''}
                                </button>
                              </form>
                            ) : (
                              <div className="enrolled-actions">
                                <span className="status-pill enrolled">ENROLLED</span>
                                <>
                                  <a href={`/player/pairings?tournament_id=${t._id}&rounds=${Math.ceil((t.no_of_rounds || t.noOfRounds || 5) / 2)}`} className="btn small"><i className="fas fa fa-chess-board" /> Pairings</a>
                                  <a href={`/player/rankings?tournament_id=${t._id}`} className="btn small"><i className="fas fa-medal" /> Live Standings</a>
                                </>
                                {complaintTournamentIds.has(String(t._id)) ? (
                                  <span className="status-pill pending">COMPLAINT SUBMITTED</span>
                                ) : (
                                  <button
                                    className="btn small complaint-action-btn"
                                    onClick={() => openComplaintModal(t._id)}
                                  >
                                    <i className="fas fa-exclamation-circle" /> Complaint
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="more-container">
              {individualVisibleCount < filteredIndividuals.length && (
                <button type="button" className="more" onClick={() => setIndividualVisibleCount(Math.min(individualVisibleCount + ROWS_PER_PAGE, filteredIndividuals.length))}>
                  <i className="fas fa-chevron-down" /> More
                </button>
              )}
              {individualVisibleCount > ROWS_PER_PAGE && (
                <button type="button" className="hide" onClick={() => setIndividualVisibleCount(ROWS_PER_PAGE)}>
                  <i className="fas fa-chevron-up" /> Hide
                </button>
              )}
            </div>

          </>
        )}

        {/* Team Tournaments */}
        {activeTab === 'Team' && (
          <>
            <h2 className="black-h2">Available Team Tournaments</h2>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search team tournaments..."
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
              />
              <select
                value={searchTeamType}
                onChange={(e) => setSearchTeamType(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="location">Location</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className={`form-container ${loading ? 'loading' : ''}`}>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Location</th>
                      <th>Entry Fee</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.length === 0 ? (
                      <tr><td colSpan="6" className="empty-message">No team tournaments available</td></tr>
                    ) : (
                      filteredTeams.slice(0, teamVisibleCount).map(t => (
                        <tr key={t._id}>
                          <td>{t.name}</td>
                          <td>{t.date ? new Date(t.date).toLocaleDateString() : ''}</td>
                          <td>{t.location}</td>
                          <td>₹{t.entry_fee}</td>
                          <td className={t.statusClass}>{t.status}</td>
                          <td>
                            {!t.alreadyJoined ? (
                              <>
                                <button type="button" className="join-team-btn" disabled={!subscriptionActive || loading || !raw.username} onClick={() => setOpenJoinFormId(openJoinFormId === t._id ? null : t._id)}>
                                  Join {!subscriptionActive ? '(SUBSCRIPTION REQUIRED)' : !raw.username ? <GlobalLoader style={{padding:0, width:'1em', display:'inline'}}/> : ''}
                                </button>
                                {openJoinFormId === t._id && (
                                  <div className="join-form active">
                                    <form onSubmit={(e) => {
                                      e.preventDefault();
                                      const player1 = raw.username; // Captain is always player1
                                      const player2 = e.currentTarget.elements.player2.value.trim();
                                      const player3 = e.currentTarget.elements.player3.value.trim();
                                      if (!player1) {
                                        const err = 'Unable to determine your username. Please refresh the page.';
                                        setMessage({ text: err, isError: true });
                                        alert(err);
                                        return;
                                      }
                                      if (!player2 || !player3) {
                                        const err = 'Please enter usernames for both teammates.';
                                        setMessage({ text: err, isError: true });
                                        alert(err);
                                        return;
                                      }
                                      if (player1 === player2 || player1 === player3 || player2 === player3) {
                                        const err = 'All three players must be different.';
                                        setMessage({ text: err, isError: true });
                                        alert(err);
                                        return;
                                      }
                                      joinTeam(t._id, { player1, player2, player3 });
                                    }}>
                                      <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', opacity: 0.8 }}>
                                        <i className="fas fa-info-circle" /> You (captain) + 2 teammates = 3 players
                                      </div>
                                      <label>Player 1 (You - Captain):</label>
                                      <input type="text" name="player1" value={raw.username} disabled style={{ opacity: 0.7 }} />
                                      <label>Player 2 (Username):</label>
                                      <input type="text" name="player2" required placeholder="Enter teammate's username" />
                                      <label>Player 3 (Username):</label>
                                      <input type="text" name="player3" required placeholder="Enter teammate's username" />
                                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.7 }}>
                                        Teammates will receive a request to approve joining your team.
                                      </div>
                                      <button type="submit" className="join-team-btn" disabled={loading}>{loading ? 'Submitting...' : 'Submit Team'}</button>
                                    </form>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="enrolled-actions">
                                {t.approved ? (
                                  <span className="status-pill enrolled">ENROLLED</span>
                                ) : (
                                  <span className="status-pill pending">PENDING APPROVAL</span>
                                )}
                                {t.needsApproval && (
                                  <button className="btn small" onClick={() => approveTeamRequest(t.enrollmentId)} disabled={loading}>Approve</button>
                                )}
                                {!t.approved && !t.needsApproval && (
                                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Waiting for teammates</span>
                                )}
                                {t.approved && (
                                  <>
                                    <a href={`/player/pairings?tournament_id=${t._id}&rounds=${Math.ceil((t.no_of_rounds || t.noOfRounds || 5) / 2)}&type=team`} className="btn small"><i className="fas fa-chess-board" /> Pairings</a>
                                    <a href={`/player/rankings?tournament_id=${t._id}&type=team`} className="btn small"><i className="fas fa-medal" /> Live Standings</a>
                                    {complaintTournamentIds.has(String(t._id)) ? (
                                      <span className="status-pill pending">COMPLAINT SUBMITTED</span>
                                    ) : (
                                      <button
                                        className="btn small complaint-action-btn"
                                        onClick={() => openComplaintModal(t._id)}
                                      >
                                        <i className="fas fa-exclamation-circle" /> Complaint
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="more-container">
              {teamVisibleCount < filteredTeams.length && (
                <button type="button" className="more" onClick={() => setTeamVisibleCount(Math.min(teamVisibleCount + ROWS_PER_PAGE, filteredTeams.length))}>
                  <i className="fas fa-chevron-down" /> More
                </button>
              )}
              {teamVisibleCount > ROWS_PER_PAGE && (
                <button type="button" className="hide" onClick={() => setTeamVisibleCount(ROWS_PER_PAGE)}>
                  <i className="fas fa-chevron-up" /> Hide
                </button>
              )}
            </div>
          </>
        )}

        {/* History Tab */}
        {activeTab === 'History' && (
          <>
            <h2 className="black-h2"><i className="fas fa-history" /> My Tournament History</h2>

            <div className="search-box">
              <input
                type="text"
                placeholder="Search history..."
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
              />
              <select
                value={searchHistoryType}
                onChange={(e) => setSearchHistoryType(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="location">Location</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="form-container">
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>
                <i className="fas fa-user" /> Individual Tournaments
              </h3>
              {filteredHistoryIndividuals.length === 0 ? (
                <div className="empty-message">No individual tournaments found.</div>
              ) : (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Tournament</th>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Entry Fee</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistoryIndividuals
                        .map((e, idx) => (
                          <tr key={e.tournament?._id || idx}>
                            <td>{e.tournament?.name || 'N/A'}</td>
                            <td>{e.tournament?.date ? new Date(e.tournament.date).toLocaleDateString() : 'N/A'}</td>
                            <td>{e.tournament?.location || 'N/A'}</td>
                            <td>{e.tournament?.entry_fee != null ? `₹${e.tournament.entry_fee}` : 'N/A'}</td>
                            <td>{e.tournament?.status?.toLowerCase() === 'approved' ? 'Joined' : (e.tournament?.status || 'N/A')}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="form-container" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>
                <i className="fas fa-users" /> Team Tournaments
              </h3>
              {filteredHistoryTeams.length === 0 ? (
                <div className="empty-message">No team tournaments found.</div>
              ) : (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Tournament</th>
                        <th>Date</th>
                        <th>Location</th>
                        <th>Entry Fee</th>
                        <th>Status</th>
                        <th>Captain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistoryTeams
                        .map((e, idx) => {
                          const actualStatus = e.status || (e.approved === 1 ? 'approved' : e.approved === -1 ? 'rejected' : 'pending');
                          let displayStatus = actualStatus === 'approved' ? 'Joined' : actualStatus.toUpperCase();
                          
                          let isExpired = false;
                          if (e.tournament?.date && actualStatus === 'pending') {
                            const tDate = new Date(e.tournament.date);
                            if (e.tournament.time && e.tournament.time.includes(':')) {
                               const [h, m] = e.tournament.time.split(':');
                               tDate.setHours(h, m, 0, 0);
                            }
                            if (tDate.getTime() < Date.now()) {
                               isExpired = true;
                               displayStatus = 'EXPIRED';
                            }
                          }

                          if (!isExpired && actualStatus === 'pending') {
                            const waitingFor = [];
                            if (!e.player1_approved) waitingFor.push(e.player1_name);
                            if (!e.player2_approved) waitingFor.push(e.player2_name);
                            if (!e.player3_approved) waitingFor.push(e.player3_name);
                            
                            displayStatus = `Needs approval from: ${waitingFor.join(', ')}`;
                          } else if (actualStatus === 'approved' && e.tournament?.status?.toLowerCase() === 'completed') {
                            displayStatus = 'Completed';
                          }
                          
                          return (
                            <tr key={e._id || e.tournament?._id || idx}>
                              <td>{e.tournament?.name || 'N/A'}</td>
                              <td>{e.tournament?.date ? new Date(e.tournament.date).toLocaleDateString() : 'N/A'}</td>
                              <td>{e.tournament?.location || 'N/A'}</td>
                              <td>{e.tournament?.entry_fee != null ? `₹${e.tournament.entry_fee}` : 'N/A'}</td>
                              <td>{displayStatus}</td>
                              <td>{e.captainName || 'N/A'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Complaints Tab */}
        {activeTab === 'Complaints' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 className="black-h2" style={{ marginBottom: 0 }}><i className="fas fa-exclamation-circle" /> My Complaints</h2>
              <button type="button" className="btn small" onClick={loadComplaints} disabled={complaintsLoading}>
                <i className="fas fa-sync" /> Refresh
              </button>
            </div>

            <div className={`form-container ${complaintsLoading ? 'loading' : ''}`} style={{ marginTop: '1rem' }}>
              {complaintsLoading ? (
                <div className="empty-message">Loading complaints...</div>
              ) : complaints.length === 0 ? (
                <div className="empty-message">No complaints submitted yet.</div>
              ) : (
                <div className="player-complaints-grid">
                  {complaints.map((c) => (
                    <div key={c._id || `${c.tournament_id}-${c.created_at || c.subject}`} className="player-complaint-card">
                      <div className="player-complaint-header">
                        <div className="player-complaint-title">{c.subject || 'Tournament Complaint'}</div>
                        <span className={`player-complaint-status ${(c.status || 'pending').toLowerCase()}`}>
                          {(c.status || 'pending').toUpperCase()}
                        </span>
                      </div>

                      <div className="player-complaint-meta">
                        <div><strong>Tournament:</strong> {c.tournament_name || 'N/A'}</div>
                        <div>
                          <strong>Submitted:</strong>{' '}
                          {c.created_at ? new Date(c.created_at).toLocaleString() : 'N/A'}
                        </div>
                        {c.resolved_at && (
                          <div>
                            <strong>Resolved:</strong>{' '}
                            {new Date(c.resolved_at).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div className="player-complaint-message">
                        {c.message || 'No complaint message available.'}
                      </div>

                      <div className="player-complaint-response">
                        <div className="player-complaint-response-label">Coordinator Response</div>
                        <div>{c.response || 'No response yet.'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <button type="button" className="back-to-dashboard" onClick={() => navigate('/player/player_dashboard')}>
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>

      {/* Complaint Modal */}
      {complaintModalOpen && (
        <div className="complaint-modal-overlay">
          <div className="complaint-modal">
            <button
              onClick={closeComplaintModal}
              className="complaint-close-btn"
            >
              <i className="fas fa-times" />
            </button>
            <h3 className="complaint-modal-title">
              <i className="fas fa-exclamation-triangle" /> Submit Complaint
            </h3>
            <form onSubmit={handleComplaintSubmit}>
              <div className="complaint-form-group">
                <label className="complaint-form-label">Subject:</label>
                <input
                  type="text"
                  value={complaintForm.subject}
                  onChange={(e) => setComplaintForm({ ...complaintForm, subject: e.target.value })}
                  className="complaint-modal-input"
                  placeholder="Enter complaint subject"
                  required
                />
              </div>
              <div className="complaint-form-group">
                <label className="complaint-form-label">Message:</label>
                <textarea
                  value={complaintForm.message}
                  onChange={(e) => setComplaintForm({ ...complaintForm, message: e.target.value })}
                  className="complaint-modal-textarea"
                  placeholder="Describe your issue with details"
                  required
                />
              </div>
              <button type="submit" className="btn small complaint-submit-btn" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Complaint'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerTournament;
