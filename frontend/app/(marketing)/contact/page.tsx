import type { Metadata } from "next";
import { Clock3, Mail, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { ContactForm } from "@/components/marketing/ContactForm";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("contact");
export default function ContactPage(){return <PublicLayout><main><section className="public-page-hero"><div className="public-shell"><span className="section-kicker">Contact</span><h1>Bring us the hard infrastructure questions.</h1><p>Tell us what you operate, where visibility breaks down and what your security model requires.</p></div></section><section className="page-section"><div className="public-shell page-grid-2" style={{maxWidth:1000}}><div><div className="content-heading"><h2>Talk to a real engineer.</h2><p>We route your request to the right product, reliability or security specialist.</p></div><div className="info-card"><ul><li><Clock3 size={15}/>Typical response within one business day</li><li><Mail size={15}/>Product, billing and technical questions welcome</li><li><ShieldCheck size={15}/>Security review material available for qualified teams</li></ul></div></div><ContactForm/></div></section></main></PublicLayout>}
