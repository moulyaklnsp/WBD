import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

function safeTrim(v) {
  return (v == null ? '' : String(v)).trim();
}

function platformLabel(p) {
  const v = (p || '').toString();
  if (!v) return 'Other';
  if (v === 'chesscom') return 'Chess.com';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function detectPlatformFromUrl(url) {
  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();
    if (host.includes('lichess.org')) return 'lichess';
    if (host.includes('chess.com')) return 'chesscom';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('twitch.tv')) return 'twitch';
  } catch {
    // ignore
  }
  return null;
}

export default function CoordinatorStreamingControl() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streams, setStreams] = useState([]);
  const [resultDrafts, setResultDrafts] = useState({});

  const [form, setForm] = useState({
    title: '',
    url: '',
    platform: 'youtube',
    streamType: 'classical',
    matchLabel: '',
    description: '',
    isLive: true,
    featured: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAsCoordinator('/coordinator/api/streams');
      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        if (res.status === 403) {
          setError('Unauthorized: only coordinators can manage streams.');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json().catch(() => []);
      setStreams(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load streams');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // keep local result drafts in sync (only set when not already edited)
    setResultDrafts((prev) => {
      const next = { ...prev };
      (streams || []).forEach((s) => {
        const key = s._id;
        if (!key) return;
        if (next[key] == null) next[key] = s.result || '';
      });
      return next;
    });
  }, [streams]);

  const liveStreams = useMemo(() => (streams || []).filter(s => !!s.isLive), [streams]);
  const draftStreams = useMemo(() => (streams || []).filter(s => !s.isLive), [streams]);

  const onCreate = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      title: safeTrim(form.title),
      url: safeTrim(form.url),
      platform: safeTrim(form.platform),
      streamType: safeTrim(form.streamType),
      matchLabel: safeTrim(form.matchLabel),
      description: safeTrim(form.description),
      result: '',
      isLive: !!form.isLive,
      featured: !!form.featured,
    };

    try {
      const res = await fetchAsCoordinator('/coordinator/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      setForm({ title: '', url: '', platform: 'youtube', streamType: 'classical', matchLabel: '', description: '', isLive: true, featured: false });
      await load();
    } catch (e2) {
      setError(e2.message || 'Failed to create stream');
    }
  };

  const patchStream = async (id, patch) => {
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/streams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to update stream');
    }
  };

  const deleteStream = async (id) => {
    if (!window.confirm('Delete this stream?')) return;
    try {
      const res = await fetchAsCoordinator(`/coordinator/api/streams/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete stream');
    }
  };

  const StreamCard = ({ s }) => (
    <motion.div
      className="updates-section"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.05rem' }}>{s.title}</div>
          <div style={{ opacity: 0.8 }}>{s.matchLabel || s.description || ''}</div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.9rem', opacity: 0.8 }}>
            {platformLabel(s.platform)} - {(s.streamType || 'classical').toUpperCase()}{s.updatedAt ? ` - Updated ${new Date(s.updatedAt).toLocaleString()}` : ''}
          </div>
        </div>
        <span className="status-pill">{s.isLive ? 'LIVE' : (s.endedAt ? 'COMPLETED' : 'DRAFT')}</span>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <div className="form-label">Result (optional, visible to players)</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ maxWidth: 520 }}
            value={resultDrafts[s._id] ?? (s.result || '')}
            onChange={(e) => setResultDrafts((p) => ({ ...p, [s._id]: e.target.value }))}
            placeholder="Example: White wins • 1-0"
          />
          <button
            className="action-btn"
            type="button"
            onClick={() => patchStream(s._id, { result: safeTrim(resultDrafts[s._id] ?? '') })}
          >
            <i className="fas fa-save" /> Save Result
          </button>
        </div>
      </div>

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a href={s.url} target="_blank" rel="noreferrer" className="action-btn">
          <i className="fas fa-external-link-alt" /> Open
        </a>

        <button className="btn-primary" onClick={() => patchStream(s._id, { isLive: !s.isLive })}>
          <i className="fas fa-broadcast-tower" /> {s.isLive ? 'Stop' : 'Go Live'}
        </button>

        {!s.isLive ? null : (
          <button
            className="action-btn"
            type="button"
            onClick={() => patchStream(s._id, { isLive: false, result: safeTrim(resultDrafts[s._id] ?? '') })}
          >
            <i className="fas fa-flag-checkered" /> Mark Completed
          </button>
        )}

        <button className="action-btn" onClick={() => patchStream(s._id, { featured: !s.featured })}>
          <i className="fas fa-star" /> {s.featured ? 'Unfeature' : 'Feature'}
        </button>

        <button className="btn-danger" onClick={() => deleteStream(s._id)}>
          <i className="fas fa-trash" /> Delete
        </button>
      </div>
    </motion.div>
  );

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
        .form-grid { display:grid; grid-template-columns:1fr; gap:1rem; }
        .form-input { width:100%; padding:0.65rem; border-radius:10px; border:2px solid var(--sea-green); background:var(--card-bg); color:var(--text-color); }
        .form-label { font-family:'Cinzel', serif; color:var(--sea-green); font-size:0.9rem; margin-bottom:0.5rem; display:block; }
        .btn-primary { background:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; text-decoration:none; display:inline-flex; gap:0.5rem; align-items:center; }
        .action-btn { background:var(--sky-blue); color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; text-decoration:none; display:inline-flex; gap:0.5rem; align-items:center; }
        .btn-danger { background:#ff4d4d; color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; text-decoration:none; display:inline-flex; gap:0.5rem; align-items:center; }
        .status-pill { padding:0.25rem 0.6rem; border-radius:999px; font-size:0.85rem; border:1px solid var(--card-border); background:var(--card-bg); color:var(--text-color); }
        .error-box { background:#ffdddd; color:#b00020; padding:0.75rem; border-radius:10px; border:1px solid rgba(176,0,32,0.25); margin-bottom:1rem; }
        .header-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; }
        .section-title { font-family:'Cinzel', serif; color:var(--sea-green); margin:1rem 0 0.5rem 0; }
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
          <i className="fas fa-broadcast-tower" />
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
          <div className="header-row">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <i className="fas fa-broadcast-tower" /> Streaming Control
            </motion.h1>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="action-btn" onClick={load}><i className="fas fa-sync" /> Refresh</button>
            </div>
          </div>

          {error && <div className="error-box"><strong>Error:</strong> {error}</div>}

          <motion.div
            className="updates-section"
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.75rem' }}>Create / Publish Stream</div>
            <form onSubmit={onCreate}>
              <div className="form-grid">
                <div>
                  <div className="form-label">Title</div>
                  <input className="form-input" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Example: Finals Board 1" required />
                </div>

                <div>
                  <div className="form-label">Stream URL</div>
                  <input
                    className="form-input"
                    value={form.url}
                    onChange={(e) => {
                      const nextUrl = e.target.value;
                      const detected = detectPlatformFromUrl(nextUrl);
                      setForm((f) => ({ ...f, url: nextUrl, platform: detected || f.platform }));
                    }}
                    placeholder={form.platform === 'lichess'
                      ? 'https://lichess.org/<gameId> or https://lichess.org/study/<studyId>/<chapterId>'
                      : form.platform === 'chesscom'
                        ? 'https://www.chess.com/game/live/<id> (or share URL)'
                        : 'https://youtube.com/watch?v=...'}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <div className="form-label">Platform</div>
                    <select className="form-input" value={form.platform} onChange={(e) => setForm(f => ({ ...f, platform: e.target.value }))}>
                      <option value="youtube">YouTube</option>
                      <option value="twitch">Twitch</option>
                      <option value="lichess">Lichess</option>
                      <option value="chesscom">Chess.com</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <div className="form-label">Stream Type</div>
                    <select
                      className="form-input"
                      value={form.streamType}
                      onChange={(e) => setForm(f => ({ ...f, streamType: e.target.value }))}
                      required
                    >
                      <option value="classical">Classical</option>
                      <option value="rapid">Rapid</option>
                      <option value="blitz">Blitz</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="form-label">Match Label (optional)</div>
                  <input className="form-input" value={form.matchLabel} onChange={(e) => setForm(f => ({ ...f, matchLabel: e.target.value }))} placeholder="Tournament - Round - Board" />
                </div>

                <div>
                  <div className="form-label">Description (optional)</div>
                  <input className="form-input" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short note for players" />
                </div>

                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={form.isLive} onChange={(e) => setForm(f => ({ ...f, isLive: e.target.checked }))} />
                    <span className="form-label">Live now</span>
                  </label>
                  <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input type="checkbox" checked={form.featured} onChange={(e) => setForm(f => ({ ...f, featured: e.target.checked }))} />
                    <span className="form-label">Featured</span>
                  </label>
                </div>

                <div>
                  <button type="submit" className="btn-primary"><i className="fas fa-plus" /> Publish</button>
                </div>
              </div>
            </form>
          </motion.div>

          {loading ? (
            <div className="updates-section">Loading…</div>
          ) : (
            <>
              <div className="section-title">Live</div>
              {liveStreams.length === 0 ? (
                <div className="updates-section"><span style={{ opacity: 0.8 }}>No live streams.</span></div>
              ) : (
                liveStreams.map(s => <StreamCard key={s._id} s={s} />)
              )}

              <div className="section-title">Drafts</div>
              {draftStreams.length === 0 ? (
                <div className="updates-section"><span style={{ opacity: 0.8 }}>No drafts.</span></div>
              ) : (
                draftStreams.map(s => <StreamCard key={s._id} s={s} />)
              )}
            </>
          )}

          <motion.div
            className="updates-section"
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}>Player View</div>
            <div style={{ marginTop: '0.5rem', opacity: 0.8 }}>
              Players will see any stream marked as <strong>Live</strong> on the Watch page.
            </div>
          </motion.div>
        </div>

        <Link to="/coordinator/coordinator_dashboard" className="back-to-dashboard">
          <i className="fas fa-arrow-left" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}






