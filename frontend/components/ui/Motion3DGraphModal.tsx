"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Maximize2, Activity, Cpu, MemoryStick, Network, Layers, Sparkles, Play, Pause, Zap } from "lucide-react";

interface MetricPoint {
  time: string;
  cpu?: number;
  ram?: number;
  load?: number;
  rx?: number;
  tx?: number;
}

interface Motion3DGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MetricPoint[];
  initialActiveChart?: "cpu" | "ram" | "load" | "net";
}

type ViewMode = "3d-grid" | "stacked-3d" | "full-flow";

export function Motion3DGraphModal({ isOpen, onClose, data, initialActiveChart = "cpu" }: Motion3DGraphModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("3d-grid");
  const [isAnimating, setIsAnimating] = useState(true);
  const [rotateX, setRotateX] = useState(15);
  const [rotateY, setRotateY] = useState(-10);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const particleSpeed = 1;
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (initialActiveChart) {
      const timer = setTimeout(() => {
        // Option to filter active chart if needed
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialActiveChart]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Motion animation loop
  useEffect(() => {
    if (!isOpen || !isAnimating) return;
    let lastTime = performance.now();
    const loop = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      setPhase(p => (p + delta * particleSpeed * 2) % (Math.PI * 2));
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isOpen, isAnimating, particleSpeed]);

  // Interactive 3D mouse parallax tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotateY(x * 30);
    setRotateX(-y * 25 + 10);
  };

  const handleMouseLeave = () => {
    setRotateX(12);
    setRotateY(-8);
    setHoverIndex(null);
  };

  // Safe data points
  const points = useMemo(() => {
    if (!data || data.length === 0) {
      return Array.from({ length: 30 }).map((_, i) => ({
        time: `${10 + Math.floor(i / 2)}:${(i % 2) * 30}:00`,
        cpu: 15 + Math.sin(i * 0.5) * 10 + (i % 3) * 4,
        ram: 60 + Math.cos(i * 0.4) * 8,
        load: 1.2 + Math.sin(i * 0.3) * 0.5,
        rx: 20 + Math.sin(i * 0.8) * 15,
        tx: 40 + Math.cos(i * 0.8) * 25,
      }));
    }
    return data;
  }, [data]);

  if (!isOpen) return null;

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : points[points.length - 1];

  // Helper to build SVG path string with smooth curves
  const buildSvgPath = (key: "cpu" | "ram" | "load" | "rx" | "tx", width = 500, height = 180, maxVal = 100) => {
    if (!points || points.length === 0) return "";
    const dx = width / (points.length - 1 || 1);
    
    return points.map((pt, i) => {
      const val = (pt[key] as number) || 0;
      const x = i * dx;
      const y = height - (val / maxVal) * (height - 20) - 10;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  };

  const buildAreaPath = (key: "cpu" | "ram" | "load" | "rx" | "tx", width = 500, height = 180, maxVal = 100) => {
    const line = buildSvgPath(key, width, height, maxVal);
    if (!line) return "";
    return `${line} L ${width} ${height} L 0 ${height} Z`;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(5, 7, 15, 0.92)",
      backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column",
      color: "var(--text-primary)",
      overflow: "hidden",
      animation: "fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
    }}>
      {/* Dynamic 3D Matrix & Particle Canvas Backdrop */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `
          radial-gradient(circle at 50% 30%, rgba(59, 130, 246, 0.15), transparent 70%),
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        transform: `perspective(1000px) rotateX(${rotateX * 0.2}deg) rotateY(${rotateY * 0.2}deg) scale(1.1)`,
        transition: "transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)"
      }} />

      {/* Header Controls */}
      <div style={{
        position: "relative", zIndex: 10,
        padding: "16px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)"
          }}>
            <Activity size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 8 }}>
              Interactive 3D Motion Visualization Engine
              <span className="badge badge-online" style={{ fontSize: 10, padding: "2px 8px" }}>
                <Zap size={10} style={{ marginRight: 4 }} /> LIVE KINETIC
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Synchronized 4-Channel High Frequency Telemetry (Hover / Scrub / Tilt Enabled)
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* View Mode Buttons */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", padding: 3, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)" }}>
            {[
              { key: "3d-grid", label: "3D Spatial Grid", icon: Layers },
              { key: "stacked-3d", label: "3D Layer Stack", icon: Sparkles },
              { key: "full-flow", label: "Cinematic Flow", icon: Maximize2 },
            ].map(mode => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key as ViewMode)}
                style={{
                  padding: "6px 12px", fontSize: 12, fontWeight: 600, borderRadius: 6,
                  border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  background: viewMode === mode.key ? "var(--color-blue)" : "transparent",
                  color: viewMode === mode.key ? "#fff" : "var(--text-muted)",
                  transition: "all 0.2s ease"
                }}
              >
                <mode.icon size={13} />
                {mode.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAnimating(!isAnimating)}
            className="btn btn-ghost btn-sm"
            style={{ display: "flex", alignItems: "center", gap: 6, color: isAnimating ? "var(--color-healthy)" : "var(--text-muted)" }}
          >
            {isAnimating ? <Pause size={14} /> : <Play size={14} />}
            {isAnimating ? "Motion Active" : "Motion Paused"}
          </button>

          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.2s ease"
            }}
            className="hover-bg-input"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 3D Motion Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          flex: 1, position: "relative", zIndex: 5, padding: "24px",
          display: "flex", flexDirection: "column", gap: 20, overflow: "hidden",
          perspective: "1200px"
        }}
      >
        {/* Synchronized Metrics Header Readout */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, zIndex: 10,
          background: "rgba(15, 23, 42, 0.6)", padding: "12px 18px", borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)"
        }}>
          {[
            { label: "CPU CORE LOAD", val: activePoint?.cpu ? `${activePoint.cpu.toFixed(1)}%` : "N/A", color: "#3b82f6", icon: Cpu },
            { label: "RAM MEMORY USAGE", val: activePoint?.ram ? `${activePoint.ram.toFixed(1)}%` : "N/A", color: "#a855f7", icon: MemoryStick },
            { label: "SYSTEM 1M LOAD", val: activePoint?.load ? activePoint.load.toFixed(2) : "N/A", color: "#f97316", icon: Activity },
            { label: "NETWORK THROUGHPUT", val: `${((activePoint?.rx || 0) + (activePoint?.tx || 0)).toFixed(1)} KB/s`, color: "#14b8a6", icon: Network },
          ].map((item, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${item.color}20`, border: `1px solid ${item.color}40`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <item.icon size={18} color={item.color} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.5px" }}>{item.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "var(--font-mono)" }}>{item.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 3D Motion Grid of 4 Synchronized Charts */}
        <div style={{
          flex: 1, display: "grid",
          gridTemplateColumns: viewMode === "full-flow" ? "1fr" : "1fr 1fr",
          gridTemplateRows: viewMode === "full-flow" ? "repeat(4, 1fr)" : "1fr 1fr",
          gap: 20,
          transform: viewMode === "stacked-3d"
            ? `rotateX(${rotateX + 25}deg) rotateY(${rotateY * 0.5}deg) translateZ(-50px)`
            : `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 0.15s cubic-bezier(0.1, 0.9, 0.2, 1)",
          position: "relative"
        }}>

          {/* CHART 1: CPU USAGE */}
          <div className="hover-3d" style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            transform: viewMode === "stacked-3d" ? "translateZ(60px)" : "translateZ(0px)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, zIndex: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa", display: "flex", alignItems: "center", gap: 6 }}>
                <Cpu size={15} /> AVERAGE CPU USAGE
              </div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                AVG: <span style={{ color: "#fff" }}>{((points.reduce((a, b) => a + (b.cpu || 0), 0) / points.length) || 0).toFixed(1)}%</span>
              </div>
            </div>

            <div style={{ flex: 1, position: "relative", width: "100%", height: "100%" }}>
              <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="grad-cpu-3d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="glow-cpu" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Gridlines */}
                {[0.25, 0.5, 0.75].map((ratio, i) => (
                  <line key={i} x1="0" y1={180 * ratio} x2="500" y2={180 * ratio} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                ))}

                {/* Area Fill */}
                <path d={buildAreaPath("cpu", 500, 180, 100)} fill="url(#grad-cpu-3d)" />

                {/* Animated Glowing Line */}
                <path d={buildSvgPath("cpu", 500, 180, 100)} fill="none" stroke="#60a5fa" strokeWidth="3" filter="url(#glow-cpu)" />

                {/* Pulsing Motion Wave Indicator */}
                {isAnimating && (
                  <circle
                    cx={(Math.sin(phase) * 0.5 + 0.5) * 500}
                    cy={90 + Math.cos(phase * 2) * 30}
                    r="5"
                    fill="#93c5fd"
                    filter="url(#glow-cpu)"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* CHART 2: RAM USAGE */}
          <div className="hover-3d" style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            transform: viewMode === "stacked-3d" ? "translateZ(40px)" : "translateZ(0px)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, zIndex: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c084fc", display: "flex", alignItems: "center", gap: 6 }}>
                <MemoryStick size={15} /> AVERAGE RAM USAGE
              </div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                AVG: <span style={{ color: "#fff" }}>{((points.reduce((a, b) => a + (b.ram || 0), 0) / points.length) || 0).toFixed(1)}%</span>
              </div>
            </div>

            <div style={{ flex: 1, position: "relative", width: "100%", height: "100%" }}>
              <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="grad-ram-3d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="glow-ram" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {[0.25, 0.5, 0.75].map((ratio, i) => (
                  <line key={i} x1="0" y1={180 * ratio} x2="500" y2={180 * ratio} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                ))}

                <path d={buildAreaPath("ram", 500, 180, 100)} fill="url(#grad-ram-3d)" />
                <path d={buildSvgPath("ram", 500, 180, 100)} fill="none" stroke="#c084fc" strokeWidth="3" filter="url(#glow-ram)" />

                {isAnimating && (
                  <circle
                    cx={(Math.cos(phase * 0.8) * 0.5 + 0.5) * 500}
                    cy={60 + Math.sin(phase * 1.5) * 20}
                    r="5"
                    fill="#e9d5ff"
                    filter="url(#glow-ram)"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* CHART 3: LOAD AVERAGE */}
          <div className="hover-3d" style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))",
            border: "1px solid rgba(249, 115, 22, 0.3)",
            borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            transform: viewMode === "stacked-3d" ? "translateZ(20px)" : "translateZ(0px)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, zIndex: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fb923c", display: "flex", alignItems: "center", gap: 6 }}>
                <Activity size={15} /> SYSTEM LOAD AVERAGE
              </div>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                PEAK: <span style={{ color: "#fff" }}>{Math.max(...points.map(p => p.load || 0), 1).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ flex: 1, position: "relative", width: "100%", height: "100%" }}>
              <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="grad-load-3d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#f97316" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="glow-load" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {[0.25, 0.5, 0.75].map((ratio, i) => (
                  <line key={i} x1="0" y1={180 * ratio} x2="500" y2={180 * ratio} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                ))}

                <path d={buildAreaPath("load", 500, 180, 5)} fill="url(#grad-load-3d)" />
                <path d={buildSvgPath("load", 500, 180, 5)} fill="none" stroke="#fb923c" strokeWidth="3" filter="url(#glow-load)" />

                {isAnimating && (
                  <circle
                    cx={(Math.sin(phase * 1.2) * 0.5 + 0.5) * 500}
                    cy={100 + Math.sin(phase * 3) * 25}
                    r="5"
                    fill="#fed7aa"
                    filter="url(#glow-load)"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* CHART 4: NETWORK I/O */}
          <div className="hover-3d" style={{
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.7))",
            border: "1px solid rgba(20, 184, 166, 0.3)",
            borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            transform: viewMode === "stacked-3d" ? "translateZ(0px)" : "translateZ(0px)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            position: "relative", overflow: "hidden"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, zIndex: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2dd4bf", display: "flex", alignItems: "center", gap: 6 }}>
                <Network size={15} /> TOTAL NETWORK I/O (RX/TX)
              </div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", display: "flex", gap: 10 }}>
                <span style={{ color: "#2dd4bf" }}>● RX</span>
                <span style={{ color: "#f472b6" }}>● TX</span>
              </div>
            </div>

            <div style={{ flex: 1, position: "relative", width: "100%", height: "100%" }}>
              <svg width="100%" height="100%" viewBox="0 0 500 180" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                <defs>
                  <linearGradient id="grad-rx-3d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="grad-tx-3d" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="glow-net" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {[0.25, 0.5, 0.75].map((ratio, i) => (
                  <line key={i} x1="0" y1={180 * ratio} x2="500" y2={180 * ratio} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                ))}

                <path d={buildAreaPath("rx", 500, 180, 100)} fill="url(#grad-rx-3d)" />
                <path d={buildSvgPath("rx", 500, 180, 100)} fill="none" stroke="#2dd4bf" strokeWidth="2.5" filter="url(#glow-net)" />

                <path d={buildAreaPath("tx", 500, 180, 100)} fill="url(#grad-tx-3d)" />
                <path d={buildSvgPath("tx", 500, 180, 100)} fill="none" stroke="#f472b6" strokeWidth="2.5" filter="url(#glow-net)" />

                {isAnimating && (
                  <circle
                    cx={(Math.sin(phase * 1.5) * 0.5 + 0.5) * 500}
                    cy={110 + Math.cos(phase * 2.5) * 25}
                    r="5"
                    fill="#99f6e4"
                    filter="url(#glow-net)"
                  />
                )}
              </svg>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
