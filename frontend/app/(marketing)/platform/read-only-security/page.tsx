import type { Metadata } from "next";
import { Eye, FileClock, KeyRound, ShieldCheck, Users } from "lucide-react";
import { PlatformDetailPage, type PlatformDetail } from "@/components/marketing/PlatformDetailPage";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("readOnlySecurity");

const detail: PlatformDetail = {
  kicker: "Platform / Read-only security",
  title: "Observe infrastructure without turning monitoring into a control plane.",
  description: "DevOps Monitor collects supported telemetry for investigation while keeping shell access and customer-server mutation outside the product boundary.",
  problem: {
    title: "Monitoring should not become another path to production change.",
    description: "Operational visibility needs credentials and connectivity, but responders should not gain an interactive control channel simply because they can view telemetry.",
    points: ["Shared administrator credentials increase blast radius", "Untracked remote actions weaken incident evidence", "Secrets can leak through logs, metadata and user interfaces"],
  },
  productView: {
    title: "Security controls implemented in V2.1.",
    description: "The controls below reflect the current codebase and its supported collection paths.",
    items: [
      { icon: Eye, title: "Read-only collection", description: "The agent client uses GET-only requests, and the product exposes telemetry views rather than an interactive command surface.", status: "Available today" },
      { icon: KeyRound, title: "Credential vault", description: "Stored collection credentials are handled through the encrypted credential vault instead of being returned as plain secrets.", status: "Available today" },
      { icon: Users, title: "Organization roles", description: "Organization membership and role checks provide scoped access for owner, admin, analyst and viewer workflows.", status: "Available today" },
      { icon: FileClock, title: "Audit records", description: "Existing audit-log capabilities record supported platform activity for review.", status: "Available today" },
      { icon: ShieldCheck, title: "Analysis-only AI boundary", description: "The AI investigation instructions prohibit shell, service, database and container mutation commands.", status: "Available today" },
    ],
  },
  workflows: {
    title: "Keep access narrow from setup to investigation.",
    description: "The workflow is built around collection, inspection and evidence—not remote administration.",
    steps: [
      { title: "Scope the organization", description: "Create or join the correct workspace and assign the minimum suitable role." },
      { title: "Register collection access", description: "Store supported source credentials through the encrypted vault path." },
      { title: "Collect supported telemetry", description: "Use read-only SSH collection or GET-only agent requests for available signals." },
      { title: "Review evidence", description: "Inspect telemetry, alerts, events and supported audit history without changing the customer server." },
    ],
  },
  security: {
    title: "The boundary is explicit.",
    description: "Read-only refers to customer servers. Authorized users can still manage DevOps Monitor records such as organizations and monitored-source configuration inside the platform.",
    points: ["No interactive shell or arbitrary command execution", "No restart, reload, kill, package or file mutation through collection", "Secrets are masked in supported outputs", "Authentication, organization roles and audit records protect platform access"],
  },
  nextStep: { title: "Review the trust boundary before connecting a source.", description: "Read the security documentation, then use the quickstart to connect only the access your environment permits.", label: "Security documentation", href: "/security", secondaryLabel: "Open quickstart", secondaryHref: "/docs#quickstart" },
};

export default function ReadOnlySecurityPage() { return <PlatformDetailPage detail={detail} />; }
