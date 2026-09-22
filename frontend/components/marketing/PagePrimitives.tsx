import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export type Feature = { title: string; text: string; icon: React.ElementType; points?: string[] };

export function PageHero({ kicker, title, description, primary = "Start free", primaryHref = "/signup", secondary = "Talk to an engineer", secondaryHref = "/contact" }: { kicker: string; title: string; description: string; primary?: string; primaryHref?: string; secondary?: string; secondaryHref?: string }) {
  return <section className="public-page-hero"><div className="public-shell"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p><div className="hero-actions"><Link href={primaryHref} className="btn btn-primary btn-lg">{primary}<ArrowRight size={16}/></Link><Link href={secondaryHref} className="btn btn-secondary btn-lg">{secondary}</Link></div></div></section>;
}

export function FeatureGrid({ title, description, features, alternate = false }: { title: string; description: string; features: Feature[]; alternate?: boolean }) {
  return <section className={`page-section ${alternate ? "alt" : ""}`}><div className="public-shell"><div className="content-heading"><h2>{title}</h2><p>{description}</p></div><div className="page-grid-3">{features.map((feature)=><article id={feature.title.toLowerCase().replaceAll("&","").replaceAll(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")} className="info-card" key={feature.title}><span className="info-card-icon"><feature.icon size={21}/></span><h3>{feature.title}</h3><p>{feature.text}</p>{feature.points&&<ul>{feature.points.map((point)=><li key={point}><Check size={13}/>{point}</li>)}</ul>}</article>)}</div></div></section>;
}
