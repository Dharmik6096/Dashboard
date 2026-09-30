import Link from "next/link";
import { Activity, Boxes, Database, ShieldCheck, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/marketing/BrandMark";
import { brand } from "@/lib/brand";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grafana-auth-page">
      {/* Left: Auth Form */}
      <section className="grafana-auth-left">
        <div className="grafana-auth-card">
          <Link href="/" className="grafana-auth-brand">
            <BrandMark />
            <span>{brand.name}</span>
          </Link>
          <div className="grafana-auth-eyebrow">
            <Sparkles size={13} /> {eyebrow}
          </div>
          <h1>{title}</h1>
          <p className="grafana-auth-desc">{description}</p>
          
          <div className="grafana-auth-form-wrapper">
            {children}
          </div>
          
          <p className="grafana-auth-legal">
            By continuing, you agree to our{" "}
            <Link href="/legal/terms">Terms of Service</Link> and{" "}
            <Link href="/legal/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </section>

      {/* Right: Visual showcase */}
      <section className="grafana-auth-right">
        <div className="grafana-auth-showcase">
          <div className="bg-glow" />
          <div className="auth-perspective-dashboard">
            <div className="dash-header">
              <div className="dash-search" />
              <div className="dash-profile" />
            </div>
            <div className="dash-body">
              <div className="dash-sidebar">
                <i/><i/><i/><i/><i/>
              </div>
              <div className="dash-content">
                <div className="dash-row">
                  <div className="dash-card spark-card"><div className="spark-line" /></div>
                  <div className="dash-card spark-card"><div className="spark-line" /></div>
                </div>
                <div className="dash-row large">
                  <div className="dash-card chart-card"><div className="chart-bars" /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-trust-banner">
            <ShieldCheck size={16} color="#43e97b" />
            <span>Strict read-only boundary. No remote mutation.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
