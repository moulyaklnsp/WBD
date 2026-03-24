import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'playerTheme'; // 'dark' | 'light'

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

  // Apply theme to body + localStorage + push to server (if user logged in)
  useEffect(() => {
    try {
      if (isDark) document.body.classList.add('player-dark');
      else document.body.classList.remove('player-dark');
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch (e) {}
    // Avoid posting immediately after initial server load
    if (loadedFromServerRef.current) {
      // Persist to backend if session exists
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ theme: isDark ? 'dark' : 'light' })
      }).catch(() => {});
    }
  }, [isDark]);

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

  const toggleTheme = useCallback(() => {
    userToggledRef.current = true;
    hasLocalPreferenceRef.current = true;
    setIsDark(s => !s);
  }, []);

  return [isDark, toggleTheme];
}
