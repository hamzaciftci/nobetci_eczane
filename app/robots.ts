import type { MetadataRoute } from "next";

const BASE_URL = "https://www.bugunnobetcieczaneler.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/embed/",
          "/il/*/yazdir",
          "/il/*/ekran",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
