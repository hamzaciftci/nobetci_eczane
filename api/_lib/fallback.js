import { resolveActiveDutyDate } from "./time.js";

export function isViewMissing(error) {
  return (
    error?.code === "42P01" ||
    (typeof error?.message === "string" && error.message.includes("api_active_duty"))
  );
}

export async function queryDutyFallback(db, { ilSlug, ilceSlug = null }) {
  const activeDate = resolveActiveDutyDate();

  const rowsToday = await queryDutyDate(db, activeDate, ilSlug, ilceSlug);
  if (rowsToday.length) {
    return { rows: rowsToday, dutyDate: activeDate, stale: false, lastSuccessfulDate: activeDate };
  }

  const latestRow = await db`
    SELECT max(duty_date) AS duty_date
    FROM duty_records dr
    JOIN provinces p ON p.id = dr.province_id
    WHERE p.slug = ${ilSlug}
  `;
  const latestDate = latestRow[0]?.duty_date ? formatDate(latestRow[0].duty_date) : null;
  if (!latestDate) {
    return { rows: [], dutyDate: activeDate, stale: true, lastSuccessfulDate: null };
  }

  const rowsLatest = await queryDutyDate(db, latestDate, ilSlug, ilceSlug);
  return { rows: rowsLatest, dutyDate: latestDate, stale: true, lastSuccessfulDate: latestDate };
}

export function degradedPayload(message) {
  return {
    status: "degraded",
    duty_date: null,
    son_guncelleme: null,
    degraded_info: {
      last_successful_update: null,
      stale_minutes: null,
      recent_alert: null,
      hint: message
    },
    data: []
  };
}

async function queryDutyDate(db, dutyDate, ilSlug, ilceSlug) {
  return db`
    SELECT
      ph.canonical_name AS eczane_adi,
      p.name            AS il,
      coalesce(d.name, 'Merkez') AS ilce,
      ph.address        AS adres,
      ph.phone          AS telefon,
      null::float       AS lat,
      null::float       AS lng,
      s.name            AS kaynak,
      coalesce(de.source_url, se.endpoint_url, '') AS kaynak_url,
      dr.updated_at     AS son_guncelleme,
      dr.confidence_score        AS dogruluk_puani,
      dr.verification_source_count AS dogrulama_kaynagi_sayisi,
      dr.is_degraded    AS is_degraded
    FROM duty_records dr
    JOIN pharmacies ph ON ph.id = dr.pharmacy_id
    JOIN provinces p ON p.id = dr.province_id
    LEFT JOIN districts d ON d.id = dr.district_id
    LEFT JOIN LATERAL (
      SELECT de.source_id, de.source_url, de.seen_at
      FROM duty_evidence de
      WHERE de.duty_record_id = dr.id
      ORDER BY de.seen_at DESC
      LIMIT 1
    ) de ON true
    LEFT JOIN sources s ON s.id = de.source_id
    LEFT JOIN source_endpoints se ON se.source_id = s.id AND se.is_primary = true
    WHERE dr.duty_date = ${dutyDate}
      AND p.slug = ${ilSlug}
      ${ilceSlug ? db`AND d.slug = ${ilceSlug}` : db``}
    ORDER BY ilce, eczane_adi
  `;
}

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
