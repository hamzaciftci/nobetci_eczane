/**
 * Otomatik üretilmiş SEO metin blokları.
 *
 * Her il/ilçe için benzersiz paragraflar.
 * Server component — render anında çalışır, istemciye JS gönderilmez.
 */

import { Info } from "lucide-react";

interface Props {
  blocks: string[];
  heading?: string;
}

export function SeoContent({ blocks, heading }: Props) {
  if (blocks.length === 0) return null;

  return (
    <section
      aria-label={heading ?? "Nöbetçi Eczane Bilgisi"}
      className="rounded-xl border border-gray-200 bg-white p-6 mb-10"
    >
      {heading && (
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 mb-4">
          <Info className="h-4 w-4 text-blue-500 shrink-0" />
          {heading}
        </h2>
      )}

      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        {blocks.map((block, i) => (
          <p key={i}>{block}</p>
        ))}
      </div>
    </section>
  );
}
