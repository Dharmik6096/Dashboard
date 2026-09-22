import React from "react";
import { AlertTriangle, AlertCircle, Loader2, ShieldAlert } from "lucide-react";

export function EmptyState({ title = "No Data", desc = "Nothing to show here." }: { title?: string, desc?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <AlertCircle size={48} />
      </div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{desc}</div>
    </div>
  );
}

export function ErrorState({ title = "An Error Occurred", desc = "Something went wrong." }: { title?: string, desc?: React.ReactNode }) {
  return (
    <div className="error-state">
      <div className="empty-state-icon" style={{ color: "var(--color-critical)", opacity: 1 }}>
        <AlertTriangle size={48} />
      </div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc" style={{ color: "var(--color-critical)" }}>{desc}</div>
    </div>
  );
}

export function LoadingState({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ color: "var(--color-blue)", opacity: 1 }}>
        <Loader2 size={48} className="spin" />
      </div>
      <div className="empty-state-title">{text}</div>
    </div>
  );
}

export function PermissionDeniedState({ desc = "You do not have permission to access this resource." }: { desc?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" style={{ color: "var(--color-warning)", opacity: 1 }}>
        <ShieldAlert size={48} />
      </div>
      <div className="empty-state-title">Permission Denied</div>
      <div className="empty-state-desc">{desc}</div>
    </div>
  );
}
