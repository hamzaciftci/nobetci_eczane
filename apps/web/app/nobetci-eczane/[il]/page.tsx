import Link from "next/link";
import type { Metadata } from "next";
import { DegradedBanner } from "../../../components/degraded-banner";
import { MapPanel } from "../../../components/map-panel";
import { NearestClient } from "../../../components/nearest-client";
import { PharmacyCard } from "../../../components/pharmacy-card";
import { PharmacyJsonLd } from "../../../components/pharmacy-jsonld";
import { fetchDutyByProvince } from "../../../lib/api";
import { toSlug } from "../../../lib/shared";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ il: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il } = await params;
  return {
    title: `${il} Nobetci Eczaneler`,
    description: `${il} icin aktif nobetci eczane listesi ve kaynak bilgisi`,
    alternates: {
      canonical: `/nobetci-eczane/${il}`
    }
  };
}

export default async function ProvincePage({ params }: Props) {
  const { il } = await params;
  const duty = await fetchDutyByProvince(il);
  const byDistrict = groupByDistrict(duty.data);

  return (
    <main className="grid city-page">
      <section className="panel city-hero">
        <p className="home-badge">Il geneli nobetci eczane listesi</p>
        <h2>{il.toLocaleUpperCase("tr-TR")} NOBETCI ECZANELER</h2>
        <p className="muted">
          Son guncelleme: {duty.son_guncelleme ? new Date(duty.son_guncelleme).toLocaleString("tr-TR") : "-"}
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

      <section className="panel mode-panel">
        <h3>Eczane Gosterim Modlari</h3>
        <p className="muted">Eczane camina asmak icin A4 cikti alin veya bu ilin canli panosunu tam ekranda acin.</p>
        <div className="mode-actions">
          <Link className="btn primary" href={`/nobetci-eczane/${il}/yazdir`}>
            A4 Cikti Sayfasi
          </Link>
          <Link className="btn" href={`/nobetci-eczane/${il}/ekran`} target="_blank" rel="noreferrer">
            Tam Ekran Pano
          </Link>
        </div>
      </section>

      <section className="panel district-panel">
        <h3>Ilce Kisayollari</h3>
        <div className="district-links">
          {Object.keys(byDistrict).map((districtName) => {
            const districtSlug = toSlug(districtName);
            return (
              <Link className="pill district-chip" key={districtName} href={`/nobetci-eczane/${il}/${districtSlug}`}>
                {districtName}
              </Link>
            );
          })}
        </div>
      </section>

      <MapPanel items={duty.data} title="Il Geneli Harita" />
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
          <p className="muted">
            Bu il icin API aktif nobet kaydi donmedi. Biraz sonra tekrar deneyin veya ilce secerek kontrol edin.
          </p>
        </section>
      )}
    </main>
  );
}

function groupByDistrict(items: Awaited<ReturnType<typeof fetchDutyByProvince>>["data"]) {
  return items.reduce<Record<string, typeof items>>((acc, item) => {
    acc[item.ilce] = acc[item.ilce] ?? [];
    acc[item.ilce].push(item);
    return acc;
  }, {});
}
