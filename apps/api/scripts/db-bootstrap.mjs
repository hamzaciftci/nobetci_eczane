import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INIT_FILES = [
  "../../../infra/postgres/init/001_schema.sql",
  "../../../infra/postgres/init/002_seed_pilot.sql",
  "../../../infra/postgres/init/003_seed_source_endpoints.sql"
];

const MIGRATION_FILES = [
  "../../../infra/postgres/migrations/20260220_sprint2.sql",
  "../../../infra/postgres/migrations/20260220_live_realdata.sql"
];

async function runSqlFile(client, relativePath) {
  const fullPath = path.resolve(__dirname, relativePath);
  const sql = await readFile(fullPath, "utf8");
  const trimmed = sql.trim();
  if (!trimmed) {
    return;
  }

  console.log(`[db:bootstrap] applying ${relativePath}`);
  await client.query(trimmed);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const client = new Client({
    connectionString,
    ssl:
      process.env.DB_SSL_MODE === "disable"
        ? false
        : {
            rejectUnauthorized: false
          }
  });

  await client.connect();

  try {
    const probe = await client.query(
      "select to_regclass('public.provinces') is not null as exists"
    );
    const hasSchema = Boolean(probe.rows[0]?.exists);

    if (!hasSchema) {
      for (const file of INIT_FILES) {
        await runSqlFile(client, file);
      }
    } else {
      console.log("[db:bootstrap] base schema already exists, init files skipped");
    }

    for (const file of MIGRATION_FILES) {
      await runSqlFile(client, file);
    }

    console.log("[db:bootstrap] done");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[db:bootstrap] failed", error);
  process.exit(1);
});
