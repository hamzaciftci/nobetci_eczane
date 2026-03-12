"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight, MapPin, ShieldCheck, Printer,
  Monitor, MapPinned, Navigation, Info
} from "lucide-react";
import { PharmacyCard } from "@/app/components/PharmacyCard";
import { MapPanel } from "@/app/components/MapPanel";
import type { Pharmacy } from "@/app/lib/duty";

interface Props {
  pharmacies: Pharmacy[];
  ilSlug: string;
  ilName: string;
  ddmmyyyy: string;
}

function toSlug(str: string) {
  return str
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function CityPageClient({ pharmacies, ilSlug, ilName, ddmmyyyy }: Props) {
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [reportTarget, setReportTarget] = useState<Pharmacy | null>(null);

  // İlçe listesini eczanelerden çıkar
  const districts = useMemo(() => {
    const seen = new Map<string, string>();
    pharmacies.forEach((p) => {
      if (p.ilce) {
        const slug = toSlug(p.ilce);
        if (!seen.has(slug)) seen.set(slug, p.ilce);
      }
    });
    return Array.from(seen.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [pharmacies]);

  const filtered = useMemo(
    () => selectedDistrict
      ? pharmacies.filter((p) => toSlug(p.ilce) === selectedDistrict)
      : pharmacies,
    [pharmacies, selectedDistrict]
  );

  const selectedDistrictName = districts.find((d) => d.slug === selectedDistrict)?.name ?? "";

  const printHref = selectedDistrict
    ? `/il/${ilSlug}/${selectedDistrict}/yazdir`
    : `/il/${ilSlug}/yazdir`;
  const screenHref = selectedDistrict
    ? `/il/${ilSlug}/${selectedDistrict}/ekran`
    : `/il/${ilSlug}/ekran`;

  return (
    <>
      {/* Header card */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="p-6 md:p-8">
          <div className="mb-4 flex justify-center">
            <span className="rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              {selectedDistrict
                ? `${selectedDistrictName} nöbetçi eczaneler`
                : "İl geneli nöbetçi eczane listesi"}
            </span>
          </div>
          <h1 className="text-center text-2xl font-extrabold uppercase tracking-tight text-foreground md:text-3xl">
            {selectedDistrict ? `${selectedDistrictName}, ` : ""}{ilName} NÖBETÇİ ECZANELER
          </h1>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Tarih: {ddmmyyyy}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              Doğrulandı
            </span>
            <span className="inline-flex items-center rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {filtered.length} eczane
            </span>
          </div>
        </div>
      </div>

      {/* District filter */}
      {districts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-base font-bold text-foreground">İlçe Filtresi</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedDistrict(null)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                !selectedDistrict
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "border border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              Tümü
            </button>
            {districts.map((d) => (
              <button
                key={d.slug}
                onClick={() => setSelectedDistrict(selectedDistrict === d.slug ? null : d.slug)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  selectedDistrict === d.slug
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "border border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map toggle (mobile) */}
      <button
        onClick={() => setShowMap((v) => !v)}
        className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-primary focus-visible:outline-none lg:hidden"
      >
        <MapPinned className="h-3.5 w-3.5" />
        {showMap ? "Haritayı gizle" : "Haritayı göster"}
      </button>

      {/* Pharmacy list + map */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-16 text-center shadow-card">
          <MapPin className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            {selectedDistrict ? "Bu ilçe için nöbetçi eczane bulunamadı" : "Nöbetçi eczane bilgisi bulunamadı"}
          </h3>
          {selectedDistrict && (
            <button onClick={() => setSelectedDistrict(null)} className="text-sm font-medium text-primary hover:underline">
              Tümünü göster
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            {filtered.map((p, i) => (
              <PharmacyCard
                key={`${p.eczane_adi}-${i}`}
                pharmacy={p}
                onReport={setReportTarget}
                index={i}
              />
            ))}
          </div>
          <div className={`lg:col-span-2 ${showMap ? "block" : "hidden lg:block"}`}>
            <div className="sticky top-20">
              <MapPanel pharmacies={filtered} />
            </div>
          </div>
        </div>
      )}

      {/* Display options */}
      <div className="mt-8 mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-2 text-base font-bold text-foreground">Gösterim Seçenekleri</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Eczane camına asmak için A4 çıktı alın veya canlı panosunu tam ekranda açın.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={printHref}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <Printer className="h-4 w-4" /> A4 Çıktı
          </Link>
          <Link href={screenHref}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Monitor className="h-4 w-4" /> Tam Ekran
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

      {/* Simple report modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReportTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-premium"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-bold text-foreground">Yanlış Bilgi Bildir</h3>
            <p className="mb-4 text-sm text-muted-foreground">{reportTarget.eczane_adi}</p>
            <Link href="/iletisim"
              className="block rounded-xl bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              İletişim Formuna Git
            </Link>
            <button onClick={() => setReportTarget(null)}
              className="mt-3 w-full rounded-xl border border-border bg-surface py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  );
}
