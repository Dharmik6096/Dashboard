"use client";

import { useState } from "react";
import { Server, Database, Box, Network, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Metric = { label: string; value: string | number };

type TechData = {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  metrics: Metric[];
};

const TECHNOLOGIES: TechData[] = [
  { id: "linux", name: "Linux OS", icon: Terminal, color: "text-gray-700", metrics: [
    { label: "CPU Usage", value: "42%" }, { label: "Memory", value: "18GB / 32GB" }, { label: "System Load", value: "1.24" }, { label: "Disk IOPS", value: "1,420" },
  ]},
  { id: "docker", name: "Docker", icon: Box, color: "text-blue-500", metrics: [
    { label: "Containers", value: "24 Running" }, { label: "Restart Loops", value: "0" }, { label: "CPU Throttling", value: "2%" }, { label: "Network I/O", value: "14MB/s" },
  ]},
  { id: "postgres", name: "PostgreSQL", icon: Database, color: "text-blue-700", metrics: [
    { label: "Connections", value: "89/100" }, { label: "Transactions/sec", value: "420" }, { label: "Cache Hit", value: "99.8%" }, { label: "Slow Queries", value: "2/min" },
  ]},
  { id: "mysql", name: "MySQL", icon: Database, color: "text-amber-500", metrics: [
    { label: "Threads Running", value: "12" }, { label: "Queries/sec", value: "850" }, { label: "InnoDB Buffer", value: "84%" }, { label: "Slow Queries", value: "0" },
  ]},
  { id: "mongodb", name: "MongoDB", icon: Database, color: "text-green-600", metrics: [
    { label: "Operations/sec", value: "1,200" }, { label: "Connections", value: "45" }, { label: "Page Faults", value: "5/s" }, { label: "Replication Lag", value: "12ms" },
  ]},
  { id: "redis", name: "Redis", icon: Database, color: "text-red-500", metrics: [
    { label: "Used Memory", value: "4.2GB" }, { label: "Commands/sec", value: "4,500" }, { label: "Evictions", value: "0" }, { label: "Hit Rate", value: "94%" },
  ]},
  { id: "rabbitmq", name: "RabbitMQ", icon: Network, color: "text-orange-500", metrics: [
    { label: "Queued Msgs", value: "1,420" }, { label: "Publish Rate", value: "450/s" }, { label: "Deliver Rate", value: "445/s" }, { label: "Connections", value: "82" },
  ]},
  { id: "nginx", name: "Nginx", icon: Network, color: "text-emerald-500", metrics: [
    { label: "Active Conns", value: "1,240" }, { label: "Requests/sec", value: "850" }, { label: "5xx Errors", value: "0" }, { label: "Upstream Latency", value: "42ms" },
  ]},
];

export function TechnologyOrbit() {
  const [activeTech, setActiveTech] = useState<TechData>(TECHNOLOGIES[1]);

  return (
    <div className="w-full bg-white border border-gray-200 rounded-3xl p-6 md:p-10 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start lg:items-center">

        {/* Left: Copy + Pills */}
        <div className="flex flex-col gap-5 w-full lg:w-1/2">
          <div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Deep integration with your stack.</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              We don&apos;t just say a service is &quot;up&quot;. We pull the specific metrics that matter for that technology.
            </p>
          </div>

          {/* Technology pills */}
          <div className="flex flex-wrap gap-2">
            {TECHNOLOGIES.map((tech) => {
              const isActive = activeTech?.id === tech.id;
              return (
                <button
                  key={tech.id}
                  onClick={() => setActiveTech(tech)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs border transition-all duration-150 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm ring-1 ring-blue-500/20"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <tech.icon
                    size={12}
                    className={isActive ? "text-blue-600" : tech.color}
                  />
                  {tech.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Metrics Panel */}
        <div className="w-full lg:w-1/2 bg-gray-50 border border-gray-200 rounded-2xl p-6 min-h-[240px] flex items-center justify-center shadow-inner overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTech && (
              <motion.div
                key={activeTech.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col items-center w-full"
              >
                {/* Icon */}
                <div className="w-14 h-14 bg-white border border-gray-200 rounded-2xl flex items-center justify-center shadow-sm mb-3">
                  <activeTech.icon size={28} className={activeTech.color} />
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-5">
                  Live Inspection Data
                </div>

                {/* Metrics grid */}
                <div className="grid grid-cols-2 gap-2.5 w-full">
                  {activeTech.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm"
                    >
                      <div className="text-[9px] uppercase font-bold text-gray-400 mb-1 tracking-wider">
                        {metric.label}
                      </div>
                      <div className="text-base font-bold text-gray-900 tabular-nums">
                        {metric.value}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
