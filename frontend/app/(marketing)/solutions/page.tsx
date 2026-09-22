import type { Metadata } from "next";
import { Building2, CloudCog, Gauge, Headphones, ShieldCheck, Users } from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { FeatureGrid, PageHero } from "@/components/marketing/PagePrimitives";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("solutions");
const solutions=[
 {icon:CloudCog,title:"Platform engineering",text:"Give application teams a consistent way to understand infrastructure without distributing privileged access.",points:["Shared service health","Environment-aware navigation","Reusable operating standards"]},
 {icon:Gauge,title:"DevOps & SRE",text:"Compress detection and investigation into one view with time-aligned metrics, logs and events.",points:["Alert-to-evidence workflow","Fleet and resource drill-down","Incident-ready context"]},
 {icon:Headphones,title:"Managed service providers",text:"Separate environments and customers while giving operators a repeatable, high-density console.",points:["Workspace isolation","Role-aware access","Usage and audit visibility"]},
 {icon:Building2,title:"Enterprise operations",text:"Bring infrastructure teams onto a controlled platform with predictable governance and billing.",points:["SSO-ready architecture","Central policy model","Enterprise support paths"]},
 {icon:Users,title:"Engineering leaders",text:"Use service health and capacity signals to prioritize operational work with less guesswork."},
 {icon:ShieldCheck,title:"Security teams",text:"Maintain a strict read-only collection boundary and a traceable record of product access."},
];
export default function SolutionsPage(){return <PublicLayout><main><PageHero kicker="Solutions" title="One platform for the teams accountable for production." description="From the person responding to an alert to the leader planning capacity, everyone works from the same operational truth."/><FeatureGrid title="Designed around operating models" description="Flexible enough for a growing engineering team, disciplined enough for enterprise infrastructure." features={solutions}/></main></PublicLayout>}
