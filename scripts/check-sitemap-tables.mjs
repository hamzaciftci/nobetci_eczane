import { neon } from "@neondatabase/serverless";
const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!url) { console.error("No DB URL"); process.exit(1); }
const sql = neon(url);

for (const table of ["provinces", "source_health", "districts"]) {
  const [{ cnt }] = await sql`SELECT count(*)::int AS cnt FROM information_schema.tables WHERE table_name = ${table} AND table_schema = 'public'`;
  console.log(table + ":", Number(cnt) > 0 ? "EXISTS" : "MISSING");
}

// Provinces tablosu varsa kaç kayıt var?
try {
  const [{ cnt }] = await sql`SELECT count(*)::int AS cnt FROM provinces`;
  console.log("provinces rows:", cnt);
} catch(e) { console.log("provinces query error:", e.message); }
