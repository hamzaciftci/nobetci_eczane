import type { Metadata } from "next";
import { fetchProvinces } from "../lib/api";
import { buildDailyDutyTitle, formatIstanbulDateWithWeekday } from "../lib/date";
import { HomeCitySelector } from "../components/home-city-selector";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: buildDailyDutyTitle(),
    description: "Türkiye genelinde güncel nöbetçi eczane bilgisine hızlı erişim."
  };
}

export default async function HomePage() {
  let provinces: Awaited<ReturnType<typeof fetchProvinces>> = [];
  let error: string | null = null;

  try {
    provinces = await fetchProvinces();
  } catch (err) {
    error = err instanceof Error ? err.message : "Bilinmeyen hata";
  }

  const nowLabel = formatIstanbulDateWithWeekday();

  return (
    <main className="grid home-shell">
      <section className="panel home-hero">
        <p className="home-badge">Resmi kaynaklardan dogrulanan veri</p>
        <h2 className="home-title">Nobetci Eczane</h2>
        <p className="home-subtitle">Turkiye genelinde guncel nobetci eczane bilgisine hizlica ulasin.</p>
        <p className="home-date">{nowLabel}</p>

        <div className="home-highlights">
          <span className="pill">81 il destekleniyor</span>
          <span className="pill">Saatlik guncelleme</span>
          <span className="pill">Kaynak seffafligi</span>
        </div>
      </section>

      {error ? (
        <section className="panel degraded-banner">
          <strong>Iller yuklenemedi</strong>
          <p className="muted">Servis erisimi yok: {error}</p>
        </section>
      ) : (
        <HomeCitySelector provinces={provinces} />
      )}
    </main>
  );
}
