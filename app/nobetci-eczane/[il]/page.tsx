/**
 * İl (şehir) sayfası — ISR, her 3600 saniyede yenilenir.
 *
 * URL: /nobetci-eczane/osmaniye
 * Title: "12.03.2026 Osmaniye Nöbetçi Eczaneler – Bugün Açık Eczaneler"
 *
 * Hedef sorgular:
 *   - "osmaniye nöbetçi eczane"
 *   - "bugün osmaniye nöbetçi eczane"
 *   - "osmaniye eczane nöbet"
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Printer, Monitor } from "lucide-react";
import { BreadcrumbNav } from "@/app/components/BreadcrumbNav";
import { PharmacyList } from "@/app/components/PharmacyList";
import { DistrictLinks } from "@/app/components/DistrictLinks";
import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { getCityDuty, getDistrictSlugs } from "@/app/lib/duty";
import { cityMeta } from "@/app/lib/meta";
import { getProvinceName, provinces } from "@/app/lib/provinces";
import { getToday } from "@/app/lib/date";
import { breadcrumbSchema } from "@/app/lib/schema";

// ISR: saatte bir yenile
export const revalidate = 3600;

// Build time'da 81 ilin tamamını statik olarak oluştur
export function generateStaticParams() {
  return provinces.map((p) => ({ il: p.slug }));
}

// Dinamik metadata — slug + bugünün tarihi ile üretilir
export function generateMetadata({
  params,
}: {
  params: { il: string };
}): Metadata {
  return cityMeta(params.il);
}

export default async function CityPage({
  params,
}: {
  params: { il: string };
}) {
  const { il } = params;
  const ilName = getProvinceName(il);

  // Bilinmeyen il slug'ı → 404
  if (!provinces.find((p) => p.slug === il)) notFound();

  // Paralel veri çekimi
  const [pharmacies, districtRows] = await Promise.all([
    getCityDuty(il),
    getDistrictSlugs(il),
  ]);

  const { ddmmyyyy, long } = getToday();

  const breadcrumbs = [
    { name: "Türkiye", href: "/" },
    { name: `${ilName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}` },
  ];

  const districts = districtRows.map((d) => ({
    slug: d.ilce_slug,
    name: d.ilce,
  }));

  return (
    <>
      {/* Breadcrumb schema ayrıca ekleniyor (BreadcrumbNav zaten ekliyor ama
          page-level'da da dursun) */}
      <SchemaMarkup schemas={[breadcrumbSchema(breadcrumbs)]} />

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <BreadcrumbNav items={breadcrumbs} />

      {/* ── Sayfa başlığı ────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
          {ilName} Nöbetçi Eczaneler – {ddmmyyyy}
        </h1>
        <p className="mt-2 text-gray-500">
          {long} tarihinde {ilName} ilinde nöbetçi olan eczaneler
        </p>

        {/* Yardımcı linkler */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/il/${il}/yazdir`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" /> Yazdır (A4)
          </Link>
          <Link
            href={`/il/${il}/ekran`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Monitor className="h-4 w-4" /> Tam Ekran
          </Link>
        </div>
      </div>

      {/* ── H2: Bugün Nöbetçi Eczaneler ─────────────────────────────── */}
      <section aria-labelledby="bugun-nobetci" className="mb-10">
        <h2
          id="bugun-nobetci"
          className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <MapPin className="h-5 w-5 text-blue-600" />
          Bugün Nöbetçi Eczaneler
        </h2>
        <PharmacyList pharmacies={pharmacies} />
      </section>

      {/* ── H2: İlçe Bazında Nöbetçi Eczaneler ─────────────────────── */}
      {districts.length > 0 && (
        <section aria-labelledby="ilce-nobetci" className="mb-10">
          <h2
            id="ilce-nobetci"
            className="text-xl font-bold text-gray-800 mb-4"
          >
            {ilName} İlçe Bazında Nöbetçi Eczaneler
          </h2>
          <p className="text-sm text-gray-500 mb-3">
            Belirli bir ilçedeki nöbetçi eczaneleri görmek için ilçeyi seçin:
          </p>
          <DistrictLinks ilSlug={il} districts={districts} />
        </section>
      )}

      {/* ── SEO metin bloğu ──────────────────────────────────────────── */}
      <section className="rounded-xl bg-white border border-gray-200 p-6 prose prose-sm max-w-none text-gray-600">
        <h2 className="text-base font-bold text-gray-800 mt-0">
          {ddmmyyyy} {ilName} Nöbetçi Eczane Hakkında
        </h2>
        <p>
          {ilName} ilinde bugün ({long}) nöbet tutan eczanelerin listesi{" "}
          {ilName} Eczacılar Odası&apos;nın resmi kaynaklarından alınmaktadır.
          Listede yer alan eczanelerin adres, telefon ve harita bilgilerine
          tıklayarak ulaşabilirsiniz.
        </p>
        <p>
          Nöbetçi eczaneler gece ve hafta sonu da açık olup acil ilaç
          ihtiyacınızda hizmet vermektedir. {ilName}&apos;de{" "}
          {pharmacies.length > 0
            ? `bugün ${pharmacies.length} eczane nöbet tutmaktadır.`
            : "güncel nöbet listesi hazırlanmaktadır."}
        </p>
      </section>
    </>
  );
}
