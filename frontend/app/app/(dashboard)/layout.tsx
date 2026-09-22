"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Footer } from "@/components/layout/Footer";
import { AIChatDrawer } from "@/components/ui/AIChatDrawer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // SSR hydration safe
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      const saved = localStorage.getItem("devops-sidebar-collapsed");
      if (saved === "true") {
        setSidebarCollapsed(true);
      }
      setMounted(true);
    }, 0);
  }, []);

  const handleToggle = () => {
    const newVal = !sidebarCollapsed;
    setSidebarCollapsed(newVal);
    localStorage.setItem("devops-sidebar-collapsed", String(newVal));
  };

  // Prevent layout jump on hydration
  if (!mounted) {
    return (
      <div className="layout" style={{ visibility: "hidden" }}>
        <Topbar collapsed={false} />
        <Sidebar collapsed={false} onToggle={() => { }} />
      </div>
    );
  }

  return (
    <div className="layout">
      <Topbar collapsed={sidebarCollapsed} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggle} />
      <div className={`main-area ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <main className="page-content fade-in">
          {children}
        </main>
        <Footer />
      </div>
      <AIChatDrawer />
    </div>
  );
}
