import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { signup, verifySignupOtp } from '../features/auth/authSlice';
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard, FloatingButton } from "../components/AnimatedCard";


export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const swapAnimation = location.state?.swapAnimation || false;
  const [form, setForm] = React.useState({ name: "", email: "", dob: "", gender: "", college: "", phone: "", password: "", role: "", aicf_id: "", fide_id: "" });
  const [otp, setOtp] = React.useState("");
  const [errors, setErrors] = React.useState({});
  const [touched, setTouched] = React.useState({});
  const [serverMsg, setServerMsg] = React.useState({ type: "", text: "" });
  const dispatch = useDispatch();
  const auth = useSelector(state => state.auth);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#071327';
    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  const setField = (k, v) => setForm(s => ({ ...s, [k]: v }));

  function validateName(name) { return !!name && /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name); }
  function validateEmail(email) { if (!email || !/^\S+@\S+\.\S+$/.test(email)) return false; if (/[A-Z]/.test(email)) return false; return true; }
  function validateDob(dob) { if (!dob) return false; const d = new Date(dob); if (isNaN(d)) return false; const age = Math.floor((Date.now() - d) / (365.25 * 24 * 60 * 60 * 1000)); return age >= 16; }
  function validateGender(g) { return ['male', 'female', 'other'].includes(g); }
  function validateCollege(c) { return !!c && /^[A-Za-z\s']+$/.test(c); }
  function validatePhone(p) { return /^[0-9]{10}$/.test(p); }
  function validatePassword(p) { return !!p && /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(p); }
  function validateRole(r) { return ['admin', 'organizer', 'coordinator', 'player'].includes(r); }

  function setError(id, msg) { setErrors(s => ({ ...s, [id]: msg })); }

  function validateField(id, value) {
    switch (id) {
      case 'name': return validateName(value) ? '' : 'Valid full name is required';
      case 'email': return validateEmail(value) ? '' : 'Valid email is required (lowercase only)';
      case 'dob': return validateDob(value) ? '' : 'You must be at least 16 years old';
      case 'gender': return validateGender(value) ? '' : 'Gender is required';
      case 'college': return validateCollege(value) ? '' : 'College name is required';
      case 'phone': return validatePhone(value) ? '' : 'Valid 10-digit phone number is required';
      case 'password': return validatePassword(value) ? '' : 'Password must be at least 8 characters with one uppercase, one lowercase, and one special character';
      case 'role': return validateRole(value) ? '' : 'Valid role is required';
      case 'otp': return (!value || value.length !== 6) ? 'Please enter a valid 6-digit OTP' : '';
      default: return '';
    }
  }

  function validateAll() {
    const e = {};
    if (!validateName(form.name)) e.name = 'Valid full name is required';
    if (!validateEmail(form.email)) e.email = 'Valid email is required (lowercase only)';
    if (!validateDob(form.dob)) e.dob = 'You must be at least 16 years old';
    if (!validateGender(form.gender)) e.gender = 'Gender is required';
    if (!validateCollege(form.college)) e.college = 'College name is required';
    if (!validatePhone(form.phone)) e.phone = 'Valid 10-digit phone number is required';
    if (!validatePassword(form.password)) e.password = 'Password requirements not met';
    if (!validateRole(form.role)) e.role = 'Valid role is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setServerMsg({ type: "", text: "" });
    if (!validateAll()) { setServerMsg({ type: "error", text: "Please correct the errors in the form" }); return; }
    try {
      const result = await dispatch(signup(form));
      if (result.meta.requestStatus === 'fulfilled') {
        setServerMsg({ type: "success", text: "OTP sent to your email. Please enter it below." });
      } else {
        const err = result.payload || result.error || {};
        setServerMsg({ type: "error", text: err.message || 'Signup failed' });
      }
    } catch (err) {
      console.error('Signup error:', err);
      setServerMsg({ type: "error", text: 'Failed to connect to server' });
    }
  }

  async function onVerifyOtp(e) {
    e.preventDefault();
    setServerMsg({ type: "", text: "" });
    if (!otp || otp.length !== 6) { setServerMsg({ type: "error", text: "Please enter a valid 6-digit OTP" }); return; }
    try {
      const result = await dispatch(verifySignupOtp({ email: form.email.trim(), otp }));
      if (result.meta.requestStatus === 'fulfilled') {
        const redirectUrl = result.payload?.redirectUrl || '/';
        window.location.href = redirectUrl;
      } else {
        const err = result.payload || result.error || {};
        setServerMsg({ type: "error", text: err.message || 'OTP verification failed' });
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setServerMsg({ type: "error", text: 'Failed to connect to server' });
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '2px solid rgba(46, 139, 87, 0.3)',
    borderRadius: '10px',
    fontSize: '0.95rem',
    color: '#FFFDD0',
    transition: 'all 0.3s ease',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.4rem',
    color: '#FFFDD0',
    fontWeight: '600',
    fontSize: '0.85rem'
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23FFFDD0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 1rem center',
    backgroundSize: '1rem'
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
            padding: '40px 30px 30px 30px',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 1,
            gap: '2rem',
            marginLeft: '100px'
          }}
        >
          {/* Left Column: Emblem and Login Button */}
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
            {/* Pawn Emblem */}
            <motion.div
              initial={{ opacity: 0, x: -100 }}
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
                  fontSize: '200px',
                  filter: 'drop-shadow(0 0 50px rgba(46, 139, 87, 0.8))'
                }}
              >
                ♟
              </motion.div>
            </motion.div>

            {/* Login Button */}
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
                Already have an account?
              </p>
              <FloatingButton onClick={() => navigate('/login', { state: { swapAnimation: true } })} variant="secondary" delay={1}>
                Login
              </FloatingButton>
            </motion.div>
          </motion.div>

          {/* Right Column: Signup Form */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ width: '100%', maxWidth: '720px', paddingBottom: '0', flex: 1.8 }}
          >
            <GlassCard delay={0.3}>
              <motion.div
                style={{ textAlign: 'center', marginBottom: '1.2rem' }}
              >
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: '1.5rem',
                    color: '#FFFDD0',
                    textShadow: '0 0 20px rgba(46, 139, 87, 0.5)'
                  }}
                >
                  Join ChessHive
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  style={{ color: 'rgba(255, 253, 208, 0.7)', marginTop: '0.2rem', fontSize: '0.8rem' }}
                >
                  Create your account and start your chess journey
                </motion.p>
              </motion.div>

              {serverMsg.text && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    background: serverMsg.type === 'success' ? 'rgba(46, 139, 87, 0.2)' : 'rgba(198, 40, 40, 0.2)',
                    color: serverMsg.type === 'success' ? '#2E8B57' : '#ff6b6b',
                    padding: '0.9rem 1rem',
                    borderRadius: '10px',
                    marginBottom: '1.2rem',
                    border: `1px solid ${serverMsg.type === 'success' ? 'rgba(46, 139, 87, 0.3)' : 'rgba(198, 40, 40, 0.3)'}`,
                    fontSize: '0.85rem'
                  }}
                >
                  {serverMsg.text}
                </motion.div>
              )}

              <form onSubmit={auth.otpSent ? onVerifyOtp : onSubmit}>
                {!auth.otpSent ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '1.2rem'
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input
                        type="text"
                        placeholder="Enter full name"
                        required
                        value={form.name}
                        onChange={e => { if (!touched.name) setTouched(s => ({ ...s, name: true })); const v = e.target.value; setField('name', v); setError('name', validateField('name', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, name: true }))}
                        style={inputStyle}
                      />
                      {errors.name && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.name}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>Email ID</label>
                      <input
                        type="email"
                        placeholder="Enter your email"
                        required
                        value={form.email}
                        onChange={e => { if (!touched.email) setTouched(s => ({ ...s, email: true })); const v = e.target.value; setField('email', v); setError('email', validateField('email', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, email: true }))}
                        style={inputStyle}
                      />
                      {errors.email && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.email}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={form.dob}
                        onChange={e => { if (!touched.dob) setTouched(s => ({ ...s, dob: true })); const v = e.target.value; setField('dob', v); setError('dob', validateField('dob', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, dob: true }))}
                        style={inputStyle}
                      />
                      {errors.dob && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.dob}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>Gender</label>
                      <select
                        required
                        value={form.gender}
                        onChange={e => { if (!touched.gender) setTouched(s => ({ ...s, gender: true })); const v = e.target.value; setField('gender', v); setError('gender', validateField('gender', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, gender: true }))}
                        style={selectStyle}
                      >
                        <option value="" disabled>Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      {errors.gender && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.gender}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>College Name</label>
                      <input
                        type="text"
                        placeholder="Enter college name"
                        required
                        value={form.college}
                        onChange={e => { if (!touched.college) setTouched(s => ({ ...s, college: true })); const v = e.target.value; setField('college', v); setError('college', validateField('college', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, college: true }))}
                        style={inputStyle}
                      />
                      {errors.college && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.college}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>Phone Number</label>
                      <input
                        type="text"
                        placeholder="Enter phone number"
                        required
                        value={form.phone}
                        onChange={e => { if (!touched.phone) setTouched(s => ({ ...s, phone: true })); const v = e.target.value.replace(/\D/g, '').slice(0, 10); setField('phone', v); setError('phone', validateField('phone', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, phone: true }))}
                        style={inputStyle}
                      />
                      {errors.phone && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.phone}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>Password</label>
                      <input
                        type="password"
                        placeholder="Enter password"
                        required
                        value={form.password}
                        onChange={e => { if (!touched.password) setTouched(s => ({ ...s, password: true })); const v = e.target.value; setField('password', v); setError('password', validateField('password', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, password: true }))}
                        style={inputStyle}
                      />
                      {errors.password && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.password}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>Select Role</label>
                      <select
                        required
                        value={form.role}
                        onChange={e => { if (!touched.role) setTouched(s => ({ ...s, role: true })); const v = e.target.value; setField('role', v); setError('role', validateField('role', v)); }}
                        onBlur={() => setTouched(s => ({ ...s, role: true }))}
                        style={selectStyle}
                      >
                        <option value="" disabled>Select Role</option>
                        <option value="admin">Admin</option>
                        <option value="organizer">Organizer</option>
                        <option value="coordinator">Coordinator</option>
                        <option value="player">Player</option>
                      </select>
                      {errors.role && <div style={{ color: '#ff6b6b', fontSize: '0.8rem', marginTop: '0.3rem' }}>{errors.role}</div>}
                    </div>

                    <div>
                      <label style={labelStyle}>AICF ID (Optional)</label>
                      <input
                        type="text"
                        placeholder="Enter AICF ID"
                        value={form.aicf_id}
                        onChange={e => setField('aicf_id', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>FIDE ID (Optional)</label>
                      <input
                        type="text"
                        placeholder="Enter FIDE ID"
                        value={form.fide_id}
                        onChange={e => setField('fide_id', e.target.value)}
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <FloatingButton delay={0.8}>
                        {auth.loading ? 'Sending OTP...' : 'Create Account'}
                      </FloatingButton>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={labelStyle}>Enter OTP</label>
                      <input
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        required
                        value={otp}
                        onChange={e => { const v = e.target.value.replace(/\D/g, ''); setOtp(v.slice(0, 6)); }}
                        maxLength="6"
                        style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <FloatingButton>
                        {auth.loading ? 'Verifying...' : 'Verify OTP'}
                      </FloatingButton>
                      <FloatingButton
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          setServerMsg({ type: "", text: "" });
                          dispatch({ type: 'auth/clearError' });
                        }}
                      >
                        Back
                      </FloatingButton>
                    </div>
                  </motion.div>
                )}
              </form>
            </GlassCard>
          </motion.div>
        </motion.main>
      </div>
    </AnimatePresence>
  );
}
