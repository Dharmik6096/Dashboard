"use client";

import { useMemo, useRef, useState } from "react";
import type { ElementType, MouseEvent } from "react";
import { Activity, AlertTriangle, ArrowLeft, Boxes, Database, Globe2, Server, ShieldCheck } from "lucide-react";

type ModuleKey = "overview" | "hosts" | "containers" | "data" | "incidents";
type ModuleData = {
  label: string; title: string; icon: ElementType; accent: string;
  kpis: [string, string, string, string][];
  rows: [string, string, number, string][];
  incident: [string, string, string];
  charts: Record<string, number[]>;
};

const modules: Record<ModuleKey, ModuleData> = {
  overview: { label:"Overview", title:"Production is healthy", icon:Globe2, accent:"#8b7cff", kpis:[["Availability","99.98%","+0.03%","green"],["Active hosts","128","126 healthy","blue"],["P95 latency","184 ms","−12.4%","violet"],["Open alerts","3","0 critical","amber"]], rows:[["api-gateway","99.99%",94,"healthy"],["checkout","99.96%",81,"healthy"],["postgres-primary","99.98%",88,"healthy"],["worker-cluster","99.91%",72,"warning"]], incident:["Latency anomaly contained","checkout-api · 2 min ago","3 correlated signals"], charts:{"15m":[44,48,46,53,51,57,54,61,58,63,60,66],"1h":[31,36,34,43,39,48,44,55,49,58,54,62,57,68,61,64,58,52,55,47,43,46,39,42],"6h":[24,28,32,30,37,43,40,49,55,50,58,62,57,66,61,71],"24h":[41,33,28,31,39,46,51,57,63,58,54,61,67,62,56,49]} },
  hosts: { label:"Hosts", title:"126 of 128 hosts healthy", icon:Server, accent:"#4aa3ff", kpis:[["Average CPU","42.7%","−3.8%","green"],["Memory used","6.4 TB","71% fleet","blue"],["Disk pressure","2 hosts","review","amber"],["Load P95","2.18","normal","violet"]], rows:[["prod-web-05","24% CPU",36,"healthy"],["prod-db-03","71% CPU",71,"warning"],["mobile-api-02","43% CPU",43,"healthy"],["proxy-edge-01","18% CPU",18,"healthy"]], incident:["Disk growth forecast","prod-db-03 · 8 min ago","18 hours to policy limit"], charts:{"15m":[35,40,38,44,48,42,51,47,55,49,46,43],"1h":[22,28,31,29,37,43,39,46,51,48,55,52,49,44,42,47],"6h":[31,29,38,43,46,52,49,58,63,55,48,44,39,42],"24h":[42,38,33,29,34,41,49,57,61,54,47,43,39,36]} },
  containers: { label:"Containers", title:"246 workloads discovered", icon:Boxes, accent:"#24b7c8", kpis:[["Running","239","97.1%","green"],["Unhealthy","2","−1 today","amber"],["Restarts","14","last 24h","violet"],["CPU reserved","68%","stable","blue"]], rows:[["qaqc-portal","0.8% CPU",12,"healthy"],["mobile-amcs","32% CPU",42,"healthy"],["notification","4 restarts",64,"warning"],["redis-cache","1.2 GB",34,"healthy"]], incident:["Restart pattern detected","notification · 5 min ago","Exit code correlated with logs"], charts:{"15m":[31,34,39,37,44,49,46,55,52,58,54,50],"1h":[29,32,34,41,38,46,43,51,48,56,53,61,57,52,49,45],"6h":[38,42,39,47,52,49,58,55,62,68,63,59,54,57],"24h":[48,43,39,35,38,45,52,59,66,61,57,53,48,44]} },
  data: { label:"Data services", title:"24 data systems connected", icon:Database, accent:"#c182ff", kpis:[["PostgreSQL","8","all online","green"],["Redis memory","126 MB","1.10 frag","blue"],["RabbitMQ","0 queued","13 clients","green"],["Slow queries","6","needs review","amber"]], rows:[["postgres-primary","18 ms",24,"healthy"],["redis-prod","98.4% hit",88,"healthy"],["rabbitmq-main","142 msg/s",61,"healthy"],["mongo-events","P95 420 ms",74,"warning"]], incident:["Connection pressure isolated","postgres-primary · 11 min ago","Pool at 86% capacity"], charts:{"15m":[18,22,20,28,25,31,29,37,34,42,38,35],"1h":[21,25,23,29,34,31,39,36,44,41,49,45,52,47,43,40],"6h":[28,31,35,33,39,46,43,51,48,56,53,61,58,54],"24h":[45,39,34,31,36,42,49,55,60,57,51,46,42,38]} },
  incidents: { label:"Incidents", title:"No critical incidents", icon:AlertTriangle, accent:"#f0ad4e", kpis:[["Open","3","all assigned","amber"],["Critical","0","last 24h","green"],["MTTA","2m 14s","−18%","blue"],["Resolved","41","this week","violet"]], rows:[["INC-0182","contained",92,"warning"],["INC-0179","resolved",100,"healthy"],["INC-0174","resolved",100,"healthy"],["INC-0168","monitoring",76,"warning"]], incident:["INC-0182 · latency anomaly","checkout-api · owner: platform","Evidence timeline ready"], charts:{"15m":[62,57,51,46,42,38,34,31,28,25,22,20],"1h":[68,64,59,55,49,44,40,36,32,29,26,23,21,19,18,17],"6h":[71,66,62,57,53,48,44,39,35,31,28,25,22,20],"24h":[63,59,55,51,46,42,38,34,31,28,25,23,21,19]} },
};

const moduleOrder: ModuleKey[] = ["overview", "hosts", "containers", "data", "incidents"];

export function ProductStage() {
  const [range, setRange] = useState("1h");
  const [active, setActive] = useState<ModuleKey>("overview");
  const [inspecting, setInspecting] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const data = modules[active];
  const points = data.charts[range];
  const path = useMemo(() => points.map((value, index) => `${(index / Math.max(points.length - 1, 1)) * 100},${78 - value}`).join(" "), [points]);

  function tilt(event: MouseEvent<HTMLDivElement>) {
    if (!stageRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    stageRef.current.style.transform = `rotateX(${1.5 - y * 4}deg) rotateY(${-4 + x * 6}deg) translateY(-3px)`;
  }
  function resetTilt() { if (stageRef.current) stageRef.current.style.transform = "rotateY(-4deg) rotateX(1.4deg)"; }

  return (
    <div className="product-stage-wrap" aria-label="Interactive observability product preview" onMouseMove={tilt} onMouseLeave={resetTilt}>
      <div className="stage-depth stage-depth-one" /><div className="stage-depth stage-depth-two" /><div className="stage-depth stage-depth-three" />
      <div className="product-stage" ref={stageRef}>
        <div className="stage-topbar"><div className="stage-traffic"><span /><span /><span /></div><div className="stage-path"><ShieldCheck size={12} /> production / {active}</div><div className="stage-live"><i /> interactive sample</div></div>
        <div className="stage-body">
          <aside className="stage-sidebar" aria-label="Preview modules">
            <span className="stage-logo"><Activity size={16} /></span>
            {moduleOrder.map((key) => { const Icon = modules[key].icon; return <button title={modules[key].label} aria-label={`Show ${modules[key].label} data`} aria-pressed={active === key} className={active === key ? "active" : ""} key={key} onClick={() => { setActive(key); setInspecting(false); }}><Icon size={15} /></button>; })}
          </aside>
          <div className="stage-content">
            <div className="stage-heading"><div><small>{data.label}</small><strong>{data.title}</strong></div><div className="stage-range">{["15m","1h","6h","24h"].map((item) => <button aria-pressed={range === item} className={range === item ? "active" : ""} onClick={() => setRange(item)} key={item}>{item}</button>)}</div></div>
            <div className="stage-kpis">{data.kpis.map(([label,value,delta,tone]) => <div className="stage-kpi" key={label}><span>{label}</span><strong>{value}</strong><small className={tone}>{delta}</small></div>)}</div>
            <div className="stage-grid">
              <div className="stage-panel stage-chart-panel"><div className="stage-panel-title"><span>{data.label} signal · {range}</span><small>{points[points.length - 1]} current</small></div><svg viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label={`${data.label} chart for ${range}`}><defs><linearGradient id={`stageFill-${active}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={data.accent} stopOpacity=".38"/><stop offset="1" stopColor={data.accent} stopOpacity="0"/></linearGradient></defs><polygon points={`0,42 ${path} 100,42`} fill={`url(#stageFill-${active})`} /><polyline points={path} fill="none" stroke={data.accent} strokeWidth="1.4" vectorEffect="non-scaling-stroke" /></svg><div className="stage-axis"><span>start</span><span>−⅔</span><span>−⅓</span><span>now</span></div></div>
              <div className="stage-panel stage-health-panel"><div className="stage-panel-title"><span>{active === "incidents" ? "Response progress" : "Resource health"}</span><small>{data.rows.length} shown</small></div>{data.rows.map(([name,value,width,status]) => <div className={`service-row ${status}`} key={name}><div><i /><span>{name}</span></div><strong>{value}</strong><em><b style={{ width:`${width}%`, background:data.accent }} /></em></div>)}</div>
              <button className={`stage-panel stage-incident-panel ${inspecting ? "is-open" : ""}`} onClick={() => setInspecting((value) => !value)} aria-expanded={inspecting}><div className="stage-incident-icon"><AlertTriangle size={15} /></div><div><strong>{data.incident[0]}</strong><span>{data.incident[1]}</span></div><span className="stage-investigate">{inspecting ? "Close evidence" : "Inspect evidence"} →</span></button>
              {inspecting && <div className="stage-evidence"><button onClick={() => setInspecting(false)} aria-label="Back to dashboard"><ArrowLeft size={12}/>Back</button><div><small>Correlated evidence</small><strong>{data.incident[2]}</strong><p>Metrics, events and resource relationships are aligned to the selected {range} window. This preview changes when you select a module or time range.</p></div><span>94% confidence</span></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
