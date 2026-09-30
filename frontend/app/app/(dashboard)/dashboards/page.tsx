"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardService, Dashboard } from "@/lib/services/dashboard";
import { LayoutDashboard, Plus, Star, Trash, Settings, Clock, Check, MoreVertical } from "lucide-react";

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboards();
  }, []);

  const fetchDashboards = async () => {
    try {
      const data = await DashboardService.list();
      setDashboards(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (dash: Dashboard) => {
    try {
      await DashboardService.update(dash.id, { is_favorite: !dash.is_favorite, version: dash.version });
      fetchDashboards();
    } catch (e) {
      console.error("Failed to update favorite", e);
    }
  };

  const toggleDefault = async (dash: Dashboard) => {
    try {
      await DashboardService.update(dash.id, { is_default: !dash.is_default, version: dash.version });
      fetchDashboards();
    } catch (e) {
      console.error("Failed to update default", e);
    }
  };

  const deleteDashboard = async (id: string) => {
    if (!confirm("Are you sure you want to delete this dashboard?")) return;
    try {
      await DashboardService.delete(id);
      fetchDashboards();
    } catch (e) {
      console.error("Failed to delete dashboard", e);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground text-sm">Manage your custom monitoring dashboards</p>
        </div>
        <Link 
          href="/app/dashboards/new" 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Dashboard
        </Link>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted/20 rounded-md"></div>
          ))}
        </div>
      ) : dashboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-lg border border-border/40 text-center">
          <LayoutDashboard className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No dashboards yet</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            Create your first dashboard to start monitoring your infrastructure with custom widgets and layouts.
          </p>
          <Link 
            href="/app/dashboards/new" 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Create Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {dashboards.map((dash) => (
            <div key={dash.id} className="group flex items-center justify-between p-4 bg-card rounded-lg border border-border/50 hover:border-border transition-colors">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleFavorite(dash)}
                  className={`p-2 rounded-full hover:bg-muted ${dash.is_favorite ? 'text-yellow-500' : 'text-muted-foreground opacity-30 group-hover:opacity-100'}`}
                >
                  <Star className="w-5 h-5" fill={dash.is_favorite ? "currentColor" : "none"} />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/app/dashboards/${dash.id}`} className="font-semibold text-base hover:underline">
                      {dash.name}
                    </Link>
                    {dash.is_default && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                        <Check className="w-3 h-3" /> Default
                      </span>
                    )}
                  </div>
                  {dash.description && (
                    <p className="text-sm text-muted-foreground mt-1">{dash.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 opacity-70">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Updated {new Date(dash.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => toggleDefault(dash)}
                  className="px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 rounded"
                >
                  Make Default
                </button>
                <Link 
                  href={`/app/dashboards/${dash.id}/edit`}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <button 
                  onClick={() => deleteDashboard(dash.id)}
                  className="p-2 text-red-500 hover:bg-red-500/10 rounded-md"
                >
                  <Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
