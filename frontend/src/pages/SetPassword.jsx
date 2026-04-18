import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import ChessBackground from "../components/ChessBackground";
import AnimatedSidebar from "../components/AnimatedSidebar";
import { GlassCard, FloatingButton } from "../components/AnimatedCard";

export default function SetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("token") || "";
  }, [location.search]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "auto";
    document.body.style.background = "#071327";
    return () => {
      document.body.style.overflow = "";
      document.body.style.background = "";
    };
  }, []);

  const validatePassword = (val) =>
    !!val && /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(val);

  const passwordError =
    touched.password && !validatePassword(password)
      ? "Password must be at least 8 characters with one uppercase, one lowercase, and one special character"
      : "";
  const confirmError =
    touched.confirmPassword && password !== confirmPassword ? "Passwords do not match" : "";

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    if (!token) {
      setStatus({ type: "error", message: "Invite token is missing or invalid." });
      return;
    }
    if (!validatePassword(password)) {
      setStatus({
        type: "error",
        message: "Password must be at least 8 characters with one uppercase, one lowercase, and one special character"
      });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match" });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "error", message: data?.message || "Failed to set password" });
        return;
      }
      setStatus({ type: "success", message: "Password set successfully. Redirecting to login..." });
      setTimeout(() => {
        navigate("/login?success-message=" + encodeURIComponent("Password set successfully. Please login."));
      }, 2000);
    } catch (err) {
      console.error("Set password error:", err);
      setStatus({ type: "error", message: "Failed to connect to server." });
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "1rem 1.2rem",
    background: "rgba(255, 255, 255, 0.1)",
    border: "2px solid rgba(46, 139, 87, 0.3)",
    borderRadius: "12px",
    fontSize: "1rem",
    color: "#FFFDD0",
    transition: "all 0.3s ease",
    outline: "none"
  };

  const labelStyle = {
    display: "block",
    marginBottom: "0.5rem",
    color: "#FFFDD0",
    fontWeight: "600",
    fontSize: "1.1rem",
    fontFamily: "'Cinzel', serif"
  };

  return (
    <AnimatePresence>
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <ChessBackground wallpaperUrl="/images/Gemini_Generated_Image_q5j9ziq5j9ziq5j9.png" />
        <AnimatedSidebar />

        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            padding: "40px 40px 30px 40px",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            zIndex: 1,
            gap: "4rem",
            marginLeft: "100px"
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{ width: "100%", maxWidth: "550px", flex: 1.5 }}
          >
            <GlassCard delay={0.3}>
              <motion.div style={{ textAlign: "center", marginBottom: "1.4rem" }}>
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: "1.8rem",
                    color: "#FFFDD0",
                    textShadow: "0 0 20px rgba(46, 139, 87, 0.5)"
                  }}
                >
                  Set Your Password
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  style={{ color: "rgba(255, 253, 208, 0.7)", marginTop: "0.3rem", fontSize: "0.9rem" }}
                >
                  Create a secure password to activate your admin account
                </motion.p>
              </motion.div>

              {status.message && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{
                    background: status.type === "success" ? "rgba(46, 139, 87, 0.2)" : "rgba(198, 40, 40, 0.2)",
                    color: status.type === "success" ? "#2E8B57" : "#ff6b6b",
                    padding: "0.8rem 1rem",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    border:
                      status.type === "success"
                        ? "1px solid rgba(46, 139, 87, 0.3)"
                        : "1px solid rgba(198, 40, 40, 0.3)",
                    fontSize: "0.85rem"
                  }}
                >
                  {status.message}
                </motion.div>
              )}

              <form onSubmit={handleSubmit}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  style={{ marginBottom: "1.5rem" }}
                >
                  <label style={labelStyle}>New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => {
                      if (!touched.password) setTouched((s) => ({ ...s, password: true }));
                      setPassword(e.target.value);
                    }}
                    onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#2E8B57")}
                  />
                  {passwordError && (
                    <div style={{ color: "#ff6b6b", fontSize: "0.9rem", marginTop: "0.5rem" }}>{passwordError}</div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  style={{ marginBottom: "2rem" }}
                >
                  <label style={labelStyle}>Confirm Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      if (!touched.confirmPassword) setTouched((s) => ({ ...s, confirmPassword: true }));
                      setConfirmPassword(e.target.value);
                    }}
                    onBlur={() => setTouched((s) => ({ ...s, confirmPassword: true }))}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = "#2E8B57")}
                  />
                  {confirmError && (
                    <div style={{ color: "#ff6b6b", fontSize: "0.9rem", marginTop: "0.5rem" }}>{confirmError}</div>
                  )}
                </motion.div>

                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <FloatingButton>{loading ? "Setting Password..." : "Set Password"}</FloatingButton>
                  <FloatingButton
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      navigate("/login");
                    }}
                  >
                    Back to Login
                  </FloatingButton>
                </div>
              </form>
            </GlassCard>
          </motion.div>

          <motion.div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2.5rem",
              minWidth: "240px",
              flex: 0.8
            }}
          >
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center"
              }}
            >
              <motion.div
                animate={{ rotateY: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{
                  perspective: "1000px",
                  fontSize: "180px",
                  filter: "drop-shadow(0 0 50px rgba(46, 139, 87, 0.8))"
                }}
              >
                &#128273;
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.main>
      </div>
    </AnimatePresence>
  );
}
