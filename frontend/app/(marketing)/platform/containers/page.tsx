import type { Metadata } from "next";
import { Boxes, Cpu, MemoryStick, RefreshCw, Terminal, Layers } from "lucide-react";
import { PlatformDetailPage, type PlatformDetail } from "@/components/marketing/PlatformDetailPage";

export const metadata: Metadata = {
  title: "Container Monitoring · DevOps Monitor V2",
  description: "Read-only Docker container monitoring with resource tracking, event history, and fleet visibility.",
};

const detail: PlatformDetail = {
  kicker: "Platform / Containers",
  title: "Container fleet visibility without runtime control.",
  description: "Monitor Docker container health, resource usage, restart patterns and event history across every connected host — without issuing start, stop or restart commands.",
  problem: {
    title: "Container sprawl creates blind spots.",
    description: "When dozens of containers run across multiple hosts, teams lose track of resource consumption patterns, restart loops and dependency chains. Traditional tools either provide too little context or demand too much access.",
    points: ["Container and host metrics are disconnected", "Restart patterns are invisible until outage", "Runtime access exposes production to accidental changes"],
  },
  productView: {
    title: "Container intelligence built into the platform.",
    description: "These capabilities are available in production today.",
    items: [
      { icon: Boxes, title: "Fleet inventory", description: "See every container across all connected hosts with status, image, ports, uptime and resource usage at a glance.", status: "Available today" },
      { icon: Cpu, title: "Resource tracking", description: "Track CPU, memory and network usage per container with historical trends and threshold alerts.", status: "Available today" },
      { icon: RefreshCw, title: "Restart detection", description: "Detect restart loops and container instability patterns before they cause service degradation.", status: "Available today" },
      { icon: Terminal, title: "Container inspection", description: "View container configuration, environment, labels, mounts and network settings read-only.", status: "Available today" },
      { icon: Layers, title: "Image tracking", description: "Track running images, versions and identify containers running outdated or vulnerable base images.", status: "Available today" },
      { icon: MemoryStick, title: "Resource limits", description: "Compare actual usage against configured limits to identify over-provisioned or constrained containers.", status: "Available today" },
    ],
  },
  workflows: {
    title: "From fleet overview to container detail.",
    description: "Navigate container health without leaving the observability boundary.",
    steps: [
      { title: "View the container fleet", description: "See all containers across connected hosts with real-time status and resource indicators." },
      { title: "Identify resource pressure", description: "Spot containers approaching CPU or memory limits before they impact service quality." },
      { title: "Investigate container history", description: "Review restart events, resource trends and configuration changes for any container." },
      { title: "Correlate with host metrics", description: "Connect container behavior to host-level CPU, memory and disk pressure." },
    ],
  },
  security: {
    title: "Container visibility without runtime commands.",
    description: "DevOps Monitor reads container state but never issues docker exec, restart, stop or start commands.",
    points: ["No docker exec or shell access", "Read-only container inspection via Docker API", "Container events collected passively", "No image pull, push or build capabilities"],
  },
  nextStep: { title: "Connect a Docker host and see your container fleet.", description: "Use SSH collection or the agent to discover containers automatically.", label: "Open quickstart", href: "/docs#quickstart", secondaryLabel: "View infrastructure", secondaryHref: "/platform/infrastructure" },
};

export default function ContainerMonitoringPage() { return <PlatformDetailPage detail={detail} />; }
