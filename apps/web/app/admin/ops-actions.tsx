"use client";

import { useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface AlertItem {
  id: number;
  il: string;
  source_endpoint_id: number | null;
  alert_type: string;
  severity: string;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface OpsActionsProps {
  provinces: string[];
  initialAlerts: AlertItem[];
}

export function OpsActions({ provinces, initialAlerts }: OpsActionsProps) {
  const [busyProvince, setBusyProvince] = useState<string | null>(null);
  const [busyAlertId, setBusyAlertId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [adminToken, setAdminToken] = useState("");

  const sortedProvinces = useMemo(
    () => [...new Set([...provinces, ...alerts.map((alert) => alert.il)])].sort((a, b) => a.localeCompare(b)),
    [provinces, alerts]
  );

  async function triggerRecovery(il: string) {
    setBusyProvince(il);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/ingestion/recovery/${il}/trigger`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {})
        }
      });
      const text = await response.text();
      if (!response.ok) {
        setMessage(`Recovery hatasi (${il}): ${text}`);
        return;
      }
      setMessage(`Recovery queue'ya eklendi: ${il}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recovery tetiklenemedi");
    } finally {
      setBusyProvince(null);
    }
  }

  async function resolveAlert(id: number) {
    setBusyAlertId(id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/ingestion/alerts/${id}/resolve`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {})
        },
        body: JSON.stringify({ resolved_by: "web-admin" })
      });
      if (!response.ok) {
        setMessage(`Alert resolve hatasi: ${id}`);
        return;
      }
      setAlerts((prev) => prev.filter((item) => item.id !== id));
      setMessage(`Alert resolve edildi: ${id}`);
    } catch {
      setMessage(`Alert resolve istegi basarisiz: ${id}`);
    } finally {
      setBusyAlertId(null);
    }
  }

  return (
    <section className="panel">
      <h3 style={{ marginTop: 0 }}>Recovery Actions</h3>
      <p className="muted">Degraded durumda ilgili il icin acil pull tetikleyin.</p>
      <input
        className="btn"
        type="password"
        placeholder="Admin token (opsiyonel)"
        value={adminToken}
        onChange={(event) => setAdminToken(event.target.value)}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sortedProvinces.map((il) => (
          <button key={il} type="button" className="btn" onClick={() => triggerRecovery(il)} disabled={busyProvince === il}>
            {busyProvince === il ? `${il}...` : `${il} Recovery`}
          </button>
        ))}
      </div>
      {message ? <p className="muted">{message}</p> : null}

      <h4 style={{ marginBottom: 8 }}>Open Alerts</h4>
      <div className="grid">
        {alerts.map((alert) => (
          <article key={alert.id} className="panel">
            <strong>
              {alert.il} / {alert.severity.toUpperCase()}
            </strong>
            <p className="muted" style={{ marginTop: 6 }}>
              Type: {alert.alert_type}
            </p>
            {alert.source_endpoint_id ? <p className="muted">Endpoint ID: {alert.source_endpoint_id}</p> : null}
            {alert.alert_type === "parser_error_threshold" ? <ParserThresholdMeta payload={alert.payload} /> : null}
            <p className="muted">{alert.message}</p>
            <p className="muted">{new Date(alert.created_at).toLocaleString("tr-TR")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn"
                onClick={() => triggerRecovery(alert.il)}
                disabled={busyProvince === alert.il}
              >
                {busyProvince === alert.il ? `${alert.il}...` : `${alert.il} Recovery`}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => resolveAlert(alert.id)}
                disabled={busyAlertId === alert.id}
              >
                {busyAlertId === alert.id ? "Resolving..." : "Resolve"}
              </button>
            </div>
          </article>
        ))}
        {!alerts.length ? <p className="muted">Acik alarm yok.</p> : null}
      </div>
    </section>
  );
}

function ParserThresholdMeta({ payload }: { payload: Record<string, unknown> | null }) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const parserKey =
    typeof payload.parserKey === "string"
      ? payload.parserKey
      : typeof payload.parser_key === "string"
        ? payload.parser_key
        : "-";

  const stats = payload.stats && typeof payload.stats === "object" ? (payload.stats as Record<string, unknown>) : null;
  const totalRuns =
    stats && typeof stats.totalRuns === "number"
      ? stats.totalRuns
      : typeof payload.total_runs_24h === "number"
        ? payload.total_runs_24h
        : null;
  const failedRuns =
    stats && typeof stats.failedRuns === "number"
      ? stats.failedRuns
      : typeof payload.failed_runs_24h === "number"
        ? payload.failed_runs_24h
        : null;
  const errorRatePct =
    stats && typeof stats.errorRatePct === "number"
      ? stats.errorRatePct
      : typeof payload.error_rate_pct_24h === "number"
        ? payload.error_rate_pct_24h
        : null;

  return (
    <>
      <p className="muted">Parser: {parserKey}</p>
      <p className="muted">
        Error Rate: {errorRatePct ?? "-"}% {failedRuns !== null && totalRuns !== null ? `(${failedRuns}/${totalRuns})` : ""}
      </p>
    </>
  );
}
