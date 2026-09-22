"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { 
  Settings, User, Shield, Clock, Server, 
  Bell, Key, Database, Activity, Lock,
  Smartphone, Monitor, Globe, Mail, QrCode, X, CheckCircle
} from "lucide-react";
import { formatDateTime } from "@/lib/formatters";

export default function SettingsPage() {
  const [user, setUser] = useState<{
    id: string;
    username: string;
    email: string;
    role: string;
    last_login: string | null;
  } | null>(null);

  const [serverCount, setServerCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("profile");

  // Modals State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyConfig, setPolicyConfig] = useState({
    minLength: 12,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: true
  });

  // New States
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState({
    two_factor_enabled: false,
    session_timeout_minutes: 60,
    enforce_password_policy: true,
  });
  const [notificationPrefs, setNotificationPrefs] = useState<any>(null);

  useEffect(() => {
    // Basic info
    api.get("/auth/me").then(r => setUser(r.data)).catch(() => {
      try {
        const stored = localStorage.getItem("user");
        if (stored) setUser(JSON.parse(stored));
      } catch { }
      setError("Could not load live user data. Showing cached info.");
    });
    api.get("/servers").then(r => setServerCount(r.data.length)).catch(() => { });

    // Fetch new settings
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const keysRes = await api.get("/settings/apikeys");
      setApiKeys(keysRes.data);

      const secRes = await api.get("/settings/security");
      setSecuritySettings(secRes.data);

      const notifRes = await api.get("/settings/notifications");
      setNotificationPrefs(notifRes.data.preferences);
    } catch (e) {
      console.error("Failed to fetch settings", e);
    }
  };

  const generateApiKey = async () => {
    try {
      const name = prompt("Enter a name for the new API Key:");
      if (!name) return;
      const res = await api.post("/settings/apikeys", { name });
      alert(`Key generated successfully! \n\nRAW KEY (Save this now, you won't see it again):\n${res.data.raw_key}`);
      fetchSettings();
    } catch (e) {
      alert("Failed to generate API Key.");
    }
  };

  const revokeApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this key? Any integrations using it will fail.")) return;
    try {
      await api.delete(`/settings/apikeys/${id}`);
      fetchSettings();
    } catch (e) {
      alert("Failed to revoke API Key.");
    }
  };

  const saveSecurity = async (newSettings = securitySettings) => {
    try {
      await api.put("/settings/security", newSettings);
      setSuccess("Security settings saved!");
      setTimeout(() => setSuccess(""), 3000);
      setSecuritySettings(newSettings);
    } catch (e) {
      alert("Failed to save security settings.");
    }
  };

  const saveNotifications = async () => {
    try {
      await api.put("/settings/notifications", { preferences: notificationPrefs });
      setSuccess("Notification preferences saved!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      alert("Failed to save notification preferences.");
    }
  };

  const verify2FA = () => {
    if (twoFactorCode.length !== 6) {
      alert("Please enter a valid 6-digit code.");
      return;
    }
    const newSettings = { ...securitySettings, two_factor_enabled: true };
    saveSecurity(newSettings);
    setShow2FAModal(false);
    setTwoFactorCode("");
  };

  const disable2FA = () => {
    if(confirm("Are you sure you want to disable 2FA? This will reduce your account security.")) {
      const newSettings = { ...securitySettings, two_factor_enabled: false };
      saveSecurity(newSettings);
    }
  };

  const savePolicy = () => {
    const newSettings = { ...securitySettings, enforce_password_policy: true };
    saveSecurity(newSettings);
    setShowPolicyModal(false);
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: <User size={16} /> },
    { id: "security", label: "Security", icon: <Lock size={16} /> },
    { id: "notifications", label: "Notifications", icon: <Bell size={16} /> },
    { id: "api-keys", label: "API Keys", icon: <Key size={16} /> },
    { id: "system", label: "System Config", icon: <Server size={16} /> }
  ];

  return (
    <div className="fade-in" style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "32px", animation: "fadeInDown 0.4s ease-out", position: "relative" }}>
      
      {/* 2FA Setup Modal */}
      {show2FAModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "400px", padding: "24px", display: "flex", flexDirection: "column", gap: "24px", animation: "fadeInDown 0.3s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Smartphone size={20} className="text-blue" /> Setup Two-Factor Auth
              </h3>
              <button onClick={() => setShow2FAModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20}/></button>
            </div>
            
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Scan this QR code with Google Authenticator or Authy to set up your device.</p>
              <div style={{ padding: "16px", background: "#fff", borderRadius: "var(--radius-md)" }}>
                <QrCode size={120} color="#000" />
              </div>
              <code style={{ fontSize: "12px", background: "var(--bg-input)", padding: "8px", borderRadius: "4px", color: "var(--text-primary)" }}>JBSWY3DPEHPK3PXP</code>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Verification Code</label>
              <input 
                type="text" 
                placeholder="000000" 
                maxLength={6}
                value={twoFactorCode}
                onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)", padding: "12px", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "18px", letterSpacing: "8px", textAlign: "center", outline: "none" }}
              />
            </div>

            <button onClick={verify2FA} style={{ padding: "12px", background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontWeight: 600, cursor: "pointer" }}>
              Verify & Enable 2FA
            </button>
          </div>
        </div>
      )}

      {/* Password Policy Modal */}
      {showPolicyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "400px", padding: "24px", display: "flex", flexDirection: "column", gap: "24px", animation: "fadeInDown 0.3s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Lock size={20} className="text-blue" /> Configure Password Policy
              </h3>
              <button onClick={() => setShowPolicyModal(false)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={20}/></button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>Minimum Length</span>
                <input type="number" value={policyConfig.minLength} onChange={e => setPolicyConfig({...policyConfig, minLength: parseInt(e.target.value)})} style={{ width: "60px", padding: "6px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)" }} />
              </div>
              
              {[
                { label: "Require Uppercase Letters", key: "requireUppercase" },
                { label: "Require Numbers", key: "requireNumbers" },
                { label: "Require Symbols", key: "requireSymbols" }
              ].map(opt => (
                <label key={opt.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>{opt.label}</span>
                  <div style={{
                    width: "36px", height: "20px", borderRadius: "10px", 
                    background: policyConfig[opt.key as keyof typeof policyConfig] ? "var(--color-blue)" : "var(--bg-input)",
                    border: `1px solid ${policyConfig[opt.key as keyof typeof policyConfig] ? "var(--color-blue)" : "var(--border)"}`,
                    position: "relative", transition: "all 0.2s"
                  }}>
                    <div style={{
                      width: "14px", height: "14px", borderRadius: "50%", background: "#fff",
                      position: "absolute", top: "2px", left: policyConfig[opt.key as keyof typeof policyConfig] ? "18px" : "2px",
                      transition: "all 0.2s"
                    }} />
                  </div>
                  <input type="checkbox" hidden checked={!!policyConfig[opt.key as keyof typeof policyConfig]} onChange={e => setPolicyConfig({...policyConfig, [opt.key]: e.target.checked})} />
                </label>
              ))}
            </div>

            <button onClick={savePolicy} style={{ padding: "12px", background: "var(--color-blue)", color: "#fff", border: "none", borderRadius: "var(--radius-md)", fontWeight: 600, cursor: "pointer", marginTop: "8px" }}>
              Save & Enforce Policy
            </button>
          </div>
        </div>
      )}

      {/* Page Header with Glassmorphism */}
      <div style={{
        background: "linear-gradient(145deg, rgba(30,42,63,0.6) 0%, rgba(17,24,39,0.8) 100%)",
        backdropFilter: "blur(12px)",
        borderRadius: "var(--radius-xl)",
        padding: "32px",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "var(--shadow-lg)",
        display: "flex",
        alignItems: "center",
        gap: "24px",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute",
          top: "-50%", right: "-10%",
          width: "300px", height: "300px",
          background: "radial-gradient(circle, var(--color-blue) 0%, transparent 70%)",
          opacity: 0.15,
          filter: "blur(40px)",
          borderRadius: "50%"
        }} />

        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--color-blue), var(--color-purple))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, fontWeight: 800, color: "#fff", flexShrink: 0,
          boxShadow: "0 8px 32px rgba(59,130,246,0.4), inset 0 -4px 12px rgba(0,0,0,0.2)"
        }}>
          {user ? user.username.charAt(0).toUpperCase() : <Settings size={32} />}
        </div>
        
        <div style={{ zIndex: 1 }}>
          <h1 style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", marginBottom: "4px" }}>
            {user ? `Welcome back, ${user.username}` : "Settings & Configuration"}
          </h1>
          <p style={{ fontSize: "16px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Shield size={16} className={user?.role === "admin" ? "text-critical" : "text-info"} />
            {user ? `Enterprise ${user.role.charAt(0).toUpperCase() + user.role.slice(1)} Account` : "Manage your enterprise environment"}
          </p>
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-banner-warning" style={{ borderRadius: "var(--radius-md)", animation: "fadeInDown 0.3s" }}>
          <Bell size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="alert-banner" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid var(--color-healthy)", color: "var(--color-healthy)", borderRadius: "var(--radius-md)", animation: "fadeInDown 0.3s", display: "flex", alignItems: "center", gap: 8, padding: 16 }}>
          <Activity size={16} /> {success}
        </div>
      )}

      {/* Main Content Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "32px", alignItems: "start" }}>
        
        {/* Sidebar Navigation */}
        <div style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          position: "sticky",
          top: "80px",
          boxShadow: "var(--shadow-sm)"
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 16px",
                background: activeTab === tab.id ? "var(--bg-active)" : "transparent",
                color: activeTab === tab.id ? "var(--color-blue)" : "var(--text-secondary)",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                textAlign: "left",
                transition: "all 0.2s ease-out",
                boxShadow: activeTab === tab.id ? "inset 3px 0 0 var(--color-blue)" : "none"
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) e.currentTarget.style.background = "transparent";
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {activeTab === "profile" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <User size={18} className="text-blue" /> Personal Information
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Your personal details and identity within the platform.</p>
                </div>
                
                {user ? (
                  <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
                    <DataGroup label="Full Name" value={user.username} icon={<User size={14}/>} />
                    <DataGroup label="Email Address" value={user.email || "Not provided"} icon={<Mail size={14}/>} />
                    <DataGroup label="Account Role" value={
                      <span className={`badge ${user.role === "admin" ? "badge-critical" : "badge-info"}`} style={{ fontSize: "12px", padding: "4px 10px" }}>
                        {user.role.toUpperCase()}
                      </span>
                    } icon={<Shield size={14}/>} />
                    <DataGroup label="User ID" value={<code style={{ color: "var(--text-code)", background: "rgba(165,243,252,0.1)", padding: "2px 6px", borderRadius: "4px" }}>{user.id}</code>} icon={<Database size={14}/>} />
                    <DataGroup label="Last Login" value={formatDateTime(user.last_login)} icon={<Clock size={14}/>} />
                    <DataGroup label="Account Status" value={<span style={{ color: "var(--color-healthy)", display: "flex", alignItems: "center", gap: "6px" }}><div className="live-dot" style={{ width: 8, height: 8 }}/> Active</span>} icon={<Activity size={14}/>} />
                  </div>
                ) : (
                  <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div className="skeleton skeleton-text" style={{ width: "30%", height: "24px" }} />
                    <div className="skeleton skeleton-text" style={{ width: "50%", height: "24px" }} />
                    <div className="skeleton skeleton-text" style={{ width: "40%", height: "24px" }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Server size={18} className="text-purple" /> System Configuration
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Global platform settings and infrastructure statistics.</p>
                </div>
                <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
                  <DataGroup label="Platform Version" value="v2.5.0-enterprise" icon={<Activity size={14}/>} />
                  <DataGroup label="Data Center" value="us-east-1 (Primary)" icon={<Globe size={14}/>} />
                  <DataGroup label="Monitored Servers" value={serverCount !== null ? `${serverCount} Active Nodes` : "Loading..."} icon={<Server size={14}/>} />
                  <DataGroup label="Deployment Mode" value="High Availability (HA)" icon={<Database size={14}/>} />
                  <DataGroup label="System Timezone" value="Coordinated Universal Time (UTC)" icon={<Clock size={14}/>} />
                  <DataGroup label="Client Platform" value={navigator.userAgent.includes("Win") ? "Windows NT" : "macOS / Unix"} icon={<Monitor size={14}/>} />
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Shield size={18} className="text-critical" /> Security & Access
                    </h2>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Manage authentication methods and security policies.</p>
                  </div>
                </div>
                
                <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* Two Factor Auth Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Two-Factor Authentication (2FA)</div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                        {securitySettings.two_factor_enabled ? "Your account is secured with 2FA." : "Require a security key or authenticator app for login."}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      {securitySettings.two_factor_enabled ? (
                        <>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-healthy)", fontSize: "14px", fontWeight: 600 }}>
                            <CheckCircle size={16} /> Enabled
                          </span>
                          <button onClick={disable2FA} style={{ padding: "8px 16px", background: "transparent", border: "1px solid var(--border-error)", borderRadius: "var(--radius-md)", color: "var(--color-critical)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                            Disable
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setShow2FAModal(true)} style={{ padding: "8px 16px", background: "var(--color-blue)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                          Set Up 2FA
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Session Timeout Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Session Timeout</div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Automatically log out inactive sessions.</div>
                    </div>
                    <select 
                      value={securitySettings.session_timeout_minutes} 
                      onChange={async (e) => {
                        const newSettings = {...securitySettings, session_timeout_minutes: parseInt(e.target.value)};
                        saveSecurity(newSettings);
                      }} 
                      style={{ padding: "8px 12px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
                    >
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={60}>1 Hour</option>
                      <option value={240}>4 Hours</option>
                    </select>
                  </div>

                  {/* Password Policy Row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>Password Policy</div>
                      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>
                        {securitySettings.enforce_password_policy ? "Complex passwords are being enforced." : "Enforce complex passwords across the organization."}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      {securitySettings.enforce_password_policy ? (
                        <>
                          <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-healthy)", fontSize: "14px", fontWeight: 600 }}>
                            <CheckCircle size={16} /> Enforced
                          </span>
                          <button onClick={() => setShowPolicyModal(true)} style={{ padding: "8px 16px", background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                            Modify Policy
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setShowPolicyModal(true)} style={{ padding: "8px 16px", background: "var(--color-blue)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                          Configure Policy
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && notificationPrefs && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Bell size={18} className="text-warning" /> Alert Preferences
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Configure how and when you receive system alerts.</p>
                </div>
                
                <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                  {Object.keys(notificationPrefs).map((prefKey, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{prefKey}</div>
                      <div style={{ display: "flex", gap: "16px" }}>
                        {['email', 'slack', 'sms'].map(channel => {
                          const isChecked = notificationPrefs[prefKey][channel];
                          return (
                            <div 
                              key={channel} 
                              style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                              onClick={() => {
                                setNotificationPrefs({
                                  ...notificationPrefs,
                                  [prefKey]: {
                                    ...notificationPrefs[prefKey],
                                    [channel]: !isChecked
                                  }
                                });
                              }}
                            >
                              <div style={{
                                width: "18px", height: "18px", borderRadius: "4px",
                                background: isChecked ? "var(--color-blue)" : "transparent",
                                border: `1px solid ${isChecked ? "var(--color-blue)" : "var(--border)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s"
                              }}>
                                {isChecked && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                              <span style={{ fontSize: "13px", color: isChecked ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: isChecked ? 500 : 400 }}>
                                {channel.charAt(0).toUpperCase() + channel.slice(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  <div style={{ marginTop: "16px", paddingTop: "20px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={saveNotifications} style={{ padding: "10px 20px", background: "var(--color-blue)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                      Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Keys Tab */}
          {activeTab === "api-keys" && (
            <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <div className="card" style={{ padding: "0", overflow: "hidden" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Key size={18} className="text-teal" /> API Keys
                    </h2>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px" }}>Manage programmatic access to the DevOps API.</p>
                  </div>
                  <button onClick={generateApiKey} style={{ padding: "10px 16px", background: "var(--color-blue)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    + Generate New Key
                  </button>
                </div>
                
                <div style={{ padding: "0" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-hover)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "12px 24px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Name</th>
                        <th style={{ padding: "12px 24px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Key Prefix</th>
                        <th style={{ padding: "12px 24px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Created</th>
                        <th style={{ padding: "12px 24px", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apiKeys.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>No API Keys generated yet.</td>
                        </tr>
                      ) : (
                        apiKeys.map(key => (
                          <tr key={key.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "16px 24px", fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{key.name}</td>
                            <td style={{ padding: "16px 24px", fontSize: "14px", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{key.prefix}</td>
                            <td style={{ padding: "16px 24px", fontSize: "13px", color: "var(--text-muted)" }}>{formatDateTime(key.created_at)}</td>
                            <td style={{ padding: "16px 24px", textAlign: "right" }}>
                              <button onClick={() => revokeApiKey(key.id)} style={{ padding: "6px 12px", background: "transparent", border: "1px solid var(--border-error)", borderRadius: "var(--radius-sm)", color: "var(--color-critical)", fontSize: "12px", cursor: "pointer" }}>Revoke</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}

function DataGroup({ label, value, icon }: { label: string, value: React.ReactNode, icon?: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "8px",
      padding: "16px", background: "var(--bg-base)",
      borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
      transition: "all 0.2s ease", cursor: "default"
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
        {icon} {label}
      </span>
      <div style={{ fontSize: "15px", color: "var(--text-primary)", fontWeight: 500, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

