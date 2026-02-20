import { DutyRecordDto } from "@nobetci/shared";
import { pharmacyJsonLd } from "../lib/structured-data";

export function PharmacyJsonLd({ items }: { items: DutyRecordDto[] }) {
  const payload = items.map(pharmacyJsonLd);
  return (
    <script
      type="application/ld+json"
      // JSON-LD script tag for Pharmacy/LocalBusiness rich results.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
