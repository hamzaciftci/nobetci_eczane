import { resolveActiveDutyDate } from "../time.js";
import { logRun } from "./loggingLayer.js";
import { normalizeText, resolveDistrictId, resolveDutyWindow } from "./normalizeLayer.js";
import { cacheDel, dutyProvinceKey, dutyDistrictKey } from "../cache.js";

export async function upsertRows(sql, ep, ilSlug, rows, httpStatus, started) {
  const districts = await sql`
    SELECT id, name, slug FROM districts
    WHERE province_id = ${ep.province_id}
    ORDER BY name
  `;

  const today = resolveActiveDutyDate();
  const { dutyStart, dutyEnd } = resolveDutyWindow(today);
  let upserted = 0;
  const errors = [];
  const seenDistricts = new Set();
  const upsertedPharmacyIds = [];

  for (const row of rows) {
    try {
      const districtId = resolveDistrictId(districts, row.district);
      if (!districtId) {
        errors.push(`no_district:${row.name}`);
        continue;
      }

      const normName = normalizeText(row.name);

      const [ph] = await sql`
        INSERT INTO pharmacies (
          id, province_id, district_id,
          canonical_name, normalized_name,
          address, phone, lat, lng, is_active, updated_at
        )
        VALUES (
          gen_random_uuid(), ${ep.province_id}, ${districtId},
          ${row.name}, ${normName},
          ${row.address || ""}, ${row.phone || ""},
          ${row.lat ?? null}, ${row.lng ?? null},
          true, now()
        )
        ON CONFLICT (district_id, normalized_name) DO UPDATE SET
          canonical_name = EXCLUDED.canonical_name,
          address = CASE
            WHEN EXCLUDED.address != '' THEN EXCLUDED.address
            ELSE pharmacies.address
          END,
          phone = CASE
            WHEN EXCLUDED.phone != '' THEN EXCLUDED.phone
            ELSE pharmacies.phone
          END,
          lat = CASE
            WHEN EXCLUDED.lat IS NOT NULL THEN EXCLUDED.lat
            ELSE pharmacies.lat
          END,
          lng = CASE
            WHEN EXCLUDED.lng IS NOT NULL THEN EXCLUDED.lng
            ELSE pharmacies.lng
          END,
          is_active  = true,
          updated_at = now()
        RETURNING id
      `;

      seenDistricts.add(districtId);
      upsertedPharmacyIds.push(ph.id);

      const [dr] = await sql`
        INSERT INTO duty_records (
          id, pharmacy_id, province_id, district_id,
          duty_date, duty_start, duty_end,
          confidence_score, verification_source_count,
          last_verified_at, is_degraded, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${ph.id}, ${ep.province_id}, ${districtId},
          ${today}, ${dutyStart}, ${dutyEnd},
          80, 1, now(), false, now(), now()
        )
        ON CONFLICT (pharmacy_id, duty_date) DO UPDATE SET
          last_verified_at          = now(),
          updated_at                = now(),
          district_id               = EXCLUDED.district_id,
          is_degraded               = false,
          confidence_score          = GREATEST(duty_records.confidence_score, 80),
          verification_source_count = duty_records.verification_source_count + 1
        RETURNING id
      `;

      await sql`
        INSERT INTO duty_evidence (
          duty_record_id, source_id, source_url,
          seen_at, extracted_payload
        )
        VALUES (
          ${dr.id}, ${ep.source_id}, ${ep.endpoint_url},
          now(),
          ${JSON.stringify({
            name: row.name,
            address: row.address,
            phone: row.phone,
            district: row.district,
            ...(row.lat != null ? { lat: row.lat, lng: row.lng } : {})
          })}::jsonb
        )
        ON CONFLICT (duty_record_id, source_id, source_url) DO UPDATE SET
          seen_at = now()
      `;

      upserted++;
    } catch (err) {
      errors.push(`${row.name}: ${err.message.slice(0, 80)}`);
    }
  }

  // Stale duty_records temizle: bu il için bugün DB'de olup artık
  // canlı kaynakta bulunmayan kayıtları sil (tam başarılı ingest'te).
  if (upserted === rows.length && upsertedPharmacyIds.length > 0) {
    try {
      await sql`
        DELETE FROM duty_records
        WHERE province_id = ${ep.province_id}
          AND duty_date   = ${today}
          AND pharmacy_id != ALL(${upsertedPharmacyIds})
      `;
    } catch {
      /* stale cleanup hatası ingest'i durdurmasın */
    }
  }

  const status = upserted === 0 ? "failed" : upserted < rows.length ? "partial" : "success";

  // Başarılı/kısmi ingest sonrası Redis önbelleğini temizle.
  // Böylece bir sonraki API isteği hemen taze veriyi DB'den çeker
  // (önceki stale cache 10 dakika daha servis edilmez).
  if (upserted > 0) {
    try {
      const keysToDelete = [
        dutyProvinceKey(ilSlug),
        ...districts.map((d) => dutyDistrictKey(ilSlug, d.slug)),
      ];
      await cacheDel(keysToDelete);
    } catch {
      /* cache temizleme başarısız olsa bile ingest tamamlandı sayılır */
    }
  }

  await logRun(
    sql,
    ep.endpoint_id,
    status,
    httpStatus,
    errors.length ? errors.slice(0, 5).join("; ") : null,
    ilSlug
  );

  return {
    status,
    il: ilSlug,
    found: rows.length,
    upserted,
    elapsed_ms: Date.now() - started,
    expected_count: districts.length,
    covered_districts: seenDistricts.size,
    ...(errors.length ? { errors: errors.slice(0, 3) } : {})
  };
}
