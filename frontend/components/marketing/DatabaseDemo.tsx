"use client";

import { useState } from "react";
import { Database, AlertTriangle, ArrowRight, Zap, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function DatabaseDemo() {
  const [inspectorOpen, setInspectorOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px] hover:shadow-md transition-shadow relative group">
      
      <div 
        className="p-6 pb-4 flex-1 cursor-pointer"
        onClick={() => setInspectorOpen(true)}
      >
         <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
           <Database size={24} />
         </div>
         <div className="flex items-center gap-3 mb-2">
           <h3 className="text-xl font-bold text-gray-900">Database Insights</h3>
           <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-sm border border-amber-200">Sample Data</span>
         </div>
         <p className="text-sm text-gray-500 mb-6">Pinpoint slow queries and lock contention.</p>
         
         <div className="bg-[#0b101a] rounded-xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
               <div className="flex items-center gap-2 text-white font-semibold">
                  <Database size={16} className="text-blue-500" /> PostgreSQL
               </div>
               <div className="text-xs font-bold bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/20 flex items-center gap-1.5">
                  <AlertTriangle size={12} /> CRITICAL
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Connections</div>
                  <div className="text-lg font-bold text-red-400">100/100</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Latency</div>
                  <div className="text-lg font-bold text-red-400">1.84s</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">TPS</div>
                  <div className="text-lg font-bold text-emerald-400">420</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Storage</div>
                  <div className="text-lg font-bold text-white">620GB</div>
               </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
               <div className="text-[10px] uppercase font-bold text-red-400 mb-2 flex items-center gap-2">
                 Top Slow Query <span className="bg-red-500/20 text-red-400 px-1.5 rounded">1.38s</span>
               </div>
               <div className="font-mono text-[11px] text-gray-300 leading-relaxed truncate">
                 SELECT * FROM orders WHERE status = 'pending' AND user_id = ...
               </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800">
               <div className="text-[10px] uppercase font-bold text-gray-500 mb-2">Transactions Per Second (Live)</div>
               <div className="h-12 flex items-end justify-between gap-1">
                 {Array.from({length: 30}).map((_, i) => (
                   <div 
                     key={i} 
                     className="w-full bg-emerald-500/80 rounded-t-sm" 
                     style={{ height: `${30 + Math.random() * 70}%`, opacity: i > 25 ? 0.5 : 1 }}
                   />
                 ))}
               </div>
            </div>
         </div>
      </div>
      
      <div 
        className="px-6 pb-6 mt-auto cursor-pointer"
        onClick={() => setInspectorOpen(true)}
      >
         <div className="text-sm font-semibold text-emerald-600 flex items-center gap-2 group-hover:gap-3 transition-all">
            Inspect Database <ArrowRight size={16} />
         </div>
      </div>

      <AnimatePresence>
        {inspectorOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, rotateX: 20, y: 20 }}
              animate={{ scale: 1, rotateX: 0, y: 0 }}
              exit={{ scale: 0.9, rotateX: -20, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
              className="w-full bg-[#0a0f1c] border border-blue-500/30 rounded-xl shadow-2xl overflow-hidden relative"
            >
               <div className="flex items-center justify-between p-3 border-b border-[rgba(255,255,255,0.05)] bg-[#121826]">
                  <div className="flex items-center gap-2 text-white font-semibold text-sm">
                    <Database size={16} className="text-blue-400" /> postgres-prod
                  </div>
                  <button onClick={() => setInspectorOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={16} />
                  </button>
               </div>
               <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                     <div className="bg-[#121826] border border-white/5 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-400 uppercase">Engine</div>
                        <div className="text-sm font-bold text-white">PostgreSQL 15</div>
                     </div>
                     <div className="bg-[#121826] border border-white/5 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-400 uppercase">Status</div>
                        <div className="text-sm font-bold text-red-400">Critical</div>
                     </div>
                     <div className="bg-[#121826] border border-white/5 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-400 uppercase">Connections</div>
                        <div className="text-sm font-bold text-red-400">100/100</div>
                     </div>
                     <div className="bg-[#121826] border border-white/5 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-400 uppercase">Latency</div>
                        <div className="text-sm font-bold text-red-400">1.84s</div>
                     </div>
                     <div className="bg-[#121826] border border-white/5 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-400 uppercase">TPS</div>
                        <div className="text-sm font-bold text-emerald-400">420</div>
                     </div>
                     <div className="bg-[#121826] border border-white/5 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-400 uppercase">Storage</div>
                        <div className="text-sm font-bold text-white">620GB</div>
                     </div>
                     <div className="bg-[#121826] border border-white/5 rounded-lg p-2 text-center col-span-2">
                        <div className="text-[10px] text-gray-400 uppercase">Replication</div>
                        <div className="text-sm font-bold text-emerald-400">Synced (1 Replica)</div>
                     </div>
                  </div>

                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm">
                     <div className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">Top Slow Query (1.38s)</div>
                     <div className="bg-[#0b101a] rounded border border-red-500/20 p-2 text-[11px] font-mono text-gray-300">
                        SELECT * FROM orders WHERE status = 'pending' AND user_id = ...
                     </div>
                  </div>

                  <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                     <Zap size={14} /> Analyze with AI
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
