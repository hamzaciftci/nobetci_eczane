import type { Metadata } from "next";
import { fetchDutyByDistrict } from "../../../../../lib/api";
import { ScreenRuntime } from "../../../../../components/screen-runtime";

export const revalidate = 60;

interface Props {
  params: Promise<{ il: string; ilce: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il, ilce } = await params;
  return {
    title: `${ilce} ${il} Nobetci Eczane Fullscreen`,
    description: `${ilce}, ${il} icin menuler gizli tam ekran nobetci eczane panosu`,
    robots: {
      index: false,
      follow: false
    },
    alternates: {
      canonical: `/nobetci-eczane/${il}/${ilce}`
    }
  };
}

export default async function DistrictFullscreenPage({ params }: Props) {
  const { il, ilce } = await params;
  const duty = await fetchDutyByDistrict(il, ilce);
  const items = [...duty.data].sort(sortByName);
  const updatedAtText = duty.son_guncelleme ? formatDateTime(duty.son_guncelleme) : "-";

  return (
    <main className="screen-board">
      <header className="screen-board-header">
        <div>
          <p className="screen-kicker">Canli Nobetci Eczane Panosu</p>
          <h1>
            {toUpperTr(ilce)} / {toUpperTr(il)} NOBETCI ECZANELER
          </h1>
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
        {!items.length ? <p className="screen-empty">Bu ilce icin aktif nobetci eczane kaydi bulunamadi.</p> : null}
      </section>

      <footer className="screen-footer">
        Bu link menuler kapali panodur. Tarayicida F11 ile cihaz ekranini da tam ekran yapabilirsiniz.
      </footer>
    </main>
  );
}

function sortByName(a: Awaited<ReturnType<typeof fetchDutyByDistrict>>["data"][number], b: Awaited<ReturnType<typeof fetchDutyByDistrict>>["data"][number]) {
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
