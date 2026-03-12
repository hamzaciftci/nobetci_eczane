import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { localBusinessSchema, websiteSchema } from "@/app/lib/schema";
import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { NearestCta } from "@/app/components/NearestCta";
import { EczaneLogoIcon } from "@/app/components/EczaneLogoIcon";
import { MobileMenu } from "@/app/components/MobileMenu";

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

const navLinks = [
  { href: "/", label: "Anasayfa" },
  { href: "/en-yakin", label: "En Yakın" },
  { href: "/iletisim", label: "İletişim" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={inter.className}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SchemaMarkup schemas={[localBusinessSchema(), websiteSchema()]} />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 border-b border-border bg-surface/80 backdrop-blur-xl no-print">
          <div className="container relative flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                <EczaneLogoIcon className="h-7 w-7 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Nöbetçi Eczane
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile hamburger */}
            <MobileMenu />
          </div>
        </header>

        {/* ── Main Content ───────────────────────────────────────────── */}
        <main className="flex-1">{children}</main>

        {/* ── Floating CTA ───────────────────────────────────────────── */}
        <NearestCta />

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-surface no-print">
          <div className="container py-12">
            <div className="grid gap-8 md:grid-cols-3">
              {/* Brand */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <EczaneLogoIcon className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-base font-bold text-foreground">
                    Nöbetçi Eczane
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Türkiye genelinde nöbetçi eczane rehberi
                </p>
              </div>

              {/* Disclaimer */}
              <div className="flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Veriler resmi eczacı odalarından alınmaktadır. Gitmeden önce
                  telefonla arayın. Gece nöbetinde kapı kapalı olabilir, zil
                  ile hizmet verilebilir.
                </p>
              </div>

              {/* Links */}
              <div className="flex flex-col gap-2">
                <Link
                  href="/iletisim"
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  Yanlış bilgi bildir
                </Link>
                <Link
                  href="/iletisim"
                  className="text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  İletişim
                </Link>
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} Nöbetçi Eczane · Bu bir kamu
              hizmeti projesidir. Bilgilerin doğruluğu garanti edilmez.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
