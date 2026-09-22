import type { Metadata } from "next";
import { Eye, FileClock, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { FeatureGrid, PageHero } from "@/components/marketing/PagePrimitives";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("security");
const security=[
 {icon:Eye,title:"Read-only collection",text:"The product exposes no remote start, stop, restart, kill, delete, edit, sudo-write, terminal or shell operation.",points:["Collection-only agent contract","Restricted SSH command allowlist","No infrastructure mutation API"]},
 {icon:LockKeyhole,title:"Encrypted secrets",text:"Infrastructure credentials are encrypted at rest and masked everywhere outside the vault boundary.",points:["Fernet envelope encryption","Secrets never returned by APIs","Rotation-ready configuration"]},
 {icon:Fingerprint,title:"Hardened authentication",text:"Short-lived access tokens, refresh rotation, lockout controls and strong password validation reduce account risk.",points:["Rate-limited sign-in","Session revocation","Secure cookie support"]},
 {icon:KeyRound,title:"Scoped access",text:"Organization roles and API key scopes keep humans and integrations on least-privilege paths."},
 {icon:FileClock,title:"Audit history",text:"Security-sensitive actions produce a searchable record with actor, resource, time and request context."},
 {icon:ShieldCheck,title:"Defense in depth",text:"Security headers, origin controls, request limits and safe defaults are included in the deployment profile."},
];
export default function SecurityPage(){return <PublicLayout><main><PageHero kicker="Security" title="Deep visibility with a deliberately small blast radius." description="DevOps Monitor is designed so the observability plane cannot quietly become a production control plane." primary="Review the platform" primaryHref="/platform" secondary="Contact security"/><FeatureGrid title="Trust is an architecture decision" description="Controls are applied across collection, identity, data handling and product access—not added as a badge at the end." features={security} alternate/></main></PublicLayout>}
