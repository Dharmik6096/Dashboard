import type { Metadata } from "next";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { PageHero } from "@/components/marketing/PagePrimitives";
import { PricingTable } from "@/components/marketing/PricingTable";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("pricing");
export default function PricingPage(){return <PublicLayout><main><PageHero kicker="Simple pricing" title="Start small. Scale without surprises." description="Clear workspace plans with no per-query tax. Upgrade when your host count, retention or governance needs grow." primary="Start free" secondary="Compare with an engineer"/><section className="page-section"><div className="public-shell"><PricingTable/><p style={{textAlign:"center",color:"#777a88",fontSize:11,marginTop:28}}>Infrastructure telemetry only. Cloud provider charges, if any, remain with your provider. Taxes may apply.</p></div></section></main></PublicLayout>}
