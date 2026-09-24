"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Mail, Plus, ShieldCheck, Users } from "lucide-react";

import { DashboardDataState } from "@/components/ui/DashboardDataState";
import api from "@/lib/api";

type Member = { id: string; name: string; email: string; role: string; status: string; last_active: string | null };
type ApiKey = { id: string };

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [apiKeyCount, setApiKeyCount] = useState(0);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [memberResponse, keyResponse] = await Promise.all([
        api.get<Member[]>("/organizations/members"),
        api.get<ApiKey[]>("/settings/apikeys"),
      ]);
      setMembers(memberResponse.data);
      setApiKeyCount(keyResponse.data.length);
    } catch {
      setError("Team and access data could not be loaded from the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setError("");
    setNotice("");
    try {
      await api.post("/organizations/invitations", { email, role });
      setNotice(`Invitation record created for ${email}.`);
      setEmail("");
      setModalOpen(false);
      await load();
    } catch (requestError: unknown) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail || "Invitation could not be created.");
    } finally {
      setInviting(false);
    }
  }

  return <div className="v2-workspace-page">
    <header className="v2-page-head"><div><span>Workspace administration</span><h1>Team &amp; access</h1><p>Review membership, workspace roles, invitations, and your API access.</p></div><button className="v2-page-button" type="button" onClick={() => setModalOpen(true)}><Plus size={15} aria-hidden="true" />Invite member</button></header>
    {notice ? <div className="v2-inline-note is-success" role="status">{notice}</div> : null}

    <section className="team-metrics" aria-label="Workspace access summary">
      <div><Users size={18} /><strong>{loading ? "—" : members.length}</strong><span>Members</span></div>
      <div><ShieldCheck size={18} /><strong>{loading ? "—" : members.filter((member) => ["admin", "owner"].includes(member.role)).length}</strong><span>Administrators</span></div>
      <div><Mail size={18} /><strong>{loading ? "—" : members.filter((member) => member.status === "invited").length}</strong><span>Pending invites</span></div>
      <div><KeyRound size={18} /><strong>{loading ? "—" : apiKeyCount}</strong><span>Your active API keys</span></div>
    </section>

    <section className="v2-section-block"><div className="v2-section-title"><div><h2>Workspace members</h2><p>Viewer access is the safest default; grant administration only where required.</p></div></div>
      {loading ? <DashboardDataState kind="loading" title="Loading workspace access" description="Reading members and API keys." />
        : error ? <DashboardDataState kind="error" title="Workspace access unavailable" description={error} onRetry={load} />
          : members.length === 0 ? <DashboardDataState kind="empty" title="No workspace members" description="Invite a member to start collaborating." />
            : <div className="v2-table members"><div className="v2-table-head"><span>Member</span><span>Role</span><span>Status</span><span>Last active</span></div>{members.map((member) => <div className="v2-table-row" key={member.id}><span className="member-cell"><i>{(member.name || member.email).slice(0, 2).toUpperCase()}</i><span><strong>{member.name || "Invited user"}</strong><small>{member.email}</small></span></span><span><b className="role-badge">{member.role}</b></span><span><b className={`status-badge ${member.status}`}>{member.status}</b></span><span>{member.last_active ? new Date(member.last_active).toLocaleString() : "Never"}</span></div>)}</div>}
    </section>

    {modalOpen ? <div className="v2-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}><form className="v2-modal" onSubmit={invite} aria-labelledby="invite-title"><span>Workspace access</span><h2 id="invite-title">Invite a team member</h2><p>This creates a seven-day invitation record. Email delivery depends on your deployment configuration.</p><label>Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" /></label><label>Role<select value={role} onChange={(event) => setRole(event.target.value)}><option value="viewer">Viewer — read dashboards</option><option value="analyst">Analyst — investigate and acknowledge</option><option value="admin">Admin — manage workspace</option></select></label><div><button type="button" onClick={() => setModalOpen(false)} disabled={inviting}>Cancel</button><button type="submit" disabled={inviting}>{inviting ? <><Loader2 size={14} className="spin" />Creating…</> : "Create invitation"}</button></div></form></div> : null}
  </div>;
}
