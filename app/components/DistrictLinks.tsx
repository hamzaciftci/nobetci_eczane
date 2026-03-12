/**
 * İlçe navigasyon linkleri.
 * İl sayfasında kullanılır — her ilçeye link verir.
 * İç linkleme için SEO değeri yüksek bir component.
 */

import Link from "next/link";

interface District {
  slug: string;
  name: string;
}

interface Props {
  ilSlug: string;
  districts: District[];
}

export function DistrictLinks({ ilSlug, districts }: Props) {
  if (districts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {districts.map((d) => (
        <Link
          key={d.slug}
          href={`/nobetci-eczane/${ilSlug}/${d.slug}`}
          className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
        >
          {d.name}
        </Link>
      ))}
    </div>
  );
}
