"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Bell, Clock, Database, Key, Lock, Mail, Monitor, Server, Shield, User } from "lucide-react";

import { DashboardDataState } from "@/components/ui/DashboardDataState";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";

type UserRecord = { id: string; username: string; email: string; role: string; last_login: string | null };
type ApiKeyRecord = { id: string; name: string; prefix: string; created_at: string | null; last_used: string | null };
type NotificationChannel = "email" | "slack" | "sms";
type NotificationPreferences = Record<string, Record<NotificationChannel, boolean>>;

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "api-keys", label: "API keys", icon: Key },
  { id: "system", label: "System", icon: Server },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function SettingsPage() {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({});
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [userResponse, serverResponse, keyResponse, notificationResponse] = await Promise.all([
        api.get<UserRecord>("/auth/me"),
        api.get<unknown[]>("/servers"),
        api.get<ApiKeyRecord[]>("/settings/apikeys"),
        api.get<{ preferences: NotificationPreferences }>("/settings/notifications"),
      ]);
      setUser(userResponse.data);
      setServerCount(serverResponse.data.length);
      setApiKeys(keyResponse.data);
      setNotificationPrefs(notificationResponse.data.preferences);
    } catch {
      setError("Settings data could not be loaded from the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveNotifications() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put("/settings/notifications", { preferences: notificationPrefs });
      setNotice("Notification preferences were saved. Delivery-channel integration remains on the roadmap.");
    } catch {
      setError("Notification preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="v2-workspace-page settings-workspace">
    <header className="v2-page-head"><div><span>Account &amp; deployment</span><h1>Settings</h1><p>Review identity, stored preferences, access credentials, and facts reported by this deployment.</p></div><span className="v2-page-trust"><Shield size={15} />Read-only infrastructure access</span></header>
    {notice ? <div className="v2-inline-note is-success" role="status">{notice}</div> : null}
    {error && !loading ? <div className="v2-inline-note is-error" role="alert">{error}</div> : null}

    {loading ? <DashboardDataState kind="loading" title="Loading settings" description="Reading account and deployment data." />
      : error && !user ? <DashboardDataState kind="error" title="Settings unavailable" description={error} onRetry={load} />
        : <div className="settings-layout">
          <nav className="settings-tabs" aria-label="Settings sections">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}><Icon size={16} />{label}</button>)}</nav>
          <main className="settings-panel">
            {activeTab === "profile" ? <SettingsSection title="Personal information" description="Identity returned by the authenticated user endpoint." icon={<User size={18} />}>
              <div className="settings-data-grid"><DataGroup label="Display name" value={user?.username || "Not returned"} icon={<User size={14} />} /><DataGroup label="Email address" value={user?.email || "Not returned"} icon={<Mail size={14} />} /><DataGroup label="Account role" value={user?.role || "Not returned"} icon={<Shield size={14} />} /><DataGroup label="User ID" value={user?.id || "Not returned"} icon={<Database size={14} />} /><DataGroup label="Last login" value={formatDateTime(user?.last_login)} icon={<Clock size={14} />} /></div>
            </SettingsSection> : null}

            {activeTab === "security" ? <SettingsSection title="Authentication security" description="Only controls enforced by the current backend are described as active." icon={<Lock size={18} />}>
              <CapabilityRow title="Strong signup passwords" description="New signups require at least 12 characters with uppercase, lowercase, and a number." status="Active" />
              <CapabilityRow title="Login lockout" description="Five failed sign-in attempts trigger a temporary account lock." status="Active" />
              <CapabilityRow title="Two-factor authentication" description="TOTP enrollment and verification are not implemented in the authentication flow." status="Roadmap" />
              <CapabilityRow title="Configurable session timeout" description="A preference record exists, but token expiry does not currently read it." status="Roadmap" />
              <CapabilityRow title="Organization password policy" description="Per-workspace policy configuration is not enforced by signup or reset flows." status="Roadmap" />
            </SettingsSection> : null}

            {activeTab === "notifications" ? <SettingsSection title="Stored notification preferences" description="These preferences are persisted. The live alert engine does not yet route delivery using them." icon={<Bell size={18} />} badge="Roadmap integration">
              {Object.keys(notificationPrefs).length === 0 ? <DashboardDataState kind="empty" title="No preferences returned" description="The settings API returned no notification categories." /> : <div className="notification-list">{Object.entries(notificationPrefs).map(([name, channels]) => <div className="notification-row" key={name}><strong>{name}</strong><div>{(["email", "slack", "sms"] as NotificationChannel[]).map((channel) => <label key={channel}><input type="checkbox" checked={Boolean(channels[channel])} onChange={() => setNotificationPrefs((current) => ({ ...current, [name]: { ...current[name], [channel]: !current[name][channel] } }))} /><span>{channel}</span></label>)}</div></div>)}</div>}
              <div className="settings-actions"><button type="button" className="v2-page-button" onClick={saveNotifications} disabled={saving}>{saving ? "Saving…" : "Save stored preferences"}</button></div>
            </SettingsSection> : null}

            {activeTab === "api-keys" ? <SettingsSection title="API key records" description="Key records can be created by the backend, but API-key request authentication is not implemented yet." icon={<Key size={18} />} badge="Roadmap authentication">
              <div className="v2-inline-note">For safety, this page does not issue credentials that the API cannot currently authenticate. Existing records remain visible and unchanged.</div>
              {apiKeys.length === 0 ? <DashboardDataState kind="empty" title="No API key records" description="No stored key records were returned for this user." /> : <div className="settings-key-list">{apiKeys.map((key) => <div key={key.id}><span><strong>{key.name}</strong><small>{key.prefix}</small></span><span><small>Created</small>{formatDateTime(key.created_at)}</span><span><small>Last used</small>{key.last_used ? formatDateTime(key.last_used) : "Never"}</span></div>)}</div>}
            </SettingsSection> : null}

            {activeTab === "system" ? <SettingsSection title="Deployment facts" description="Only facts available to this browser and API session are shown." icon={<Server size={18} />}>
              <div className="settings-data-grid"><DataGroup label="Deployment model" value="Self-hosted application" icon={<Database size={14} />} /><DataGroup label="API namespace" value="/api/v1" icon={<Activity size={14} />} /><DataGroup label="Monitored servers" value={serverCount === null ? "Not returned" : String(serverCount)} icon={<Server size={14} />} /><DataGroup label="Infrastructure control" value="Read-only monitoring" icon={<Shield size={14} />} /><DataGroup label="Browser platform" value={typeof navigator === "undefined" ? "Unknown" : navigator.platform || "Unknown"} icon={<Monitor size={14} />} /></div>
            </SettingsSection> : null}
          </main>
        </div>}
  </div>;
}

function SettingsSection({ title, description, icon, badge, children }: { title: string; description: string; icon: React.ReactNode; badge?: string; children: React.ReactNode }) {
  return <section className="settings-section"><header><div><span>{icon}</span><div><h2>{title}{badge ? <b className="roadmap-badge">{badge}</b> : null}</h2><p>{description}</p></div></div></header><div className="settings-section-body">{children}</div></section>;
}

function CapabilityRow({ title, description, status }: { title: string; description: string; status: "Active" | "Roadmap" }) {
  return <div className="capability-row"><div><strong>{title}</strong><span>{description}</span></div><b className={status === "Active" ? "is-active" : "is-roadmap"}>{status}</b></div>;
}

function DataGroup({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="settings-data-group"><span>{icon}{label}</span><strong>{value}</strong></div>;
}
