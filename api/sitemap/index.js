/**
 * GET /sitemap.xml
 *
 * Tüm alt sitemap'leri listeleyen sitemap index döndürür.
 * Redis'te cache'lenir; cache yoksa anında üretilir (DB sorgusu yok).
 */
import { cacheGet, cacheSet } from "../_lib/cache.js";
import { buildSitemapIndex, sendXml, todayIso, BASE_URL } from "./_xml.js";

const CACHE_KEY = "sitemap:index";
const CACHE_TTL = 3600; // 1 saat
const CDN_TTL   = 3600;

/** Alt sitemap tanımları — yeni sitemap eklenince buraya yaz. */
const SUB_SITEMAPS = [
  { name: "static",     maxAge: 86400 },  // statik sayfalar: 24 saatte bir
  { name: "provinces",  maxAge: 3600  },  // iller: 1 saatte bir
  { name: "districts",  maxAge: 3600  },  // ilçeler: 1 saatte bir
  { name: "pharmacies", maxAge: 3600  },  // eczaneler: 1 saatte bir
  { name: "blog",       maxAge: 3600  },  // blog: 1 saatte bir
];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }

  // Cache hit
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return sendXml(res, cached, CDN_TTL);

  const today = todayIso();

  const sitemaps = SUB_SITEMAPS.map(({ name }) => ({
    loc:     `${BASE_URL}/sitemap-${name}.xml`,
    lastmod: today,
  }));

  const xml = buildSitemapIndex(sitemaps);
  await cacheSet(CACHE_KEY, xml, CACHE_TTL);
  return sendXml(res, xml, CDN_TTL);
}
