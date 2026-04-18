import React, { useState, useEffect } from 'react';
import '../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';

const dropdownVariants = {
  hidden: { opacity: 0, x: -400 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
      staggerChildren: 0.06
    }
  },
  exit: { opacity: 0, x: -400, transition: { duration: 0.3 } }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.3 } }
};

const linkVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } }
};

export default function AnimatedSidebar({ links = [], logo, title, onHoverLink }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const defaultLinks = [
    { path: '/', label: 'Home', icon: 'fas fa-home' },
    { path: '/about', label: 'About', icon: 'fas fa-info-circle' },
    { path: '/login', label: 'Join Community', icon: 'fas fa-users' },
    { path: '/blogs', label: 'Blogs', icon: 'fas fa-blog' },
    { path: '/contactus', label: 'Contact Us', icon: 'fas fa-envelope' }
  ];

  const roleRoutePattern = /^\/(admin|organizer|coordinator|player)(\/|$)/;
  const hasExplicitLogout = links.some((link) => {
    const label = (link?.label || '').toLowerCase();
    return link?.action === 'logout' || label === 'logout';
  });

  const navLinks = (() => {
    if (links.length === 0) return defaultLinks;
    if (!roleRoutePattern.test(location.pathname) || hasExplicitLogout) return links;
    return [...links, { action: 'logout', label: 'Logout', icon: 'fas fa-sign-out-alt' }];
  })();

  const handleLinkClick = (link) => {
    if (link?.action === 'logout') {
      dispatch(logout());
      setIsOpen(false);
      navigate('/login', { replace: true });
      return;
    }
    if (typeof link?.onClick === 'function') {
      link.onClick();
      setIsOpen(false);
      return;
    }
    if (link?.path) {
      navigate(link.path);
      setIsOpen(false);
    }
  };

  // Apply player theme automatically when visiting /player routes
  useEffect(() => {
    try {
      if (location.pathname && location.pathname.startsWith('/player')) {
        document.body.classList.add('player');
      } else {
        document.body.classList.remove('player');
      }
    } catch (err) {
      // ignore in SSR or restricted environments
    }
  }, [location.pathname]);

  return (
    <>
      {/* Hamburger Button - Fixed at top left */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="hamburger-btn"
        style={{
          position: 'fixed',
          top: '1.5rem',
          left: '1.5rem',
          background: 'var(--hamburger-bg, #2E8B57)',
          border: 'none',
          color: 'var(--hamburger-text, #FFFDD0)',
          fontSize: '1.8rem',
          cursor: 'pointer',
          padding: '0.7rem 0.9rem',
          borderRadius: '8px',
          zIndex: 2001,
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease'
        }}
        whileHover={{ backgroundColor: 'var(--hamburger-hover, #24663f)', scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <i className={`fas fa-${isOpen ? 'times' : 'bars'}`}></i>
      </motion.button>

      {/* Backdrop Blur */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1999
            }}
          />
        )}
      </AnimatePresence>

      {/* Left Side Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="dropdown-menu dropdown-menu-clean"
            style={{
              position: 'fixed',
              top: '80px',
              left: '1.5rem',
              width: '280px',
              maxHeight: 'calc(100vh - 100px)',
              background: 'var(--sidebar-bg-solid, var(--sidebar-bg))',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              borderRadius: '12px',
              border: '1px solid var(--sidebar-border)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
              zIndex: 2000,
              overflow: 'auto',
              padding: '0.5rem 0'
            }}
          >
            {navLinks.map((link, index) => (
              <motion.a
                key={`${link.path || link.action || link.label || 'menu-link'}-${index}`}
                variants={linkVariants}
                onClick={() => handleLinkClick(link)}
                onMouseEnter={() => onHoverLink && onHoverLink(link.label)}
                onMouseLeave={() => onHoverLink && onHoverLink(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.5rem',
                  color: 'var(--sidebar-text)',
                  textDecoration: 'none',
                  fontSize: '1rem',
                  fontFamily: "'Cinzel', serif",
                  cursor: 'pointer',
                  borderRadius: '8px',
                  margin: '0.2rem 0.5rem',
                  transition: 'all 0.25s ease',
                  textAlign: 'left'
                }}
                whileHover={{
                  backgroundColor: 'var(--sidebar-hover, rgba(255,255,255,0.08))',
                  paddingLeft: '1.75rem',
                  color: 'var(--link-hover)'
                }}
                whileTap={{ scale: 0.98 }}
              >
                <i className={link.icon} style={{ width: '20px', textAlign: 'center' }} />
                <span>{link.label}</span>
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


