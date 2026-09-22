"use client";

import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, X, ChevronRight, ChevronLeft, LayoutDashboard, Server, Search, Database, Activity, Zap, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

const STEPS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    title: "Unified Observability Workspace",
    description: "Everything in one place — servers, containers, databases, logs, and AI investigation.",
    highlight: { color: "blue", label: "1 Server Online", sub: "13 Containers Running" },
  },
  {
    id: "infra",
    label: "Infrastructure",
    icon: Server,
    title: "Monitor Servers & Containers",
    description: "Real-time CPU, RAM, Disk, and Network metrics for every host and container.",
    highlight: { color: "emerald", label: "CPU: 25%", sub: "RAM: 42% · Disk: 38%" },
  },
  {
    id: "logs",
    label: "Logs",
    icon: Search,
    title: "Centralized Log Analysis",
    description: "Stream, search, and filter logs from every service in real time.",
    highlight: { color: "violet", label: "Log Explorer", sub: "Real-time streaming" },
  },
  {
    id: "db",
    label: "Databases",
    icon: Database,
    title: "Database Performance & Queries",
    description: "Monitor query latency, connection pools, and replication lag for PostgreSQL, MySQL, MongoDB and more.",
    highlight: { color: "amber", label: "Latency: 1.84s", sub: "Connections: 100/100" },
  },
  {
    id: "ai",
    label: "AI Investigation",
    icon: Activity,
    title: "Automated Root Cause Analysis",
    description: "Our AI correlates metrics, logs, and topology to identify root causes in plain English.",
    highlight: { color: "rose", label: "Root Cause Found", sub: "Connection pool exhausted" },
  },
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  blue:    { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20",   badge: "bg-blue-600" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", badge: "bg-emerald-600" },
  violet:  { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20",  badge: "bg-violet-600" },
  amber:   { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",   badge: "bg-amber-600" },
  rose:    { bg: "bg-rose-500/10",   text: "text-rose-400",   border: "border-rose-500/20",    badge: "bg-rose-600" },
};

// Simulated metric cards for each step
function StepContent({ step }: { step: typeof STEPS[0] }) {
  const colors = COLOR_MAP[step.highlight.color];
  const Icon = step.icon;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Panel header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg} border ${colors.border}`}>
          <Icon size={20} className={colors.text} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{step.title}</h3>
          <p className="text-sm text-gray-400">{step.description}</p>
        </div>
      </div>

      {/* Dashboard screenshot embedded in a browser-like frame */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-white/10 bg-[#070b15] shadow-2xl">
        {/* Fake browser chrome */}
        <div className="flex items-center gap-2 px-4 h-9 bg-[#111827] border-b border-white/[0.06]">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-amber-500/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          <div className="flex-1 mx-3 h-5 bg-white/[0.05] rounded text-[10px] text-gray-500 flex items-center px-2">
            devops-monitor.app/{step.id === "overview" ? "app/dashboard" : `app/${step.id}`}
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-bold">LIVE</span>
        </div>

        {/* Actual dashboard image */}
        <div className="relative w-full h-[calc(100%-36px)]">
          <Image
            src="/dashboard-preview.png"
            alt="DevOps Monitor Dashboard"
            fill
            className="object-cover object-top"
            priority
            unoptimized
          />
          {/* Overlay highlight for this step */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b15]/80 via-transparent to-transparent" />

          {/* Step-specific callout */}
          <div className={`absolute bottom-5 left-5 right-5 ${colors.bg} border ${colors.border} rounded-xl p-4 backdrop-blur-sm`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg ${colors.badge} flex items-center justify-center flex-shrink-0`}>
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <div className={`font-bold text-sm ${colors.text} flex items-center gap-2`}>
                  <CheckCircle2 size={14} /> {step.highlight.label}
                </div>
                <div className="text-gray-400 text-xs mt-0.5">{step.highlight.sub}</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Zap size={13} className={colors.text} />
                <span className={`text-xs font-semibold ${colors.text}`}>DevOps Monitor V2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WatchDemoModal() {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const handlePrev = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  useEffect(() => {
    const handleOpen = (e: CustomEvent) => {
      setOpen(true);
      if (e.detail?.step) {
        const stepIdx = STEPS.findIndex(s => s.id === e.detail.step);
        if (stepIdx >= 0) setActiveStep(stepIdx);
      } else {
        setActiveStep(0);
      }
    };
    window.addEventListener("open-watch-demo", handleOpen as EventListener);
    return () => window.removeEventListener("open-watch-demo", handleOpen as EventListener);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="btn-mkt btn-mkt-secondary btn-mkt-lg">
          <Play size={16} /> Watch demo
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay — z-[200] so it is above the header (z-40) */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-gray-950/70 backdrop-blur-sm"
                style={{ zIndex: 200 }}
              />
            </Dialog.Overlay>

            {/* Modal content — z-[201] */}
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                className="fixed left-1/2 -translate-x-1/2 bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden focus:outline-none"
                style={{
                  zIndex: 201,
                  top: "4%",
                  width: "min(95vw, 1160px)",
                  height: "min(88vh, 820px)",
                }}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.07] bg-[#090c12] flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Play size={15} className="text-white" fill="currentColor" />
                    </div>
                    <div>
                      <Dialog.Title className="text-white font-semibold text-sm leading-none">
                        Explore DevOps Monitor V2
                      </Dialog.Title>
                      <Dialog.Description className="text-gray-400 text-xs mt-0.5">
                        Interactive Product Tour
                      </Dialog.Description>
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors focus:outline-none"
                      aria-label="Close tour"
                    >
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Step Tabs */}
                <div className="flex border-b border-white/[0.07] bg-[#090c12] px-5 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: "none" }}>
                  {STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = activeStep === idx;
                    return (
                      <button
                        key={step.id}
                        onClick={() => setActiveStep(idx)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap focus:outline-none ${
                          isActive
                            ? "border-blue-500 text-white"
                            : "border-transparent text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        <Icon size={14} /> {step.label}
                      </button>
                    );
                  })}
                </div>

                {/* Step Content */}
                <div className="flex-1 p-5 overflow-hidden min-h-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -14 }}
                      transition={{ duration: 0.18 }}
                      className="w-full h-full"
                    >
                      <StepContent step={STEPS[activeStep]} />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 border-t border-white/[0.07] bg-[#090c12] flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    {STEPS.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveStep(idx)}
                        className={`rounded-full transition-all ${
                          activeStep === idx
                            ? "w-5 h-2 bg-blue-500"
                            : "w-2 h-2 bg-white/20 hover:bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={handlePrev}
                      disabled={activeStep === 0}
                      className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-white bg-white/10 hover:bg-white/15 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} /> Previous
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={activeStep === STEPS.length - 1}
                      className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
