import { buildDutyResponse } from "../../_lib/duty.js";
import { withDb } from "../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendJson } from "../../_lib/http.js";
import { queryDutyFallback, queryDutyForDate, degradedPayload, isViewMissing } from "../../_lib/fallback.js";
import { resolveActiveDutyDate } from "../../_lib/time.js";
import {
  cacheGet, cacheSet, dutyProvinceKey, dutyProvinceDateKey,
  TTL_DEGRADED_SECONDS, TTL_HISTORICAL_SECONDS
} from "../../_lib/cache.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const ilSlug = getSingleQueryValue(req.query.il).toLowerCase();
  if (!ilSlug) {
    return sendJson(res, 400, { error: "invalid_il" });
  }

  const tarih = getSingleQueryValue(req.query.tarih || "").trim() || null;
  const TODAY = resolveActiveDutyDate();

  res.setHeader("Cache-Control", "no-store");

  // Geçmiş / gelecek tarih sorgusu: view bypass → duty_records doğrudan
  if (tarih && tarih !== TODAY) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
      return sendJson(res, 400, { error: "invalid_tarih" });
    }
    const cacheKey = dutyProvinceDateKey(ilSlug, tarih);
    try {
      const cached = await cacheGet(cacheKey);
      if (cached) return sendJson(res, 200, cached);

      const rows = await withDb((db) => queryDutyForDate(db, { ilSlug, date: tarih }));
      const payload = buildDutyResponse(rows, tarih);
      await cacheSet(cacheKey, payload, TTL_HISTORICAL_SECONDS);
      return sendJson(res, 200, payload);
    } catch (err) {
      console.error("[duty/province/tarih]", ilSlug, tarih, err?.message ?? err);
      return sendJson(res, 200, degradedPayload("Nöbet verisi şu an alınamıyor."));
    }
  }

  const cacheKey = dutyProvinceKey(ilSlug);

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
          order by v.ilce, v.eczane_adi
        `;
        if (viewRows.length) {
          return { rows: viewRows, dutyDate: resolveActiveDutyDate(), stale: false, lastSuccessfulDate: resolveActiveDutyDate() };
        }
      } catch (err) {
        if (!isViewMissing(err)) throw err;
      }

      // 2. VIEW missing or empty → fallback to duty_records
      try {
        return await queryDutyFallback(db, { ilSlug });
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
          : "Bu il için bugün nöbet kaydı bulunamadı."
      };
    }
    // Degraded yanıt uzun süre önbelleklenmemeli: 30 sn TTL ile sık DB sorgusu
    // yapılır ve cron verisi geldiğinde 30 sn içinde görünür hale gelir.
    // Normal (ok) yanıt: 10 dakika önbelleklenir.
    await cacheSet(cacheKey, payload, isDegraded ? TTL_DEGRADED_SECONDS : undefined);
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error("[duty/province]", ilSlug, error?.message ?? error);
    return sendJson(res, 200, degradedPayload("Nöbet verisi şu an alınamıyor. Lütfen daha sonra tekrar deneyin."));
  }
}
