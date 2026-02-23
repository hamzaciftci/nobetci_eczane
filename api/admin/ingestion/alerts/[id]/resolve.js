import { withDb } from "../../../../../_lib/db.js";
import { getSingleQueryValue, methodNotAllowed, parseJsonBody, requireAdmin, sendInternalError, sendJson } from "../../../../../_lib/http.js";
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

  const alertId = Number(getSingleQueryValue(req.query.id));
  if (!Number.isInteger(alertId) || alertId <= 0) {
    return sendJson(res, 400, { error: "invalid_alert_id" });
  }

  const body = await parseJsonBody(req);
  const resolvedBy = String(body.resolved_by || "admin").slice(0, 64);

  try {
    const rows = await withDb((db) =>
      db`
        update ingestion_alerts
        set
          resolved_at = now(),
          payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('resolved_by', ${resolvedBy})
        where id = ${alertId}
          and resolved_at is null
        returning id
      `
    );

    return sendJson(res, 200, {
      resolved: rows.length > 0,
      id: alertId
    });
  } catch (error) {
    return sendInternalError(res, error);
  }
}
