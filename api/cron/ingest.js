/**
 * Vercel Cron: hourly ingestion for all 81 provinces.
 *
 * Flow:
 * 1) Sync DB source_endpoints from code catalog (authoritative URLs/parser keys).
 * 2) Process all catalog provinces in bounded concurrent batches.
 * 3) Emit diff/health alerts to ingestion_alerts for observability.
 */

import { withDb } from "../_lib/db.js";
import { ingestProvince, withTimeout, PROVINCE_TIMEOUT_MS, BATCH_SIZE } from "../_lib/ingest.js";
import { sendJson } from "../_lib/http.js";
import { logAlert } from "../_lib/ingest/loggingLayer.js";
import { requireCronAuth } from "../_lib/cronAuth.js";
import {
  getCatalogProvinceSlugs,
  syncCatalogToDb,
  getCatalogValidationSnapshot
} from "../_lib/sourceCatalogSync.js";

// Vercel hobby plan hard limit
export const config = {
  maxDuration: 60
};

const CRON_TIME_BUDGET_MS = clampInt(process.env.CRON_TIME_BUDGET_MS, 55_000, 20_000, 58_000);
const RECOVERY_MAX_PASSES = clampInt(process.env.CRON_RECOVERY_MAX_PASSES, 3, 1, 8);
const RECOVERY_BATCH_SIZE = clampInt(process.env.CRON_RECOVERY_BATCH_SIZE, 8, 1, BATCH_SIZE);
const RETRIABLE_STATUSES = new Set([
  "failed",
  "partial",
  "fetch_error",
  "no_data",
  "parse_error",
  "error",
  "no_endpoint",
  "skipped_due_budget"
]);

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

  if (!requireCronAuth(req, res)) {
    return;
  }

  const startedAt = Date.now();
  const shardCountRaw = Number(req.query.shard_count ?? req.query.of ?? 1);
  const shardIndexRaw = Number(req.query.shard_index ?? req.query.shard ?? 0);
  const shardCount = Number.isInteger(shardCountRaw) && shardCountRaw > 0
    ? Math.min(shardCountRaw, 24)
    : 1;
  const shardIndex = Number.isInteger(shardIndexRaw) && shardIndexRaw >= 0
    ? shardIndexRaw
    : 0;
  if (shardIndex >= shardCount) {
    return sendJson(res, 400, {
      error: "invalid_shard",
      shard_index: shardIndex,
      shard_count: shardCount
    });
  }

  try {
    const catalogSlugs = getCatalogProvinceSlugs();
    const validation = getCatalogValidationSnapshot();

    const { syncSummary, results, processedSlugs, recovery } = await withDb(async (sql) => {
      const syncSummary = await syncCatalogToDb(sql);
      const missingSet = new Set(syncSummary.missing_provinces);
      const eligible = catalogSlugs.filter((slug) => !missingSet.has(slug));
      const slugs = eligible.filter((_, idx) => idx % shardCount === shardIndex);
      const finalBySlug = new Map();
      const attemptsBySlug = new Map();

      if (validation.hardIssues.length) {
        for (const issue of validation.hardIssues) {
          const issueSlug = extractIssueSlug(issue);
          if (!issueSlug) continue;
          await logAlert(sql, {
            ilSlug: issueSlug,
            endpointId: null,
            alertType: "source_catalog_invalid",
            severity: "high",
            message: issue
          });
        }
      }

      for (const slug of syncSummary.missing_provinces) {
        await logAlert(sql, {
          ilSlug: slug,
          endpointId: null,
          alertType: "province_missing_in_db",
          severity: "high",
          message: "province_row_missing_for_catalog_entry"
        });
      }

      const firstPass = await ingestSlugs(sql, slugs, {
        startedAt,
        deadlineMs: CRON_TIME_BUDGET_MS,
        batchSize: BATCH_SIZE
      });

      for (const result of firstPass.results) {
        mergeResult(finalBySlug, attemptsBySlug, result);
      }

      // Keep retrying failing/mismatched provinces in the same cron run
      // until we either converge or hit time budget / max pass limit.
      let retryQueue = dedupe([
        ...firstPass.remainingSlugs,
        ...collectRetrySlugs(firstPass.results)
      ]);
      const retryPasses = [];

      for (let pass = 1; pass <= RECOVERY_MAX_PASSES && retryQueue.length; pass++) {
        if (Date.now() - startedAt >= CRON_TIME_BUDGET_MS) break;

        const passInput = dedupe(retryQueue);
        const retryPass = await ingestSlugs(sql, passInput, {
          startedAt,
          deadlineMs: CRON_TIME_BUDGET_MS,
          batchSize: RECOVERY_BATCH_SIZE
        });

        const nextQueue = [...retryPass.remainingSlugs];
        let recoveredCount = 0;
        let stillFailingCount = 0;

        for (const result of retryPass.results) {
          const slug = String(result?.il || "").toLowerCase();
          if (!slug) continue;

          const previous = finalBySlug.get(slug);
          const wasFailing = needsRecovery(previous);

          mergeResult(finalBySlug, attemptsBySlug, result);

          const nowFailing = needsRecovery(result);
          if (wasFailing && !nowFailing) {
            recoveredCount += 1;
          }
          if (nowFailing) {
            stillFailingCount += 1;
            nextQueue.push(slug);
          }
        }

        retryQueue = dedupe(nextQueue);
        retryPasses.push({
          pass,
          requested: passInput.length,
          processed: retryPass.results.length,
          recovered: recoveredCount,
          still_failing: retryQueue.length,
          elapsed_ms: Date.now() - startedAt
        });
      }

      const unresolved = dedupe(retryQueue);
      for (const slug of unresolved) {
        const latest = finalBySlug.get(slug);
        await logAlert(sql, {
          ilSlug: slug,
          endpointId: null,
          alertType: "recovery_still_failing",
          severity: "high",
          message: buildRecoveryMessage(latest),
          payload: {
            attempts: attemptsBySlug.get(slug) ?? 0,
            status: latest?.status ?? "unknown",
            verification: latest?.verification ?? null
          }
        });
      }

      // If budget is exhausted before touching some provinces, mark explicitly.
      for (const slug of slugs) {
        if (!finalBySlug.has(slug)) {
          finalBySlug.set(slug, {
            status: "skipped_due_budget",
            il: slug,
            error: `cron_time_budget_exceeded:${CRON_TIME_BUDGET_MS}ms`
          });
          attemptsBySlug.set(slug, attemptsBySlug.get(slug) ?? 0);
        }
      }

      const finalResults = slugs.map((slug) => finalBySlug.get(slug));

      return {
        syncSummary,
        results: finalResults,
        processedSlugs: slugs,
        recovery: {
          enabled: true,
          time_budget_ms: CRON_TIME_BUDGET_MS,
          max_passes: RECOVERY_MAX_PASSES,
          retry_batch_size: RECOVERY_BATCH_SIZE,
          executed_passes: retryPasses.length,
          unresolved: unresolved.length,
          passes: retryPasses
        }
      };
    });

    const summary = {
      total:      results.length,
      success:    results.filter(r => r.status === "success").length,
      partial:    results.filter(r => r.status === "partial").length,
      failed:     results.filter(r => [
        "failed",
        "fetch_error",
        "no_data",
        "parse_error",
        "error",
        "no_endpoint",
        "skipped_due_budget"
      ].includes(r.status)).length,
      verification_diff: results.filter((r) => hasVerificationDiff(r)).length,
      catalog_total: catalogSlugs.length,
      catalog_processed: processedSlugs.length,
      shard_count: shardCount,
      shard_index: shardIndex,
      catalog_validation_issues: validation.issues.length,
      catalog_hard_issues: validation.hardIssues.length,
      catalog_sync: syncSummary,
      recovery,
      elapsed_ms: Date.now() - startedAt,
      results
    };

    console.log(
      `[cron/ingest] done: ${summary.success} ok, ${summary.partial} partial, ${summary.failed} failed,` +
      ` ${summary.verification_diff} diff of ${summary.total} provinces in ${summary.elapsed_ms}ms` +
      ` (recovery passes=${summary.recovery?.executed_passes ?? 0}, unresolved=${summary.recovery?.unresolved ?? 0})`
    );

    return sendJson(res, 200, summary);
  } catch (err) {
    // SEC-007: Detaylı hata mesajı sadece log'a — response'da internal bilgi sızdırılmaz.
    console.error("[cron/ingest] fatal:", err);
    return sendJson(res, 500, { error: "internal_error", message: "An unexpected error occurred." });
  }
}

function extractIssueSlug(issue) {
  const parts = String(issue || "").split(":");
  const slug = parts[1] ? parts[1].toLowerCase() : "";
  return slug || null;
}

async function ingestSlugs(sql, slugs, { startedAt, deadlineMs, batchSize }) {
  const allResults = [];
  let processed = 0;

  for (let i = 0; i < slugs.length; i += batchSize) {
    if (Date.now() - startedAt >= deadlineMs) {
      break;
    }

    const batch = slugs.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((slug) => withTimeout(ingestProvince(sql, slug), PROVINCE_TIMEOUT_MS, slug))
    );

    for (let j = 0; j < batch.length; j++) {
      const slug = batch[j];
      const settledResult = settled[j];
      const result =
        settledResult.status === "fulfilled"
          ? settledResult.value
          : { status: "error", il: slug, error: settledResult.reason?.message ?? "unknown" };

      allResults.push(result);
      processed += 1;

      if (settledResult.status !== "fulfilled") {
        await logAlert(sql, {
          ilSlug: slug,
          endpointId: null,
          alertType: "timeout",
          severity: "high",
          message: settledResult.reason?.message ?? "province_timeout"
        });
      }
    }
  }

  return {
    results: allResults,
    processed,
    remainingSlugs: slugs.slice(processed)
  };
}

function mergeResult(finalBySlug, attemptsBySlug, result) {
  const slug = String(result?.il || "").toLowerCase();
  if (!slug) return;
  finalBySlug.set(slug, result);
  attemptsBySlug.set(slug, (attemptsBySlug.get(slug) ?? 0) + 1);
}

function collectRetrySlugs(results) {
  const slugs = [];
  for (const result of results || []) {
    const slug = String(result?.il || "").toLowerCase();
    if (!slug) continue;
    if (needsRecovery(result)) {
      slugs.push(slug);
    }
  }
  return dedupe(slugs);
}

function needsRecovery(result) {
  if (!result) return true;
  if (RETRIABLE_STATUSES.has(String(result.status || "").toLowerCase())) {
    return true;
  }
  return hasVerificationDiff(result);
}

function hasVerificationDiff(result) {
  const v = result?.verification;
  if (!v) return false;
  return (
    Number(v.missing_count || 0) > 0 ||
    Number(v.extra_count || 0) > 0 ||
    Number(v.mismatch_count || 0) > 0
  );
}

function buildRecoveryMessage(result) {
  if (!result) {
    return "recovery_unresolved:unknown";
  }
  if (hasVerificationDiff(result)) {
    const v = result.verification;
    return `recovery_unresolved_diff:missing=${v.missing_count || 0},extra=${v.extra_count || 0},mismatch=${v.mismatch_count || 0}`;
  }
  return `recovery_unresolved_status:${result.status || "unknown"}`;
}

function dedupe(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function clampInt(raw, fallback, min, max) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
