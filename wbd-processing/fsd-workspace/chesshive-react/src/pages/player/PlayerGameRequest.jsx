import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function PlayerGameRequest() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const [status, setStatus] = useState('idle'); // idle | requesting | waiting | matched | error
  const [message, setMessage] = useState('');
  const [matchId, setMatchId] = useState('');
  const [opponent, setOpponent] = useState('');
  const [colorPreference, setColorPreference] = useState('random'); // 'white' | 'black' | 'random'
  const [timeControl, setTimeControl] = useState('5+0'); // e.g. "3+2", "5+0", "10+0"
  const [incoming, setIncoming] = useState([]); // pending requests for me
  const navigate = useNavigate();
  const query = useQuery();

  const devHeaders = useMemo(() => {
    if (process.env.NODE_ENV === 'production') return undefined;
    return {
      'x-dev-role': 'player',
      'x-dev-email': 'devplayer@localhost',
      'x-dev-username': 'devplayer'
    };
  }, []);

  const startRequest = async () => {
    if (!opponent) { setMessage('Enter opponent username'); return; }
    setStatus('requesting');
    setMessage('Sending request...');
    try {
      const res = await fetch('/player/api/match/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(devHeaders || {}) },
        body: JSON.stringify({ opponent, colorPreference, timeControl })
      });
      if (!res.ok) throw new Error('Failed to request');
      const data = await res.json();
      const requestId = data.requestId;
      setStatus('waiting');
      setMessage('Waiting for opponent to accept...');
      let tries = 0;
      const pollAccept = async () => {
        tries++;
        // Opponent will accept, and then we should check match list by searching a match for me
        // Simplify: check pending ticket map or attempt to fetch last created match via server exposing a minimal lookup
        const r = await fetch('/player/api/match/pending', { credentials: 'include', headers: devHeaders || undefined });
        if (r.ok) {
          // If there are no pending, try fetching a lightweight self-match lookup (reuse ticket polling by side-effect)
          const m = await fetch('/player/api/match/self-last', { credentials: 'include', headers: devHeaders || undefined }).catch(() => null);
          if (m && m.ok) {
            const d = await m.json();
            if (d.matchId) {
              setMatchId(d.matchId);
              setStatus('matched');
              setMessage('Match accepted!');
              return;
            }
          }
        }
        if (tries < 120) setTimeout(pollAccept, 2000); else { setStatus('error'); setMessage('Timeout waiting for acceptance.'); }
      };
      pollAccept();
    } catch (e) {
      setStatus('error');
      setMessage('Unable to request match.');
    }
  };

  const goToMatch = () => {
    if (!matchId) return;
    navigate(`/player/play_chess?match_id=${encodeURIComponent(matchId)}`);
  };

  // Load incoming requests (for acceptance)
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const r = await fetch('/player/api/match/pending', { credentials: 'include', headers: devHeaders || undefined });
        if (r.ok) {
          const d = await r.json();
          setIncoming(d.requests || []);
        }
      } catch {}
      timer = setTimeout(poll, 3000);
    };
    poll();
    return () => { if (timer) clearTimeout(timer); };
  }, [devHeaders]);

  const acceptRequest = async (requestId) => {
    try {
      const r = await fetch('/player/api/match/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(devHeaders || {}) },
        body: JSON.stringify({ requestId })
      });
      if (!r.ok) throw new Error('Failed to accept');
      const d = await r.json();
      setMatchId(d.matchId);
      setStatus('matched');
      setMessage('Match created!');
    } catch (e) {
      setMessage('Error accepting request');
    }
  };

  return (
    <div className="content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ color: 'var(--sky-blue)', fontFamily: 'Cinzel, serif' }}>Request a Chess Match</h1>
        <button onClick={toggleTheme} style={{ background: 'transparent', border: '2px solid var(--sea-green)', color: 'var(--sea-green)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', letterSpacing: '.5px' }}>{isDark ? 'Switch to Light' : 'Switch to Dark'}</button>
      </div>
      <div className="form-container">
        <p>{message}</p>
        {status !== 'matched' && (
          <div style={{ display:'flex', gap:'1rem', alignItems:'center', flexWrap:'wrap' }}>
            <input type="text" placeholder="Opponent username" value={opponent} onChange={(e) => setOpponent(e.target.value)} style={{ padding:'0.6rem 0.9rem', border:'2px solid var(--sky-blue)', borderRadius:10, background:'#03101d', color:'var(--text-color)' }} />
            <select className="player-select" value={colorPreference} onChange={(e) => setColorPreference(e.target.value)}>
              <option value="random">Random</option>
              <option value="white">White</option>
              <option value="black">Black</option>
            </select>
            <select className="player-select" value={timeControl} onChange={(e) => setTimeControl(e.target.value)}>
              <option value="1+0">Bullet (1+0)</option>
              <option value="3+2">Blitz (3+2)</option>
              <option value="5+0">Blitz (5+0)</option>
              <option value="10+0">Rapid (10+0)</option>
            </select>
            <button onClick={startRequest} className="btn">Request Match</button>
          </div>
        )}
        {status === 'matched' && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="status-pill enrolled">Matched vs {opponent || 'Opponent'}</span>
            <button onClick={goToMatch} className="btn">Start Game</button>
          </div>
        )}
      </div>
      {/* Incoming requests for me */}
      <div className="form-container">
        <h3 style={{ color:'var(--sky-blue)', fontFamily:'Cinzel, serif' }}>Incoming Requests</h3>
        {(incoming.length === 0) ? (
          <p style={{ color:'var(--sea-green)' }}>No pending requests.</p>
        ) : (
          <ul style={{ listStyle:'none', padding:0 }}>
            {incoming.map((r) => (
              <li key={r.requestId} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.5rem 0' }}>
                <span><strong>{r.from}</strong> wants to play ({r.colorPref}{r.timeControl?.label ? `, ${r.timeControl.label}` : ''})</span>
                <button className="btn" onClick={() => acceptRequest(r.requestId)}>Accept</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <Link to="/player/player_dashboard" className="btn" style={{ textDecoration: 'none' }}>Back to Dashboard</Link>
      </div>
    </div>
  );
}
