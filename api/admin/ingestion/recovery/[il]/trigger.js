import { withDb } from "../../../../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, requireAdmin, sendInternalError, sendJson } from "../../../../../_lib/http.js";
import { checkRateLimit } from "../../../../../_lib/security.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(req, res, ["POST"]);
  }
  if (!checkRateLimit(req, res)) {
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

      await db`
        insert into ingestion_runs (il_slug, status)
        values (${ilSlug}, 'partial')
      `;

      const jobId = `recovery:${ilSlug}:${Date.now()}`;
      return { queued: true, jobId };
    });

    return sendJson(res, 200, result);
  } catch (error) {
    if (error instanceof Error && error.message === "province_not_found") {
      return sendJson(res, 404, { error: "province_not_found" });
    }
    return sendInternalError(res, error);
  }
}
