import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';
import { GlobalLoader } from '../../components/ChessTransformation';

// Chess piece Unicode symbols
const PIECE_SYMBOLS = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// Piece style map — keys match PlayerSettings piece style names
const PIECE_STYLE_MAP = {
  Classic:    { white: { color: '#fff',    textShadow: '0 0 3px #000, 0 0 5px #000' },           black: { color: '#1a1a1a', textShadow: '0 0 2px #fff' } },
  Modern:     { white: { color: '#e8e8e8', textShadow: '0 2px 6px rgba(0,0,0,0.9)' },            black: { color: '#2c2c2c', textShadow: '0 2px 6px rgba(255,255,255,0.5)' } },
  Minimalist: { white: { color: '#f5f5f5', textShadow: 'none' },                                  black: { color: '#1a1a1a', textShadow: 'none' } },
  Pixel:      { white: { color: '#4fc3f7', textShadow: '0 0 8px #4fc3f7, 0 0 4px #4fc3f7' },     black: { color: '#ef5350', textShadow: '0 0 8px #ef5350, 0 0 4px #ef5350' } },
  Wooden:     { white: { color: '#f5deb3', textShadow: '0 1px 3px rgba(0,0,0,0.6)' },            black: { color: '#4a2800', textShadow: '0 1px 3px rgba(255,200,100,0.4)' } },
};

function getPieceStyle(piece) {
  const key = localStorage.getItem('player_piece_style') || 'Classic';
  const cfg = PIECE_STYLE_MAP[key] || PIECE_STYLE_MAP.Classic;
  return piece === piece.toUpperCase() ? cfg.white : cfg.black;
}

// Parse FEN string to get board position
function parseFen(fen) {
  if (!fen) return null;
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const board = [];
  
  for (let row of rows) {
    const boardRow = [];
    for (let char of row) {
      if (/\d/.test(char)) {
        for (let i = 0; i < parseInt(char); i++) {
          boardRow.push(null);
        }
      } else {
        boardRow.push(char);
      }
    }
    board.push(boardRow);
  }
  return board;
}

// Chess Board Component
function ChessBoard({ fen, lastMove, whiteName, blackName, whiteRating, blackRating, whiteClock, blackClock }) {
  const board = parseFen(fen);
  
  if (!board) {
    return (
      <div style={{ 
        width: '100%', 
        maxWidth: 500, 
        aspectRatio: '1', 
        background: 'rgba(0,0,0,0.3)', 
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted-text)'
      }}>
        <i className="fas fa-chess-board" style={{ fontSize: '3rem', marginRight: '1rem' }} />
        Waiting for game data...
      </div>
    );
  }

  const lastMoveSquares = [];
  if (lastMove && lastMove.length >= 4) {
    const fromCol = lastMove.charCodeAt(0) - 97;
    const fromRow = 8 - parseInt(lastMove[1]);
    const toCol = lastMove.charCodeAt(2) - 97;
    const toRow = 8 - parseInt(lastMove[3]);
    lastMoveSquares.push(`${fromRow}-${fromCol}`, `${toRow}-${toCol}`);
  }

  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      {/* Black player info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: 8
      }}>
        <div>
          <span style={{ fontWeight: 700 }}>{blackName || 'Black'}</span>
          {blackRating && <span style={{ opacity: 0.7, marginLeft: '0.5rem' }}>({blackRating})</span>}
        </div>
        {blackClock && (
          <div style={{ 
            fontFamily: 'monospace', 
            fontSize: '1.1rem',
            padding: '0.25rem 0.5rem',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 4
          }}>
            {blackClock}
          </div>
        )}
      </div>

      {/* Chess board */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(8, 1fr)', 
        width: '100%', 
        aspectRatio: '1',
        border: '3px solid var(--card-border)',
        borderRadius: 8,
        overflow: 'hidden'
      }}>
        {board.map((row, rowIdx) => 
          row.map((piece, colIdx) => {
            const isLight = (rowIdx + colIdx) % 2 === 0;
            const isHighlighted = lastMoveSquares.includes(`${rowIdx}-${colIdx}`);
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                style={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                  background: isHighlighted
                    ? (isLight ? '#f7ec7d' : '#d9c84a')
                    : (isLight ? '#f0d9b5' : '#b58863'),
                  ...(piece ? getPieceStyle(piece) : {})
                }}
              >
                {piece ? PIECE_SYMBOLS[piece] : ''}
              </div>
            );
          })
        )}
      </div>

      {/* White player info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginTop: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 8
      }}>
        <div>
          <span style={{ fontWeight: 700 }}>{whiteName || 'White'}</span>
          {whiteRating && <span style={{ opacity: 0.7, marginLeft: '0.5rem' }}>({whiteRating})</span>}
        </div>
        {whiteClock && (
          <div style={{ 
            fontFamily: 'monospace', 
            fontSize: '1.1rem',
            padding: '0.25rem 0.5rem',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 4
          }}>
            {whiteClock}
          </div>
        )}
      </div>
    </div>
  );
}

// Format clock time
function formatClock(seconds) {
  if (!seconds && seconds !== 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getProviderConfig(provider) {
  const p = (provider || '').toString().toLowerCase();
  if (p === 'lichess') {
    return {
      id: 'lichess',
      title: 'Lichess TV',
      description: 'Live chess games from Lichess - streamed directly to ChessHive!',
      logo: 'https://lichess.org/favicon.ico'
    };
  }
  if (p === 'chesscom' || p === 'chess.com' || p === 'chess') {
    return {
      id: 'chesscom',
      title: 'Chess.com TV',
      description: 'Featured games from Chess.com - displayed within ChessHive!',
      logo: 'https://www.chess.com/favicon.ico'
    };
  }
  return null;
}

// Lichess TV Component - Uses Lichess streaming API (NDJSON format)
function LichessTvViewer() {
  const [gameData, setGameData] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [channel, setChannel] = useState('Top Rated');
  const abortControllerRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  const channels = [
    { id: 'top', name: 'Top Rated', path: '' },
    { id: 'bullet', name: 'Bullet', path: '/bullet' },
    { id: 'blitz', name: 'Blitz', path: '/blitz' },
    { id: 'rapid', name: 'Rapid', path: '/rapid' },
    { id: 'classical', name: 'Classical', path: '/classical' },
    { id: 'ultrabullet', name: 'UltraBullet', path: '/ultraBullet' }
  ];

  const selectedChannel = channels.find(c => c.name === channel) || channels[0];

  const connectToStream = useCallback(async () => {
    // Cleanup previous connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    setStatus('connecting');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Use Lichess TV API - streams game updates as NDJSON
    const url = `https://lichess.org/api/tv${selectedChannel.path}/feed`;
    
    try {
      const response = await fetch(url, {
        signal: abortController.signal,
        headers: {
          'Accept': 'application/x-ndjson'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setStatus('connected');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines (NDJSON format - each line is a JSON object)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            
            if (data.t === 'featured') {
              // New game featured
              setGameData({
                fen: data.d.fen,
                lastMove: data.d.lm,
                whiteName: data.d.players?.[0]?.user?.name || 'White',
                whiteRating: data.d.players?.[0]?.rating,
                blackName: data.d.players?.[1]?.user?.name || 'Black',
                blackRating: data.d.players?.[1]?.rating,
                whiteClock: formatClock(data.d.wc),
                blackClock: formatClock(data.d.bc),
                orientation: data.d.orientation || 'white'
              });
              setStatus('live');
            } else if (data.t === 'fen') {
              // Position update
              setGameData(prev => ({
                ...prev,
                fen: data.d.fen,
                lastMove: data.d.lm,
                whiteClock: formatClock(data.d.wc),
                blackClock: formatClock(data.d.bc)
              }));
              setStatus('live');
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Connection was intentionally aborted
        return;
      }
      console.error('Stream error:', err);
      setStatus('error');
      // Retry after 5 seconds
      retryTimeoutRef.current = setTimeout(connectToStream, 5000);
    }
  }, [selectedChannel.path]);

  useEffect(() => {
    connectToStream();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [connectToStream]);

  const openInPopup = () => {
    const width = 800;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(
      'https://lichess.org/tv',
      'LichessTV',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );
  };

  return (
    <div>
      {/* Channel selector */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {channels.map(ch => (
          <button
            key={ch.id}
            onClick={() => setChannel(ch.name)}
            className={channel === ch.name ? 'btn' : 'btn ghost'}
            style={{ fontSize: '0.9rem', padding: '0.4rem 0.75rem' }}
          >
            {ch.name}
          </button>
        ))}
      </div>

      {/* Status indicator */}
      <div style={{ 
        marginBottom: '1rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem' 
      }}>
        <span style={{ 
          width: 10, 
          height: 10, 
          borderRadius: '50%', 
          background: status === 'live' ? '#4caf50' : status === 'error' ? '#f44336' : '#ff9800',
          animation: status === 'live' ? 'pulse 2s infinite' : 'none'
        }} />
        <span style={{ opacity: 0.8 }}>
          {status === 'live' && 'Live'}
          {status === 'connecting' && 'Connecting to Lichess...'}
          {status === 'connected' && 'Connected, waiting for game...'}
          {status === 'error' && 'Connection lost, retrying...'}
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Game board */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ChessBoard
          fen={gameData?.fen}
          lastMove={gameData?.lastMove}
          whiteName={gameData?.whiteName}
          blackName={gameData?.blackName}
          whiteRating={gameData?.whiteRating}
          blackRating={gameData?.blackRating}
          whiteClock={gameData?.whiteClock}
          blackClock={gameData?.blackClock}
        />
        
        <div style={{ flex: '1', minWidth: 250 }}>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.5rem' }}>
              <i className="fas fa-info-circle" /> About Lichess TV
            </div>
            <div style={{ opacity: 0.85, lineHeight: 1.6 }}>
              Watch top-rated games live from Lichess. The stream automatically switches to the most interesting game in progress.
            </div>
          </div>
          
          <button className="btn ghost" onClick={openInPopup} style={{ width: '100%' }}>
            <i className="fas fa-external-link-alt" /> Open in Popup Window
          </button>
        </div>
      </div>
    </div>
  );
}

// Chess.com TV Component - Opens Chess.com Watch in popup since they block embedding
function ChessComTvViewer() {
  const [streamers, setStreamers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popupOpened, setPopupOpened] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('watch');

  const categories = [
    { id: 'watch', name: 'Top Games', icon: 'fas fa-crown', url: 'https://www.chess.com/play/online/watch' },
    { id: 'tv', name: 'Chess.com TV', icon: 'fas fa-tv', url: 'https://www.chess.com/tv' },
    { id: 'events', name: 'Events', icon: 'fas fa-trophy', url: 'https://www.chess.com/events' },
    { id: 'streamers', name: 'Streamers', icon: 'fas fa-video', url: 'https://www.chess.com/streamers' }
  ];

  const selectedCat = categories.find(c => c.id === selectedCategory) || categories[0];

  const fetchStreamers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('https://api.chess.com/pub/streamers');
      if (res.ok) {
        const data = await res.json();
        const live = (data.streamers || []).filter(s => s.is_live).slice(0, 10);
        setStreamers(live);
      }
    } catch (e) {
      console.log('Could not fetch streamers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStreamers();
    const interval = setInterval(fetchStreamers, 60000);
    return () => clearInterval(interval);
  }, [fetchStreamers]);

  const openInPopup = (url, name = 'ChessComWatch') => {
    const width = 1100;
    const height = 750;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(
      url,
      name,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes,menubar=no,toolbar=no`
    );
    setPopupOpened(true);
  };

  const openStreamer = (streamer) => {
    const url = streamer.twitch_url || `https://www.chess.com/member/${streamer.username}`;
    openInPopup(url, 'ChessStreamer');
  };

  return (
    <div>
      {/* Category selector */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={selectedCategory === cat.id ? 'btn' : 'btn ghost'}
            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
          >
            <i className={cat.icon} style={{ marginRight: '0.4rem' }} />
            {cat.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Main content area */}
        <div style={{ flex: '2', minWidth: 320 }}>
          <div className="card">
            {/* Header with launch button */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1.5rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.3rem', fontWeight: 800 }}>
                  <i className={selectedCat.icon} style={{ marginRight: '0.5rem' }} />
                  {selectedCat.name}
                </div>
                <div style={{ opacity: 0.75, marginTop: '0.25rem' }}>
                  {selectedCategory === 'watch' && 'Watch top-rated live games from Chess.com'}
                  {selectedCategory === 'tv' && 'Featured games and commentary'}
                  {selectedCategory === 'events' && 'Major chess tournaments and events'}
                  {selectedCategory === 'streamers' && 'Watch chess content creators'}
                </div>
              </div>
              <button 
                className="btn" 
                onClick={() => openInPopup(selectedCat.url)}
                style={{ fontSize: '1rem', padding: '0.75rem 1.25rem' }}
              >
                <i className="fas fa-play" /> Open {selectedCat.name}
              </button>
            </div>

            {/* Visual preview area */}
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(129,182,76,0.15) 0%, rgba(30,30,30,0.3) 100%)',
              borderRadius: 12,
              padding: '2rem',
              textAlign: 'center',
              border: '2px dashed var(--card-border)',
              marginBottom: '1.5rem'
            }}>
              {popupOpened ? (
                <>
                  <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: '#4caf50', marginBottom: '1rem' }} />
                  <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                    Chess.com Opened in Popup
                  </div>
                  <div style={{ opacity: 0.75, marginBottom: '1rem' }}>
                    Look for the popup window to watch live games
                  </div>
                  <button className="btn ghost" onClick={() => openInPopup(selectedCat.url)}>
                    <i className="fas fa-redo" /> Open Again
                  </button>
                </>
              ) : (
                <>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '0.5rem',
                    fontSize: '3rem',
                    marginBottom: '1rem'
                  }}>
                    <span>♔</span><span>♕</span><span>♖</span><span>♗</span><span>♘</span>
                  </div>
                  <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                    Watch Top Rated Games
                  </div>
                  <div style={{ opacity: 0.75, marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    Chess.com doesn't allow embedding, but you can watch their content<br />
                    in a convenient popup window right from ChessHive!
                  </div>
                  <button 
                    className="btn" 
                    onClick={() => openInPopup(selectedCat.url)}
                    style={{ fontSize: '1.1rem', padding: '0.85rem 1.5rem' }}
                  >
                    <i className="fas fa-external-link-alt" /> Launch Chess.com Watch
                  </button>
                </>
              )}
            </div>

            {/* Quick links */}
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.75rem' }}>
              <i className="fas fa-bolt" /> Quick Links
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <button 
                className="btn ghost" 
                onClick={() => openInPopup('https://www.chess.com/play/online/watch')}
                style={{ justifyContent: 'flex-start' }}
              >
                <i className="fas fa-crown" /> Top Rated Games
              </button>
              <button 
                className="btn ghost" 
                onClick={() => openInPopup('https://www.chess.com/tv')}
                style={{ justifyContent: 'flex-start' }}
              >
                <i className="fas fa-tv" /> Chess.com TV
              </button>
              <button 
                className="btn ghost" 
                onClick={() => openInPopup('https://www.chess.com/events')}
                style={{ justifyContent: 'flex-start' }}
              >
                <i className="fas fa-trophy" /> Live Events
              </button>
              <button 
                className="btn ghost" 
                onClick={() => openInPopup('https://www.twitch.tv/chess')}
                style={{ justifyContent: 'flex-start' }}
              >
                <i className="fab fa-twitch" /> Twitch Channel
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar with live streamers */}
        <div style={{ flex: '1', minWidth: 280 }}>
          <div className="card">
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.75rem' }}>
              <i className="fas fa-broadcast-tower" /> Live Streamers
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <GlobalLoader style={{ padding: '0.5rem' }} />
              </div>
            ) : streamers.length === 0 ? (
              <div style={{ opacity: 0.7, padding: '1rem 0' }}>
                No streamers currently live
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {streamers.map((streamer, idx) => (
                  <div
                    key={streamer.username || idx}
                    onClick={() => openStreamer(streamer)}
                    style={{
                      padding: '0.75rem',
                      background: 'rgba(0,0,0,0.15)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(129,182,76,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.15)'}
                  >
                    {streamer.avatar ? (
                      <img 
                        src={streamer.avatar} 
                        alt="" 
                        style={{ width: 36, height: 36, borderRadius: '50%' }} 
                      />
                    ) : (
                      <div style={{ 
                        width: 36, 
                        height: 36, 
                        borderRadius: '50%', 
                        background: 'var(--sea-green)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700
                      }}>
                        {(streamer.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {streamer.username}
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        <span style={{ 
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#f44336',
                          marginRight: '0.4rem',
                          animation: 'pulse 2s infinite'
                        }} />
                        LIVE
                        {streamer.twitch_url && <span> on Twitch</span>}
                      </div>
                    </div>
                    <i className="fas fa-external-link-alt" style={{ opacity: 0.5 }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', marginBottom: '0.5rem' }}>
              <i className="fas fa-info-circle" /> About Chess.com Watch
            </div>
            <div style={{ opacity: 0.8, fontSize: '0.9rem', lineHeight: 1.6 }}>
              Watch top-rated games live on Chess.com! The popup window gives you access to:
              <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
                <li>Live games sorted by rating</li>
                <li>Titled player matches</li>
                <li>Commentary & analysis</li>
                <li>Major tournament coverage</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default function PlayerTv() {
  const { provider } = useParams();
  usePlayerTheme();
  const cfg = useMemo(() => getProviderConfig(provider), [provider]);

  if (!cfg) {
    return (
      <div>
        <style>{`
          .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        `}</style>
        <div className="page">
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 15, padding: '1.25rem' }}>
              <div style={{ fontFamily: 'Cinzel, serif', color: 'var(--sea-green)', fontSize: '1.1rem', fontWeight: 800 }}>Unknown TV Provider</div>
              <div style={{ marginTop: '0.75rem' }}>
                <Link to="/player/watch" style={{ textDecoration: 'none', color: 'var(--sky-blue)' }}>Back to Watch</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        .page{ font-family:'Playfair Display', serif; background-color:var(--page-bg); color:var(--text-color); min-height:100vh; padding:2rem; }
        .tv-wrap{ max-width:1200px; margin:0 auto; }
        .tv-header{ display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; }
        .tv-title{ font-family:'Cinzel', serif; color:var(--sea-green); margin:0; display:flex; align-items:center; gap:0.75rem; }
        .btn{ background:var(--sea-green); color:var(--on-accent); border:none; padding:0.6rem 1rem; border-radius:8px; cursor:pointer; font-family:'Cinzel', serif; font-weight:bold; text-decoration:none; display:inline-flex; gap:0.5rem; align-items:center; transition: all 0.2s; }
        .btn:hover{ filter: brightness(1.1); transform: translateY(-1px); }
        .btn.secondary{ background:var(--sky-blue); color:var(--on-accent); }
        .btn.ghost{ background:transparent; color:var(--sea-green); border:1px solid var(--card-border); }
        .btn.ghost:hover{ background: rgba(var(--sea-green-rgb), 0.1); }
        .card{ background:var(--card-bg); border:1px solid var(--card-border); border-radius:15px; padding:1.25rem; }
        .muted{ opacity:0.85; }
        .logo{ width:40px; height:40px; border-radius:12px; background: rgba(255,255,255,0.05); border:1px solid var(--card-border); display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .logo img{ width:24px; height:24px; object-fit:contain; }
      `}</style>

      <div className="page">
      <div className="tv-wrap">
        <div className="tv-header">
          <h1 className="tv-title">
            <span className="logo" aria-hidden="true">{cfg.logo ? <img src={cfg.logo} alt="" /> : null}</span>
            <span>{cfg.title}</span>
          </h1>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link className="btn secondary" to="/player/watch"><i className="fas fa-arrow-left" /> Back</Link>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="muted" style={{ marginBottom: '1rem' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '0.5rem' }} />
            {cfg.description}
          </div>
        </div>

        {cfg.id === 'lichess' && <LichessTvViewer />}
        {cfg.id === 'chesscom' && <ChessComTvViewer />}
      </div>
      </div>
    </div>
  );
}
