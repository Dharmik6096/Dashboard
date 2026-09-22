import type { Metadata } from "next";
import { BellRing, CircleGauge, LayoutDashboard, PanelsTopLeft, Share2 } from "lucide-react";
import { PlatformDetailPage, type PlatformDetail } from "@/components/marketing/PlatformDetailPage";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("dashboardBuilder");

const detail: PlatformDetail = {
  kicker: "Platform / Dashboard builder",
  title: "Operational views today. A configurable builder on the roadmap.",
  description: "V2.1 provides focused dashboards for common infrastructure workflows. User-created multi-dashboard layouts are not built yet and are described here only as Roadmap.",
  problem: {
    title: "One dashboard layout cannot fit every operating model.",
    description: "Teams need dependable default views first, then controlled ways to arrange the evidence around their services, responsibilities and response practices.",
    points: ["Generic walls of charts obscure the next action", "Different roles need different levels of detail", "Saved layouts need a durable backend and authorization model"],
  },
  productView: {
    title: "A precise line between current product and future work.",
    description: "No builder backend, saved custom layout or shareable custom dashboard is claimed as available today.",
    items: [
      { icon: CircleGauge, title: "Operational overview", description: "The current product includes purpose-built overview and drill-down pages for connected infrastructure.", status: "Available today" },
      { icon: BellRing, title: "Alert and event views", description: "Existing alert and event pages keep response evidence accessible alongside infrastructure views.", status: "Available today" },
      { icon: LayoutDashboard, title: "Configurable panels", description: "Choose data panels, queries, layout and time scope inside a user-created dashboard.", status: "Roadmap" },
      { icon: PanelsTopLeft, title: "Multiple saved dashboards", description: "Create, name, save and manage several dashboards backed by a dedicated persistence model.", status: "Roadmap" },
      { icon: Share2, title: "Controlled sharing", description: "Share dashboards inside an organization with permissions and audited changes.", status: "Roadmap" },
    ],
  },
  workflows: {
    title: "Use current views now; design the builder deliberately.",
    description: "The available workflow does not pretend that drag-and-drop or persistence already exists.",
    steps: [
      { title: "Start from the overview", description: "Use the existing fleet-level page to locate the affected infrastructure." },
      { title: "Open a focused view", description: "Move into servers, containers, storage, network, data services, alerts or events." },
      { title: "Preserve investigation context", description: "Use shared navigation and current live data while moving between operational pages." },
      { title: "Builder workflow", description: "Roadmap: compose panels, save layouts and share governed dashboards after backend and permission work is implemented." },
    ],
  },
  security: {
    title: "A future builder will remain visualization-only.",
    description: "This is a product boundary, not a claim that the roadmap implementation exists today.",
    points: ["Current dashboards do not provide a customer-server shell", "Current collection remains read-only", "Roadmap layouts will not add remote mutation controls", "Roadmap persistence and sharing require authorization and audit coverage before release"],
  },
  nextStep: { title: "Explore the operational views that exist today.", description: "Review the platform overview and documentation. Treat configurable multi-dashboard building as Roadmap until it is implemented and tested.", label: "Explore platform", href: "/platform", secondaryLabel: "Read documentation", secondaryHref: "/docs" },
};

export default function DashboardBuilderPage() { return <PlatformDetailPage detail={detail} />; }
