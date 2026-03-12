/**
 * İl (şehir) sayfası — ISR, her 3600 saniyede yenilenir.
 *
 * URL    : /nobetci-eczane/osmaniye
 * Hedef  : "osmaniye nöbetçi eczane", "bugün osmaniye nöbetçi eczane"
 *
 * H2 Bölümleri (Google'ın beklediği yapı):
 *  1. Bugün Nöbetçi Eczaneler        ← eczane listesi
 *  2. Harita Üzerinde Nöbetçi Eczaneler ← maps CTA
 *  3. İlçelere Göre Nöbetçi Eczaneler   ← district links
 *  4. Sık Sorulan Sorular               ← FAQ + FAQPage schema
 *  5. Yakın İllerde Nöbetçi Eczane      ← iç link ağı
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Map, Printer, Monitor, Navigation } from "lucide-react";

import { BreadcrumbNav }  from "@/app/components/BreadcrumbNav";
import { PharmacyList }   from "@/app/components/PharmacyList";
import { DistrictLinks }  from "@/app/components/DistrictLinks";
import { FaqSection }     from "@/app/components/FaqSection";
import { SeoContent }     from "@/app/components/SeoContent";
import { NearbyLinks }    from "@/app/components/NearbyLinks";
import { SchemaMarkup }   from "@/app/components/SchemaMarkup";

import { getCityDuty, getDistrictSlugs } from "@/app/lib/duty";
import { cityMeta }                       from "@/app/lib/meta";
import { getProvinceName, provinces }     from "@/app/lib/provinces";
import { getToday }                       from "@/app/lib/date";
import { breadcrumbSchema }               from "@/app/lib/schema";
import { getSameRegionProvinces }         from "@/app/lib/regions";
import { citySeoBlocks, cityFaqs }        from "@/app/lib/content";

// ISR: saatte bir yenile
export const revalidate = 3600;

// Build time'da 81 ilin tamamını statik olarak oluştur
export function generateStaticParams() {
  return provinces.map((p) => ({ il: p.slug }));
}

export function generateMetadata({ params }: { params: { il: string } }): Metadata {
  return cityMeta(params.il);
}

export default async function CityPage({ params }: { params: { il: string } }) {
  const { il } = params;

  // Bilinmeyen slug → 404
  if (!provinces.find((p) => p.slug === il)) notFound();

  const ilName = getProvinceName(il);
  const { ddmmyyyy, long } = getToday();

  // Paralel veri çekimi
  const [pharmacies, districtRows] = await Promise.all([
    getCityDuty(il),
    getDistrictSlugs(il),
  ]);

  const districts = districtRows.map((d) => ({ slug: d.ilce_slug, name: d.ilce }));

  // Breadcrumb
  const breadcrumbs = [
    { name: "Türkiye", href: "/" },
    { name: `${ilName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}` },
  ];

  // İç linkleme: aynı bölgedeki iller
  const nearbyProvinceSlugs = getSameRegionProvinces(il, 8);
  const nearbyProvinceItems = nearbyProvinceSlugs.map((slug) => ({
    type: "province" as const,
    slug,
    name: getProvinceName(slug),
  }));

  // Auto-generated content
  const seoBlocks = citySeoBlocks(ilName, ddmmyyyy, long, pharmacies.length);
  const faqs      = cityFaqs(ilName, long, pharmacies.length);

  return (
    <>
      <SchemaMarkup schemas={[breadcrumbSchema(breadcrumbs)]} />

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <BreadcrumbNav items={breadcrumbs} />

      {/* ── H1 + başlık bölümü ──────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
          {ilName} Nöbetçi Eczaneler – {ddmmyyyy}
        </h1>
        <p className="mt-2 text-gray-500 text-base">
          {long} tarihinde {ilName} ilinde nöbetçi olan eczaneler
        </p>

        {/* Hızlı eylem butonları */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/en-yakin"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Navigation className="h-4 w-4" />
            En Yakın Eczane
          </Link>
          <Link
            href={`/il/${il}/yazdir`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" /> Yazdır (A4)
          </Link>
          <Link
            href={`/il/${il}/ekran`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Monitor className="h-4 w-4" /> Tam Ekran
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
          Bugün Nöbetçi Eczaneler
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          {ddmmyyyy} · {ilName} · {pharmacies.length > 0 ? `${pharmacies.length} eczane` : "Yükleniyor…"}
        </p>
        <PharmacyList pharmacies={pharmacies} />
      </section>

      {/* ── H2 #2: Harita Üzerinde Nöbetçi Eczaneler ────────────────── */}
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
              {ilName} nöbetçi eczanelerini haritada görmek ister misiniz?
            </p>
            <p className="text-sm text-blue-700">
              Konumunuza en yakın nöbetçi eczaneleri harita üzerinde görmek için
              konum hizmetinizi etkinleştirin.
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
              href={`https://www.google.com/maps/search/nöbetçi+eczane+${encodeURIComponent(ilName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Google Maps
            </a>
          </div>
        </div>
      </section>

      {/* ── H2 #3: İlçelere Göre Nöbetçi Eczaneler ─────────────────── */}
      {districts.length > 0 && (
        <section aria-labelledby="h2-districts" className="mb-10">
          <h2
            id="h2-districts"
            className="text-xl font-bold text-gray-800 mb-2"
          >
            {ilName} İlçelere Göre Nöbetçi Eczaneler
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Belirli bir ilçedeki nöbetçi eczaneleri görmek için ilçeyi seçin:
          </p>
          <DistrictLinks ilSlug={il} districts={districts} />
        </section>
      )}

      {/* ── Auto-generated SEO içerik ────────────────────────────────── */}
      <SeoContent
        heading={`${ddmmyyyy} ${ilName} Nöbetçi Eczane Hakkında`}
        blocks={seoBlocks}
      />

      {/* ── H2 #4: Sık Sorulan Sorular ──────────────────────────────── */}
      <FaqSection faqs={faqs} />

      {/* ── H2 #5: Yakın İllerde Nöbetçi Eczane ─────────────────────── */}
      {nearbyProvinceItems.length > 0 && (
        <NearbyLinks
          heading="Yakın İllerde Nöbetçi Eczane"
          items={nearbyProvinceItems}
          variant="grid"
        />
      )}
    </>
  );
}
