"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, CheckCircle2, Search, Database, Network, Box, AlertTriangle, ArrowRight, Play, Server, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type AIPhase = 'idle' | 'telemetry' | 'correlations' | 'rootcause' | 'insight';

const EVIDENCE = [
  { metric: 'API Latency',       before: '45ms',   after: '1.84s', status: 'critical', icon: Network },
  { metric: 'DB Connections',    before: '12',  after: '100 (Max)', status: 'critical', icon: Database },
  { metric: 'DB Host CPU',       before: '12%',    after: '89%',      status: 'critical', icon: Server },
  { metric: 'App Host CPU',      before: '24%',    after: '26%',      status: 'ok', icon: Server },
];

export function AIInvestigationDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<AIPhase>('idle');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const runAnalysis = () => {
    if (phase !== 'idle' && phase !== 'insight') return;
    setPhase('telemetry');
    
    setTimeout(() => setPhase('correlations'), 2500);
    setTimeout(() => setPhase('rootcause'), 5000);
    setTimeout(() => setPhase('insight'), 7500);
  };

  useEffect(() => {
    if (isVisible && phase === 'idle') {
      setTimeout(runAnalysis, 1000);
    }
  }, [isVisible]);

  return (
    <div ref={containerRef} className="w-full bg-[#0a0f1c] rounded-3xl overflow-hidden border border-[rgba(255,255,255,0.05)] shadow-2xl relative">
       
       <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />

       {/* Top Header */}
       <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.05)] bg-[#0d1322] flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <Zap size={20} className="text-white" />
             </div>
             <div>
                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                  AI Root Cause Engine
                  <span className="bg-amber-500/20 text-amber-500 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded shadow-sm border border-amber-500/30">Sample Incident</span>
                </h3>
                <p className="text-xs text-blue-400 font-semibold tracking-wider uppercase">Automated Investigation</p>
             </div>
          </div>
          <button 
            onClick={runAnalysis}
            disabled={phase !== 'idle' && phase !== 'insight'}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {phase === 'insight' ? 'Re-run Analysis' : <><Play size={14}/> Analyze Incident</>}
          </button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[400px]">
          
          {/* Left Sidebar: Phases */}
          <div className="lg:col-span-4 bg-[#080b14] border-b lg:border-b-0 lg:border-r border-[rgba(255,255,255,0.05)] p-6 flex flex-col gap-6 relative z-10">
             
             <div className={`flex gap-4 ${phase === 'telemetry' ? 'opacity-100' : phase === 'idle' ? 'opacity-30' : 'opacity-70'}`}>
               <div className="relative flex flex-col items-center">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${phase === 'telemetry' ? 'bg-blue-500 text-white' : phase === 'idle' ? 'bg-white/10 text-white/50' : 'bg-emerald-500 text-white'}`}>
                   {phase === 'idle' || phase === 'telemetry' ? <Search size={14}/> : <CheckCircle2 size={14}/>}
                 </div>
                 <div className="w-0.5 h-10 bg-white/10 my-2" />
               </div>
               <div className="pt-1.5">
                 <div className={`font-bold text-sm ${phase === 'telemetry' ? 'text-blue-400' : 'text-gray-400'}`}>Gathering Telemetry</div>
                 <div className="text-xs text-gray-500 mt-1">Collecting logs and metrics from the last 15 minutes.</div>
               </div>
             </div>

             <div className={`flex gap-4 ${phase === 'correlations' ? 'opacity-100' : phase === 'idle' || phase === 'telemetry' ? 'opacity-30' : 'opacity-70'}`}>
               <div className="relative flex flex-col items-center">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${phase === 'correlations' ? 'bg-indigo-500 text-white' : phase === 'idle' || phase === 'telemetry' ? 'bg-white/10 text-white/50' : 'bg-emerald-500 text-white'}`}>
                   {phase === 'rootcause' || phase === 'insight' ? <CheckCircle2 size={14}/> : <Network size={14}/>}
                 </div>
                 <div className="w-0.5 h-10 bg-white/10 my-2" />
               </div>
               <div className="pt-1.5">
                 <div className={`font-bold text-sm ${phase === 'correlations' ? 'text-indigo-400' : 'text-gray-400'}`}>Finding Correlations</div>
                 <div className="text-xs text-gray-500 mt-1">Analyzing cross-service dependencies and anomaly timing.</div>
               </div>
             </div>

             <div className={`flex gap-4 ${phase === 'rootcause' ? 'opacity-100' : phase === 'insight' ? 'opacity-70' : 'opacity-30'}`}>
               <div className="relative flex flex-col items-center">
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${phase === 'rootcause' ? 'bg-amber-500 text-white' : phase === 'insight' ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'}`}>
                   {phase === 'insight' ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}
                 </div>
               </div>
               <div className="pt-1.5">
                 <div className={`font-bold text-sm ${phase === 'rootcause' ? 'text-amber-400' : 'text-gray-400'}`}>Isolating Root Cause</div>
                 <div className="text-xs text-gray-500 mt-1">Filtering out symptomatic alerts to find the origin.</div>
               </div>
             </div>

          </div>

          {/* Right Area: Interactive Display */}
          <div className="lg:col-span-8 p-4 md:p-8 relative flex flex-col justify-center bg-[#0a0f1c] min-h-[400px] lg:min-h-0">
             
             {/* Background Grid */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
             
             <AnimatePresence mode="wait">
                
                {phase === 'telemetry' && (
                  <motion.div 
                    key="telemetry"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex flex-col items-center text-center gap-6"
                  >
                     <div className="relative w-32 h-32 flex items-center justify-center">
                       <motion.div 
                         animate={{ rotate: 360 }} 
                         transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                         className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500"
                       />
                       <motion.div 
                         animate={{ rotate: -360 }} 
                         transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                         className="absolute inset-4 rounded-full border-2 border-indigo-500/20 border-b-indigo-500"
                       />
                       <Search size={32} className="text-blue-400" />
                     </div>
                     <div>
                       <div className="text-xl font-bold text-white mb-2">Scanning 1.2M Datapoints</div>
                       <div className="text-sm text-gray-400 max-w-md">Querying logs across 300+ containers and analyzing 24,000 active metric streams...</div>
                     </div>
                  </motion.div>
                )}

                {phase === 'correlations' && (
                  <motion.div 
                    key="correlations"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-lg mx-auto"
                  >
                     <div className="text-lg font-bold text-indigo-400 mb-6 flex items-center gap-2">
                       <Network size={20}/> Anomaly Graph Built
                     </div>
                     <div className="space-y-4">
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                           <div className="w-10 h-10 rounded bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                             <Activity size={18} />
                           </div>
                           <div className="flex-1">
                             <div className="text-sm font-bold text-white">API Latency Spiked</div>
                             <div className="text-xs text-gray-400">14:02:12 UTC</div>
                           </div>
                           <div className="text-xs font-mono text-red-400 bg-red-500/10 px-2 py-1 rounded">240% ↑</div>
                        </div>
                        <div className="flex justify-center -my-2 relative z-10">
                           <ArrowRight size={16} className="text-gray-600 rotate-90" />
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                           <div className="w-10 h-10 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                             <Database size={18} />
                           </div>
                           <div className="flex-1">
                             <div className="text-sm font-bold text-white">PostgreSQL Connections Maxed</div>
                             <div className="text-xs text-gray-400">14:02:11 UTC (1s prior)</div>
                           </div>
                           <div className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-1 rounded">100/100</div>
                        </div>
                     </div>
                  </motion.div>
                )}

                {(phase === 'rootcause' || phase === 'insight') && (
                   <motion.div 
                     key="rootcause"
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="w-full relative z-10 flex flex-col gap-6"
                   >
                      {/* Top Summary */}
                      <div className="flex justify-between items-start border-b border-white/10 pb-4">
                         <div>
                           <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">AI Investigation Report</div>
                           <h2 className="text-xl font-bold text-white leading-snug">
                             PostgreSQL Connection Pool Exhaustion
                           </h2>
                         </div>
                         <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <div className="text-xs font-bold text-emerald-400">98% Confidence</div>
                         </div>
                      </div>

                      {/* Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="bg-[#121826] border border-white/5 rounded-xl p-4 flex flex-col gap-2 md:col-span-2">
                            <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Root Cause</div>
                            <div className="text-sm text-gray-300">The <code className="bg-white/10 px-1 rounded text-white">checkout-service</code> is exhausting the PostgreSQL connection pool due to a sudden surge in traffic combined with long-running transactions holding connections open.</div>
                         </div>
                         
                         <div className="bg-[#121826] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                            <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Likely Trigger</div>
                            <div className="text-sm text-gray-300">Deploy #1492 (20 mins ago) introduced a new cart validation query that lacks an index, causing transaction durations to spike.</div>
                         </div>

                         <div className="bg-[#121826] border border-white/5 rounded-xl p-4 flex flex-col gap-2">
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Related Resources</div>
                            <div className="text-sm text-gray-300 flex flex-wrap gap-2">
                               <span className="bg-white/10 px-2 py-0.5 rounded flex items-center gap-1"><Database size={12}/> postgres-prod</span>
                               <span className="bg-white/10 px-2 py-0.5 rounded flex items-center gap-1"><Box size={12}/> checkout-service</span>
                               <span className="bg-white/10 px-2 py-0.5 rounded flex items-center gap-1"><Network size={12}/> api-gateway</span>
                            </div>
                         </div>
                      </div>

                      {/* Evidence (Related Signals) */}
                      <div>
                         <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">Related Signals</div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {EVIDENCE.map((item, i) => (
                               <div key={i} className="bg-[#121826] border border-white/5 rounded-lg p-3 flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                     <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                                        <item.icon size={14} className="text-gray-500" /> {item.metric}
                                     </div>
                                     <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'critical' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                  </div>
                                  <div className="flex items-center gap-2 font-mono text-[10px]">
                                     <span className="text-gray-400">{item.before}</span>
                                     <ArrowRight size={10} className="text-gray-600" />
                                     <span className={`font-bold ${item.status === 'critical' ? 'text-red-400' : 'text-emerald-400'}`}>{item.after}</span>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                      
                      {phase === 'insight' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                          className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 items-start mt-2"
                        >
                           <Zap size={18} className="text-blue-400 mt-0.5 shrink-0" />
                           <div className="text-sm text-blue-100 leading-relaxed">
                             <span className="font-bold text-blue-400">Recommendation:</span> Revert Deploy #1492 or immediately add an index on <code className="bg-blue-500/20 px-1 rounded">cart_items(user_id, status)</code>.
                           </div>
                        </motion.div>
                      )}
                   </motion.div>
                )}

             </AnimatePresence>
          </div>
       </div>
    </div>
  );
}
