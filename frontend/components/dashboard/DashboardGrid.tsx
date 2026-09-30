"use client";

import { useEffect, useState } from "react";
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { WidgetRenderer } from "./WidgetRenderer";

interface Widget {
  id: string;
  type: string;
  title: string;
  metric?: string;
  options?: any;
}

interface DashboardGridProps {
  layout: any[];
  widgets: Widget[];
  isEditing?: boolean;
  onLayoutChange?: (layout: any[]) => void;
}

export function DashboardGrid({ layout, widgets, isEditing = false, onLayoutChange }: DashboardGridProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full">
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={30}
        width={1200} // Ideally we'd use Responsive, but GridLayout with fixed width is simpler for a stable start
        isDraggable={isEditing}
        isResizable={isEditing}
        onLayoutChange={onLayoutChange}
      >
        {layout.map((l) => {
          const widget = widgets.find((w) => w.id === l.i);
          return (
            <div key={l.i} className="bg-card border border-border/50 rounded-lg p-4 shadow-sm flex flex-col cursor-move relative overflow-hidden">
              {widget ? (
                <>
                  <h3 className="text-sm font-semibold mb-2">{widget.title}</h3>
                  <div className="flex-1 min-h-0 w-full overflow-hidden">
                    <WidgetRenderer widget={widget} />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Empty Widget
                </div>
              )}
            </div>
          );
        })}
      </GridLayout>
    </div>
  );
}
