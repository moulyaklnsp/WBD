import React, { useEffect, useMemo, useState, useCallback } from 'react';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { useNavigate } from 'react-router-dom';
import PaymentGatewayModal from '../../components/PaymentGatewayModal';

function PlayerProfile() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();

  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }
  const [player, setPlayer] = useState({});

  // Profile editing (photo + fields)
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', dob: '', phone: '', AICF_ID: '', FIDE_ID: '' });
  const [saving, setSaving] = useState(false);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoStatus, setPhotoStatus] = useState(null); // { type: 'success' | 'error', text: string }

  const styles = useMemo(() => ({
    msgBox: {
      padding: '1rem',
      borderRadius: 8,
      marginBottom: '1.5rem',
      textAlign: 'center',
    },
    success: { backgroundColor: 'rgba(var(--sea-green-rgb), 0.08)', color: 'var(--sea-green)' },
    error: { backgroundColor: '#ffebee', color: '#c62828' },
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

  const dateToInput = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    return () => {
      try {
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      } catch (_) {
        // ignore
      }
    };
  }, [photoPreviewUrl]);

  const selectPhotoFile = (file) => {
    setPhotoStatus(null);
    if (!file) {
      setPhotoFile(null);
      if (photoPreviewUrl) {
        try { URL.revokeObjectURL(photoPreviewUrl); } catch (_) { /* ignore */ }
      }
      setPhotoPreviewUrl('');
      return;
    }
    if (!file.type?.startsWith('image/')) {
      setPhotoStatus({ type: 'error', text: 'Please choose an image file.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoStatus({ type: 'error', text: 'Max photo size is 2MB.' });
      return;
    }
    setPhotoFile(file);
    if (photoPreviewUrl) {
      try { URL.revokeObjectURL(photoPreviewUrl); } catch (_) { /* ignore */ }
    }
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const beginEdit = () => {
    setMessage(null);
    setPhotoStatus(null);
    setDraft({
      name: (player.name || '').toString(),
      dob: dateToInput(player.dob),
      phone: (player.phone || '').toString(),
      AICF_ID: (player.AICF_ID || '').toString(),
      FIDE_ID: (player.FIDE_ID || '').toString(),
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setSaving(false);
    setPhotoStatus(null);
    setPhotoFile(null);
    if (photoPreviewUrl) {
      try { URL.revokeObjectURL(photoPreviewUrl); } catch (_) { /* ignore */ }
    }
    setPhotoPreviewUrl('');
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    setPhotoStatus(null);
    try {
      const normalizedDraft = {
        name: (draft.name || '').toString(),
        dob: (draft.dob || '').toString(),
        phone: (draft.phone || '').toString(),
        AICF_ID: (draft.AICF_ID || '').toString(),
        FIDE_ID: (draft.FIDE_ID || '').toString(),
      };

      const currentValues = {
        name: (player.name || '').toString(),
        dob: dateToInput(player.dob),
        phone: (player.phone || '').toString(),
        AICF_ID: (player.AICF_ID || '').toString(),
        FIDE_ID: (player.FIDE_ID || '').toString()
      };

      const payload = Object.keys(normalizedDraft).reduce((acc, key) => {
        if (normalizedDraft[key] !== currentValues[key]) acc[key] = normalizedDraft[key];
        return acc;
      }, {});

      if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
        payload.name = payload.name.trim();
        if (!payload.name) throw new Error('Name is required');
      }

      const hasFieldChanges = Object.keys(payload).length > 0;
      const hasPhotoChange = Boolean(photoFile);

      if (!hasFieldChanges && !hasPhotoChange) {
        setMessage({ type: 'success', text: 'No changes made' });
        return;
      }

      if (hasPhotoChange) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        const photoRes = await fetchWithAuth('/player/api/profile/photo', { method: 'POST', body: fd });
        if (!photoRes) return;
        const photoData = await photoRes.json().catch(() => ({}));
        if (!photoRes.ok) throw new Error(photoData.error || `Photo upload failed (HTTP ${photoRes.status})`);
      }

      if (hasFieldChanges) {
        const res = await fetchWithAuth('/player/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res) return;
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      }

      if (photoPreviewUrl) {
        try { URL.revokeObjectURL(photoPreviewUrl); } catch (_) { /* ignore */ }
      }
      setPhotoFile(null);
      setPhotoPreviewUrl('');
      setMessage({ type: 'success', text: hasFieldChanges && hasPhotoChange ? 'Profile and photo updated successfully.' : hasPhotoChange ? 'Profile photo updated successfully.' : 'Profile updated successfully.' });
      setEditing(false);
      await loadProfile();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  const loadProfile = async () => {
    try {
      const res = await fetchWithAuth('/player/api/profile');
      if (!res) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load profile');

      if (data.successMessage) setMessage({ type: 'success', text: data.successMessage });
      if (data.errorMessage) setMessage({ type: 'error', text: data.errorMessage });

      setPlayer(data.player || {});
    } catch (err) {
      setMessage({ type: 'error', text: `Error loading profile: ${err.message}` });
    }
  };

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString();
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

  return (
    <div>
      <style>{`
        *{ margin:0; padding:0; box-sizing:border-box; }
        .page { font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .container-player-profile { max-width:900px; margin:0 auto; }
        h1,h2 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; text-align:center; }
        h1 { font-size:2.5rem; display:flex; align-items:center; justify-content:center; gap:1rem; }
        h1::before { content:'👤'; font-size:2.5rem; }
        .page-header { display:flex; align-items:center; justify-content:center; gap:1rem; margin-bottom:1rem; }
        .page-title { margin:0; }
        .avatar { width:96px; height:96px; border-radius:50%; overflow:hidden; border:1px solid var(--card-border); background: rgba(var(--sea-green-rgb), 0.08); }
        .avatar img { width:100%; height:100%; object-fit:cover; display:block; }
        .btn { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; }
        .btn.secondary { background:transparent; color:var(--sea-green); border:2px solid var(--sea-green); }
        .btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .input { width: 100%; max-width: 360px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--content-bg); color: var(--text-color); outline: none; }
        .mini-msg { margin-top:0.75rem; padding:0.75rem; border-radius:10px; border:1px solid var(--card-border); }
        .mini-msg.ok { background-color: rgba(var(--sea-green-rgb), 0.08); color: var(--sea-green); }
        .mini-msg.err { background-color: #ffebee; color: #c62828; }
        .form-container { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; border:1px solid var(--card-border); }
        .profile-info { display:grid; gap:1.5rem; }
        .info-section { background:var(--content-bg); padding:1.5rem; border-radius:8px; border: 1px solid var(--border-color); }
        .info-item { display:flex; align-items:center; gap:1rem; padding:1rem; border-bottom:1px solid rgba(46,139,87,0.2); }
        .info-item:last-child { border-bottom:none; }
        .info-label { font-family:'Cinzel', serif; color:var(--sea-green); font-weight:bold; min-width:150px; display:flex; align-items:center; gap:0.5rem; }
        .info-item--with-avatar { justify-content: space-between; }
        .info-left { display:flex; align-items:center; gap:1rem; flex: 1; min-width: 0; }
        .info-value { flex: 1; min-width: 0; }
        .profile-avatar-inline { flex: 0 0 auto; margin-left: 1rem; }
        .profile-avatar-inline .avatar { width:96px; height:96px; }
        .actions { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
        .delete-btn { background:#dc3545; color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; transition:all 0.3s ease; display:flex; align-items:center; gap:0.5rem; }
        .delete-btn:hover { transform:translateY(-2px); box-shadow:0 4px 8px rgba(0,0,0,0.1); }
        @media (max-width:768px){ .page{ padding:1rem; } .form-container{ padding:1.5rem; } .info-item{ flex-direction:column; align-items:flex-start; gap:0.5rem; } .info-label{ min-width:auto; } .actions{ flex-direction:column; } .delete-btn{ width:100%; justify-content:center; } h1{ justify-content:flex-start; } .avatar{ width:84px; height:84px; } }
      `}</style>

      <div className="page">
        <div className="container-player-profile">
          <div className="page-header">
            <h1 className="page-title">Player Profile</h1>
          </div>

          {message && (
            <div style={{ ...styles.msgBox, ...(message.type === 'success' ? styles.success : styles.error) }}>
              <i className={message.type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'} /> {message.text}
            </div>
          )}

          <div className="form-container">
            {/* Edit controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div />
              {!editing ? (
                <button className="btn secondary" onClick={beginEdit}>Edit</button>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                  <button className="btn secondary" onClick={cancelEdit} disabled={saving}>Cancel</button>
                </div>
              )}
            </div>

            {editing && (
              <div style={{ marginBottom: '1.5rem' }}>
                <input type="file" accept="image/*" onChange={(e) => selectPhotoFile(e.target.files && e.target.files[0])} />
                <div style={{ marginTop: 6, opacity: 0.8 }}>JPG/PNG/WebP/GIF, up to 2MB. Photo is saved when you click Save Changes.</div>
                {photoStatus && (
                  <div className={`mini-msg ${photoStatus.type === 'success' ? 'ok' : 'err'}`}>{photoStatus.text}</div>
                )}
              </div>
            )}

            <section className="profile-info">
              <div className="info-section">
                <div className="info-item info-item--with-avatar">
                  <div className="info-left">
                    <span className="info-label"><i className="fas fa-user" /> Username:</span>
                    <div className="info-value">
                      {editing ? (
                        <input
                          className="input"
                          value={draft.name}
                          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Enter username"
                        />
                      ) : (
                        <span>{player.name || ''}</span>
                      )}
                    </div>
                  </div>

                  <div className="profile-avatar-inline">
                    <div className="avatar">
                      {(photoPreviewUrl || player.profile_photo_url) ? (
                        <img
                            src={photoPreviewUrl || (player.profile_photo_url ? `${player.profile_photo_url}?cb=${player.updated_date ? new Date(player.updated_date).getTime() : Date.now()}` : '')}
                            alt="Profile"
                            crossOrigin="anonymous"
                            onError={(e) => { 
                              console.error('Image load error for:', e.target.src);
                            }}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="info-item">
                  <span className="info-label"><i className="fas fa-envelope" /> Email:</span>
                  <span>{player.email || ''}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-calendar-alt" /> DOB:</span>
                  {editing ? (
                    <input
                      className="input"
                      type="date"
                      value={draft.dob}
                      onChange={(e) => setDraft((p) => ({ ...p, dob: e.target.value }))}
                    />
                  ) : (
                    <span>{formatDate(player.dob)}</span>
                  )}
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-phone" /> Phone:</span>
                  {editing ? (
                    <input
                      className="input"
                      value={draft.phone}
                      onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Enter phone"
                    />
                  ) : (
                    <span>{player.phone || ''}</span>
                  )}
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-id-card" /> FIDE ID:</span>
                  {editing ? (
                    <input
                      className="input"
                      value={draft.FIDE_ID}
                      onChange={(e) => setDraft((p) => ({ ...p, FIDE_ID: e.target.value }))}
                      placeholder="Enter FIDE ID"
                    />
                  ) : (
                    <span>{player.FIDE_ID || 'N/A'}</span>
                  )}
                </div>
                <div className="info-item">
                  <span className="info-label"><i className="fas fa-id-badge" /> AICF ID:</span>
                  {editing ? (
                    <input
                      className="input"
                      value={draft.AICF_ID}
                      onChange={(e) => setDraft((p) => ({ ...p, AICF_ID: e.target.value }))}
                      placeholder="Enter AICF ID"
                    />
                  ) : (
                    <span>{player.AICF_ID || 'N/A'}</span>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="form-container actions">
            <button className="delete-btn" onClick={handleDeleteAccount}>
              <i className="fas fa-trash-alt" /> Delete Account
            </button>
          </div>
        </div>
      </div>
      <button type="button" className="back-to-dashboard" onClick={() => navigate('/player/player_dashboard')}>
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>
    </div>
  );
}

export default PlayerProfile;
