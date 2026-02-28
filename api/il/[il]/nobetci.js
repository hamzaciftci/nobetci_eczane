import { buildDutyResponse } from "../../_lib/duty.js";
import { withDb } from "../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendJson } from "../../_lib/http.js";
import { queryDutyFallback, degradedPayload, isViewMissing } from "../../_lib/fallback.js";
import { resolveActiveDutyDate } from "../../_lib/time.js";
import { cacheGet, cacheSet, dutyProvinceKey, TTL_DEGRADED_SECONDS } from "../../_lib/cache.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const ilSlug = getSingleQueryValue(req.query.il).toLowerCase();
  if (!ilSlug) {
    return sendJson(res, 400, { error: "invalid_il" });
  }

  const cacheKey = dutyProvinceKey(ilSlug);

  // Vercel edge / CDN katmanının bu yanıtı önbelleğe almasını engelle.
  res.setHeader("Cache-Control", "no-store");

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
