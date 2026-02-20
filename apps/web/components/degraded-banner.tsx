interface DegradedBannerProps {
  updatedAt: string | null;
  staleMinutes?: number | null;
  recentAlert?: string | null;
  hint?: string | null;
}

export function DegradedBanner({ updatedAt, staleMinutes, recentAlert, hint }: DegradedBannerProps) {
  return (
    <div className="panel" style={{ borderColor: "#e26e6e", marginBottom: 12 }}>
      <strong className="danger">Degraded Mode</strong>
      <p className="muted" style={{ marginBottom: 0 }}>
        Veri beklenenden eski olabilir. Son basarili guncelleme: {updatedAt ?? "bilinmiyor"}.
      </p>
      {typeof staleMinutes === "number" ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          Tahmini gecikme: {staleMinutes} dakika
        </p>
      ) : null}
      {recentAlert ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          Son alarm: {recentAlert}
        </p>
      ) : null}
      {hint ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
