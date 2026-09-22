import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("login");
export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
