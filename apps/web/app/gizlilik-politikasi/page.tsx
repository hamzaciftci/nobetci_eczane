import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gizlilik Politikasi"
};

export default function PrivacyPage() {
  return (
    <main className="panel">
      <h2 style={{ marginTop: 0 }}>Gizlilik Politikasi</h2>
      <p>Konum verisi varsayilan olarak sunucuya gonderilmez. Mesafe hesaplari cihaz tarafinda yapilacak sekilde tasarlanmistir.</p>
      <p>Zorunlu olmayan cerezler acik riza olmadan aktif edilmez. Aydinlatma metni ve veri sorumlusu bilgileri yayin surecine dahil edilir.</p>
    </main>
  );
}
