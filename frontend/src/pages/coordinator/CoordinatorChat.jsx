import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSocket, getSocketServerUrl } from '../../utils/socket';
import EmojiPicker from 'emoji-picker-react';
import ChatChoiceEmblem from '../../components/ChatChoiceEmblem';

// Coordinator version of PlayerChat with coordinator-specific functionality
// Replicates PlayerChat design and modes with coordinator features

const SOCKET_IO_PATH = '/socket.io/socket.io.js';

function CoordinatorChat() {
  const navigate = useNavigate();
  const [role, setRole] = useState('Coordinator');
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const socketRef = useRef(null);
  const chatBoxRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaPreview, setMediaPreview] = useState(null); // {url, type, file}

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
    const socketBase = (getSocketServerUrl() || '').replace(/\/+$/, '');
    script.src = socketBase ? `${socketBase}${SOCKET_IO_PATH}` : SOCKET_IO_PATH;
    script.async = true;
    script.onload = () => setSocketReady(true);
    script.onerror = () => setSocketReady(false);
    document.body.appendChild(script);
    return () => {
      try { document.body.removeChild(script); } catch (_) { }
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
    }).catch(() => { });
  }, []);

  // Restore receiver from localStorage so active chat survives reload
  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat_receiver');
      if (saved) setReceiver(saved);
    } catch (_) { }
  }, []);

  // Establish socket connection and listeners
  useEffect(() => {
    if (!socketReady || !window.io) return;
    if (socketRef.current) return; // already connected
    const sock = createSocket();
    if (!sock) return;
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
      } catch (_) { }
    });

    return () => {
      try {
        sock.off('message');
        sock.disconnect();
      } catch (_) { }
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
          const hist = data.history.slice().reverse().map(h => ({ sender: h.sender, text: h.message, type: h.sender === username ? 'sent' : 'received', receiver: h.receiver || (h.room === 'global' ? 'All' : receiver) }));
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

  // Search registered users by role (coordinator-specific: can chat with players and other coordinators)
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
        // Coordinators can chat with players and other coordinators
        list = list.filter(u => ['coordinator', 'player'].includes((u.role || '').toLowerCase()));
        setRegisteredUsers(list);
      }
    } catch (e) {
      // ignore
    }
  };

  // Persist selected receiver to localStorage so reload keeps the chat open
  useEffect(() => {
    try {
      if (receiver) localStorage.setItem('chat_receiver', receiver);
    } catch (_) { }
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
    // refresh contacts after sending
    setTimeout(loadContacts, 250);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isGif = file.type === 'image/gif';
    if (!isImage) { alert('Only image files (PNG, JPG, GIF, WebP) are supported'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5MB)'); return; }
    const url = URL.createObjectURL(file);
    setMediaPreview({ url, type: isGif ? 'gif' : 'image', file });
  };

  const sendMedia = async () => {
    if (!mediaPreview?.file) return;
    if (!socketRef.current) return;
    setUploadingMedia(true);
    try {
      const formData = new FormData();
      formData.append('media', mediaPreview.file);
      formData.append('sender', username);
      formData.append('receiver', receiver);
      const res = await fetch('/api/chat/upload', { method: 'POST', credentials: 'include', body: formData });
      let data;
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (res.ok && data.url) {
        // Emit the media message via socket
        socketRef.current.emit('chatMessage', {
          sender: username.trim(),
          receiver,
          message: `[${mediaPreview.type === 'gif' ? 'GIF' : 'Image'}] ${data.url}`
        });
        setMediaPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => {
          if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }, 200);
      } else {
        alert(data.message || 'Failed to upload media');
      }
    } catch (e) {
      alert('Upload failed: ' + (e.message || 'Unknown error'));
    } finally {
      setUploadingMedia(false);
    }
  };

  const cancelMedia = () => {
    if (mediaPreview?.url) URL.revokeObjectURL(mediaPreview.url);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Render a message, detecting image URLs
  const renderMessageContent = (text) => {
    const imgMatch = text?.match(/^\[(Image|GIF)\]\s+(https?:\/\/.+)$/);
    if (imgMatch) {
      return <img src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: 8, marginTop: '0.3rem', cursor: 'pointer' }} onClick={() => window.open(imgMatch[2], '_blank')} />;
    }
    return text;
  };

  const styles = {
    root: { fontFamily: 'Playfair Display, serif', backgroundColor: 'var(--page-bg)', minHeight: '100vh', padding: '1rem' },
    container: { maxWidth: 1000, margin: '0 auto' },
    card: { background: 'var(--content-bg)', borderRadius: 16, padding: '1rem', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', marginBottom: '1rem' },
    h2: { fontFamily: 'Cinzel, serif', fontSize: '2.5rem', color: 'var(--sea-green)', marginBottom: '2rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' },
    label: { display: 'block', marginBottom: '0.5rem', color: 'var(--sea-green)', fontWeight: 'bold' },
    input: { width: '100%', padding: '0.75rem 0.9rem', marginBottom: '0.75rem', border: '2px solid var(--sea-green)', borderRadius: 10, fontFamily: 'Playfair Display, serif', background: 'var(--content-bg)', color: 'var(--text-color)' },
    select: {
      width: '100%',
      marginBottom: '0.75rem',
      padding: '0.75rem 0.9rem',
      border: '1px solid rgba(148, 163, 184, 0.35)',
      borderRadius: 10,
      background: '#111827',
      color: '#f8fafc',
      fontFamily: 'Playfair Display, serif'
    },
    selectOption: { background: '#111827', color: '#f8fafc' },
    chatBox: { height: 400, border: '2px solid var(--border-color)', borderRadius: 12, padding: '1rem', margin: '0.5rem 0 0.75rem 0', overflowY: 'auto', background: 'var(--content-bg)', scrollBehavior: 'smooth', overscrollBehavior: 'contain' },
    msg: { marginTop: '0.4rem', marginRight: 0, marginBottom: '0.4rem', marginLeft: 0, padding: '0.9rem 1rem', borderRadius: 12, maxWidth: '78%', transition: 'transform 120ms ease, background 120ms ease' },
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

  return (
    <div style={styles.root}>
      {!joined ? (
        // Join form
        <div style={styles.container}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button type="button" className="back-to-dashboard" onClick={() => navigate('/coordinator/coordinator_dashboard')}>
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </button>
          </div>
          <div style={styles.card}>
            <h2 style={styles.h2}><i className="fas fa-users-cog" /> Join Coordinator Chat</h2>
            <label style={styles.label}>Your Name:</label>
            <input
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your coordinator name..."
            />
            <button style={styles.button} onClick={joinChat}>Join Chat</button>
          </div>
        </div>
      ) : chatMode === 'choice' ? (
        // Choice screen
        <div style={styles.container}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <button type="button" className="back-to-dashboard" onClick={() => navigate('/coordinator/coordinator_dashboard')}>
              <i className="fas fa-arrow-left" /> Back to Dashboard
            </button>
          </div>
          <div style={styles.card}>
            <h2 style={styles.h2}><i className="fas fa-users-cog" /> Choose Chat Type</h2>
            <div style={styles.choiceRow}>
              <button
                type="button"
                style={styles.choiceButton}
                onClick={() => { setReceiver('All'); setChatMode('global'); }}
              >
                <ChatChoiceEmblem kind="global" shellStyle={styles.choiceEmblemShell} />
                <div style={styles.choiceLabel}>Global Coordination</div>
              </button>
              <button
                type="button"
                style={styles.choiceButton}
                onClick={() => setChatMode('private_search')}
              >
                <ChatChoiceEmblem kind="private" shellStyle={styles.choiceEmblemShell} />
                <div style={styles.choiceLabel}>One-on-one Communication</div>
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
                <button onClick={() => navigate('/coordinator/coordinator_dashboard')} className="back-to-dashboard inline-btn"><i className="fas fa-arrow-left" /> Back to Dashboard</button>
                <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}><i className="fas fa-users-cog" /> Global Coordination</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button style={styles.button} onClick={() => setChatMode('choice')}>Change Mode</button>
                <div style={{ color: 'var(--text-color)', fontSize: 14 }}>Connected</div>
              </div>
            </div>
            <div id="chatBox" style={{ ...styles.chatBox, flex: 1, height: 'auto', overflowY: 'auto' }} ref={chatBoxRef}>
              {messages.map((m, idx) => (
                <div key={idx} style={{ ...styles.msg, ...(m.type === 'sent' ? styles.sent : styles.received) }}>
                  <p style={{ margin: 0 }}><strong>{m.type === 'sent' ? 'You' : m.sender}:</strong> {renderMessageContent(m.text)}</p>
                </div>
              ))}
            </div>
            {/* Media Preview */}
            {mediaPreview && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'rgba(46,139,87,0.08)', borderRadius: 8, margin: '0.5rem 0' }}>
                <img src={mediaPreview.url} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1, fontSize: '0.85rem' }}>{mediaPreview.file.name}</div>
                <button style={{ ...styles.button, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={sendMedia} disabled={uploadingMedia}>
                  {uploadingMedia ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Send</>}
                </button>
                <button style={{ ...styles.button, padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#e74c3c' }} onClick={cancelMedia}>✕</button>
              </div>
            )}
            <div style={styles.chatInputRow}>
              <input type="file" ref={fileInputRef} accept="image/*,.gif" style={{ display: 'none' }} onChange={handleFileSelect} />
              <button type="button" style={{ ...styles.button, padding: '0.6rem 0.8rem' }} onClick={() => fileInputRef.current?.click()} title="Send image or GIF">
                <i className="fas fa-image" />
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  style={{ ...styles.button, padding: '0.7rem', borderRadius: '50%', minWidth: 'auto' }}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <i className="fas fa-smile" />
                </button>
                {showEmojiPicker && (
                  <div style={{ position: 'absolute', bottom: '50px', left: '0', zIndex: 100 }}>
                    <EmojiPicker onEmojiClick={(emojiObject) => {
                      setMessage(prev => prev + emojiObject.emoji);
                      setShowEmojiPicker(false);
                    }} />
                  </div>
                )}
              </div>
              <input
                id="chatMessage"
                style={{ ...styles.input, marginBottom: 0 }}
                type="text"
                placeholder="Type a coordination message"
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
              <button type="button" className="back-to-dashboard" onClick={() => navigate('/coordinator/coordinator_dashboard')}>
                <i className="fas fa-arrow-left" /> Back to Dashboard
              </button>
            </div>
            <div style={styles.card}>
              <h2 style={styles.h2}><i className="fas fa-users-cog" /> Your One-on-one Communications</h2>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <select style={{ ...styles.select, flex: 1 }} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option style={styles.selectOption}>Coordinator</option>
                  <option style={styles.selectOption}>Player</option>
                </select>
                <input
                  placeholder="Search members or players"
                  value={usernameSearch}
                  onChange={(e) => setUsernameSearch(e.target.value)}
                  style={{ ...styles.input, flex: 2 }}
                />
                <button style={styles.button} onClick={searchRegisteredUsers}>Search</button>
                <button style={styles.button} onClick={loadContacts}>Refresh</button>
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {contacts.length === 0 && registeredUsers.length === 0 && <div style={{ color: 'var(--text-color)', textAlign: 'center', padding: '2rem' }}>No One-on-one communications yet. Search for coordinators or players to start chatting.</div>}
                {contacts.map((c, idx) => (
                  <div
                    key={c.contact}
                    style={{ ...styles.searchResult, animationDelay: `${idx * 0.1}s` }}
                    onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                    onClick={() => { setReceiver(c.contact); setChatMode('private_chat'); }}
                  >
                    <div style={{ fontWeight: 'bold', color: 'var(--sea-green)', fontSize: '1.1rem' }}><i className="fas fa-user-tie" /> {c.contact}</div>
                    <div style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>{c.lastMessage || 'Start One-on-one communication'}</div>
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
                    <div style={{ fontWeight: 'bold', color: 'var(--sea-green)', fontSize: '1.1rem' }}>
                      <i className={u.role === 'coordinator' ? 'fas fa-user-tie' : 'fas fa-chess-pawn'} /> {u.username}
                    </div>
                    <div style={{ color: 'var(--text-color)', fontSize: '0.9rem' }}>Role: {u.role === 'coordinator' ? 'Coordinator' : 'Player'}</div>
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
                <button onClick={() => navigate('/coordinator/coordinator_dashboard')} className="back-to-dashboard inline-btn"><i className="fas fa-arrow-left" /> Back to Dashboard</button>
                <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: 'var(--sea-green)' }}><i className="fas fa-users-cog" /> One-on-one Chat with {receiver}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button style={styles.button} onClick={() => setChatMode('private_search')}>Back to One-on-one</button>
                <button style={styles.button} onClick={() => setChatMode('choice')}>Change Mode</button>
                <div style={{ color: 'var(--text-color)', fontSize: 14 }}>Connected</div>
              </div>
            </div>
            <div id="chatBox" style={{ ...styles.chatBox, flex: 1, height: 'auto', overflowY: 'auto' }} ref={chatBoxRef}>
              {messages.map((m, idx) => (
                <div key={idx} style={{ ...styles.msg, ...(m.type === 'sent' ? styles.sent : styles.received) }}>
                  <p style={{ margin: 0 }}><strong>{m.type === 'sent' ? 'You' : m.sender}:</strong> {renderMessageContent(m.text)}</p>
                </div>
              ))}
            </div>
            {/* Media Preview */}
            {mediaPreview && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'rgba(46,139,87,0.08)', borderRadius: 8, margin: '0.5rem 0' }}>
                <img src={mediaPreview.url} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1, fontSize: '0.85rem' }}>{mediaPreview.file.name}</div>
                <button style={{ ...styles.button, padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={sendMedia} disabled={uploadingMedia}>
                  {uploadingMedia ? <i className="fas fa-spinner fa-spin" /> : <><i className="fas fa-paper-plane" /> Send</>}
                </button>
                <button style={{ ...styles.button, padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: '#e74c3c' }} onClick={cancelMedia}>✕</button>
              </div>
            )}
            <div style={styles.chatInputRow}>
              <input type="file" ref={fileInputRef} accept="image/*,.gif" style={{ display: 'none' }} onChange={handleFileSelect} />
              <button type="button" style={{ ...styles.button, padding: '0.6rem 0.8rem' }} onClick={() => fileInputRef.current?.click()} title="Send image or GIF">
                <i className="fas fa-image" />
              </button>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  style={{ ...styles.button, padding: '0.7rem', borderRadius: '50%', minWidth: 'auto' }}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <i className="fas fa-smile" />
                </button>
                {showEmojiPicker && (
                  <div style={{ position: 'absolute', bottom: '50px', left: '0', zIndex: 100 }}>
                    <EmojiPicker onEmojiClick={(emojiObject) => {
                      setMessage(prev => prev + emojiObject.emoji);
                      setShowEmojiPicker(false);
                    }} />
                  </div>
                )}
              </div>
              <input
                id="chatMessage"
                style={{ ...styles.input, marginBottom: 0 }}
                type="text"
                placeholder="Type a One-on-one message (Emojis supported!)"
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

export default CoordinatorChat;
