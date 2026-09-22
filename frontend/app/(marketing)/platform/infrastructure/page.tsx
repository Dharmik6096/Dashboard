import type { Metadata } from "next";
import { Activity, Boxes, HardDrive, Network, Server } from "lucide-react";
import { PlatformDetailPage, type PlatformDetail } from "@/components/marketing/PlatformDetailPage";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("infrastructure");

const detail: PlatformDetail = {
  kicker: "Platform / Infrastructure",
  title: "Infrastructure context without production control risk.",
  description: "Inspect hosts, processes, storage, network activity and containers through focused operational views while customer systems remain read-only.",
  problem: {
    title: "Operators lose time when infrastructure evidence is scattered.",
    description: "A host problem rarely stays inside one chart. Responders need to move from fleet health to the affected machine and its runtime context without rebuilding the investigation.",
    points: ["Host and container signals live in different tools", "Point-in-time checks hide recent change", "Broad production access increases operational risk"],
  },
  productView: {
    title: "Purpose-built views available in V2.1 today.",
    description: "These are existing product capabilities, not a simulated dashboard or promised metric set.",
    items: [
      { icon: Server, title: "Fleet and host health", description: "Review connected servers, availability, CPU, memory, load and uptime, then open a host for deeper inspection.", status: "Available today" },
      { icon: HardDrive, title: "System detail", description: "Inspect disks, processes, ports, services, network interfaces, cron visibility and supported logs.", status: "Available today" },
      { icon: Boxes, title: "Container context", description: "View container state, resource history, processes, logs, inspection data and restart history without issuing runtime commands.", status: "Available today" },
      { icon: Activity, title: "Live updates", description: "WebSocket updates keep supported operational views current while historical endpoints preserve recent context.", status: "Available today" },
      { icon: Network, title: "Network evidence", description: "Use interface, listener and port information to understand the host-side evidence around an incident.", status: "Available today" },
    ],
  },
  workflows: {
    title: "Move from fleet signal to supporting evidence.",
    description: "The workflow stays observational from connection through investigation.",
    steps: [
      { title: "Connect a read-only source", description: "Register a server for supported SSH collection or use the optional agent." },
      { title: "Confirm collection health", description: "See whether the source is reachable and when telemetry was last collected." },
      { title: "Open the affected host", description: "Review system, storage, process, port, network and container context." },
      { title: "Correlate events and alerts", description: "Use the existing event and alert views to preserve the evidence behind the response." },
    ],
  },
  security: {
    title: "Visibility is separated from control.",
    description: "DevOps Monitor is designed to observe customer infrastructure, not administer it.",
    points: ["No interactive shell is exposed in the product", "Agent collection requests are GET-only", "Stored credentials use the encrypted credential vault", "Sensitive values are masked in supported responses and views"],
  },
  nextStep: { title: "Connect one environment and inspect the real workflow.", description: "Use the quickstart to configure a supported read-only source, or review the security boundary first.", label: "Open quickstart", href: "/docs#quickstart", secondaryLabel: "Review security", secondaryHref: "/platform/read-only-security" },
};

export default function InfrastructurePage() { return <PlatformDetailPage detail={detail} />; }
