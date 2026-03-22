import React, { useEffect, useMemo, useState } from 'react';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useNavigate } from 'react-router-dom';

const ROWS_PER_PAGE = 5;

function PlayerTournament() {
  const [isDark, toggleTheme] = usePlayerTheme();
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

  // Pagination visible counts
  const [individualVisibleCount, setIndividualVisibleCount] = useState(ROWS_PER_PAGE);
  const [teamVisibleCount, setTeamVisibleCount] = useState(ROWS_PER_PAGE);

  // Helpers
  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (res.status === 401) {
      navigate('/login');
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const loadWalletAndSubscription = async () => {
    const out = await fetchJson('/player/api/profile');
    if (!out) return;
    const { res, data } = out;
    if (!res.ok) {
      setMessage({ text: 'Failed to load wallet balance and subscription status.', isError: true });
      setWalletBalance(0);
      return;
    }
    setWalletBalance(data.player?.walletBalance ?? 0);
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

  useEffect(() => {
    loadWalletAndSubscription();
    loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived tournaments with enrollment flags
  const individualTournaments = useMemo(() => {
    const todayStr = new Date().toDateString();
    return (raw.tournaments || [])
      .filter(t => {
        const type = (t.type || 'individual').toLowerCase();
        return type === 'individual' || type === 'solo';
      })
      .map(t => {
        const alreadyEnrolled = (raw.enrolledIndividualTournaments || []).some(e => e.tournament?._id?.toString() === t._id?.toString());
        const date = new Date(t.date);
        const status = date.toDateString() === todayStr ? 'Ongoing' : 'Yet to Start';
        const statusClass = date.toDateString() === todayStr ? 'status-ongoing' : 'status-yet-to-start';
        return { ...t, alreadyEnrolled, status, statusClass, date };
      });
  }, [raw]);

  const teamTournaments = useMemo(() => {
    const todayStr = new Date().toDateString();
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
        const status = date.toDateString() === todayStr ? 'Ongoing' : 'Yet to Start';
        const statusClass = date.toDateString() === todayStr ? 'status-ongoing' : 'status-yet-to-start';
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

  // Filtering helpers
  const applyFilter = (list, search, type) => {
    const ft = (search || '').toLowerCase().trim();
    if (!ft) return list;
    return list.filter(row => {
      if (type === 'name') return (row.name || '').toLowerCase().includes(ft);
      if (type === 'location') return (row.location || '').toLowerCase().includes(ft);
      if (type === 'status') return (row.status || '').toLowerCase().includes(ft);
      return true;
    });
  };

  const filteredIndividuals = applyFilter(individualTournaments, searchIndividual, searchIndividualType);
  const filteredTeams = applyFilter(teamTournaments, searchTeam, searchTeamType);

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
        if (typeof data.walletBalance !== 'undefined') setWalletBalance(data.walletBalance);
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
        if (typeof data.walletBalance !== 'undefined') setWalletBalance(data.walletBalance);
        await loadTournaments();
      } else {
        setMessage({ text: data.error || 'Failed to join team tournament', isError: true });
      }
    } catch (err) {
      setMessage({ text: 'Error joining team tournament.', isError: true });
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

  const addFunds = async (amount) => {
    if (loading) return;
    setLoading(true);
    try {
      const out = await fetchJson('/player/api/add-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(amount, 10) })
      });
      if (!out) return;
      const { res, data } = out;
      if (res.ok) {
        setWalletBalance(data.walletBalance);
        setMessage({ text: 'Funds added successfully!', isError: false });
      } else {
        setMessage({ text: data.error || 'Failed to add funds', isError: true });
      }
    } catch (err) {
      setMessage({ text: 'Error adding funds.', isError: true });
    } finally {
      setLoading(false);
    }
  };

  // Local UI state: which team join form is open
  const [openJoinFormId, setOpenJoinFormId] = useState(null);



  return (
    <div>
      <style>{`
        /* Use global CSS variables from index.css; do not override theme here. */
        *{ margin:0; padding:0; box-sizing:border-box; }
        html,body,#root{ height:100%; background:var(--page-bg); color:var(--text-color); }
        .content{ font-family:'Playfair Display', serif; min-height:100vh; width:100vw; padding:2rem clamp(1rem,2vw,2rem); background:var(--page-bg); }
        h1,h2{ font-family:'Cinzel', serif; color:var(--sky-blue); margin:0 0 1rem 0; letter-spacing:.5px; }
        .black-h2{ color:var(--sky-blue); font-family:'Cinzel', serif; margin-top:2rem; margin-bottom:.75rem; }
        .form-container{ background:var(--panel-bg); padding:20px; border-radius:14px; box-shadow:0 4px 24px rgba(0,0,0,0.4); margin-bottom:24px; overflow-x:auto; border:1px solid var(--border-color); }
        table{ width:100%; border-collapse:collapse; background:var(--panel-bg); min-width:760px; font-family:'Playfair Display', serif; }
        th{ background:var(--sea-green); color:var(--on-accent); padding:12px; text-align:left; font-weight:600; font-size:.9rem; letter-spacing:.5px; }
        td{ padding:12px; border:1px solid var(--border-color); color:var(--text-color); font-size:.9rem; }
        tbody tr:nth-child(even){ background:var(--row-hover-bg); }
        tr:hover{ background:var(--row-hover-bg); }
        .status-ongoing{ color:var(--yellow); font-weight:bold; }
        .status-yet-to-start{ color:var(--sea-green); font-weight:bold; }
        .wallet-section{ background:var(--sea-green); color:var(--on-accent); padding:24px 28px; border-radius:18px; text-align:center; margin-bottom:2rem; position:relative; overflow:hidden; }
        .wallet-section::after{ content:""; position:absolute; inset:0; background:radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 70%); pointer-events:none; }
        .wallet-section h3{ color:var(--on-accent); margin:0 0 1.25rem 0; font-family:'Cinzel', serif; font-size:1.1rem; }
        .wallet-section form{ display:flex; flex-direction:column; gap:12px; max-width:340px; margin:0 auto; }
        .wallet-section input[type='number']{ width:100%; padding:12px; border:2px solid var(--sky-blue); border-radius:10px; font-size:16px; background:#03101d; color:var(--text-color); outline:none; font-family:'Playfair Display', serif; }
        .wallet-section input[type='number']:focus{ box-shadow:0 0 0 3px rgba(30,80,255,0.35); }
        .wallet-section button{ background:var(--sky-blue); color:var(--on-accent); border:none; padding:14px 24px; border-radius:10px; cursor:pointer; font-weight:600; transition:background .25s, transform .25s; font-family:'Cinzel', serif; letter-spacing:.5px; }
        .wallet-section button:hover{ background:var(--sky-blue-hover); transform:translateY(-2px); }
        .back-to-dashboard{ position:fixed; bottom:30px; right:30px; background:var(--sea-green); color:var(--on-accent); padding:12px 24px; border-radius:10px; text-decoration:none; box-shadow:0 4px 18px rgba(0,0,0,0.4); font-weight:600; font-family:'Cinzel', serif; letter-spacing:.5px; }
        .back-to-dashboard:hover{ filter:brightness(1.08); transform:translateY(-3px); }
        button,.btn{ background:var(--sky-blue); color:var(--on-accent); border:none; padding:10px 18px; border-radius:10px; cursor:pointer; transition:background .25s, transform .25s; font-family:'Cinzel', serif; font-weight:600; letter-spacing:.4px; }
        button:hover,.btn:hover{ background:var(--sky-blue-hover); transform:translateY(-2px); }
        button[disabled]{ background:#3d4b60; cursor:not-allowed; opacity:.6; }
        .subscription-message{ background:#102436; color:var(--sky-blue); padding:16px 20px; border-radius:12px; margin-bottom:26px; font-weight:600; font-family:'Playfair Display', serif; border:1px solid var(--border-color); }
        .subscription-message a{ color:var(--sea-green); text-decoration:underline; }
        .search-box{ margin-bottom:1rem; display:flex; gap:1rem; align-items:center; flex-wrap:wrap; }
        .search-box input{ padding:0.65rem 1rem; width:100%; max-width:320px; border:2px solid var(--sky-blue); border-radius:10px; font-size:.95rem; transition:all 0.25s ease; font-family:'Playfair Display', serif; background:#03101d; color:var(--text-color); outline:none; }
        .search-box input:focus{ box-shadow:0 0 0 3px rgba(30,80,255,0.35); }
        .search-box select{ padding:0.65rem 1rem; border:2px solid var(--sky-blue); border-radius:10px; font-size:.95rem; background:#03101d; color:var(--text-color); font-family:'Cinzel', serif; cursor:pointer; transition:all 0.25s ease; }
        .more-container{ text-align:center; margin:1.25rem 0 1.75rem; display:flex; justify-content:center; gap:1rem; }
        .more,.hide{ display:inline-flex; align-items:center; gap:0.6rem; background:var(--sky-blue); color:var(--on-accent); text-decoration:none; padding:0.85rem 1.6rem; border-radius:10px; transition:all 0.25s ease; font-family:'Cinzel', serif; font-weight:600; letter-spacing:.4px; }
        .more:hover,.hide:hover{ background:var(--sky-blue-hover); transform:translateY(-2px); }
        .empty-message{ text-align:center; padding:2.25rem; color:var(--sea-green); font-style:italic; font-family:'Playfair Display', serif; }
        .loading{ opacity:0.5; pointer-events:none; }
        .enrolled-actions{ display:flex; flex-wrap:wrap; align-items:center; gap:0.6rem; }
        .status-pill{ display:inline-block; padding:6px 14px; border-radius:18px; font-size:.7rem; letter-spacing:.4px; font-weight:700; font-family:'Cinzel', serif; box-shadow:0 2px 6px rgba(0,0,0,0.25); }
        .status-pill.enrolled{ background:var(--sky-blue); color:var(--on-accent); }
        .status-pill.pending{ background:var(--yellow); color:#000; }
        .btn.small{ padding:8px 14px; font-size:.7rem; border-radius:8px; }
        .join-form{ margin-top:10px; background:#03101d; border:1px solid var(--border-color); padding:14px; border-radius:10px; }
        .join-form label{ color: var(--text-color); font-weight:600; font-size:.8rem; font-family:'Cinzel', serif; }
        .join-form input{ background:#0d2538; color: var(--text-color); border:2px solid var(--sky-blue); padding:8px 10px; border-radius:8px; font-family:'Playfair Display', serif; margin-bottom:8px; }
        .join-form input:focus{ box-shadow:0 0 0 3px rgba(30,80,255,0.35); }
        @media (max-width:768px){
          .content{ padding:1.25rem 1rem 4rem; width:100vw; }
          table{ min-width:640px; }
          .wallet-section{ padding:20px; }
          .back-to-dashboard{ bottom:20px; right:20px; padding:10px 18px; }
          .search-box input,.search-box select{ max-width:100%; }
        }
      `}</style>

      <div className="content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1><i className="fas fa-trophy" /> Tournaments</h1>
        </div>

        {/* Message banner */}
        {message && (
          <div style={{ padding: 15, borderRadius: 5, marginBottom: 20, backgroundColor: message.isError ? 'var(--red)' : 'var(--sky-blue)', color: message.isError ? 'var(--on-accent)' : 'var(--sea-green)', fontWeight: 'bold' }}>
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
          <h3>Wallet Balance: ₹<span>{walletBalance}</span></h3>
          <form onSubmit={(e) => { e.preventDefault(); const amount = e.currentTarget.amount.value; if (!amount) return; addFunds(amount); e.currentTarget.reset(); }}>
            <input
              type="number"
              name="amount"
              placeholder="Enter amount"
              min="1"
              required
              style={{
                backgroundColor: isDark ? '#000' : 'var(--card-bg)',
                color: isDark ? 'var(--on-dark)' : 'var(--text-color)',
                borderColor: isDark ? '#444' : 'var(--card-border)'
              }}
            />
            <input type="hidden" name="redirectTo" value="/player/player_tournament" />
            <button type="submit" disabled={loading}>Add Funds</button>
          </form>
        </div>

        {/* Individual Tournaments */}
        <h2 className="black-h2">Available Individual Tournaments</h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search individual tournaments..."
            value={searchIndividual}
            onChange={(e) => setSearchIndividual(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000' : 'var(--card-bg)',
              color: isDark ? 'var(--on-dark)' : 'var(--text-color)',
              borderColor: isDark ? '#444' : 'var(--card-border)'
            }}
          />
          <select
            value={searchIndividualType}
            onChange={(e) => setSearchIndividualType(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000' : 'var(--card-bg)',
              color: isDark ? 'var(--on-dark)' : 'var(--text-color)',
              borderColor: isDark ? '#444' : 'var(--card-border)'
            }}
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
              {filteredIndividuals.length === 0 ? (
                <tr><td colSpan="6" className="empty-message">No individual tournaments available</td></tr>
              ) : (
                filteredIndividuals.slice(0, individualVisibleCount).map(t => (
                  <tr key={t._id}>
                    <td>{t.name}</td>
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
                          <a href={`/player/pairings?tournament_id=${t._id}&rounds=5`} className="btn small"><i className="fas fa-chess-board" /> Pairings</a>
                          <a href={`/player/rankings?tournament_id=${t._id}`} className="btn small"><i className="fas fa-medal" /> Results</a>
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

        {/* Team Tournaments */}
        <h2 className="black-h2">Available Team Tournaments</h2>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search team tournaments..."
            value={searchTeam}
            onChange={(e) => setSearchTeam(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000' : 'var(--card-bg)',
              color: isDark ? 'var(--on-dark)' : 'var(--text-color)',
              borderColor: isDark ? '#444' : 'var(--card-border)'
            }}
          />
          <select
            value={searchTeamType}
            onChange={(e) => setSearchTeamType(e.target.value)}
            style={{
              backgroundColor: isDark ? '#000' : 'var(--card-bg)',
              color: isDark ? 'var(--on-dark)' : 'var(--text-color)',
              borderColor: isDark ? '#444' : 'var(--card-border)'
            }}
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
                          <button type="button" className="join-team-btn" disabled={!subscriptionActive || loading} onClick={() => setOpenJoinFormId(openJoinFormId === t._id ? null : t._id)}>
                            Join {!subscriptionActive ? '(SUBSCRIPTION REQUIRED)' : ''}
                          </button>
                          {openJoinFormId === t._id && (
                            <div className="join-form active">
                              <form onSubmit={(e) => {
                                e.preventDefault();
                                const player1 = e.currentTarget.player1.value;
                                const player2 = e.currentTarget.player2.value;
                                const player3 = e.currentTarget.player3.value;
                                joinTeam(t._id, { player1, player2, player3 });
                              }}>
                                <label>Player 1:</label><input type="text" name="player1" required />
                                <label>Player 2:</label><input type="text" name="player2" required />
                                <label>Player 3:</label><input type="text" name="player3" required />
                                <button type="submit" disabled={loading}>Submit Team</button>
                              </form>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="enrolled-actions">
                          {t.approved ? (
                            <span className="status-pill enrolled">ENROLLED</span>
                          ) : (
                            <span className="status-pill pending">PENDING</span>
                          )}
                          {t.needsApproval && (
                            <button className="btn small" onClick={() => approveTeamRequest(t.enrollmentId)} disabled={loading}>Approve</button>
                          )}
                          {t.approved && (
                            <>
                              <a href={`/player/pairings?tournament_id=${t._id}&rounds=5`} className="btn small"><i className="fas fa-chess-board" /> Pairings</a>
                              <a href={`/player/rankings?tournament_id=${t._id}`} className="btn small"><i className="fas fa-medal" /> Results</a>
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
      </div>

      <a href="/player/player_dashboard" className="back-to-dashboard">
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </a>
    </div>
  );
}

export default PlayerTournament;
