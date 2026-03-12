/**
 * Server-side veri çekme fonksiyonları.
 * Doğrudan Neon DB'ye bağlanır — HTTP round-trip yok, ISR ile uyumlu.
 */

import { neon } from "@neondatabase/serverless";

export interface Pharmacy {
  eczane_adi: string;
  il: string;
  ilce: string;
  adres: string;
  telefon: string;
  lat: number | null;
  lng: number | null;
}

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

/**
 * İl bazında bugünkü nöbetçi eczaneleri getirir.
 * Önce `api_active_duty` view'ını dener, bulamazsa `duty_records`'a döner.
 */
export async function getCityDuty(ilSlug: string): Promise<Pharmacy[]> {
  const sql = getDb();

  // 1. Canonical view
  try {
    const rows = await sql`
      SELECT eczane_adi, il, ilce, adres, telefon,
             lat::float AS lat, lng::float AS lng
      FROM api_active_duty
      WHERE il_slug = ${ilSlug}
      ORDER BY ilce, eczane_adi
    `;
    if (rows.length > 0) return rows as Pharmacy[];
  } catch {
    // view eksik olabilir — fallback'e geç
  }

  // 2. Fallback: duty_records tablosu
  try {
    const rows = await sql`
      SELECT eczane_adi, il, ilce, adres, telefon,
             lat::float AS lat, lng::float AS lng
      FROM duty_records
      WHERE il_slug = ${ilSlug}
        AND duty_date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
      ORDER BY ilce, eczane_adi
    `;
    return rows as Pharmacy[];
  } catch {
    return [];
  }
}

/**
 * İlçe bazında bugünkü nöbetçi eczaneleri getirir.
 */
export async function getDistrictDuty(
  ilSlug: string,
  ilceSlug: string
): Promise<Pharmacy[]> {
  const sql = getDb();

  try {
    const rows = await sql`
      SELECT eczane_adi, il, ilce, adres, telefon,
             lat::float AS lat, lng::float AS lng
      FROM api_active_duty
      WHERE il_slug = ${ilSlug}
        AND ilce_slug = ${ilceSlug}
      ORDER BY eczane_adi
    `;
    if (rows.length > 0) return rows as Pharmacy[];
  } catch {
    // view eksik
  }

  try {
    const rows = await sql`
      SELECT eczane_adi, il, ilce, adres, telefon,
             lat::float AS lat, lng::float AS lng
      FROM duty_records
      WHERE il_slug = ${ilSlug}
        AND ilce_slug = ${ilceSlug}
        AND duty_date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
      ORDER BY eczane_adi
    `;
    return rows as Pharmacy[];
  } catch {
    return [];
  }
}

/**
 * Bir ildeki tüm ilçe slug'larını ve adlarını getirir (sitemap + generateStaticParams için).
 */
export async function getDistrictSlugs(
  ilSlug: string
): Promise<{ ilce_slug: string; ilce: string }[]> {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT DISTINCT ilce_slug, ilce
      FROM api_active_duty
      WHERE il_slug = ${ilSlug}
        AND ilce_slug IS NOT NULL
      ORDER BY ilce_slug
    `;
    return rows as { ilce_slug: string; ilce: string }[];
  } catch {
    return [];
  }
}

/**
 * Tüm aktif il slug'larını döner (sitemap için).
 */
export async function getAllActiveProvinceSlugs(): Promise<string[]> {
  const sql = getDb();
  try {
    const rows = await sql`
      SELECT DISTINCT il_slug FROM api_active_duty
      WHERE il_slug IS NOT NULL
      ORDER BY il_slug
    `;
    return rows.map((r: { il_slug: string }) => r.il_slug);
  } catch {
    return [];
  }
}
