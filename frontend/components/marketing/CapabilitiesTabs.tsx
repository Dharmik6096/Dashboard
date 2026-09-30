"use client";

import { useState } from "react";
import { Server, Boxes, ShieldCheck, Database, ArrowRight, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const tabs = [
  {
    id: "infrastructure",
    icon: Server,
    label: "Infrastructure Monitoring",
    title: "Dense metrics for every host",
    description: "Navigate instantly from high-level fleet health down to the exact processes, CPU threads, and disk IOPS running on any Linux server.",
    href: "/platform#infrastructure",
    imageUrl: "/mock-dash.png", // We'll just style a gradient div if image missing
    gradient: "linear-gradient(135deg, #FF6B6B, #556270)"
  },
  {
    id: "containers",
    icon: Boxes,
    label: "Container Intelligence",
    title: "See inside your Docker runtime",
    description: "Track container sprawl, restart loops, image versions, and live resource pressure without ssh-ing into individual machines.",
    href: "/platform#containers",
    gradient: "linear-gradient(135deg, #4facfe, #00f2fe)"
  },
  {
    id: "dashboards",
    icon: LayoutDashboard,
    label: "Custom Dashboards",
    title: "Build the view you need",
    description: "Create multiple custom dashboards using widgets for timeseries, gauges, stats, and tables. Correlate infrastructure metrics exactly the way your team requires.",
    href: "/platform#dashboards",
    gradient: "linear-gradient(135deg, #f6d365, #fda085)"
  },
  {
    id: "security",
    icon: ShieldCheck,
    label: "Read-Only Security",
    title: "Observability without vulnerability",
    description: "DevOps Monitor operates on a strictly read-only collection model. It cannot restart services, drop tables, or run shell commands.",
    href: "/security",
    gradient: "linear-gradient(135deg, #43e97b, #38f9d7)"
  },
  {
    id: "data",
    icon: Database,
    label: "Data Services",
    title: "Correlate app state with DB load",
    description: "Monitor PostgreSQL query rates, Redis cache evictions, and RabbitMQ queue depth alongside the exact hosts running them.",
    href: "/platform#data",
    gradient: "linear-gradient(135deg, #fa709a, #fee140)"
  }
];

export function CapabilitiesTabs() {
  const [active, setActive] = useState(tabs[0].id);
  const activeTab = tabs.find(t => t.id === active) || tabs[0];

  return (
    <div className="capabilities-tabs-container">
      <div className="capabilities-tabs-nav">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.id === active;
          return (
            <button 
              key={t.id} 
              className={`cap-tab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActive(t.id)}
            >
              <Icon size={18} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
      <div className="capabilities-tabs-content">
        <div className="cap-content-text">
          <h3>{activeTab.title}</h3>
          <p>{activeTab.description}</p>
          <Link href={activeTab.href} className="btn btn-secondary">
            Explore {activeTab.label} <ArrowRight size={14} />
          </Link>
        </div>
        <div className="cap-content-visual">
          <div 
            className="cap-visual-box"
            style={{ background: activeTab.gradient }}
          >
            <div className="cap-visual-mockup">
               <div className="mock-window-header"><i/><i/><i/></div>
               <div className="mock-window-body">
                 {/* Visual representation of the active tab */}
                 <div className="mock-chart-row">
                   <div className="mock-chart" />
                   <div className="mock-chart" />
                 </div>
                 <div className="mock-grid">
                   <div /><div /><div /><div />
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
