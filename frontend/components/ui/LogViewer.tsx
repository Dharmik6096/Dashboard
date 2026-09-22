"use client";
import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Search, Copy, WrapText, ArrowDown, Download, RefreshCw, Terminal } from "lucide-react";

export interface LogEntry {
  timestamp: string;
  level?: string;
  message: string;
  raw: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  loading?: boolean;
  onRefresh?: (lines: number) => void;
  title?: string;
}

export function LogViewer({ logs, loading, onRefresh, title = "Live Logs" }: LogViewerProps) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [wrap, setWrap] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lines, setLines] = useState(200);
  const [rawMode, setRawMode] = useState(false);
  const [paused, setPaused] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const filteredLogs = logs.filter(l => {
    if (level !== "all" && l.level?.toLowerCase() !== level.toLowerCase()) return false;
    if (search && !l.raw.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    if (autoScroll && containerRef.current && !paused && !isScrolledUp) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, paused, isScrolledUp]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsScrolledUp(!isAtBottom);
  };

  const handleCopy = () => {
    const text = filteredLogs.map(l => l.raw).join("\n");
    navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const text = filteredLogs.map(l => l.raw).join("\n");
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelBadge = (lvl?: string) => {
    const l = lvl?.toLowerCase() || "";
    if (l.includes("err") || l.includes("crit") || l.includes("fatal")) {
      return { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", text: "ERROR" };
    }
    if (l.includes("warn")) {
      return { bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", text: "WARN" };
    }
    if (l.includes("info")) {
      return { bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", text: "INFO" };
    }
    if (l.includes("debug")) {
      return { bg: "rgba(168, 85, 247, 0.15)", color: "#a855f7", text: "DEBUG" };
    }
    return { bg: "rgba(156, 163, 175, 0.15)", color: "#9ca3af", text: "LOG" };
  };

  return (
    <div 
      className="log-viewer-container" 
      style={{ 
        display: "flex", 
        flexDirection: "column", 
        height: "600px", 
        background: "#0f111a", // Deep dark background for premium terminal feel
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        position: "relative"
      }}
    >
      {/* Toolbar */}
      <div 
        style={{ 
          padding: "12px 20px", 
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          flexWrap: "wrap", 
          gap: 16,
          background: "rgba(255, 255, 255, 0.03)",
          backdropFilter: "blur(10px)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 600, fontSize: 14 }}>
            <Terminal size={16} style={{ color: "#3b82f6" }} />
            {title}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Search size={14} style={{ color: "#6b7280" }} />
            <input 
              type="text" 
              placeholder="Search in logs..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#fff", outline: "none", fontSize: 13, width: 180 }}
            />
          </div>
          
          <div style={{ display: "flex", gap: 8 }}>
            <select 
              value={level} 
              onChange={e => setLevel(e.target.value)}
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", color: "#fff", borderRadius: "8px", padding: "6px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}
            >
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
            
            <select 
              value={lines} 
              onChange={e => setLines(Number(e.target.value))}
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", color: "#fff", borderRadius: "8px", padding: "6px 10px", fontSize: 13, outline: "none", cursor: "pointer" }}
            >
              <option value={100}>Last 100 lines</option>
              <option value={200}>Last 200 lines</option>
              <option value={500}>Last 500 lines</option>
              <option value={1000}>Last 1000 lines</option>
            </select>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button 
            onClick={() => setPaused(!paused)} 
            title={paused ? "Resume Streaming" : "Pause Streaming"}
            style={{ 
              display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, cursor: "pointer",
              background: paused ? "rgba(239, 68, 68, 0.2)" : "transparent", color: paused ? "#ef4444" : "#9ca3af",
              border: "1px solid transparent", transition: "all 0.2s" 
            }}
            onMouseOver={e => e.currentTarget.style.background = paused ? "rgba(239, 68, 68, 0.3)" : "rgba(255,255,255,0.1)"}
            onMouseOut={e => e.currentTarget.style.background = paused ? "rgba(239, 68, 68, 0.2)" : "transparent"}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          
          <button 
            onClick={() => setWrap(!wrap)} 
            title="Toggle Word Wrap"
            style={{ 
              display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, cursor: "pointer",
              background: wrap ? "rgba(59, 130, 246, 0.2)" : "transparent", color: wrap ? "#3b82f6" : "#9ca3af",
              border: "1px solid transparent", transition: "all 0.2s" 
            }}
            onMouseOver={e => e.currentTarget.style.background = wrap ? "rgba(59, 130, 246, 0.3)" : "rgba(255,255,255,0.1)"}
            onMouseOut={e => e.currentTarget.style.background = wrap ? "rgba(59, 130, 246, 0.2)" : "transparent"}
          >
            <WrapText size={16} />
          </button>
          
          <button 
            onClick={() => setRawMode(!rawMode)} 
            title="Toggle Raw Mode"
            style={{ 
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px", height: 32, borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: rawMode ? "rgba(168, 85, 247, 0.2)" : "transparent", color: rawMode ? "#a855f7" : "#9ca3af",
              border: "1px solid transparent", transition: "all 0.2s" 
            }}
            onMouseOver={e => e.currentTarget.style.background = rawMode ? "rgba(168, 85, 247, 0.3)" : "rgba(255,255,255,0.1)"}
            onMouseOut={e => e.currentTarget.style.background = rawMode ? "rgba(168, 85, 247, 0.2)" : "transparent"}
          >
            RAW
          </button>

          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
          
          <button 
            onClick={handleCopy} 
            title="Copy Filtered Logs"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, cursor: "pointer", background: "transparent", color: "#9ca3af", border: "none", transition: "all 0.2s" }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={e => e.currentTarget.style.background = "transparent"}
          >
            <Copy size={16} />
          </button>
          
          <button 
            onClick={handleDownload} 
            title="Download Logs"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, cursor: "pointer", background: "transparent", color: "#9ca3af", border: "none", transition: "all 0.2s" }}
            onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={e => e.currentTarget.style.background = "transparent"}
          >
            <Download size={16} />
          </button>
          
          {onRefresh && (
            <button 
              onClick={() => onRefresh(lines)} 
              disabled={loading}
              style={{ 
                display: "flex", alignItems: "center", gap: 6, padding: "0 12px", height: 32, borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", 
                background: "linear-gradient(to right, #2563eb, #3b82f6)", color: "#fff", border: "none", fontWeight: 500, fontSize: 13, transition: "all 0.2s", opacity: loading ? 0.7 : 1, marginLeft: 4 
              }}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} /> 
              {loading ? "Loading" : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {/* Log Body */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        style={{ 
          flex: 1, 
          overflowY: "auto", 
          overflowX: wrap ? "hidden" : "auto", 
          padding: "16px 20px",
          fontFamily: "'Fira Code', 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
          fontSize: 13,
          lineHeight: 1.6,
          scrollBehavior: "smooth"
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#6b7280" }}>
            <Terminal size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div>{loading ? "Establishing connection to log stream..." : "No logs found matching criteria."}</div>
          </div>
        ) : rawMode ? (
          <pre style={{ margin: 0, whiteSpace: wrap ? "pre-wrap" : "pre", color: "#d1d5db" }}>
            {filteredLogs.map(l => l.raw).join("\n")}
          </pre>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredLogs.map((l, i) => {
              const badge = getLevelBadge(l.level);
              return (
                <div 
                  key={i} 
                  style={{ 
                    display: "flex", 
                    alignItems: "flex-start", 
                    gap: 16,
                    padding: "4px 8px",
                    borderRadius: 6,
                    transition: "background 0.15s",
                  }}
                  onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ color: "#6b7280", whiteSpace: "nowrap", fontSize: 12, paddingTop: 2, minWidth: 160 }}>
                    {l.timestamp || new Date().toISOString()}
                  </div>
                  <div style={{ width: 60, flexShrink: 0, paddingTop: 2 }}>
                    <span style={{ 
                      background: badge.bg, 
                      color: badge.color, 
                      padding: "2px 6px", 
                      borderRadius: 4, 
                      fontSize: 10, 
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      border: `1px solid ${badge.color}30` 
                    }}>
                      {badge.text}
                    </span>
                  </div>
                  <div style={{ color: "#e5e7eb", whiteSpace: wrap ? "pre-wrap" : "pre", overflowWrap: "anywhere", flex: 1, wordBreak: "break-word" }}>
                    {l.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom */}
      {isScrolledUp && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }}
          style={{
            position: "absolute",
            bottom: 24,
            right: 32,
            background: "rgba(59, 130, 246, 0.9)",
            backdropFilter: "blur(4px)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "50%",
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            transition: "all 0.2s",
            zIndex: 10
          }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
          title="Scroll to latest"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
}
