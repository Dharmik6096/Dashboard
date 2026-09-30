"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardService, Dashboard } from "@/lib/services/dashboard";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { ArrowLeft, Save, X, Plus } from "lucide-react";
import Link from "next/link";

export default function DashboardEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [layout, setLayout] = useState<any[]>([]);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchDashboard(id as string);
  }, [id]);

  const fetchDashboard = async (dashId: string) => {
    try {
      const data = await DashboardService.get(dashId);
      setDashboard(data);
      setLayout(data.layout || []);
      setWidgets(data.widgets || []);
    } catch (e) {
      console.error(e);
      router.push("/app/dashboards");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dashboard) return;
    setSaving(true);
    try {
      await DashboardService.update(dashboard.id, {
        layout,
        widgets,
        version: dashboard.version
      });
      router.push(`/app/dashboards/${dashboard.id}`);
    } catch (e: any) {
      console.error(e);
      if (e.response?.status === 409) {
        alert("This dashboard was modified by someone else. Please refresh.");
      }
    } finally {
      setSaving(false);
    }
  };

  const addWidget = () => {
    const newId = `w_${Date.now()}`;
    const newWidget = { id: newId, type: "stat", title: "New Widget", metric: "cpu" };
    setWidgets([...widgets, newWidget]);
    // find a free spot or just place at bottom
    setLayout([...layout, { i: newId, x: 0, y: Infinity, w: 3, h: 2 }]);
  };

  if (loading) {
    return <div className="p-6 animate-pulse">Loading...</div>;
  }

  if (!dashboard) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border border-border/50 sticky top-4 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href={`/app/dashboards/${dashboard.id}`} className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Editing</span>
              <h1 className="text-xl font-bold tracking-tight">{dashboard.name}</h1>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={addWidget}
             className="flex items-center gap-2 px-4 py-2 border border-border bg-background text-foreground rounded-md font-medium text-sm hover:bg-muted"
           >
             <Plus className="w-4 h-4" />
             Add Widget
           </button>
           <button 
             onClick={handleSave}
             disabled={saving}
             className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50"
           >
             <Save className="w-4 h-4" />
             {saving ? "Saving..." : "Save Dashboard"}
           </button>
        </div>
      </div>

      <div className="bg-card/50 border border-dashed border-border p-4 rounded-lg min-h-[500px]">
        <DashboardGrid 
          layout={layout} 
          widgets={widgets} 
          isEditing={true} 
          onLayoutChange={(newLayout) => setLayout(newLayout)}
        />
      </div>
    </div>
  );
}
