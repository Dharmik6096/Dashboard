"use client";

import { useEffect, useState } from "react";
import { Box, ArrowRight, Clock, Network, Database, ActivitySquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ApmDemo() {
  const [pulse, setPulse] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setInterval(() => {
      setPulse(p => p + 1);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow relative">
      <div className="absolute top-4 right-4 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
        Coming in V2
      </div>
      
      <div className="p-6 pb-4">
         <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-6">
           <Box size={24} />
         </div>
         <h3 className="text-xl font-bold text-gray-900 mb-2">Application Performance</h3>
         <p className="text-sm text-gray-500 mb-6">Distributed tracing to find the exact bottleneck.</p>
         
         <div className="bg-[#0b101a] rounded-xl p-5 border border-gray-800 relative overflow-hidden">
            <div className="text-xs font-bold text-gray-400 mb-4 flex items-center gap-2">
               <span className="text-emerald-400 font-mono">POST</span> /api/order 
               <span className="ml-auto text-red-400 font-mono">1.61s</span>
            </div>

            <div className="space-y-3 relative">
               {/* Grid lines */}
               <div className="absolute inset-y-0 right-0 left-[120px] border-l border-gray-800">
                 <div className="absolute inset-y-0 left-1/4 border-l border-gray-800/50" />
                 <div className="absolute inset-y-0 left-2/4 border-l border-gray-800/50" />
                 <div className="absolute inset-y-0 left-3/4 border-l border-gray-800/50" />
               </div>

               {/* Nginx */}
               <div className="flex items-center gap-3 relative z-10">
                 <div className="w-[100px] flex items-center gap-2 text-xs font-semibold text-gray-300">
                    <Network size={12} className="text-blue-400" /> Nginx
                 </div>
                 <div className="flex-1">
                    <motion.div 
                      className="h-4 bg-blue-500/80 rounded" 
                      initial={{ width: 0 }}
                      animate={{ width: "5%" }}
                      transition={{ duration: 0.2 }}
                    />
                 </div>
                 <div className="text-[10px] font-mono text-gray-500 w-[40px] text-right shrink-0">12ms</div>
               </div>

               {/* API */}
               <div className="flex items-center gap-3 relative z-10">
                 <div className="w-[100px] flex items-center gap-2 text-xs font-semibold text-gray-300 pl-4">
                    <ArrowRight size={10} className="text-gray-600" /> <Box size={12} className="text-purple-400" /> API
                 </div>
                 <div className="flex-1 flex">
                    <div className="w-[5%]" />
                    <motion.div 
                      className="h-4 bg-purple-500/80 rounded" 
                      initial={{ width: 0 }}
                      animate={{ width: "95%" }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                    />
                 </div>
                 <div className="text-[10px] font-mono text-gray-500 w-[40px] text-right shrink-0">1.60s</div>
               </div>

               {/* RabbitMQ */}
               <div className="flex items-center gap-3 relative z-10">
                 <div className="w-[100px] flex items-center gap-2 text-xs font-semibold text-gray-300 pl-8">
                    <ArrowRight size={10} className="text-gray-600" /> <ActivitySquare size={12} className="text-amber-400" /> MQ
                 </div>
                 <div className="flex-1 flex">
                    <div className="w-[10%]" />
                    <motion.div 
                      className="h-4 bg-amber-500/80 rounded" 
                      initial={{ width: 0 }}
                      animate={{ width: "8%" }}
                      transition={{ duration: 0.2, delay: 0.3 }}
                    />
                 </div>
                 <div className="text-[10px] font-mono text-gray-500 w-[40px] text-right shrink-0">14ms</div>
               </div>

               {/* DB Bottleneck */}
               <div className="flex items-center gap-3 relative z-10">
                 <div className="w-[100px] flex items-center gap-2 text-xs font-semibold text-gray-300 pl-8">
                    <ArrowRight size={10} className="text-gray-600" /> <Database size={12} className="text-emerald-400" /> Postgres
                 </div>
                 <div className="flex-1 flex items-center relative">
                    <div className="w-[18%]" />
                    <motion.div 
                      key={pulse}
                      className="h-4 bg-red-500 rounded relative" 
                      initial={{ width: 0 }}
                      animate={{ width: "77%" }}
                      transition={{ duration: 0.6, delay: 0.5 }}
                    >
                       <motion.div 
                         className="absolute inset-0 bg-white/20"
                         animate={{ opacity: [0, 1, 0] }}
                         transition={{ duration: 1, repeat: Infinity }}
                       />
                    </motion.div>
                 </div>
                 <div className="text-[10px] font-mono text-red-400 font-bold w-[40px] text-right shrink-0">1.4s</div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
