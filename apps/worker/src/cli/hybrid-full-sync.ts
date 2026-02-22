import { config as loadDotenv } from "dotenv";
import { join } from "path";
import pino from "pino";
import { Pool } from "pg";
import { IngestionMetrics } from "../core/metrics";
import { runHybridFullSync } from "../jobs/hybrid-full-sync";

ensureIstanbulTimezone();
loadDotenv({ path: join(process.cwd(), ".env"), override: false });
loadDotenv({ path: join(process.cwd(), "../../.env"), override: false });

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

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
  const metrics = new IngestionMetrics();

  try {
    await runHybridFullSync(db, logger, metrics);
    metrics.flush(logger);
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
  logger.error({ error }, "Hybrid full sync failed");
  process.exit(1);
});
