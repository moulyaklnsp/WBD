import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, restoreAccount, clearRestoreInfo } from '../features/auth/authSlice';
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard, FloatingButton } from "../components/AnimatedCard";


export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState({ email: false, password: false });
  const [dynamicError, setDynamicError] = React.useState("");
  const [dynamicSuccess, setDynamicSuccess] = React.useState("");
  const dispatch = useDispatch();
  const auth = useSelector(state => state.auth);
  const authError = auth.error;

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#071327';
    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  React.useEffect(() => {
    if (authError) setDynamicError(authError);
  }, [authError]);

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const errorMessage = urlParams.get('error-message');
    const successMessage = urlParams.get('success-message');
    if (errorMessage) setDynamicError(decodeURIComponent(errorMessage));
    else if (successMessage) setDynamicSuccess(decodeURIComponent(successMessage));
  }, []);

  function validateEmail(val) {
    if (!val || !/^\S+@\S+\.\S+$/.test(val)) return false;
    if (/[A-Z]/.test(val)) return false;
    return true;
  }

  function validatePassword(val) {
    return !!val && /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(val);
  }

  const emailError = touched.email && !validateEmail(email) ? 'Valid lowercase email is required' : '';
  const passwordError = touched.password && !validatePassword(password) ? 'Password must be at least 8 characters with one uppercase, one lowercase, and one special character' : '';

  async function onSubmitLogin(e) {
    e.preventDefault();
    setDynamicError("");
    if (!validateEmail(email)) { setDynamicError('Valid lowercase email is required'); return; }
    if (!validatePassword(password)) { setDynamicError('Password must be at least 8 characters with one uppercase, one lowercase, and one special character'); return; }
    try {
      const result = await dispatch(login({ email: email.trim(), password }));
      if (result.meta.requestStatus === 'fulfilled') {
        const redirectUrl = result.payload?.redirectUrl || '/';
        setDynamicSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 500);
      } else {
        const err = result.payload || result.error || {};
        setDynamicError(err.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setDynamicError('Failed to connect to server.');
    }
  }

  async function onRestoreAccount(e) {
    e.preventDefault();
    setDynamicError("");
    if (!auth.restoreInfo?.userId) {
      setDynamicError('Unable to restore account. Please try again.');
      return;
    }
    try {
      const result = await dispatch(restoreAccount({
        id: auth.restoreInfo.userId,
        email: email.trim(),
        password
      }));
      if (result.meta.requestStatus === 'fulfilled') {
        setDynamicSuccess('Account restored successfully! Redirecting...');
        const redirectUrl = result.payload?.redirectUrl || '/';
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 1000);
      } else {
        const err = result.payload || result.error || {};
        setDynamicError(err.message || 'Failed to restore account');
      }
    } catch (err) {
      console.error('Restore account error:', err);
      setDynamicError('Failed to connect to server.');
    }
  }

  function cancelRestore() {
    dispatch(clearRestoreInfo());
    setDynamicError("");
    setEmail("");
    setPassword("");
  }

  const inputStyle = {
    width: '100%',
    padding: '1rem 1.2rem',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '2px solid rgba(46, 139, 87, 0.3)',
    borderRadius: '12px',
    fontSize: '1rem',
    color: '#FFFDD0',
    transition: 'all 0.3s ease',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#FFFDD0',
    fontWeight: '600',
    fontSize: '1.1rem',
    fontFamily: "'Cinzel', serif"
  };

  return (
    <AnimatePresence>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <ChessBackground wallpaperUrl="/images/Gemini_Generated_Image_q5j9ziq5j9ziq5j9.png" />
        <AnimatedSidebar />

        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            padding: '40px 40px 30px 40px',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 1,
            gap: '4rem',
            marginLeft: '100px'
          }}
        >
          {/* Left Column: Login Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ width: '100%', maxWidth: '550px', flex: 1.5 }}
          >
            <GlassCard delay={0.3}>
              <motion.div
                style={{ textAlign: 'center', marginBottom: '1.4rem' }}
              >
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '1.8rem',
                    color: '#FFFDD0',
                    textShadow: '0 0 20px rgba(46, 139, 87, 0.5)'
                  }}
                >
                  Welcome Back
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  style={{ color: 'rgba(255, 253, 208, 0.7)', marginTop: '0.3rem', fontSize: '0.9rem' }}
                >
                  Sign in to your ChessHive account
                </motion.p>
              </motion.div>

              {dynamicError && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    background: 'rgba(198, 40, 40, 0.2)',
                    color: '#ff6b6b',
                    padding: '0.8rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    border: '1px solid rgba(198, 40, 40, 0.3)',
                    fontSize: '0.85rem'
                  }}
                >
                  {dynamicError}
                </motion.div>
              )}

              {dynamicSuccess && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    background: 'rgba(46, 139, 87, 0.2)',
                    color: '#2E8B57',
                    padding: '0.8rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    border: '1px solid rgba(46, 139, 87, 0.3)',
                    fontSize: '0.85rem'
                  }}
                >
                  {dynamicSuccess}
                </motion.div>
              )}

              {/* Restore deleted account */}
              {auth.restoreInfo ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    style={{
                      background: 'rgba(255, 193, 7, 0.15)',
                      border: '1px solid rgba(255, 193, 7, 0.3)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      marginBottom: '1.5rem',
                      textAlign: 'center'
                    }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{ fontSize: '3rem', marginBottom: '1rem' }}
                    >
                      ⚠️
                    </motion.div>
                    <h3 style={{ color: '#FFC107', fontFamily: "'Cinzel', serif", marginBottom: '0.5rem' }}>
                      Account Deleted
                    </h3>
                    <p style={{ color: 'rgba(255, 253, 208, 0.8)', fontSize: '0.9rem' }}>
                      This account was previously deleted. Would you like to restore it?
                    </p>
                  </motion.div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <FloatingButton onClick={onRestoreAccount}>
                      {auth.loading ? 'Restoring...' : '✓ Restore Account'}
                    </FloatingButton>
                    <FloatingButton variant="outline" onClick={cancelRestore}>
                      ✕ Cancel
                    </FloatingButton>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={onSubmitLogin}>
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                      style={{ marginBottom: '1.5rem' }}
                    >
                      <label style={labelStyle}>Email</label>
                      <input
                        type="email"
                        required
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => { if (!touched.email) setTouched(s => ({ ...s, email: true })); setEmail(e.target.value); }}
                        onBlur={() => setTouched(s => ({ ...s, email: true }))}
                        style={inputStyle}
                        onFocus={(e) => e.target.style.borderColor = '#2E8B57'}
                      />
                      {emailError && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{emailError}</div>}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      style={{ marginBottom: '1rem' }}
                    >
                      <label style={labelStyle}>Password</label>
                      <input
                        type="password"
                        required
                        placeholder="Enter your password"
                        value={password}
                        onChange={e => { if (!touched.password) setTouched(s => ({ ...s, password: true })); setPassword(e.target.value); }}
                        onBlur={() => setTouched(s => ({ ...s, password: true }))}
                        style={inputStyle}
                        onFocus={(e) => e.target.style.borderColor = '#2E8B57'}
                      />
                      {passwordError && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{passwordError}</div>}
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.75 }}
                      style={{ marginBottom: '2rem', textAlign: 'right' }}
                    >
                      <span
                        onClick={() => navigate('/forgot-password')}
                        style={{
                          color: '#2E8B57',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontFamily: "'Cinzel', serif",
                          transition: 'all 0.3s ease',
                          textDecoration: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.textDecoration = 'underline';
                          e.target.style.textShadow = '0 0 10px rgba(46, 139, 87, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.textDecoration = 'none';
                          e.target.style.textShadow = 'none';
                        }}
                      >
                        Forgot Password?
                      </span>
                    </motion.div>

                    <FloatingButton delay={0.8}>
                      {auth.loading ? 'Logging in...' : 'Login'}
                    </FloatingButton>
                  </>
                </form>
              )}
            </GlassCard>
          </motion.div>

          {/* Right Column: Knight Emblem and Sign Up Button */}
          <motion.div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2.5rem',
              minWidth: '240px',
              flex: 0.8
            }}
          >
            {/* Knight Emblem */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{ 
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <motion.div
                animate={{ rotateY: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{
                  perspective: '1000px',
                  fontSize: '180px',
                  filter: 'drop-shadow(0 0 50px rgba(46, 139, 87, 0.8))'
                }}
              >
                ♘
              </motion.div>
            </motion.div>

            {/* Sign Up Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              style={{
                textAlign: 'center',
                width: '100%'
              }}
            >
              <p style={{ color: 'rgba(255, 253, 208, 0.7)', marginBottom: '0.6rem', fontSize: '0.8rem' }}>
                Don't have an account?
              </p>
              <FloatingButton 
                onClick={() => {
                  navigate('/signup', { state: { swapAnimation: true } });
                }} 
                variant="secondary" 
                delay={1}
              >
                Sign Up
              </FloatingButton>
            </motion.div>
          </motion.div>
        </motion.main>
      </div>
    </AnimatePresence>
  );
}


