import { Activity } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-mark-grid" />
      <Activity size={compact ? 15 : 18} strokeWidth={2.3} />
    </span>
  );
}

