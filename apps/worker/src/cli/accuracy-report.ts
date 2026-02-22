import { config as loadDotenv } from "dotenv";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { DateTime } from "luxon";
import pino from "pino";
import { Pool } from "pg";

ensureIstanbulTimezone();
loadDotenv({ path: join(process.cwd(), ".env"), override: false });
loadDotenv({ path: join(process.cwd(), "../../.env"), override: false });

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

interface OverviewRow {
  total_districts: string;
  full_match_districts: string;
  total_mismatch: string;
  accuracy_ratio: string;
  last_check: string;
}

interface ProvinceMismatchRow {
  province_slug: string;
  district_count: string;
  mismatch_count: string;
}

async function main() {
  const connectionString = envValue(process.env.APP_DATABASE_URL) ?? envValue(process.env.DATABASE_URL);
  if (!connectionString) {
    throw new Error("APP_DATABASE_URL or DATABASE_URL is required");
  }

  const dutyDate =
    envValue(process.env.ACCURACY_REPORT_DATE) ??
    DateTime.now().setZone("Europe/Istanbul").toISODate() ??
    new Date().toISOString().slice(0, 10);

  const db = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: Number(envValue(process.env.DB_IDLE_TIMEOUT_MS) ?? 10000),
    ssl: resolveSsl(connectionString)
  });

  try {
    const overview = await db.query<OverviewRow>(
      `
      select
        total_districts::text as total_districts,
        full_match_districts::text as full_match_districts,
        total_mismatch::text as total_mismatch,
        accuracy_ratio::text as accuracy_ratio,
        last_check::text as last_check
      from accuracy_stats
      where duty_date = $1::date
      order by last_check desc
      limit 1
      `,
      [dutyDate]
    );

    const provinceMismatches = await db.query<ProvinceMismatchRow>(
      `
      select
        province_slug,
        count(distinct district_slug)::text as district_count,
        count(*)::text as mismatch_count
      from mismatch_log
      where duty_date = $1::date
        and detected_at > now() - interval '24 hour'
      group by province_slug
      order by count(*) desc, province_slug asc
      `,
      [dutyDate]
    );

    const report = {
      duty_date: dutyDate,
      generated_at: new Date().toISOString(),
      overview: overview.rows[0]
        ? {
            total_districts: Number(overview.rows[0].total_districts),
            full_match_districts: Number(overview.rows[0].full_match_districts),
            total_mismatch: Number(overview.rows[0].total_mismatch),
            accuracy_ratio: Number(overview.rows[0].accuracy_ratio),
            last_check: overview.rows[0].last_check
          }
        : null,
      province_mismatches: provinceMismatches.rows.map((row) => ({
        province_slug: row.province_slug,
        district_count: Number(row.district_count),
        mismatch_count: Number(row.mismatch_count)
      }))
    };

    const reportsDir = join(process.cwd(), "..", "..", "..", "reports");
    await mkdir(reportsDir, { recursive: true });
    const outputPath = join(reportsDir, `accuracy-report-${dutyDate}.json`);
    await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

    logger.info({ outputPath, dutyDate }, "Accuracy report generated");
  } finally {
    await db.end();
  }
}

function resolveSsl(connectionString: string) {
  if (envValue(process.env.DB_SSL_MODE) === "disable") {
    return false;
  }

  const requiresSsl =
    connectionString.includes("sslmode=require") ||
    connectionString.includes("neon.tech") ||
    envValue(process.env.DB_SSL_MODE) === "require";

  if (!requiresSsl) {
    return false;
  }

  return {
    rejectUnauthorized: false
  };
}

function envValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const cleaned = value.replace(/^\uFEFF/, "").trim();
  return cleaned.length ? cleaned : undefined;
}

function ensureIstanbulTimezone() {
  if (!process.env.TZ || !process.env.TZ.trim()) {
    process.env.TZ = "Europe/Istanbul";
  }
}

main().catch((error) => {
  logger.error({ error }, "Accuracy report generation failed");
  process.exit(1);
});
