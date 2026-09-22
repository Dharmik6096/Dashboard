"use client";

// FilterProvider is intentionally NOT here — it lives in the dashboard layout
// only, so public/marketing pages never trigger an authenticated API call.
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
