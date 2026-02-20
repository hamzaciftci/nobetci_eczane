#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

loadEnvFromFile(path.join(process.cwd(), ".env"));
loadEnvFromFile(path.join(process.cwd(), "../../.env"));

const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
const adminToken = process.env.ADMIN_API_TOKEN ?? "";
const databaseUrl = process.env.DATABASE_URL;
const province = process.env.MANUAL_OVERRIDE_TEST_PROVINCE ?? "adana";
const dutyDate = new Date().toISOString().slice(0, 10);

if (!databaseUrl) {
  fail("DATABASE_URL is required for integration test.");
}

const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const districtName = `Test Ilce ${runId}`;
const pharmacyName = `IT Manual Override ${runId}`;

const firstPayload = {
  il: province,
  ilce: districtName,
  eczane_adi: pharmacyName,
  adres: `Test Mahallesi ${runId} No:1`,
  telefon: "+90 555 111 22 33",
  lat: 37.001,
  lng: 35.001,
  duty_date: dutyDate,
  dogruluk_puani: 99,
  dogrulama_kaynagi_sayisi: 2,
  source_note: "integration-create",
  updated_by: "integration-test-create"
};

const secondPayload = {
  ...firstPayload,
  adres: `Test Mahallesi ${runId} No:2`,
  telefon: "+90 555 444 55 66",
  lat: 37.002,
  lng: 35.002,
  dogruluk_puani: 88,
  dogrulama_kaynagi_sayisi: 3,
  source_note: "integration-update",
  updated_by: "integration-test-update"
};

const pool = new Pool({ connectionString: databaseUrl });

run()
  .then(() => {
    log("PASS manual_override_integration: endpoint upsert + DB write verified");
    process.exit(0);
  })
  .catch((error) => {
    fail(`manual_override_integration failed: ${error instanceof Error ? error.message : String(error)}`);
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await pool.end();
    }
  });

async function run() {
  await ensureApiReady();

  const firstResponse = await postManualOverride(firstPayload);
  assert(firstResponse.status === "ok", "First manual override response is not ok.");

  const secondResponse = await postManualOverride(secondPayload);
  assert(secondResponse.status === "ok", "Second manual override response is not ok.");
  assert(secondResponse.il === province, "Province slug mismatch in response.");

  const row = await queryManualOverrideRow(secondResponse.il, secondResponse.ilce, pharmacyName, secondResponse.duty_date);
  assert(row, "Manual override row not found in DB.");

  assert(row.address === secondPayload.adres, "Address was not updated by second manual override.");
  assert(row.phone === normalizePhone(secondPayload.telefon), "Phone was not normalized/updated.");
  assert(Number(row.confidence_score) === secondPayload.dogruluk_puani, "confidence_score mismatch.");
  assert(
    Number(row.verification_source_count) === secondPayload.dogrulama_kaynagi_sayisi,
    "verification_source_count mismatch."
  );
  assert(row.source_name === "Manual Override", "Source name is not Manual Override.");
  assert(row.source_url === "admin://manual-override", "source_url mismatch.");
  assert(Boolean(row.extracted_payload?.manual_override), "manual_override flag missing in evidence payload.");
  assert(row.extracted_payload?.updated_by === secondPayload.updated_by, "updated_by did not reflect second override.");

  const count = await countDutyRows(secondResponse.il, secondResponse.ilce, pharmacyName, secondResponse.duty_date);
  assert(count === 1, `Expected single duty row after upsert, got ${count}.`);
}

async function ensureApiReady() {
  for (let i = 0; i < 20; i += 1) {
    try {
      const res = await fetch(`${apiBase}/health`);
      if (res.ok) {
        return;
      }
    } catch {
      // continue
    }
    await sleep(500);
  }
  throw new Error(`API is not reachable at ${apiBase}. Start API first (pnpm dev or pnpm --filter @nobetci/api dev).`);
}

async function postManualOverride(payload) {
  const res = await fetch(`${apiBase}/api/admin/ingestion/manual-override`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(adminToken ? { "x-admin-token": adminToken } : {})
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${bodyText}`);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`Invalid JSON response: ${bodyText}`);
  }
}

async function queryManualOverrideRow(ilSlug, ilceSlug, eczaneAdi, dutyDateValue) {
  const result = await pool.query(
    `
    select
      p.slug as il_slug,
      d.slug as ilce_slug,
      ph.canonical_name,
      ph.address,
      ph.phone,
      dr.confidence_score::text as confidence_score,
      dr.verification_source_count::text as verification_source_count,
      s.name as source_name,
      de.source_url,
      de.extracted_payload
    from duty_records dr
    join pharmacies ph on ph.id = dr.pharmacy_id
    join districts d on d.id = dr.district_id
    join provinces p on p.id = dr.province_id
    join duty_evidence de on de.duty_record_id = dr.id
    join sources s on s.id = de.source_id
    where p.slug = $1
      and d.slug = $2
      and ph.canonical_name = $3
      and dr.duty_date = $4::date
      and de.source_url = 'admin://manual-override'
    order by dr.updated_at desc
    limit 1
    `,
    [ilSlug, ilceSlug, eczaneAdi, dutyDateValue]
  );

  return result.rows[0] ?? null;
}

async function countDutyRows(ilSlug, ilceSlug, eczaneAdi, dutyDateValue) {
  const result = await pool.query(
    `
    select count(*)::int as row_count
    from duty_records dr
    join pharmacies ph on ph.id = dr.pharmacy_id
    join districts d on d.id = dr.district_id
    join provinces p on p.id = dr.province_id
    where p.slug = $1
      and d.slug = $2
      and ph.canonical_name = $3
      and dr.duty_date = $4::date
    `,
    [ilSlug, ilceSlug, eczaneAdi, dutyDateValue]
  );

  return Number(result.rows[0]?.row_count ?? 0);
}

async function cleanup() {
  const districtSlug = toSlug(districtName);

  await pool.query(
    `
    delete from duty_records dr
    using pharmacies ph, districts d, provinces p
    where dr.pharmacy_id = ph.id
      and ph.district_id = d.id
      and d.province_id = p.id
      and p.slug = $1
      and d.slug = $2
      and ph.canonical_name = $3
      and dr.duty_date = $4::date
    `,
    [province, districtSlug, pharmacyName, dutyDate]
  );

  await pool.query(
    `
    delete from pharmacies ph
    using districts d, provinces p
    where ph.district_id = d.id
      and d.province_id = p.id
      and p.slug = $1
      and d.slug = $2
      and ph.canonical_name = $3
    `,
    [province, districtSlug, pharmacyName]
  );

  await pool.query(
    `
    delete from districts d
    using provinces p
    where d.province_id = p.id
      and p.slug = $1
      and d.slug = $2
      and not exists (
        select 1
        from pharmacies ph
        where ph.district_id = d.id
      )
    `,
    [province, districtSlug]
  );
}

function normalizePhone(value) {
  return value.replace(/[^\d+]/g, "");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toSlug(value) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFromFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex < 0) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    if (!key || key in process.env) {
      continue;
    }

    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function log(message) {
  // eslint-disable-next-line no-console
  console.log(message);
}

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(`FAIL ${message}`);
  process.exit(1);
}
