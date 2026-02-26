import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const raw = readFileSync(".env.local", "utf8");
const vars = Object.fromEntries(
  raw.split("\n").filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]; })
);
const sql = neon(vars.DATABASE_URL);

const tables = await sql`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`;
console.log("Tables:", tables.map(r => r.tablename).join(", "));

const views = await sql`
  SELECT viewname FROM pg_views
  WHERE schemaname = 'public'
  ORDER BY viewname
`;
console.log("Views:", views.map(r => r.viewname).join(", "));
