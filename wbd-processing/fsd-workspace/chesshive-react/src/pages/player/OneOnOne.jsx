import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';

// Simple one-on-one challenge page converted from views/player/one_on_one.ejs
// Uses Chessboard.js from CDN to avoid adding heavy dependencies.

const CDN = {
  chessboardCss: 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard.min.css',
  chessJs: 'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  chessboardJs: 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard.min.js',
};

function OneOnOne() {
  const [isDark, toggleTheme] = usePlayerTheme();
  // UI state
  const [search, setSearch] = useState('');
  const [foundPlayer, setFoundPlayer] = useState(null); // string | null
  const [color, setColor] = useState('white');
  const [timeControl, setTimeControl] = useState('5+0');
  const [gameVisible, setGameVisible] = useState(false);

  // Chessboard container and instance refs
  const boardContainerRef = useRef(null);
  const boardInstanceRef = useRef(null);

  const devHeaders = useCallback(() => {
    // Optional local-dev bypass for /player routes (see backend isPlayer middleware)
    if (process.env.NODE_ENV === 'production') return undefined;
    return {
      'x-dev-role': 'player',
      'x-dev-email': 'devplayer@localhost',
      'x-dev-username': 'devplayer'
    };
  }, []);

  // Dynamically load required CSS/JS from CDN
  useEffect(() => {
    let cssEl; let chessJsEl; let chessboardJsEl;

    // Inject CSS for chessboard
    cssEl = document.createElement('link');
    cssEl.rel = 'stylesheet';
    cssEl.href = CDN.chessboardCss;
    document.head.appendChild(cssEl);

    // Load chess.js first (optional for validation/logic).
    chessJsEl = document.createElement('script');
    chessJsEl.src = CDN.chessJs;
    chessJsEl.async = true;
    document.body.appendChild(chessJsEl);

    // Then load chessboard.js
    chessboardJsEl = document.createElement('script');
    chessboardJsEl.src = CDN.chessboardJs;
    chessboardJsEl.async = true;
    document.body.appendChild(chessboardJsEl);

    return () => {
      // Cleanup on unmount
      if (boardInstanceRef.current && boardInstanceRef.current.destroy) {
        try { boardInstanceRef.current.destroy(); } catch (_) {}
      }
      if (cssEl) document.head.removeChild(cssEl);
      if (chessJsEl) document.body.removeChild(chessJsEl);
      if (chessboardJsEl) document.body.removeChild(chessboardJsEl);
    };
  }, []);

  const searchPlayer = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      alert('Enter player name');
      setFoundPlayer(null);
      return;
    }
    try {
      const headers = devHeaders();
      const res = await fetch(`/player/api/chess/player/${encodeURIComponent(q)}`, {
        credentials: 'include',
        headers: headers || undefined
      });
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      if (!data?.player?.name) throw new Error('Invalid response');
      setFoundPlayer(data.player.name);
    } catch {
      alert('Player not found! Try again.');
      setFoundPlayer(null);
    }
  }, [search, devHeaders]);

  const startChessGame = useCallback((chosenColor) => {
    setGameVisible(true);

    // Ensure scripts are loaded
    const createBoard = () => {
      if (!boardContainerRef.current) return;
      if (!window.Chessboard) return; // Wait for script

      if (!boardInstanceRef.current) {
        // eslint-disable-next-line no-undef
        const instance = window.Chessboard(boardContainerRef.current, {
          draggable: true,
          position: 'start',
          onDrop: (source, target) => {
            // Minimal demo behavior: log the move
            // Integrate with chess.js here to validate if needed.
            // eslint-disable-next-line no-console
            console.log(`Move: ${source} to ${target}`);
          },
        });
        boardInstanceRef.current = instance;
      } else {
        // Reset board if already exists
        try { boardInstanceRef.current.start(); } catch (_) {}
      }

      if (chosenColor === 'black') {
        try { boardInstanceRef.current.orientation('black'); } catch (_) {}
      } else if (chosenColor === 'white') {
        try { boardInstanceRef.current.orientation('white'); } catch (_) {}
      } else {
        // random
        const orient = Math.random() < 0.5 ? 'white' : 'black';
        try { boardInstanceRef.current.orientation(orient); } catch (_) {}
      }
    };

    // If chessboard script not ready yet, retry shortly
    if (!window.Chessboard) {
      setTimeout(createBoard, 200);
    } else {
      createBoard();
    }
  }, []);

  const sendChallenge = useCallback(() => {
    alert(`Challenge sent! Playing as ${color} with ${timeControl} time control.`);
    startChessGame(color);
  }, [color, timeControl, startChessGame]);

  // Styles matching the original page
  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: 'var(--page-bg)', minHeight: '100vh', padding: '2rem', color: 'var(--text-color)' },
    container: { maxWidth: 1000, margin: '0 auto' },
    title: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: 'var(--sea-green)', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    form: { background: 'var(--content-bg)', borderRadius: 15, padding: '2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' },
    searchRow: { display: 'flex', gap: '1rem', marginBottom: '2rem' },
    input: { flex: 1, padding: '0.8rem', border: '2px solid var(--sea-green)', borderRadius: 8, fontFamily: 'Playfair Display, serif', background: 'var(--content-bg)', color: 'var(--text-color)' },
    label: { display: 'block', marginBottom: '0.5rem', color: 'var(--sea-green)', fontWeight: 'bold', fontFamily: 'Cinzel, serif' },
    select: { width: '100%', marginBottom: '1rem' },
    button: { background: 'var(--sea-green)', color: 'var(--content-bg)', border: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    playerInfo: { background: 'var(--page-bg)', padding: '1.5rem', borderRadius: 8, marginBottom: '2rem' },
    gameArea: { marginTop: '2rem' },
    boardWrapper: { maxWidth: 600, margin: '0 auto', border: '2px solid var(--sea-green)', borderRadius: 8, overflow: 'hidden' },
    backRow: { textAlign: 'right', marginTop: '2rem' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--sea-green)', color: 'var(--content-bg)', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={styles.title}><span role="img" aria-label="chess-pawn">♟️</span> Challenge a Player</h2>
          <div>
            <button onClick={toggleTheme} style={{ background: 'transparent', border: '2px solid var(--sea-green)', color: 'var(--sea-green)', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold' }}>{isDark ? 'Switch to Light' : 'Switch to Dark'}</button>
          </div>
        </div>

        <div style={styles.form}>
          <div style={styles.searchRow}>
            <input
              style={styles.input}
              type="text"
              placeholder="Enter player's Fullname"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" style={styles.button} onClick={searchPlayer}>
              <i className="fas fa-search" aria-hidden="true"></i> <span>Search</span>
            </button>
          </div>

          {foundPlayer && (
            <div style={styles.playerInfo}>
              <h3 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', margin: '1.5rem 0', fontSize: '1.8rem' }}>
                Challenging: {foundPlayer}
              </h3>

              <label style={styles.label}>Choose Color:</label>
              <select className="player-select" style={styles.select} value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="white">White</option>
                <option value="black">Black</option>
                <option value="random">Random</option>
              </select>

              <label style={styles.label}>Time Control:</label>
              <select className="player-select" style={styles.select} value={timeControl} onChange={(e) => setTimeControl(e.target.value)}>
                <option value="1+0">Bullet (1+0)</option>
                <option value="3+2">Blitz (3+2)</option>
                <option value="5+0">Blitz (5+0)</option>
                <option value="10+0">Rapid (10+0)</option>
              </select>

              <button type="button" style={styles.button} onClick={sendChallenge}>
                <i className="fas fa-chess-knight" aria-hidden="true"></i> <span>Send Challenge</span>
              </button>
            </div>
          )}

          {gameVisible && (
            <div style={styles.gameArea}>
              <h3 style={{ fontFamily: 'Cinzel, serif', color: '#2E8B57', margin: '1.5rem 0', fontSize: '1.8rem' }}>Live Chess Game</h3>
              <div style={styles.boardWrapper}>
                {/* chessboard.js will take over this container */}
                <div ref={boardContainerRef} id="chessBoard" />
              </div>
            </div>
          )}

          <div style={styles.backRow}>
            <Link to="/player/player_dashboard" style={styles.backLink}>
              <i className="fas fa-arrow-left" aria-hidden="true"></i> <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OneOnOne;
