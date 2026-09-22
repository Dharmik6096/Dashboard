"use client";

import { useState, useEffect } from "react";
import { Server, Activity, HardDrive, Cpu, Search, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function InfraDemo() {
  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState({ cpu: 18, ram: 58, load: 0.72 });

  useEffect(() => {
    const timer = setInterval(() => {
      setMetrics(prev => ({
        cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() * 4 - 2))),
        ram: Math.max(40, Math.min(90, prev.ram + (Math.random() * 2 - 1))),
        load: Math.max(0.1, prev.load + (Math.random() * 0.1 - 0.05)),
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div 
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[400px] cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="p-6 pb-4">
         <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
           <Server size={24} />
         </div>
         <h3 className="text-xl font-bold text-gray-900 mb-2">Infrastructure</h3>
         <p className="text-sm text-gray-500 mb-6">Real-time metrics for every server and container.</p>
         
         <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center font-bold text-xs text-gray-700">web2</div>
                 <div className="text-xs font-semibold text-gray-700">ubuntu-prod</div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Healthy
              </div>
            </div>

            <div className="grid grid-cols-3 gap-y-4 gap-x-2">
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">CPU</div>
                  <div className="text-lg font-bold text-gray-900">{Math.round(metrics.cpu)}%</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">RAM</div>
                  <div className="text-lg font-bold text-gray-900">{Math.round(metrics.ram)}%</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Load</div>
                  <div className="text-lg font-bold text-gray-900">{metrics.load.toFixed(2)}</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Disk</div>
                  <div className="text-lg font-bold text-gray-900">42%</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Uptime</div>
                  <div className="text-lg font-bold text-gray-900">14d</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Containers</div>
                  <div className="text-lg font-bold text-gray-900">13</div>
               </div>
               <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Alerts</div>
                  <div className="text-lg font-bold text-emerald-500">0</div>
               </div>
               <div className="col-span-2">
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Last Seen</div>
                  <div className="text-lg font-bold text-gray-900">3s ago</div>
               </div>
            </div>
         </div>
      </div>
      
      <div className="px-6 pb-6 mt-auto">
         <div className="text-sm font-semibold text-blue-600 flex items-center gap-2 group-hover:gap-3 transition-all">
            {expanded ? "Close inspector" : "Inspect host"} <Activity size={16} />
         </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100 bg-gray-900 overflow-hidden"
          >
            <div className="p-4">
               <div className="text-xs font-bold text-gray-400 mb-3 flex items-center gap-2">
                 <Terminal size={12} /> Top Processes
               </div>
               <div className="space-y-2 font-mono text-[11px]">
                  <div className="flex justify-between text-gray-300">
                    <span>node (api-server)</span>
                    <span className="text-emerald-400">24.2% CPU</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>postgres</span>
                    <span className="text-gray-400">4.1% CPU</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>nginx</span>
                    <span className="text-gray-400">1.2% CPU</span>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
