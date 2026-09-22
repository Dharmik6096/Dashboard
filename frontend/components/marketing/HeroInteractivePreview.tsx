"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Activity, AlertTriangle, Zap } from "lucide-react";
import { motion } from "framer-motion";

export function HeroInteractivePreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const mouseX = useRef(0);
  const mouseY = useRef(0);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || window.innerWidth < 1024) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    targetX.current = y * 6;
    targetY.current = x * 8;
  }, []);

  const onMouseLeave = useCallback(() => {
    targetX.current = 0;
    targetY.current = 0;
    setIsHovered(false);
  }, []);

  const raf = useCallback(() => {
    mouseX.current += (targetX.current - mouseX.current) * 0.07;
    mouseY.current += (targetY.current - mouseY.current) * 0.07;
    if (frameRef.current) {
      if (window.innerWidth >= 1024) {
        frameRef.current.style.transform = `rotateX(${3 + mouseX.current}deg) rotateY(${-7 + mouseY.current}deg) rotateZ(-0.5deg) scale(${isHovered ? 1.02 : 1})`;
      } else {
        frameRef.current.style.transform = "scale(1)";
      }
    }
    rafRef.current = requestAnimationFrame(raf);
  }, [isHovered]);

  useEffect(() => {
    if (!reducedMotion) rafRef.current = requestAnimationFrame(raf);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [raf, reducedMotion]);

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={onMouseLeave}
      style={{ perspective: "1200px", userSelect: "none" }}
      className="relative w-full"
    >
      {/* 3D tilted frame */}
      <div
        ref={frameRef}
        style={{
          transformStyle: "preserve-3d",
          transform: "rotateX(3deg) rotateY(-7deg) rotateZ(-0.5deg)",
          transition: "transform 0.1s linear",
        }}
        className="relative w-full rounded-2xl overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] border border-white/10"
      >
        {/* Browser chrome top bar */}
        <div className="flex items-center gap-2 px-4 h-10 bg-[#111827] border-b border-white/[0.06] flex-shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-amber-500/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
          <div className="flex-1 mx-3 h-6 bg-white/[0.05] rounded-md flex items-center px-3 gap-2">
            <Activity size={11} className="text-blue-400" />
            <span className="text-[11px] text-gray-400 font-mono">devops-monitor.app/app/dashboard</span>
            <span className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-bold">LIVE</span>
            </span>
          </div>
        </div>

        {/* Real dashboard screenshot */}
        <div className="relative w-full aspect-[16/10] bg-[#0a0f1c]">
          <Image
            src="/dashboard-preview.png"
            alt="DevOps Monitor Dashboard — Live Overview"
            fill
            className="object-cover object-top"
            priority
            unoptimized
          />

          {/* Subtle gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

          {/* Floating incident badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: "spring" }}
            className="absolute top-4 right-4 bg-red-600/95 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xl backdrop-blur-sm flex items-center gap-2 border border-red-400/30"
          >
            <AlertTriangle size={12} />
            CRITICAL INCIDENT — INC-0182
          </motion.div>

          {/* Floating AI badge */}
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8, type: "spring" }}
            className="absolute bottom-5 left-5 bg-blue-600/90 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-xl backdrop-blur-sm flex items-center gap-2 border border-blue-400/20"
          >
            <Zap size={12} className="text-blue-200" />
            AI Root Cause identified
          </motion.div>
        </div>
      </div>

      {/* Reflection glow */}
      <div className="absolute -bottom-8 inset-x-[10%] h-24 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />
    </div>
  );
}
