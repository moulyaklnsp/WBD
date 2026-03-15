import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import usePlayerTheme from '../../hooks/usePlayerTheme';
import { fetchAsPlayer } from '../../utils/fetchWithRole';

function platformIcon(platform) {
  const p = (platform || '').toLowerCase();
  if (p.includes('youtube') || p === 'youtube') return 'fab fa-youtube';
  if (p.includes('twitch') || p === 'twitch') return 'fab fa-twitch';
  if (p.includes('lichess')) return 'fas fa-chess';
  if (p.includes('chess') || p === 'chesscom') return 'fas fa-chess-king';
  return 'fas fa-broadcast-tower';
}

function getEmbedUrl(url) {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1` };
  const ytLive = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
  if (ytLive) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytLive[1]}?autoplay=1` };
  const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
  if (twitchMatch) return { type: 'twitch', src: `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${window.location.hostname}` };
  return null;
}

const QUICK_ACCESS_SOURCES = [
  { id: 'lichess', label: 'Lichess TV', icon: 'fas fa-chess', src: 'https://lichess.org/tv/frame?theme=brown&bg=dark' },
  { id: 'lichess-classical', label: 'Lichess Classical', icon: 'fas fa-chess-king', src: 'https://lichess.org/tv/classical/frame?theme=brown&bg=dark' },
  { id: 'lichess-rapid', label: 'Lichess Rapid', icon: 'fas fa-chess-rook', src: 'https://lichess.org/tv/rapid/frame?theme=brown&bg=dark' },
  { id: 'lichess-blitz', label: 'Lichess Blitz', icon: 'fas fa-bolt', src: 'https://lichess.org/tv/blitz/frame?theme=brown&bg=dark' },
];

export default function PlayerWatch() {
  const navigate = useNavigate();
  usePlayerTheme();
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streamFilter, setStreamFilter] = useState('all');
  const [activeEmbed, setActiveEmbed] = useState(null);

  const loadStreams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAsPlayer('/player/api/streams');
      if (!res.ok) {
        if (res.status === 401) { navigate('/login'); return; }
        setStreams([]);
        return;
      }
      const data = await res.json().catch(() => []);
      setStreams(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load streams:', e);
      setStreams([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadStreams();
    const interval = setInterval(loadStreams, 30000);
    return () => clearInterval(interval);
  }, [loadStreams]);

  const liveStreams = streams.filter(s => s.isLive && (streamFilter === 'all' || (s.streamType || '').toLowerCase() === streamFilter));
  const FORMATS = ['all', 'classical', 'rapid', 'blitz'];

  return (
    <div>
      <style>{`
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .watch-wrap{ max-width:1100px; margin:0 auto; }
        .watch-header{ display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap; }
        .watch-title{ font-family:'Cinzel', serif; color:var(--sea-green); margin:0; }
        .btn{ background:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; text-decoration:none; display:inline-flex; gap:0.5rem; align-items:center; transition: all 0.2s; }
        .btn:hover{ filter: brightness(1.1); transform: translateY(-1px); }
        .btn.secondary{ background:var(--sky-blue); color:var(--on-accent); }
        .btn.ghost{ background:transparent; color:var(--sea-green); border:1px solid var(--card-border); }
        .card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:15px; padding:1.25rem; box-shadow:none; }
        .muted{ opacity:0.8; }
        .section-title{ font-family:'Cinzel', serif; color:var(--sea-green); margin: 0 0 0.75rem 0; font-size: 1.2rem; }
        .mini-grid{ display:grid; grid-template-columns:1fr; gap:1rem; }
        @media (min-width: 900px){ .mini-grid{ grid-template-columns: 1fr 1fr; } }
        .tv-card{ display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .tv-left{ display:flex; align-items:center; gap:0.85rem; }
        .tv-logo{ width:52px; height:52px; border-radius:12px; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.05); border:1px solid var(--card-border); overflow:hidden; }
        .feature-card{ background: linear-gradient(135deg, rgba(var(--sea-green-rgb), 0.1) 0%, var(--card-bg) 100%); }
        .stream-card{ transition: transform 0.2s, box-shadow 0.2s; border-left: 3px solid #ff4444; }
        .stream-card:hover{ transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .live-badge{ margin-left: 0.75rem; font-size: 0.75rem; background: #ff4444; color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; animation: pulse 1.5s infinite; }
        .empty-state{ text-align: center; padding: 2rem 1rem; }
        .empty-icon{ font-size: 3rem; color: var(--sea-green); opacity: 0.3; margin-bottom: 0.75rem; }
        .embed-frame{ width:100%; border:none; border-radius:10px; background:#1a1a1a; margin-top:0.75rem; }
        .qa-source-btns{ display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:0.75rem; }
        .board-embed-wrap{ display:flex; justify-content:center; margin-top:1rem; }
        .board-embed-frame{ width:min(100%,480px); height:480px; border:2px solid var(--sea-green); border-radius:10px; display:block; }

      `}</style>

      <div className="page">
      <div className="watch-wrap">
        <div className="watch-header">
          <h1 className="watch-title"><i className="fas fa-video" /> Watch Live Chess</h1>
        </div>

        {/* Live Tournament Streams */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">
            <i className="fas fa-broadcast-tower" style={{ marginRight: '0.5rem', color: '#ff4444' }} />
            Live Tournament Streams
            {liveStreams.length > 0 && <span className="live-badge">LIVE</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {FORMATS.map(f => (
              <button key={f} className={`btn ${streamFilter === f ? '' : 'ghost'}`} onClick={() => setStreamFilter(f)} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', textTransform: 'capitalize' }}>
                {f === 'all' ? 'All Formats' : f}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--sea-green)' }} />
              <div style={{ marginTop: '0.75rem' }}>Loading streams...</div>
            </div>
          ) : liveStreams.length > 0 ? (
            <div className="mini-grid">
              {liveStreams.map((stream) => {
                const embed = getEmbedUrl(stream.url);
                return (
                  <div key={stream._id} className="card feature-card stream-card">
                    <div className="tv-card">
                      <div className="tv-left">
                        <div className="tv-logo" style={{ background: 'rgba(255,68,68,0.1)' }}>
                          <i className={platformIcon(stream.platform)} style={{ fontSize: '1.5rem', color: 'var(--sea-green)' }} />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 800, color: 'var(--sea-green)', fontSize: '1.1rem' }}>{stream.title}</div>
                          {(stream.matchLabel || stream.description) && (
                            <div className="muted" style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>{stream.matchLabel || stream.description}</div>
                          )}
                          {stream.result && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--sea-green)', fontWeight: 'bold' }}>
                              <i className="fas fa-flag-checkered" /> {stream.result}
                            </div>
                          )}
                          <div className="muted" style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                            {(stream.streamType || 'classical').toUpperCase()} - By {stream.createdByName || 'Coordinator'}
                          </div>
                        </div>
                      </div>
                      <button className="btn" type="button" onClick={() => window.open(stream.url, '_blank', 'noopener,noreferrer')}>
                        <i className="fas fa-play" /> Watch
                      </button>
                    </div>
                    {embed && <iframe className="embed-frame" src={embed.src} height="320" title={stream.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />}
                    {!embed && <div className="muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem', textAlign: 'center' }}>This stream opens in a new window</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card empty-state">
              <div className="empty-icon"><i className="fas fa-video-slash" /></div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: 'var(--sea-green)', marginBottom: '0.5rem' }}>No Live Streams</div>
              <div className="muted">No tournament streams at the moment. Check back later!</div>
            </div>
          )}
        </div>

        {/* Quick Access - Lichess Live Boards */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-title"><i className="fas fa-bolt" style={{ marginRight: '0.5rem' }} />Watch Live Games</div>
          <div className="card">
            <div className="qa-source-btns" style={{ marginBottom: activeEmbed ? '1rem' : 0 }}>
              {QUICK_ACCESS_SOURCES.map(source => (
                <button
                  key={source.id}
                  className={`btn ${activeEmbed?.id === source.id ? '' : 'ghost'}`}
                  onClick={() => setActiveEmbed(activeEmbed?.id === source.id ? null : source)}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <i className={source.icon} /> {source.label}
                </button>
              ))}
            </div>
            {activeEmbed && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 800, color: 'var(--sea-green)', fontSize: '1.1rem' }}>
                    <i className={activeEmbed.icon} style={{ marginRight: '0.5rem' }} />{activeEmbed.label}
                  </div>
                  <button className="btn" onClick={() => setActiveEmbed(null)} style={{ background: '#e74c3c', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    <i className="fas fa-times" /> Close
                  </button>
                </div>
                <div className="board-embed-wrap">
                  <iframe
                    src={activeEmbed.src}
                    title={activeEmbed.label}
                    className="board-embed-frame"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
      <button type="button" className="back-to-dashboard" onClick={() => navigate('/player/player_dashboard')}>
        <i className="fas fa-arrow-left" /> Back to Dashboard
      </button>
      </div>
    </div>
  );
}


