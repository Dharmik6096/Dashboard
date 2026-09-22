import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// /dashboard just redirects to the root dashboard handled by (dashboard)/page.tsx
export default function DashboardRedirect() {
  redirect(routes.home);
}
