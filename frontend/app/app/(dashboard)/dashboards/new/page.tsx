"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardService } from "@/lib/services/dashboard";
import { ArrowLeft, LayoutDashboard, Server, Box } from "lucide-react";
import Link from "next/link";

export default function NewDashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState("blank");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      let layout: any[] = [];
      let widgets: any[] = [];
      
      if (template === "infrastructure") {
         // Create dummy widgets for infra template
         widgets = [
           { id: "w1", type: "stat", title: "Total Servers", metric: "server_count" },
           { id: "w2", type: "stat", title: "Total Containers", metric: "container_count" },
         ];
         layout = [
           { i: "w1", x: 0, y: 0, w: 2, h: 2 },
           { i: "w2", x: 2, y: 0, w: 2, h: 2 },
         ];
      }
      
      const dash = await DashboardService.create({
        name,
        description,
        is_default: false,
        is_favorite: false,
        layout,
        widgets
      });
      router.push(`/app/dashboards/${dash.id}/edit`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/app/dashboards" className="text-sm text-muted-foreground flex items-center gap-2 hover:text-foreground w-fit mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboards
      </Link>
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Dashboard</h1>
        <p className="text-muted-foreground text-sm">Start from scratch or use a template</p>
      </div>

      <div className="bg-card border border-border/50 rounded-lg p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Dashboard Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g. Production Overview"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary h-20"
              placeholder="What is this dashboard for?"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border/50">
          <label className="block text-sm font-medium mb-4">Select Template</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => setTemplate("blank")}
              className={`p-4 border rounded-lg text-left transition-all ${template === 'blank' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
            >
              <LayoutDashboard className={`w-6 h-6 mb-3 ${template === 'blank' ? 'text-primary' : 'text-muted-foreground'}`} />
              <h4 className="font-semibold text-sm mb-1">Blank Dashboard</h4>
              <p className="text-xs text-muted-foreground">Start from scratch. Add widgets manually.</p>
            </button>
            <button 
              onClick={() => setTemplate("infrastructure")}
              className={`p-4 border rounded-lg text-left transition-all ${template === 'infrastructure' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
            >
              <Server className={`w-6 h-6 mb-3 ${template === 'infrastructure' ? 'text-primary' : 'text-muted-foreground'}`} />
              <h4 className="font-semibold text-sm mb-1">Infrastructure Overview</h4>
              <p className="text-xs text-muted-foreground">Pre-configured servers & metrics.</p>
            </button>
            <button 
              onClick={() => setTemplate("containers")}
              className={`p-4 border rounded-lg text-left transition-all ${template === 'containers' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}
            >
              <Box className={`w-6 h-6 mb-3 ${template === 'containers' ? 'text-primary' : 'text-muted-foreground'}`} />
              <h4 className="font-semibold text-sm mb-1">Docker Containers</h4>
              <p className="text-xs text-muted-foreground">Pre-configured container resource usage.</p>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button 
            disabled={!name.trim() || loading}
            onClick={handleCreate}
            className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-md disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Dashboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
