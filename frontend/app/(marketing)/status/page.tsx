import type { Metadata } from "next";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { StatusBoard } from "@/components/marketing/StatusBoard";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("status");
export default function StatusPage(){return <PublicLayout><main><section className="public-page-hero"><div className="public-shell"><span className="section-kicker">System status</span><h1>Platform availability.</h1><p>Current status of the DevOps Monitor website, application and API.</p></div></section><section className="page-section alt"><div className="public-shell"><StatusBoard/></div></section></main></PublicLayout>}
