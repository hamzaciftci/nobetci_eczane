import { withDb } from "../../../../../_lib/db.js";
import { ingestProvince } from "../../../../../_lib/ingest.js";
import { getSingleQueryValue, methodNotAllowed, requireAdmin, sendInternalError, sendJson } from "../../../../../_lib/http.js";
import { checkRateLimit } from "../../../../../_lib/security.js";
import { cacheDel, dutyProvinceKey } from "../../../../../_lib/cache.js";
import { syncCatalogToDb } from "../../../../../_lib/sourceCatalogSync.js";
import { resolveActiveDutyDate } from "../../../../../_lib/time.js";
import { logAdminAction } from "../../../../../_lib/adminAudit.js";

// Recovery ingestion can take up to 30 seconds for slow province endpoints
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }
  if (!await checkRateLimit(req, res)) {
    return;
  }
  if (!requireAdmin(req, res)) {
    return;
  }

  const ilSlug = getSingleQueryValue(req.query.il).toLowerCase();
  if (!ilSlug) {
    return sendJson(res, 400, { error: "invalid_il" });
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

      await syncCatalogToDb(db, { provinceSlugs: [ilSlug] });

      // Run real ingestion for this province
      return await ingestProvince(db, ilSlug);
    });

    await invalidateCache(ilSlug);

    // Audit log — başarılı recovery
    await withDb((db) =>
      logAdminAction(db, req, {
        action:       "ingestion.recovery_trigger",
        resourceType: "province",
        resourceId:   ilSlug,
        payload:      { status: result.status, found: result.found, upserted: result.upserted },
      })
    );

    return sendJson(res, 200, {
      queued: false,
      recovered: true,
      il: ilSlug,
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
    return sendInternalError(res, error);
  }
}

async function invalidateCache(ilSlug) {
  await cacheDel([dutyProvinceKey(ilSlug, resolveActiveDutyDate())]);
}
