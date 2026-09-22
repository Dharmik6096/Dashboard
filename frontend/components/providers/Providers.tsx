"use client";

import { FilterProvider } from "@/lib/FilterContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <FilterProvider>
      {children}
    </FilterProvider>
  );
}
