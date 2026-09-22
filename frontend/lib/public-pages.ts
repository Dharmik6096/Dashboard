import type { Metadata } from "next";

export const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

export const publicPages = {
  home: { path: "/", title: "Read-only observability for modern infrastructure", description: "One operational view across hosts, containers, networks, databases and queues—built on a read-only collection boundary." },
  platform: { path: "/platform", title: "Observability Platform", description: "Unified read-only infrastructure observability across hosts, containers, networks and data services." },
  infrastructure: { path: "/platform/infrastructure", title: "Infrastructure Monitoring", description: "Read-only host and container observability with operational context." },
  dashboardBuilder: { path: "/platform/dashboard-builder", title: "Dashboard Builder Roadmap", description: "Current operational views and the clearly labeled dashboard builder roadmap." },
  readOnlySecurity: { path: "/platform/read-only-security", title: "Read-only Security", description: "How DevOps Monitor separates infrastructure visibility from remote control." },
  solutions: { path: "/solutions", title: "Solutions", description: "Read-only observability workflows for DevOps, platform engineering, managed service providers and enterprise teams." },
  integrations: { path: "/integrations", title: "Integrations", description: "Connect Linux, Docker, Nginx, PostgreSQL, Redis, RabbitMQ and your notification workflow." },
  pricing: { path: "/pricing", title: "Pricing", description: "Predictable observability pricing for growing infrastructure teams." },
  docs: { path: "/docs", title: "Documentation", description: "Deployment, security and operating guides for DevOps Monitor V2." },
  security: { path: "/security", title: "Security", description: "Read-only infrastructure monitoring with encrypted credentials, strong authentication, RBAC and auditability." },
  company: { path: "/company", title: "Company", description: "Why we are building a calmer, safer infrastructure observability platform." },
  contact: { path: "/contact", title: "Contact", description: "Talk with the DevOps Monitor product, security or support team." },
  status: { path: "/status", title: "System Status", description: "Current DevOps Monitor service status." },
  privacy: { path: "/legal/privacy", title: "Privacy", description: "DevOps Monitor privacy policy." },
  terms: { path: "/legal/terms", title: "Terms", description: "DevOps Monitor terms of service." },
  login: { path: "/login", title: "Sign in", description: "Sign in to your DevOps Monitor workspace.", index: false },
  signup: { path: "/signup", title: "Create a workspace", description: "Create a DevOps Monitor workspace.", index: false },
  forgotPassword: { path: "/forgot-password", title: "Reset password", description: "Request DevOps Monitor account recovery instructions.", index: false },
} as const;

export type PublicPageKey = keyof typeof publicPages;

export function publicPageMetadata(key: PublicPageKey): Metadata {
  const page = publicPages[key];
  return { title: page.title, description: page.description, alternates: { canonical: page.path }, openGraph: { type: "website", siteName: "DevOps Monitor", title: `${page.title} | DevOps Monitor V2`, description: page.description, url: page.path } };
}
