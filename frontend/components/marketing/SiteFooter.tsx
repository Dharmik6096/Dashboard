import Link from "next/link";
import { ArrowUpRight, GitBranch, Network, ShieldCheck } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { brand } from "@/lib/brand";
import { routes } from "@/lib/routes";

const groups = [
  { title: "Platform", links: [["Overview", routes.platform], ["Infrastructure", routes.platformInfrastructure], ["Dashboard builder", routes.platformDashboardBuilder], ["Read-only security", routes.platformReadOnlySecurity]] },
  { title: "Solutions", links: [["Platform engineering", "/solutions#platform-engineering"], ["DevOps teams", "/solutions#devops-sre"], ["Service providers", "/solutions#managed-service-providers"], ["Enterprise", "/solutions#enterprise-operations"]] },
  { title: "Resources", links: [["Documentation", "/docs"], ["API reference", "/docs#api"], ["System status", "/status"], ["Contact", "/contact"]] },
  { title: "Company", links: [["About", "/company"], ["Careers", "/company#careers"], ["Privacy", "/legal/privacy"], ["Terms", "/legal/terms"]] },
];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="public-shell footer-grid">
        <div className="footer-brand">
          <Link href="/" className="site-brand site-brand-inverse"><BrandMark /><span>{brand.name}</span><small>{brand.version}</small></Link>
          <p>{brand.description}</p>
          <span className="trust-chip"><ShieldCheck size={14} /> Read-only by architecture</span>
        </div>
        {groups.map((group) => (
          <div className="footer-group" key={group.title}>
            <h2>{group.title}</h2>
            {group.links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
          </div>
        ))}
      </div>
      <div className="public-shell footer-bottom">
        <span>© {new Date().getFullYear()} {brand.name}. Built for calm operations.</span>
        <div><a href="https://github.com" aria-label="GitHub"><GitBranch size={16} /></a><a href="https://linkedin.com" aria-label="LinkedIn"><Network size={16} /></a><Link href="/status">All systems operational <ArrowUpRight size={13} /></Link></div>
      </div>
    </footer>
  );
}
