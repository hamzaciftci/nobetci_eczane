import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { localBusinessSchema, websiteSchema } from "@/app/lib/schema";
import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { NearestCta } from "@/app/components/NearestCta";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.bugunnobetcieczaneler.com"),
  title: {
    default: "Bugün Nöbetçi Eczane – Türkiye Nöbetçi Eczane Listesi",
    template: "%s | Bugün Nöbetçi Eczaneler",
  },
  description:
    "Türkiye'nin 81 ilinde resmi kaynaklardan alınan güncel nöbetçi eczane bilgisi. Adres, telefon ve harita bilgileri.",
  keywords: [
    "nöbetçi eczane", "bugün nöbetçi eczane", "nöbetçi eczane listesi",
    "eczane nöbet", "açık eczane",
  ],
  authors: [{ name: "Bugün Nöbetçi Eczaneler" }],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    siteName: "Bugün Nöbetçi Eczaneler",
    locale: "tr_TR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={inter.className}>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <SchemaMarkup schemas={[localBusinessSchema(), websiteSchema()]} />
        {/* ── Header ───────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">💊</span>
              <span className="font-bold text-gray-900 text-lg leading-tight">
                Nöbetçi<span className="text-blue-600">Eczane</span>
              </span>
            </Link>

            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
              <Link href="/" className="hover:text-blue-600 transition-colors">
                Ana Sayfa
              </Link>
              <Link href="/en-yakin" className="hover:text-blue-600 transition-colors">
                En Yakın
              </Link>
              <Link href="/iletisim" className="hover:text-blue-600 transition-colors">
                İletişim
              </Link>
            </nav>
          </div>
        </header>

        {/* ── Main Content ─────────────────────────────────────────── */}
        <main className="mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>

        {/* ── Floating CTA ─────────────────────────────────────────── */}
        <NearestCta />

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="border-t border-gray-200 bg-white mt-16">
          <div className="mx-auto max-w-6xl px-4 py-8">
            {/* İl linkleri — iç linkleme için kritik */}
            <nav aria-label="İl Linkleri" className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Tüm İller
              </h2>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                {[
                  ["Adana", "adana"], ["Ankara", "ankara"], ["Antalya", "antalya"],
                  ["Bursa", "bursa"], ["Diyarbakır", "diyarbakir"], ["Eskişehir", "eskisehir"],
                  ["Gaziantep", "gaziantep"], ["İstanbul", "istanbul"], ["İzmir", "izmir"],
                  ["Kayseri", "kayseri"], ["Kocaeli", "kocaeli"], ["Konya", "konya"],
                  ["Malatya", "malatya"], ["Mersin", "mersin"], ["Muğla", "mugla"],
                  ["Osmaniye", "osmaniye"], ["Samsun", "samsun"], ["Trabzon", "trabzon"],
                ].map(([name, slug]) => (
                  <Link
                    key={slug}
                    href={`/nobetci-eczane/${slug}`}
                    className="hover:text-blue-600 hover:underline transition-colors"
                  >
                    {name} Nöbetçi Eczane
                  </Link>
                ))}
              </div>
            </nav>

            <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-400">
              <p>© {new Date().getFullYear()} Bugün Nöbetçi Eczaneler</p>
              <p>Resmi eczacı odası kaynaklarından alınan güncel veri</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
