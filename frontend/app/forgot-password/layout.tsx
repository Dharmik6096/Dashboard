import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/public-pages";
export const metadata: Metadata = publicPageMetadata("forgotPassword");
export default function ForgotPasswordLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
