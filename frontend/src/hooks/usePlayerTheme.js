import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'playerTheme'; // 'dark' | 'light'
const WALLPAPER_KEY = 'playerWallpaperUrl'; // string URL

// Hook returns [isDark, toggleTheme]
export default function usePlayerTheme() {
  const hasLocalPreferenceRef = useRef(false);
  const userToggledRef = useRef(false);
  const [isDark, setIsDark] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v) {
        hasLocalPreferenceRef.current = true;
        return v === 'dark';
      }
    } catch (e) {}
    return false;
  });
  const loadedFromServerRef = useRef(false);

  const sessionRef = useRef({ loaded: false, email: null, role: null });
  const [session, setSession] = useState({ loaded: false, email: null, role: null });

  // Load session once (never errors) so we can avoid hitting protected endpoints when logged out
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        const next = {
          loaded: true,
          email: data?.userEmail || null,
          role: data?.userRole || null
        };
        if (!cancelled) {
          sessionRef.current = next;
          setSession(next);
        }
      } catch (e) {
        const next = { loaded: true, email: null, role: null };
        if (!cancelled) {
          sessionRef.current = next;
          setSession(next);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasLocalWallpaperRef = useRef(false);
  const [wallpaperUrl, setWallpaperUrl] = useState(() => {
    try {
      const v = localStorage.getItem(WALLPAPER_KEY);
      if (v) {
        hasLocalWallpaperRef.current = true;
        return v;
      }
    } catch (e) {}
    return '';
  });

  // Apply theme to body + localStorage + push to server (if user logged in)
  useEffect(() => {
    try {
      document.body.classList.add('player');
      if (isDark) document.body.classList.add('player-dark');
      else document.body.classList.remove('player-dark');
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch (e) {}
    // Avoid posting immediately after initial server load
    if (loadedFromServerRef.current) {
      // Only persist if we have a logged-in session
      if (!sessionRef.current.email) return;
      // Persist to backend if session exists
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: isDark ? 'dark' : 'light' })
      }).catch(() => {});
    }
  }, [isDark]);

  // Apply wallpaper as CSS variables (used by playerNeoNoir.css)
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (wallpaperUrl) {
        root.style.setProperty('--player-wallpaper-layer', `url("${wallpaperUrl}")`);
        root.style.setProperty('--player-wallpaper-overlay', 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.35))');
        localStorage.setItem(WALLPAPER_KEY, wallpaperUrl);
      } else {
        root.style.setProperty('--player-wallpaper-layer', 'none');
        root.style.setProperty('--player-wallpaper-overlay', 'none');
        localStorage.removeItem(WALLPAPER_KEY);
      }
    } catch (e) {}
  }, [wallpaperUrl]);

  // Load server preference if logged in
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // If the user already has a local preference (or just toggled), don't let
        // the server response override it. This prevents "dark mode" appearing
        // stuck in light mode when `/api/theme` returns 'light'.
        if (hasLocalPreferenceRef.current || userToggledRef.current) {
          loadedFromServerRef.current = true;
          return;
        }
        const res = await fetch('/api/theme', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && data.theme) {
          const serverIsDark = data.theme === 'dark';
          loadedFromServerRef.current = true;
          setIsDark(serverIsDark);
        } else {
          loadedFromServerRef.current = true; // still allow future POSTs
        }
      } catch (e) {
        loadedFromServerRef.current = true; // fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load wallpaper from server if logged in and no local wallpaper set
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!session.loaded) return;
        if (session.role !== 'player') return;
        if (hasLocalWallpaperRef.current) return;
        const res = await fetch('/player/api/profile/wallpaper', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const url = (data?.wallpaper_url || '').toString();
        if (!cancelled && url) {
          setWallpaperUrl(url);
        }
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [session.loaded, session.role]);

  const toggleTheme = useCallback(() => {
    userToggledRef.current = true;
    hasLocalPreferenceRef.current = true;
    setIsDark(s => !s);
  }, []);

  return [isDark, toggleTheme, setWallpaperUrl, wallpaperUrl];
}
