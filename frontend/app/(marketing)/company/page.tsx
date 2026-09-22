import type { Metadata } from "next";
import { Compass, HeartHandshake, Lightbulb, ShieldCheck, Users, Waypoints } from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { FeatureGrid, PageHero } from "@/components/marketing/PagePrimitives";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("company");
const values=[
 {icon:Compass,title:"Clarity over volume",text:"More data is not the goal. The goal is a faster, defensible understanding of production."},
 {icon:ShieldCheck,title:"Safety is a feature",text:"A monitoring tool should earn trust through architecture, not simply through promises."},
 {icon:Users,title:"Operators are the customer",text:"We optimize for the person investigating a real incident at an inconvenient hour."},
 {icon:Lightbulb,title:"Explain the evidence",text:"Automation and AI must show what they observed and how they reached a conclusion."},
 {icon:Waypoints,title:"Context beats dashboards",text:"The relationship between signals matters more than the number of panels on screen."},
 {icon:HeartHandshake,title:"Build for the long run",text:"Predictable pricing, portable data and honest product boundaries create durable partnerships."},
];
export default function CompanyPage(){return <PublicLayout><main><PageHero kicker="Company" title="We are building the calmest place to understand production." description="DevOps Monitor exists because infrastructure teams deserve deep visibility without another privileged control surface or another maze of disconnected dashboards." primary="See open roles" primaryHref="/company#careers" secondary="Contact us"/><FeatureGrid title="How we build" description="The principles behind every product, architecture and design decision." features={values}/><section className="page-section alt" id="careers"><div className="public-shell"><div className="content-heading"><span className="section-kicker">Careers</span><h2>Help make operations more understandable.</h2><p>We are building a focused team across product engineering, distributed systems, design and customer reliability. Send an introduction through our contact page.</p></div></div></section></main></PublicLayout>}
