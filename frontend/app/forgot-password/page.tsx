"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
export default function ForgotPasswordPage(){const[email,setEmail]=useState("");const[loading,setLoading]=useState(false);const[sent,setSent]=useState(false);async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);try{await api.post("/auth/forgot-password",{email})}finally{setSent(true);setLoading(false)}}return <AuthShell eyebrow="Account recovery" title="Reset your password" description="We will send recovery instructions if the address belongs to an active account.">{sent?<div className="auth-success"><CheckCircle2 size={25}/><h3>Check your inbox</h3><p>If an account exists for <strong>{email}</strong>, recovery instructions are on the way.</p><Link href="/login" className="btn btn-secondary"><ArrowLeft size={15}/>Back to sign in</Link></div>:<form className="auth-form" onSubmit={submit}><label>Work email<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></label><button className="auth-submit" disabled={loading} type="submit">{loading?"Sending…":"Send reset instructions"}<ArrowRight size={16}/></button><Link className="auth-back" href="/login"><ArrowLeft size={14}/>Back to sign in</Link></form>}</AuthShell>}

