/**
 * Ana sayfa — SSR (her istek server'da render edilir).
 * Google'ın "bugün nöbetçi eczane" gibi sorgularını hedefler.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Clock, Shield, ChevronRight, Navigation } from "lucide-react";
import { homeMeta } from "./lib/meta";
import { getToday } from "./lib/date";
import { provinces } from "./lib/provinces";

export const revalidate = 3600; // 1 saatte bir yeniden oluştur

export function generateMetadata(): Metadata {
  return homeMeta();
}

const POPULAR = [
  { name: "İstanbul", slug: "istanbul" },
  { name: "Ankara", slug: "ankara" },
  { name: "İzmir", slug: "izmir" },
  { name: "Antalya", slug: "antalya" },
  { name: "Bursa", slug: "bursa" },
  { name: "Gaziantep", slug: "gaziantep" },
  { name: "Adana", slug: "adana" },
  { name: "Mersin", slug: "mersin" },
  { name: "Konya", slug: "konya" },
  { name: "Kayseri", slug: "kayseri" },
  { name: "Osmaniye", slug: "osmaniye" },
  { name: "Trabzon", slug: "trabzon" },
];

export default function HomePage() {
  const { ddmmyyyy, long } = getToday();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="text-center py-12 md:py-16">
        <p className="text-sm font-medium text-blue-600 mb-3 uppercase tracking-widest">
          {long} · Güncel Veri
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
          Bugün Nöbetçi Eczane
          <br />
          <span className="text-blue-600">Nerede?</span>
        </h1>
        <p className="max-w-xl mx-auto text-lg text-gray-500 mb-8">
          Türkiye&apos;nin 81 ilinde resmi eczacı odası kaynaklarından alınan
          güncel nöbetçi eczane bilgisi.
        </p>

        <a
          href="/en-yakin"
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition-colors shadow-md"
        >
          <Navigation className="h-4 w-4" />
          En Yakın Nöbetçi Eczaneyi Bul
        </a>
      </section>

      {/* ── Popüler Şehirler ─────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Şehir Seçin
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {POPULAR.map((city) => (
            <Link
              key={city.slug}
              href={`/nobetci-eczane/${city.slug}`}
              className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors shadow-sm"
            >
              <span className="font-medium text-gray-700 group-hover:text-blue-700">
                {city.name}
              </span>
              <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Tüm İller A–Z ────────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          Tüm İller — {ddmmyyyy} Nöbetçi Eczane Listesi
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {provinces.map((p) => (
            <Link
              key={p.slug}
              href={`/nobetci-eczane/${p.slug}`}
              className="text-sm text-gray-600 hover:text-blue-600 hover:underline transition-colors py-0.5"
            >
              {p.name} Nöbetçi Eczane
            </Link>
          ))}
        </div>
      </section>

      {/* ── Özellikler ───────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-white border border-gray-200 p-8 mb-12">
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
          Neden Bugün Nöbetçi Eczaneler?
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: Clock,
              title: "Anlık ve Güncel Veri",
              desc: "Nöbetçi eczane bilgileri saatlik olarak güncellenir.",
            },
            {
              icon: MapPin,
              title: "81 İl Kapsamı",
              desc: "Türkiye'nin tüm illerindeki nöbetçi eczanelere erişin.",
            },
            {
              icon: Shield,
              title: "Resmi Kaynaklardan",
              desc: "Veriler eczacı odalarından doğrulanarak sunulmaktadır.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 mb-3">
                <Icon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-1">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SEO metin bloğu ──────────────────────────────────────────── */}
      <section className="prose prose-sm max-w-none text-gray-600">
        <h2 className="text-lg font-bold text-gray-800">
          Nöbetçi Eczane Nedir?
        </h2>
        <p>
          Nöbetçi eczane, resmi çalışma saatleri dışında, gece ve hafta
          sonları da hizmet veren eczanedir. Her ilde eczacı odası tarafından
          belirlenen nöbet listesi günlük olarak değişir. Türkiye genelinde 81
          ilde nöbet sistemi uygulanmaktadır.
        </p>
        <p>
          {ddmmyyyy} tarihinde bulunduğunuz ile ait nöbetçi eczane listesine
          ulaşmak için yukarıdaki şehir seçeneklerinden ilinizi seçin.
        </p>
      </section>
    </>
  );
}
