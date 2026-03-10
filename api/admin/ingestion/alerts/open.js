import { withDb } from "../../../../_lib/db.js";
import { methodNotAllowed, requireAdmin, sendInternalError, sendJson } from "../../../../_lib/http.js";
import { checkRateLimit } from "../../../../_lib/security.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }
  if (!await checkRateLimit(req, res)) {
    return;
  }
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const rows = await withDb((db) =>
      db`
        select
          ia.id,
          p.slug as il,
          ia.source_endpoint_id,
          ia.alert_type,
          ia.severity,
          ia.message,
          ia.payload,
          ia.created_at
        from ingestion_alerts ia
        join provinces p on p.id = ia.province_id
        where ia.resolved_at is null
        order by ia.created_at desc
        limit 200
      `
    );

    return sendJson(
      res,
      200,
      rows.map((row) => ({
        id: Number(row.id),
        il: row.il,
        source_endpoint_id: row.source_endpoint_id === null ? null : Number(row.source_endpoint_id),
        alert_type: row.alert_type,
        severity: row.severity,
        message: row.message,
        payload: row.payload ?? null,
        created_at: new Date(row.created_at).toISOString()
      }))
    );
  } catch (error) {
    return sendInternalError(res, error);
  }
}
