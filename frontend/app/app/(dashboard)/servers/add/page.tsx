"use client";
import { routes } from "@/lib/routes";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { CheckCircle, XCircle, Info, Eye, EyeOff, Loader2, AlertTriangle, Check, Clock } from "lucide-react";
import Link from "next/link";
import { EnvironmentSelect } from "@/components/ui/EnvironmentSelect";

interface TestResult {
  ssh?: {
    status?: string;
    step?: string;
    reason?: string;
    hostname?: string;
    os?: string;
    cpu_cores?: number;
    ram_total?: number;
    docker_available?: boolean;
  };
}

const DEFAULT_ENVIRONMENTS = ["Production", "UAT", "QA", "Development", "Database", "Proxy", "Other"];

export default function AddServerPage() {
  const router = useRouter();
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    environment: "Production",
    ip_address: "",
    ssh_username: "root",
    ssh_port: 22,
    auth_type: "password",
    ssh_password: "",
    description: ""
  });

  const [verifiedFormData, setVerifiedFormData] = useState<typeof formData | null>(null);

  // customEnvironments logic moved to EnvironmentSelect component

  const isVerified = testResult?.ssh?.status === "success";

  const criticalFieldsChanged = () => {
    if (!isVerified || !verifiedFormData) return false;
    return (
      formData.ip_address !== verifiedFormData.ip_address ||
      formData.ssh_port !== verifiedFormData.ssh_port ||
      formData.ssh_username !== verifiedFormData.ssh_username ||
      formData.auth_type !== verifiedFormData.auth_type ||
      formData.ssh_password !== verifiedFormData.ssh_password
    );
  };

  const ipv4Regex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/;

  const handleTestConnection = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!ipv4Regex.test(formData.ip_address)) {
      setError("Enter a valid IPv4 address.");
      return;
    }

    setIsTesting(true);
    setError("");
    setTestResult(null);

    try {
      const payload = {
        ...formData,
        ssh_credential: formData.ssh_password || undefined,
      };
      const res = await api.post("/servers/test-connection", payload);
      setTestResult(res.data);
      if (res.data?.ssh?.status === "success") {
        setVerifiedFormData({ ...formData });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to test connection.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (criticalFieldsChanged() || !isVerified) return;

    setLoading(true);
    setError("");

    try {
      const payload = {
        ...formData,
        ssh_credential: formData.ssh_password || undefined,
      };
      const res = await api.post("/servers", payload);
      router.push(routes.servers);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to save server.";
      if (detail.toLowerCase().includes("already") || detail.toLowerCase().includes("exists")) {
        setError(`Server already monitored\nIP Address: ${formData.ip_address}\nSSH Port: ${formData.ssh_port}`);
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, name: "Network / SSH Reachability", key: "Network/SSH" },
    { id: 2, name: "Authentication", key: "Authentication" },
    { id: 3, name: "Linux System Check", key: "Linux OS Check" },
    { id: 4, name: "Metrics & Docker Discovery", key: "Metrics Collection" },
  ];

  const getStepState = (stepKey: string, stepIndex: number) => {
    if (!testResult) return isTesting ? (stepIndex === 0 ? "Running" : "Pending") : "Pending";
    
    const status = testResult.ssh?.status;
    const failedStep = testResult.ssh?.step;
    
    if (status === "success") {
      if (stepKey === "Metrics Collection" && testResult.ssh?.docker_available === false) {
        return "Limited";
      }
      return "Pass";
    }
    
    if (status === "error") {
       const failedIndex = steps.findIndex(s => s.key === failedStep);
       const fIndex = failedIndex >= 0 ? failedIndex : 0;
       
       if (stepIndex < fIndex) return "Pass";
       if (stepIndex === fIndex) return "Fail";
       return "Pending";
    }
    return "Pending";
  };

  const renderStepIcon = (state: string) => {
    switch (state) {
      case "Pass": return <CheckCircle size={14} className="text-emerald-500" />;
      case "Fail": return <XCircle size={14} className="text-red-500" />;
      case "Limited": return <AlertTriangle size={14} className="text-amber-500" />;
      case "Running": return <Loader2 size={14} className="animate-spin text-blue-500" />;
      default: return <Clock size={14} className="text-slate-500" />;
    }
  };

  // allEnvironments logic moved to EnvironmentSelect component

  return (
    <div className="fade-in" style={{ width: "100%", margin: "0 auto", fontSize: "13px" }}>
      <div className="breadcrumb" style={{ marginBottom: "12px" }}>
        <Link href={routes.home}>Infrastructure</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={routes.servers}>Servers</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Add Server</span>
      </div>

      <h1 style={{ fontSize: "22px", fontWeight: 600, marginBottom: "20px", color: "var(--text-primary)" }}>Add New Server</h1>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 58fr) minmax(0, 42fr)", gap: "20px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: FORM */}
        <div className="card" style={{ padding: "18px", borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
            Connection Details
          </h3>

          {error && <div style={{ padding: "10px", background: "rgba(239, 68, 68, 0.1)", borderLeft: "3px solid #ef4444", color: "#ef4444", marginBottom: "16px", whiteSpace: "pre-wrap" }}>{error}</div>}

          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>Server Name</label>
              <input type="text" style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }} placeholder="e.g. web2, db3, proxy-01" required 
                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>Environment</label>
              <EnvironmentSelect allowAdd={true} value={formData.environment} onChange={val => setFormData({ ...formData, environment: val })} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>IP Address</label>
              <input type="text" style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }} placeholder="e.g. 192.168.1.100" required 
                value={formData.ip_address} onChange={e => setFormData({ ...formData, ip_address: e.target.value })} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "12px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>SSH Username</label>
                <input type="text" style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }} placeholder="e.g. root, ubuntu" 
                  value={formData.ssh_username} onChange={e => setFormData({ ...formData, ssh_username: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>SSH Port</label>
                <input type="number" style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }} placeholder="22" 
                  value={formData.ssh_port} onChange={e => setFormData({ ...formData, ssh_port: parseInt(e.target.value) || 22 })} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>Authentication Type</label>
              <select style={{ width: "100%", height: "36px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }} value={formData.auth_type} onChange={e => setFormData({ ...formData, auth_type: e.target.value })}>
                <option value="password">Password</option>
                <option value="key">SSH Key</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>{formData.auth_type === "password" ? "SSH Password" : "SSH Key"}</label>
              {formData.auth_type === "password" ? (
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} style={{ width: "100%", height: "36px", padding: "0 36px 0 10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }} placeholder="Enter SSH password" 
                    value={formData.ssh_password} onChange={e => setFormData({ ...formData, ssh_password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "10px", top: "10px", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              ) : (
                <textarea style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", resize: "vertical", minHeight: "80px" }} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." 
                  value={formData.ssh_password} onChange={e => setFormData({ ...formData, ssh_password: e.target.value })} />
              )}
            </div>
            
            <div>
              <label style={{ display: "block", marginBottom: "4px", color: "var(--text-secondary)", fontWeight: 500 }}>Description (Optional)</label>
              <textarea style={{ width: "100%", height: "60px", padding: "8px 10px", borderRadius: "4px", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", resize: "none" }} placeholder="e.g. Main production web server" 
                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION & RESULTS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="card" style={{ padding: "18px", borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle size={18} />
              Connection Verification
            </h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.4 }}>
              Verify SSH connectivity and collect basic read-only host information before saving.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {steps.map((step, i) => {
                const state = getStepState(step.key, i);
                return (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "4px", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)" }}>{step.id}</div>
                      <span style={{ color: state === "Pending" ? "var(--text-muted)" : "var(--text-primary)" }}>{step.name}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: state === "Pass" ? "#10b981" : state === "Fail" ? "#ef4444" : state === "Limited" ? "#f59e0b" : "var(--text-muted)", fontWeight: 500, fontSize: "12px", textTransform: "uppercase" }}>
                      {state === "Limited" ? "LIMITED" : state}
                      {renderStepIcon(state)}
                    </div>
                  </div>
                );
              })}
            </div>

            {testResult?.ssh?.status === "success" && (
              <div style={{ marginBottom: "16px", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Info size={14} /> Detected Host Information
                </div>
                <div style={{ padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Hostname</span> <span>{testResult.ssh.hostname || "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>OS</span> <span>{testResult.ssh.os || "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>CPU Cores</span> <span>{testResult.ssh.cpu_cores || "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>RAM</span> <span>{testResult.ssh.ram_total ? `${(testResult.ssh.ram_total / 1024 / 1024 / 1024).toFixed(1)} GB` : "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Docker Access</span> <span>{testResult.ssh.docker_available === undefined ? "—" : testResult.ssh.docker_available ? "Available" : "Limited"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text-muted)" }}>Server Time</span> <span>{new Date().toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})}</span></div>
                </div>
              </div>
            )}

            {testResult?.ssh?.status === "error" && (
              <div style={{ padding: "10px", background: "rgba(239, 68, 68, 0.1)", borderLeft: "3px solid #ef4444", color: "#ef4444", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <XCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                <span>{testResult.ssh.reason || "Something went wrong"}</span>
              </div>
            )}

            <button 
              style={{ width: "100%", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: isTesting ? "var(--bg-hover)" : "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "4px", fontWeight: 500, cursor: isTesting ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              onClick={handleTestConnection}
              disabled={isTesting || !formData.ip_address}
            >
              {isTesting ? <><Loader2 size={16} className="animate-spin" /> Testing...</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg> Test Connection</>}
            </button>
          </div>

          <div className="card" style={{ padding: "18px", borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              Save Server
            </h3>
            
            {!isVerified ? (
              <div style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
                Connection verification required before saving.
              </div>
            ) : criticalFieldsChanged() ? (
              <div style={{ marginBottom: "16px", padding: "10px", background: "rgba(245, 158, 11, 0.1)", borderLeft: "3px solid #f59e0b", color: "#f59e0b", display: "flex", gap: "8px", alignItems: "center" }}>
                <AlertTriangle size={16} />
                <span>Connection details changed. Please test again.</span>
              </div>
            ) : (
              <div style={{ marginBottom: "16px", padding: "10px", background: "rgba(16, 185, 129, 0.1)", borderLeft: "3px solid #10b981", color: "#10b981", display: "flex", gap: "8px", alignItems: "center" }}>
                <Check size={16} />
                <span>Connection Verified</span>
              </div>
            )}

            <button 
              style={{ width: "100%", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", background: (!isVerified || criticalFieldsChanged() || loading) ? "var(--bg-hover)" : "var(--color-primary)", color: (!isVerified || criticalFieldsChanged() || loading) ? "var(--text-muted)" : "#fff", border: "none", borderRadius: "4px", fontWeight: 500, cursor: (!isVerified || criticalFieldsChanged() || loading) ? "not-allowed" : "pointer", transition: "background 0.2s" }} 
              onClick={handleSave} 
              disabled={!isVerified || criticalFieldsChanged() || loading}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }}/> Saving...</> : "Save Server"}
            </button>
            
            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "12px", justifyContent: "center" }}>
              <Info size={12} /> Read-only SSH monitoring. No infrastructure changes are performed.
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
