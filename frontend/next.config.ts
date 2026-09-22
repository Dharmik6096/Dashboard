import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080",
  },
  async redirects() {
    return [
      { source: '/servers/:path*', destination: '/app/servers/:path*', permanent: true },
      { source: '/containers/:path*', destination: '/app/containers/:path*', permanent: true },
      { source: '/databases/:path*', destination: '/app/databases/:path*', permanent: true },
      { source: '/docker', destination: '/app/docker', permanent: true },
      { source: '/settings', destination: '/app/settings', permanent: true },
      { source: '/overview', destination: '/app', permanent: true },
    ]
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
