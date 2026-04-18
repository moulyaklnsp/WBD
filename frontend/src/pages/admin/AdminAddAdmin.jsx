import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { fetchAsAdmin } from "../../utils/fetchWithRole";
import { getStoredUser } from "../../utils/tokenManager";
import usePlayerTheme from "../../hooks/usePlayerTheme";
import AnimatedSidebar from "../../components/AnimatedSidebar";
import "../../styles/playerNeoNoir.css";

const AdminAddAdmin = () => {
  const [isDark, toggleTheme] = usePlayerTheme();
  const navigate = useNavigate();
  const storedUser = useMemo(() => getStoredUser(), []);
  const isSuperAdmin = Boolean(storedUser?.isSuperAdmin);

  const [form, setForm] = useState({ name: "", email: "" });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteMeta, setInviteMeta] = useState({ expiresAt: "", emailDelivery: null });
  const [loading, setLoading] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  const displayInviteUrl =
    inviteUrl && inviteUrl.startsWith("http")
      ? inviteUrl
      : inviteUrl
      ? `${window.location.origin}${inviteUrl}`
      : "";

  const adminLinks = [
    { path: "/admin/organizer_management", label: "Manage Organizers", icon: "fas fa-users-cog" },
    { path: "/admin/coordinator_management", label: "Manage Coordinators", icon: "fas fa-user-tie" },
    { path: "/admin/player_management", label: "Manage Players", icon: "fas fa-user-tie" },
    { path: "/admin/admin_tournament_management", label: "Tournament Approvals", icon: "fas fa-trophy" },
    { path: "/admin/payments", label: "Payments & Subscriptions", icon: "fas fa-money-bill-wave" },
    { path: "/admin/growth_analytics", label: "Growth Analytics", icon: "fas fa-chart-area" }
  ];

  const validateEmail = (email) => !!email && /^\S+@\S+\.\S+$/.test(email);
  const validateName = (name) => !!name && /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name);

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: "", message: "" });
    setInviteUrl("");
    setInviteMeta({ expiresAt: "", emailDelivery: null });
    setCopyMsg("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!validateName(name)) {
      setStatus({ type: "error", message: "Valid full name is required" });
      return;
    }
    if (!validateEmail(email)) {
      setStatus({ type: "error", message: "Valid email is required" });
      return;
    }

    try {
      setLoading(true);
      const res = await fetchAsAdmin("/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "error", message: data?.message || "Failed to create invite" });
        return;
      }
      setStatus({ type: "success", message: "Invite created successfully." });
      setInviteUrl(data?.inviteUrl || "");
      setInviteMeta({
        expiresAt: data?.inviteExpires || "",
        emailDelivery: data?.emailDelivery || null
      });
      setForm({ name: "", email: "" });
    } catch (err) {
      console.error("Create admin invite error:", err);
      const msg = err?.data?.message || err?.message || "Something went wrong";
      setStatus({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!displayInviteUrl) return;
    try {
      await navigator.clipboard.writeText(displayInviteUrl);
      setCopyMsg("Invite link copied to clipboard");
      setTimeout(() => setCopyMsg(""), 2000);
    } catch (err) {
      setCopyMsg("Copy failed. Please copy the link manually.");
    }
  }

  return (
    <div className="page player-neo" style={{ minHeight: "100vh", display: "flex", width: "100%" }}>
      <style>{`
        .input {
          width: 100%;
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          color: var(--text-color);
        }
        .view-more-btn {
          background: transparent;
          border: 1px solid var(--sea-green);
          color: var(--sea-green);
          padding: 0.5rem 1.5rem;
          border-radius: 20px;
          cursor: pointer;
          font-family: 'Cinzel', serif;
          transition: all 0.3s ease;
        }
        .view-more-btn:hover {
          background: var(--sea-green);
          color: var(--on-accent);
        }
        .view-more-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
      <AnimatedSidebar links={adminLinks} logo={<i className="fas fa-chess-king" />} title="ChessHive" />

      <div className="content" style={{ padding: "2rem", width: "100%", marginLeft: "0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              style={{ margin: 0, fontFamily: "Cinzel, serif", color: "var(--sea-green)" }}
            >
              Add Admin
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              style={{ color: "var(--text-color)", opacity: 0.7, marginTop: "0.5rem" }}
            >
              Invite a new admin and send them a secure setup link
            </motion.p>
          </div>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              className="theme-toggle-btn"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "1px solid var(--card-border)",
                background: "var(--card-bg)",
                color: "var(--text-color)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <i className={isDark ? "fas fa-sun" : "fas fa-moon"} />
            </motion.button>
          </div>
        </div>

        {!isSuperAdmin ? (
          <div
            style={{
              background: "var(--card-bg)",
              borderRadius: "16px",
              border: "1px solid var(--card-border)",
              padding: "2rem",
              maxWidth: "640px"
            }}
          >
            <h3 style={{ marginTop: 0, color: "var(--sea-green)" }}>Super Admin Access Required</h3>
            <p style={{ opacity: 0.8 }}>
              You do not have permission to invite new admins. Please contact a super admin.
            </p>
            <button className="view-more-btn" onClick={() => navigate("/admin/admin_dashboard")}>
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div
            style={{
              background: "var(--card-bg)",
              borderRadius: "16px",
              border: "1px solid var(--card-border)",
              padding: "2rem",
              maxWidth: "720px"
            }}
          >
            {status.message && (
              <div
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
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem" }}>Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Enter full name"
                  className="input"
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.4rem" }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="Enter email address"
                  className="input"
                />
              </div>

              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <button className="view-more-btn" disabled={loading} type="submit">
                  {loading ? "Creating Invite..." : "Create Invite"}
                </button>
                <button
                  className="view-more-btn"
                  type="button"
                  onClick={() => navigate("/admin/admin_dashboard")}
                >
                  Back to Dashboard
                </button>
              </div>
            </form>

            {inviteUrl && (
              <div style={{ marginTop: "1.5rem" }}>
                <h4 style={{ marginBottom: "0.5rem", color: "var(--sea-green)" }}>Invite Link</h4>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                  <input className="input" readOnly value={displayInviteUrl} style={{ flex: "1 1 260px" }} />
                  <button className="view-more-btn" type="button" onClick={handleCopy}>
                    Copy Link
                  </button>
                </div>
                {copyMsg && <div style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>{copyMsg}</div>}
                {inviteMeta.expiresAt && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
                    Expires: {new Date(inviteMeta.expiresAt).toLocaleString()}
                  </div>
                )}
                {inviteMeta.emailDelivery?.attempted && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.7 }}>
                    Email delivery: {inviteMeta.emailDelivery.sent ? "sent" : "not sent"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAddAdmin;
