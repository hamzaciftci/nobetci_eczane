/**
 * İlçe sayfası — SSR + ISR (revalidate: 3600).
 *
 * URL: /nobetci-eczane/osmaniye/duzici
 * Title: "12.03.2026 Düziçi Osmaniye Nöbetçi Eczaneler – Bugün Açık Eczane Listesi"
 *
 * Hedef sorgular:
 *   - "düziçi nöbetçi eczane"
 *   - "osmaniye düziçi nöbetçi eczane"
 *   - "düziçi eczane nöbet"
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, ArrowLeft, Printer } from "lucide-react";
import { BreadcrumbNav } from "@/app/components/BreadcrumbNav";
import { PharmacyList } from "@/app/components/PharmacyList";
import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { getDistrictDuty } from "@/app/lib/duty";
import { districtMeta } from "@/app/lib/meta";
import { getProvinceName, provinces } from "@/app/lib/provinces";
import { getToday } from "@/app/lib/date";
import { breadcrumbSchema } from "@/app/lib/schema";

// ISR: saatte bir yenile
export const revalidate = 3600;

// İlçe sayfaları build'de pre-generate edilmez — ilk istek anında render,
// sonrası ISR cache'den servislenir. Bu ~1000+ ilçe için idealdir.
// İstersen il bazında tüm ilçeleri pre-generate etmek için buraya
// generateStaticParams eklenebilir.

export async function generateMetadata({
  params,
}: {
  params: { il: string; ilce: string };
}): Promise<Metadata> {
  const { il, ilce } = params;
  const pharmacies = await getDistrictDuty(il, ilce);

  // API'dan gelen gerçek ilçe adını kullan (doğru Türkçe karakterler için)
  const ilceName =
    pharmacies[0]?.ilce ?? ilce.charAt(0).toUpperCase() + ilce.slice(1);

  return districtMeta(il, ilce, ilceName);
}

export default async function DistrictPage({
  params,
}: {
  params: { il: string; ilce: string };
}) {
  const { il, ilce } = params;

  // Bilinmeyen il → 404
  if (!provinces.find((p) => p.slug === il)) notFound();

  const pharmacies = await getDistrictDuty(il, ilce);

  const ilName = getProvinceName(il);

  // İlçe adı: varsa API verisinden, yoksa slug'dan türet
  const ilceName =
    pharmacies[0]?.ilce ??
    ilce
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const { ddmmyyyy, long } = getToday();

  const breadcrumbs = [
    { name: "Türkiye", href: "/" },
    { name: `${ilName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}` },
    {
      name: `${ilceName} Nöbetçi Eczane`,
      href: `/nobetci-eczane/${il}/${ilce}`,
    },
  ];

  return (
    <>
      <SchemaMarkup schemas={[breadcrumbSchema(breadcrumbs)]} />

      {/* ── Breadcrumb ──────────────────────────────────────────────── */}
      <BreadcrumbNav items={breadcrumbs} />

      {/* ── Sayfa başlığı ────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
          {ilceName} {ilName} Nöbetçi Eczaneler – {ddmmyyyy}
        </h1>
        <p className="mt-2 text-gray-500">
          {long} tarihinde {ilName} ili {ilceName} ilçesinde nöbetçi eczaneler
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {/* Geri: il sayfası */}
          <Link
            href={`/nobetci-eczane/${il}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Tüm {ilName} Eczaneleri
          </Link>
          <Link
            href={`/il/${il}/${ilce}/yazdir`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer className="h-4 w-4" /> Yazdır
          </Link>
        </div>
      </div>

      {/* ── H2: Bugün Nöbetçi Eczaneler ─────────────────────────────── */}
      <section aria-labelledby="ilce-nobetci" className="mb-10">
        <h2
          id="ilce-nobetci"
          className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"
        >
          <MapPin className="h-5 w-5 text-blue-600" />
          {ilceName} Bugün Nöbetçi Eczaneler
        </h2>
        <PharmacyList pharmacies={pharmacies} />
      </section>

      {/* ── H2: Telefon ve Adres Bilgileri (SEO) ─────────────────────── */}
      {pharmacies.length > 0 && (
        <section aria-labelledby="adres-bilgileri" className="mb-10">
          <h2
            id="adres-bilgileri"
            className="text-xl font-bold text-gray-800 mb-4"
          >
            {ilceName} Nöbetçi Eczane Telefon ve Adres Bilgileri
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Eczane Adı
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Adres
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">
                    Telefon
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {pharmacies.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {p.eczane_adi}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.adres}</td>
                    <td className="px-4 py-3">
                      {p.telefon ? (
                        <a
                          href={`tel:${p.telefon.replace(/\s/g, "")}`}
                          className="text-green-700 font-medium hover:underline"
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

      {/* ── SEO metin bloğu ──────────────────────────────────────────── */}
      <section className="rounded-xl bg-white border border-gray-200 p-6 prose prose-sm max-w-none text-gray-600">
        <h2 className="text-base font-bold text-gray-800 mt-0">
          {ilceName} Nöbetçi Eczane Hakkında
        </h2>
        <p>
          {ilName} ili {ilceName} ilçesinde bugün ({long}) nöbet tutan
          eczanelerin listesi eczacı odası resmi kaynaklarından alınmaktadır.{" "}
          {pharmacies.length > 0
            ? `${ilceName} ilçesinde bugün ${pharmacies.length} eczane nöbet tutmaktadır.`
            : `${ilceName} ilçesi için güncel nöbet listesi hazırlanmaktadır.`}
        </p>
        <p>
          Nöbetçi eczane gece ve hafta sonları da hizmet vermektedir. Acil ilaç
          ihtiyacı için yukarıdaki listeden en yakın nöbetçi eczaneyi bulup
          telefon ile iletişime geçebilirsiniz.
        </p>
      </section>
    </>
  );
}
