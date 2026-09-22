import { Header } from "./Header";
import { SiteFooter } from "./SiteFooter";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><Header />{children}<SiteFooter /></>;
}

