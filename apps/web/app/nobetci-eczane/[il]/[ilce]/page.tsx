import Link from "next/link";
import type { Metadata } from "next";
import { DegradedBanner } from "../../../../components/degraded-banner";
import { DutyDateTabs } from "../../../../components/duty-date-tabs";
import { MapPanel } from "../../../../components/map-panel";
import { NearestClient } from "../../../../components/nearest-client";
import { PharmacyCard } from "../../../../components/pharmacy-card";
import { PharmacyJsonLd } from "../../../../components/pharmacy-jsonld";
import { fetchDutyByDistrictDate } from "../../../../lib/api";
import { buildDailyDutyTitle } from "../../../../lib/date";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ il: string; ilce: string }>;
  searchParams: Promise<{ date?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il, ilce } = await params;
  return {
    title: buildDailyDutyTitle(`${ilce.toLocaleUpperCase("tr-TR")} / ${il.toLocaleUpperCase("tr-TR")}`),
    description: `${ilce}, ${il} icin aktif nobetci eczane listesi`,
    alternates: {
      canonical: `/nobetci-eczane/${il}/${ilce}`
    }
  };
}

export default async function DistrictPage({ params, searchParams }: Props) {
  const { il, ilce } = await params;
  const { date } = await searchParams;
  const duty = await fetchDutyByDistrictDate(il, ilce, date);

  return (
    <main className="grid city-page">
      <section className="panel city-hero">
        <p className="home-badge">Ilce odakli nobetci eczane listesi</p>
        <h2>
          {ilce.toLocaleUpperCase("tr-TR")} / {il.toLocaleUpperCase("tr-TR")}
        </h2>
        <p className="muted">
          Tarih: {formatDateLabel(duty.duty_date)} | Son guncelleme:{" "}
          {duty.son_guncelleme ? new Date(duty.son_guncelleme).toLocaleString("tr-TR") : "-"}
        </p>
        <div className="city-meta-chips">
          <span className="pill">Durum: {duty.status === "degraded" ? "Degraded" : "Dogrulandi"}</span>
          <span className="pill">Kayit: {duty.data.length}</span>
        </div>
      </section>

      {duty.status === "degraded" ? (
        <DegradedBanner
          updatedAt={duty.son_guncelleme}
          staleMinutes={duty.degraded_info?.stale_minutes}
          recentAlert={duty.degraded_info?.recent_alert}
          hint={duty.degraded_info?.hint}
        />
      ) : null}

      <PharmacyJsonLd items={duty.data} />
      <DutyDateTabs
        basePath={`/nobetci-eczane/${il}/${ilce}`}
        selectedDate={duty.duty_date}
        availableDates={duty.available_dates}
      />

      <section className="panel mode-panel">
        <h3>Eczane Gosterim Modlari</h3>
        <p className="muted">Bu ilce icin A4 cikti alin veya tam ekran canli pano modunu acin.</p>
        <div className="mode-actions">
          <Link className="btn primary" href={`/nobetci-eczane/${il}/${ilce}/yazdir`}>
            A4 Cikti Sayfasi
          </Link>
          <Link className="btn" href={`/nobetci-eczane/${il}/${ilce}/ekran`} target="_blank" rel="noreferrer">
            Tam Ekran Pano
          </Link>
        </div>
      </section>

      <MapPanel items={duty.data} title="Ilce Harita Gorunumu" />
      <NearestClient items={duty.data} />

      {duty.data.length ? (
        <section className="pharmacy-grid">
          {duty.data.map((item, idx) => (
            <PharmacyCard key={`${item.eczane_adi}-${idx}`} item={item} />
          ))}
        </section>
      ) : (
        <section className="panel">
          <h3>Aktif Kayit Bulunamadi</h3>
          <p className="muted">Bu ilce icin API aktif nobet kaydi donmedi. Biraz sonra tekrar deneyin.</p>
        </section>
      )}
    </main>
  );
}

function formatDateLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  return `${day}.${month}.${year}`;
}
