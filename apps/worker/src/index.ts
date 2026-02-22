import { config as loadDotenv } from "dotenv";
import { join } from "path";
import { Queue, Worker } from "bullmq";
import pino from "pino";
import { Pool } from "pg";
import { pullProvinceAndPublish } from "./jobs/pull-province";
import { IngestionMetrics } from "./core/metrics";

ensureIstanbulTimezone();
loadDotenv({ path: join(process.cwd(), ".env"), override: false });
loadDotenv({ path: join(process.cwd(), "../../.env"), override: false });

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6380";
const queueName = process.env.INGESTION_QUEUE_NAME ?? "ingestion";
const workerConcurrency = Number(process.env.WORKER_CONCURRENCY ?? 8);
const metrics = new IngestionMetrics();
const configuredProvinceSlugs = process.env.PROVINCE_SLUGS?.trim() ?? "all";

const connection = {
  url: redisUrl
};
const dbConnectionString = envValue(process.env.APP_DATABASE_URL) ?? envValue(process.env.DATABASE_URL);
if (!dbConnectionString) {
  throw new Error("APP_DATABASE_URL or DATABASE_URL is required for worker");
}
const db = new Pool({
  connectionString: dbConnectionString,
  max: Number(envValue(process.env.DB_POOL_MAX) ?? 10),
  idleTimeoutMillis: Number(envValue(process.env.DB_IDLE_TIMEOUT_MS) ?? 10000),
  ssl: resolveSsl(dbConnectionString)
});
const queue = new Queue(queueName, { connection });

const worker = new Worker(
  queueName,
  async (job) => {
    const provinceSlug = String(job.data.provinceSlug ?? "");
    await pullProvinceAndPublish({ provinceSlug }, db, logger, metrics);
  },
  {
    connection,
    concurrency: workerConcurrency
  }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, name: job.name }, "Job completed");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, name: job?.name, error }, "Job failed");
});

async function bootstrap() {
  const provinces = await resolveProvinceSlugs();
  await scheduleRecurringJobs(provinces);
  setInterval(() => metrics.flush(logger), 60_000).unref();
  logger.info({ queue: queueName, provinces }, "Worker started");
}

async function scheduleRecurringJobs(provinces: string[]) {
  for (const provinceSlug of provinces) {
    await queue.add(
      "pull-province-validate",
      { provinceSlug },
      {
        jobId: `pull-validate:${provinceSlug}`,
        repeat: {
          pattern: "*/10 * * * *"
        },
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 10_000
        },
        removeOnComplete: 5000,
        removeOnFail: 10000
      }
    );

    await queue.add(
      "pull-province-daily",
      { provinceSlug },
      {
        jobId: `pull-daily:${provinceSlug}`,
        repeat: {
          pattern: "5 0 * * *"
        },
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 10_000
        },
        removeOnComplete: 5000,
        removeOnFail: 10000
      }
    );

    await queue.add(
      "pull-province-now",
      { provinceSlug },
      {
        jobId: `pull-immediate:${provinceSlug}:${Date.now()}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: 500
      }
    );
  }
}

async function resolveProvinceSlugs(): Promise<string[]> {
  if (configuredProvinceSlugs && configuredProvinceSlugs.toLowerCase() !== "all") {
    return configuredProvinceSlugs
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  try {
    const rows = await db.query<{ slug: string }>(
      `
      select distinct p.slug
      from provinces p
      join sources s on s.province_id = p.id and s.enabled = true
      join source_endpoints se on se.source_id = s.id and se.enabled = true
      order by p.slug asc
      `
    );
    const fromDb = rows.rows.map((row) => row.slug).filter(Boolean);
    if (fromDb.length) {
      return fromDb;
    }
  } catch (error) {
    logger.warn({ error }, "Could not load active provinces from DB; falling back to pilot list");
  }

  return ["adana", "istanbul"];
}

async function shutdown() {
  logger.info("Shutting down worker...");
  await worker.close();
  await queue.close();
  await db.end();
  process.exit(0);
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

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

bootstrap().catch(async (error) => {
  logger.error({ error }, "Fatal worker error");
  await shutdown();
});
