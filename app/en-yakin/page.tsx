/**
 * En Yakın Nöbetçi Eczane — SSR landing page
 *
 * URL     : /en-yakin
 * Hedef   : "yakınımdaki nöbetçi eczane", "en yakın nöbetçi eczane", "şu an nöbetçi eczane"
 *
 * Yapı:
 *  H1 — Ana hedef anahtar kelime
 *  H2 — Geolocation CTA (client component)
 *  H2 — Nasıl çalışır? (UX rehberi)
 *  H2 — Nöbetçi Eczane Hakkında (SEO içerik)
 *  H2 — İllere Göre Nöbetçi Eczane (iç link ağı)
 */

import type { Metadata } from "next";

import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { NearestClient } from "./NearestClient";
import { nearestPageSchema, breadcrumbSchema } from "@/app/lib/schema";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: { absolute: "En Yakın Nöbetçi Eczane – Yakınımdaki Açık Eczane" },
  description:
    "GPS konumunuzu kullanarak en yakın nöbetçi eczaneyi saniyeler içinde bulun. Yakınımdaki nöbetçi eczane listesi — adres, telefon ve harita bilgileriyle.",
  openGraph: {
    title: "En Yakın Nöbetçi Eczane – Yakınımdaki Açık Eczane",
    description:
      "GPS konumunuzu kullanarak en yakın nöbetçi eczaneyi saniyeler içinde bulun.",
    url: "https://www.bugunnobetcieczaneler.com/en-yakin",
    siteName: "Bugün Nöbetçi Eczaneler",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "En Yakın Nöbetçi Eczane – Yakınımdaki Açık Eczane",
    description: "GPS ile yakınınızdaki açık nöbetçi eczaneyi anında bulun.",
  },
  alternates: {
    canonical: "https://www.bugunnobetcieczaneler.com/en-yakin",
  },
};

const breadcrumbs = [
  { name: "Türkiye", href: "/" },
  { name: "En Yakın Nöbetçi Eczane", href: "/en-yakin" },
];

export default function EnYakinPage() {
  return (
    <div className="container py-12 md:py-20">
      <SchemaMarkup schemas={[nearestPageSchema(), breadcrumbSchema(breadcrumbs)]} />
      <NearestClient />
    </div>
  );
}
