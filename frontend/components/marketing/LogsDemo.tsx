"use client";

import { useEffect, useState, useRef } from "react";
import { Search, ChevronDown, Filter, Zap, Terminal, Server, Box, Database, AlignLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type LogEntry = {
  id: number;
  time: string;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  service: string;
};

const LOG_MESSAGES = [
  { level: "INFO", message: "API request GET /users", service: "api-service" },
  { level: "INFO", message: "Authentication successful for user_id=8192", service: "auth-service" },
  { level: "WARN", message: "Connection pool utilization at 92/100", service: "postgres-prod" },
  { level: "INFO", message: "Worker job #41920 finished", service: "worker-node" },
  { level: "INFO", message: "Cache hit for key user:8192", service: "redis-cache" },
];

export function LogsDemo() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [counter, setCounter] = useState(0);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate initial logs
  useEffect(() => {
    const initial: LogEntry[] = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      time: `14:32:0${Math.floor(i/2)}`,
      level: "INFO",
      message: "API request GET /status",
      service: "api-service",
    }));
    setLogs(initial);
    setCounter(30);
  }, []);

  // Live tailing
  useEffect(() => {
    const timer = setInterval(() => {
      setCounter(c => {
        const nc = c + 1;
        const msgTpl = LOG_MESSAGES[nc % LOG_MESSAGES.length];
        
        // Inject the specific error at a certain interval to demonstrate the feature
        let isError = nc % 15 === 0;
        
        const newLog: LogEntry = isError ? {
          id: nc,
          time: `14:${Math.floor(nc/60).toString().padStart(2, '0')}:${(nc%60).toString().padStart(2, '0')}`,
          level: "ERROR",
          message: "DB connection timeout. Pool exhausted.",
          service: "postgres-prod"
        } : {
          id: nc,
          time: `14:${Math.floor(nc/60).toString().padStart(2, '0')}:${(nc%60).toString().padStart(2, '0')}`,
          level: msgTpl.level as any,
          message: msgTpl.message,
          service: msgTpl.service
        };

        setLogs(prev => {
          const next = [...prev, newLog];
          if (next.length > 50) return next.slice(next.length - 50);
          return next;
        });

        // Auto-scroll
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        return nc;
      });
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#0b101a] border border-gray-800 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[400px]">
      
      {/* Header */}
      <div className="p-4 pb-0 flex flex-col gap-4 bg-[#121826] border-b border-[rgba(255,255,255,0.05)] shrink-0 z-10">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/10 text-blue-400 rounded flex items-center justify-center">
               <AlignLeft size={16} />
            </div>
            <h3 className="text-white font-bold flex items-center gap-2">
              Centralized Log Explorer
              <span className="bg-amber-500/20 text-amber-500 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow-sm border border-amber-500/30">Demo Logs</span>
            </h3>
         </div>

         {/* Search Bar */}
         <div className="flex gap-2">
            <div className="flex-1 bg-[#06090f] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 flex items-center gap-2">
               <Search size={14} className="text-gray-500" />
               <span className="text-sm text-gray-300 font-mono">service:api-service level:error</span>
            </div>
            <button className="px-3 py-2 bg-[#06090f] border border-[rgba(255,255,255,0.08)] rounded-lg text-gray-400 flex items-center gap-2">
               <Filter size={14} /> Filter
            </button>
         </div>

         {/* Fake Volume Histogram */}
         <div className="h-12 flex items-end gap-[2px] pt-2 pb-2">
            {Array.from({ length: 40 }).map((_, i) => (
              <div 
                key={i} 
                className={`w-full rounded-t-sm ${i === 35 ? 'bg-red-500' : 'bg-blue-500/30'}`}
                style={{ height: `${i === 35 ? 100 : 20 + Math.random() * 40}%` }}
              />
            ))}
         </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto relative p-2 scroll-smooth" ref={scrollRef}>
         <div className="flex flex-col min-h-full justify-end font-mono text-[11px] leading-[1.6]">
            <AnimatePresence initial={false}>
               {logs.map(log => (
                 <motion.div 
                   key={log.id}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className={`flex gap-3 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer ${log.level === 'ERROR' ? 'bg-red-500/10 border-l-2 border-red-500 text-red-200 hover:bg-red-500/20' : 'text-gray-400 border-l-2 border-transparent'}`}
                   onClick={() => log.level === 'ERROR' && setInspectorOpen(true)}
                 >
                    <div className="text-gray-600 shrink-0 w-16">{log.time}</div>
                    <div className={`shrink-0 w-10 font-bold ${log.level === 'INFO' ? 'text-blue-400' : log.level === 'WARN' ? 'text-amber-400' : 'text-red-400'}`}>
                      {log.level}
                    </div>
                    <div className="shrink-0 w-24 text-gray-500 truncate">[{log.service}]</div>
                    <div className="flex-1 break-all">{log.message}</div>
                 </motion.div>
               ))}
            </AnimatePresence>
         </div>
      </div>

      {/* Inline Inspector Context */}
      <AnimatePresence>
        {inspectorOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-red-500/20 bg-[#150f14] shrink-0"
          >
            <div className="p-4 flex flex-col gap-3">
               <div className="flex items-center justify-between mb-1">
                 <div className="text-sm font-bold text-red-400 flex items-center gap-2">
                   <Terminal size={14} /> Log Context
                 </div>
                 <button onClick={() => setInspectorOpen(false)} className="text-gray-500 hover:text-white">
                   <ChevronDown size={16} />
                 </button>
               </div>
               
               <div className="grid grid-cols-3 gap-3">
                  <div className="bg-black/30 border border-white/5 rounded p-2 flex flex-col gap-1">
                     <div className="text-[10px] text-gray-500 uppercase font-bold">Related Server</div>
                     <div className="text-xs text-gray-300 flex items-center gap-1.5"><Server size={12} className="text-emerald-500"/> web2</div>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded p-2 flex flex-col gap-1">
                     <div className="text-[10px] text-gray-500 uppercase font-bold">Related Container</div>
                     <div className="text-xs text-gray-300 flex items-center gap-1.5"><Box size={12} className="text-blue-500"/> api-service</div>
                  </div>
                  <div className="bg-black/30 border border-red-500/20 rounded p-2 flex flex-col gap-1 cursor-pointer hover:bg-red-500/10 transition-colors">
                     <div className="text-[10px] text-red-500/80 uppercase font-bold">Related Incident</div>
                     <div className="text-xs text-red-400 font-bold flex items-center gap-1.5">INC-0182 <Zap size={12}/></div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
