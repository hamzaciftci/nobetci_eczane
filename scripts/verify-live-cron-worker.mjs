#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const reportsDir = path.join(repoRoot, "reports");

await loadEnvFile(path.join(repoRoot, ".env"));

const API_BASE_URL = trimSlash(process.env.VERIFY_API_BASE_URL ?? "https://nobetci-eczane-api-ten.vercel.app");
const WEB_BASE_URL = trimSlash(process.env.VERIFY_WEB_BASE_URL ?? "https://nobetci-eczane-tau.vercel.app");
const TEST_PROVINCE = String(process.env.VERIFY_PROVINCE ?? "osmaniye").trim().toLowerCase();
const CRON_SECRET = clean(process.env.CRON_SECRET) ?? "";
const ADMIN_TOKEN = clean(process.env.ADMIN_API_TOKEN) ?? "";
const DB_URL = clean(process.env.APP_DATABASE_URL) ?? clean(process.env.DATABASE_URL) ?? "";
const WAIT_TIMEOUT_MS = clampInt(process.env.VERIFY_WAIT_TIMEOUT_MS, 90000, 20000, 300000);
const POLL_INTERVAL_MS = clampInt(process.env.VERIFY_POLL_INTERVAL_MS, 5000, 1000, 10000);
const INCLUDE_FULL_SYNC_PING = process.env.VERIFY_INCLUDE_FULL_SYNC === "1";

const report = {
  meta: {
    startedAt: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    webBaseUrl: WEB_BASE_URL,
    province: TEST_PROVINCE,
    waitTimeoutMs: WAIT_TIMEOUT_MS,
    pollIntervalMs: POLL_INTERVAL_MS
  },
  checks: [],
  trigger: {
    cronValidate: null,
    realtimeOverride: null,
    cronFullSync: null
  },
  before: null,
  after: null,
  db: null,
  summary: {
    ok: false,
    refreshObserved: false,
    reason: ""
  }
};

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  report.summary.ok = false;
  report.summary.reason = message;
  await writeReport();
  console.error(`[verify-live] FAILED: ${message}`);
  process.exit(1);
});

async function main() {
  await pushCheck("api_health", async () =>
    fetchFirstJson([`${API_BASE_URL}/health`, `${API_BASE_URL}/api/health`, `${API_BASE_URL}/api/health/ready`])
  );
  await pushCheck("api_ready", async () =>
    fetchFirstJson([`${API_BASE_URL}/health/ready`, `${API_BASE_URL}/api/health/ready`])
  );
  await pushCheck("api_provinces", async () => fetchJson(`${API_BASE_URL}/api/iller`));
  await pushCheck("web_home", async () => fetchText(`${WEB_BASE_URL}/`));

  const beforeDuty = await fetchDuty(TEST_PROVINCE);
  report.before = snapshotDuty(beforeDuty);

  const cronValidate = await triggerCronValidate(TEST_PROVINCE);
  report.trigger.cronValidate = cronValidate;

  const realtimeOverride = await triggerRealtimeOverride(TEST_PROVINCE, resolveDutyDate(beforeDuty));
  report.trigger.realtimeOverride = realtimeOverride;

  if (INCLUDE_FULL_SYNC_PING) {
    report.trigger.cronFullSync = await triggerCronFullSync();
  }

  const hasAnyAcceptedTrigger = [report.trigger.cronValidate, report.trigger.realtimeOverride, report.trigger.cronFullSync]
    .filter(Boolean)
    .some((entry) => entry.ok === true);

  const refreshed = hasAnyAcceptedTrigger
    ? await waitForUpdate(TEST_PROVINCE, report.before?.son_guncelleme ?? null)
    : {
        updated: false,
        snapshot: report.before
      };
  report.after = refreshed.snapshot;
  report.summary.refreshObserved = refreshed.updated;

  if (DB_URL) {
    try {
      report.db = await probeDb(TEST_PROVINCE, refreshed.snapshot?.duty_date ?? resolveDutyDate(beforeDuty));
    } catch (error) {
      report.db = {
        skipped: true,
        reason: `DB probe failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  } else {
    report.db = {
      skipped: true,
      reason: "DATABASE_URL not set in local env"
    };
  }

  const hasTriggerSuccess = [cronValidate, realtimeOverride, report.trigger.cronFullSync]
    .filter(Boolean)
    .some((entry) => entry.ok === true);
  const triggerStatuses = [cronValidate, realtimeOverride, report.trigger.cronFullSync]
    .filter(Boolean)
    .map((entry) => entry.status);
  const hasMissingRoute = triggerStatuses.includes(404);

  if (hasMissingRoute) {
    report.summary.ok = false;
    report.summary.reason = "Trigger routes are missing on live API (404). Deploy latest API commit to Vercel.";
  } else if (!hasTriggerSuccess) {
    report.summary.ok = false;
    report.summary.reason = "No trigger endpoint accepted request (cron/admin token required).";
  } else if (!refreshed.updated) {
    report.summary.ok = false;
    report.summary.reason = "Trigger accepted but son_guncelleme did not change within timeout; worker may be down.";
  } else {
    report.summary.ok = true;
    report.summary.reason = "Cron/override trigger accepted and duty data refreshed.";
  }

  report.meta.finishedAt = new Date().toISOString();
  await writeReport();

  if (!report.summary.ok) {
    console.error(`[verify-live] FAILED: ${report.summary.reason}`);
    process.exit(1);
  }

  console.log("[verify-live] PASS");
}

async function triggerCronValidate(provinceSlug) {
  const url = `${API_BASE_URL}/api/cron/validate/${encodeURIComponent(provinceSlug)}`;
  return triggerWithToken("cron_validate", url);
}

async function triggerCronFullSync() {
  const url = `${API_BASE_URL}/api/cron/full-sync`;
  return triggerWithToken("cron_full_sync", url);
}

async function triggerRealtimeOverride(provinceSlug, dutyDate) {
  const url =
    `${API_BASE_URL}/api/realtime-override/${encodeURIComponent(provinceSlug)}/refresh` +
    `?date=${encodeURIComponent(dutyDate)}`;

  const headers = {
    ...(ADMIN_TOKEN ? { "x-admin-token": ADMIN_TOKEN } : {})
  };

  const response = await fetch(url, {
    method: "POST",
    headers
  });

  const bodyText = await response.text();
  const ok = response.ok;
  const blocked = response.status === 401 || response.status === 403;
  const result = {
    name: "realtime_override",
    ok,
    status: response.status,
    blockedByAuth: blocked,
    body: tryParseJson(bodyText)
  };

  return result;
}

async function triggerWithToken(name, url) {
  const headers = {};
  if (CRON_SECRET) {
    headers["x-cron-token"] = CRON_SECRET;
    headers.authorization = `Bearer ${CRON_SECRET}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers
  });
  const bodyText = await response.text();
  const ok = response.ok;
  const blocked = response.status === 401 || response.status === 403;
  const result = {
    name,
    ok,
    status: response.status,
    blockedByAuth: blocked,
    body: tryParseJson(bodyText)
  };

  return result;
}

async function waitForUpdate(provinceSlug, beforeIso) {
  const beforeTs = beforeIso ? new Date(beforeIso).getTime() : 0;
  const started = Date.now();
  let latestSnapshot = null;

  while (Date.now() - started <= WAIT_TIMEOUT_MS) {
    const duty = await fetchDuty(provinceSlug);
    latestSnapshot = snapshotDuty(duty);
    const latestTs = latestSnapshot?.son_guncelleme ? new Date(latestSnapshot.son_guncelleme).getTime() : 0;
    if (latestTs > beforeTs) {
      return {
        updated: true,
        snapshot: latestSnapshot
      };
    }
    await sleep(POLL_INTERVAL_MS);
  }

  return {
    updated: false,
    snapshot: latestSnapshot
  };
}

async function fetchDuty(provinceSlug) {
  return fetchJson(`${API_BASE_URL}/api/il/${encodeURIComponent(provinceSlug)}/nobetci`);
}

function snapshotDuty(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const dutyDate = resolveDutyDate(payload);
  return {
    status: payload?.status ?? "unknown",
    duty_date: dutyDate,
    son_guncelleme: payload?.son_guncelleme ?? null,
    count: data.length
  };
}

async function probeDb(provinceSlug, dutyDate) {
  let pg;
  try {
    pg = await import("pg");
  } catch {
    try {
      pg = await import(pathToFileURL(path.join(repoRoot, "apps", "api", "node_modules", "pg", "lib", "index.js")).href);
    } catch {
      return {
        skipped: true,
        reason: "pg module is not available for direct DB probe"
      };
    }
  }

  const PgClient = pg.Client ?? pg.default?.Client;
  if (!PgClient) {
    return {
      skipped: true,
      reason: "pg client constructor not found"
    };
  }

  const client = new PgClient({
    connectionString: DB_URL,
    ssl: DB_URL.includes("sslmode=require")
      ? {
          rejectUnauthorized: false
        }
      : undefined
  });

  await client.connect();
  try {
    const rows = await client.query(
      `
      select
        (select max(ir.started_at)::text
         from ingestion_runs ir
         join source_endpoints se on se.id = ir.source_endpoint_id
         join sources s on s.id = se.source_id
         join provinces p on p.id = s.province_id
         where p.slug = $1
           and ir.started_at > now() - interval '45 minute') as last_ingestion_run,
        (select max(updated_at)::text
         from duty_pharmacies
         where province_slug = $1
           and duty_date = $2::date) as last_hybrid_snapshot_update,
        (select count(*)::int
         from ingestion_retry_queue
         where province_slug = $1
           and status = 'pending') as pending_retry_jobs
      `,
      [provinceSlug, dutyDate]
    );

    return {
      skipped: false,
      ...rows.rows[0]
    };
  } finally {
    await client.end();
  }
}

async function pushCheck(name, fn) {
  const started = Date.now();
  try {
    const payload = await fn();
    report.checks.push({
      name,
      ok: true,
      elapsedMs: Date.now() - started
    });
    return payload;
  } catch (error) {
    report.checks.push({
      name,
      ok: false,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      pragma: "no-cache",
      "cache-control": "no-cache, no-store, max-age=0"
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}`);
  }
  return response.json();
}

async function fetchFirstJson(urls) {
  let lastError = null;
  for (const url of urls) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("No URL candidates provided");
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}`);
  }
  return response.text();
}

async function writeReport() {
  await mkdir(reportsDir, { recursive: true });
  const stamp = toStamp(new Date());
  const pathByTime = path.join(reportsDir, `verify-live-${stamp}.json`);
  const latest = path.join(reportsDir, "verify-live-latest.json");
  const content = JSON.stringify(report, null, 2);
  await writeFile(pathByTime, content, "utf8");
  await writeFile(latest, content, "utf8");
  console.log(`[verify-live] report: ${pathByTime}`);
}

function trimSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

function clean(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const out = String(value).trim();
  return out.length ? out : undefined;
}

function clampInt(raw, fallback, min, max) {
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(num)));
}

function toStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveDutyDate(payload) {
  if (typeof payload?.duty_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.duty_date)) {
    return payload.duty_date;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const cleaned = line.trim();
      if (!cleaned || cleaned.startsWith("#")) {
        continue;
      }
      const idx = cleaned.indexOf("=");
      if (idx <= 0) {
        continue;
      }
      const key = cleaned.slice(0, idx).trim();
      let value = cleaned.slice(idx + 1).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // Optional file; skip when absent.
  }
}
