"use client";

import { Server, ShieldAlert, Cpu, Activity, Search, XCircle, ArrowRight, X, ShieldCheck, Database, CheckCircle2, Box } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

export function ReadOnlyArchitecture() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full bg-[#03060c] border border-[rgba(255,255,255,0.05)] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative p-8 md:p-12">
       
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
       <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-500/5 blur-[100px] rounded-full pointer-events-none" />

       <div className="flex items-center gap-3 mb-10 relative z-10">
         <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10">
           <ShieldCheck size={24} className="text-emerald-400" />
         </div>
         <div>
           <h3 className="font-bold text-2xl text-white">Strict Read-Only Enforcement</h3>
           <p className="text-sm text-gray-400">The platform is architected to be incapable of modifying your infrastructure.</p>
         </div>
       </div>

       <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 w-full relative z-10">
          
          {/* Main Data Flow */}
          <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 bg-[#0a0f1c] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 relative">
             
             {/* Monitored Server */}
             <div className="w-48 bg-[#121826] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-xl p-5 flex flex-col items-center gap-3 z-10">
                <Server size={36} className="text-gray-400" />
                <div className="text-center">
                   <div className="font-bold text-white text-sm">Customer VPC</div>
                   <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Linux Server</div>
                </div>
             </div>

             {/* Connection Line */}
             <div className="flex flex-col items-center flex-1 min-w-[100px] relative">
                <div className="w-full h-0.5 bg-gradient-to-r from-gray-700 via-emerald-500 to-blue-500 relative">
                   <motion.div 
                     initial={{ x: "-100%", opacity: 0 }}
                     animate={isVisible ? { x: "100%", opacity: 1 } : {}}
                     transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                     className="absolute top-1/2 -translate-y-1/2 left-0 w-8 h-2 bg-emerald-400 blur-sm rounded-full" 
                   />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0a0f1c] px-3 py-1 border border-emerald-500/30 rounded-full flex items-center gap-1.5 shadow-lg">
                   <CheckCircle2 size={14} className="text-emerald-400" />
                   <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Read Only</span>
                </div>
             </div>

             {/* SSH Collector */}
             <motion.div 
               initial={{ scale: 0.95 }}
               animate={isVisible ? { scale: 1 } : {}}
               className="w-56 bg-gradient-to-b from-[#1a2333] to-[#121826] rounded-2xl shadow-2xl flex flex-col items-center p-5 border border-blue-500/30 relative z-10"
             >
                <div className="text-white font-bold text-sm mb-4">DevOps Monitor Core</div>
                <div className="w-full grid grid-cols-2 gap-2">
                   {['Metrics', 'Docker', 'Storage', 'Network', 'Postgres', 'Logs'].map((item) => (
                     <div key={item} className="bg-blue-500/10 text-blue-300 text-[11px] font-bold py-1.5 px-2 rounded border border-blue-500/20 text-center">
                       {item}
                     </div>
                   ))}
                </div>
             </motion.div>
          </div>

          {/* Blocked Actions Panel */}
          <div className="w-full lg:w-[320px] bg-red-950/20 border border-red-500/20 rounded-2xl p-6 flex flex-col gap-4 shrink-0 shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-2xl rounded-full" />
             <div className="flex items-center gap-2 border-b border-red-500/20 pb-3 relative z-10">
                <XCircle size={18} className="text-red-500" />
                <span className="text-white font-bold text-sm">Systemically Blocked Actions</span>
             </div>
             
             <div className="flex flex-col gap-3 relative z-10">
                {[
                  { label: "Restart Services", icon: Server },
                  { label: "Kill Containers", icon: Box },
                  { label: "Delete Data", icon: Database },
                  { label: "Modify Configs", icon: Activity }
                ].map((action, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#0a0f1c]/80 backdrop-blur border border-red-500/20 rounded-lg p-3">
                     <div className="flex items-center gap-3">
                        <action.icon size={16} className="text-gray-500" />
                        <span className="font-bold text-[13px] text-gray-300">{action.label}</span>
                     </div>
                     <div className="bg-red-500/10 text-red-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 border border-red-500/20">
                        <X size={10} /> Denied
                     </div>
                  </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
}
