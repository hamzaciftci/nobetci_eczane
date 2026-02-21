import { config as loadDotenv } from "dotenv";
import { join } from "path";
import pino from "pino";
import { Pool } from "pg";
import { IngestionMetrics } from "../core/metrics";
import { pullProvinceAndPublish } from "../jobs/pull-province";

loadDotenv({ path: join(process.cwd(), ".env"), override: false });
loadDotenv({ path: join(process.cwd(), "../../.env"), override: false });

const logger = pino({ level: envValue(process.env.LOG_LEVEL) ?? "info" });
const metrics = new IngestionMetrics();

async function main() {
  const connectionString = envValue(process.env.APP_DATABASE_URL) ?? envValue(process.env.DATABASE_URL);
  if (!connectionString) {
    throw new Error("APP_DATABASE_URL or DATABASE_URL is required");
  }

  const db = new Pool({
    connectionString,
    max: Number(envValue(process.env.DB_POOL_MAX) ?? 3),
    idleTimeoutMillis: Number(envValue(process.env.DB_IDLE_TIMEOUT_MS) ?? 10000),
    ssl: resolveSsl(connectionString)
  });

  try {
    const provinces = await resolveProvinceSlugs(db);
    logger.info({ provinces }, "Starting one-off ingestion run");

    const failures: Array<{ province: string; error: string }> = [];
    for (const provinceSlug of provinces) {
      try {
        await pullProvinceAndPublish({ provinceSlug }, db, logger, metrics);
      } catch (error) {
        failures.push({
          province: provinceSlug,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    metrics.flush(logger);

    if (failures.length) {
      logger.error({ failures }, "One-off ingestion finished with failures");
      process.exitCode = 1;
      return;
    }

    logger.info({ provinces }, "One-off ingestion finished successfully");
  } finally {
    await db.end();
  }
}

async function resolveProvinceSlugs(db: Pool): Promise<string[]> {
  const configured =
    envValue(process.env.INGESTION_PROVINCES) ?? envValue(process.env.PROVINCE_SLUGS) ?? "all";

  if (configured.toLowerCase() !== "all") {
    const values = configured
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    if (!values.length) {
      throw new Error("INGESTION_PROVINCES resolved to empty list");
    }

    return [...new Set(values)];
  }

  const rows = await db.query<{ slug: string }>(
    `
    select distinct p.slug
    from provinces p
    join sources s on s.province_id = p.id and s.enabled = true
    join source_endpoints se on se.source_id = s.id and se.enabled = true
    order by p.slug asc
    `
  );

  const fromDb = rows.rows.map((row) => row.slug?.trim().toLowerCase()).filter(Boolean) as string[];
  if (fromDb.length) {
    return fromDb;
  }

  logger.warn("No active province found in DB, falling back to pilot list");
  return ["osmaniye", "adana"];
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

main().catch((error) => {
  logger.error({ error }, "One-off ingestion failed");
  process.exit(1);
});
