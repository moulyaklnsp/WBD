import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, verifyLoginOtp } from '../features/auth/authSlice';
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard, FloatingButton } from "../components/AnimatedCard";


export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [touched, setTouched] = React.useState({ email: false, password: false, otp: false });
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
  const otpError = touched.otp && (!!otp && otp.length !== 6 ? 'OTP must be 6 digits' : (!otp ? 'OTP is required' : ''));

  async function onSubmitLogin(e) {
    e.preventDefault();
    setDynamicError("");
    if (!validateEmail(email)) { setDynamicError('Valid lowercase email is required'); return; }
    if (!validatePassword(password)) { setDynamicError('Password must be at least 8 characters with one uppercase, one lowercase, and one special character'); return; }
    try {
      const result = await dispatch(login({ email: email.trim(), password }));
      if (result.meta.requestStatus === 'fulfilled') {
        setDynamicSuccess('OTP sent to your email. Please enter it below.');
      } else {
        const err = result.payload || result.error || {};
        setDynamicError(err.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setDynamicError('Failed to connect to server.');
    }
  }

  async function onVerifyOtp(e) {
    e.preventDefault();
    setDynamicError("");
    if (!otp || otp.length !== 6) { setDynamicError('Please enter a valid 6-digit OTP'); return; }
    try {
      const result = await dispatch(verifyLoginOtp({ email: email.trim(), otp }));
      if (result.meta.requestStatus === 'fulfilled') {
        const redirectUrl = result.payload?.redirectUrl || '/';
        window.location.href = redirectUrl;
      } else {
        const err = result.payload || result.error || {};
        setDynamicError(err.message || 'OTP verification failed');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setDynamicError('Failed to connect to server.');
    }
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
        <ChessBackground />
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

              <form onSubmit={auth.otpSent ? onVerifyOtp : onSubmitLogin}>
                {!auth.otpSent ? (
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
                      style={{ marginBottom: '2rem' }}
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

                    <FloatingButton delay={0.8}>
                      {auth.loading ? 'Sending OTP...' : 'Login'}
                    </FloatingButton>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ marginBottom: '2rem' }}
                    >
                      <label style={labelStyle}>Enter OTP</label>
                      <input
                        type="text"
                        required
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={e => { if (!touched.otp) setTouched(s => ({ ...s, otp: true })); setOtp(e.target.value.replace(/\D/g, '')); }}
                        onBlur={() => setTouched(s => ({ ...s, otp: true }))}
                        maxLength="6"
                        style={inputStyle}
                      />
                      {otpError && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{otpError}</div>}
                    </motion.div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <FloatingButton>
                        {auth.loading ? 'Verifying...' : 'Verify OTP'}
                      </FloatingButton>
                      <FloatingButton
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          setDynamicSuccess("");
                          setDynamicError("");
                          dispatch({ type: 'auth/clearError' });
                        }}
                      >
                        Back
                      </FloatingButton>
                    </div>
                  </>
                )}
              </form>
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
