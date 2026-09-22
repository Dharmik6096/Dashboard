"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ElementType } from "react";
import {
  Activity, ArrowRight, BellRing, Boxes, BrainCircuit, Building2, ChevronDown,
  CircleGauge, CloudCog, Database, FileText, Gauge, HardDrive, Headphones,
  Menu, Network, Search, Server, ShieldCheck, ShipWheel, Users, Waypoints, X,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { brand } from "@/lib/brand";
import { routes } from "@/lib/routes";

type MegaLink = { label: string; description: string; href: string; icon: ElementType; badge?: string };
type MegaMenu = {
  columns: { title: string; links: MegaLink[] }[];
  aside: { eyebrow: string; title: string; description: string; href: string; icon: ElementType; link: string };
};

const menus: Record<string, MegaMenu> = {
  Platform: {
    columns: [
      { title: "Observe", links: [
        { label: "Infrastructure", description: "Hosts, processes, disks and saturation", href: routes.platformInfrastructure, icon: Server },
        { label: "Containers", description: "Runtime health, resources and restarts", href: "/platform#container-intelligence", icon: Boxes },
        { label: "Networks", description: "Traffic, ports and connection state", href: "/platform#map-dependencies", icon: Network },
        { label: "Data services", description: "PostgreSQL, Redis and RabbitMQ", href: "/platform#data-service-observability", icon: Database },
      ] },
      { title: "Understand", links: [
        { label: "Dashboards", description: "Current views and the builder roadmap", href: routes.platformDashboardBuilder, icon: CircleGauge },
        { label: "Alerts & incidents", description: "Evidence-rich response workflows", href: "/platform#signal-not-noise", icon: BellRing },
        { label: "AI investigations", description: "Explain anomalies using your telemetry", href: "/platform#investigate-with-ai", icon: BrainCircuit, badge: "NEW" },
        { label: "Read-only security", description: "Visibility without remote mutation", href: routes.platformReadOnlySecurity, icon: ShieldCheck },
      ] },
    ],
    aside: { eyebrow: "Live product", title: "From fleet health to root cause", description: "Explore how connected telemetry shortens an investigation without adding production control risk.", href: "/platform", icon: Activity, link: "Explore the platform" },
  },
  Solutions: {
    columns: [
      { title: "By team", links: [
        { label: "DevOps & SRE", description: "Detect, investigate and communicate faster", href: "/solutions#devops-sre", icon: Gauge },
        { label: "Platform engineering", description: "A consistent view for every service team", href: "/solutions#platform-engineering", icon: CloudCog },
        { label: "Security teams", description: "Audited access and a strict read-only boundary", href: "/solutions#security-teams", icon: ShieldCheck },
        { label: "Engineering leaders", description: "Capacity and reliability signals that align work", href: "/solutions#engineering-leaders", icon: Users },
      ] },
      { title: "By environment", links: [
        { label: "Enterprise operations", description: "Governance, SSO-ready identity and scale", href: "/solutions#enterprise-operations", icon: Building2 },
        { label: "Managed services", description: "Repeatable multi-environment operations", href: "/solutions#managed-service-providers", icon: Headphones },
        { label: "Docker estates", description: "Host and container context in one workflow", href: "/integrations#docker", icon: Boxes },
        { label: "Kubernetes roadmap", description: "Cluster and workload visibility", href: "/integrations#kubernetes", icon: ShipWheel, badge: "ROADMAP" },
      ] },
    ],
    aside: { eyebrow: "Operating model", title: "One truth for every responder", description: "Keep teams aligned from the first alert through the post-incident review.", href: "/solutions", icon: Waypoints, link: "View solutions" },
  },
  Integrations: {
    columns: [
      { title: "Infrastructure", links: [
        { label: "Linux", description: "CPU, RAM, disk, processes and network", href: "/integrations#linux", icon: Server, badge: "AVAILABLE" },
        { label: "Docker", description: "State, events and resource utilization", href: "/integrations#docker", icon: Boxes, badge: "AVAILABLE" },
        { label: "Nginx", description: "Configuration and request health", href: "/integrations#nginx", icon: Waypoints, badge: "AVAILABLE" },
        { label: "Cloud providers", description: "Account and managed-service discovery", href: "/integrations#cloud-providers", icon: CloudCog, badge: "ROADMAP" },
      ] },
      { title: "Data & workflow", links: [
        { label: "PostgreSQL", description: "Connections, activity and slow queries", href: "/integrations#postgresql", icon: Database },
        { label: "Redis", description: "Memory, clients, hit rate and evictions", href: "/integrations#redis", icon: Database },
        { label: "RabbitMQ", description: "Queues, consumers and message rates", href: "/integrations#rabbitmq", icon: Network },
        { label: "Webhooks", description: "Route structured alert events", href: "/integrations#webhooks", icon: Activity },
      ] },
    ],
    aside: { eyebrow: "Collection", title: "Meet infrastructure where it runs", description: "Start with secure SSH collection or deploy the optional lightweight agent.", href: "/integrations", icon: HardDrive, link: "Browse integrations" },
  },
  Resources: {
    columns: [
      { title: "Learn", links: [
        { label: "Documentation", description: "Install, connect and operate the platform", href: "/docs", icon: FileText },
        { label: "Quickstart", description: "Connect your first Linux host", href: "/docs#quickstart", icon: Activity },
        { label: "API reference", description: "Build against authenticated endpoints", href: "/docs#api", icon: Waypoints },
        { label: "Security model", description: "Understand the read-only trust boundary", href: "/security", icon: ShieldCheck },
      ] },
      { title: "Company", links: [
        { label: "About", description: "Why we are building DevOps Monitor", href: "/company", icon: Building2 },
        { label: "System status", description: "Live platform component health", href: "/status", icon: CircleGauge },
        { label: "Contact engineering", description: "Architecture, migration and enterprise help", href: "/contact", icon: Headphones },
        { label: "Privacy & terms", description: "Platform policies and commitments", href: "/legal/privacy", icon: ShieldCheck },
      ] },
    ],
    aside: { eyebrow: "Start here", title: "Deploy without losing control", description: "Use the quickstart to create a workspace and connect a read-only data source.", href: "/docs#quickstart", icon: FileText, link: "Open quickstart" },
  },
};

const nav = ["Platform", "Solutions", "Integrations", "Pricing", "Resources"] as const;

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
  const showMenu = (name: string) => { cancelClose(); setOpenMenu(name); };
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setOpenMenu(null), 140); };

  useEffect(() => { setMobileOpen(false); setOpenMenu(null); }, [pathname]);
  useEffect(() => () => cancelClose(), []);

  return (
    <header className="site-header" onMouseLeave={scheduleClose}>
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label={`${brand.name} home`}><BrandMark /><span>{brand.name}</span><small>{brand.version}</small></Link>
        <nav className="site-nav" aria-label="Primary navigation" onMouseEnter={cancelClose}>
          {nav.map((name) => {
            const href = name === "Resources" ? "/docs" : `/${name.toLowerCase()}`;
            const menu = menus[name];
            const active = pathname === href || (name === "Resources" && ["/docs", "/company", "/status"].includes(pathname));
            return menu ? (
              <div className="nav-mega-wrap" key={name} onMouseEnter={() => showMenu(name)} onMouseLeave={scheduleClose}>
                <button className={`site-nav-link ${active || openMenu === name ? "active" : ""}`} onClick={() => setOpenMenu(openMenu === name ? null : name)} aria-expanded={openMenu === name} aria-haspopup="true">
                  {name} <ChevronDown size={14} className={openMenu === name ? "rotate" : ""} />
                </button>
                {openMenu === name && <MegaPanel menu={menu} />}
              </div>
            ) : <Link key={name} href={href} className={`site-nav-link ${active ? "active" : ""}`}>{name}</Link>;
          })}
        </nav>
        <div className="site-actions">
          <Link className="nav-search" aria-label="Search documentation" href="/docs#search"><Search size={16} /><span>Search</span><kbd>⌘ K</kbd></Link>
          <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">Start free <ArrowRight size={14} /></Link>
        </div>
        <button className="mobile-menu-button" onClick={() => setMobileOpen((value) => !value)} aria-label="Toggle menu" aria-expanded={mobileOpen}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {mobileOpen && <nav className="mobile-nav" aria-label="Mobile navigation">
        {["Platform", "Solutions", "Integrations", "Pricing", "Docs", "Security", "Company", "Status"].map((name) => <Link key={name} href={`/${name.toLowerCase()}`}>{name}<ArrowRight size={15} /></Link>)}
        <div className="mobile-nav-actions"><Link href="/login" className="btn btn-secondary">Sign in</Link><Link href="/signup" className="btn btn-primary">Start free</Link></div>
      </nav>}
    </header>
  );
}

function MegaPanel({ menu }: { menu: MegaMenu }) {
  const AsideIcon = menu.aside.icon;
  return <div className="platform-mega">
    <div className="platform-mega-main">{menu.columns.map((group) => <div key={group.title}><p className="mega-eyebrow">{group.title}</p><div className="mega-links">{group.links.map((item) => { const Icon = item.icon; return <Link key={item.label} href={item.href} className="mega-link"><span className="mega-icon"><Icon size={17} /></span><span><strong>{item.label}{item.badge && <b>{item.badge}</b>}</strong><small>{item.description}</small></span></Link>; })}</div></div>)}</div>
    <Link href={menu.aside.href} className="mega-aside"><span className="mega-aside-icon"><AsideIcon size={22} /></span><span className="mega-eyebrow">{menu.aside.eyebrow}</span><strong>{menu.aside.title}</strong><small>{menu.aside.description}</small><span className="text-link">{menu.aside.link} <ArrowRight size={14} /></span></Link>
  </div>;
}
