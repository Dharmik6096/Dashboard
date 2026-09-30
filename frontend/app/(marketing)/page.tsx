import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, Check, Server, Eye, Cloud, Database, BarChart3, Clock, Lock } from "lucide-react";
import { PublicLayout } from "@/components/marketing/PublicLayout";
import { CapabilitiesTabs } from "@/components/marketing/CapabilitiesTabs";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("home");

export default function HomePage() {
  return (
    <PublicLayout>
      <main className="grafana-homepage">
        
        {/* HERO SECTION */}
        <section className="grafana-hero">
          <div className="grafana-hero-bg" aria-hidden="true">
            <div className="bg-glow" />
          </div>
          <div className="public-shell grafana-hero-grid">
            <div className="grafana-hero-copy">
              <Link href="/platform" className="grafana-pill">
                <Sparkles size={13} className="pulse-icon" /> 
                <span>DevOps Monitor V2 is here</span> 
                <ArrowRight size={13} />
              </Link>
              <h1 className="grafana-h1">
                Monitor your infrastructure.<br/>
                <span className="text-gradient">Build custom dashboards.</span>
              </h1>
              <p className="grafana-subtitle">
                DevOps Monitor provides a dense, Datadog-inspired overview of your entire stack—servers, containers, databases, and logs. Now featuring multiple user-created dashboards, configurable widgets, and saved layouts.
              </p>
              <div className="grafana-hero-actions">
                <Link href="/signup" className="btn btn-grafana-primary btn-lg">Start free <ArrowRight size={17} /></Link>
                <Link href="/platform" className="btn btn-grafana-secondary btn-lg">Explore the platform</Link>
              </div>
              <div className="grafana-hero-trust">
                <span><Check size={14} /> Open source agent</span>
                <span><Check size={14} /> No credit card required</span>
                <span><Check size={14} /> Strict read-only boundary</span>
              </div>
            </div>
            
            <div className="grafana-hero-visual">
              <div className="perspective-dashboard">
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
                      <div className="dash-card spark-card"><div className="spark-line" /></div>
                    </div>
                    <div className="dash-row large">
                      <div className="dash-card chart-card"><div className="chart-bars" /></div>
                      <div className="dash-card chart-card"><div className="chart-wave" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LOGO MARQUEE */}
        <section className="grafana-logos">
          <div className="public-shell">
            <p>Trusted by engineering teams monitoring production</p>
            <div className="logo-marquee">
              {/* Placeholders for logos */}
              <div className="logo-item">Acme Corp</div>
              <div className="logo-item">Globex</div>
              <div className="logo-item">Soylent</div>
              <div className="logo-item">Initech</div>
              <div className="logo-item">Stark Ind.</div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE CAPABILITIES TABS */}
        <section className="grafana-capabilities-section">
          <div className="public-shell">
            <div className="section-heading centered">
              <span className="section-kicker">Unified Telemetry</span>
              <h2>One platform for all your signals.</h2>
              <p>Move seamlessly from high-level fleet dashboards to the specific container, query, or log line causing the issue.</p>
            </div>
            <CapabilitiesTabs />
          </div>
        </section>

        {/* GRID FEATURES */}
        <section className="grafana-grid-features">
          <div className="public-shell">
            <div className="section-heading">
              <h2>Built for speed and safety.</h2>
            </div>
            <div className="grafana-3col-grid">
              <div className="grid-feature-card">
                <div className="feature-icon"><BarChart3 size={24} /></div>
                <h3>Dense Operations UI</h3>
                <p>Inspired by the best tools in the industry, our interface prioritizes information density over white space.</p>
              </div>
              <div className="grid-feature-card">
                <div className="feature-icon"><Clock size={24} /></div>
                <h3>15-Second Refresh</h3>
                <p>Don't wait for your monitoring to catch up to reality. Telemetry flows in with sub-minute resolution.</p>
              </div>
              <div className="grid-feature-card">
                <div className="feature-icon"><Lock size={24} /></div>
                <h3>Read-Only Guarantee</h3>
                <p>Our agents collect state without the ability to mutate it. No remote shell, no container kills.</p>
              </div>
              <div className="grid-feature-card">
                <div className="feature-icon"><Server size={24} /></div>
                <h3>Bare-metal or Cloud</h3>
                <p>Deploy the agent on AWS EC2, DigitalOcean droplets, or on-premise hardware seamlessly.</p>
              </div>
              <div className="grid-feature-card">
                <div className="feature-icon"><Cloud size={24} /></div>
                <h3>Fully Hosted</h3>
                <p>We manage the timeseries database, the correlation engine, and the dashboards so you don't have to.</p>
              </div>
              <div className="grid-feature-card">
                <div className="feature-icon"><Eye size={24} /></div>
                <h3>Complete Audit Trail</h3>
                <p>Every login, configuration change, and alert modification is logged and available for compliance review.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="grafana-final-cta">
          <div className="public-shell">
            <div className="cta-box">
              <div className="cta-glow" />
              <h2>Stop flying blind in production.</h2>
              <p>Join thousands of engineers who trust DevOps Monitor for their infrastructure.</p>
              <div className="grafana-hero-actions justify-center">
                <Link href="/signup" className="btn btn-grafana-primary btn-lg">Create your workspace <ArrowRight size={17} /></Link>
              </div>
            </div>
          </div>
        </section>
        
      </main>
    </PublicLayout>
  );
}
