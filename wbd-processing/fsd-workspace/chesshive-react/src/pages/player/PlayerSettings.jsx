import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';

function PlayerSettings() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('player_notifications_enabled');
    if (saved === null) {
      localStorage.setItem('player_notifications_enabled', 'true');
      setNotifEnabled(true);
    } else {
      setNotifEnabled(saved === 'true');
    }
  }, []);

  const saveNotifPref = (value) => {
    setNotifEnabled(value);
    localStorage.setItem('player_notifications_enabled', value ? 'true' : 'false');
    setSuccessMsg('Notification preference saved');
    setTimeout(() => setSuccessMsg(''), 1500);
  };

  const deleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account?')) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/player/api/deleteAccount', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Deleted; redirect to login
      navigate('/login');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const logout = () => {
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        /* theme variables handled by player-neo */
        .page { font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .card { background:var(--content-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--border-color); }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:1.5rem; }
        .row { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
        .btn { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        .btn.secondary { background:var(--sky-blue); color:var(--on-accent); }
        .danger { background:#ff4d4d; }
        .switch { display:flex; align-items:center; gap:0.6rem; }
        .error { color:#b00020; margin:0.5rem 0; }
        .success { color:#2e7d32; margin:0.5rem 0; }
      `}</style>

      <div className="page">
        <div className="row" style={{ marginBottom:'1rem' }}>
          <h1 style={{ margin:0 }}>Player Settings</h1>
          <button className="btn secondary" onClick={() => navigate('/player/player_dashboard')}>Back to Dashboard</button>
        </div>

        <div className="card">
          <h3>Theme</h3>
          <div className="row">
            <span>Current: {isDark ? 'Dark' : 'Light'}</span>
            <button className="btn secondary" onClick={toggleTheme}>{isDark ? 'Switch to Light' : 'Switch to Dark'}</button>
          </div>
        </div>

        <div className="card">
          <h3>Notifications</h3>
          <div className="switch">
            <label htmlFor="notif-toggle">Enable notifications</label>
            <input id="notif-toggle" type="checkbox" checked={notifEnabled} onChange={(e) => saveNotifPref(e.target.checked)} />
          </div>
          {successMsg && <div className="success">{successMsg}</div>}
        </div>

        <div className="card">
          <h3>Account</h3>
          {errorMsg && <div className="error">{errorMsg}</div>}
          <div className="row" style={{ flexWrap:'wrap' }}>
            <button className="btn danger" onClick={deleteAccount} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete Account'}</button>
            <button className="btn" onClick={logout}>Log Out</button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PlayerSettings;