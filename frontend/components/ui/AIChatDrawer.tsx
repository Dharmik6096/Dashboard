"use client";
import React, { useState, useEffect, useRef } from "react";
import { X, Send, Bot, User, Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import api from "@/lib/api";

interface Message {
  role: "ai" | "user";
  text: string;
  time: string;
  error?: boolean;
}

// ─── Markdown renderer ──────────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line === '') {
      result.push(<div key={`sp-${i}`} style={{ height: 6 }} />);
      i++;
      continue;
    }

    // Numbered list: "1. ", "2. "
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      result.push(
        <ol key={`ol-${i}`} style={{ paddingLeft: 0, margin: '4px 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.55 }}>
              <span style={{ minWidth: 18, height: 18, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{idx + 1}</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet: "- " or "• "
    if (/^[-•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-•]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-•]\s/, ''));
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} style={{ paddingLeft: 0, margin: '4px 0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.55 }}>
              <span style={{ color: '#3b82f6', flexShrink: 0, marginTop: 5, fontSize: 8 }}>●</span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Heading: "### " or "## " or "# "
    if (/^#{1,3}\s/.test(line)) {
      const headingText = line.replace(/^#{1,3}\s/, '');
      result.push(<div key={`h-${i}`} style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginTop: 8, marginBottom: 2, lineHeight: 1.4 }}>{renderInline(headingText)}</div>);
      i++;
      continue;
    }

    // Code block: lines starting with 4 spaces or surrounded by ```
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      result.push(
        <div key={`code-${i}`} style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, background: 'rgba(0,0,0,0.4)', border: '1px solid #1e3352', padding: '8px 12px', borderRadius: 6, color: '#7dd3fc', margin: '6px 0', overflowX: 'auto', lineHeight: 1.6 }}>
          {codeLines.map((cl, ci) => <div key={ci}>{cl}</div>)}
        </div>
      );
      continue;
    }

    // Regular line
    result.push(<div key={`l-${i}`} style={{ lineHeight: 1.65, marginBottom: 1 }}>{renderInline(line)}</div>);
    i++;
  }

  return result;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#e2e8f0', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: '#cbd5e1' }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'rgba(0,0,0,0.35)', border: '1px solid #1e3352', padding: '1px 5px', borderRadius: 4, color: '#7dd3fc' }}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

// ─── Main component ─────────────────────────────────────────────────────────
const INIT_MSG: Message = {
  role: "ai",
  text: "Hello! I'm **Ops AI**, a read-only troubleshooting assistant.\n\nI can help you with:\n- Interpreting **CPU / Memory / Disk** symptoms\n- Investigating **Docker and container** evidence\n- Reasoning about **network** problems\n- Triaging **alerts** and incidents\n- Identifying the next safe telemetry check\n\nI cannot execute commands or change your infrastructure.",
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export function AIChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INIT_MSG]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user message to UI
    setMessages(prev => [...prev, { role: "user", text, time: now }]);
    setInputValue("");
    setIsLoading(true);

    // Build history for API (include previous turns for context)
    const updatedHistory = [...conversationHistory, { role: "user", content: text }];

    try {
      const res = await api.post("/ai/chat", { messages: updatedHistory });
      const aiReply: string = res.data.reply;
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      setMessages(prev => [...prev, { role: "ai", text: aiReply, time: aiTime }]);
      // Update conversation history with assistant reply for next turn
      setConversationHistory([...updatedHistory, { role: "assistant", content: aiReply }]);
    } catch (err: unknown) {
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      let errMsg = "Failed to get a response. Check the configured Gemini or Groq provider in the backend environment.";
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string }; status?: number } };
        if (axiosErr.response?.data?.detail) errMsg = axiosErr.response.data.detail;
      }
      setMessages(prev => [...prev, { role: "ai", text: errMsg, time: aiTime, error: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([{ ...INIT_MSG, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setConversationHistory([]);
    setInputValue("");
  };

  const quickPrompts = ["High CPU usage", "Container not starting", "Disk full", "Network latency", "Memory pressure", "Service crashed"];

  return (
    <>
      {/* ── FAB ── */}
      <button id="global-ai-fab" onClick={() => setIsOpen(true)} title="InfraSight AI"
        style={{ 
          position: "fixed", bottom: 24, right: 24, width: 50, height: 50, 
          borderRadius: "50%", background: "#3b82f6", color: "#fff", border: "none", 
          boxShadow: "0 2px 10px rgba(59,130,246,0.3)", cursor: "pointer", 
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998, 
          transition: "opacity 180ms ease, visibility 180ms ease",
          opacity: isOpen ? 0 : 1,
          visibility: isOpen ? "hidden" : "visible",
          pointerEvents: isOpen ? "none" : "auto"
        }}
      >
        <Sparkles size={22} />
      </button>

      {/* ── Backdrop ── */}
      <div onClick={() => setIsOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9998, backdropFilter: "blur(3px)", transition: "opacity 180ms ease, visibility 180ms ease", opacity: isOpen ? 1 : 0, visibility: isOpen ? "visible" : "hidden", pointerEvents: isOpen ? "auto" : "none" }} />

      {/* ── Drawer ── */}
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 440, background: "#080c18", boxShadow: "-16px 0 60px rgba(0,0,0,0.7)", borderLeft: "1px solid #1a2535", transform: isOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 180ms ease", zIndex: 9999, display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ padding: "0 20px", height: 62, borderBottom: "1px solid #1a2535", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0d1117", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(59,130,246,0.4)" }}>
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f4fc" }}>InfraSight AI</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                <div style={{ fontSize: 11, color: "#4b6280" }}>Configured provider · Read-only assistant</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleClear} title="Clear conversation" style={{ background: "transparent", border: "none", color: "#4b6280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1a2535"; e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4b6280"; }}>
              <RefreshCw size={15} />
            </button>
            <button onClick={() => setIsOpen(false)} title="Close" style={{ background: "transparent", border: "none", color: "#4b6280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 6, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1a2535"; e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4b6280"; }}>
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 16, background: "#080c18" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, flexDirection: m.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: m.role === "ai" ? (m.error ? "rgba(239,68,68,0.12)" : "linear-gradient(135deg,rgba(59,130,246,0.18),rgba(139,92,246,0.18))") : "#141d2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: m.role === "ai" ? (m.error ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(59,130,246,0.3)") : "1px solid #1e2d45", marginTop: 2 }}>
                {m.role === "ai" ? (m.error ? <AlertCircle size={14} color="#f87171" /> : <Bot size={15} color="#60a5fa" />) : <User size={14} color="#7a92b2" />}
              </div>
              <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 3, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ background: m.role === "user" ? "linear-gradient(135deg,#2563eb,#3b82f6)" : (m.error ? "rgba(239,68,68,0.06)" : "#0f172a"), color: m.role === "user" ? "#fff" : (m.error ? "#f87171" : "#b8cce4"), padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", fontSize: 13, border: m.role === "ai" ? (m.error ? "1px solid rgba(239,68,68,0.2)" : "1px solid #1a2535") : "none", boxShadow: m.role === "user" ? "0 3px 16px rgba(37,99,235,0.3)" : "0 1px 6px rgba(0,0,0,0.4)" }}>
                  {m.role === "ai" ? renderMarkdown(m.text) : m.text}
                </div>
                <div style={{ fontSize: 10, color: "#2a3f58", paddingLeft: 4, paddingRight: 4 }}>{m.time}</div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,rgba(59,130,246,0.18),rgba(139,92,246,0.18))", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(59,130,246,0.3)", flexShrink: 0, marginTop: 2 }}>
                <Bot size={15} color="#60a5fa" />
              </div>
              <div style={{ background: "#0f172a", border: "1px solid #1a2535", padding: "14px 16px", borderRadius: "14px 14px 14px 4px", display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(n => <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: `typingBounce 1.2s ease-in-out ${n * 0.18}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Quick Prompts (only on fresh chat) ── */}
        {messages.length <= 1 && !isLoading && (
          <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap", background: "#080c18" }}>
            {quickPrompts.map(p => (
              <button key={p} onClick={() => { setInputValue(p); inputRef.current?.focus(); }}
                style={{ padding: "5px 12px", fontSize: 11.5, fontWeight: 500, background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", color: "#60a5fa", borderRadius: 20, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.15)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.4)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(59,130,246,0.07)"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.2)"; }}
              >{p}</button>
            ))}
          </div>
        )}

        {/* ── Input ── */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid #1a2535", background: "#0d1117", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
            <input ref={inputRef} type="text" value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask anything about your infrastructure..."
              disabled={isLoading}
              style={{ flex: 1, background: "#080c18", border: "1px solid #1a2535", padding: "10px 14px", borderRadius: 8, color: "#e2e8f0", fontSize: 13, outline: "none", transition: "border-color 0.18s", fontFamily: "inherit", opacity: isLoading ? 0.6 : 1, height: 40 }}
              onFocus={e => e.target.style.borderColor = "#3b82f6"}
              onBlur={e => e.target.style.borderColor = "#1a2535"}
            />
            <button onClick={handleSend} disabled={!inputValue.trim() || isLoading}
              style={{ width: 40, height: 40, borderRadius: 8, background: inputValue.trim() && !isLoading ? "#3b82f6" : "#1a2535", color: inputValue.trim() && !isLoading ? "#fff" : "#4b6280", border: "none", cursor: inputValue.trim() && !isLoading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.18s", flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </div>
          <div style={{ fontSize: 10.5, color: "#2a3f58", textAlign: "center", marginTop: 8 }}>
            Read-only guidance · Validate conclusions against live telemetry
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes typingBounce { 0%,100%{transform:translateY(0);opacity:.35} 50%{transform:translateY(-5px);opacity:1} }
      `}} />
    </>
  );
}
