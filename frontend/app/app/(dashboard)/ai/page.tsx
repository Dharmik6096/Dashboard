"use client";
import { Bot } from "lucide-react";

export default function AiPage() {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Bot size={22} />
            Ops AI
          </h1>
          <p className="page-subtitle">Read-only AI observability assistant</p>
        </div>
      </div>

      <div className="card" style={{ textAlign: "center", padding: 64 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Ops AI Assistant</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 15, maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.7 }}>
          The AI assistant will analyze your infrastructure telemetry — servers, containers, alerts, logs,
          and processes — to provide evidence-based diagnostics and correlations.
          <br /><br />
          It is strictly <strong style={{ color: "var(--text-primary)" }}>read-only</strong>. It will never
          suggest or perform any action that controls, restarts, or modifies your infrastructure.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 340, margin: "0 auto" }}>
          {[
            "Why is qaqc using high CPU?",
            "Which server has the highest load?",
            "Summarize critical alerts",
            "What process is causing the CPU spike?",
          ].map(q => (
            <div key={q} style={{
              padding: "10px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              fontSize: 15,
              color: "var(--text-secondary)",
              textAlign: "left",
              fontStyle: "italic"
            }}>
              &quot;{q}&quot;
            </div>
          ))}
        </div>
        <p style={{ marginTop: 24, fontSize: 14, color: "var(--text-muted)" }}>
          Full AI integration is planned for a future release. Use the Ops AI button in the header to open the assistant panel.
        </p>
      </div>
    </div>
  );
}
