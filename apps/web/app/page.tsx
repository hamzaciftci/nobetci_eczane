import Link from "next/link";
import { fetchProvinces } from "../lib/api";

export const revalidate = 3600;

export default async function HomePage() {
  let provinces: Awaited<ReturnType<typeof fetchProvinces>> = [];
  let error: string | null = null;

  try {
    provinces = await fetchProvinces();
  } catch (err) {
    error = err instanceof Error ? err.message : "Bilinmeyen hata";
  }

  return (
    <main className="grid">
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Il Secerek Baslayin</h2>
        <p className="muted">
          Hedef: yuksek dogruluk, ultra hiz, kaynak seffafligi. Sayfalar ISR + SWR ile surekli taze tutulur.
        </p>
        {error ? <p className="danger">Servis erisimi yok: {error}</p> : null}
      </section>

      <section className="grid cols-2">
        {provinces.map((province) => (
          <Link key={province.code} href={`/nobetci-eczane/${province.slug}`} className="panel" style={{ textDecoration: "none" }}>
            <strong>{province.name}</strong>
            <p className="muted" style={{ marginBottom: 0 }}>
              /nobetci-eczane/{province.slug}
            </p>
          </Link>
        ))}
      </section>
    </main>
  );
}
