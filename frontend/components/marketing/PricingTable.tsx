"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const plans = [
  {name:"Starter",monthly:0,annual:0,text:"For individuals and small labs validating the platform.",cta:"Start free",features:["5 monitored hosts","7-day retention","Core dashboards","Email alerts","Community support"]},
  {name:"Scale",monthly:59,annual:49,text:"For production teams that need broader coverage and collaboration.",cta:"Start 14-day trial",featured:true,features:["50 monitored hosts","30-day retention","AI investigations","Team roles and audit log","Priority support"]},
  {name:"Enterprise",monthly:null,annual:null,text:"For organizations with advanced governance, scale and support needs.",cta:"Contact sales",features:["Unlimited workspace design","Custom retention","SSO and provisioning","Private deployment options","Enterprise SLA"]},
];

export function PricingTable(){
  const[annual,setAnnual]=useState(true);
  return <>
    <div className="pricing-toggle" role="group" aria-label="Billing frequency"><button className={!annual?"active":""} onClick={()=>setAnnual(false)}>Monthly</button><button className={annual?"active":""} onClick={()=>setAnnual(true)}>Annual · save up to 20%</button></div>
    <div className="pricing-grid" style={{marginTop:38}}>{plans.map(plan=>{const price=annual?plan.annual:plan.monthly;return <article className={`price-card ${plan.featured?"featured":""}`} key={plan.name}><h3>{plan.name}</h3><p>{plan.text}</p><div className="price">{price===null?"Custom":`$${price}`}<small>{price!==null&&price!==0?" / month":""}</small></div>{price!==null&&price!==0&&<span className="billing-note">{annual?"Billed annually":"Billed monthly"}</span>}<ul>{plan.features.map(feature=><li key={feature}><Check size={14}/>{feature}</li>)}</ul><Link href={plan.name==="Enterprise"?"/contact":"/signup"} className={`btn ${plan.featured?"btn-primary":"btn-secondary"}`}>{plan.cta}</Link></article>})}</div>
  </>;
}
