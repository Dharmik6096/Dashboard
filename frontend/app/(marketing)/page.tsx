import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight, BarChart3, BrainCircuit, Check, CircleGauge, Cloud,
  Code2, Database, Eye, Globe2, Layers3, Server, ShieldCheck, Sparkles,
} from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { ProductStage } from "@/components/marketing/ProductStage";
import { SignalFlow } from "@/components/marketing/SignalFlow";
import { OperationsWorkbench } from "@/components/marketing/OperationsWorkbench";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("home");

const capabilities = [
  { icon: Server, title: "Infrastructure", text: "Host health, saturation, processes, disks and network interfaces with dense, explorable timelines.", stat: "Host → service context", href: "/platform#infrastructure-monitoring" },
  { icon: Layers3, title: "Containers", text: "Runtime state, restarts, image metadata, resource pressure and event history across Docker fleets.", stat: "Live topology", href: "/platform#container-intelligence" },
  { icon: Database, title: "Data services", text: "PostgreSQL, Redis and RabbitMQ signals connected to the applications and hosts they depend on.", stat: "Cross-signal correlation", href: "/platform#data-service-observability" },
  { icon: BarChart3, title: "Logs & events", text: "A single searchable stream for infrastructure events, service logs and operational changes.", stat: "Fast investigation", href: "/platform#signal-not-noise" },
  { icon: BrainCircuit, title: "AI investigations", text: "Plain-language findings grounded in your own telemetry, with evidence visible beside every conclusion.", stat: "Evidence first", href: "/platform#investigate-with-ai" },
  { icon: ShieldCheck, title: "Security boundary", text: "Read-only collection, encrypted credentials, audited access and no remote mutation controls.", stat: "Zero server actions", href: "/security" },
];

const proof = [
  ["128", "hosts in one workspace"],
  ["15 sec", "default signal refresh"],
  ["20+", "operational views"],
  ["0", "remote write actions"],
];

export default function HomePage() {
  return (
    <PublicLayout>
      <main>
        <section className="home-hero">
          <div className="hero-aurora" aria-hidden="true" />
          <div className="public-shell home-hero-grid">
            <div className="hero-copy">
              <Link href="/platform" className="eyebrow-pill"><Sparkles size={13} /> DevOps Monitor V2 is here <ArrowRight size={13} /></Link>
              <h1>Every signal.<br/><span>One calm view.</span></h1>
              <p>See what is happening across your infrastructure, understand why it matters, and investigate with confidence—without giving the platform permission to change production.</p>
              <div className="hero-actions">
                <Link href="/signup" className="btn btn-primary btn-lg">Start free <ArrowRight size={17} /></Link>
                <Link href="/platform" className="btn btn-secondary btn-lg">Explore the platform</Link>
              </div>
              <div className="hero-assurance">
                <span><Check size={14} /> Free workspace</span><span><Check size={14} /> No credit card</span><span><ShieldCheck size={14} /> Read-only by design</span>
              </div>
            </div>
            <ProductStage />
          </div>
        </section>

        <section className="proof-strip">
          <div className="public-shell proof-grid">
            <p>Built for teams that run production</p>
            {proof.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
          </div>
        </section>

        <section className="public-section section-intro-wrap">
          <div className="public-shell">
            <div className="section-heading centered">
              <span className="section-kicker">The operational control plane</span>
              <h2>Less tool switching.<br/>More shared understanding.</h2>
              <p>DevOps Monitor connects infrastructure state, service behavior and incident evidence in one consistent workspace.</p>
            </div>
            <SignalFlow />
          </div>
        </section>

        <section className="public-section workbench-section">
          <div className="public-shell">
            <div className="section-heading split-heading"><div><span className="section-kicker">Click through the signal path</span><h2>Data you can inspect, not decoration.</h2></div><p>Select any resource or switch to the evidence timeline. The preview updates the same way an operator moves through a real incident.</p></div>
            <OperationsWorkbench />
          </div>
        </section>

        <section className="public-section capability-section">
          <div className="public-shell">
            <div className="section-heading split-heading"><div><span className="section-kicker">One connected platform</span><h2>Depth where operators need it.</h2></div><p>Move from fleet health to the exact container, query, port or event without losing context.</p></div>
            <div className="capability-grid">
              {capabilities.map((item, index) => <Link href={item.href} className={`capability-card tone-${index + 1}`} key={item.title}><div className="capability-top"><span className="capability-icon"><item.icon size={20} /></span><span className="capability-index">0{index + 1}</span></div><h3>{item.title}</h3><p>{item.text}</p><span className="capability-stat">{item.stat} <ArrowRight size={14} /></span></Link>)}
            </div>
          </div>
        </section>

        <section className="public-section safety-section">
          <div className="public-shell safety-grid">
            <div className="safety-copy">
              <span className="section-kicker light">A safer default</span>
              <h2>Observability should not become an attack path.</h2>
              <p>Our collection plane is intentionally separated from production control. There are no start, stop, restart, kill, delete, edit, sudo-write, terminal or shell actions.</p>
              <div className="safety-list">
                <span><ShieldCheck size={18} /> Encrypted credential vault</span>
                <span><Eye size={18} /> Read-only collection contract</span>
                <span><Code2 size={18} /> Complete audit trail</span>
              </div>
              <Link href="/security" className="btn btn-light">Read the security model <ArrowRight size={15} /></Link>
            </div>
            <div className="boundary-card">
              <div className="boundary-label"><span>Trust boundary</span><i>verified</i></div>
              <div className="boundary-row"><span><Globe2 size={18} /> DevOps Monitor</span><em>Encrypted collection</em><span><Cloud size={18} /> Your infrastructure</span></div>
              <div className="boundary-rule"><i /><strong>Telemetry flows in</strong><i /></div>
              <div className="boundary-denied"><span>Commands</span><span>Shell</span><span>Mutation</span><span>Privilege escalation</span></div>
              <div className="boundary-status"><CircleGauge size={18} /><div><strong>Read-only policy active</strong><small>All monitored environments protected</small></div><b>ON</b></div>
            </div>
          </div>
        </section>

        <section className="public-section final-cta-section">
          <div className="public-shell final-cta">
            <div><span className="section-kicker">Ready when you are</span><h2>Make production easier to understand.</h2><p>Start with a free workspace, connect your first host, and see useful telemetry in minutes.</p></div>
            <div className="hero-actions"><Link href="/signup" className="btn btn-primary btn-lg">Create your workspace <ArrowRight size={17} /></Link><Link href="/contact" className="btn btn-secondary btn-lg">Talk to an engineer</Link></div>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
