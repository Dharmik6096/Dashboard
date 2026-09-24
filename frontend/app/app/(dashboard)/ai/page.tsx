"use client";

import { FormEvent, useRef, useState } from "react";
import { Bot, Eraser, Send, ShieldCheck, Sparkles, User } from "lucide-react";

import api from "@/lib/api";

type ConversationMessage = { role: "user" | "assistant"; content: string; model?: string; error?: boolean };

const prompts = [
  "Help me interpret sustained CPU pressure",
  "What evidence should I check for container restarts?",
  "Explain a safe workflow for investigating disk saturation",
  "Summarize how to triage an active alert",
];

export default function AiPage() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;
    const history = [...messages.filter((message) => !message.error).map(({ role, content: text }) => ({ role, content: text })), { role: "user" as const, content }];
    setMessages((current) => [...current, { role: "user", content }]);
    setInput("");
    setLoading(true);
    try {
      const response = await api.post<{ reply: string; model: string }>("/ai/chat", { messages: history, context: { page: "/app/ai" } });
      setMessages((current) => [...current, { role: "assistant", content: response.data.reply, model: response.data.model }]);
    } catch (requestError: unknown) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setMessages((current) => [...current, { role: "assistant", content: detail || "The assistant could not return a response.", error: true }]);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return <div className="v2-workspace-page ai-workspace">
    <header className="v2-page-head"><div><span>Read-only investigation</span><h1>Ops AI</h1><p>Ask a configured AI provider for structured troubleshooting guidance without granting infrastructure control.</p></div><span className="v2-page-trust"><ShieldCheck size={15} />No execution tools</span></header>

    <div className="ai-layout">
      <aside className="ai-context-panel">
        <div className="ai-context-icon"><Sparkles size={20} /></div>
        <h2>Investigation boundary</h2>
        <p>The assistant can reason from the context you provide. Direct telemetry-tool coverage is currently limited, so it must identify missing evidence instead of inventing metrics.</p>
        <ul><li>Read-only analysis</li><li>No shell access</li><li>No restart or mutation tools</li><li>Provider must be configured</li></ul>
        <div className="ai-roadmap"><b>Roadmap</b><span>Broader evidence retrieval across metrics, logs, and traces.</span></div>
      </aside>

      <section className="ai-console" aria-label="Ops AI conversation">
        <header><div><Bot size={18} /><span><strong>Troubleshooting assistant</strong><small>Gemini primary · Groq fallback</small></span></div><button type="button" onClick={() => setMessages([])} disabled={messages.length === 0 || loading}><Eraser size={14} />Clear</button></header>
        <div className="ai-messages" aria-live="polite">
          {messages.length === 0 ? <div className="ai-welcome"><Bot size={28} /><h2>Start with an observed symptom</h2><p>Include the affected service, time range, and evidence you already have.</p><div>{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}>{prompt}</button>)}</div></div>
            : messages.map((message, index) => <article className={`ai-message is-${message.role}${message.error ? " is-error" : ""}`} key={`${message.role}-${index}`}><span>{message.role === "assistant" ? <Bot size={15} /> : <User size={15} />}</span><div><strong>{message.role === "assistant" ? "Ops AI" : "You"}{message.model ? <small>{message.model}</small> : null}</strong><p>{message.content}</p></div></article>)}
          {loading ? <article className="ai-message is-assistant"><span><Bot size={15} /></span><div><strong>Ops AI</strong><p className="ai-thinking">Reviewing the request…</p></div></article> : null}
        </div>
        <form className="ai-composer" onSubmit={send}><label htmlFor="ops-ai-message" className="sr-only">Message</label><textarea id="ops-ai-message" ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Describe the symptom and available evidence…" rows={3} disabled={loading} /><button type="submit" disabled={loading || !input.trim()}><Send size={16} /><span>Send</span></button></form>
        <footer>AI output may be incomplete. Validate important conclusions against live telemetry.</footer>
      </section>
    </div>
  </div>;
}
