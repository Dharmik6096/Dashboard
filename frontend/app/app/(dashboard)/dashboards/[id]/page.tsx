"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardService, Dashboard } from "@/lib/services/dashboard";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { ArrowLeft, Settings, Clock, Star } from "lucide-react";
import Link from "next/link";

export default function DashboardViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchDashboard(id as string);
  }, [id]);

  const fetchDashboard = async (dashId: string) => {
    try {
      const data = await DashboardService.get(dashId);
      setDashboard(data);
    } catch (e) {
      console.error(e);
      router.push("/app/dashboards");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted/20 rounded"></div>
        <div className="h-96 w-full bg-muted/20 rounded-lg"></div>
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/app/dashboards" className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                {dashboard.name}
                {dashboard.is_favorite && <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />}
              </h1>
            </div>
            {dashboard.description && (
              <p className="text-muted-foreground text-sm">{dashboard.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="text-xs text-muted-foreground flex items-center gap-1">
             <Clock className="w-4 h-4" /> Last updated: {new Date(dashboard.updated_at).toLocaleString()}
           </div>
           <Link 
             href={`/app/dashboards/${dashboard.id}/edit`}
             className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md font-medium text-sm hover:opacity-90"
           >
             <Settings className="w-4 h-4" />
             Edit Dashboard
           </Link>
        </div>
      </div>

      <div className="pt-4">
        {dashboard.layout && dashboard.layout.length > 0 ? (
          <DashboardGrid 
            layout={dashboard.layout} 
            widgets={dashboard.widgets} 
            isEditing={false} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-card rounded-lg border border-border/40 text-center">
             <h3 className="text-lg font-medium mb-2">This dashboard is empty</h3>
             <p className="text-muted-foreground text-sm max-w-md mb-6">
               Edit this dashboard to add widgets and configure your layout.
             </p>
             <Link 
               href={`/app/dashboards/${dashboard.id}/edit`}
               className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium text-sm hover:opacity-90"
             >
               Edit Dashboard
             </Link>
          </div>
        )}
      </div>
    </div>
  );
}
