import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("docs");
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
