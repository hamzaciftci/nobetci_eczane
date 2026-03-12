/**
 * Next.js dinamik sitemap — tüm il ve ilçe sayfalarını kapsar.
 * /sitemap.xml adresinde otomatik serve edilir.
 *
 * Yapı:
 *   - Ana sayfa
 *   - 81 il sayfası  (/nobetci-eczane/:il)
 *   - Tüm ilçe sayfaları (/nobetci-eczane/:il/:ilce)
 */

import type { MetadataRoute } from "next";
import { provinces } from "./lib/provinces";
import { getAllActiveProvinceSlugs, getDistrictSlugs } from "./lib/duty";
import { getToday } from "./lib/date";

const BASE_URL = "https://www.bugunnobetcieczaneler.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { iso } = getToday();

  // Aktif il slug'larını DB'den çek (veri olmayan iller hariç)
  let activeProvinceSlugs: string[];
  try {
    activeProvinceSlugs = await getAllActiveProvinceSlugs();
  } catch {
    // DB hatasında statik listeyi kullan
    activeProvinceSlugs = provinces.map((p) => p.slug);
  }

  // İlçe URL'lerini paralel çek
  const districtEntries = await Promise.all(
    activeProvinceSlugs.map(async (ilSlug) => {
      try {
        const districts = await getDistrictSlugs(ilSlug);
        return districts.map((d) => ({
          url: `${BASE_URL}/nobetci-eczane/${ilSlug}/${d.ilce_slug}`,
          lastModified: iso,
          changeFrequency: "daily" as const,
          priority: 0.7,
        }));
      } catch {
        return [];
      }
    })
  );

  return [
    // Ana sayfa
    {
      url: BASE_URL,
      lastModified: iso,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    // İl sayfaları
    ...activeProvinceSlugs.map((ilSlug) => ({
      url: `${BASE_URL}/nobetci-eczane/${ilSlug}`,
      lastModified: iso,
      changeFrequency: "hourly" as const,
      priority: 0.9,
    })),
    // İlçe sayfaları
    ...districtEntries.flat(),
  ];
}
