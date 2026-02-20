import Link from "next/link";
import type { Metadata } from "next";
import { toSlug } from "../../../lib/shared";
import { fetchDutyByProvince } from "../../../lib/api";
import { DegradedBanner } from "../../../components/degraded-banner";
import { PharmacyCard } from "../../../components/pharmacy-card";
import { PharmacyJsonLd } from "../../../components/pharmacy-jsonld";
import { MapPanel } from "../../../components/map-panel";
import { NearestClient } from "../../../components/nearest-client";

export const revalidate = 120;

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
    <main className="grid">
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>{il} Nobetci Eczaneler</h2>
        <p className="muted">Son guncelleme: {duty.son_guncelleme ? new Date(duty.son_guncelleme).toLocaleString("tr-TR") : "-"}</p>
        <p className="muted">Durum: {duty.status === "degraded" ? "Degraded" : "Dogrulandi"}</p>
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

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Eczane Gosterim Modlari</h3>
        <p className="muted">Eczane camina asmak icin A4 cikti alin veya bu ilin canli panosunu tam ekranda acin.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn primary" href={`/nobetci-eczane/${il}/yazdir`}>
            A4 Cikti Sayfasi
          </Link>
          <Link className="btn" href={`/nobetci-eczane/${il}/ekran`} target="_blank" rel="noreferrer">
            Tam Ekran Pano
          </Link>
        </div>
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Ilce Kisayollari</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.keys(byDistrict).map((districtName) => {
            const districtSlug = toSlug(districtName);
            return (
              <Link className="btn" key={districtName} href={`/nobetci-eczane/${il}/${districtSlug}`}>
                {districtName}
              </Link>
            );
          })}
        </div>
      </section>

      <MapPanel items={duty.data} title="Il Geneli Harita" />
      <NearestClient items={duty.data} />

      <section className="grid">
        {duty.data.map((item, idx) => (
          <PharmacyCard key={`${item.eczane_adi}-${idx}`} item={item} />
        ))}
      </section>
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
