/**
 * İlçe sayfası — SSR + ISR (revalidate: 3600).
 *
 * URL    : /nobetci-eczane/osmaniye/duzici
 * Hedef  : "düziçi nöbetçi eczane", "osmaniye düziçi nöbetçi eczane"
 *
 * H2 Bölümleri:
 *  1. Bugün Nöbetçi Eczaneler
 *  2. Eczane Telefon ve Adres Bilgileri   ← SEO tablosu
 *  3. Harita Üzerinde Nöbetçi Eczaneler  ← maps CTA
 *  4. Diğer İlçelerde Nöbetçi Eczane     ← iç link ağı
 *  5. Sık Sorulan Sorular                 ← FAQ + FAQPage schema
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Map, ArrowLeft, Navigation, Printer } from "lucide-react";

import { BreadcrumbNav }  from "@/app/components/BreadcrumbNav";
import { PharmacyList }   from "@/app/components/PharmacyList";
import { FaqSection }     from "@/app/components/FaqSection";
import { SeoContent }     from "@/app/components/SeoContent";
import { NearbyLinks }    from "@/app/components/NearbyLinks";
import { SchemaMarkup }   from "@/app/components/SchemaMarkup";

import { getDistrictDuty, getDistrictSlugs } from "@/app/lib/duty";
import { districtMeta }                       from "@/app/lib/meta";
import { getProvinceName, provinces }         from "@/app/lib/provinces";
import { getToday }                           from "@/app/lib/date";
import { breadcrumbSchema }                   from "@/app/lib/schema";
import { districtSeoBlocks, districtFaqs }    from "@/app/lib/content";

// ISR: saatte bir yenile
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ il: string; ilce: string }>;
}): Promise<Metadata> {
  const { il, ilce } = await params;
  const pharmacies = await getDistrictDuty(il, ilce);
  const ilceName =
    pharmacies[0]?.ilce ?? ilce.charAt(0).toUpperCase() + ilce.slice(1);
  return districtMeta(il, ilce, ilceName);
}

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ il: string; ilce: string }>;
}) {
  const { il, ilce } = await params;

  if (!provinces.find((p) => p.slug === il)) notFound();

  const ilName = getProvinceName(il);
  const { ddmmyyyy, long } = getToday();

  // Paralel veri çekimi: ilçe eczaneleri + kardeş ilçeler
  const [pharmacies, siblingRows] = await Promise.all([
    getDistrictDuty(il, ilce),
    getDistrictSlugs(il),
  ]);

  // İlçe adı: API'dan gelen tam ad (Türkçe karakterlerle)
  const ilceName =
    pharmacies[0]?.ilce ??
    ilce.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  // Kardeş ilçe linkleri (kendisi hariç, max 12)
  const siblingItems = siblingRows
    .filter((d) => d.ilce_slug !== ilce)
    .slice(0, 12)
    .map((d) => ({
      type: "district" as const,
      ilSlug: il,
      ilceSlug: d.ilce_slug,
      name: d.ilce,
    }));

  // Breadcrumb
  const breadcrumbs = [
    { name: "Türkiye", href: "/" },
    { name: `${ilName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}` },
    { name: `${ilceName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}/${ilce}` },
  ];

  // Auto-generated content
  const seoBlocks = districtSeoBlocks(ilceName, ilName, ddmmyyyy, long, pharmacies.length);
  const faqs      = districtFaqs(ilceName, ilName, long, pharmacies.length);

  return (
    <>
      <SchemaMarkup schemas={[breadcrumbSchema(breadcrumbs)]} />

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <BreadcrumbNav items={breadcrumbs} />

      {/* ── H1 + başlık ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
          {ilceName} {ilName} Nöbetçi Eczaneler – {ddmmyyyy}
        </h1>
        <p className="mt-2 text-gray-500 text-base">
          {long} tarihinde {ilName} ili {ilceName} ilçesinde nöbetçi eczaneler
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/nobetci-eczane/${il}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Tüm {ilName} Eczaneleri
          </Link>
          <Link
            href="/en-yakin"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Navigation className="h-4 w-4" />
            En Yakın Eczane
          </Link>
          <Link
            href={`/il/${il}/${ilce}/yazdir`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" /> Yazdır
          </Link>
        </div>
      </div>

      {/* ── H2 #1: Bugün Nöbetçi Eczaneler ──────────────────────────── */}
      <section aria-labelledby="h2-list" className="mb-10">
        <h2
          id="h2-list"
          className="text-xl font-bold text-gray-800 mb-1 flex items-center gap-2"
        >
          <MapPin className="h-5 w-5 text-blue-600" />
          {ilceName} Bugün Nöbetçi Eczaneler
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          {ddmmyyyy} · {ilceName} / {ilName}
          {pharmacies.length > 0 ? ` · ${pharmacies.length} eczane` : ""}
        </p>
        <PharmacyList pharmacies={pharmacies} />
      </section>

      {/* ── H2 #2: Telefon ve Adres Tablosu ─────────────────────────── */}
      {pharmacies.length > 0 && (
        <section aria-labelledby="h2-table" className="mb-10">
          <h2
            id="h2-table"
            className="text-xl font-bold text-gray-800 mb-4"
          >
            {ilceName} Nöbetçi Eczane Telefon ve Adres Bilgileri
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Eczane Adı</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Adres</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold text-gray-600">Telefon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pharmacies.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                      {p.eczane_adi}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">{p.adres}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.telefon ? (
                        <a
                          href={`tel:${p.telefon.replace(/\s/g, "")}`}
                          className="font-medium text-green-700 hover:underline"
                        >
                          {p.telefon}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── H2 #3: Harita Üzerinde Nöbetçi Eczaneler ────────────────── */}
      <section aria-labelledby="h2-map" className="mb-10">
        <h2
          id="h2-map"
          className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <Map className="h-5 w-5 text-blue-600" />
          Harita Üzerinde Nöbetçi Eczaneler
        </h2>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="font-medium text-blue-900 mb-1">
              {ilceName} nöbetçi eczanelerini haritada görmek ister misiniz?
            </p>
            <p className="text-sm text-blue-700">
              Konum hizmetinizi etkinleştirerek en yakın nöbetçi eczaneleri haritada görebilirsiniz.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/en-yakin"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Navigation className="h-4 w-4" />
              Haritada Bul
            </Link>
            <a
              href={`https://www.google.com/maps/search/nöbetçi+eczane+${encodeURIComponent(ilceName + " " + ilName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Google Maps
            </a>
          </div>
        </div>
      </section>

      {/* ── Auto-generated SEO içerik ────────────────────────────────── */}
      <SeoContent
        heading={`${ilceName} Nöbetçi Eczane Hakkında`}
        blocks={seoBlocks}
      />

      {/* ── H2 #4: Diğer İlçelerde Nöbetçi Eczane ───────────────────── */}
      {siblingItems.length > 0 && (
        <NearbyLinks
          heading={`${ilName} Diğer İlçelerde Nöbetçi Eczane`}
          items={siblingItems}
          variant="compact"
        />
      )}

      {/* ── H2 #5: Sık Sorulan Sorular ──────────────────────────────── */}
      <FaqSection faqs={faqs} />
    </>
  );
}
