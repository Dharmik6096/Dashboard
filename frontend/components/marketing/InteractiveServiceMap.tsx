"use client";

import { useState, useEffect } from "react";
import { Server, Database, Box, Network, Activity, Zap, Shield, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type NodeType = "nginx" | "api" | "postgres" | "redis" | "rabbitmq" | "worker";

const NODE_DETAILS: Record<NodeType, {
  label: string;
  statusColor: string;
  statusLabel: string;
  statusBg: string;
  alert?: string;
  metrics: { label: string; value: string; color: string }[];
  cta?: boolean;
}> = {
  nginx: {
    label: "Nginx Load Balancer",
    statusColor: "text-emerald-400",
    statusLabel: "Healthy Resource",
    statusBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    metrics: [
      { label: "Active Connections", value: "1,240", color: "text-emerald-400" },
      { label: "Requests / sec", value: "842", color: "text-emerald-400" },
      { label: "5xx Error Rate", value: "0%", color: "text-emerald-400" },
    ],
  },
  api: {
    label: "api-service",
    statusColor: "text-amber-400",
    statusLabel: "Service",
    statusBg: "bg-amber-500/10 border-amber-500/20 text-amber-200",
    alert: "Experiencing cascading failure due to downstream database timeout.",
    metrics: [
      { label: "P95 Latency", value: "1.92s", color: "text-amber-400" },
      { label: "Error Rate", value: "14.2%", color: "text-red-400" },
    ],
  },
  postgres: {
    label: "postgres-prod",
    statusColor: "text-red-400",
    statusLabel: "Critical Resource",
    statusBg: "bg-red-500/10 border-red-500/20 text-red-200",
    alert: "Latency spiked to 1.84s. Connection pool exhausted by API service.",
    metrics: [
      { label: "Latency", value: "1.84s", color: "text-red-400" },
      { label: "Connections", value: "100/100", color: "text-red-400" },
      { label: "Host CPU", value: "89%", color: "text-amber-400" },
    ],
    cta: true,
  },
  redis: {
    label: "Redis Cache",
    statusColor: "text-emerald-400",
    statusLabel: "Healthy Resource",
    statusBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    metrics: [
      { label: "Hit Rate", value: "98.4%", color: "text-emerald-400" },
      { label: "Memory Usage", value: "4.2GB / 8GB", color: "text-emerald-400" },
    ],
  },
  rabbitmq: {
    label: "RabbitMQ",
    statusColor: "text-emerald-400",
    statusLabel: "Healthy Resource",
    statusBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    metrics: [
      { label: "Messages / sec", value: "142", color: "text-emerald-400" },
      { label: "Queued Messages", value: "0", color: "text-emerald-400" },
    ],
  },
  worker: {
    label: "Background Worker",
    statusColor: "text-emerald-400",
    statusLabel: "Healthy Resource",
    statusBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
    metrics: [
      { label: "Active Jobs", value: "12", color: "text-emerald-400" },
      { label: "CPU Usage", value: "34%", color: "text-emerald-400" },
    ],
  },
};

// Reusable node button component
function NodeBtn({
  id, label, icon: Icon, color, selectedNode, setSelectedNode, size = "md",
  status,
}: {
  id: NodeType;
  label: string;
  icon: React.ElementType;
  color: string;
  selectedNode: NodeType | null;
  setSelectedNode: (n: NodeType) => void;
  size?: "sm" | "md" | "lg";
  status?: "error";
}) {
  const isSelected = selectedNode === id;
  const sizeMap = { sm: "w-10 h-10", md: "w-12 h-12", lg: "w-14 h-14" };
  const iconSizeMap = { sm: 16, md: 18, lg: 22 };

  return (
    <button
      onClick={() => setSelectedNode(id)}
      className="flex flex-col items-center gap-1 group focus:outline-none"
    >
      <div
        className={`${sizeMap[size]} rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 relative ${
          status === "error"
            ? isSelected
              ? "bg-red-600 border-2 border-red-400 shadow-red-500/40"
              : "bg-red-500/20 border-2 border-red-500 shadow-red-500/30 group-hover:bg-red-500/30"
            : isSelected
              ? `${color} border-2 border-white/40`
              : "bg-[#121826] border border-white/10 group-hover:border-white/20 group-hover:bg-white/5"
        }`}
      >
        <Icon size={iconSizeMap[size]} className={isSelected ? "text-white" : status === "error" ? "text-red-400" : "text-gray-300"} />
        {status === "error" && !isSelected && (
          <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-25" />
        )}
      </div>
      <span
        className={`text-[10px] font-bold uppercase tracking-wider ${
          status === "error" ? "text-red-400" : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function InteractiveServiceMap() {
  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);
  const detail = selectedNode ? NODE_DETAILS[selectedNode] : null;

  return (
    <div className="bg-[#0b101a] border border-white/[0.05] rounded-2xl overflow-hidden shadow-2xl">
      <div className="flex flex-col lg:flex-row">

        {/* ── Topology Graph ── */}
        <div className="flex-1 p-5 md:p-8 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <Network size={18} className="text-blue-500" />
            <span className="text-white font-bold text-sm">Live Topology</span>
            <span className="ml-1 bg-amber-500/20 text-amber-400 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-amber-500/30">
              Demo
            </span>
          </div>

          {/* Topology Canvas */}
          <div className="flex-1 flex flex-col items-center justify-start gap-0 relative min-h-[360px]">

            {/* Users node */}
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <Activity size={14} className="text-gray-400" />
              </div>
              <span className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-wider">Users</span>
            </div>

            {/* Connector */}
            <div className="w-px h-6 bg-blue-500/30 relative">
              <div className="absolute inset-0 bg-blue-400/50 animate-pulse" />
            </div>

            {/* Nginx */}
            <NodeBtn id="nginx" label="Nginx" icon={Network} color="bg-blue-600" selectedNode={selectedNode} setSelectedNode={setSelectedNode} size="md" />

            {/* Connector */}
            <div className="w-px h-6 bg-blue-500/30 relative">
              <div className="absolute inset-0 bg-blue-400/50 animate-pulse" style={{ animationDelay: "150ms" }} />
            </div>

            {/* API Service */}
            <NodeBtn id="api" label="API Service" icon={Box} color="bg-purple-600" selectedNode={selectedNode} setSelectedNode={setSelectedNode} size="lg" />

            {/* Branching row */}
            <div className="w-full mt-0 relative">
              {/* Horizontal line */}
              <div className="absolute top-6 left-[20%] right-[20%] h-px bg-blue-500/20" />
              {/* Left vertical */}
              <div className="absolute top-0 left-[33%] w-px h-6 bg-blue-500/20" />
              {/* Center vertical */}
              <div className="absolute top-0 left-[50%] w-px h-6 bg-blue-500/20" />
              {/* Right vertical — dashed/error */}
              <div className="absolute top-0 left-[67%] w-px h-6 border-l-2 border-dashed border-red-500/40" />

              <div className="flex justify-around pt-6 pb-2">
                {/* Redis */}
                <NodeBtn id="redis" label="Redis" icon={Database} color="bg-amber-600" selectedNode={selectedNode} setSelectedNode={setSelectedNode} size="sm" />

                {/* RabbitMQ → Worker */}
                <div className="flex flex-col items-center gap-0">
                  <NodeBtn id="rabbitmq" label="RabbitMQ" icon={Network} color="bg-orange-600" selectedNode={selectedNode} setSelectedNode={setSelectedNode} size="sm" />
                  <div className="w-px h-4 bg-blue-500/20 my-0.5" />
                  <NodeBtn id="worker" label="Worker" icon={Box} color="bg-emerald-600" selectedNode={selectedNode} setSelectedNode={setSelectedNode} size="sm" />
                </div>

                {/* PostgreSQL — Critical */}
                <NodeBtn id="postgres" label="PostgreSQL" icon={Database} color="bg-red-600" selectedNode={selectedNode} setSelectedNode={setSelectedNode} size="lg" status="error" />
              </div>
            </div>
          </div>

          {/* Hint */}
          {!selectedNode && (
            <p className="text-center text-xs text-gray-600 mt-4">
              Tap any node to inspect live metrics
            </p>
          )}
        </div>

        {/* ── Inspector Panel ── */}
        <div className="w-full lg:w-[300px] xl:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/[0.05]">
          <AnimatePresence mode="wait">
            {detail ? (
              <motion.div
                key={selectedNode}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className="p-5 md:p-6 flex flex-col gap-4 h-full"
              >
                {/* Inspector header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${detail.statusColor}`}>
                      {detail.statusLabel}
                    </div>
                    <h3 className="text-base font-bold text-white">{detail.label}</h3>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-gray-500 hover:text-white transition-colors p-1 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Alert banner */}
                {detail.alert && (
                  <div className={`border rounded-xl p-3 text-xs leading-relaxed ${detail.statusBg}`}>
                    {detail.alert}
                  </div>
                )}

                {/* Metrics */}
                <div className="flex flex-col gap-2">
                  {detail.metrics.map(m => (
                    <div key={m.label} className="flex items-center justify-between py-2 border-b border-white/[0.04]">
                      <span className="text-sm text-gray-400">{m.label}</span>
                      <span className={`text-sm font-bold ${m.color}`}>{m.value}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {detail.cta && (
                  <button className="mt-auto w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 flex items-center justify-center gap-2 font-semibold text-sm transition-colors">
                    <Zap size={15} /> Analyze with AI
                  </button>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 h-full min-h-[200px] flex flex-col items-center justify-center text-center gap-3 opacity-40"
              >
                <Shield size={36} className="text-gray-600" />
                <p className="text-sm text-gray-500 max-w-[200px]">
                  Select a node to inspect live metrics and AI context.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
