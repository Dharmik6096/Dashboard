"use client";

import Link from "next/link";
import { ArrowRight, Terminal, Zap, CheckCircle2 } from "lucide-react";

export function StoryCTA() {
  return (
    <div className="w-full relative rounded-3xl bg-gradient-to-br from-[#eff6ff] to-[#bfdbfe] border border-blue-100 p-8 md:p-12 lg:p-16 shadow-md mb-8">

      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[150%] bg-white/20 blur-3xl transform rotate-12 rounded-full" />
        <div className="absolute top-[30%] -right-[10%] w-[40%] h-[100%] bg-blue-400/10 blur-3xl transform -rotate-12 rounded-full" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto gap-6">

        {/* Story steps */}
        <div className="flex flex-col items-center gap-1">
          <div className="bg-white/80 backdrop-blur text-gray-600 text-xs font-bold px-4 py-2 rounded-lg border border-white flex items-center gap-2 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            Issue Detected
          </div>
          <div className="w-px h-4 bg-blue-300" />
          <div className="bg-white/80 backdrop-blur text-gray-600 text-xs font-bold px-4 py-2 rounded-lg border border-white flex items-center gap-2 shadow-sm">
            <Zap size={13} className="text-blue-500 flex-shrink-0" /> Correlated
          </div>
          <div className="w-px h-4 bg-blue-300 relative">
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-blue-400" />
          </div>
          <div className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md flex items-center gap-2 mt-1">
            <CheckCircle2 size={13} className="text-blue-200 flex-shrink-0" /> Root Cause Explained
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-blue-950 tracking-tight leading-tight">
          Stop guessing. Start knowing.
        </h2>

        <p className="text-base sm:text-lg text-blue-900/75 max-w-xl leading-relaxed">
          Deploy DevOps Monitor in minutes. Connect your first server via SSH, and let the AI find your next incident&apos;s root cause before you even open a terminal.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm"
          >
            Get Started <ArrowRight size={16} />
          </Link>
          <Link
            href="/docs"
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-gray-50 text-blue-900 font-bold rounded-xl border border-blue-100 shadow-sm transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm"
          >
            <Terminal size={16} className="text-blue-400" /> View Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
