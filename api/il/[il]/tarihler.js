import { withDb } from "../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendJson } from "../../_lib/http.js";
import { cacheGet, cacheSet, dutyDatesKey } from "../../_lib/cache.js";

const TTL_TARIHLER = 5 * 60; // 5 dakika

/**
 * GET /api/il/:il/tarihler
 *
 * İl için duty_records'ta kayıtlı nöbet tarihlerini döner.
 * Aralık: son 6 gün + yarın (bazı iller yarın da gösterebilir).
 * Dönen tarihler sıralı (yeni → eski), max 7 tarih.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") return methodNotAllowed(req, res, ["GET"]);

  const ilSlug = getSingleQueryValue(req.query.il).toLowerCase();
  if (!ilSlug) return sendJson(res, 400, { error: "invalid_il" });

  res.setHeader("Cache-Control", "no-store");

  const cacheKey = dutyDatesKey(ilSlug);
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return sendJson(res, 200, cached);

    const rows = await withDb((db) => db`
      SELECT DISTINCT dr.duty_date::text AS duty_date
      FROM duty_records dr
      JOIN provinces p ON p.id = dr.province_id
      WHERE p.slug = ${ilSlug}
        AND dr.duty_date >= resolve_active_duty_date() - 6
        AND dr.duty_date <= resolve_active_duty_date() + 1
      ORDER BY duty_date DESC
      LIMIT 7
    `);

    const payload = { dates: rows.map((r) => r.duty_date) };
    await cacheSet(cacheKey, payload, TTL_TARIHLER);
    return sendJson(res, 200, payload);
  } catch (err) {
    console.error("[tarihler]", ilSlug, err?.message ?? err);
    return sendJson(res, 200, { dates: [] });
  }
}
