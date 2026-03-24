import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function PlayerPlayChess() {
  const [isDark, toggleTheme] = usePlayerTheme();
  const query = useQuery();
  const matchId = query.get('match_id');

  const Chess = useRef(null);
  const [boardFen, setBoardFen] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState('white'); // 'white' | 'black'

  useEffect(() => {
    // lazy-load chess.js from CDN
    if (Chess.current) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/chess.min.js';
    script.async = true;
    script.onload = () => {
      Chess.current = window.Chess; // global from chess.js v1
    };
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  // Load match state
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/player/api/match/${encodeURIComponent(matchId)}`, { credentials: 'include' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        setBoardFen(data.state?.fen || 'start');
        setRole(data.role || 'white');
      } catch (e) {
        setError('Failed to load match.');
      } finally {
        setLoading(false);
      }
    };
    if (matchId) load();
  }, [matchId]);

  // Poll for opponent moves every 2s
  useEffect(() => {
    let timer = null;
    const poll = async () => {
      try {
        const res = await fetch(`/player/api/match/${encodeURIComponent(matchId)}/state`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        setBoardFen(data.fen);
      } catch {}
      timer = setTimeout(poll, 2000);
    };
    if (matchId) poll();
    return () => { if (timer) clearTimeout(timer); };
  }, [matchId]);

  const onSquareClick = async (from, to) => {
    if (!Chess.current) return;
    try {
      const game = new Chess.current(boardFen === 'start' ? undefined : boardFen);
      const result = game.move({ from, to, promotion: 'q' });
      if (!result) return; // illegal
      const newFen = game.fen();
      setBoardFen(newFen);
      await fetch(`/player/api/match/${encodeURIComponent(matchId)}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ from, to, fen: newFen })
      });
    } catch {}
  };

  // simple board render using emoji squares; can be replaced by chessboard library later
  const Board = () => {
    const size = 8;
    const squares = [];
    for (let r = size; r >= 1; r--) {
      const row = [];
      for (let c = 1; c <= size; c++) {
        const key = String.fromCharCode(96 + c) + r;
        row.push(<div key={key} className="cell" data-square={key} onClick={(e) => {
          const sq = e.currentTarget.getAttribute('data-square');
          const sel = window._selSq;
          if (!sel) { window._selSq = sq; e.currentTarget.classList.add('selected'); }
          else { const prev = document.querySelector(`[data-square="${sel}"]`); if (prev) prev.classList.remove('selected'); window._selSq = null; onSquareClick(sel, sq); }
        }} />);
      }
      squares.push(<div key={r} className="row">{row}</div>);
    }
    return <div className="board">{squares}</div>;
  };

  return (
    <div className="content">
      <style>{`
        .board { display:grid; grid-template-rows: repeat(8, 48px); gap:0; width:384px; border:2px solid var(--border-color); }
        .row { display:grid; grid-template-columns: repeat(8, 48px); }
        .cell { width:48px; height:48px; }
        .row:nth-child(odd) .cell:nth-child(odd), .row:nth-child(even) .cell:nth-child(even) { background:#f0d9b5; }
        .row:nth-child(odd) .cell:nth-child(even), .row:nth-child(even) .cell:nth-child(odd) { background:#b58863; }
        .selected { outline:3px solid var(--sky-blue); }
      `}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
        <h1 style={{ color:'var(--sky-blue)', fontFamily:'Cinzel, serif' }}>Live Chess Match</h1>
        <button onClick={toggleTheme} style={{ background:'transparent', border:'2px solid var(--sea-green)', color:'var(--sea-green)', padding:'8px 12px', borderRadius:8, cursor:'pointer', fontFamily:'Cinzel, serif', fontWeight:'bold', letterSpacing:'.5px' }}>{isDark ? 'Switch to Light' : 'Switch to Dark'}</button>
      </div>
      {loading && <p>Loading match...</p>}
      {!!error && !loading && <p>{error}</p>}
      {!loading && !error && (
        <div className="form-container" style={{ display:'flex', gap:'2rem', alignItems:'flex-start' }}>
          <div>
            <Board />
            <p style={{ marginTop:'1rem' }}>You are: <strong>{role}</strong></p>
          </div>
          <div style={{ flex:1 }}>
            <h2 style={{ color:'var(--sky-blue)', fontFamily:'Cinzel, serif' }}>Moves</h2>
            <p>Board FEN: {boardFen}</p>
            <p style={{ fontStyle:'italic' }}>Click a square, then another to move.</p>
          </div>
        </div>
      )}
      <div style={{ textAlign: 'right', marginTop:'1rem' }}>
        <Link to="/player/player_dashboard" className="btn" style={{ textDecoration: 'none' }}>Back to Dashboard</Link>
      </div>
    </div>
  );
}
