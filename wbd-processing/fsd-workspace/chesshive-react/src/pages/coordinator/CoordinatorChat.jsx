import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

// React version of views/coordinator/coordinator_chat.ejs
// Loads Socket.IO client from backend at /socket.io/socket.io.js (works in dev via CRA proxy).

const SOCKET_IO_PATH = '/socket.io/socket.io.js';

function CoordinatorChat() {
  const [role, setRole] = useState('Coordinator');
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [prefilledFromSession, setPrefilledFromSession] = useState(false);

  const [receiver, setReceiver] = useState('All');
  const activeReceiverRef = useRef('All');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]); // {sender, text, type}
  const [contacts, setContacts] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [usernameSearch, setUsernameSearch] = useState('');
  // manualTarget removed; use usernameSearch + results

  const socketRef = useRef(null);
  const chatBoxRef = useRef(null);

  // Load Socket.IO client script dynamically
  useEffect(() => {
    if (window.io) return; // already loaded
    const script = document.createElement('script');
    script.src = SOCKET_IO_PATH;
    script.async = true;
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
    if (!window.io) {
      const t = setTimeout(() => {}, 200);
      return () => clearTimeout(t);
    }
    if (socketRef.current) return; // already connected
    const sock = window.io();
    socketRef.current = sock;

    sock.on('message', (payload) => {
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
  }, [username]);

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

  const loadContacts = useCallback(async () => {
    if (!username) return;
    try {
      const res = await fetch(`/api/chat/contacts?username=${encodeURIComponent(username)}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.contacts)) setContacts(data.contacts);
    } catch (e) {}
  }, [username]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

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
        list = list.filter(u => ['coordinator','player'].includes((u.role || '').toLowerCase()));
        setRegisteredUsers(list);
      }
    } catch (e) {}
  };

  const joinChat = useCallback(() => {
    if (!username.trim()) {
      alert('Enter your name');
      return;
    }
    if (!socketRef.current) return;
    socketRef.current.emit('join', { username: username.trim(), role });
    setJoined(true);
    setTimeout(loadContacts, 250);
  }, [username, role, loadContacts]);

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
    if (prefilledFromSession && username && !joined) {
      const t = setTimeout(() => { if (!joined) joinChat(); }, 250);
      return () => clearTimeout(t);
    }
  }, [prefilledFromSession, username, joined, joinChat]);

  const sendMessage = () => {
    const text = message.trim();
    if (!text) return;
    if (!socketRef.current) return;
    socketRef.current.emit('chatMessage', { sender: username.trim(), receiver, message: text });
    setMessage('');
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
    setTimeout(loadContacts, 250);
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: '#FFFDD0', minHeight: '100vh', padding: '2rem' },
    container: { maxWidth: 800, margin: '0 auto' },
    card: { background: '#fff', borderRadius: 15, padding: '2rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', marginBottom: '2rem' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2rem', color: '#2E8B57', marginBottom: '1.5rem', textAlign: 'center' },
    label: { display: 'block', marginBottom: '0.5rem', color: '#2E8B57', fontWeight: 'bold' },
    input: { width: '100%', padding: '0.8rem', marginBottom: '1rem', border: '2px solid #2E8B57', borderRadius: 8, fontFamily: 'Playfair Display, serif' },
    select: { width: '100%', padding: '0.8rem', marginBottom: '1rem', border: '2px solid #2E8B57', borderRadius: 8, fontFamily: 'Playfair Display, serif' },
    chatBox: { height: 400, border: '2px solid #2E8B57', borderRadius: 8, padding: '1rem', margin: '1rem 0', overflowY: 'auto', background: '#FFFDD0' },
    msg: { marginBottom: '1rem', padding: '0.8rem', borderRadius: 8, maxWidth: '80%' },
    sent: { background: '#2E8B57', color: '#fff', marginLeft: 'auto' },
    received: { background: '#87CEEB', color: '#2E8B57' },
    chatInputRow: { display: 'flex', gap: '1rem', marginTop: '1rem' },
    button: { background: '#2E8B57', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
    backRow: { textAlign: 'right' },
    backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#2E8B57', color: '#fff', textDecoration: 'none', padding: '0.8rem 1.5rem', borderRadius: 8, fontFamily: 'Cinzel, serif', fontWeight: 'bold' },
  };

  return (
    <div style={{ ...styles.root, padding: 0 }}>
      <div style={{ maxWidth: 1100, margin: '1rem auto 0 auto', padding: '0 1rem' }}>
        <Link to="/coordinator/coordinator_dashboard" style={styles.backLink}>
          <span style={{ fontSize: '1.1rem' }}>⬅</span>
          <span>Back to Dashboard</span>
        </Link>
      </div>
      <div style={{ display: 'flex', maxWidth: 1100, margin: '2rem auto', gap: '1rem' }}>
        <div style={{ flex: '0 0 320px', background: '#fff', borderRadius: 12, padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select style={{ flex: 1, ...styles.select }} value={role} onChange={(e) => setRole(e.target.value)}>
              <option>Coordinator</option>
              <option>Player</option>
            </select>
            <input placeholder="username (optional)" value={usernameSearch} onChange={(e) => setUsernameSearch(e.target.value)} style={{ width: 160, padding: '0.6rem', borderRadius: 8, border: '1px solid #ddd' }} />
            <button style={{ ...styles.button, padding: '0.5rem 0.8rem' }} onClick={searchRegisteredUsers}>Search</button>
            <button style={{ ...styles.button, padding: '0.5rem 0.8rem' }} onClick={() => openChatWith(usernameSearch)}>Start Chat</button>
          </div>

          <div style={{ marginBottom: '0.5rem' }}>
            <input style={{ ...styles.input, padding: '0.6rem' }} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your name..." disabled={joined || prefilledFromSession} />
            <button style={{ ...styles.button, width: '100%', marginTop: '0.5rem' }} onClick={joinChat} disabled={joined}>{joined ? 'Joined' : 'Join'}</button>
          </div>

          {/* Manual open chat removed to avoid duplicate search bars */}

          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: 0, marginBottom: '0.5rem', color: '#2E8B57' }}>Contacts</h4>
            <div style={{ maxHeight: 420, overflowY: 'auto', marginTop: '0.5rem' }}>
              {contacts.length === 0 && <div style={{ color: '#666' }}>No contacts yet. Search users or send a message.</div>}
              {contacts.map(c => (
                <div key={c.contact} onClick={() => { if (!joined) joinChat(); setReceiver(c.contact); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#2E8B57' }}>{c.contact}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{c.lastMessage}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#999' }}>{c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : ''}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#2E8B57' }}>Search results</h4>
            <div style={{ maxHeight: 180, overflowY: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: '0.5rem' }}>
              {registeredUsers.length === 0 && <div style={{ color: '#666' }}>No users found for selected role/username.</div>}
              {registeredUsers.map(u => (
                <div key={u.username} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px dashed #eee' }}>
                  <div style={{ color: '#2E8B57' }}>{u.username} <small style={{ color: '#666' }}>({u.role})</small></div>
                  <div>
                    <button type="button" style={{ ...styles.button, padding: '0.4rem 0.8rem', fontSize: 12 }} onClick={() => openChatWith(u.username)}>Chat</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: '#2E8B57' }}>{receiver === 'All' ? 'Global Chat' : receiver}</h2>
            <div style={{ color: '#666', fontSize: 14 }}>{joined ? 'Connected' : 'Not joined'}</div>
          </div>

          <div id="chatBox" style={{ ...styles.chatBox, height: 480 }} ref={chatBoxRef}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ ...styles.msg, ...(m.type === 'sent' ? styles.sent : styles.received) }}>
                <p style={{ margin: 0 }}><strong>{m.type === 'sent' ? 'You' : m.sender}:</strong> {m.text}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input id="chatMessage" style={{ ...styles.input, marginBottom: 0 }} type="text" placeholder="Type a message" value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} />
            <button type="button" style={styles.button} onClick={sendMessage}><i className="fas fa-paper-plane" aria-hidden="true"></i> <span>Send</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoordinatorChat;
