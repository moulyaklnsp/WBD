import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import '../../styles/playerNeoNoir.css';
import { motion } from 'framer-motion';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { coordinatorLinks } from '../../constants/coordinatorLinks';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';
import SearchFilterRow from '../../components/SearchFilterRow';

const ROWS_PER_PAGE = 10;

const sectionVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.12,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  })
};

function TournamentManagement() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [page, setPage] = useState(1);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDescription, setFileDescription] = useState('');
  const [search, setSearch] = useState({ attr: 'name', q: '' });

  // Form state
  const [form, setForm] = useState({
    tournamentName: '',
    tournamentDate: '',
    tournamentTime: '',
    tournamentLocation: '',
    entryFee: '',
    type: '',
    noOfRounds: ''
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [, setSearchParams] = useSearchParams();

  const showMessage = (text, type = 'success') => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const getMinTournamentDate = () => {
    const min = new Date();
    min.setHours(0, 0, 0, 0);
    min.setDate(min.getDate() + 3);
    return min;
  };

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchAsCoordinator('/coordinator/api/tournaments');
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data?.tournaments) ? data.tournaments : [];
      setTournaments(list);
      setPage(1);
    } catch (e) {
      console.error('Fetch tournaments error:', e);
      setError('Error fetching tournaments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  // Compute status based on 1-hour duration window using date + time
  function computeStatus(t) {
    let status = t.status || 'Pending';
    let statusClass = 'pending';
    const dateOnly = new Date(t.date);
    const timeStr = (t.time || '').toString(); // expected HH:MM (24h)
    // Build start Date from date + time
    const [hh, mm] = (timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00']);
    const start = new Date(dateOnly);
    if (!isNaN(parseInt(hh)) && !isNaN(parseInt(mm))) {
      start.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration
    const now = new Date();

    let phase = 'Upcoming';
    if (now >= end) phase = 'Completed';
    else if (now >= start && now < end) phase = 'Ongoing';

    const rawStatus = (t.status || '').toString().trim().toLowerCase();
    if (rawStatus === 'completed') {
      status = 'Completed';
      statusClass = 'completed';
      phase = 'Completed';
    } else if (rawStatus === 'ongoing') {
      status = 'Ongoing';
      statusClass = 'ongoing';
      phase = 'Ongoing';
    } else if (rawStatus === 'approved') {
      status = phase;
      statusClass = phase === 'Completed' ? 'completed' : phase === 'Ongoing' ? 'ongoing' : 'yet-to-start';
    } else if (rawStatus === 'pending') {
      status = 'Pending';
      statusClass = 'pending';
    } else if (rawStatus === 'rejected') {
      status = 'Rejected';
      statusClass = 'rejected';
    } else if (rawStatus === 'removed') {
      status = 'Removed';
      statusClass = 'removed';
    } else {
      status = phase;
      statusClass = phase === 'Completed' ? 'completed' : phase === 'Ongoing' ? 'ongoing' : 'yet-to-start';
    }

    return { status, statusClass, dateObj: dateOnly, phase };
  }

  // Filter out removed tournaments
  const activeTournaments = useMemo(
    () => tournaments.filter((t) => (t.status || '').toString().trim().toLowerCase() !== 'removed'),
    [tournaments]
  );

  const filteredTournaments = useMemo(() => {
    if (!search.q) return activeTournaments;
    const query = search.q.toLowerCase().trim();
    return activeTournaments.filter((t) => {
      const { status, dateObj } = computeStatus(t);
      const rawStatus = (t.status || '').toString().trim();
      const name = (t.name || t.tournamentName || '').toString();
      const type = (t.type || '').toString();
      const dateString = dateObj && !Number.isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString() : '';
      const statusValue = `${status} ${rawStatus}`.trim();
      let value = '';
      switch (search.attr) {
        case 'date':
          value = dateString;
          break;
        case 'type':
          value = type;
          break;
        case 'status':
          value = statusValue;
          break;
        default:
          value = name;
          break;
      }
      return value.toLowerCase().includes(query);
    });
  }, [activeTournaments, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTournaments.length / ROWS_PER_PAGE));
  const paginatedTournaments = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return filteredTournaments.slice(start, start + ROWS_PER_PAGE);
  }, [filteredTournaments, page]);

  useEffect(() => {
    setPage(1);
  }, [search, activeTournaments.length]);

  const validate = () => {
    const errors = {};
    const name = form.tournamentName.trim();
    if (!name) errors.tournamentName = 'Tournament name is required.';
    else if (name.length < 3) errors.tournamentName = 'Tournament name must be at least 3 characters long.';
    else if (!/^[a-zA-Z0-9\s\-&]+$/.test(name)) errors.tournamentName = 'Only letters, numbers, spaces, hyphens, and & are allowed.';

    if (!form.tournamentDate) errors.tournamentDate = 'Date is required.';
    else {
      const inputDate = new Date(form.tournamentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const editingTournament = editingId ? tournaments.find((t) => t._id === editingId) : null;
      const existingDateStr = editingTournament?.date ? new Date(editingTournament.date).toISOString().split('T')[0] : '';
      if (isNaN(inputDate.getTime())) errors.tournamentDate = 'Invalid date format.';
      else if (inputDate < today) errors.tournamentDate = 'Date cannot be in the past.';
      else {
        const minDate = getMinTournamentDate();
        if (!editingId || existingDateStr !== form.tournamentDate) {
          if (inputDate < minDate) {
            errors.tournamentDate = 'Tournament must be created at least 3 days before the event date.';
          }
        }
      }
    }

    const time = form.tournamentTime.trim();
    if (!time) errors.tournamentTime = 'Time is required.';
    else if (!/^\d{2}:\d{2}$/.test(time)) errors.tournamentTime = 'Invalid time format (use HH:MM).';

    const location = form.tournamentLocation.trim();
    if (!location) errors.tournamentLocation = 'Location is required.';
    else if (location.length < 3) errors.tournamentLocation = 'Location must be at least 3 characters long.';

    const entryFee = parseFloat(form.entryFee);
    if (isNaN(entryFee)) errors.entryFee = 'Entry fee is required.';
    else if (entryFee < 0) errors.entryFee = 'Entry fee cannot be negative.';

    if (!form.type) errors.type = 'Please select a tournament type.';

    const noOfRounds = parseInt(form.noOfRounds);
    if (isNaN(noOfRounds)) errors.noOfRounds = 'Number of rounds is required.';
    else if (noOfRounds <= 0) errors.noOfRounds = 'Number of rounds must be a positive integer.';
    else if (noOfRounds > 100) errors.noOfRounds = 'Number of rounds cannot exceed 100.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setForm({
      tournamentName: '',
      tournamentDate: '',
      tournamentTime: '',
      tournamentLocation: '',
      entryFee: '',
      type: '',
      noOfRounds: ''
    });
    setFieldErrors({});
    setEditingId(null);
    setSelectedFile(null);
    setFileDescription('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      showMessage('Please correct the errors in the form.', 'error');
      return;
    }
    if (editingId) {
      const editingTournament = tournaments.find((t) => t._id === editingId);
      if (editingTournament) {
        const { phase } = computeStatus(editingTournament);
        if (phase === 'Completed' || String(editingTournament.status || '').toLowerCase() === 'completed') {
          showMessage('Completed tournaments are read-only.', 'error');
          return;
        }
      }
    }
    const payload = {
      // camelCase fields used by React API
      tournamentName: form.tournamentName.trim(),
      tournamentDate: form.tournamentDate,
      time: form.tournamentTime.trim(),
      location: form.tournamentLocation.trim(),
      entryFee: typeof form.entryFee === 'string' ? parseFloat(form.entryFee) : form.entryFee,
      type: form.type,
      noOfRounds: typeof form.noOfRounds === 'string' ? parseInt(form.noOfRounds, 10) : form.noOfRounds,
      // snake_case fields for legacy API compatibility
      name: form.tournamentName.trim(),
      date: form.tournamentDate,
      entry_fee: typeof form.entryFee === 'string' ? parseFloat(form.entryFee) : form.entryFee,
      no_of_rounds: typeof form.noOfRounds === 'string' ? parseInt(form.noOfRounds, 10) : form.noOfRounds,
      tournamentTime: form.tournamentTime.trim(),
      tournamentLocation: form.tournamentLocation.trim(),
    };
    try {
      const endpoint = editingId ? `/coordinator/api/tournaments/${editingId}` : '/coordinator/api/tournaments';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetchAsCoordinator(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to submit tournament');
      showMessage(data.message || (editingId ? 'Tournament updated successfully!' : 'Tournament added successfully!'), 'success');
      const targetId = editingId || data.tournamentId;
      if (selectedFile && targetId) {
        await handleFileUpload(targetId);
      }
      resetForm();
      await fetchTournaments();
    } catch (err) {
      console.error('Submit error:', err);
      showMessage(`Failed to submit tournament: ${err.message}`, 'error');
    }
  };

  const onEdit = (id) => {
    const t = tournaments.find((x) => x._id === id);
    if (!t) return;
    const { phase } = computeStatus(t);
    if (phase === 'Completed' || String(t.status || '').toLowerCase() === 'completed') {
      showMessage('Completed tournaments are read-only.', 'error');
      return;
    }
    setEditingId(id);
    setForm({
      tournamentName: t.name || t.tournamentName || '',
      tournamentDate: t.date ? new Date(t.date).toISOString().split('T')[0] : (t.tournamentDate || ''),
      tournamentTime: t.time || t.tournamentTime || '',
      tournamentLocation: t.location || t.tournamentLocation || '',
      entryFee: (typeof t.entry_fee !== 'undefined' ? t.entry_fee : (typeof t.entryFee !== 'undefined' ? t.entryFee : '')),
      type: t.type || '',
      noOfRounds: (typeof t.no_of_rounds !== 'undefined' ? t.no_of_rounds : (typeof t.noOfRounds !== 'undefined' ? t.noOfRounds : ''))
    });
    // preserve current filters in URL if any (optional)
    setSearchParams((prev) => prev);
  };

  const onRemove = async (id) => {
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/tournaments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to remove tournament');
      showMessage('Tournament removed', 'success');
      setTournaments((ts) => ts.filter((t) => t._id !== id));
    } catch (err) {
      console.error('Remove error:', err);
      showMessage('Error removing tournament', 'error');
    }
  };

  const handleFileUpload = async (tournamentId) => {
    if (!selectedFile) {
      showMessage('Please select a file to upload', 'error');
      return;
    }
    if (!tournamentId) {
      showMessage('Please select a tournament to upload', 'error');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('description', fileDescription);

      const res = await fetchAsCoordinator(`/coordinator/api/tournaments/${tournamentId}/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');

      showMessage('File uploaded successfully', 'success');
      setSelectedFile(null);
      setFileDescription('');
    } catch (err) {
      console.error('Upload error:', err);
      showMessage(`Upload failed: ${err.message}`, 'error');
    }
  };

  const minDateInput = (() => {
    if (editingId) return '';
    const d = getMinTournamentDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();


  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body, #root { min-height: 100vh; }
        .page { font-family: 'Playfair Display', serif; background-color: var(--page-bg); min-height: 100vh; display:flex; color: var(--text-color); }
        .content { flex-grow:1; margin-left:0; padding:2rem; }
        h1 { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:2rem; font-size:2.5rem; display:flex; align-items:center; gap:1rem; }
        .updates-section { background:var(--card-bg); border-radius:15px; padding:2rem; margin-bottom:2rem; box-shadow:none; border:1px solid var(--card-border); transition: transform 0.3s ease; }
        .updates-section:hover { transform: translateY(-5px); }
        .top-panels-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
          gap: 1.25rem;
          align-items: start;
          margin-bottom: 2rem;
        }
        .top-panels-grid .updates-section { margin-bottom: 0; }
        .form-group { margin-bottom: 1rem; }
        .tournament-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(260px, 1fr));
          gap: 1rem 1.25rem;
          width: 100%;
          max-width: 900px;
        }
        .tournament-form-grid .form-group { margin-bottom: 0; }
        .tournament-form-actions { grid-column: 1 / -1; margin-top: 0.25rem; }
        .paired-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .paired-label { display: block; font-size: 0.85rem; color: var(--sea-green); margin-bottom: 0.35rem; font-family: 'Cinzel', serif; }
        .form-label { font-family:'Cinzel', serif; color:var(--sea-green); margin-bottom:8px; display:block; }
        .form-input { width:100%; padding:0.8rem; border:2px solid var(--sea-green); border-radius:8px; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); }
        .form-input.error { border-color:#c62828; }
        .error-text { color:#c62828; font-size:0.9rem; margin-top:4px; }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; display:flex; align-items:center; gap:0.5rem; width:100%; }
        .table-responsive { overflow-x: auto; }
        .tournament-table { width:100%; border-collapse:collapse; }
        .tournament-table th { background:var(--sea-green); color:var(--on-accent); padding:1rem; text-align:left; font-family:'Cinzel', serif; }
        .tournament-table td { padding:1rem; border-bottom:1px solid rgba(var(--sea-green-rgb, 27, 94, 63), 0.2); }
        .action-btn { display:inline-flex; align-items:center; gap:0.5rem; background:var(--sky-blue); color:var(--on-accent); text-decoration:none; padding:0.5rem 1rem; border-radius:8px; font-family:'Cinzel', serif; font-weight:bold; margin:0.2rem; border:none; cursor:pointer; }
        .remove-btn { background:#c62828; color:var(--on-accent); }
        .edit-btn { background:var(--sky-blue); color:var(--on-accent); }
        .feedback-btn { background:var(--sky-blue); color:var(--on-accent); }
        .message { margin-bottom:1rem; padding:0.75rem 1rem; border-radius:8px; }
        .message.success { color:#1b5e20; background:rgba(76,175,80,0.15); }
        .message.error { color:#c62828; background:rgba(198,40,40,0.15); }
        .file-list { max-height: 100px; overflow-y: auto; font-size: 0.8rem; }
        .file-item { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem; }
        .file-link { color: var(--sea-green); text-decoration: none; }
        .file-link:hover { text-decoration: underline; }
        .delete-file-btn { background: none; border: none; color: #c62828; cursor: pointer; font-size: 0.8rem; }
        .search-row { margin-bottom:1rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; }
        .search-input { padding:0.6rem 1rem; max-width:300px; width:100%; border:2px solid var(--sea-green); border-radius:8px; font-family:'Playfair Display', serif; background:var(--card-bg); color:var(--text-color); }
        .search-select { padding:0.6rem 1rem; max-width:300px; width:100%; border:2px solid var(--sea-green); border-radius:8px; font-family:'Cinzel', serif; background:var(--card-bg); color:var(--text-color); }
        .pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1.2rem; flex-wrap: wrap; }
        .page-btn { background: var(--card-bg); color: var(--text-color); border: 1px solid var(--card-border); padding: 0.5rem 0.9rem; border-radius: 8px; cursor: pointer; font-family:'Cinzel', serif; font-weight: bold; }
        .page-btn.active { background: var(--sea-green); color: var(--on-accent); border-color: var(--sea-green); }
        .page-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .link-btn { background: none; border: none; color: var(--sea-green); text-decoration: underline; cursor: pointer; font-weight: bold; padding: 0; font-family: inherit; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
        .modal-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 1.5rem; width: min(900px, 96vw); max-height: 90vh; overflow-y: auto; color: var(--text-color); }
        .modal-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
        .modal-title { font-family: 'Cinzel', serif; color: var(--sea-green); font-size: 1.5rem; display: flex; align-items: center; gap: 0.6rem; }
        .modal-close { background: none; border: 1px solid var(--card-border); color: var(--text-color); width: 36px; height: 36px; border-radius: 8px; cursor: pointer; }
        .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.9rem; }
        .detail-item { background: rgba(var(--sea-green-rgb, 27, 94, 63), 0.08); border: 1px solid var(--card-border); border-radius: 10px; padding: 0.75rem; }
        .detail-label { font-size: 0.8rem; opacity: 0.7; margin-bottom: 0.3rem; }
        .detail-value { font-weight: 600; }
        .image-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; margin-top: 0.6rem; }
        .image-grid img { width: 100%; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid var(--card-border); }
        @media (max-width: 900px) {
          .top-panels-grid { grid-template-columns: 1fr; }
          .tournament-form-grid { grid-template-columns: 1fr; }
          .tournament-form-actions { grid-column: auto; }
          .paired-fields { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="page player-neo">
        <motion.div
          className="chess-knight-float"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.14, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 0, fontSize: '2.5rem', color: 'var(--sea-green)' }}
          aria-hidden="true"
        >
          <i className="fas fa-chess-rook" />
        </motion.div>

        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title={`ChessHive`} />

        <div className="coordinator-dash-header" style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001, display: 'flex', gap: '12px', alignItems: 'center' }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              color: 'var(--text-color)',
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem'
            }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <i className="fas fa-trophy" /> Tournament Management
          </motion.h1>

          <div className="top-panels-grid">
          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            {message && (
              <div className={`message ${message.type}`}>
                <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`} /> {message.text}
              </div>
            )}
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '1rem' }}>{editingId ? 'Edit Tournament' : 'Add New Tournament'}</h3>
            <form onSubmit={onSubmit} className="tournament-form-grid">
              <div className="form-group">
                <label className="form-label">Tournament Name:</label>
                <input
                  className={`form-input ${fieldErrors.tournamentName ? 'error' : ''}`}
                  type="text"
                  value={form.tournamentName}
                  onChange={(e) => setForm({ ...form, tournamentName: e.target.value })}
                  required
                />
                {fieldErrors.tournamentName && <div className="error-text">{fieldErrors.tournamentName}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Date:</label>
                <input
                  className={`form-input ${fieldErrors.tournamentDate ? 'error' : ''}`}
                  type="date"
                  min={minDateInput}
                  value={form.tournamentDate}
                  onChange={(e) => setForm({ ...form, tournamentDate: e.target.value })}
                  required
                />
                {fieldErrors.tournamentDate && <div className="error-text">{fieldErrors.tournamentDate}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Time:</label>
                <input
                  className={`form-input ${fieldErrors.tournamentTime ? 'error' : ''}`}
                  type="time"
                  value={form.tournamentTime}
                  onChange={(e) => setForm({ ...form, tournamentTime: e.target.value })}
                  required
                />
                {fieldErrors.tournamentTime && <div className="error-text">{fieldErrors.tournamentTime}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Location:</label>
                <input
                  className={`form-input ${fieldErrors.tournamentLocation ? 'error' : ''}`}
                  type="text"
                  value={form.tournamentLocation}
                  onChange={(e) => setForm({ ...form, tournamentLocation: e.target.value })}
                  required
                />
                {fieldErrors.tournamentLocation && <div className="error-text">{fieldErrors.tournamentLocation}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Entry Fee (₹):</label>
                <input
                  className={`form-input ${fieldErrors.entryFee ? 'error' : ''}`}
                  type="number"
                  step="0.01"
                  value={form.entryFee}
                  onChange={(e) => setForm({ ...form, entryFee: e.target.value })}
                  required
                />
                {fieldErrors.entryFee && <div className="error-text">{fieldErrors.entryFee}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Format & Rounds:</label>
                <div className="paired-fields">
                  <div>
                    <label className="paired-label">Type</label>
                    <select
                      className={`form-input ${fieldErrors.type ? 'error' : ''}`}
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value })}
                      required
                    >
                      <option value="" disabled>Select Type</option>
                      <option value="Individual">Individual</option>
                      <option value="Team">Team</option>
                    </select>
                    {fieldErrors.type && <div className="error-text">{fieldErrors.type}</div>}
                  </div>
                  <div>
                    <label className="paired-label">No of Rounds</label>
                    <input
                      className={`form-input ${fieldErrors.noOfRounds ? 'error' : ''}`}
                      type="number"
                      value={form.noOfRounds}
                      onChange={(e) => setForm({ ...form, noOfRounds: e.target.value })}
                      required
                    />
                    {fieldErrors.noOfRounds && <div className="error-text">{fieldErrors.noOfRounds}</div>}
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Attach File (optional):</label>
                <input
                  type="file"
                  className="form-input"
                  onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png,.gif"
                />
                {selectedFile && (
                  <div style={{ fontSize: '0.8rem', opacity: 0.75, marginTop: '0.35rem' }}>
                    Selected: {selectedFile.name}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">File Description (optional):</label>
                <input
                  type="text"
                  className="form-input"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  placeholder="Brief description of the file"
                />
              </div>
              <button type="submit" className="btn-primary tournament-form-actions">{editingId ? 'Update Tournament' : 'Add Tournament'}</button>
            </form>
          </motion.div>

          </div>

          <motion.div
            className="updates-section"
            custom={2}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.5rem' }}>Your Tournaments</h3>
            <h4 style={{ color: 'var(--text-color)', opacity: 0.7, marginBottom: '1rem' }}>Tournaments you've submitted will appear here with their approval status</h4>

            <SearchFilterRow
              value={search}
              options={[
                { value: 'name', label: 'Name' },
                { value: 'date', label: 'Date' },
                { value: 'type', label: 'Type' },
                { value: 'status', label: 'Status' }
              ]}
              onAttrChange={(val) => setSearch((s) => ({ ...s, attr: val }))}
              onQueryChange={(val) => setSearch((s) => ({ ...s, q: val }))}
            />

            {loading && <div>Loading tournaments…</div>}
            {!loading && !!error && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--sea-green)', fontStyle: 'italic' }}>
                <i className="fas fa-info-circle" /> {error}
              </div>
            )}
            {!loading && !error && activeTournaments.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--sea-green)', fontStyle: 'italic' }}>
                <i className="fas fa-info-circle" /> No tournaments available.
              </div>
            )}

            {!loading && !error && activeTournaments.length > 0 && filteredTournaments.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--sea-green)', fontStyle: 'italic' }}>
                <i className="fas fa-info-circle" /> No tournaments match the selected filters.
              </div>
            )}

            {!loading && !error && filteredTournaments.length > 0 && (
              <>
                <div className="table-responsive">
                  <table className="tournament-table">
                    <thead>
                      <tr>
                        <th><i className="fas fa-trophy" /> Name</th>
                        <th><i className="fas fa-calendar" /> Date</th>
                        <th>Time</th>
                        <th><i className="fas fa-map-marker-alt" /> Location</th>
                        <th><i className="fas fa-rupee-sign" /> Entry Fee</th>
                        <th>Type</th>
                        <th>No Of Rounds</th>
                        <th><i className="fas fa-info-circle" /> Status</th>
                        <th><i className="fas fa-cogs" /> Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTournaments.map((t, idx) => {
                        const { status, statusClass, dateObj, phase } = computeStatus(t);
                        const isCompleted = phase === 'Completed' || String(t.status || '').toLowerCase() === 'completed';
                        return (
                          <tr key={t._id || idx}>
                            <td>
                              <Link
                                to={`/coordinator/tournaments/${t._id}`}
                                state={{ tournament: t }}
                                className="link-btn"
                                title="View tournament details"
                              >
                                <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
                                {t.name || t.tournamentName || 'Untitled Tournament'}
                              </Link>
                            </td>
                            <td>{isNaN(dateObj) ? '' : dateObj.toLocaleDateString()}</td>
                            <td>{t.time}</td>
                            <td>{t.location}</td>
                            <td>₹{typeof t.entry_fee !== 'undefined' ? t.entry_fee : t.entryFee}</td>
                            <td>{t.type}</td>
                            <td>{typeof t.no_of_rounds !== 'undefined' ? t.no_of_rounds : t.noOfRounds}</td>
                            <td style={{ fontWeight: 'bold', color: statusClass === 'completed' ? 'var(--sea-green)' : statusClass === 'ongoing' ? 'var(--sky-blue)' : statusClass === 'yet-to-start' ? '#666' : '#c62828' }}><i className="fas fa-circle" /> {status}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <button
                                  type="button"
                                  className="action-btn edit-btn"
                                  onClick={() => onEdit(t._id)}
                                  disabled={isCompleted}
                                  style={{ opacity: isCompleted ? 0.5 : 1 }}
                                >
                                  <i className="fas fa-edit" /> Edit
                                </button>
                                <button
                                  className="action-btn remove-btn"
                                  onClick={() => onRemove(t._id)}
                                  disabled={isCompleted}
                                  style={{ opacity: isCompleted ? 0.5 : 1 }}
                                >
                                  <i className="fas fa-trash" /> Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <i className="fas fa-chevron-left" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={`page-btn ${p === page ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="page-btn"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <i className="fas fa-chevron-right" />
                    </button>
                  </div>
                )}
              </>
            )}

            <div style={{ textAlign: 'right', marginTop: '2rem' }}>
              <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
                <i className="fas fa-arrow-left" /> Back to Dashboard
              </Link>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

export default TournamentManagement;


