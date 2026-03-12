/**
 * Bilinmeyen il slug'ı için 404 sayfası.
 */

import Link from "next/link";

export default function CityNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl mb-4">💊</p>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        İl Bulunamadı
      </h1>
      <p className="text-gray-500 mb-6 max-w-sm">
        Aradığınız ile ait nöbetçi eczane bilgisi bulunamadı. Lütfen il adını
        kontrol edip tekrar deneyin.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-white font-semibold hover:bg-blue-700 transition-colors"
      >
        Ana Sayfaya Dön
      </Link>
    </div>
  );
}
