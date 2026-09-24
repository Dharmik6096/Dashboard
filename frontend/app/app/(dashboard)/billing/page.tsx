"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, ExternalLink, Loader2, Receipt, ShieldCheck, Sparkles } from "lucide-react";

import { DashboardDataState } from "@/components/ui/DashboardDataState";
import api from "@/lib/api";

type Plan = { id: string; name: string; price_monthly: number; host_limit: number | null; retention_days: number; features: string[] };
type Billing = { plan: string; status: string; host_count: number; host_limit: number | null; period_end: string | null };

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [plansResponse, billingResponse] = await Promise.all([api.get<Plan[]>("/billing/plans"), api.get<Billing>("/billing/summary")]);
      setPlans(plansResponse.data);
      setBilling(billingResponse.data);
    } catch {
      setError("Billing data could not be loaded from the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function checkout(plan: string) {
    setBusy(plan);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/billing/checkout-session", { plan, success_url: `${location.origin}/app/billing?checkout=success`, cancel_url: location.href });
      if (data.url) location.assign(data.url);
      else setNotice(data.message || "Checkout is not configured for this deployment.");
    } catch (requestError: unknown) {
      setError((requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Checkout could not be started.");
    } finally { setBusy(""); }
  }

  async function portal() {
    setBusy("portal");
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/billing/portal-session", { return_url: location.href });
      if (data.url) location.assign(data.url);
      else setNotice(data.message || "No billing portal URL was returned.");
    } catch (requestError: unknown) {
      setError((requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Billing portal could not be opened.");
    } finally { setBusy(""); }
  }

  return <div className="v2-workspace-page">
    <header className="v2-page-head"><div><span>Workspace administration</span><h1>Plans &amp; billing</h1><p>Review the current subscription, usage limits, and available plans.</p></div><button className="v2-page-button secondary" type="button" onClick={portal} disabled={loading || Boolean(busy)}>{busy === "portal" ? <Loader2 size={15} className="spin" /> : <CreditCard size={15} />}Manage payment method<ExternalLink size={12} /></button></header>
    {notice ? <div className="v2-inline-note is-success" role="status">{notice}</div> : null}
    {error && !loading ? <div className="v2-inline-note is-error" role="alert">{error}</div> : null}

    {loading ? <DashboardDataState kind="loading" title="Loading billing details" description="Reading subscription and plan data." />
      : !billing ? <DashboardDataState kind="error" title="Billing unavailable" description={error || "No subscription summary was returned."} onRetry={load} />
        : <>
          <section className="billing-summary" aria-label="Billing summary">
            <div><span><Sparkles size={16} />Current plan</span><strong>{billing.plan}</strong><small>{billing.status}</small></div>
            <div><span>Monitored hosts</span><strong>{billing.host_count}<em> / {billing.host_limit ?? "∞"}</em></strong><small>Current deployment usage</small></div>
            <div><span>Billing period</span><strong>{billing.period_end ? new Date(billing.period_end).toLocaleDateString() : "No renewal date"}</strong><small>{billing.period_end ? "Current period end" : "No paid period returned"}</small></div>
            <div><span><ShieldCheck size={16} />Payment security</span><strong>Stripe</strong><small>Card data is handled by Stripe Checkout</small></div>
          </section>

          <section className="v2-section-block"><div className="v2-section-title"><div><h2>Available plans</h2><p>Monthly pricing and limits returned by the billing API.</p></div></div><div className="app-plan-grid">{plans.map((plan) => { const current = billing.plan.toLowerCase() === plan.id; return <article className={current ? "current" : ""} key={plan.id}><div><span>{plan.name}</span>{current ? <b>Current</b> : null}</div><strong>{plan.id === "enterprise" ? "Custom" : `$${plan.price_monthly}`} {plan.id !== "enterprise" ? <small>/mo</small> : null}</strong><p>{plan.host_limit ? `${plan.host_limit} hosts · ${plan.retention_days}-day retention` : "Custom scale and retention"}</p><ul>{plan.features.map((feature) => <li key={feature}><Check size={13} />{feature}</li>)}</ul><button type="button" disabled={Boolean(busy) || current} onClick={() => checkout(plan.id)}>{busy === plan.id ? <Loader2 size={14} className="spin" /> : null}{current ? "Current plan" : plan.id === "enterprise" ? "Contact sales" : "Choose plan"}</button></article>; })}</div></section>

          <section className="v2-section-block"><div className="v2-section-title"><div><h2>Invoice history <span className="roadmap-badge">Roadmap</span></h2><p>The current backend does not provide an invoice-list endpoint.</p></div></div><div className="v2-empty-row"><Receipt size={20} /><div><strong>Invoice history is not available yet</strong><span>Use the Stripe billing portal for existing payment documents when a paid subscription is connected.</span></div></div></section>
        </>}
  </div>;
}
