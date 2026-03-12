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
import Link from "next/link";
import { MapPin, Clock, Shield, ChevronRight } from "lucide-react";

import { SchemaMarkup } from "@/app/components/SchemaMarkup";
import { NearestClient } from "./NearestClient";
import { nearestPageSchema, breadcrumbSchema } from "@/app/lib/schema";
import { getToday } from "@/app/lib/date";

// ISR: günlük yenile (içerik statik)
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

// Popüler iller — iç linkleme için
const POPULAR_PROVINCES = [
  ["İstanbul",   "istanbul"],
  ["Ankara",     "ankara"],
  ["İzmir",      "izmir"],
  ["Bursa",      "bursa"],
  ["Antalya",    "antalya"],
  ["Adana",      "adana"],
  ["Konya",      "konya"],
  ["Gaziantep",  "gaziantep"],
  ["Mersin",     "mersin"],
  ["Kayseri",    "kayseri"],
  ["Eskişehir",  "eskisehir"],
  ["Diyarbakır", "diyarbakir"],
  ["Samsun",     "samsun"],
  ["Trabzon",    "trabzon"],
  ["Kocaeli",    "kocaeli"],
  ["Malatya",    "malatya"],
] as const;

const HOW_IT_WORKS = [
  {
    icon: MapPin,
    title: "Konumunuzu Paylaşın",
    desc: "\"Konumumu Kullan\" butonuna tıklayın. Tarayıcınız konum iznini isteyecektir.",
  },
  {
    icon: Clock,
    title: "Anında Arama",
    desc: "Koordinatlarınız resmi eczane veri tabanında anlık olarak sorgulanır.",
  },
  {
    icon: Shield,
    title: "Güvenli ve Gizli",
    desc: "Konum bilginiz sunucularımızda saklanmaz; yalnızca arama için kullanılır.",
  },
];

export default function EnYakinPage() {
  const { long } = getToday();

  const breadcrumbs = [
    { name: "Türkiye", href: "/" },
    { name: "En Yakın Nöbetçi Eczane", href: "/en-yakin" },
  ];

  return (
    <>
      <SchemaMarkup schemas={[nearestPageSchema(), breadcrumbSchema(breadcrumbs)]} />

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-sm text-gray-500">
        <Link href="/" className="hover:text-blue-600 transition-colors">Türkiye</Link>
        <ChevronRight className="h-4 w-4 text-gray-400" />
        <span className="text-gray-700 font-medium">En Yakın Nöbetçi Eczane</span>
      </nav>

      {/* ── H1 ──────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
          En Yakın Nöbetçi Eczane
        </h1>
        <p className="mt-2 text-gray-500 text-base">
          {long} tarihinde yakınınızdaki açık nöbetçi eczaneleri GPS ile bulun
        </p>
      </div>

      {/* ── H2 #1: Geolocation CTA ─────────────────────────────────────── */}
      <section aria-labelledby="h2-locate" className="mb-12">
        <h2 id="h2-locate" className="sr-only">
          Konuma Göre Nöbetçi Eczane Bul
        </h2>
        <NearestClient />
      </section>

      {/* ── H2 #2: Nasıl Çalışır? ───────────────────────────────────────── */}
      <section aria-labelledby="h2-how" className="mb-12">
        <h2
          id="h2-how"
          className="text-xl font-bold text-gray-800 mb-6"
        >
          Nasıl Çalışır?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {HOW_IT_WORKS.map(({ icon: Icon, title, desc }, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <Icon className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── H2 #3: SEO içerik ───────────────────────────────────────────── */}
      <section aria-labelledby="h2-info" className="mb-12 prose prose-gray max-w-none">
        <h2 id="h2-info" className="text-xl font-bold text-gray-800 not-prose mb-4">
          Nöbetçi Eczane Hakkında
        </h2>
        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <p>
            Nöbetçi eczaneler, normal çalışma saatleri dışında — gece, hafta sonu ve resmi
            tatillerde — vatandaşların ilaç ihtiyacını karşılamak üzere dönüşümlü olarak
            görev yapan eczanelerdir. Her il ve ilçede nöbet takvimi, yerel eczacı odaları
            tarafından resmi olarak belirlenir.
          </p>
          <p>
            Sitemiz, Türkiye genelinde 81 ilin tamamındaki nöbetçi eczane bilgilerini resmi
            eczacı odası kaynaklarından anlık olarak alır ve günceller. &ldquo;Yakınımdaki
            nöbetçi eczane&rdquo; özelliği, GPS koordinatlarınızı kullanarak size en yakın
            açık eczaneyi mesafeye göre sıralayarak listeler.
          </p>
          <p>
            Konum iznini paylaşmak istemezseniz, aşağıdaki il listesinden yaşadığınız şehri
            seçerek o ile ait nöbetçi eczane listesine ulaşabilirsiniz.
          </p>
        </div>
      </section>

      {/* ── H2 #4: İllere Göre Nöbetçi Eczane ─────────────────────────── */}
      <section aria-labelledby="h2-provinces" className="mb-8">
        <h2
          id="h2-provinces"
          className="text-xl font-bold text-gray-800 mb-4"
        >
          İllere Göre Nöbetçi Eczane
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Konum hizmetini kullanmak istemiyorsanız ilinizi seçin:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {POPULAR_PROVINCES.map(([name, slug]) => (
            <Link
              key={slug}
              href={`/nobetci-eczane/${slug}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              {name}
            </Link>
          ))}
        </div>
        <div className="mt-3">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            Tüm illeri gör <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </>
  );
}
