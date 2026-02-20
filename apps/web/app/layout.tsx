import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { DisplayControls } from "../components/display-controls";
import { CookieConsent } from "../components/cookie-consent";
import { RouteMode } from "../components/route-mode";

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
      <body>
        <RouteMode />
        <div className="page site-shell">
          <header className="site-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <h1 style={{ margin: 0, fontSize: 24 }}>Nobetci Eczane</h1>
            </Link>
            <DisplayControls />
          </header>
          <p className="muted site-disclaimer">
            Gitmeden once telefonla arayin. Gece nobetinde kapi acik olmayabilir; zil ile hizmet verilebilir.
          </p>
          <nav className="site-nav" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <Link href="/kullanim-sartlari" className="pill">
              Kullanim Sartlari
            </Link>
            <Link href="/gizlilik-politikasi" className="pill">
              Gizlilik Politikasi
            </Link>
            <Link href="/cerez-politikasi" className="pill">
              Cerez Politikasi
            </Link>
            <Link href="/yanlis-bilgi-bildir" className="pill">
              Yanlis Bilgi Bildir
            </Link>
          </nav>
          {children}
          <div className="cookie-wrap">
            <CookieConsent />
          </div>
        </div>
      </body>
    </html>
  );
}
