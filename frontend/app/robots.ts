import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/public-pages";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/app/"] }], sitemap: new URL("/sitemap.xml", siteUrl).toString() };
}
