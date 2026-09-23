import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { siteUrl } from "@/lib/public-pages";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "DevOps Monitor V2",
    template: "%s · DevOps Monitor V2",
  },
  description: "Enterprise read-only observability for infrastructure, containers, networks, databases and queues.",
  applicationName: "DevOps Monitor",
  keywords: ["observability", "infrastructure monitoring", "DevOps", "Docker", "server monitoring"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0e1a" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
