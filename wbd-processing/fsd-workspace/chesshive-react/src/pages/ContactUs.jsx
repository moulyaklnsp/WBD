import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard, FloatingButton } from "../components/AnimatedCard";

export default function ContactUs() {
  const MAX_WORDS = 200;
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [errors, setErrors] = React.useState({ name: "", email: "", message: "" });
  const [success, setSuccess] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [wordCount, setWordCount] = React.useState(0);
  const [touched, setTouched] = React.useState({ name: false, email: false, message: false });
  const [hoveredSocial, setHoveredSocial] = React.useState(null);
  const iconRefs = React.useRef({});
  const [sidebarPos, setSidebarPos] = React.useState({ left: null, top: null });

  const socialLinks = [
    { id: 'facebook', icon: 'fab fa-facebook-f', name: 'Facebook', username: 'ChessHive', url: 'https://facebook.com/chesshive' },
    { id: 'twitter', icon: 'fab fa-twitter', name: 'Twitter', username: '@ChessHiveOfficial', url: 'https://twitter.com/chesshive' },
    { id: 'instagram', icon: 'fab fa-instagram', name: 'Instagram', username: '@ChessHive', url: 'https://instagram.com/chesshive' }
  ];

  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.background = '#071327';
    return () => {
      document.body.style.overflow = '';
      document.body.style.background = '';
    };
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successMsg = params.get('success-message');
    const errorMsg = params.get('error-message');
    if (successMsg) setSuccess(successMsg);
    else if (errorMsg) setSuccess(errorMsg);
  }, []);

  function validate() {
    const e = { name: "", email: "", message: "" };
    const nameTrim = name.trim();
    const emailTrim = email.trim();
    const messageTrim = message.trim();
    const namePattern = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!nameTrim) e.name = 'Name is required.';
    else if (!namePattern.test(nameTrim)) e.name = 'Name should only contain letters, spaces, or hyphens.';

    if (!emailTrim) e.email = 'Email is required.';
    else if (!emailPattern.test(emailTrim)) e.email = 'Please enter a valid email address.';

    const words = (messageTrim.match(/\b\w+\b/g) || []);
    if (!messageTrim) e.message = 'Message cannot be empty.';
    else if (words.length > MAX_WORDS) e.message = `Message cannot exceed ${MAX_WORDS} words.`;

    setErrors(e);
    return !e.name && !e.email && !e.message;
  }

  function handleMessageChange(e) {
    const val = e.target.value;
    const wc = (val.trim().match(/\b\w+\b/g) || []).length;
    setWordCount(wc);
    setMessage(val);

    setErrors(prev => ({
      ...prev,
      message: wc > MAX_WORDS ? `Message cannot exceed ${MAX_WORDS} words.` : ""
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSuccess("");
    setErrors({ name: "", email: "", message: "" });

    if (!validate()) {
      setSubmitting(false);
      return;
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.7rem 1rem',
    background: 'rgba(239,211,195,0.06)',
    border: '2px solid rgba(11,79,108,0.14)',
    borderRadius: '12px',
    fontSize: '0.95rem',
    color: 'var(--on-dark)',
    transition: 'all 0.3s ease',
    outline: 'none',
    fontFamily: "'Playfair Display', serif"
  }; 

  const labelStyle = {
    display: 'block',
    marginBottom: '0.3rem',
    color: 'var(--on-dark)',
    fontWeight: '600',
    fontSize: '0.95rem',
    fontFamily: "'Cinzel', serif"
  };

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <ChessBackground />
      <AnimatedSidebar />

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          padding: '20px 30px 20px 20px',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          position: 'relative',
          zIndex: 1,
          gap: '2rem',
          marginLeft: '100px',
          width: 'calc(100% - 100px)',
          boxSizing: 'border-box',
          overflow: 'visible',
          paddingTop: '60px'
        }}
      >

        {/* LEFT SIDE FORM */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{ width: '100%', maxWidth: '700px', flex: 1.5, minWidth: '300px' }}
        >
          <GlassCard delay={0.3}>
            <motion.div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}
              >
                ✉️
              </motion.div>

              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{
                  fontFamily: "'Cinzel', serif",
                  fontSize: '1.4rem',
                  color: 'var(--on-dark)',
                  textShadow: '0 0 18px rgba(11,79,108,0.22)',
                  marginBottom: '0.3rem'
                }} 
              >
                Get in Touch
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{ color: 'var(--muted-on-dark)', marginTop: '0.2rem', fontSize: '0.85rem' }}
              >
                Have questions? We'd love to hear from you.
              </motion.p>
            </motion.div>

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: success.includes('Failed') ? 'rgba(198, 40, 40, 0.2)' : 'rgba(46, 139, 87, 0.2)',
                  color: success.includes('Failed') ? '#ff6b6b' : '#2E8B57',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '10px',
                  marginBottom: '0.8rem',
                  textAlign: 'center',
                  border: `1px solid ${success.includes('Failed') ? 'rgba(198, 40, 40, 0.3)' : 'rgba(46, 139, 87, 0.3)'}`,
                  fontSize: '0.85rem'
                }}
              >
                {success}
              </motion.div>
            )}

            {/* FORM */}
            <form onSubmit={onSubmit}>

              {/* NAME FIELD */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{ marginBottom: '0.8rem' }}
              >
                <label style={labelStyle}>Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={name}
                  onChange={e => {
                    if (!touched.name) setTouched(s => ({ ...s, name: true }));
                    const v = e.target.value;
                    setName(v);
                    const namePattern = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
                    const err = !v.trim() ? 'Name is required.' :
                      (!namePattern.test(v.trim()) ? 'Name should only contain letters, spaces, or hyphens.' : '');
                    setErrors(prev => ({ ...prev, name: err }));
                  }}
                  onBlur={() => setTouched(s => ({ ...s, name: true }))}
                  style={inputStyle}
                />
                {errors.name && (
                  <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {errors.name}
                  </div>
                )}
              </motion.div>

              {/* EMAIL FIELD */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                style={{ marginBottom: '0.8rem' }}
              >
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => {
                    if (!touched.email) setTouched(s => ({ ...s, email: true }));
                    const v = e.target.value;
                    setEmail(v);
                    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                    const err = !v.trim() ? 'Email is required.' :
                      (!emailPattern.test(v.trim()) ? 'Please enter a valid email address.' : '');
                    setErrors(prev => ({ ...prev, email: err }));
                  }}
                  onBlur={() => setTouched(s => ({ ...s, email: true }))}
                  style={inputStyle}
                />
                {errors.email && (
                  <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {errors.email}
                  </div>
                )}
              </motion.div>

              {/* MESSAGE FIELD */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                style={{ marginBottom: '0.8rem' }}
              >
                <label style={labelStyle}>Message</label>
                <textarea
                  required
                  placeholder="Type your message here..."
                  value={message}
                  onChange={handleMessageChange}
                  style={{
                    ...inputStyle,
                    minHeight: '100px',
                    resize: 'vertical'
                  }}
                />
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: '0.9rem',
                    marginTop: '0.5rem',
                    color: wordCount > MAX_WORDS ? '#ff6b6b' : 'rgba(255, 253, 208, 0.6)'
                  }}
                >
                  Words: {wordCount}/{MAX_WORDS}
                </div>
                {errors.message && (
                  <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                    {errors.message}
                  </div>
                )}
              </motion.div>

              {/* SUBMIT BUTTON */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <FloatingButton delay={0}>
                  {submitting ? 'Sending...' : 'Send Message'}
                </FloatingButton>
              </motion.div>
            </form>
          </GlassCard>
        </motion.div>

        {/* =========================
            RIGHT SIDE — SOCIAL LINKS
        ========================== */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flex: 0.7,
            minWidth: '450px',
            maxWidth: '500px',
            paddingTop: '0px',
            paddingLeft: '0px',
            position: 'relative',
            height: '100vh'
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              textAlign: 'center',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <h3
              style={{
                fontFamily: "'Cinzel', serif",
                color: '#87CEEB',
                marginBottom: '1.5rem',
                fontSize: '1.2rem',
                textAlign: 'center',
                position: 'absolute',
                top: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%'
              }}
            >
              Other Ways to Reach Us
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '3rem',
                width: '100%',
                position: 'relative',
                paddingLeft: '0px'
              }}
            >
              {socialLinks.map((social) => (
                <motion.div
                  key={social.id}
                  ref={el => { iconRefs.current[social.id] = el }}
                  onMouseEnter={() => setHoveredSocial(social.id)}
                  onMouseLeave={() => setHoveredSocial(null)}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingLeft: '0px',
                    minWidth: '220px',
                    height: '60px'
                  }}
                >
                  <motion.a
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    whileHover={{ scale: 1.15 }}
                    style={{
                      color: '#FFFDD0',
                      textDecoration: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.6rem',
                      zIndex: 10,
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background:
                          social.id === 'facebook'
                            ? 'linear-gradient(135deg, #1877F2 0%, #0A66C2 100%)'
                            : social.id === 'twitter'
                            ? 'linear-gradient(135deg, #000000 0%, #1a1a1a 100%)'
                            : 'linear-gradient(135deg, #E1306C 0%, #FD1D1D 50%, #F77737 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        border: '2px solid rgba(46, 139, 87, 0.4)',
                        transition: 'all 0.3s ease',
                        boxShadow:
                          social.id === 'facebook'
                            ? '0 0 20px rgba(24, 119, 242, 0.4)'
                            : social.id === 'twitter'
                            ? '0 0 20px rgba(0, 0, 0, 0.4)'
                            : '0 0 20px rgba(225, 48, 108, 0.4)',
                        cursor: 'pointer'
                      }}
                    >
                      <i className={social.icon}></i>
                    </div>
                    <span style={{ fontSize: '0.9rem' }}>{social.name}</span>
                  </motion.a>

                  {/* -----------------------------------------
                      FIXED SIDEBAR BESIDE ICON (UPDATED)
                  ------------------------------------------*/}
                  <AnimatePresence>
                    {hoveredSocial === social.id && (
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.22 }}
                        style={{
                          position: "absolute",
                          left: "200px",
                          top: "-25%",
                          transform: "translateY(-50%)",

                          background:
                            social.id === "facebook"
                              ? "rgba(24,119,242,0.20)"
                              : social.id === "twitter"
                              ? "rgba(0,0,0,0.35)"
                              : "rgba(225,48,108,0.20)",

                          backdropFilter: "blur(10px)",
                          WebkitBackdropFilter: "blur(10px)",

                          border:
                            social.id === "facebook"
                              ? "1.5px solid rgba(24,119,242,0.6)"
                              : social.id === "twitter"
                              ? "1.5px solid rgba(255,255,255,0.6)"
                              : "1.5px solid rgba(225,48,108,0.6)",

                          borderRadius: "12px",
                          padding: "0.9rem 1.2rem",
                          minWidth: "180px",
                          color: "#FFFDD0",
                          zIndex: 200,
                          boxShadow:
                            social.id === "facebook"
                              ? "0 8px 25px rgba(24,119,242,0.35)"
                              : social.id === "twitter"
                              ? "0 8px 25px rgba(0,0,0,0.5)"
                              : "0 8px 25px rgba(225,48,108,0.45)",
                        }}
                        onMouseEnter={() => setHoveredSocial(social.id)}
                        onMouseLeave={() => setHoveredSocial(null)}
                      >
                        <p
                          style={{
                            fontSize: "0.85rem",
                            fontFamily: "'Cinzel', serif",
                            fontWeight: "600",
                            marginBottom: "0.3rem",
                            color:
                              social.id === "facebook"
                                ? "#1877F2"
                                : social.id === "twitter"
                                ? "#ffffff"
                                : "#E1306C",
                          }}
                        >
                          {social.name}
                        </p>

                        <p
                          style={{
                            fontSize: "0.92rem",
                            marginBottom: "0.6rem",
                            fontWeight: "600",
                            fontFamily: "'Playfair Display', serif",
                          }}
                        >
                          {social.username}
                        </p>

                        <motion.a
                          href={social.url}
                          target="_blank"
                          rel="noreferrer"
                          whileHover={{ scale: 1.05 }}
                          style={{
                            padding: "0.45rem 0.8rem",
                            borderRadius: "8px",
                            textDecoration: "none",
                            fontSize: "0.85rem",
                            color: "#FFFDD0",

                            background:
                              social.id === "facebook"
                                ? "rgba(24,119,242,0.45)"
                                : social.id === "twitter"
                                ? "rgba(0,0,0,0.45)"
                                : "rgba(225,48,108,0.45)",

                            border:
                              social.id === "facebook"
                                ? "1px solid rgba(24,119,242,0.7)"
                                : social.id === "twitter"
                                ? "1px solid rgba(255,255,255,0.7)"
                                : "1px solid rgba(225,48,108,0.7)",
                          }}
                        >
                          Visit Profile
                        </motion.a>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </motion.main>
    </div>
  );
}
