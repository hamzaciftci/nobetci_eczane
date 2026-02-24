/**
 * Vercel Cron: ingest duty pharmacies for all 81 provinces.
 *
 * Called once daily by vercel.json cron schedule.
 * Processes all provinces concurrently (Promise.allSettled) with per-province
 * timeouts handled inside ingestProvince itself.
 *
 * Auth: protected by CRON_SECRET header (set in Vercel env vars).
 */

import { withDb } from "../_lib/db.js";
import { ingestProvince } from "../_lib/ingest.js";
import { sendJson } from "../_lib/http.js";

export const config = {
  maxDuration: 60 // seconds (Vercel hobby max)
};

export default async function handler(req, res) {
  // Reject non-GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  // Verify Vercel cron secret (Vercel injects Authorization header automatically)
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (cronSecret) {
    const authHeader = String(req.headers["authorization"] || "");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return sendJson(res, 401, { error: "unauthorized" });
    }
  }

  const startedAt = Date.now();

  try {
    // Get all province slugs that have a primary enabled endpoint
    const provinces = await withDb((sql) => sql`
      SELECT DISTINCT p.slug
      FROM source_endpoints se
      JOIN sources   s ON s.id = se.source_id
      JOIN provinces p ON p.id = s.province_id
      WHERE se.is_primary = true
        AND se.enabled    = true
      ORDER BY p.slug
    `);

    const slugs = provinces.map(r => r.slug);

    // Run all provinces concurrently; collect results
    const results = await withDb(async (sql) => {
      const settled = await Promise.allSettled(
        slugs.map(slug => ingestProvince(sql, slug))
      );

      return settled.map((s, i) =>
        s.status === "fulfilled"
          ? s.value
          : { status: "error", il: slugs[i], error: s.reason?.message ?? "unknown" }
      );
    });

    const summary = {
      total:     results.length,
      success:   results.filter(r => r.status === "success").length,
      partial:   results.filter(r => r.status === "partial").length,
      failed:    results.filter(r => ["failed", "fetch_error", "no_data", "parse_error", "error", "no_endpoint"].includes(r.status)).length,
      elapsed_ms: Date.now() - startedAt,
      results
    };

    console.log(
      `[cron/ingest] done: ${summary.success} ok, ${summary.partial} partial,` +
      ` ${summary.failed} failed of ${summary.total} provinces in ${summary.elapsed_ms}ms`
    );

    return sendJson(res, 200, summary);
  } catch (err) {
    console.error("[cron/ingest] fatal:", err);
    return sendJson(res, 500, { error: "internal_error", message: err.message });
  }
}
