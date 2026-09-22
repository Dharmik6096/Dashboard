import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("signup");
export default function SignupLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
