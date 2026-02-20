import type { Metadata } from "next";
import { fetchDutyByProvince } from "../../../../lib/api";
import { ScreenRuntime } from "../../../../components/screen-runtime";

export const revalidate = 60;

interface Props {
  params: Promise<{ il: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il } = await params;
  return {
    title: `${il} Nobetci Eczane Fullscreen`,
    description: `${il} icin menuler gizli tam ekran nobetci eczane panosu`,
    robots: {
      index: false,
      follow: false
    },
    alternates: {
      canonical: `/nobetci-eczane/${il}`
    }
  };
}

export default async function ProvinceFullscreenPage({ params }: Props) {
  const { il } = await params;
  const duty = await fetchDutyByProvince(il);
  const items = [...duty.data].sort(sortByDistrictAndName);
  const updatedAtText = duty.son_guncelleme ? formatDateTime(duty.son_guncelleme) : "-";

  return (
    <main className="screen-board">
      <header className="screen-board-header">
        <div>
          <p className="screen-kicker">Canli Nobetci Eczane Panosu</p>
          <h1>{toUpperTr(il)} NOBETCI ECZANELER</h1>
          <p className="screen-subtitle">
            Durum: {duty.status === "degraded" ? "DEGRADED" : "DOGRULANDI"} | Son guncelleme: {updatedAtText}
          </p>
        </div>
        <ScreenRuntime refreshSeconds={90} />
      </header>

      <section className="screen-list">
        {items.map((item, index) => (
          <article key={`${item.eczane_adi}-${item.ilce}-${index}`} className="screen-card">
            <div className="screen-card-head">
              <span className="screen-index">{index + 1}</span>
              <h2>{item.eczane_adi}</h2>
            </div>
            <p className="screen-district">{item.ilce}</p>
            <p className="screen-phone">{item.telefon}</p>
            <p className="screen-address">{item.adres}</p>
            <p className="screen-meta">
              Kaynak: {item.kaynak} | Dogrulama: {item.dogrulama_kaynagi_sayisi} kaynak
            </p>
          </article>
        ))}
        {!items.length ? <p className="screen-empty">Bu il icin aktif nobetci eczane kaydi bulunamadi.</p> : null}
      </section>

      <footer className="screen-footer">
        Bu link menuler kapali panodur. Tarayicida F11 ile cihaz ekranini da tam ekran yapabilirsiniz.
      </footer>
    </main>
  );
}

function sortByDistrictAndName(a: Awaited<ReturnType<typeof fetchDutyByProvince>>["data"][number], b: Awaited<ReturnType<typeof fetchDutyByProvince>>["data"][number]) {
  const districtCompare = a.ilce.localeCompare(b.ilce, "tr-TR");
  if (districtCompare !== 0) {
    return districtCompare;
  }
  return a.eczane_adi.localeCompare(b.eczane_adi, "tr-TR");
}

function formatDateTime(input: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(input));
}

function toUpperTr(value: string) {
  return value.toLocaleUpperCase("tr-TR");
}
