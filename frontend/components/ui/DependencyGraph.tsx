"use client";
import React from "react";
import { Server, Globe, Box, Target, LayoutTemplate, Activity } from "lucide-react";

export interface DependencyNode {
  id: string;
  label: string;
  type: "domain" | "nginx" | "location" | "upstream" | "target" | "container";
  details?: string;
  status?: "healthy" | "warning" | "critical" | "unknown";
  children?: DependencyNode[];
}

interface DependencyGraphProps {
  data: DependencyNode;
}

const TYPE_ICONS = {
  domain: Globe,
  nginx: LayoutTemplate,
  location: Target,
  upstream: Server,
  target: Activity,
  container: Box
};

const STATUS_COLORS = {
  healthy: "var(--color-healthy)",
  warning: "var(--color-warning)",
  critical: "var(--color-critical)",
  unknown: "var(--text-muted)",
};

function TreeNode({ node }: { node: DependencyNode }) {
  const Icon = TYPE_ICONS[node.type] || Box;
  const statusColor = node.status ? STATUS_COLORS[node.status] : "var(--text-primary)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
      <div className="dependency-node card" style={{
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        minWidth: 160,
        zIndex: 2,
        background: "var(--bg-elevated)",
        borderColor: node.status === "critical" ? "var(--color-critical)" : "var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
        transition: "transform var(--transition-fast), box-shadow var(--transition-fast)",
        cursor: "pointer"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}>
        <Icon size={24} style={{ color: statusColor }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{node.label}</div>
          {node.details && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {node.details}
            </div>
          )}
        </div>
      </div>

      {node.children && node.children.length > 0 && (
        <div style={{ position: "relative", paddingTop: 32, marginTop: -2, display: "flex", justifyContent: "center", gap: 32 }}>
          {/* SVG line connector container */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 32, zIndex: 1 }}>
             <svg width="100%" height="100%">
               <path 
                 d={`M 50% 0 L 50% 16 L 50% 32`} 
                 stroke="var(--border)" strokeWidth="2" fill="none" 
               />
               {node.children.length > 1 && (
                 <path 
                   d={`M 10% 16 L 90% 16`} 
                   stroke="var(--border)" strokeWidth="2" fill="none" 
                 />
               )}
             </svg>
          </div>
          
          {node.children.map(child => (
            <div key={child.id} style={{ position: "relative" }}>
               {/* Vertical drop line for each child */}
               <div style={{ position: "absolute", top: -16, left: "50%", width: 2, height: 16, background: "var(--border)" }} />
               <TreeNode node={child} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DependencyGraph({ data }: DependencyGraphProps) {
  return (
    <div style={{ 
      padding: 32, 
      overflowX: "auto", 
      display: "flex", 
      justifyContent: "center",
      background: "var(--bg-base)",
      borderRadius: 8,
      border: "1px solid var(--border-subtle)"
    }}>
      <TreeNode node={data} />
    </div>
  );
}
