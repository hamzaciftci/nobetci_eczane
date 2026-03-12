"use client";

/**
 * NearestCta — Floating "En Yakın Eczane" butonu
 *
 * İl/ilçe sayfalarının sağ alt köşesinde sticky olarak durur.
 * Tıklandığında /en-yakin sayfasına yönlendirir.
 * Scroll 200px geçilince görünür hale gelir.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navigation } from "lucide-react";

export function NearestCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 200);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Link
      href="/en-yakin"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-all"
      aria-label="En yakın nöbetçi eczaneyi bul"
    >
      <Navigation className="h-4 w-4" />
      <span className="hidden sm:inline">En Yakın Eczane</span>
    </Link>
  );
}
