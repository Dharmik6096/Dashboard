import type { Metadata } from "next";
import "./marketing.css";

export const metadata: Metadata = {
  title: "DevOps Monitor V2 | AI-Powered Observability",
  description:
    "Unified observability for servers, containers, databases, applications, logs and more — with AI that helps you find and fix issues faster.",
};

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mkt-page">
      {children}
    </div>
  );
}
