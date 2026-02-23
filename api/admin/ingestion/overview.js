import { withDb } from "../../../_lib/db.js";
import { methodNotAllowed, requireAdmin, sendInternalError, sendJson } from "../../../_lib/http.js";
import { checkRateLimit } from "../../../_lib/security.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(req, res, ["GET"]);
  }
  if (!checkRateLimit(req, res)) {
    return;
  }
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const rows = await withDb((db) =>
      db`
        select
          p.slug as il,
          coalesce(sum(case when ir.status = 'success' then 1 else 0 end), 0)::int as success_count,
          coalesce(sum(case when ir.status = 'failed' then 1 else 0 end), 0)::int as failed_count,
          coalesce(sum(case when ir.status = 'partial' then 1 else 0 end), 0)::int as partial_count,
          max(ir.started_at) as last_run_at,
          coalesce((
            select count(*)::int
            from ingestion_alerts ia
            where ia.il_slug = p.slug
              and ia.resolved_at is null
          ), 0)::int as alert_count
        from provinces p
        left join ingestion_runs ir on ir.il_slug = p.slug
          and ir.started_at > now() - interval '24 hour'
        group by p.slug
        order by p.slug
      `
    );

    return sendJson(
      res,
      200,
      rows.map((row) => ({
        il: row.il,
        success_count: Number(row.success_count || 0),
        failed_count: Number(row.failed_count || 0),
        partial_count: Number(row.partial_count || 0),
        last_run_at: row.last_run_at ? new Date(row.last_run_at).toISOString() : null,
        alert_count: Number(row.alert_count || 0)
      }))
    );
  } catch (error) {
    return sendInternalError(res, error);
  }
}
