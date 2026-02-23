import { neon } from "@neondatabase/serverless";

const CONNECTION_STRING =
  (process.env.DATABASE_URL || "").trim() ||
  (process.env.NEON_DATABASE_URL || "").trim();

const sql = CONNECTION_STRING ? neon(CONNECTION_STRING) : null;

export function hasDatabase() {
  return Boolean(sql);
}

export async function withDb(callback) {
  if (!sql) {
    throw new Error("DATABASE_URL is missing");
  }
  return callback(sql);
}
