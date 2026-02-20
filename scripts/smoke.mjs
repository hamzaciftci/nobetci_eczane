#!/usr/bin/env node

const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
const webBase = process.env.WEB_BASE_URL ?? "http://localhost:3000";
const city = process.env.SMOKE_CITY ?? "adana";
const adminToken = process.env.ADMIN_API_TOKEN ?? "";

const results = [];

async function run() {
  await checkJson(`${apiBase}/health`, "health");
  const ready = await checkJson(`${apiBase}/health/ready`, "health_ready");
  if (!["ok", "degraded"].includes(String(ready.status))) {
    throw new Error(`Unexpected readiness status: ${ready.status}`);
  }

  const provinces = await checkJson(`${apiBase}/api/iller`, "provinces");
  if (!Array.isArray(provinces) || provinces.length < 10) {
    throw new Error("Province list is unexpectedly small");
  }

  const duty = await checkJson(`${apiBase}/api/il/${encodeURIComponent(city)}/nobetci`, "duty_by_province");
  if (!duty || !("status" in duty)) {
    throw new Error("Duty payload has invalid schema");
  }

  await checkJson(`${apiBase}/api/admin/ingestion/metrics`, "ingestion_metrics", adminToken);
  await checkText(`${webBase}/`, "web_home");
  await checkText(`${webBase}/nobetci-${encodeURIComponent(city)}`, "web_legacy_nobetci_route");
  await checkText(`${webBase}/nobetci-eczane/${encodeURIComponent(city)}/yazdir`, "web_a4_print");
  await checkText(`${webBase}/nobetci-eczane/${encodeURIComponent(city)}/ekran`, "web_fullscreen_board");

  printResults(true);
}

async function checkJson(url, name, token = "") {
  const headers = token ? { "x-admin-token": token } : {};
  const res = await fetch(url, { headers });
  if (!res.ok) {
    results.push({ name, ok: false, detail: `${res.status} ${res.statusText}` });
    throw new Error(`${name} failed: ${res.status}`);
  }
  const body = await res.json();
  results.push({ name, ok: true, detail: "ok" });
  return body;
}

async function checkText(url, name) {
  const res = await fetch(url);
  if (!res.ok) {
    results.push({ name, ok: false, detail: `${res.status} ${res.statusText}` });
    throw new Error(`${name} failed: ${res.status}`);
  }
  await res.text();
  results.push({ name, ok: true, detail: "ok" });
}

function printResults(success) {
  for (const row of results) {
    // eslint-disable-next-line no-console
    console.log(`${row.ok ? "PASS" : "FAIL"} ${row.name}: ${row.detail}`);
  }

  if (!success) {
    process.exit(1);
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`SMOKE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  printResults(false);
});
