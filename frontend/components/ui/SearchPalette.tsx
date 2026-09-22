"use client";
import React, { useState, useEffect, useRef } from "react";
import { Search, Server, Box, Globe, Share2, Activity, Network } from "lucide-react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export interface SearchResult {
  type: string; // "server", "container", "nginx_domain", "nginx_upstream", "port", "service"
  id: string;
  name: string;
  subtitle: string;
  status: string;
  server_id: string;
  url: string;
}

interface SearchPaletteProps {
  onClose: () => void;
}

export function SearchPalette({ onClose }: SearchPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setTimeout(() => setResults([]), 0);
      return;
    }
    const t = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(query)}`)
        .then(res => {
          setResults(res.data.results || []);
          setSelectedIndex(0);
        })
        .catch(console.error);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      router.push(results[selectedIndex].url);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case "server": return <Server size={16} />;
      case "container": return <Box size={16} />;
      case "nginx_domain": return <Globe size={16} />;
      case "nginx_upstream": return <Share2 size={16} />;
      case "port": return <Network size={16} />;
      case "service": return <Activity size={16} />;
      default: return <Search size={16} />;
    }
  };

  // Group results
  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  // Flatten for keyboard navigation
  const flatGrouped = Object.values(grouped).flat();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, 
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh"
    }} onClick={onClose}>
      <div 
        style={{
          width: "100%", maxWidth: 650, background: "var(--bg-card)",
          borderRadius: 8, border: "1px solid var(--border)",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
          overflow: "hidden", display: "flex", flexDirection: "column"
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <Search size={18} color="var(--text-muted)" style={{ marginRight: 12 }} />
          <input 
            ref={inputRef}
            type="text"
            placeholder="Search servers, containers, domains, upstreams, ports..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 18, color: "var(--text-primary)" }}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div style={{ fontSize: 13, background: "var(--bg-hover)", padding: "4px 6px", borderRadius: 4, color: "var(--text-muted)" }}>ESC</div>
        </div>
        
        <div style={{ maxHeight: 450, overflowY: "auto", padding: 8 }}>
          {query.trim() && results.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 15 }}>
              No results found for &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div style={{ padding: "12px 12px 4px 12px", fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {type.replace("_", " ")}
                </div>
                {items.map((r) => {
                  const isSelected = flatGrouped[selectedIndex]?.id === r.id;
                  return (
                    <div 
                      key={r.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 12px", background: isSelected ? "var(--bg-hover)" : "transparent", 
                        borderRadius: 6, cursor: "pointer", color: "var(--text-primary)"
                      }}
                      onMouseEnter={() => setSelectedIndex(flatGrouped.findIndex(item => item.id === r.id))}
                      onClick={() => {
                        router.push(r.url);
                        onClose();
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ color: "var(--text-muted)" }}>{getIcon(type)}</div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.subtitle}</div>
                        </div>
                      </div>
                      {isSelected && <div style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--bg-base)", padding: "4px 8px", borderRadius: 4 }}>Enter to jump</div>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
