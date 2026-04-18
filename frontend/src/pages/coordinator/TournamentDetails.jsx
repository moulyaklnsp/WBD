import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../../styles/playerNeoNoir.css';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import AnimatedSidebar from '../../components/AnimatedSidebar';
import { GlobalLoader } from '../../components/ChessTransformation';

import { coordinatorLinks } from '../../constants/coordinatorLinks';
import { fetchAsCoordinator } from '../../utils/fetchWithRole';

function TournamentDetails() {
  const { id } = useParams();
  const location = useLocation();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [stats, setStats] = useState({});
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [editForm, setEditForm] = useState({
    tournamentName: '',
    tournamentDate: '',
    time: '',
    location: '',
    entryFee: '',
    type: '',
    noOfRounds: ''
  });

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const normalizeId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.$oid) return value.$oid;
    try {
      return value.toString();
    } catch {
      return '';
    }
  };

  const applyTournamentData = (t, statsOverride = {}) => {
    setTournament(t);
    setStats(statsOverride);
    setEditForm({
      tournamentName: t?.name || '',
      tournamentDate: t?.date ? new Date(t.date).toISOString().split('T')[0] : '',
      time: t?.time || '',
      location: t?.location || '',
      entryFee: typeof t?.entry_fee !== 'undefined' ? t.entry_fee : (t?.entryFee || ''),
      type: t?.type || '',
      noOfRounds: typeof t?.noOfRounds !== 'undefined' ? t.noOfRounds : (t?.no_of_rounds || '')
    });
  };

  const loadDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const stateTournament = location?.state?.tournament;
      if (stateTournament && normalizeId(stateTournament._id) === normalizeId(id)) {
        applyTournamentData(stateTournament, {});
      }

      try {
        const res = await fetchAsCoordinator(`/coordinator/api/tournaments/${id}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.tournament) {
          applyTournamentData(data.tournament, data.stats || {});
          return;
        }
      } catch {
        // continue to fallback endpoint
      }

      // Fallback path when GET /api/tournaments/:id is not available
      const listRes = await fetchAsCoordinator('/coordinator/api/tournaments');
      const listData = await listRes.json().catch(() => ({}));
      if (!listRes.ok) throw new Error(listData.error || 'Failed to load tournament details');
      const list = Array.isArray(listData?.tournaments) ? listData.tournaments : [];
      const t = list.find((x) => normalizeId(x?._id) === normalizeId(id));
      if (!t) throw new Error('Tournament not found');

      let feedbackCount = 0;
      let complaintsCount = 0;
      let totalEnrollments = 0;
      let individualCount = 0;
      let approvedTeamCount = 0;

      try {
        const [enrollRes, feedbackRes, complaintsRes] = await Promise.all([
          fetchAsCoordinator(`/coordinator/api/enrolled-players?tournament_id=${encodeURIComponent(id)}`),
          fetchAsCoordinator(`/coordinator/api/feedbacks?tournament_id=${encodeURIComponent(id)}`),
          fetchAsCoordinator('/coordinator/api/complaints')
        ]);

        const enrollData = await enrollRes.json().catch(() => ({}));
        const feedbackData = await feedbackRes.json().catch(() => ({}));
        const complaintsData = await complaintsRes.json().catch(() => ({}));

        individualCount = Array.isArray(enrollData?.individualPlayers) ? enrollData.individualPlayers.length : 0;
        approvedTeamCount = Array.isArray(enrollData?.teamEnrollments) ? enrollData.teamEnrollments.length : 0;
        totalEnrollments = ((t?.type || '').toLowerCase() === 'team') ? approvedTeamCount : individualCount;
        feedbackCount = Array.isArray(feedbackData?.feedbacks) ? feedbackData.feedbacks.length : 0;

        const complaints = Array.isArray(complaintsData?.complaints) ? complaintsData.complaints : [];
        complaintsCount = complaints.filter((c) => {
          const tid = normalizeId(c?.tournament_id || c?.tournament?._id);
          return tid === normalizeId(id);
        }).length;
      } catch {
        // keep fallback values as zero when optional stats calls fail
      }

      const entryFee = Number(t?.entry_fee || t?.entryFee || 0);
      applyTournamentData(t, {
        individualCount,
        approvedTeamCount,
        totalEnrollments,
        feedbackCount,
        complaintsCount,
        totalAmountReceived: entryFee * totalEnrollments
      });
    } catch (e) {
      setError(e.message || 'Failed to load tournament details');
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    setFilesLoading(true);
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/tournaments/${id}/files`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFiles(Array.isArray(data.files) ? data.files : []);
      } else {
        setFiles([]);
      }
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveTournament = async () => {
    if (String(tournament?.status || '').toLowerCase() === 'completed') {
      showMessage('Completed tournaments are read-only.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tournamentName: editForm.tournamentName,
        tournamentDate: editForm.tournamentDate,
        time: editForm.time,
        location: editForm.location,
        entryFee: Number(editForm.entryFee),
        type: editForm.type,
        noOfRounds: Number(editForm.noOfRounds)
      };
      const res = await fetchAsCoordinator(`/coordinator/api/tournaments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to update tournament');
      showMessage(data.message || 'Tournament updated successfully');
      await loadDetails();
    } catch (e) {
      showMessage(e.message || 'Failed to update tournament', 'error');
    } finally {
      setSaving(false);
    }
  };

  const requestFeedback = async () => {
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/tournaments/${id}/request-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send feedback form');
      showMessage('Review form sent');
      await loadDetails();
    } catch (e) {
      showMessage(e.message || 'Failed to request review', 'error');
    }
  };

  if (loading) return <div className="page player-neo" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GlobalLoader /></div>;
  if (error || !tournament) return <div className="page player-neo" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{error || 'Tournament not found'}</div>;

  const rounds = typeof tournament.noOfRounds !== 'undefined' ? tournament.noOfRounds : (tournament.no_of_rounds || 0);
  const isTeam = (tournament.type || '').toLowerCase() === 'team';
  const computePhase = () => {
    const dateOnly = new Date(tournament.date);
    const timeStr = (tournament.time || '').toString();
    const [hh, mm] = (timeStr.match(/^\d{2}:\d{2}$/) ? timeStr.split(':') : ['00', '00']);
    const start = new Date(dateOnly);
    if (!isNaN(parseInt(hh)) && !isNaN(parseInt(mm))) {
      start.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const now = new Date();
    if (now >= end) return 'Completed';
    if (now >= start && now < end) return 'Ongoing';
    return 'Upcoming';
  };
  const statusPhase = computePhase();
  const isCompleted = statusPhase === 'Completed' || String(tournament.status || '').toLowerCase() === 'completed';
  const displayStatus = tournament.status || statusPhase;
  const organizerName =
    tournament.organizerName ||
    tournament.organizer_name ||
    tournament.organizer ||
    'N/A';
  const approvedBy =
    tournament.approved_by ||
    tournament.approvedBy ||
    'Pending';
  const coordinatorName = tournament.coordinator || tournament.added_by || 'N/A';
  const description = tournament.description || tournament.tournamentDescription || 'No description provided.';
  const entryFee = Number(tournament.entry_fee ?? tournament.entryFee ?? 0);
  const imageFiles = files.filter((file) => /\.(jpg|jpeg|png|gif|webp)$/i.test(file.filename || file.url || ''));
  const otherFiles = files.filter((file) => !/\.(jpg|jpeg|png|gif|webp)$/i.test(file.filename || file.url || ''));

  return (
    <div style={{ minHeight: '100vh' }}>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        .page { font-family:'Playfair Display', serif; background-color:var(--page-bg); min-height:100vh; display:flex; color:var(--text-color); }
        .content { flex-grow:1; padding:2rem; }
        .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.2rem; gap:1rem; }
        .tag { background:rgba(var(--sea-green-rgb, 27, 94, 63), 0.16); color:var(--sea-green); border-radius:999px; padding:0.3rem 0.75rem; font-size:0.85rem; }
        .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1rem; }
        .card { background:var(--card-bg); border:1px solid var(--card-border); border-radius:14px; padding:1rem; display:flex; flex-direction:column; gap:0.75rem; min-height:210px; }
        .title { color:var(--sea-green); font-family:'Cinzel', serif; margin-bottom:0.8rem; }
        .meta { opacity:0.8; margin-top:0.6rem; }
        .row { display:grid; grid-template-columns:1fr 1fr; gap:0.7rem; margin-bottom:0.7rem; }
        .field label { display:block; color:var(--sea-green); font-family:'Cinzel', serif; font-size:0.85rem; margin-bottom:0.25rem; }
        .field input, .field select { width:100%; border:1px solid var(--card-border); border-radius:8px; padding:0.55rem; background:var(--page-bg); color:var(--text-color); }
        .btn { display:inline-flex; align-items:center; gap:0.45rem; border:none; border-radius:8px; padding:0.65rem 0.95rem; cursor:pointer; text-decoration:none; font-family:'Cinzel', serif; font-weight:bold; }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); }
        .btn-secondary { background:var(--sky-blue); color:var(--on-accent); }
        .card .btn { align-self:flex-start; }
        .message { margin-bottom:1rem; padding:0.75rem 0.9rem; border-radius:8px; }
        .message.success { color:#1b5e20; background:rgba(76,175,80,0.16); }
        .message.error { color:#c62828; background:rgba(198,40,40,0.16); }
        .card.wide { grid-column: 1 / -1; }
        .info-grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:0.75rem; }
        .info-row { display:flex; justify-content:space-between; gap:0.75rem; padding-bottom:0.45rem; border-bottom:1px solid var(--card-border); }
        .info-row:last-child { border-bottom:none; padding-bottom:0; }
        .info-label { font-family:'Cinzel', serif; color:var(--sea-green); font-size:0.85rem; }
        .info-value { text-align:right; }
        .gallery-stack { display:grid; gap:1rem; }
        .gallery-item { border:none; background:transparent; padding:0; cursor:zoom-in; }
        .gallery-img { width:100%; height:auto; max-height:520px; object-fit:contain; border-radius:12px; border:1px solid var(--card-border); background:rgba(0,0,0,0.2); }
        .attachments { display:flex; flex-direction:column; gap:0.4rem; }
        .file-link { color:var(--sea-green); text-decoration:none; }
        .file-link:hover { color:var(--sky-blue); }
        .lightbox { position:fixed; inset:0; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; padding:1.5rem; z-index:9999; }
        .lightbox-inner { position:relative; max-width: 96vw; max-height: 90vh; }
        .lightbox-img { width:100%; height:auto; max-height:90vh; border-radius:12px; border:1px solid rgba(255,255,255,0.2); background:#0b0f16; }
        .lightbox-close { position:absolute; top:-12px; right:-12px; background:var(--sea-green); color:var(--on-accent); border:none; width:32px; height:32px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        @media (max-width: 768px) {
          .info-grid { grid-template-columns: 1fr; }
          .info-row { flex-direction: column; align-items:flex-start; }
          .info-value { text-align:left; }
        }
      `}</style>

      <div className="page player-neo">
        <AnimatedSidebar links={coordinatorLinks} logo={<i className="fas fa-chess" />} title="ChessHive" />

        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 1001 }}>
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-color)', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'} />
          </motion.button>
        </div>

        <div className="content">
          {message && <div className={`message ${message.type}`}>{message.text}</div>}

          <div className="header">
            <h1 style={{ color: 'var(--sea-green)', fontFamily: 'Cinzel, serif', display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <i className="fas fa-trophy" /> {tournament.name || tournament.tournamentName || 'Tournament'}
            </h1>
            <span className="tag">{displayStatus || 'Pending'}</span>
          </div>

          <div className="grid">
            <div className="card">
              <h3 className="title"><i className="fas fa-info-circle" /> Tournament Overview</h3>
              <div className="info-grid">
                <div className="info-row">
                  <div className="info-label">Status</div>
                  <div className="info-value">{displayStatus || 'Pending'}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Date</div>
                  <div className="info-value">{tournament.date ? new Date(tournament.date).toLocaleDateString() : 'N/A'}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Time</div>
                  <div className="info-value">{tournament.time || 'N/A'}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Location</div>
                  <div className="info-value">{tournament.location || tournament.tournamentLocation || 'N/A'}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Organizer</div>
                  <div className="info-value">{organizerName}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Coordinator</div>
                  <div className="info-value">{coordinatorName}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Approved By</div>
                  <div className="info-value">{approvedBy}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Type</div>
                  <div className="info-value">{tournament.type || 'N/A'}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Rounds</div>
                  <div className="info-value">{rounds || 'N/A'}</div>
                </div>
                <div className="info-row">
                  <div className="info-label">Entry Fee</div>
                  <div className="info-value">₹{Number(entryFee || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="meta">{description}</div>
            </div>
            <div className="card">
              <h3 className="title"><i className="fas fa-edit" /> Edit Tournament</h3>
              {isCompleted && (
                <div style={{ marginBottom: '0.75rem', color: '#c62828', fontWeight: 600 }}>
                  Completed tournaments are read-only.
                </div>
              )}
              <div className="row">
                <div className="field">
                  <label>Name</label>
                  <input value={editForm.tournamentName} onChange={(e) => setEditForm((p) => ({ ...p, tournamentName: e.target.value }))} disabled={isCompleted} />
                </div>
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={editForm.tournamentDate} onChange={(e) => setEditForm((p) => ({ ...p, tournamentDate: e.target.value }))} disabled={isCompleted} />
                </div>
                <div className="field">
                  <label>Time</label>
                  <input type="time" value={editForm.time} onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))} disabled={isCompleted} />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input value={editForm.location} onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))} disabled={isCompleted} />
                </div>
                <div className="field">
                  <label>Entry Fee</label>
                  <input type="number" min="0" value={editForm.entryFee} onChange={(e) => setEditForm((p) => ({ ...p, entryFee: e.target.value }))} disabled={isCompleted} />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select value={editForm.type} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))} disabled={isCompleted}>
                    <option value="">Select</option>
                    <option value="Individual">Individual</option>
                    <option value="Team">Team</option>
                  </select>
                </div>
              </div>
              <div className="field" style={{ marginBottom: '0.8rem' }}>
                <label>No. of Rounds</label>
                <input type="number" min="1" value={editForm.noOfRounds} onChange={(e) => setEditForm((p) => ({ ...p, noOfRounds: e.target.value }))} disabled={isCompleted} />
              </div>
              <button className="btn btn-primary" onClick={saveTournament} disabled={saving || isCompleted}>
                <i className="fas fa-save" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>

            <div className="card">
              <h3 className="title"><i className="fas fa-star" /> Reviews</h3>
              {tournament.feedback_requested ? (
                <Link className="btn btn-secondary" to={`/coordinator/feedback_view?tournament_id=${id}`}>
                  <i className="fas fa-eye" /> View Reviews
                </Link>
              ) : (
                <button className="btn btn-primary" onClick={requestFeedback}>
                  <i className="fas fa-paper-plane" /> Send Review Form
                </button>
              )}
              <div className="meta">Review count: {stats.feedbackCount || 0}</div>
            </div>

            <div className="card">
              <h3 className="title"><i className="fas fa-exclamation-triangle" /> Complaints</h3>
              <Link className="btn btn-secondary" to={`/coordinator/tournament_complaints?tournament_id=${id}`}>
                <i className="fas fa-bug" /> Open Complaints
              </Link>
              <div className="meta">Complaint count: {stats.complaintsCount || 0}</div>
            </div>

            <div className="card">
              <h3 className="title"><i className="fas fa-chess-board" /> Pairings</h3>
              <Link className="btn btn-secondary" to={`/coordinator/pairings?tournament_id=${id}&rounds=${rounds}${isTeam ? '&type=team' : ''}`}>
                <i className="fas fa-arrow-right" /> Open Pairings
              </Link>
            </div>

            <div className="card">
              <h3 className="title"><i className="fas fa-users" /> Enrolled Players</h3>
              <Link className="btn btn-secondary" to={`/coordinator/enrolled_players?tournament_id=${id}`}>
                <i className="fas fa-arrow-right" /> Open Enrolled Players
              </Link>
              <div className="meta">
                Enrolled: {isTeam ? (stats.approvedTeamCount || 0) : (stats.individualCount || 0)} {isTeam ? 'approved teams' : 'players'}
              </div>
            </div>

            <div className="card">
              <h3 className="title"><i className="fas fa-medal" /> Standings</h3>
              <Link className="btn btn-secondary" to={`/coordinator/rankings?tournament_id=${id}${isTeam ? '&type=team' : ''}`}>
                <i className="fas fa-arrow-right" /> Open Standings
              </Link>
            </div>

            <div className="card wide">
              <h3 className="title"><i className="fas fa-images" /> Gallery</h3>
              {filesLoading ? (
                <div className="meta">Loading images...</div>
              ) : imageFiles.length === 0 ? (
                <div className="meta">No images uploaded.</div>
              ) : (
                <div className="gallery-stack">
                  {imageFiles.map((file) => (
                    <button
                      key={file._id || file.url}
                      type="button"
                      className="gallery-item"
                      onClick={() => setPreviewImage(file)}
                    >
                      <img className="gallery-img" src={file.url} alt={file.filename || 'Tournament image'} />
                    </button>
                  ))}
                </div>
              )}

              {otherFiles.length > 0 && (
                <div style={{ marginTop: '0.85rem' }}>
                  <div className="info-label">Attachments</div>
                  <div className="attachments">
                    {otherFiles.map((file) => (
                      <a key={file._id || file.url} className="file-link" href={file.url} target="_blank" rel="noopener noreferrer">
                        {file.filename || 'Attachment'}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="title"><i className="fas fa-rupee-sign" /> Total Amount Received</h3>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>₹{Number(stats.totalAmountReceived || 0).toLocaleString('en-IN')}</div>
              <div className="meta">
                ₹{Number(entryFee || 0).toLocaleString('en-IN')} x {stats.totalEnrollments || 0} {isTeam ? 'team enrollments' : 'player enrollments'}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.2rem' }}>
            <Link className="btn btn-secondary" to="/coordinator/tournament_management">
              <i className="fas fa-arrow-left" /> Back to Tournaments
            </Link>
          </div>

          {previewImage && (
            <div className="lightbox" onClick={() => setPreviewImage(null)}>
              <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="lightbox-close" onClick={() => setPreviewImage(null)} aria-label="Close image preview">
                  <i className="fas fa-times" />
                </button>
                <img className="lightbox-img" src={previewImage.url} alt={previewImage.filename || 'Tournament image'} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TournamentDetails;


