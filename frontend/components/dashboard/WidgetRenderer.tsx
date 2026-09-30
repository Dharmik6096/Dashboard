"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function WidgetRenderer({ widget }: { widget: any }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching based on widget config. 
    // If the widget specifies a server, fetch server history.
    if (widget.server_id) {
      api.get(`/servers/${widget.server_id}/metrics/history?period=${widget.period || '1h'}`)
        .then(res => {
          setData(res.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      // Dummy data for now if no server specified
      setData([
        { time: "10:00", value: Math.random() * 100 },
        { time: "10:05", value: Math.random() * 100 },
        { time: "10:10", value: Math.random() * 100 },
      ]);
      setLoading(false);
    }
  }, [widget]);

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground animate-pulse">Loading...</div>;
  }

  // Render based on widget type
  if (widget.type === "stat") {
    const latest = data.length > 0 ? data[data.length - 1] : null;
    let val = latest ? (latest[widget.metric] || latest.value || 0) : 0;
    if (typeof val === 'number') val = val.toFixed(1);
    
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <span className="text-4xl font-bold">{val}</span>
        <span className="text-sm text-muted-foreground mt-2">{widget.metric}</span>
      </div>
    );
  }

  if (widget.type === "timeseries") {
    return (
      <div className="w-full h-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" hide />
            <YAxis width={30} tick={{fontSize: 10}} />
            <Tooltip />
            <Line type="monotone" dataKey={widget.metric || "value"} stroke="#3b82f6" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
      Unsupported widget type: {widget.type}
    </div>
  );
}
