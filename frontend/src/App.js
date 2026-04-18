import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import AppRoutes from './routes/AppRoutes';
import { initTokenManager } from './utils/tokenManager';

// Initialize JWT token manager on app start (handles auto-refresh scheduling)
initTokenManager();

function App() {
  const navigate = useNavigate();

  // Listen for session-expired events from token manager
  useEffect(() => {
    const handleSessionExpired = (e) => {
      console.warn('Session expired:', e.detail?.message);
      navigate('/login?error-message=' + encodeURIComponent('Session expired. Please log in again.'));
    };
    window.addEventListener('chesshive:session-expired', handleSessionExpired);
    return () => window.removeEventListener('chesshive:session-expired', handleSessionExpired);
  }, [navigate]);

  return (
    <AnimatePresence mode="wait">
      <AppRoutes />
    </AnimatePresence>
  );
}

export default App;
