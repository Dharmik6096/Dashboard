"use client";
import { routes } from "@/lib/routes";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/api";
import { CheckCircle, XCircle, Info } from "lucide-react";
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
  status?: string;
  step?: string;
  reason?: string;
  hostname?: string;
  os?: string;
  cpu_cores?: number;
  ram_total?: number;
  docker_available?: boolean;
}

export default function EditServerPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.id as string;
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [sshChanged, setSshChanged] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    environment: "production",
    ip_address: "",
    ssh_username: "root",
    ssh_port: 22,
    auth_type: "password",
    ssh_password: "",
    description: ""
  });

  useEffect(() => {
    if (!serverId) return;
    
    api.get(`/servers/${serverId}`)
      .then(res => {
        setFormData({
          name: res.data.name || "",
          environment: res.data.environment || "production",
          ip_address: res.data.ip_address || "",
          ssh_username: res.data.ssh_username || "root",
          ssh_port: res.data.ssh_port || 22,
          auth_type: res.data.auth_type || "password",
          ssh_password: "", // intentionally left blank for security
          description: res.data.description || ""
        });
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load server details.");
        setLoading(false);
      });
  }, [serverId]);

  const handleTestConnection = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setTestResult(null);

    try {
      const payload = {
        ...formData,
        ssh_credential: formData.ssh_password || undefined,
      };
      const res = await api.post("/servers/test-connection", payload);
      setTestResult(res.data);
      setSshChanged(false); // Reset changed status on successful test
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to test connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        ...formData,
        ssh_credential: formData.ssh_password || undefined,
      };
      await api.put(`/servers/${serverId}`, payload);
      router.push(routes.server(serverId));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || "Failed to save server.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number) => {
    setFormData({ ...formData, [field]: value });
    if (["ip_address", "ssh_port", "ssh_username", "auth_type", "ssh_password"].includes(field)) {
      setSshChanged(true);
      setTestResult(null);
    }
  };

  const canSaveSafely = !sshChanged || (testResult && testResult.ssh?.status === "success");

  if (loading && !formData.name) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading server...</div>;
  }

  return (
    <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto" }}>
      <div className="breadcrumb">
        <Link href={routes.home}>Dashboard</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={routes.servers}>Servers</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={routes.server(serverId)}>{formData.name || "Server"}</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Edit</span>
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>Edit Server Configuration</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* LEFT COLUMN: FORM */}
        <div className="card">
          <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
            Update connection details. If you change SSH credentials or IP, you must re-test the connection.
          </p>

          {error && <div className="alert-banner alert-banner-critical">{error}</div>}

          <div className="form-group">
            <label className="label">Server Name</label>
            <input type="text" className="input" placeholder="web-prod-01" required 
              value={formData.name} onChange={e => handleChange("name", e.target.value)} />
          </div>

          <div className="form-group">
            <label className="label">Environment</label>
            <EnvironmentSelect allowAdd={true} value={formData.environment} onChange={val => handleChange("environment", val)} />
          </div>

          <div className="form-group">
            <label className="label">IP Address or Hostname</label>
            <input type="text" className="input" placeholder="192.168.1.100" required 
              value={formData.ip_address} onChange={e => handleChange("ip_address", e.target.value)} />
          </div>

          <h3 style={{ fontSize: 15, textTransform: "uppercase", fontWeight: 600, color: "var(--text-muted)", marginTop: 24, marginBottom: 12 }}>SSH Authentication</h3>

          <div style={{ display: "flex", gap: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="label">Username</label>
              <input type="text" className="input" placeholder="root" 
                value={formData.ssh_username} onChange={e => handleChange("ssh_username", e.target.value)} />
            </div>
            <div className="form-group" style={{ width: 100 }}>
              <label className="label">Port</label>
              <input type="number" className="input" placeholder="22" 
                value={formData.ssh_port} onChange={e => handleChange("ssh_port", parseInt(e.target.value) || 22)} />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Authentication Type</label>
            <select className="input" value={formData.auth_type} onChange={e => handleChange("auth_type", e.target.value)}>
              <option value="password">Password</option>
              <option value="key">Private Key</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">{formData.auth_type === "password" ? "SSH Password" : "Private Key"}</label>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 6 }}>Leave blank to keep current credentials.</div>
            {formData.auth_type === "password" ? (
              <input type="password" className="input" placeholder="New password" 
                value={formData.ssh_password} onChange={e => handleChange("ssh_password", e.target.value)} />
            ) : (
              <textarea className="input" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..." rows={4}
                value={formData.ssh_password} onChange={e => handleChange("ssh_password", e.target.value)} />
            )}
          </div>
          
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="label">Description (Optional)</label>
            <input type="text" className="input" placeholder="e.g. Main frontend proxy" 
              value={formData.description} onChange={e => handleChange("description", e.target.value)} />
          </div>
        </div>

        {/* RIGHT COLUMN: ACTION & RESULTS */}
        <div>
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Connection Verification</h3>
            
            {sshChanged ? (
              <p style={{ color: "var(--color-warning)", fontSize: 15, marginBottom: 20 }}>
                Connection details have changed. Please test connection before saving.
              </p>
            ) : (
              <p style={{ color: "var(--text-secondary)", fontSize: 15, marginBottom: 20 }}>
                Run a connection test to verify current details.
              </p>
            )}

            <button 
              className="btn btn-primary" 
              style={{ width: "100%", marginBottom: 24 }}
              onClick={handleTestConnection}
              disabled={loading || !formData.ip_address}
            >
              {loading ? "Testing Connection..." : "Test Connection"}
            </button>

            {testResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                
                {/* Detailed Test Results Block */}
                <div style={{ padding: 12, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-hover)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    {testResult.ssh?.status === "success" ? <CheckCircle size={16} color="var(--color-healthy)" /> : 
                     testResult.ssh?.status === "error" ? <XCircle size={16} color="var(--color-critical)" /> : 
                     <Info size={16} color="var(--text-muted)" />}
                    <span style={{ fontWeight: 600 }}>Connection Test Results</span>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 15, color: "var(--text-secondary)", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Network/SSH</span>
                      <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Network/SSH" ? "var(--color-critical)" : "var(--color-healthy)", fontWeight: 600 }}>
                        {testResult.ssh?.status === "error" && testResult.ssh?.step === "Network/SSH" ? "FAIL" : "PASS"}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Authentication</span>
                      <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Authentication" ? "var(--color-critical)" : (testResult.ssh?.status === "error" && testResult.ssh?.step == "Network/SSH" ? "SKIP" : "PASS"), fontWeight: 600 }}>
                        {testResult.ssh?.status === "error" && testResult.ssh?.step === "Authentication" ? "FAIL" : (testResult.ssh?.status === "error" && testResult.ssh?.step == "Network/SSH" ? "SKIP" : "PASS")}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Linux OS Check</span>
                      <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Linux OS Check" ? "var(--color-critical)" : (testResult.ssh?.status === "success" ? "PASS" : "SKIP"), fontWeight: 600 }}>
                        {testResult.ssh?.status === "error" && testResult.ssh?.step === "Linux OS Check" ? "FAIL" : (testResult.ssh?.status === "success" ? "PASS" : "SKIP")}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Metrics Collect</span>
                      <span style={{ color: testResult.ssh?.status === "error" && testResult.ssh?.step === "Metrics Collection" ? "var(--color-critical)" : (testResult.ssh?.status === "success" ? "PASS" : "SKIP"), fontWeight: 600 }}>
                        {testResult.ssh?.status === "error" && testResult.ssh?.step === "Metrics Collection" ? "FAIL" : (testResult.ssh?.status === "success" ? "PASS" : "SKIP")}
                      </span>
                    </div>
                  </div>

                  {testResult.ssh?.status === "success" ? (
                    <div style={{ fontSize: 15, color: "var(--text-secondary)", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 4 }}>
                        <span style={{ color: "var(--text-muted)" }}>Hostname:</span><span>{testResult.ssh.hostname}</span>
                        <span style={{ color: "var(--text-muted)" }}>OS:</span><span>{testResult.ssh.os}</span>
                        <span style={{ color: "var(--text-muted)" }}>CPU Cores:</span><span>{testResult.ssh.cpu_cores}</span>
                        <span style={{ color: "var(--text-muted)" }}>RAM:</span><span>{((testResult.ssh.ram_total || 0) / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                        <span style={{ color: "var(--text-muted)" }}>Docker:</span><span>{testResult.ssh.docker_available ? "Detected" : "Not Detected"}</span>
                      </div>
                    </div>
                  ) : testResult.ssh?.status === "error" ? (
                    <div style={{ fontSize: 15, color: "var(--color-critical)", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                      Reason: {testResult.ssh.reason}
                    </div>
                  ) : null}
                </div>

              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Save Changes</h3>
            {canSaveSafely ? (
              <button className="btn btn-healthy" style={{ width: "100%" }} onClick={handleSave} disabled={loading}>
                Save Server Configuration
              </button>
            ) : (
              <div>
                <div className="alert-banner alert-banner-warning" style={{ fontSize: 15, marginBottom: 16 }}>
                  Connection details have changed. A successful test is recommended.
                </div>
                <button className="btn btn-ghost" style={{ width: "100%" }} onClick={handleSave} disabled={loading}>
                  Save Anyway (Not Recommended)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
