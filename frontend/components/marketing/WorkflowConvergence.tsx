"use client";

import { useEffect, useState, useRef } from "react";
import { Activity, BarChart2, Database, Search, AlertTriangle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SOURCES = [
  { icon: BarChart2, label: "Metrics", color: "#3b82f6", borderColor: "border-blue-500/30", textColor: "text-blue-400", shadow: "shadow-blue-900/20" },
  { icon: Search, label: "Logs", color: "#10b981", borderColor: "border-emerald-500/30", textColor: "text-emerald-400", shadow: "shadow-emerald-900/20" },
  { icon: Database, label: "DB", color: "#6366f1", borderColor: "border-indigo-500/30", textColor: "text-indigo-400", shadow: "shadow-indigo-900/20" },
  { icon: AlertTriangle, label: "Alerts", color: "#f43f5e", borderColor: "border-rose-500/30", textColor: "text-rose-400", shadow: "shadow-rose-900/20" },
];

export function WorkflowConvergence() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setIsVisible(true);
    }, { threshold: 0.2 });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full bg-[#070b15] rounded-2xl border border-white/[0.06] overflow-hidden"
    >
      {/* Mobile Layout: Stacked vertical */}
      <div className="flex flex-col md:hidden gap-0">
        {/* Sources */}
        <div className="grid grid-cols-2 gap-3 p-6">
          {SOURCES.map((src) => (
            <div
              key={src.label}
              className={`bg-[#121826] border ${src.borderColor} ${src.textColor} font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm`}
            >
              <src.icon size={15} />
              {src.label}
            </div>
          ))}
        </div>

        {/* Divider with center icon */}
        <div className="flex items-center justify-center py-4 relative">
          <div className="absolute inset-x-0 h-px bg-white/5 top-1/2" />
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={isVisible ? { scale: 1, opacity: 1 } : {}}
            transition={{ delay: 0.2, type: "spring" }}
            className="relative w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)] border border-blue-400/30 z-10"
          >
            <Activity size={22} className="text-white" />
          </motion.div>
        </div>

        {/* Result */}
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={isVisible ? { y: 0, opacity: 1 } : {}}
          transition={{ delay: 0.4, type: "spring" }}
          className="m-4 mt-0 bg-[#0a0f1c] border border-blue-500/20 rounded-xl p-5 flex flex-col gap-3 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full" />
          <div className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-3 relative z-10 text-sm">
            <Activity size={16} className="text-blue-500" /> Unified Investigation
          </div>
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 relative z-10">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <div><span className="font-bold">INC-0182:</span> DB Latency Spike detected on postgres-prod.</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 relative z-10">
            <Zap size={13} className="shrink-0 mt-0.5" />
            <div><span className="font-bold">AI Root Cause:</span> Connection pool exhausted during checkout surge.</div>
          </div>
        </motion.div>
      </div>

      {/* Desktop Layout: Horizontal */}
      <div className="hidden md:flex items-center justify-center gap-8 lg:gap-14 p-10 lg:p-14 relative min-h-[320px]">

        {/* Background SVG lines */}
        {isVisible && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <g>
              {SOURCES.map((src, i) => {
                const yPositions = [20, 37, 63, 80];
                const y = `${yPositions[i]}%`;
                return (
                  <path
                    key={src.label}
                    d={`M 22% ${y} C 38% ${y}, 38% 50%, 48% 50%`}
                    stroke={src.color}
                    strokeOpacity="0.45"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="5 5"
                    className="animate-pulse"
                    style={{ animationDelay: `${i * 180}ms` }}
                  />
                );
              })}
              <path d="M 52% 50% L 60% 50%" stroke="#3b82f6" strokeOpacity="0.8" strokeWidth="3" fill="none" />
              <circle cx="56%" cy="50%" r="5" fill="#3b82f6" opacity="0.9">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </g>
          </svg>
        )}

        {/* LEFT: Fragmented Sources */}
        <div className="flex flex-col gap-3 z-10 w-[160px] shrink-0">
          {SOURCES.map((src) => (
            <div
              key={src.label}
              className={`bg-[#121826] border ${src.borderColor} ${src.textColor} font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg`}
            >
              <src.icon size={15} />
              {src.label}
            </div>
          ))}
        </div>

        {/* CENTER: DevOps Monitor */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={isVisible ? { scale: 1, opacity: 1 } : {}}
          transition={{ delay: 0.2, type: "spring" }}
          className="z-10 w-[60px] h-[60px] shrink-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.6)] border border-blue-400/30"
        >
          <Activity size={26} className="text-white" />
        </motion.div>

        {/* RIGHT: Unified Investigation Workspace */}
        <motion.div
          initial={{ x: 40, opacity: 0 }}
          animate={isVisible ? { x: 0, opacity: 1 } : {}}
          transition={{ delay: 0.35, type: "spring" }}
          className="z-10 w-[300px] shrink-0 bg-[#0a0f1c] border border-blue-500/20 rounded-2xl p-5 shadow-2xl flex flex-col gap-3 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-28 h-28 bg-blue-500/10 blur-3xl rounded-full" />
          <div className="text-white font-bold flex items-center gap-2 border-b border-white/5 pb-3 relative z-10 text-sm">
            <Activity size={16} className="text-blue-500" /> Unified Investigation
          </div>
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 relative z-10">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            <div><span className="font-bold">INC-0182:</span> DB Latency Spike detected on postgres-prod.</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 relative z-10">
            <Zap size={13} className="shrink-0 mt-0.5" />
            <div><span className="font-bold">AI Root Cause:</span> Connection pool exhausted during checkout surge.</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
