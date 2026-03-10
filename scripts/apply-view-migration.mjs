/**
 * One-time migration: api_active_duty VIEW güncellemesi
 * VIEW'ı resolve_active_duty_date() kullanacak şekilde günceller.
 *
 * Usage: node scripts/apply-view-migration.mjs
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envLocal = readFileSync(".env.local", "utf8");
const envVars = Object.fromEntries(
  envLocal.split("\n")
    .filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
    .filter(([k]) => k)
);
Object.assign(process.env, envVars);

const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL bulunamadı");
  process.exit(1);
}

const sql = neon(dbUrl);

async function run() {
  // 1. Mevcut durumu kontrol et
  const [{ fn_exists }] = await sql`
    SELECT EXISTS(
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'resolve_active_duty_date'
        AND n.nspname = 'public'
    ) AS fn_exists
  `;
  console.log("resolve_active_duty_date() mevcut:", fn_exists);

  // Mevcut VIEW tarih filtresini kontrol et
  const [{ view_def }] = await sql`
    SELECT pg_get_viewdef('api_active_duty', true) AS view_def
  `;
  const usesNewFn = view_def?.includes("resolve_active_duty_date");
  console.log("VIEW resolve_active_duty_date kullanıyor:", usesNewFn);

  if (usesNewFn) {
    console.log("VIEW zaten güncel. Migration gerekmiyor.");
  } else {
    console.log("VIEW güncelleniyor...");
    await sql`
      create or replace view api_active_duty as
      select
        dr.id,
        ph.canonical_name as eczane_adi,
        pr.slug as il_slug,
        pr.name as il,
        d.slug as ilce_slug,
        d.name as ilce,
        ph.address as adres,
        ph.phone as telefon,
        ph.lat as lat,
        ph.lng as lng,
        string_agg(distinct s.name, ', ') as kaynak,
        min(de.source_url) as kaynak_url,
        dr.last_verified_at as son_guncelleme,
        dr.confidence_score as dogruluk_puani,
        dr.verification_source_count as dogrulama_kaynagi_sayisi,
        dr.is_degraded
      from duty_records dr
      join pharmacies ph on ph.id = dr.pharmacy_id
      join provinces pr on pr.id = dr.province_id
      join districts d on d.id = dr.district_id
      join duty_evidence de on de.duty_record_id = dr.id
      join sources s on s.id = de.source_id
      where dr.duty_date = resolve_active_duty_date()
      group by
        dr.id,
        ph.canonical_name,
        pr.slug,
        pr.name,
        d.slug,
        d.name,
        ph.address,
        ph.phone,
        ph.lat,
        ph.lng,
        dr.last_verified_at,
        dr.confidence_score,
        dr.verification_source_count,
        dr.is_degraded
    `;
    console.log("VIEW güncellendi.");
  }

  // 2. Sonuç doğrulama
  const [{ row_count }] = await sql`
    SELECT COUNT(*) AS row_count FROM api_active_duty
  `;
  console.log("api_active_duty satır sayısı:", row_count);

  const [{ today }] = await sql`
    SELECT resolve_active_duty_date() AS today
  `;
  console.log("resolve_active_duty_date():", today);

  const provinces = await sql`
    SELECT il, COUNT(*) AS eczane_sayisi
    FROM api_active_duty
    GROUP BY il
    ORDER BY il
    LIMIT 20
  `;
  console.log("\nİl bazında eczane sayıları (ilk 20):");
  for (const p of provinces) {
    console.log(`  ${p.il}: ${p.eczane_sayisi}`);
  }
}

run().catch(err => {
  console.error("Migration hatası:", err.message);
  process.exit(1);
});
