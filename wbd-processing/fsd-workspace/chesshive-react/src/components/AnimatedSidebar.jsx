import React, { useState, useEffect } from 'react';
import '../styles/playerNeoNoir.css';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

const dropdownVariants = {
  hidden: { opacity: 0, x: -400 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut",
      staggerChildren: 0.08
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
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3 }
  }
};

export default function AnimatedSidebar({ links = [], logo, title }) {
  const [isOpen, setIsOpen] = useState(false);
  const [overlayBg, setOverlayBg] = useState('');
  const [overlayType, setOverlayType] = useState('');
  const [profile, setProfile] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [storeItems, setStoreItems] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [loadingStore, setLoadingStore] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  function getTypeForPath(path) {
    if (!path) return '';
    if (path.includes('player_profile') || path === '/profile') return 'profile';
    if (path.includes('growth')) return 'growth';
    if (path.includes('subscription')) return 'subscription';
    if (path.includes('store') || path.includes('shop')) return 'store';
    return 'default';
  }

  async function loadProfile() {
    if (profile || loadingProfile) return;
    setLoadingProfile(true);
    try {
      const res = await fetch('/player/api/profile', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setProfile(data.player || data || {});
    } catch (e) { /* silent */ } finally { setLoadingProfile(false); }
  }

  async function loadGrowth() {
    if (growth || loadingGrowth) return;
    setLoadingGrowth(true);
    try {
      const res = await fetch('/player/api/growth_analytics', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setGrowth(data || {});
    } catch (e) { /* silent */ } finally { setLoadingGrowth(false); }
  }

  async function loadSubscription() {
    if (subscription || loadingSubscription) return;
    setLoadingSubscription(true);
    try {
      const res = await fetch('/player/api/subscription', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSubscription(data.currentSubscription || data || null);
    } catch (e) { /* silent */ } finally { setLoadingSubscription(false); }
  }

  async function loadStore() {
    if (storeItems || loadingStore) return;
    setLoadingStore(true);
    try {
      const res = await fetch('/player/api/dashboard', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStoreItems(data.latestItems || []);
    } catch (e) { /* silent */ } finally { setLoadingStore(false); }
  }

  function getBgForPath(path) {
    // Map routes to gentle blurred backgrounds (gradients used to avoid external assets)
    if (!path) return '';
    if (path.includes('player_profile') || path === '/profile') return 'linear-gradient(135deg, rgba(11,79,108,0.16), rgba(255,255,255,0.02))';
    if (path.includes('growth')) return 'linear-gradient(135deg, rgba(46,139,87,0.14), rgba(11,79,108,0.06))';
    if (path.includes('subscription')) return 'linear-gradient(135deg, rgba(255,215,180,0.12), rgba(255,180,120,0.04))';
    if (path.includes('store') || path.includes('shop')) return 'linear-gradient(135deg, rgba(235,87,87,0.12), rgba(11,79,108,0.03))';
    return 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(11,79,108,0.02))';
  }

  const defaultLinks = [
    { path: '/', label: 'Home', icon: 'fas fa-home' },
    { path: '/about', label: 'About', icon: 'fas fa-info-circle' },
    { path: '/login', label: 'Join Community', icon: 'fas fa-users' },
    { path: '/contactus', label: 'Contact Us', icon: 'fas fa-envelope' }
  ];

  const navLinks = links.length > 0 ? links : defaultLinks;

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
          zIndex: 1001,
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
              zIndex: 999
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
            className="dropdown-menu"
            style={{
              position: 'fixed',
              top: '80px',
              left: '1.5rem',
              width: '280px',
              maxHeight: 'calc(100vh - 100px)',
              background: 'var(--sidebar-bg, linear-gradient(135deg, rgba(46, 139, 87, 0.95) 0%, rgba(32, 100, 60, 0.95) 100%))',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'stretch',
              borderRadius: '12px',
              border: '1px solid var(--sidebar-border, rgba(46, 139, 87, 0.4))',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              zIndex: 1000,
              overflow: 'hidden',
              padding: '0.5rem 0'
            }}
          >
            {/* background preview that changes on item hover */}
            <div className="dropdown-bg" style={{ background: overlayBg || 'transparent', opacity: overlayBg ? 1 : 0 }}>
              <div className={`preview ${overlayType || ''}`} aria-hidden>
                {/* Profile preview */}
                <div className="preview-inner profile">
                  {loadingProfile ? (
                    <div className="skeleton profile-skeleton" aria-hidden>
                      <div className="skeleton-avatar" />
                      <div style={{flex:1}}>
                        <div className="skeleton-line" style={{width:'70%'}} />
                        <div className="skeleton-line" style={{width:'50%', marginTop: '8px'}} />
                        <div style={{display:'flex', gap:'0.6rem', marginTop: '12px'}}>
                          <div className="skeleton-stat" />
                          <div className="skeleton-stat" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="avatar" />
                      <div className="meta">
                        <div className="name">You — <strong>{profile?.name || profile?.username || 'Player'}</strong></div>
                        <div className="info">{profile?.college || ''} {profile?.college ? '•' : ''} Member: {profile?.member_since ? `${profile.member_since}` : '—'}</div>
                        <div className="stats">
                          <div className="stat"><div className="label">Rating</div><div className="value">{profile?.rating ?? '—'}</div></div>
                          <div className="stat"><div className="label">Tournaments</div><div className="value">{profile?.tournaments_count ?? '--'}</div></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Growth preview (mini bar chart) */}
                <div className="preview-inner growth">
                  {loadingGrowth ? (
                    <div className="skeleton growth-skeleton">
                      <div className="mini-chart">
                        <div className="skeleton-bar" /><div className="skeleton-bar" /><div className="skeleton-bar" /><div className="skeleton-bar" /><div className="skeleton-bar" />
                      </div>
                      <div className="skeleton-line" style={{width:'36%', marginTop:'10px'}} />
                    </div>
                  ) : (
                    <>
                      <div className="mini-chart">
                        {(growth?.ratingHistory || [30,60,48,72,88]).slice(-5).map((v, i) => (
                          <div key={i} className="bar" style={{ height: `${Math.max(8, (Number(v) || 10))}%` }} />
                        ))}
                      </div>
                      <div className="label">Rating: {growth?.player?.rating ?? growth?.rating ?? '—'}</div>
                    </>
                  )}
                </div>

                {/* Subscription preview */}
                <div className="preview-inner subscription">
                  {loadingSubscription ? (
                    <div className="skeleton sub-skeleton">
                      <div className="skeleton-line" style={{width:'48%'}} />
                      <div className="skeleton-line" style={{width:'30%', marginTop:'8px'}} />
                      <div className="skeleton-line" style={{width:'70%', marginTop:'12px'}} />
                    </div>
                  ) : (
                    <div className="sub-card">
                      <div className="tier">{subscription?.plan ?? (profile?.subscription?.plan || 'Free')}</div>
                      <div className="price">{subscription?.price ? `₹${subscription.price} / mo` : (profile?.subscription ? `Active` : '—')}</div>
                      <div className="benefits">{subscription?.benefits ?? (profile?.subscription?.features || 'Basic access')}</div>
                    </div>
                  )}
                </div> 

                {/* Store preview */}
                <div className="preview-inner store">
                  {loadingStore ? (
                    <div className="skeleton store-skeleton">
                      <div className="store-grid">
                        <div className="product"><div className="skeleton-thumb" /><div className="skeleton-line" style={{width:'60%', margin:'6px auto 0'}} /></div>
                        <div className="product"><div className="skeleton-thumb" /><div className="skeleton-line" style={{width:'50%', margin:'6px auto 0'}} /></div>
                        <div className="product"><div className="skeleton-thumb" /><div className="skeleton-line" style={{width:'70%', margin:'6px auto 0'}} /></div>
                      </div>
                    </div>
                  ) : (
                    <div className="store-grid">
                      {(storeItems || []).slice(0,3).map((it, idx) => (
                        <div className="product" key={idx}><div className="thumb" /><div className="pname">{it.name || it.title || `Item ${idx+1}`}</div></div>
                      ))}
                      {(!storeItems || storeItems.length === 0) && (
                        <div className="product"><div className="thumb" /><div className="pname">No items</div></div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </div>
            {navLinks.map((link, index) => (
              <motion.a
                key={link.path}
                variants={linkVariants}
                onClick={() => { navigate(link.path); setIsOpen(false); }}
                onMouseEnter={() => {
                  const p = getTypeForPath(link.path);
                  setOverlayBg(getBgForPath(link.path)); setOverlayType(p);
                  if (p === 'profile') loadProfile();
                  if (p === 'growth') loadGrowth();
                  if (p === 'subscription') loadSubscription();
                  if (p === 'store') loadStore();
                }}
                onMouseLeave={() => { setOverlayBg(''); setOverlayType(''); }}
                onFocus={() => {
                  const p = getTypeForPath(link.path);
                  setOverlayBg(getBgForPath(link.path)); setOverlayType(p);
                  if (p === 'profile') loadProfile();
                  if (p === 'growth') loadGrowth();
                  if (p === 'subscription') loadSubscription();
                  if (p === 'store') loadStore();
                }}
                onBlur={() => { setOverlayBg(''); setOverlayType(''); }}
                style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 1.5rem',
                  color: 'var(--sidebar-text, #FFFDD0)',
                  textDecoration: 'none',
                  fontSize: '1rem',
                  fontFamily: "'Cinzel', serif",
                  cursor: 'pointer',
                  borderRadius: '8px',
                  margin: '0.3rem 0.5rem',
                  transition: 'all 0.3s ease',
                  textAlign: 'left'
                }}
                whileHover={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.06)', 
                  paddingLeft: '2rem',
                  color: 'var(--link-hover, #87CEEB)'
                }}
                whileTap={{ scale: 0.95 }}
              >
                <i className={link.icon} style={{ width: '20px', textAlign: 'center' }}></i> 
                <span>{link.label}</span>
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
