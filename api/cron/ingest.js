/**
 * Vercel Cron: ingest duty pharmacies for all 81 provinces.
 *
 * Called once daily by vercel.json cron schedule.
 * Processes provinces in batches of BATCH_SIZE concurrently so we stay
 * well within the 60-second Vercel function limit:
 *   ceil(81 / 25) = 4 batches × 11 s hard timeout ≈ 44 s worst-case.
 *
 * Each province also gets an 11-second hard timeout (separate from the
 * 12-second HTTP fetch timeout inside ingestProvince) so a hung DB call
 * cannot stall an entire batch.
 *
 * Auth: protected by CRON_SECRET header (set in Vercel env vars).
 */

import { withDb } from "../_lib/db.js";
import { ingestProvince, withTimeout, PROVINCE_TIMEOUT_MS, BATCH_SIZE } from "../_lib/ingest.js";
import { sendJson } from "../_lib/http.js";
import { logAlert } from "../_lib/ingest/loggingLayer.js";

// Vercel hobby plan hard limit
export const config = {
  maxDuration: 60
};

/**
 * Wraps a promise with a hard timeout.  If the promise does not settle
 * within `ms` milliseconds it rejects with a timeout error.
 */

export default async function handler(req, res) {
  // Reject non-GET
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "method_not_allowed" });
  }

  // Verify Vercel cron secret (mandatory)
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret) {
    return sendJson(res, 401, { error: "missing_cron_secret" });
  }
  const authHeader = String(req.headers["authorization"] || "");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return sendJson(res, 401, { error: "unauthorized" });
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

    // Chunk slugs into batches and process each batch concurrently.
    // Sequential batches ensure we never have more than BATCH_SIZE
    // simultaneous DB connections, and the total wall-clock time stays
    // safely under the 60-second Vercel limit.
    const results = await withDb(async (sql) => {
      const allResults = [];

      for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
        const batch = slugs.slice(i, i + BATCH_SIZE);

        const settled = await Promise.allSettled(
          batch.map(slug =>
            withTimeout(ingestProvince(sql, slug), PROVINCE_TIMEOUT_MS, slug)
          )
        );

        for (let j = 0; j < batch.length; j++) {
          const s = settled[j];
          allResults.push(
            s.status === "fulfilled"
              ? s.value
              : { status: "error", il: batch[j], error: s.reason?.message ?? "unknown" }
          );
          if (s.status !== "fulfilled") {
            await logAlert(sql, {
              ilSlug: batch[j],
              endpointId: null,
              alertType: "timeout",
              severity: "high",
              message: s.reason?.message ?? "province_timeout"
            });
          }
        }
      }

      return allResults;
    });

    const summary = {
      total:      results.length,
      success:    results.filter(r => r.status === "success").length,
      partial:    results.filter(r => r.status === "partial").length,
      failed:     results.filter(r => ["failed", "fetch_error", "no_data", "parse_error", "error", "no_endpoint"].includes(r.status)).length,
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
