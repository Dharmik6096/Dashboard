"use client";
import { routes } from '@/lib/routes';
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Code2, KeyRound, Rocket, Search, Server, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
const docs=[
 {group:"Get started",items:[["Quickstart","Install the stack and open your first workspace",Rocket],["Connect a host","Choose agent or SSH read-only collection",Server],["Security model","Understand the production trust boundary",ShieldCheck]]},
 {group:"Platform",items:[["Dashboards","Navigate fleet and resource views",BookOpen],["Authentication","Sessions, roles and account security",KeyRound],["API reference","Integrate using scoped API keys",Code2]]},
];
const guideLinks: Record<string, string> = {
  Quickstart: '/docs#quickstart',
  'Connect a host': routes.addServer,
  'Security model': '/security',
  Dashboards: '/platform#preserve-context',
  Authentication: '/login',
  'API reference': '/docs#api',
};
export default function DocsPage(){const[q,setQ]=useState("");const groups=useMemo(()=>docs.map(g=>({...g,items:g.items.filter(([title,desc])=>`${title} ${desc}`.toLowerCase().includes(q.toLowerCase()))})).filter(g=>g.items.length),[q]);return <PublicLayout><main><section className="public-page-hero"><div className="public-shell"><span className="section-kicker">Documentation</span><h1>Build a clear path from install to insight.</h1><p>Guides for deploying, securing and operating DevOps Monitor V2.</p></div></section><section className="page-section"><div className="public-shell docs-layout"><nav className="docs-nav"><a className="active" href="#search">Overview</a><a href="#quickstart">Quickstart</a><a href="#platform">Platform</a><a href="#api">API reference</a><Link href="/security">Security</Link></nav><div className="docs-content"><label className="docs-search" id="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search documentation…" aria-label="Search documentation"/><kbd>⌘ K</kbd></label>{groups.map(group=><section className="docs-group" id={group.group==="Get started"?"quickstart":"platform"} key={group.group}><h2>{group.group}</h2><div className="docs-links">{group.items.map(([title,desc,Icon])=><Link href={guideLinks[String(title)]} className="docs-link" key={String(title)}><div><strong>{title as string}</strong><small>{desc as string}</small></div><Icon size={17}/></Link>)}</div></section>)}{!groups.length&&<div className="info-card" style={{marginTop:30}}><h3>No guide found</h3><p>Try searching for hosts, API, security or authentication.</p></div>}<section className="docs-group" id="api"><h2>API endpoint</h2><div className="info-card"><p>Interactive OpenAPI documentation is available from your deployment at <code>/api/docs</code>. Authenticate using a scoped token and keep secrets outside source control.</p><Link href="/contact" className="text-link" style={{color:"#5d54e9"}}>Get integration help <ArrowRight size={14}/></Link></div></section></div></div></section></main></PublicLayout>}
