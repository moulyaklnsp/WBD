import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { getOrCreateSharedSocket } from '../utils/socket';

const SOCKET_IO_PATH = '/socket.io/socket.io.js';

function ensureSocketIoLoadedOnce() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.io) return Promise.resolve(true);
  if (window.__chesshiveSocketIoLoading) return window.__chesshiveSocketIoLoading;

  window.__chesshiveSocketIoLoading = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SOCKET_IO_PATH;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return window.__chesshiveSocketIoLoading;
}

function getOrCreateLiveSocket() {
  if (typeof window === 'undefined') return null;
  if (window.__chesshiveLiveSocket) return window.__chesshiveLiveSocket;
  const sock = getOrCreateSharedSocket('__chesshiveLiveSocket');
  return sock;
}

export default function LiveMatchInviteOverlay() {
  const auth = useSelector((s) => s.auth || {});
  const user = auth.user;
  const [sessionUser, setSessionUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  const [ready, setReady] = useState(typeof window !== 'undefined' && !!window.io);
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef(null);

  const [incomingInvite, setIncomingInvite] = useState(null); // { inviteId?, from, baseMs, incMs, colorPref }
  const [open, setOpen] = useState(false);

  const pathnameRef = useRef(location.pathname);
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  const effectiveUser = user || sessionUser;
  const isPlayer = (effectiveUser?.role || '').toString().toLowerCase() === 'player';
  const username = (effectiveUser?.username || '').toString().trim();

  // Fallback session fetch (helps when Redux auth hydration is slow)
  useEffect(() => {
    if (user) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const res = await fetch('/api/session', { credentials: 'include' });
        if (!res.ok) throw new Error('bad');
        const data = await res.json().catch(() => null);
        if (!cancelled && data && data.username && data.userRole) {
          setSessionUser({ username: data.username, role: data.userRole });
          return;
        }
      } catch (_) {
        // ignore
      }
      if (!cancelled) timer = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  const disableOverlayUi = useMemo(() => {
    // Live Match page already has its own invite UI
    return location.pathname.startsWith('/player/live_match');
  }, [location.pathname]);

  // Load Socket.IO client once
  useEffect(() => {
    let cancelled = false;
    ensureSocketIoLoadedOnce().then((ok) => {
      if (cancelled) return;
      setReady(!!ok);
    });
    return () => { cancelled = true; };
  }, []);

  // Toast auto-clear
  useEffect(() => {
    if (!toast) return undefined;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [toast]);

  // Create socket + join presence for player
  useEffect(() => {
    if (!ready) return undefined;
    if (!isPlayer || !username) return undefined;

    const sock = getOrCreateLiveSocket();
    if (!sock) return undefined;

    try {
      sock.emit('join', { username, role: 'Player' });
    } catch (_) {}

    const onInvite = (payload) => {
      // If user is already on live_match, let that page handle it.
      if (pathnameRef.current.startsWith('/player/live_match')) return;

      const p = payload || {};
      const next = {
        inviteId: p.inviteId,
        from: p.from,
        baseMs: p.baseMs,
        incMs: p.incMs,
        colorPref: p.colorPref || 'random'
      };
      setIncomingInvite(next);
      setOpen(true);
      setToast('New match request');
    };

    sock.on('matchInvite', onInvite);

    return () => {
      try { sock.off('matchInvite', onInvite); } catch (_) {}
    };
  }, [ready, isPlayer, username]);

  const reject = () => {
    const sock = getOrCreateLiveSocket();
    if (!sock || !incomingInvite) return;
    try {
      if (incomingInvite.inviteId) sock.emit('matchInviteDecline', { inviteId: incomingInvite.inviteId });
      else sock.emit('matchInviteDecline', { fromUsername: incomingInvite.from });
    } catch (_) {}
    setOpen(false);
    setIncomingInvite(null);
    setToast('Rejected');
  };

  const accept = () => {
    if (!incomingInvite) return;
    // Navigate to Live Match and auto-accept there so matchFound isn't missed.
    const qs = new URLSearchParams();
    if (incomingInvite.inviteId) qs.set('accept_invite', incomingInvite.inviteId);
    else if (incomingInvite.from) qs.set('accept_from', incomingInvite.from);
    navigate(`/player/live_match?${qs.toString()}`);
    setOpen(false);
  };

  if (!isPlayer || !username) return null;

  return (
    <>
      {!!toast && !disableOverlayUi && (
        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 3000, background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 12px', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
          <div style={{ fontWeight: 700, color: 'var(--sea-green)' }}>{toast}</div>
        </div>
      )}

      {!disableOverlayUi && incomingInvite && !open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 3000,
            background: 'var(--sea-green)',
            color: 'var(--on-accent)',
            border: 'none',
            padding: '10px 14px',
            borderRadius: 999,
            cursor: 'pointer',
            fontFamily: 'Cinzel, serif',
            fontWeight: 'bold'
          }}
          aria-label="Play (incoming request)"
        >
          Play (1)
        </button>
      )}

      {open && !disableOverlayUi && incomingInvite && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 3001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 14,
              padding: '1rem',
              color: 'var(--text-color)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 800, color: 'var(--sky-blue)' }}>Play Request</div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer', fontSize: 18, opacity: 0.85 }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 10, opacity: 0.92 }}>
              <div>
                From: <strong>{incomingInvite.from}</strong>
              </div>
              <div style={{ marginTop: 6 }}>
                Time control: <strong>{Math.round((incomingInvite.baseMs || 0) / 60000)}+{Math.round((incomingInvite.incMs || 0) / 1000)}</strong>
              </div>
              <div style={{ marginTop: 6 }}>
                Requested color: <strong>{incomingInvite.colorPref || 'random'}</strong>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={accept}
                style={{ background: 'var(--sea-green)', color: 'var(--on-accent)', border: 'none', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', flex: 1 }}
              >
                Accept
              </button>
              <button
                onClick={reject}
                style={{ background: 'transparent', color: 'var(--sea-green)', border: '2px solid var(--sea-green)', padding: '10px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontWeight: 'bold', flex: 1 }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
