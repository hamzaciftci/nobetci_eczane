import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cerez Politikasi"
};

export default function CookiesPage() {
  return (
    <main className="panel">
      <h2 style={{ marginTop: 0 }}>Cerez Politikasi</h2>
      <p>Zorunlu cerezler oturum ve guvenlik icin kullanilir. Opsiyonel cerezler icin acik riza paneli sunulur.</p>
      <p>MVP asamasinda analytics cerezleri varsayilan olarak kapali tutulur veya self-hosted cerezsiz olcum tercih edilir.</p>
    </main>
  );
}
