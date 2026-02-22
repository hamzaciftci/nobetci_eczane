import { PoolClient } from "pg";
import { buildHybridDiff, HybridFlatRecord } from "./hybrid-diff";
import {
  normalizeAddress,
  normalizeCompareKey,
  normalizePharmacyName,
  normalizeTime
} from "./hybrid-normalization";

interface LoggerLike {
  info(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
}

interface SnapshotRow {
  province: string;
  province_slug: string;
  district: string;
  district_slug: string;
  pharmacy_name: string;
  address: string;
  duty_hours: string | null;
}

interface FreshDutyRow {
  province: string;
  province_slug: string;
  district: string;
  district_slug: string;
  pharmacy_name: string;
  address: string;
  phone: string | null;
  lat: string | null;
  lng: string | null;
  duty_date: string;
  duty_start: string;
  duty_end: string;
  duty_hours: string | null;
  source: string | null;
  source_url: string | null;
  confidence_score: string;
  verification_source_count: number;
  is_degraded: boolean;
  updated_at: string;
}

export interface SyncSummary {
  provinceSlug: string;
  dutyDate: string;
  freshRows: number;
  mismatches: number;
}

export async function archiveHistoricalDutyRows(
  client: PoolClient,
  todayDate: string
): Promise<{ archived: number; deleted: number }> {
  const archived = await client.query<{ count: string }>(
    `
    with moved as (
      insert into duty_pharmacies_archive (
        province_slug,
        province,
        district_slug,
        district,
        pharmacy_name,
        pharmacy_name_norm,
        address,
        address_norm,
        phone,
        lat,
        lng,
        duty_date,
        duty_start,
        duty_end,
        duty_hours,
        source,
        source_url,
        confidence_score,
        verification_source_count,
        is_degraded,
        updated_at,
        created_at,
        archived_at
      )
      select
        province_slug,
        province,
        district_slug,
        district,
        pharmacy_name,
        pharmacy_name_norm,
        address,
        address_norm,
        phone,
        lat,
        lng,
        duty_date,
        duty_start,
        duty_end,
        duty_hours,
        source,
        source_url,
        confidence_score,
        verification_source_count,
        is_degraded,
        updated_at,
        created_at,
        now()
      from duty_pharmacies
      where duty_date < $1::date
      returning 1
    )
    select count(*)::text as count from moved
    `,
    [todayDate]
  );

  const deleted = await client.query<{ count: string }>(
    `
    with removed as (
      delete from duty_pharmacies
      where duty_date < $1::date
      returning 1
    )
    select count(*)::text as count from removed
    `,
    [todayDate]
  );

  return {
    archived: Number(archived.rows[0]?.count ?? 0),
    deleted: Number(deleted.rows[0]?.count ?? 0)
  };
}

export async function syncProvinceSnapshotFromDutyRecords(
  client: PoolClient,
  provinceSlug: string,
  dutyDates: string[],
  logger?: LoggerLike
): Promise<SyncSummary[]> {
  const uniqueDates = [...new Set(dutyDates.filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)))];
  const summaries: SyncSummary[] = [];

  for (const dutyDate of uniqueDates) {
    const existingRows = await listSnapshotRows(client, provinceSlug, dutyDate);
    const freshRows = await listFreshRowsFromDutyRecords(client, provinceSlug, dutyDate);

    const normalizedFreshRows = freshRows.map(toHybridInsertRow);
    const normalizedExistingRows = existingRows.map(toHybridFlatRecord);
    const normalizedFreshFlat = normalizedFreshRows.map((item) => toHybridFlatRecord(item));

    const diff = buildHybridDiff(normalizedExistingRows, normalizedFreshFlat);
    const mismatchCount =
      diff.added.length + diff.removed.length + diff.timeMismatches.length + diff.addressMismatches.length;

    if (mismatchCount > 0) {
      await insertMismatches(client, dutyDate, [
        ...diff.added,
        ...diff.removed,
        ...diff.timeMismatches,
        ...diff.addressMismatches
      ]);
    }

    await client.query(
      `
      delete from duty_pharmacies
      where province_slug = $1
        and duty_date = $2::date
      `,
      [provinceSlug, dutyDate]
    );

    for (const row of normalizedFreshRows) {
      await client.query(
        `
        insert into duty_pharmacies (
          province_slug,
          province,
          district_slug,
          district,
          pharmacy_name,
          pharmacy_name_norm,
          address,
          address_norm,
          phone,
          lat,
          lng,
          duty_date,
          duty_start,
          duty_end,
          duty_hours,
          source,
          source_url,
          confidence_score,
          verification_source_count,
          is_degraded,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::date, $13::timestamptz, $14::timestamptz, $15, $16, $17, $18, $19, $20, $21::timestamptz
        )
        on conflict (province_slug, district_slug, duty_date, pharmacy_name_norm) do update set
          province = excluded.province,
          district = excluded.district,
          pharmacy_name = excluded.pharmacy_name,
          address = excluded.address,
          address_norm = excluded.address_norm,
          phone = excluded.phone,
          lat = excluded.lat,
          lng = excluded.lng,
          duty_start = excluded.duty_start,
          duty_end = excluded.duty_end,
          duty_hours = excluded.duty_hours,
          source = excluded.source,
          source_url = excluded.source_url,
          confidence_score = excluded.confidence_score,
          verification_source_count = excluded.verification_source_count,
          is_degraded = excluded.is_degraded,
          updated_at = excluded.updated_at
        `,
        [
          row.provinceSlug,
          row.province,
          row.districtSlug,
          row.district,
          row.pharmacyName,
          row.pharmacyNameNorm,
          row.address,
          row.addressNorm,
          row.phone,
          row.lat,
          row.lng,
          row.dutyDate,
          row.dutyStart,
          row.dutyEnd,
          row.dutyHours,
          row.source,
          row.sourceUrl,
          row.confidenceScore,
          row.verificationSourceCount,
          row.isDegraded,
          row.updatedAt
        ]
      );
    }

    await refreshAccuracyStats(client, dutyDate);

    const summary: SyncSummary = {
      provinceSlug,
      dutyDate,
      freshRows: normalizedFreshRows.length,
      mismatches: mismatchCount
    };
    summaries.push(summary);
    logger?.info(summary, "Hybrid province snapshot synced");
  }

  return summaries;
}

export async function refreshAccuracyStats(client: PoolClient, dutyDate: string): Promise<void> {
  const totals = await client.query<{ total_districts: string }>(
    `
    select count(*)::text as total_districts
    from (
      select distinct province_slug, district_slug
      from duty_pharmacies
      where duty_date = $1::date
    ) d
    `,
    [dutyDate]
  );

  const mismatchDistricts = await client.query<{ mismatched_districts: string; total_mismatch: string }>(
    `
    select
      count(distinct concat_ws(':', province_slug, district_slug))::text as mismatched_districts,
      count(*)::text as total_mismatch
    from mismatch_log
    where duty_date = $1::date
      and detected_at > now() - interval '24 hour'
    `,
    [dutyDate]
  );

  const totalDistricts = Number(totals.rows[0]?.total_districts ?? 0);
  const mismatchedDistricts = Number(mismatchDistricts.rows[0]?.mismatched_districts ?? 0);
  const totalMismatch = Number(mismatchDistricts.rows[0]?.total_mismatch ?? 0);
  const fullMatchDistricts = Math.max(totalDistricts - mismatchedDistricts, 0);
  const accuracyRatio =
    totalDistricts > 0 ? Number(((fullMatchDistricts / totalDistricts) * 100).toFixed(2)) : 0;

  await client.query(
    `
    insert into accuracy_stats (
      duty_date,
      total_districts,
      full_match_districts,
      total_mismatch,
      accuracy_ratio,
      last_check
    )
    values ($1::date, $2, $3, $4, $5, now())
    `,
    [dutyDate, totalDistricts, fullMatchDistricts, totalMismatch, accuracyRatio]
  );
}

function toHybridInsertRow(row: FreshDutyRow) {
  const pharmacyName = normalizePharmacyName(row.pharmacy_name);
  const address = normalizeAddress(row.address);
  const dutyHours = normalizeTime(row.duty_hours ?? "") ?? row.duty_hours ?? "00:00-00:00";

  return {
    province: row.province,
    provinceSlug: row.province_slug,
    district: row.district,
    districtSlug: row.district_slug,
    pharmacyName,
    pharmacyNameNorm: normalizeCompareKey(pharmacyName),
    address,
    addressNorm: normalizeCompareKey(address),
    phone: row.phone ?? null,
    lat: row.lat ? Number(row.lat) : null,
    lng: row.lng ? Number(row.lng) : null,
    dutyDate: row.duty_date,
    dutyStart: row.duty_start,
    dutyEnd: row.duty_end,
    dutyHours,
    source: row.source ?? "Bilinmeyen Kaynak",
    sourceUrl: row.source_url ?? "",
    confidenceScore: Number(row.confidence_score),
    verificationSourceCount: row.verification_source_count ?? 1,
    isDegraded: row.is_degraded,
    updatedAt: row.updated_at
  };
}

function toHybridFlatRecord(
  row:
    | SnapshotRow
    | {
        province: string;
        provinceSlug: string;
        district: string;
        districtSlug: string;
        pharmacyName: string;
        address: string;
        dutyHours: string | null;
      }
): HybridFlatRecord {
  if ("province_slug" in row) {
    return {
      province: row.province,
      provinceSlug: row.province_slug,
      district: row.district,
      districtSlug: row.district_slug,
      pharmacyName: row.pharmacy_name,
      address: row.address,
      dutyHours: row.duty_hours
    };
  }

  return {
    province: row.province,
    provinceSlug: row.provinceSlug,
    district: row.district,
    districtSlug: row.districtSlug,
    pharmacyName: row.pharmacyName,
    address: row.address,
    dutyHours: row.dutyHours
  };
}

async function listSnapshotRows(client: PoolClient, provinceSlug: string, dutyDate: string): Promise<SnapshotRow[]> {
  const query = await client.query<SnapshotRow>(
    `
    select
      province,
      province_slug,
      district,
      district_slug,
      pharmacy_name,
      address,
      duty_hours
    from duty_pharmacies
    where province_slug = $1
      and duty_date = $2::date
    `,
    [provinceSlug, dutyDate]
  );

  return query.rows;
}

async function listFreshRowsFromDutyRecords(
  client: PoolClient,
  provinceSlug: string,
  dutyDate: string
): Promise<FreshDutyRow[]> {
  const query = await client.query<FreshDutyRow>(
    `
    select
      p.name as province,
      p.slug as province_slug,
      d.name as district,
      d.slug as district_slug,
      ph.canonical_name as pharmacy_name,
      ph.address as address,
      ph.phone as phone,
      ph.lat::text as lat,
      ph.lng::text as lng,
      dr.duty_date::text as duty_date,
      dr.duty_start::text as duty_start,
      dr.duty_end::text as duty_end,
      to_char(dr.duty_start at time zone 'Europe/Istanbul', 'HH24:MI')
        || '-' ||
      to_char(dr.duty_end at time zone 'Europe/Istanbul', 'HH24:MI') as duty_hours,
      coalesce(string_agg(distinct s.name, ', '), 'Bilinmeyen Kaynak') as source,
      coalesce(min(de.source_url), '') as source_url,
      dr.confidence_score::text as confidence_score,
      dr.verification_source_count,
      dr.is_degraded,
      dr.last_verified_at::text as updated_at
    from duty_records dr
    join provinces p on p.id = dr.province_id
    join districts d on d.id = dr.district_id
    join pharmacies ph on ph.id = dr.pharmacy_id
    left join duty_evidence de on de.duty_record_id = dr.id
    left join sources s on s.id = de.source_id
    where p.slug = $1
      and dr.duty_date = $2::date
    group by
      p.name,
      p.slug,
      d.name,
      d.slug,
      ph.canonical_name,
      ph.address,
      ph.phone,
      ph.lat,
      ph.lng,
      dr.duty_date,
      dr.duty_start,
      dr.duty_end,
      dr.confidence_score,
      dr.verification_source_count,
      dr.is_degraded,
      dr.last_verified_at
    order by d.name asc, ph.canonical_name asc
    `,
    [provinceSlug, dutyDate]
  );

  return query.rows;
}

async function insertMismatches(
  client: PoolClient,
  dutyDate: string,
  rows: Array<{
    province: string;
    provinceSlug: string;
    district: string;
    districtSlug: string;
    pharmacyName: string;
    type: "ADDED" | "REMOVED" | "TIME_MISMATCH" | "ADDRESS_MISMATCH";
    sourceValue: string | null;
    projectValue: string | null;
  }>
) {
  for (const row of rows) {
    await client.query(
      `
      insert into mismatch_log (
        province,
        district,
        province_slug,
        district_slug,
        duty_date,
        pharmacy_name,
        type,
        source_value,
        project_value,
        detected_at
      )
      values ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, now())
      `,
      [
        row.province,
        row.district,
        row.provinceSlug,
        row.districtSlug,
        dutyDate,
        row.pharmacyName,
        row.type,
        row.sourceValue,
        row.projectValue
      ]
    );
  }
}
