import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, MapPin, Navigation, Printer, Info } from "lucide-react";

import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { PharmacyCard } from "@/app/components/PharmacyCard";
import { MapPanel } from "@/app/components/MapPanel";
import { getDistrictDuty } from "@/app/lib/duty";
import { districtMeta } from "@/app/lib/meta";
import { getProvinceName, provinces } from "@/app/lib/provinces";
import { getToday } from "@/app/lib/date";
import { breadcrumbSchema } from "@/app/lib/schema";

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
  const { ddmmyyyy } = getToday();
  const pharmacies = await getDistrictDuty(il, ilce);

  const ilceName =
    pharmacies[0]?.ilce ??
    ilce.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const breadcrumbs = [
    { name: "Türkiye", href: "/" },
    { name: `${ilName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}` },
    { name: `${ilceName} Nöbetçi Eczane`, href: `/nobetci-eczane/${il}/${ilce}` },
  ];

  return (
    <div className="container py-8 md:py-12">
      <SchemaMarkup schemas={[breadcrumbSchema(breadcrumbs)]} />

      {/* Breadcrumb */}
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-primary">Türkiye</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href={`/nobetci-eczane/${il}`} className="transition-colors hover:text-primary">{ilName}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{ilceName}</span>
      </nav>

      {/* Header card */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="p-6 md:p-8">
          <div className="mb-4 flex justify-center">
            <span className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              {ilceName} nöbetçi eczaneler
            </span>
          </div>
          <h1 className="text-center text-2xl font-extrabold uppercase tracking-tight text-foreground md:text-3xl">
            {ilceName}, {ilName} NÖBETÇİ ECZANELER
          </h1>
          <p className="mt-3 text-center text-sm text-muted-foreground">Tarih: {ddmmyyyy}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {pharmacies.length} eczane
            </span>
          </div>
        </div>
      </div>

      {/* Pharmacy list + map */}
      {pharmacies.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-16 text-center shadow-card">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Nöbetçi eczane bilgisi bulunamadı</h3>
          <Link href={`/nobetci-eczane/${il}`} className="text-sm font-medium text-primary hover:underline">
            {ilName} genelini görüntüle
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            {pharmacies.map((p, i) => (
              <PharmacyCard key={`${p.eczane_adi}-${i}`} pharmacy={p} index={i} />
            ))}
          </div>
          <div className="hidden lg:block lg:col-span-2">
            <div className="sticky top-20">
              <MapPanel pharmacies={pharmacies} />
            </div>
          </div>
        </div>
      )}

      {/* Display options */}
      <div className="mt-8 mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-2 text-base font-bold text-foreground">Gösterim Seçenekleri</h2>
        <div className="flex flex-wrap gap-3">
          <Link href={`/il/${il}/${ilce}/yazdir`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Printer className="h-4 w-4" /> A4 Çıktı
          </Link>
        </div>
      </div>

      {/* Nearest CTA */}
      <div className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-2 text-base font-bold text-foreground">En Yakın Nöbetçi Eczane</h2>
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            <strong>KVKK:</strong> Konumunuz sunucuya gönderilmez. Mesafe hesabı tarayıcıda yapılır.
          </p>
        </div>
        <Link href="/en-yakin"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          <Navigation className="h-4 w-4" /> Konuma Göre Bul
        </Link>
      </div>
    </div>
  );
}
