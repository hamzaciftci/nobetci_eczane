import type { MetadataRoute } from "next";
import { fetchProvinces } from "../lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const provinces = await fetchProvinces().catch(() => []);
  const now = new Date();

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1
    },
    ...provinces.map((province) => ({
      url: `${baseUrl}/nobetci-eczane/${province.slug}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.9
    }))
  ];
}
