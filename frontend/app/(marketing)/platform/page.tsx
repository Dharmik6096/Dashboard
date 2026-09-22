import type { Metadata } from "next";
import { Activity, BellRing, Boxes, BrainCircuit, Database, Network, Search, Server, Workflow } from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { FeatureGrid, PageHero } from "@/components/marketing/PagePrimitives";
import { ProductStage } from "@/components/marketing/ProductStage";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("platform");
const observe = [
  { icon: Server, title:"Infrastructure monitoring", text:"Understand host availability, saturation and change across every environment.", points:["CPU, memory, load and uptime","Filesystems, I/O and inode pressure","Processes, listeners and interfaces"] },
  { icon: Boxes, title:"Container intelligence", text:"Connect runtime health to the host and service context operators need.", points:["State, health and restarts","Resource and network telemetry","Events and masked metadata"] },
  { icon: Database, title:"Data service observability", text:"See the operating condition of PostgreSQL, Redis and RabbitMQ in one model.", points:["Connections and slow queries","Cache pressure and evictions","Queues, consumers and delivery rates"] },
];
const act = [
  { icon: Search, title:"Search everything", text:"Find a server, container, port or alert from one keyboard-first command palette." },
  { icon: BellRing, title:"Signal, not noise", text:"Route threshold and anomaly alerts with severity, ownership and evidence attached." },
  { icon: BrainCircuit, title:"Investigate with AI", text:"Correlate available telemetry into a concise hypothesis while keeping the evidence visible." },
  { icon: Workflow, title:"Preserve context", text:"Move between fleet, host, container and event views without losing filters or time range." },
  { icon: Network, title:"Map dependencies", text:"See how networks, services and data systems contribute to an incident path." },
  { icon: Activity, title:"Operate in real time", text:"Live health indicators and WebSocket updates keep the shared view current." },
];
export default function PlatformPage(){return <PublicLayout><main><PageHero kicker="Platform" title="A complete operating picture, not another wall of charts." description="DevOps Monitor organizes infrastructure telemetry around the questions operators actually ask: what changed, what is affected, and what evidence supports the answer?"/><section className="page-section"><div className="public-shell"><ProductStage/></div></section><FeatureGrid title="Observe every layer" description="Purpose-built views retain their depth while sharing the same filters, time model and navigation shell." features={observe} alternate/><FeatureGrid title="Move from signal to understanding" description="Fast investigation workflows reduce the distance between an alert and a defensible conclusion." features={act}/></main></PublicLayout>}
