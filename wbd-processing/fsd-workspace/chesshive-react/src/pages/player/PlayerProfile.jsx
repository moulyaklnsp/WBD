import React, { useEffect, useMemo, useState } from 'react';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useNavigate } from 'react-router-dom';

function PlayerProfile() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();

  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }
  const [player, setPlayer] = useState({});

  const styles = useMemo(() => ({
    msgBox: {
      padding: '1rem',
      borderRadius: 8,
      marginBottom: '1.5rem',
      textAlign: 'center',
    },
    success: { backgroundColor: 'rgba(var(--sea-green-rgb), 0.08)', color: 'var(--sea-green)' },
    error: { backgroundColor: '#ffebee', color: '#c62828' }
    ,
    themeBtn: { background: 'transparent', border: '2px solid var(--sea-green)', color: 'var(--sea-green)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold' }
  }), []);

  const fetchWithAuth = async (url, options = {}) => {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (res.status === 401) {
      navigate('/login');
      return null;
    }
    return res;
  };

  const loadProfile = async () => {
    try {
      const res = await fetchWithAuth('/player/api/profile');
      if (!res) return; // redirected
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load profile');

      if (data.successMessage) setMessage({ type: 'success', text: data.successMessage });
      if (data.errorMessage) setMessage({ type: 'error', text: data.errorMessage });

      setPlayer(data.player || {});
    } catch (err) {
      setMessage({ type: 'error', text: `Error loading profile: ${err.message}` });
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm('Are you sure you want to permanently delete your account?');
    if (!confirmDelete) return;
    try {
      const res = await fetchWithAuth('/player/api/deleteAccount', { method: 'DELETE' });
      if (!res) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete account.');
      alert('Your account has been deleted successfully.');
      navigate('/login');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gamesPlayed = player.gamesPlayed || 0;
  const wins = player.wins || 0;
  const losses = player.losses || 0;
  const draws = player.draws || 0;
  const winRate = Math.round(player.winRate || 0) + '%';
  const rating = player.rating || 'Unrated';
  const walletBalance = player.walletBalance || 0;
  const sales = Array.isArray(player.sales) ? player.sales : [];

  return (
    <div>
      <style>{`
        /* using global theme variables */
        *{ margin:0; padding:0; box-sizing:border-box; }
        .page { font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .container-player-profile { max-width:1200px; margin:0 auto; }
        h1,h2 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; text-align:center; }
        h1 { font-size:2.5rem; display:flex; align-items:center; justify-content:center; gap:1rem; }
        h1::before { content:'👤'; font-size:2.5rem; }
        .form-container { background:var(--card-bg); border-radius:15px; padding:2rem; box-shadow:none; margin-bottom:2rem; border:1px solid var(--card-border); }
        .profile-info { display:grid; gap:1.5rem; }
        .info-section { background:var(--content-bg); padding:1.5rem; border-radius:8px; border: 1px solid var(--border-color); }
        .info-item { display:flex; align-items:center; gap:1rem; padding:1rem; border-bottom:1px solid rgba(46,139,87,0.2); }
        .info-item:last-child { border-bottom:none; }
        .info-label { font-family:'Cinzel', serif; color:var(--sea-green); font-weight:bold; min-width:150px; display:flex; align-items:center; gap:0.5rem; }
        .wallet { background:var(--sea-green); color:var(--on-accent); padding:2rem; border-radius:8px; text-align:center; margin:2rem 0; }
        .wallet h2 { color:var(--on-accent); margin-bottom:1rem; }
        .wallet-balance { font-size:2rem; font-weight:bold; }
        .purchases { margin-top:2rem; }
        .purchases ul { list-style:none; }
        .purchases li { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb),0.2); display:flex; align-items:center; gap:0.5rem; }
        .actions { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
        .back { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sea-green); color:var(--on-accent); text-decoration:none; padding:0.8rem 1.5rem; border-radius:8px; transition:all 0.3s ease; font-family:'Cinzel', serif; font-weight:bold; }
        .delete-btn { background:#dc3545; color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.3s ease; display:flex; align-items:center; gap:0.5rem; }
        .back:hover, .delete-btn:hover { transform:translateY(-2px); box-shadow:0 4px 8px rgba(0,0,0,0.1); }
        @media (max-width:768px){ .page{ padding:1rem; } .form-container{ padding:1.5rem; } .info-item{ flex-direction:column; align-items:flex-start; gap:0.5rem; } .info-label{ min-width:auto; } .actions{ flex-direction:column; } .back, .delete-btn{ width:100%; justify-content:center; } }
      `}</style>

      <div className="page">
        <div className="container-player-profile">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h1>Player Profile</h1>
            <div>
              
            </div>
          </div>

          {message && (
            <div style={{ ...styles.msgBox, ...(message.type === 'success' ? styles.success : styles.error) }}>
              <i className={message.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'} /> {message.text}
            </div>
          )}

          <div className="form-container">
            <section className="profile-info">
              <div className="info-section">
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-user" /> Name:</span>
                  <span>{player.name || ''}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-envelope" /> Email:</span>
                  <span>{player.email || ''}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-phone" /> Phone:</span>
                  <span>{player.phone || ''}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-id-card" /> FIDE ID:</span>
                  <span>{player.FIDE_ID || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-id-badge" /> AICF ID:</span>
                  <span>{player.AICF_ID || 'N/A'}</span>
                </div>
              </div>

              <div className="info-section">
                <h2><i className="fas fa-chess" /> Player Stats</h2>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-gamepad" /> Games Played:</span>
                  <span>{gamesPlayed}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-trophy" /> Wins:</span>
                  <span>{wins}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-times" /> Losses:</span>
                  <span>{losses}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-handshake" /> Draws:</span>
                  <span>{draws}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-percentage" /> Win Rate:</span>
                  <span>{winRate}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-star" /> Rating:</span>
                  <span>{rating}</span>
                </div>
              </div>

              <div className="wallet">
                <h2><i className="fas fa-wallet" /> Wallet</h2>
                <div className="wallet-balance">₹{walletBalance}</div>
              </div>

              <div className="purchases">
                <h2><i className="fas fa-shopping-bag" /> Items Purchased</h2>
                <ul>
                  {sales.map((item, idx) => (
                    <li key={idx}><i className="fas fa-chess-pawn" /> {item}</li>
                  ))}
                </ul>
                {sales.length === 0 && (
                  <p>No items purchased yet.</p>
                )}
              </div>
            </section>
          </div>

          <div className="form-container actions">
            <a href="/player/player_dashboard" className="back">
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </a>
            <button className="delete-btn" onClick={handleDeleteAccount}>
              <i className="fas fa-trash-alt" /> Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlayerProfile;
