import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kullanim Sartlari"
};

export default function TermsPage() {
  return (
    <main className="panel">
      <h2 style={{ marginTop: 0 }}>Kullanim Sartlari</h2>
      <p>
        Bu platform kaynak seffafligi ile hizmet verir ancak acil durumlarda gitmeden once eczaneyi arayarak teyit etmeniz gerekir.
      </p>
      <p>
        Gece nobetinde kapi acik olmayabilir; zil ile hizmet verilebilir. Yanlis bilgi gordugunuzde bildirim formunu kullanabilirsiniz.
      </p>
    </main>
  );
}
