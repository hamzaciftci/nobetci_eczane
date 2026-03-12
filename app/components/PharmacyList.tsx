/**
 * Eczane listesi — server component.
 * Tüm eczaneleri grid içinde PharmacyCard olarak render eder.
 * Ayrıca her biri için JSON-LD schema enjekte eder.
 */

import type { Pharmacy } from "@/app/lib/duty";
import { PharmacyCard } from "./PharmacyCard";
import { SchemaMarkup } from "./SchemaMarkup";
import { pharmacySchema } from "@/app/lib/schema";

interface Props {
  pharmacies: Pharmacy[];
}

export function PharmacyList({ pharmacies }: Props) {
  if (pharmacies.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800 font-medium">
          Bu bölge için bugün nöbetçi eczane kaydı bulunamadı.
        </p>
        <p className="text-amber-600 text-sm mt-1">
          Veriler güncelleniyor olabilir. Lütfen birkaç dakika sonra tekrar deneyin.
        </p>
      </div>
    );
  }

  const schemas = pharmacies.map(pharmacySchema);

  return (
    <>
      <SchemaMarkup schemas={schemas} />

      <p className="text-sm text-gray-500 mb-4">
        {pharmacies.length} nöbetçi eczane listeleniyor
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pharmacies.map((p, i) => (
          <PharmacyCard key={`${p.eczane_adi}-${i}`} pharmacy={p} />
        ))}
      </div>
    </>
  );
}
