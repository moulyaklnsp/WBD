import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { fetchAsPlayer, safePut, safePost } from '../../utils/fetchWithRole';

function PlayerSettings() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Settings state
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [wallpaper, setWallpaper] = useState('default');
  const [wallpaperUrl, setWallpaperUrl] = useState('');
  const [uploadingWp, setUploadingWp] = useState(false);

  // Account state
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const flash = (msg, isError = false) => {
    if (isError) { setErrorMsg(msg); setSuccessMsg(''); }
    else { setSuccessMsg(msg); setErrorMsg(''); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 3000);
  };

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetchAsPlayer('/player/api/settings');
      if (res.ok) {
        let data;
        try { const t = await res.text(); data = JSON.parse(t); } catch { data = {}; }
        const s = data.settings || {};
        setNotifEnabled(s.notifications !== false);
        if (s.wallpaper) setWallpaper(s.wallpaper);
        if (s.wallpaper_url) {
          setWallpaperUrl(s.wallpaper_url);
          localStorage.setItem('player_wallpaper_url', s.wallpaper_url);
        }
      }
    } catch { /* use defaults */ }
    // Also sync local notification pref
    const saved = localStorage.getItem('player_notifications_enabled');
    if (saved !== null) setNotifEnabled(saved === 'true');
  }, []);

  // Build inline style for the .page div based on selected wallpaper
  const wpUrl = wallpaperUrl || localStorage.getItem('player_wallpaper_url') || '';
  let pageStyle = { minHeight: '100vh' };
  if (wallpaper === 'custom' && wpUrl) {
    pageStyle = { minHeight: '100vh', backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${wpUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' };
  }

  // Also apply saved wallpaper on mount from localStorage
  useEffect(() => {
    const savedWp = localStorage.getItem('player_wallpaper');
    if (savedWp && savedWp !== 'default') {
      setWallpaper(savedWp);
    }
    const savedUrl = localStorage.getItem('player_wallpaper_url');
    if (savedUrl) setWallpaperUrl(savedUrl);
  }, []);

  useEffect(() => {
    // Session check
    fetch('/api/session', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d?.userRole !== 'player') navigate('/login'); })
      .catch(() => navigate('/login'));
    loadSettings();
  }, [navigate, loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await safePut('/player/api/settings', {
        notifications: notifEnabled,
        wallpaper,
      });
      if (res.ok) {
        localStorage.setItem('player_notifications_enabled', notifEnabled ? 'true' : 'false');
        localStorage.setItem('player_wallpaper', wallpaper);
        if (wallpaper === 'custom' && wallpaperUrl) {
          localStorage.setItem('player_wallpaper_url', wallpaperUrl);
        }
        flash('Settings saved!');
      } else {
        flash('Failed to save settings', true);
      }
    } catch (e) {
      flash(e.message || 'Save failed', true);
    } finally {
      setSaving(false);
    }
  };

  const handleWallpaperUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { flash('Please select an image file', true); return; }
    if (file.size > 5 * 1024 * 1024) { flash('Image must be under 5MB', true); return; }

    setUploadingWp(true);
    try {
      const formData = new FormData();
      formData.append('wallpaper', file);
      const res = await fetch('/player/api/settings/wallpaper', {
        method: 'POST', credentials: 'include', body: formData
      });
      const data = await res.json();
      if (data.success && data.wallpaper_url) {
        setWallpaper('custom');
        setWallpaperUrl(data.wallpaper_url);
        localStorage.setItem('player_wallpaper', 'custom');
        localStorage.setItem('player_wallpaper_url', data.wallpaper_url);
        flash('Wallpaper uploaded!');
      } else {
        flash(data.error || 'Upload failed', true);
      }
    } catch (err) {
      flash(err.message || 'Upload failed', true);
    } finally {
      setUploadingWp(false);
      e.target.value = '';
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Are you sure you want to permanently DELETE your account? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch('/player/api/deleteAccount', { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        let body = {};
        try { const t = await res.text(); body = JSON.parse(t); } catch { /* ignore */ }
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      localStorage.removeItem('player_wallpaper');
      localStorage.removeItem('player_notifications_enabled');
      flash('Account deleted. Redirecting...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      flash(err.message || 'Failed to delete account', true);
    } finally {
      setDeleting(false);
    }
  };

  const deactivateAccount = async () => {
    if (!window.confirm('Deactivate your account? You can reactivate by logging in again.')) return;
    setDeactivating(true);
    try {
      const res = await safePost('/player/api/deactivateAccount', {});
      let data = {};
      try { const t = await res.text(); data = JSON.parse(t); } catch { /* ignore */ }
      if (res.ok || data.success) {
        localStorage.removeItem('player_wallpaper');
        localStorage.removeItem('player_wallpaper_url');
        localStorage.removeItem('player_notifications_enabled');
        flash('Account successfully deactivated. Redirecting...');
        setTimeout(() => navigate('/login?success-message=' + encodeURIComponent('Account successfully deactivated. You can reactivate by logging in again.')), 1500);
      } else {
        flash(data.message || data.error || 'Deactivation failed', true);
      }
    } catch (e) {
      flash(e.message || 'Deactivation failed', true);
    } finally {
      setDeactivating(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch { /* ignore */ }
    navigate('/login');
  };

  const switchAccount = () => {
    // Clear current session, local data, and redirect to login
    localStorage.removeItem('player_wallpaper');
    localStorage.removeItem('player_notifications_enabled');
    fetch('/api/logout', { method: 'POST', credentials: 'include' })
      .then(() => navigate('/login'))
      .catch(() => navigate('/login'));
  };

  return (
    <div className="page" style={pageStyle}>
      <style>{`
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .settings-wrap{ max-width:800px; margin:0 auto; }
        .settings-header{ display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; }
        .settings-title{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0; font-size:2rem; }
        .card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:15px; padding:1.5rem; margin-bottom:1.25rem; }
        .card h3{ font-family:'Cinzel',serif; color:var(--sea-green); margin:0 0 1rem 0; display:flex; align-items:center; gap:0.6rem; }
        .setting-row{ display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:0.6rem 0; flex-wrap:wrap; }
        .setting-label{ font-weight:500; }
        .setting-hint{ font-size:0.8rem; opacity:0.7; margin-top:0.2rem; }
        .toggle{ position:relative; width:48px; height:26px; }
        .toggle input{ opacity:0; width:0; height:0; }
        .toggle-slider{ position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:var(--card-border); border-radius:13px; transition:0.3s; }
        .toggle-slider:before{ content:''; position:absolute; height:20px; width:20px; left:3px; bottom:3px; background:#fff; border-radius:50%; transition:0.3s; }
        .toggle input:checked + .toggle-slider{ background:var(--sea-green); }
        .toggle input:checked + .toggle-slider:before{ transform:translateX(22px); }
        .wallpaper-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:0.75rem; }
        .wp-option{ height:70px; border-radius:10px; border:3px solid transparent; cursor:pointer; transition:all 0.2s; display:flex; align-items:end; padding:0.3rem 0.5rem; }
        .wp-option.active{ border-color:var(--sea-green); box-shadow:0 0 0 2px rgba(46,139,87,0.3); }
        .wp-option:hover:not(.active){ border-color:rgba(46,139,87,0.4); }
        .wp-label{ font-size:0.7rem; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.5); font-weight:bold; }
        .btn{ background:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1.2rem; border-radius:8px; cursor:pointer; font-family:'Cinzel',serif; font-weight:bold; transition:all 0.2s; }
        .btn:hover{ filter:brightness(1.1); }
        .btn.secondary{ background:var(--sky-blue); color:var(--on-accent); }
        .btn.danger{ background:#e74c3c; }
        .btn.warning{ background:#f39c12; color:#fff; }
        .btn.ghost{ background:transparent; color:var(--sea-green); border:1px solid var(--card-border); }
        .btn-row{ display:flex; gap:0.75rem; flex-wrap:wrap; }
        .alert{ padding:0.75rem 1rem; border-radius:8px; margin-bottom:1rem; }
        .alert-success{ background:rgba(46,139,87,0.12); color:#2E8B57; }
        .alert-error{ background:rgba(231,76,60,0.12); color:#e74c3c; }
        .theme-preview{ display:flex; gap:1rem; align-items:center; }
        .theme-card{ width:100px; height:70px; border-radius:10px; border:3px solid transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; font-family:'Cinzel',serif; font-weight:bold; font-size:0.8rem; transition:all 0.2s; }
        .theme-card.active{ border-color:var(--sea-green); }
        .theme-card:hover:not(.active){ border-color:rgba(46,139,87,0.4); }

      `}</style>

      <div className="settings-wrap">
        <div className="settings-header">
          <h1 className="settings-title"><i className="fas fa-cog" style={{ marginRight: '0.75rem' }} />Settings</h1>
        </div>

        {errorMsg && <div className="alert alert-error">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {/* Theme */}
        <div className="card">
          <h3><i className="fas fa-palette" /> Theme</h3>
          <div className="theme-preview">
            <div className={`theme-card ${!isDark ? 'active' : ''}`} style={{ background: '#f5f5f0', color: '#333' }} onClick={() => isDark && toggleTheme()}>
              <span>☀️ Light</span>
            </div>
            <div className={`theme-card ${isDark ? 'active' : ''}`} style={{ background: '#1a1a2e', color: '#e0e0e0' }} onClick={() => !isDark && toggleTheme()}>
              <span>🌙 Dark</span>
            </div>
          </div>
        </div>

        {/* Wallpaper */}
        <div className="card">
          <h3><i className="fas fa-image" /> Wallpaper</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div
              style={{
                width: 110, height: 70, borderRadius: 10,
                background: wallpaperUrl
                  ? `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), url(${wallpaperUrl}) center/cover`
                  : 'var(--content-bg)',
                border: wallpaper === 'custom' ? '3px solid var(--sea-green)' : '3px dashed var(--card-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                gap: '0.3rem', cursor: 'pointer', flexShrink: 0
              }}
              onClick={() => document.getElementById('wp-upload-input').click()}
            >
              {uploadingWp ? (
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.4rem', color: wallpaperUrl ? '#fff' : 'var(--sea-green)' }} />
              ) : (
                <>
                  <i className="fas fa-cloud-upload-alt" style={{ fontSize: '1.4rem', color: wallpaperUrl ? '#fff' : 'var(--sea-green)' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: wallpaperUrl ? '#fff' : 'var(--sea-green)', textShadow: wallpaperUrl ? '0 1px 3px rgba(0,0,0,0.6)' : 'none' }}>
                    {wallpaper === 'custom' ? 'Change' : 'Upload'}
                  </span>
                </>
              )}
            </div>
            <input id="wp-upload-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleWallpaperUpload} />
            <div>
              {wallpaper === 'custom' && wallpaperUrl ? (
                <>
                  <div style={{ color: 'var(--sea-green)', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    <i className="fas fa-check-circle" /> Wallpaper active
                  </div>
                  <div className="setting-hint">Your dashboard will show the image as background.</div>
                  <button className="btn ghost" style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                    onClick={() => { setWallpaper('default'); setWallpaperUrl(''); localStorage.removeItem('player_wallpaper'); localStorage.removeItem('player_wallpaper_url'); }}>
                    <i className="fas fa-times" /> Remove Wallpaper
                  </button>
                </>
              ) : (
                <div className="setting-hint">Upload an image to set as your dashboard background. Cards will become semi-transparent so the wallpaper shows through.</div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card">
          <h3><i className="fas fa-bell" /> Notifications</h3>
          <div className="setting-row">
            <div>
              <div className="setting-label">In-App Notifications</div>
              <div className="setting-hint">Show alerts for team requests, announcements, and tournament updates</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={notifEnabled} onChange={e => setNotifEnabled(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        {/* Save Button */}
        <button className="btn" style={{ width: '100%', padding: '0.8rem', marginBottom: '1.25rem', fontSize: '1rem' }} onClick={saveSettings} disabled={saving}>
          {saving ? <><i className="fas fa-spinner fa-spin" /> Saving...</> : <><i className="fas fa-save" /> Save Settings</>}
        </button>

        {/* Account Management */}
        <div className="card">
          <h3><i className="fas fa-user-cog" /> Account</h3>
          <div className="btn-row">
            <button className="btn ghost" onClick={switchAccount}>
              <i className="fas fa-exchange-alt" /> Switch Account
            </button>
            <button className="btn warning" onClick={deactivateAccount} disabled={deactivating}>
              {deactivating ? 'Deactivating...' : <><i className="fas fa-pause-circle" /> Deactivate Account</>}
            </button>
            <button className="btn danger" onClick={deleteAccount} disabled={deleting}>
              {deleting ? 'Deleting...' : <><i className="fas fa-trash-alt" /> Delete Account</>}
            </button>
            <button className="btn" onClick={logout}>
              <i className="fas fa-sign-out-alt" /> Log Out
            </button>
          </div>
          <div className="setting-hint" style={{ marginTop: '0.75rem' }}>
            <strong>Deactivate:</strong> Temporarily disable your account. Log in again to reactivate.<br />
            <strong>Delete:</strong> Permanently remove your account and all data. This cannot be undone.
          </div>
        </div>
      </div>
      <button type="button" className="back-to-dashboard" onClick={() => navigate('/player/player_dashboard')}>
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>
    </div>
  );
}

export default PlayerSettings;
