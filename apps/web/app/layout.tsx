import type { Metadata } from "next";
import Link from "next/link";
import { DM_Serif_Display, Manrope } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { DisplayControls } from "../components/display-controls";
import { CookieConsent } from "../components/cookie-consent";
import { RouteMode } from "../components/route-mode";

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const headingFont = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading"
});

export const metadata: Metadata = {
  title: "Nobetci Eczane Platformu",
  description: "81 il icin kaynak seffafligi olan nobetci eczane platformu",
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>
        <RouteMode />

        <div className="site-shell page">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Ana sayfa">
              <span className="brand-mark">E</span>
              <span className="brand-word">Nobetci Eczane</span>
            </Link>

            <div className="topbar-actions">
              <span className="verify-pill">Kaynak dogrulaniyor</span>
              <DisplayControls />
            </div>
          </header>

          <nav className="quick-nav">
            <Link href="/kullanim-sartlari" className="pill nav-pill">
              Kullanim Sartlari
            </Link>
            <Link href="/gizlilik-politikasi" className="pill nav-pill">
              Gizlilik Politikasi
            </Link>
            <Link href="/cerez-politikasi" className="pill nav-pill">
              Cerez Politikasi
            </Link>
            <Link href="/yanlis-bilgi-bildir" className="pill nav-pill">
              Yanlis Bilgi Bildir
            </Link>
          </nav>

          <p className="muted site-disclaimer">
            Gitmeden once telefonla arayin. Gece nobetinde kapi kapali olabilir, zil ile hizmet verilebilir.
          </p>

          {children}

          <div className="cookie-wrap">
            <CookieConsent />
          </div>
        </div>
      </body>
    </html>
  );
}
