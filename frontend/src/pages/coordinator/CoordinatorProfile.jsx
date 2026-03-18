import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';

const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  })
};

function CoordinatorProfile() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);

  const normalizeFormValues = (values) => ({
    name: (values?.name || '').toString().trim(),
    phone: (values?.phone || '').toString().trim(),
    college: (values?.college || '').toString().trim(),
    dob: (values?.dob || '').toString(),
    gender: (values?.gender || '').toString(),
    AICF_ID: (values?.AICF_ID || '').toString().trim(),
    FIDE_ID: (values?.FIDE_ID || '').toString().trim()
  });

  const buildBaselineForm = (data) => normalizeFormValues({
    name: data?.name,
    phone: data?.phone,
    college: data?.college,
    dob: data?.dob ? new Date(data.dob).toISOString().split('T')[0] : '',
    gender: data?.gender,
    AICF_ID: data?.AICF_ID,
    FIDE_ID: data?.FIDE_ID
  });

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsCoordinator('/coordinator/api/profile');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load profile');
      setProfile(data);
      setEditForm(buildBaselineForm(data));
      if (data.profile_photo_url) setPhotoPreviewUrl(data.profile_photo_url);
    } catch (e) {
      console.error(e);
      setError('Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const baseline = buildBaselineForm(profile);
      const current = normalizeFormValues(editForm);
      const hasChanges = Object.keys(baseline).some((key) => current[key] !== baseline[key]);
      if (!hasChanges) {
        showMessage('No changes made');
        return;
      }
      const res = await fetchAsCoordinator('/coordinator/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(current)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      showMessage('Profile updated successfully!');
      setEditMode(false);
      loadProfile();
    } catch (e) {
      showMessage(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account?')) return;
    try {
      const res = await fetchAsCoordinator('/coordinator/api/profile', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('Account deleted. Redirecting to login.');
        navigate('/login');
      } else {
        alert('Failed: ' + (data.message || 'Unknown error'));
      }
    } catch (e) {
      alert('Error deleting account.');
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePhotoUpload = async () => {
    if (!photoFile) return;
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      const res = await fetchAsCoordinator('/coordinator/api/upload-photo', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage('Photo uploaded!');
        if (data.profile_photo_url) setPhotoPreviewUrl(data.profile_photo_url);
        setPhotoFile(null);
      } else {
        showMessage(data.error || 'Failed to upload photo', 'error');
      }
    } catch (e) {
      showMessage('Error uploading photo', 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  const fields = [
    { key: 'name', label: 'Name', icon: 'fa-user', editable: true },
    { key: 'email', label: 'Email', icon: 'fa-envelope', editable: false },
    { key: 'phone', label: 'Phone', icon: 'fa-phone', editable: true },
    { key: 'college', label: 'College', icon: 'fa-university', editable: true },
    { key: 'dob', label: 'Date of Birth', icon: 'fa-birthday-cake', editable: true, type: 'date' },
    { key: 'gender', label: 'Gender', icon: 'fa-venus-mars', editable: true, type: 'select', options: ['male', 'female', 'other'] },
    { key: 'AICF_ID', label: 'AICF ID', icon: 'fa-id-card', editable: true },
    { key: 'FIDE_ID', label: 'FIDE ID', icon: 'fa-id-badge', editable: true }
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .info-item { display:flex; align-items:center; gap:1rem; padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .info-label { font-family:'Cinzel', serif; font-weight:bold; color:var(--sea-green); min-width:140px; display:flex; align-items:center; gap:0.5rem; }
        .info-value { color:var(--text-color); flex-grow:1; }
        .edit-input { width:100%; max-width:300px; padding:0.6rem; border:2px solid var(--sea-green); border-radius:8px; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; text-decoration:none; }
        .btn-danger { background:#d32f2f; color:#fff; border:none; padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .btn-secondary { background:var(--card-bg); color:var(--text-color); border:1px solid var(--card-border); padding:0.8rem 1.5rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:inline-flex; align-items:center; gap:0.5rem; }
        .message { padding:0.75rem 1rem; border-radius:8px; margin-bottom:1rem; }
        .message.success { color:#1b5e20; background:rgba(76,175,80,0.15); }
        .message.error { color:#c62828; background:rgba(198,40,40,0.15); }
      `}</style>

      <div className="page player-neo">
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-user" />
        </motion.div>

        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button type="button" onClick={toggleTheme} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-color)', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}>
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <i className="fas fa-user" /> Coordinator Profile
          </motion.h1>

          {message && (
            <div className={`message ${message.type}`}>
              <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}
            </div>
          )}

          {/* Photo Section */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            {photoPreviewUrl ? (
              <motion.img src={photoPreviewUrl} alt="Profile" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                style={{ width: 140, height: 140, borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem', border: '4px solid var(--sea-green)' }} />
            ) : (
              <div style={{ width: 140, height: 140, borderRadius: '50%', marginBottom: '1rem', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px dashed var(--sea-green)', margin: '0 auto 1rem' }}>
                <i className="fas fa-user-circle" style={{ fontSize: '3rem', color: 'var(--sea-green)' }} />
              </div>
            )}
            <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} id="profile-photo-upload" />
            <button className="btn-primary" onClick={() => document.getElementById('profile-photo-upload').click()} style={{ marginRight: 8 }}>
              <i className="fas fa-upload" /> Select Photo
            </button>
            {photoFile && (
              <button className="btn-primary" onClick={handlePhotoUpload} disabled={photoUploading}>
                <i className="fas fa-check" /> {photoUploading ? 'Uploading...' : 'Upload'}
              </button>
            )}
          </div>

          {/* Profile Info */}
          <motion.div className="updates-section" custom={0} variants={sectionVariants} initial="hidden" animate="visible">
            {error && <div className="message error">{error}</div>}
            {loading ? (
              <p><i className="fas fa-spinner fa-spin" /> Loading...</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.3rem' }}>
                    <i className="fas fa-id-card" /> Profile Details
                  </h3>
                  {!editMode ? (
                    <button className="btn-primary" onClick={() => setEditMode(true)}>
                      <i className="fas fa-edit" /> Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn-primary" onClick={handleSave} disabled={saving}>
                        <i className="fas fa-save" /> {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button className="btn-secondary" onClick={() => { setEditMode(false); loadProfile(); }}>
                        <i className="fas fa-times" /> Cancel
                      </button>
                    </div>
                  )}
                </div>

                {fields.map((f) => (
                  <div className="info-item" key={f.key}>
                    <div className="info-label"><i className={`fas ${f.icon}`} /> {f.label}:</div>
                    <div className="info-value">
                      {editMode && f.editable ? (
                        f.type === 'select' ? (
                          <select className="edit-input" value={editForm[f.key] || ''} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}>
                            <option value="">Select...</option>
                            {f.options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                          </select>
                        ) : (
                          <input className="edit-input" type={f.type || 'text'} value={editForm[f.key] || ''} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })} />
                        )
                      ) : (
                        f.key === 'dob' && profile[f.key]
                          ? new Date(profile[f.key]).toLocaleDateString()
                          : profile[f.key] || 'N/A'
                      )}
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard"><i className="fas fa-arrow-left" /> Back to Dashboard</Link>
                  <button className="btn-danger" onClick={deleteAccount}><i className="fas fa-trash" /> Delete Account</button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorProfile;






