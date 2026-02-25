import { withDb } from "../../../_lib/db.js";
import { methodNotAllowed, requireAdmin, sendJson } from "../../../_lib/http.js";
import { checkRateLimit } from "../../../_lib/security.js";
import { resolveActiveDutyDate } from "../../../_lib/time.js";

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

  const dutyDate = resolveActiveDutyDate();

  try {
    const rows = await withDb((db) => db`
      with expected as (
        select province_id, count(*)::int as expected_count
        from districts
        group by province_id
      ),
      actual as (
        select province_id, count(distinct district_id)::int as actual_count, max(updated_at) as last_update
        from duty_records
        where duty_date = ${dutyDate}
        group by province_id
      )
      select
        p.slug as il,
        coalesce(a.actual_count, 0) as actual_count,
        coalesce(e.expected_count, 0) as expected_count,
        case
          when coalesce(e.expected_count, 0) = 0 then 0
          else round( (coalesce(a.actual_count,0)::decimal / e.expected_count) * 100 )
        end as confidence_pct,
        a.last_update
      from provinces p
      left join expected e on e.province_id = p.id
      left join actual a on a.province_id = p.id
      order by p.slug
    `);

    return sendJson(res, 200, rows.map((row) => ({
      il: row.il,
      expected_count: Number(row.expected_count || 0),
      actual_count: Number(row.actual_count || 0),
      confidence_pct: Number(row.confidence_pct || 0),
      last_update: row.last_update ? new Date(row.last_update).toISOString() : null
    })));
  } catch (error) {
    return sendJson(res, 500, { error: "internal_error", message: error instanceof Error ? error.message : "unknown" });
  }
}
