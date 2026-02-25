import { buildDutyResponse } from "../../_lib/duty.js";
import { withDb } from "../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendInternalError, sendJson } from "../../_lib/http.js";
import { queryDutyFallback, degradedPayload, isViewMissing } from "../../_lib/fallback.js";
import { resolveActiveDutyDate } from "../../_lib/time.js";
import { cacheGet, cacheSet, dutyProvinceKey } from "../../_lib/cache.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }

  const ilSlug = getSingleQueryValue(req.query.il).toLowerCase();
  if (!ilSlug) {
    return sendJson(res, 400, { error: "invalid_il" });
  }

  const cacheKey = dutyProvinceKey(ilSlug);

  try {
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return sendJson(res, 200, cached);
    }

    const { rows, dutyDate, stale, lastSuccessfulDate } = await withDb(async (db) => {
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
        if (isViewMissing(err)) {
          return await queryDutyFallback(db, { ilSlug });
        }
        throw err;
      }
      return await queryDutyFallback(db, { ilSlug });
    });

    const payload = buildDutyResponse(rows, dutyDate);
    if (stale || dutyDate !== resolveActiveDutyDate()) {
      payload.status = "degraded";
      payload.degraded_info = {
        last_successful_update: lastSuccessfulDate ?? dutyDate ?? null,
        stale_minutes: null,
        recent_alert: null,
        hint: "Güncel kayıt bulunamadı; son mevcut nöbet listesi gösteriliyor."
      };
    }
    await cacheSet(cacheKey, payload);
    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 503, degradedPayload("Veritabanı erişilemiyor veya veri görünümü hazır değil."));
  }
}
