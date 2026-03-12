/**
 * İç Linkleme Ağı — SEO Authority Distribution
 *
 * 2 kullanım:
 *  1. İl sayfasında: aynı bölgedeki diğer iller (Yakın İller)
 *  2. İlçe sayfasında: aynı ilin diğer ilçeleri (Diğer İlçeler)
 *
 * Google, iç linkleri authority dağıtımı için kullanır.
 * Her link bir keyword içerir: "{Ad} Nöbetçi Eczane"
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface ProvinceLink {
  type: "province";
  slug: string;
  name: string;
}

interface DistrictLink {
  type: "district";
  ilSlug: string;
  ilceSlug: string;
  name: string;
}

type NearbyItem = ProvinceLink | DistrictLink;

interface Props {
  heading: string;
  items: NearbyItem[];
  variant?: "compact" | "grid";
}

export function NearbyLinks({ heading, items, variant = "grid" }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="nearby-heading" className="mb-10">
      <h2
        id="nearby-heading"
        className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"
      >
        <ArrowRight className="h-5 w-5 text-blue-600" />
        {heading}
      </h2>

      {variant === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {items.map((item) => {
            const href =
              item.type === "province"
                ? `/nobetci-eczane/${item.slug}`
                : `/nobetci-eczane/${item.ilSlug}/${item.ilceSlug}`;

            const label =
              item.type === "province"
                ? `${item.name} Nöbetçi Eczane`
                : `${item.name} Nöbetçi Eczane`;

            return (
              <Link
                key={href}
                href={href}
                className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <span className="font-medium">{label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 shrink-0" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const href =
              item.type === "province"
                ? `/nobetci-eczane/${item.slug}`
                : `/nobetci-eczane/${item.ilSlug}/${item.ilceSlug}`;

            const label =
              item.type === "province"
                ? `${item.name} Nöbetçi Eczane`
                : `${item.name}`;

            return (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
