import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { forgotPassword, verifyForgotPasswordOtp, resetPassword, resetForgotPassword } from '../features/auth/authSlice';
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard, FloatingButton } from "../components/AnimatedCard";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector(state => state.auth);
  
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [touched, setTouched] = React.useState({ email: false, otp: false, newPassword: false, confirmPassword: false });
  const [dynamicError, setDynamicError] = React.useState("");
  const [dynamicSuccess, setDynamicSuccess] = React.useState("");

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#071327';
    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  // Reset forgot password state when component mounts
  useEffect(() => {
    dispatch(resetForgotPassword());
  }, [dispatch]);

  // Watch for auth errors
  useEffect(() => {
    if (auth.error) setDynamicError(auth.error);
  }, [auth.error]);

  // Watch for success step
  useEffect(() => {
    if (auth.forgotPasswordStep === 'success') {
      setDynamicSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login?success-message=' + encodeURIComponent('Password reset successful! Please login with your new password.'));
      }, 2000);
    }
  }, [auth.forgotPasswordStep, navigate]);

  function validateEmail(val) {
    if (!val || !/^\S+@\S+\.\S+$/.test(val)) return false;
    if (/[A-Z]/.test(val)) return false;
    return true;
  }

  function validatePassword(val) {
    return !!val && /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(val);
  }

  const emailError = touched.email && !validateEmail(email) ? 'Valid lowercase email is required' : '';
  const otpError = touched.otp && (otp.length !== 6 ? 'OTP must be 6 digits' : '');
  const newPasswordError = touched.newPassword && !validatePassword(newPassword) ? 'Password must be at least 8 characters with one uppercase, one lowercase, and one special character' : '';
  const confirmPasswordError = touched.confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : '';

  async function handleSendOtp(e) {
    e.preventDefault();
    setDynamicError("");
    setDynamicSuccess("");
    if (!validateEmail(email)) { setDynamicError('Valid lowercase email is required'); return; }
    
    try {
      const result = await dispatch(forgotPassword({ email: email.trim().toLowerCase() }));
      if (result.meta.requestStatus === 'fulfilled') {
        setDynamicSuccess('OTP sent to your email. Please check your inbox.');
      } else {
        const err = result.payload || result.error || {};
        setDynamicError(err.message || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setDynamicError('Failed to connect to server.');
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setDynamicError("");
    setDynamicSuccess("");
    if (!otp || otp.length !== 6) { setDynamicError('Please enter a valid 6-digit OTP'); return; }
    
    try {
      const result = await dispatch(verifyForgotPasswordOtp({ email: email.trim().toLowerCase(), otp }));
      if (result.meta.requestStatus === 'fulfilled') {
        setDynamicSuccess('OTP verified! Please enter your new password.');
      } else {
        const err = result.payload || result.error || {};
        setDynamicError(err.message || 'OTP verification failed');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setDynamicError('Failed to connect to server.');
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setDynamicError("");
    setDynamicSuccess("");
    
    if (!validatePassword(newPassword)) {
      setDynamicError('Password must be at least 8 characters with one uppercase, one lowercase, and one special character');
      return;
    }
    if (newPassword !== confirmPassword) {
      setDynamicError('Passwords do not match');
      return;
    }
    
    try {
      const result = await dispatch(resetPassword({ 
        email: email.trim().toLowerCase(), 
        resetToken: auth.resetToken,
        newPassword, 
        confirmPassword 
      }));
      if (result.meta.requestStatus !== 'fulfilled') {
        const err = result.payload || result.error || {};
        setDynamicError(err.message || 'Password reset failed');
      }
    } catch (err) {
      console.error('Reset password error:', err);
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

  const renderStep = () => {
    switch (auth.forgotPasswordStep) {
      case 'email':
        return (
          <form onSubmit={handleSendOtp}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              style={{ marginBottom: '2rem' }}
            >
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                required
                placeholder="Enter your registered email"
                value={email}
                onChange={e => { if (!touched.email) setTouched(s => ({ ...s, email: true })); setEmail(e.target.value); }}
                onBlur={() => setTouched(s => ({ ...s, email: true }))}
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2E8B57'}
              />
              {emailError && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{emailError}</div>}
            </motion.div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <FloatingButton delay={0.7}>
                {auth.loading ? 'Sending OTP...' : 'Send OTP'}
              </FloatingButton>
              <FloatingButton
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/login');
                }}
              >
                Back to Login
              </FloatingButton>
            </div>
          </form>
        );

      case 'otp':
        return (
          <form onSubmit={handleVerifyOtp}>
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
                onFocus={(e) => e.target.style.borderColor = '#2E8B57'}
              />
              {otpError && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{otpError}</div>}
              <p style={{ color: 'rgba(255, 253, 208, 0.6)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                OTP sent to: {email}
              </p>
            </motion.div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <FloatingButton>
                {auth.loading ? 'Verifying...' : 'Verify OTP'}
              </FloatingButton>
              <FloatingButton
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  dispatch(resetForgotPassword());
                  setOtp("");
                  setDynamicSuccess("");
                  setDynamicError("");
                }}
              >
                Back
              </FloatingButton>
            </div>
          </form>
        );

      case 'reset':
        return (
          <form onSubmit={handleResetPassword}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: '1.5rem' }}
            >
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                required
                placeholder="Enter new password"
                value={newPassword}
                onChange={e => { if (!touched.newPassword) setTouched(s => ({ ...s, newPassword: true })); setNewPassword(e.target.value); }}
                onBlur={() => setTouched(s => ({ ...s, newPassword: true }))}
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2E8B57'}
              />
              {newPasswordError && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{newPasswordError}</div>}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ marginBottom: '2rem' }}
            >
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                required
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={e => { if (!touched.confirmPassword) setTouched(s => ({ ...s, confirmPassword: true })); setConfirmPassword(e.target.value); }}
                onBlur={() => setTouched(s => ({ ...s, confirmPassword: true }))}
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#2E8B57'}
              />
              {confirmPasswordError && <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>{confirmPasswordError}</div>}
            </motion.div>

            <FloatingButton>
              {auth.loading ? 'Resetting Password...' : 'Reset Password'}
            </FloatingButton>
          </form>
        );

      case 'success':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center', padding: '2rem 0' }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5 }}
              style={{ fontSize: '4rem', marginBottom: '1rem' }}
            >
              ✓
            </motion.div>
            <h3 style={{ color: '#2E8B57', fontFamily: "'Cinzel', serif", marginBottom: '1rem' }}>
              Password Reset Successful!
            </h3>
            <p style={{ color: 'rgba(255, 253, 208, 0.7)' }}>
              Redirecting to login page...
            </p>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const getStepTitle = () => {
    switch (auth.forgotPasswordStep) {
      case 'email': return 'Forgot Password';
      case 'otp': return 'Verify OTP';
      case 'reset': return 'Reset Password';
      case 'success': return 'Success';
      default: return 'Forgot Password';
    }
  };

  const getStepDescription = () => {
    switch (auth.forgotPasswordStep) {
      case 'email': return 'Enter your email to receive a password reset OTP';
      case 'otp': return 'Enter the OTP sent to your email';
      case 'reset': return 'Create a new password for your account';
      case 'success': return '';
      default: return '';
    }
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
          {/* Left Column: Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ width: '100%', maxWidth: '550px', flex: 1.5 }}
          >
            <GlassCard delay={0.3}>
              <motion.div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
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
                  {getStepTitle()}
                </motion.h2>
                {getStepDescription() && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    style={{ color: 'rgba(255, 253, 208, 0.7)', marginTop: '0.3rem', fontSize: '0.9rem' }}
                  >
                    {getStepDescription()}
                  </motion.p>
                )}
              </motion.div>

              {/* Progress indicator */}
              {auth.forgotPasswordStep !== 'success' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  {['email', 'otp', 'reset'].map((step, idx) => (
                    <div
                      key={step}
                      style={{
                        width: '60px',
                        height: '4px',
                        borderRadius: '2px',
                        background: ['email', 'otp', 'reset'].indexOf(auth.forgotPasswordStep) >= idx
                          ? '#2E8B57'
                          : 'rgba(255, 255, 255, 0.2)',
                        transition: 'background 0.3s ease'
                      }}
                    />
                  ))}
                </div>
              )}

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

              {renderStep()}
            </GlassCard>
          </motion.div>

          {/* Right Column: Key Emblem */}
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
                🔐
              </motion.div>
            </motion.div>

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
                Remember your password?
              </p>
              <FloatingButton 
                onClick={() => navigate('/login')} 
                variant="secondary" 
                delay={1}
              >
                Back to Login
              </FloatingButton>
            </motion.div>
          </motion.div>
        </motion.main>
      </div>
    </AnimatePresence>
  );
}
