"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import api from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";

export default function LoginPage(){
 const[identifier,setIdentifier]=useState("");const[password,setPassword]=useState("");const[visible,setVisible]=useState(false);const[remember,setRemember]=useState(true);const[loading,setLoading]=useState(false);const[error,setError]=useState("");const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setError("");try{const body=new URLSearchParams({username:identifier,password});const res=await api.post("/auth/login",body,{headers:{"Content-Type":"application/x-www-form-urlencoded"}});sessionStorage.setItem("access_token",res.data.access_token);if(remember){localStorage.setItem("access_token",res.data.access_token);localStorage.setItem("refresh_token",res.data.refresh_token)}else{localStorage.removeItem("access_token");localStorage.removeItem("refresh_token")}localStorage.setItem("user",JSON.stringify(res.data.user));router.push("/app")}catch(err:unknown){setError((err as {response?:{data?:{detail?:string}}}).response?.data?.detail||"We could not sign you in with those credentials.")}finally{setLoading(false)}}
 return <AuthShell eyebrow="Welcome back" title="Sign in to your workspace" description="Use your username or work email to continue."><form className="auth-form" onSubmit={submit}><label>Username or work email<input required autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="you@company.com"/></label><label>Password<div className="auth-password"><input required minLength={8} type={visible?"text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" onClick={()=>setVisible(v=>!v)} aria-label={visible?"Hide password":"Show password"}>{visible?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label><div className="auth-form-row"><label className="auth-check"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span/>Keep me signed in</label><Link href="/forgot-password">Forgot password?</Link></div>{error&&<div className="auth-error"><LockKeyhole size={15}/>{error}</div>}<button className="auth-submit" disabled={loading} type="submit">{loading?"Signing in…":"Sign in securely"}<ArrowRight size={16}/></button><div className="auth-divider"><span>New to DevOps Monitor?</span></div><Link className="btn btn-secondary auth-alt" href="/signup">Create a free workspace</Link></form></AuthShell>
}

