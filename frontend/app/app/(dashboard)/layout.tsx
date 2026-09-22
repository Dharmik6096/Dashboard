"use client";
import { useState, useEffect } from "react";
import { FilterProvider } from "@/lib/FilterContext";
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
      
      // Client-side guard: if no token exists, redirect to login
      if (!localStorage.getItem("access_token") && !sessionStorage.getItem("access_token") && !localStorage.getItem("refresh_token")) {
        window.location.replace("/login");
      }
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
      <FilterProvider>
        <div className="layout" style={{ visibility: "hidden" }}>
          <Topbar collapsed={false} />
          <Sidebar collapsed={false} onToggle={() => { }} />
        </div>
      </FilterProvider>
    );
  }

  return (
    <FilterProvider>
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
    </FilterProvider>
  );
}
