"use client";

import { useState } from "react";
import { Activity, AlertTriangle, Boxes, CheckCircle2, Database, Network, ShieldCheck } from "lucide-react";

type NodeKey = "edge" | "api" | "worker" | "postgres" | "redis";

const nodes = {
  edge: { label:"edge-nginx-01", type:"Gateway", status:"Healthy", metric:"842 req/s", detail:"Active connections 1,240 · 5xx rate 0.02%", icon:Network, tone:"green" },
  api: { label:"mobile-amcs", type:"Application", status:"Elevated latency", metric:"P95 1.92s", detail:"14.2% error rate · 9090/tcp · 3 replicas", icon:Boxes, tone:"amber" },
  worker: { label:"notification-worker", type:"Worker", status:"Healthy", metric:"142 jobs/s", detail:"12 active jobs · no retry backlog", icon:Activity, tone:"green" },
  postgres: { label:"postgres-primary", type:"Database", status:"Critical pressure", metric:"100/100 conns", detail:"P95 query 1.84s · CPU 89% · pool saturated", icon:Database, tone:"red" },
  redis: { label:"redis-prod", type:"Cache", status:"Healthy", metric:"98.4% hit", detail:"126 MB used · fragmentation 1.10 · 15.8k keys", icon:Database, tone:"green" },
} as const;

export function OperationsWorkbench() {
  const [selected, setSelected] = useState<NodeKey>("postgres");
  const [mode, setMode] = useState<"topology"|"evidence">("topology");
  const current = nodes[selected];
  const Icon = current.icon;

  return <div className="workbench-depth">
    <div className="workbench-back" aria-hidden="true" />
    <div className="operations-workbench">
      <div className="workbench-bar"><div><span/><span/><span/></div><strong>Production / Checkout path</strong><em><i/>Live sample</em></div>
      <div className="workbench-tabs"><button className={mode === "topology" ? "active" : ""} onClick={()=>setMode("topology")}><Network size={14}/>Service topology</button><button className={mode === "evidence" ? "active" : ""} onClick={()=>setMode("evidence")}><Activity size={14}/>Evidence timeline</button><span><ShieldCheck size={13}/>Read only</span></div>
      <div className="workbench-body">
        <aside className="workbench-list"><small>RESOURCES</small>{(Object.keys(nodes) as NodeKey[]).map((key)=>{const item=nodes[key];const ItemIcon=item.icon;return <button key={key} className={`${selected === key ? "active" : ""} ${item.tone}`} onClick={()=>setSelected(key)}><ItemIcon size={15}/><span><strong>{item.label}</strong><small>{item.type}</small></span><i/></button>})}</aside>
        <div className="workbench-canvas">
          {mode === "topology" ? <>
            <div className="topology-grid" aria-hidden="true" />
            <svg className="topology-lines" viewBox="0 0 600 330" preserveAspectRatio="none"><path d="M300 42 L300 98 M300 150 L160 215 M300 150 L300 215 M300 150 L440 215"/><path className="danger" d="M300 150 L440 215"/></svg>
            <button className={`topology-node node-edge ${selected === "edge" ? "active" : ""}`} onClick={()=>setSelected("edge")}><Network size={18}/><span>edge-nginx-01</span><i/></button>
            <button className={`topology-node node-api amber ${selected === "api" ? "active" : ""}`} onClick={()=>setSelected("api")}><Boxes size={20}/><span>mobile-amcs</span><i/></button>
            <button className={`topology-node node-redis ${selected === "redis" ? "active" : ""}`} onClick={()=>setSelected("redis")}><Database size={17}/><span>redis-prod</span><i/></button>
            <button className={`topology-node node-worker ${selected === "worker" ? "active" : ""}`} onClick={()=>setSelected("worker")}><Activity size={17}/><span>worker</span><i/></button>
            <button className={`topology-node node-postgres red ${selected === "postgres" ? "active" : ""}`} onClick={()=>setSelected("postgres")}><Database size={19}/><span>postgres-primary</span><i/></button>
          </> : <div className="evidence-timeline">
            <div><i className="red"/><span>14:42:08</span><strong>PostgreSQL pool reached 100 connections</strong><small>Database · critical</small></div>
            <div><i className="amber"/><span>14:42:11</span><strong>API P95 latency crossed 1.5 seconds</strong><small>mobile-amcs · warning</small></div>
            <div><i/><span>14:42:14</span><strong>Retry volume increased on checkout route</strong><small>edge-nginx-01 · correlated</small></div>
            <div><i className="violet"/><span>14:42:18</span><strong>Root cause hypothesis generated</strong><small>94% confidence · 3 supporting signals</small></div>
          </div>}
        </div>
        <aside className="workbench-inspector"><div className={`inspector-status ${current.tone}`}><Icon size={16}/><span>{current.type}</span><b>{current.status}</b></div><h3>{current.label}</h3><strong className="inspector-metric">{current.metric}</strong><p>{current.detail}</p><div className="inspector-chart"><span style={{height:"26%"}}/><span style={{height:"34%"}}/><span style={{height:"31%"}}/><span style={{height:"48%"}}/><span style={{height:"44%"}}/><span style={{height:"62%"}}/><span style={{height:selected === "postgres" ? "92%" : "56%"}}/><span style={{height:selected === "postgres" ? "86%" : "51%"}}/></div>{selected === "postgres" ? <div className="inspector-finding"><AlertTriangle size={15}/><div><strong>Likely root cause</strong><span>Connection pool exhausted after a slow query increase.</span></div></div> : <div className="inspector-finding healthy"><CheckCircle2 size={15}/><div><strong>No active anomaly</strong><span>Signals remain inside learned operating range.</span></div></div>}<button onClick={()=>setMode("evidence")}>View correlated evidence</button></aside>
      </div>
    </div>
  </div>;
}
