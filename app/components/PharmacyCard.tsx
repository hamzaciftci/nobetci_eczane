/**
 * Tek eczane kartı — server component, interaktivite yok.
 * Adres, telefon ve Google Maps linki gösterir.
 */

import { MapPin, Phone, ExternalLink } from "lucide-react";
import type { Pharmacy } from "@/app/lib/duty";

interface Props {
  pharmacy: Pharmacy;
}

export function PharmacyCard({ pharmacy: p }: Props) {
  const mapsUrl =
    p.lat != null && p.lng != null
      ? `https://www.google.com/maps?q=${p.lat},${p.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(
          `${p.eczane_adi} ${p.adres} ${p.il}`
        )}`;

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <h3 className="font-semibold text-gray-900 text-base leading-snug mb-2">
        {p.eczane_adi}
      </h3>

      <div className="space-y-1.5 text-sm text-gray-600">
        {/* Adres */}
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
          <span>{p.adres}</span>
        </div>

        {/* Telefon */}
        {p.telefon && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-green-500" />
            <a
              href={`tel:${p.telefon.replace(/\s/g, "")}`}
              className="text-green-700 font-medium hover:underline"
            >
              {p.telefon}
            </a>
          </div>
        )}

        {/* İlçe etiketi + Harita linki */}
        <div className="flex items-center justify-between pt-1">
          <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {p.ilce}
          </span>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            Haritada Gör
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}
