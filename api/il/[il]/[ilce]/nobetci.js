import { buildDutyResponse } from "../../../_lib/duty.js";
import { withDb } from "../../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendJson } from "../../../_lib/http.js";
import { queryDutyFallback, queryDutyForDate, degradedPayload, isViewMissing } from "../../../_lib/fallback.js";
import { resolveActiveDutyDate } from "../../../_lib/time.js";
import {
  cacheGet, cacheSet, dutyDistrictKey, dutyDistrictDateKey,
  TTL_DEGRADED_SECONDS, TTL_HISTORICAL_SECONDS
} from "../../../_lib/cache.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const ilSlug = getSingleQueryValue(req.query.il).toLowerCase();
  const ilceSlug = getSingleQueryValue(req.query.ilce).toLowerCase();

  if (!ilSlug || !ilceSlug) {
    return sendJson(res, 400, { error: "invalid_il_or_ilce" });
  }

  const tarih = getSingleQueryValue(req.query.tarih || "").trim() || null;
  const TODAY = resolveActiveDutyDate();

  res.setHeader("Cache-Control", "no-store");

  if (tarih && tarih !== TODAY) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
      return sendJson(res, 400, { error: "invalid_tarih" });
    }
    const cacheKey = dutyDistrictDateKey(ilSlug, ilceSlug, tarih);
    try {
      const cached = await cacheGet(cacheKey);
      if (cached) return sendJson(res, 200, cached);

      const rows = await withDb((db) => queryDutyForDate(db, { ilSlug, ilceSlug, date: tarih }));
      const payload = buildDutyResponse(rows, tarih);
      await cacheSet(cacheKey, payload, TTL_HISTORICAL_SECONDS);
      return sendJson(res, 200, payload);
    } catch (err) {
      console.error("[duty/district/tarih]", ilSlug, ilceSlug, tarih, err?.message ?? err);
      return sendJson(res, 200, degradedPayload("Nöbet verisi şu an alınamıyor."));
    }
  }

  const cacheKey = dutyDistrictKey(ilSlug, ilceSlug);

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return sendJson(res, 200, cached);
    }

    const { rows, dutyDate, stale, lastSuccessfulDate } = await withDb(async (db) => {
      // 1. Try canonical VIEW
      try {
        const viewRows = await db`
          select v.*
          from api_active_duty v
          where v.il_slug = ${ilSlug}
            and v.ilce_slug = ${ilceSlug}
          order by v.eczane_adi
        `;
        if (viewRows.length) {
          return { rows: viewRows, dutyDate: resolveActiveDutyDate(), stale: false, lastSuccessfulDate: resolveActiveDutyDate() };
        }
      } catch (err) {
        if (!isViewMissing(err)) throw err;
      }

      // 2. VIEW missing or empty → fallback to duty_records
      try {
        return await queryDutyFallback(db, { ilSlug, ilceSlug });
      } catch {
        return { rows: [], dutyDate: resolveActiveDutyDate(), stale: true, lastSuccessfulDate: null };
      }
    });

    const payload = buildDutyResponse(rows, dutyDate);
    const isDegraded = stale || dutyDate !== resolveActiveDutyDate();
    if (isDegraded) {
      payload.status = "degraded";
      payload.degraded_info = {
        last_successful_update: lastSuccessfulDate ?? dutyDate ?? null,
        stale_minutes: null,
        recent_alert: null,
        hint: rows.length
          ? "Güncel kayıt bulunamadı; son mevcut nöbet listesi gösteriliyor."
          : "Bu ilçe için bugün nöbet kaydı bulunamadı."
      };
    }
    await cacheSet(cacheKey, payload, isDegraded ? TTL_DEGRADED_SECONDS : undefined);
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error("[duty/district]", ilSlug, ilceSlug, error?.message ?? error);
    return sendJson(res, 200, degradedPayload("Nöbet verisi şu an alınamıyor. Lütfen daha sonra tekrar deneyin."));
  }
}
