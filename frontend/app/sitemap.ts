import type { MetadataRoute } from "next";
import { publicPages, siteUrl } from "@/lib/public-pages";

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(publicPages).filter(page => !("index" in page) || page.index !== false).map(page => ({ url: new URL(page.path, siteUrl).toString(), changeFrequency: page.path === "/" ? "weekly" : "monthly", priority: page.path === "/" ? 1 : 0.7 }));
}
