import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { PublicLayout } from "./PublicLayout";

type ProductItem = {
  title: string;
  description: string;
  icon: ElementType;
  status?: "Available today" | "Roadmap";
};

export type PlatformDetail = {
  kicker: string;
  title: string;
  description: string;
  problem: { title: string; description: string; points: string[] };
  productView: { title: string; description: string; items: ProductItem[] };
  workflows: { title: string; description: string; steps: { title: string; description: string }[] };
  security: { title: string; description: string; points: string[] };
  nextStep: { title: string; description: string; label: string; href: string; secondaryLabel: string; secondaryHref: string };
};

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="detail-heading"><span className="section-kicker">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>;
}

function DetailSection({ name, alternate = false, children }: { name: string; alternate?: boolean; children: ReactNode }) {
  return <section data-section={name} className={`page-section detail-section${alternate ? " alt" : ""}`}><div className="public-shell">{children}</div></section>;
}

export function PlatformDetailPage({ detail }: { detail: PlatformDetail }) {
  return <PublicLayout><main className="platform-detail">
    <section className="public-page-hero">
      <div className="public-shell">
        <span className="section-kicker">{detail.kicker}</span>
        <h1>{detail.title}</h1>
        <p>{detail.description}</p>
        <div className="detail-trust"><ShieldCheck size={16} /><span>Read-only by architecture. No shell access or remote server changes.</span></div>
      </div>
    </section>

    <DetailSection name="problem">
      <div className="detail-split">
        <SectionHeading eyebrow="Problem" title={detail.problem.title} description={detail.problem.description} />
        <ul className="detail-checklist">{detail.problem.points.map(point => <li key={point}><Check size={16} />{point}</li>)}</ul>
      </div>
    </DetailSection>

    <DetailSection name="product-view" alternate>
      <SectionHeading eyebrow="Product view" title={detail.productView.title} description={detail.productView.description} />
      <div className="detail-product-grid">{detail.productView.items.map(item => {
        const Icon = item.icon;
        return <article className="detail-product-card" key={item.title}>
          <div className="detail-product-icon"><Icon size={20} /></div>
          <div><div className="detail-product-title"><h3>{item.title}</h3>{item.status && <span className={item.status === "Roadmap" ? "roadmap" : "available"}>{item.status}</span>}</div><p>{item.description}</p></div>
        </article>;
      })}</div>
    </DetailSection>

    <DetailSection name="workflows">
      <SectionHeading eyebrow="Workflows" title={detail.workflows.title} description={detail.workflows.description} />
      <ol className="detail-workflow">{detail.workflows.steps.map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol>
    </DetailSection>

    <DetailSection name="security" alternate>
      <div className="detail-security">
        <SectionHeading eyebrow="Security" title={detail.security.title} description={detail.security.description} />
        <ul>{detail.security.points.map(point => <li key={point}><ShieldCheck size={17} /><span>{point}</span></li>)}</ul>
      </div>
    </DetailSection>

    <DetailSection name="next-step">
      <div className="detail-next"><div><span className="section-kicker">Next step</span><h2>{detail.nextStep.title}</h2><p>{detail.nextStep.description}</p></div><div className="hero-actions"><Link href={detail.nextStep.href} className="btn btn-primary btn-lg">{detail.nextStep.label}<ArrowRight size={16} /></Link><Link href={detail.nextStep.secondaryHref} className="btn btn-secondary btn-lg">{detail.nextStep.secondaryLabel}</Link></div></div>
    </DetailSection>
  </main></PublicLayout>;
}
