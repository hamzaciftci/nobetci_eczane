import { Metadata } from "next";
import { ManualOverrideForm } from "./manual-override-form";
import { OpsActions } from "./ops-actions";
import { publicEnv } from "../../lib/env";

const API_BASE_URL = publicEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

export const metadata: Metadata = {
  title: "Admin Panel"
};

export const dynamic = "force-dynamic";
export const revalidate = 120;

interface OverviewItem {
  il: string;
  success_count: number;
  failed_count: number;
  partial_count: number;
  last_run_at: string | null;
  alert_count: number;
}

interface IngestionMetrics {
  api_cache: {
    cache_hits: number;
    cache_misses: number;
    cache_hit_ratio: number;
  };
  update_coverage?: {
    updated_24h: number;
    total_with_sources: number;
    coverage_ratio_pct: number;
  };
  conflict_rate?: {
    conflicts_24h: number;
    verified_24h: number;
    conflict_ratio_pct: number;
  };
  parser_health?: Array<{
    il: string;
    parser_key: string;
    total_runs: number;
    failed_runs: number;
    parser_error_rate_pct: number;
  }>;
  unavailable?: boolean;
}

export default async function AdminPage() {
  const adminHeaders =
    ADMIN_TOKEN && ADMIN_TOKEN.length > 0
      ? {
          "x-admin-token": ADMIN_TOKEN
        }
      : undefined;

  const overview = await fetch(`${API_BASE_URL}/api/admin/ingestion/overview`, {
    next: { revalidate: 120, tags: ["admin:ingestion"] },
    headers: adminHeaders
  })
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);

  const items = overview as OverviewItem[];
  const metrics = await fetch(`${API_BASE_URL}/api/admin/ingestion/metrics`, {
    next: { revalidate: 120, tags: ["admin:ingestion:metrics"] },
    headers: adminHeaders
  })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
  const m = metrics as IngestionMetrics | null;

  const openAlerts = await fetch(`${API_BASE_URL}/api/admin/ingestion/alerts/open`, {
    next: { revalidate: 120, tags: ["admin:ingestion:alerts"] },
    headers: adminHeaders
  })
    .then((res) => (res.ok ? res.json() : []))
    .catch(() => []);

  const alerts = openAlerts as Array<{
    id: number;
    il: string;
    source_endpoint_id: number | null;
    alert_type: string;
    severity: string;
    message: string;
    payload: Record<string, unknown> | null;
    created_at: string;
  }>;

  return (
    <main className="grid">
      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Minimal Admin Panel</h2>
        <ul>
          <li>Kaynak yonetimi</li>
          <li>Manuel duzeltme</li>
          <li>Snapshot goruntuleme</li>
          <li>Cakisma cozum ekrani</li>
          <li>Hata bildirimi yonetimi</li>
        </ul>
      </section>

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Ingestion Overview (24h)</h3>
        <div className="grid">
          {items.map((item) => (
            <article key={item.il} className="panel">
              <h4 style={{ marginTop: 0 }}>{item.il}</h4>
              <p className="muted">Success: {item.success_count}</p>
              <p className="muted">Failed: {item.failed_count}</p>
              <p className="muted">Partial: {item.partial_count}</p>
              <p className="muted">Alerts: {item.alert_count}</p>
              <p className="muted">Last run: {item.last_run_at ?? "-"}</p>
              <a className="btn" href={`${API_BASE_URL}/api/admin/ingestion/${item.il}`} target="_blank" rel="noreferrer">
                Raw Detail
              </a>
            </article>
          ))}
          {!items.length ? <p className="muted">Veri bulunamadi.</p> : null}
        </div>
      </section>

      <OpsActions provinces={items.map((item) => item.il)} initialAlerts={alerts} />
      <ManualOverrideForm provinces={items.map((item) => item.il)} />

      <section className="panel">
        <h3 style={{ marginTop: 0 }}>Advanced Metrics</h3>
        {!m || m.unavailable ? (
          <p className="muted">Metrics su anda ulasilamiyor.</p>
        ) : (
          <>
            <div className="metric-grid">
              <article className="panel">
                <strong>Cache Hit Ratio</strong>
                <p className="muted">{(m.api_cache.cache_hit_ratio * 100).toFixed(2)}%</p>
                <p className="muted">Hits: {m.api_cache.cache_hits}</p>
                <p className="muted">Misses: {m.api_cache.cache_misses}</p>
              </article>
              <article className="panel">
                <strong>Update Coverage (24h)</strong>
                <p className="muted">{m.update_coverage?.coverage_ratio_pct ?? 0}%</p>
                <p className="muted">
                  {m.update_coverage?.updated_24h ?? 0}/{m.update_coverage?.total_with_sources ?? 0} il guncel
                </p>
              </article>
              <article className="panel">
                <strong>Conflict Ratio (24h)</strong>
                <p className="muted">{m.conflict_rate?.conflict_ratio_pct ?? 0}%</p>
                <p className="muted">
                  {m.conflict_rate?.conflicts_24h ?? 0}/{m.conflict_rate?.verified_24h ?? 0} kayit
                </p>
              </article>
            </div>

            <div className="grid" style={{ marginTop: 10 }}>
              <h4 style={{ marginBottom: 0 }}>Parser Error Rate</h4>
              {(m.parser_health ?? []).slice(0, 12).map((row, idx) => (
                <article className="panel" key={`${row.il}-${row.parser_key}-${idx}`}>
                  <strong>
                    {row.il} / {row.parser_key}
                  </strong>
                  <p className="muted">Error Rate: {row.parser_error_rate_pct}%</p>
                  <p className="muted">
                    Failed/Total: {row.failed_runs}/{row.total_runs}
                  </p>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
