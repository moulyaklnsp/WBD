import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import usePlayerTheme from '../../hooks/usePlayerTheme';

// React version of views/player/player_chat.ejs
// Loads Socket.IO client from backend at /socket.io/socket.io.js (works in dev via CRA proxy).

const SOCKET_IO_PATH = '/socket.io/socket.io.js';

function PlayerChat() {
  const navigate = useNavigate();
  const [isDark, toggleTheme] = usePlayerTheme();
  const [role, setRole] = useState('Player');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [chatMode, setChatMode] = useState('join'); // 'join', 'choice', 'global', 'private_search', 'private_chat'
  const [prefilledFromSession, setPrefilledFromSession] = useState(false);
  const [socketReady, setSocketReady] = useState(typeof window !== 'undefined' && !!window.io);

  const [receiver, setReceiver] = useState('All');
  const activeReceiverRef = useRef('All');
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [usernameSearch, setUsernameSearch] = useState('');
  const [contacts, setContacts] = useState([]); // whatsapp-style contacts list
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]); // {sender, text, type: 'sent'|'received'}
  // manualTarget removed in favor of usernameSearch + search results

  const socketRef = useRef(null);
  const chatBoxRef = useRef(null);

  // Load contacts (whatsapp-style list)
  const loadContacts = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/chat/contacts?username=${encodeURIComponent(username)}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.contacts)) setContacts(data.contacts);
    } catch (e) {
      // ignore
    }
  }, [username]);

  const joinChat = useCallback(() => {
    if (!username.trim()) {
      alert('Enter your name');
      return;
    }
    if (!socketRef.current) return;
    socketRef.current.emit('join', { username: username.trim(), role });
    setJoined(true);
    setChatMode('choice');
    // refresh contacts shortly after join
    setTimeout(loadContacts, 250);
  }, [username, role, loadContacts]);

  // Load Socket.IO client script dynamically
  useEffect(() => {
    if (window.io) {
      setSocketReady(true);
      return;
    }
    const script = document.createElement('script');
    script.src = SOCKET_IO_PATH;
    script.async = true;
    script.onload = () => setSocketReady(true);
    script.onerror = () => setSocketReady(false);
    document.body.appendChild(script);
    return () => {
      try { document.body.removeChild(script); } catch (_) {}
    };
  }, []);

  // Load session info to prefill username if logged in
  useEffect(() => {
    fetch('/api/session').then(r => r.json()).then(d => {
      if (d && d.username) {
        setUsername(d.username);
        setPrefilledFromSession(true);
      }
      if (d && d.userRole) setRole(d.userRole.charAt(0).toUpperCase() + d.userRole.slice(1));
    }).catch(() => {});
  }, []);

  // Restore receiver from localStorage so active chat survives reload
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat_receiver');
      if (saved) setReceiver(saved);
    } catch (_) {}
  }, []);

  // Establish socket connection and listeners
  useEffect(() => {
    if (!socketReady || !window.io) return;
    if (socketRef.current) return; // already connected
    const sock = window.io();
    socketRef.current = sock;

    sock.on('message', (payload) => {
      // payload: { sender, message, receiver }
      try {
        const { sender, message: text, receiver: to } = payload || {};
        const active = activeReceiverRef.current;
        let belongs = false;
        if (active === 'All') {
          belongs = to === 'All';
        } else {
          belongs = (sender === active && to === username) || (sender === username && to === active);
        }
        if (belongs) {
          setMessages((prev) => {
            const next = { sender, text, type: sender === username ? 'sent' : 'received', receiver: to };
            const last = prev[prev.length - 1];
            if (last && last.text === next.text && last.sender === next.sender && last.receiver === next.receiver) return prev;
            return [...prev, next];
          });
          if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
      } catch (_) {}
    });

    return () => {
      try {
        sock.off('message');
        sock.disconnect();
      } catch (_) {}
      socketRef.current = null;
    };
  }, [socketReady, username]);

  // Keep active receiver ref updated to avoid stale closure in socket handler
  useEffect(() => {
    activeReceiverRef.current = receiver;
  }, [receiver]);

  // Load chat history for selected room (global or private)
  useEffect(() => {
    async function loadHistory() {
      if (!joined) return;
      const room = receiver === 'All' ? 'global' : `pm:${[username, receiver].sort().join(':')}`;
      try {
        const res = await fetch(`/api/chat/history?room=${encodeURIComponent(room)}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.history)) {
          // history newest first; reverse to show oldest->newest
          const hist = data.history.slice().reverse().map(h => ({ sender: h.sender, text: h.message, type: h.sender === username ? 'sent' : 'received', receiver: h.receiver || (h.room==='global' ? 'All' : receiver) }));
          setMessages(hist);
          if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
      } catch (e) {
        // ignore
      }
    }
    loadHistory();
  }, [receiver, joined, username]);

  useEffect(() => {
    if (chatMode === 'private_search') {
      loadContacts();
    }
  }, [chatMode, loadContacts]);

  // Search registered users by role
  const searchRegisteredUsers = async () => {
    try {
      const roleParam = role ? role.toLowerCase() : '';
      const res = await fetch(`/api/users?role=${encodeURIComponent(roleParam)}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.users)) {
        let list = data.users;
        if (usernameSearch && usernameSearch.trim()) {
          const q = usernameSearch.trim().toLowerCase();
          list = list.filter(u => (u.username || '').toLowerCase().includes(q));
        }
        setRegisteredUsers(list);
      }
    } catch (e) {
      // ignore
    }
  };

  const openChatWith = (target) => {
    const t = (target || '').trim();
    if (!t) return;
    if (t === username) {
      alert('You cannot chat with yourself');
      return;
    }
    if (!joined) joinChat();
    setReceiver(t);
  };

  // Persist selected receiver to localStorage so reload keeps the chat open
  useEffect(() => {
    try {
      if (receiver) localStorage.setItem('chat_receiver', receiver);
    } catch (_) {}
  }, [receiver]);

  // Auto-join when session prefilled and socket available
  useEffect(() => {
    if (prefilledFromSession && username && !joined && socketReady) {
      // small delay to allow socket to initialize
      const t = setTimeout(() => { if (!joined) { joinChat(); } }, 250);
      return () => clearTimeout(t);
    }
  }, [prefilledFromSession, username, joined, socketReady, joinChat]);

  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;
    if (!socketRef.current) return;
    // emit
    socketRef.current.emit('chatMessage', { sender: username.trim(), receiver, message: text });
    setMessage('');
    // scroll to bottom
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
    // refresh contacts after sending
    setTimeout(loadContacts, 250);
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: 'var(--page-bg)', minHeight: '100vh', padding: '1rem' },
    container: { maxWidth: 1000, margin: '0 auto' },
    card: { background: 'var(--content-bg)', borderRadius: 16, padding: '1rem', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', marginBottom: '1rem' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: 'var(--sea-green)', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    label: { display: 'block', marginBottom: '0.5rem', color: 'var(--sea-green)', fontWeight: 'bold' },
    input: { width: '100%', padding: '0.75rem 0.9rem', marginBottom: '0.75rem', border: '2px solid var(--sea-green)', borderRadius: 10, fontFamily: 'Playfair Display, serif', background: 'var(--content-bg)', color: 'var(--text-color)' },
    select: { width: '100%', marginBottom: '0.75rem' },
    chatBox: { height: 400, border: '2px solid var(--border-color)', borderRadius: 12, padding: '1rem', margin: '0.5rem 0 0.75rem 0', overflowY: 'auto', background: 'var(--content-bg)', scrollBehavior: 'smooth', overscrollBehavior: 'contain' },
    msg: { margin: '0.4rem 0', padding: '0.9rem 1rem', borderRadius: 12, maxWidth: '78%', transition: 'transform 120ms ease, background 120ms ease' },
    sent: { background: 'var(--sea-green)', color: 'var(--on-accent)', marginLeft: 'auto' },
    received: { background: 'var(--sky-blue)', color: 'var(--sea-green)' },
    chatInputRow: { display: 'flex', gap: '0.6rem', marginTop: '0.75rem' },
    button: { background: 'var(--sea-green)', color: 'var(--on-accent)', border: 'none', padding: '0.7rem 1.2rem', borderRadius: 10, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    choiceRow: { display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap' },
    choiceButton: { background: 'var(--sea-green)', color: 'var(--on-accent)', border: 'none', padding: '1.25rem 1.6rem', borderRadius: 16, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.9rem', minWidth: 320 },
    choiceEmblemShell: { width: 172, height: 172, borderRadius: 26, border: '1px solid var(--border-color)', background: 'var(--content-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    choiceLabel: { fontSize: 18, letterSpacing: '0.03em' },
    backRow: { textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--sea-green)', color: 'var(--on-accent)', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
    searchResult: { padding: '0.8rem', margin: '0.5rem 0', borderRadius: 10, background: 'var(--content-bg)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'transform 0.3s ease, box-shadow 0.3s ease, opacity 0.5s ease', opacity: 1 },
    searchResultHover: { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  };

  const GlobeNetworkEmblem = () => (
    <svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true" focusable="false">
      {/* Orbit ring */}
      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--sky-blue)" strokeWidth="2" opacity="0.55" />

      {/* Orbit connections */}
      <path d="M50 10 L90 50 L50 90 L10 50 Z" fill="none" stroke="var(--sky-blue)" strokeWidth="1.6" opacity="0.35" strokeLinejoin="round" />

      {/* Nodes */}
      <circle cx="50" cy="10" r="3" fill="var(--sky-blue)" opacity="0.95" />
      <circle cx="90" cy="50" r="3" fill="var(--sky-blue)" opacity="0.95" />
      <circle cx="50" cy="90" r="3" fill="var(--sky-blue)" opacity="0.95" />
      <circle cx="10" cy="50" r="3" fill="var(--sky-blue)" opacity="0.95" />

      {/* Globe outline */}
      <circle cx="50" cy="50" r="28" fill="none" stroke="var(--sea-green)" strokeWidth="4" opacity="0.95" />

      {/* Meridians (vertical arcs) */}
      <path d="M50 22 C44 30 44 70 50 78" fill="none" stroke="var(--sea-green)" strokeWidth="2" opacity="0.65" strokeLinecap="round" />
      <path d="M50 22 C56 30 56 70 50 78" fill="none" stroke="var(--sea-green)" strokeWidth="2" opacity="0.65" strokeLinecap="round" />

      {/* Parallels (horizontal arcs) */}
      <path d="M27 42 C38 48 62 48 73 42" fill="none" stroke="var(--sea-green)" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
      <path d="M25 50 C36 56 64 56 75 50" fill="none" stroke="var(--sea-green)" strokeWidth="2" opacity="0.7" strokeLinecap="round" />
      <path d="M27 58 C38 52 62 52 73 58" fill="none" stroke="var(--sea-green)" strokeWidth="2" opacity="0.6" strokeLinecap="round" />

      {/* Subtle inner ring for depth */}
      <circle cx="50" cy="50" r="22" fill="none" stroke="var(--sea-green)" strokeWidth="1.5" opacity="0.25" />
    </svg>
  );

  const PeopleNetworkEmblem = () => (
    <svg viewBox="0 0 100 100" width="128" height="128" aria-hidden="true" focusable="false">
      <circle cx="35" cy="40" r="9" fill="none" stroke="var(--sea-green)" strokeWidth="3" />
      <path d="M20 67 C24 56 46 56 50 67" fill="none" stroke="var(--sea-green)" strokeWidth="3" strokeLinecap="round" />

      <circle cx="65" cy="40" r="9" fill="none" stroke="var(--sea-green)" strokeWidth="3" opacity="0.9" />
      <path d="M50 67 C54 56 76 56 80 67" fill="none" stroke="var(--sea-green)" strokeWidth="3" strokeLinecap="round" opacity="0.9" />

      <path d="M44 48 C50 52 50 52 56 48" fill="none" stroke="var(--sky-blue)" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />

      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--sky-blue)" strokeWidth="2" opacity="0.65" />
      <circle cx="50" cy="10" r="3" fill="var(--sky-blue)" />
      <circle cx="90" cy="50" r="3" fill="var(--sky-blue)" />
      <circle cx="50" cy="90" r="3" fill="var(--sky-blue)" />
      <circle cx="10" cy="50" r="3" fill="var(--sky-blue)" />
    </svg>
  );

  const ChoiceEmblem = ({ kind }) => (
    <span style={styles.choiceEmblemShell} aria-hidden="true">
      <motion.span
        animate={{ rotateY: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'inline-flex', perspective: '1000px', filter: 'drop-shadow(0 0 18px rgba(0,0,0,0.15))' }}
      >
        {kind === 'global' ? <GlobeNetworkEmblem /> : <PeopleNetworkEmblem />}
      </motion.span>
    </span>
  );

  return (
    <div style={styles.root}>
      {!joined ? (
        // Join form
        <div style={styles.container}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button type="button" style={styles.button} onClick={() => navigate('/player/player_dashboard')}>
              Back to Dashboard
            </button>
          </div>
          <div style={styles.card}>
            <h2 style={styles.h2}>Join Chat</h2>
            <label style={styles.label}>Your Name:</label>
            <input
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name..."
            />
            <button style={styles.button} onClick={joinChat}>Join Chat</button>
          </div>
        </div>
      ) : chatMode === 'choice' ? (
        // Choice screen
        <div style={styles.container}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button type="button" style={styles.button} onClick={() => navigate('/player/player_dashboard')}>
              Back to Dashboard
            </button>
          </div>
          <div style={styles.card}>
            <h2 style={styles.h2}>Choose Chat Type</h2>
            <div style={styles.choiceRow}>
              <button
                type="button"
                style={styles.choiceButton}
                onClick={() => { setReceiver('All'); setChatMode('global'); }}
              >
                <ChoiceEmblem kind="global" />
                <div style={styles.choiceLabel}>Global Chat</div>
              </button>
              <button
                type="button"
                style={styles.choiceButton}
                onClick={() => setChatMode('private_search')}
              >
                <ChoiceEmblem kind="private" />
                <div style={styles.choiceLabel}>One-to-One Chat</div>
              </button>
            </div>
          </div>
        </div>
      ) : chatMode === 'global' ? (
        // Global chat: only chat pane
        <div style={{ ...styles.root, padding: 0, height: '100vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--content-bg)', borderRadius: 14, padding: '1rem', boxShadow: '0 6px 16px rgba(0,0,0,0.1)', color: 'var(--text-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate('/player/player_dashboard')} style={styles.button}>Back to Dashboard</button>
                <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}>Global Chat</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button style={styles.button} onClick={() => setChatMode('choice')}>Change Mode</button>
                <div style={{ color: 'var(--text-color)', fontSize: 14 }}>Connected</div>
              </div>
            </div>
            <div id="chatBox" style={{ ...styles.chatBox, flex: 1, height: 'auto', overflowY: 'auto' }} ref={chatBoxRef}>
              {messages.map((m, idx) => (
                <div key={idx} style={{ ...styles.msg, ...(m.type === 'sent' ? styles.sent : styles.received) }}>
                  <p style={{ margin: 0 }}><strong>{m.type === 'sent' ? 'You' : m.sender}:</strong> {m.text}</p>
                </div>
              ))}
            </div>
            <div style={styles.chatInputRow}>
              <input
                id="chatMessage"
                style={{ ...styles.input, marginBottom: 0 }}
                type="text"
                placeholder="Type a message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
              />
              <button type="button" style={styles.button} onClick={sendMessage}>
                <i className="fas fa-paper-plane" aria-hidden="true"></i> <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      ) : chatMode === 'private_search' ? (
        // Private chats list: show contacts
        <div style={styles.root}>
          <div style={styles.container}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
              <button type="button" style={styles.button} onClick={() => navigate('/player/player_dashboard')}>
                Back to Dashboard
              </button>
            </div>
            <div style={styles.card}>
              <h2 style={styles.h2}>Your Chats</h2>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <select style={{ ...styles.select, flex: 1 }} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option>Coordinator</option>
                  <option>Player</option>
                </select>
                <input
                  placeholder="Search chats or users"
                  value={usernameSearch}
                  onChange={(e) => setUsernameSearch(e.target.value)}
                  style={{ ...styles.input, flex: 2 }}
                />
                <button style={styles.button} onClick={searchRegisteredUsers}>Search</button>
                <button style={styles.button} onClick={loadContacts}>Refresh</button>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {contacts.length === 0 && registeredUsers.length === 0 && <div style={{ color: 'var(--text-color)', textAlign: 'center', padding: '2rem' }}>No chats yet. Search for users to start chatting.</div>}
                {contacts.map((c, idx) => (
                  <div
                    key={c.contact}
                    style={{ ...styles.searchResult, animationDelay: `${idx * 0.1}s` }}
                    onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    onClick={() => { setReceiver(c.contact); setChatMode('private_chat'); }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--sea-green)', fontSize: '1.1rem' }}>{c.contact}</div>
                    <div style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>{c.lastMessage || 'Start a conversation'}</div>
                    <div style={{ color: 'var(--text-color)', fontSize: '0.8rem' }}>{c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : ''}</div>
                  </div>
                ))}
                {registeredUsers.map((u, idx) => (
                  <div
                    key={u.username}
                    style={{ ...styles.searchResult, animationDelay: `${(contacts.length + idx) * 0.1}s` }}
                    onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    onClick={() => { setReceiver(u.username); setChatMode('private_chat'); }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--sea-green)', fontSize: '1.1rem' }}>{u.username}</div>
                    <div style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>Role: {u.role}</div>
                  </div>
                ))}
              </div>
              <button style={{ ...styles.button, marginTop: '1rem' }} onClick={() => setChatMode('choice')}>Back to Choice</button>
            </div>
          </div>
        </div>
      ) : chatMode === 'private_chat' ? (
        // Private chat: chat window
        <div style={{ ...styles.root, padding: 0, height: '100vh' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--content-bg)', borderRadius: 14, padding: '1rem', boxShadow: '0 6px 16px rgba(0,0,0,0.1)', color: 'var(--text-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => navigate('/player/player_dashboard')} style={styles.button}>Back to Dashboard</button>
                <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}>Chat with {receiver}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button style={styles.button} onClick={() => setChatMode('private_search')}>Back to Chats</button>
                <button style={styles.button} onClick={() => setChatMode('choice')}>Change Mode</button>
                <div style={{ color: 'var(--text-color)', fontSize: 14 }}>Connected</div>
              </div>
            </div>
            <div id="chatBox" style={{ ...styles.chatBox, flex: 1, height: 'auto', overflowY: 'auto' }} ref={chatBoxRef}>
              {messages.map((m, idx) => (
                <div key={idx} style={{ ...styles.msg, ...(m.type === 'sent' ? styles.sent : styles.received) }}>
                  <p style={{ margin: 0 }}><strong>{m.type === 'sent' ? 'You' : m.sender}:</strong> {m.text}</p>
                </div>
              ))}
            </div>
            <div style={styles.chatInputRow}>
              <input
                id="chatMessage"
                style={{ ...styles.input, marginBottom: 0 }}
                type="text"
                placeholder="Type a message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
              />
              <button type="button" style={styles.button} onClick={sendMessage}>
                <i className="fas fa-paper-plane" aria-hidden="true"></i> <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PlayerChat;
