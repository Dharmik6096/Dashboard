"use client";

import { useState } from "react";
import { Activity, ArrowRight, BrainCircuit, Check, Database, Network, Server } from "lucide-react";

const flows = [
  { label: "Infrastructure", icon: Server, metric: "128 hosts", detail: "CPU, memory, disk and process health" },
  { label: "Network", icon: Network, metric: "4.2 TB/day", detail: "Traffic, listeners and connection state" },
  { label: "Data services", icon: Database, metric: "24 clusters", detail: "PostgreSQL, Redis and RabbitMQ" },
];

export function SignalFlow() {
  const [active, setActive] = useState(0);
  return (
    <div className="signal-flow">
      <div className="signal-sources">
        {flows.map((item, index) => <button className={active === index ? "active" : ""} key={item.label} onClick={() => setActive(index)}><span><item.icon size={17} /></span><div><strong>{item.label}</strong><small>{item.detail}</small></div><em>{item.metric}</em></button>)}
      </div>
      <div className="signal-rail" aria-hidden="true"><i /><i /><i /><span><ArrowRight size={16} /></span></div>
      <div className="signal-outcome">
        <span className="signal-ai"><BrainCircuit size={22} /></span>
        <small>Correlated insight</small>
        <h3>{active === 0 ? "Capacity risk found before impact" : active === 1 ? "Packet loss isolated to one edge" : "Slow query traced to connection pressure"}</h3>
        <p>{active === 0 ? "Disk growth on two production nodes will cross policy limits within 18 hours." : active === 1 ? "A single interface accounts for 92% of retries across the checkout path." : "The evidence links queue depth, connection saturation, and elevated P95 latency."}</p>
        <div className="signal-confidence"><span><Check size={13} /> Evidence attached</span><span><Activity size={13} /> 94% confidence</span></div>
      </div>
    </div>
  );
}

