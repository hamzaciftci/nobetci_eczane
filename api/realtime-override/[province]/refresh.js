import { withDb } from "../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, sendJson } from "../../_lib/http.js";
import { ingestProvince } from "../../_lib/ingest.js";
import { cacheDel, dutyDistrictKey, dutyProvinceKey } from "../../_lib/cache.js";

export const config = { maxDuration: 20 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }

  const ilSlug = getSingleQueryValue(req.query.province).toLowerCase();
  const dutyDate = getSingleQueryValue(req.query.date) || null;

  if (!ilSlug) {
    return sendJson(res, 400, { error: "invalid_province" });
  }

  try {
    const result = await withDb(async (db) => {
      const provinceRows = await db`
        select slug
        from provinces
        where slug = ${ilSlug}
        limit 1
      `;
      if (!provinceRows.length) {
        throw new Error("province_not_found");
      }
      return ingestProvince(db, ilSlug);
    });

    await invalidateCache(ilSlug);

    return sendJson(res, 200, {
      refreshed: true,
      il: ilSlug,
      duty_date: dutyDate,
      status: result.status,
      found: result.found,
      upserted: result.upserted,
      elapsed_ms: result.elapsed_ms,
      ...(result.error ? { error: result.error } : {}),
      ...(result.errors ? { errors: result.errors } : {})
    });
  } catch (error) {
    if (error instanceof Error && error.message === "province_not_found") {
      return sendJson(res, 404, { error: "province_not_found" });
    }
    return sendJson(res, 500, { error: "internal_error", message: error instanceof Error ? error.message : "unknown" });
  }
}

async function invalidateCache(ilSlug) {
  const keys = [dutyProvinceKey(ilSlug)];
  // district-level keys pattern deletion is best-effort: use scan + del if needed in worker
  await cacheDel(keys);
}
