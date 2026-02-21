import type { Metadata } from "next";
import { fetchDutyByDistrict } from "../../../../../lib/api";
import { PrintActions } from "../../../../../components/print-actions";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ il: string; ilce: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { il, ilce } = await params;
  return {
    title: `${ilce} ${il} Nobetci Eczane A4 Cikti`,
    description: `${ilce}, ${il} icin o gunun nobetci eczanelerini A4 formatinda yazdirma sayfasi`,
    robots: {
      index: false,
      follow: false
    },
    alternates: {
      canonical: `/nobetci-eczane/${il}/${ilce}`
    }
  };
}

export default async function DistrictPrintPage({ params }: Props) {
  const { il, ilce } = await params;
  const duty = await fetchDutyByDistrict(il, ilce);
  const items = [...duty.data].sort(sortByName);
  const nowText = formatDateTime(new Date());
  const updatedAtText = duty.son_guncelleme ? formatDateTime(duty.son_guncelleme) : "-";

  return (
    <main className="print-page-root">
      <PrintActions screenHref={`/nobetci-eczane/${il}/${ilce}/ekran`} />

      <section className="a4-sheet">
        <header className="a4-header">
          <p className="a4-kicker">Nobetci Eczane Cikti Formu</p>
          <h1>
            {toUpperTr(ilce)} / {toUpperTr(il)} O GUNUN NOBETCI ECZANELERI
          </h1>
          <p className="a4-meta-line">Hazirlanma: {nowText}</p>
          <p className="a4-meta-line">Son guncelleme: {updatedAtText}</p>
          <p className="a4-meta-line">Durum: {duty.status === "degraded" ? "DEGRADED (son basarili veri gosteriliyor)" : "DOGRULANDI"}</p>
        </header>

        {items.length ? (
          <table className="a4-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Eczane</th>
                <th>Adres</th>
                <th>Telefon</th>
                <th>Dogrulama</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.eczane_adi}-${item.ilce}-${index}`}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{item.eczane_adi}</strong>
                    <span className="a4-source">Kaynak: {item.kaynak}</span>
                  </td>
                  <td>{item.adres}</td>
                  <td className="a4-nowrap">{item.telefon}</td>
                  <td>{item.dogrulama_kaynagi_sayisi} kaynak</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="a4-empty">Bu ilce icin aktif nobetci eczane kaydi bulunamadi.</p>
        )}

        <footer className="a4-footer">
          <p>
            Bu liste eczane cami duyuru amacli kullanima uygundur. Ulasmadan once telefonla teyit edin.
          </p>
          <p>Kaynak seffafligi zorunludur. Her kayit icin kaynak bilgisi sistemde saklanir.</p>
        </footer>
      </section>
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
