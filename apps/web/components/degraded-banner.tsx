interface DegradedBannerProps {
  updatedAt: string | null;
  staleMinutes?: number | null;
  recentAlert?: string | null;
  hint?: string | null;
}

export function DegradedBanner({ updatedAt, staleMinutes, recentAlert, hint }: DegradedBannerProps) {
  return (
    <section className="panel degraded-banner">
      <strong>Degraded Mode</strong>
      <p className="muted">Veri beklenenden eski olabilir. Son basarili guncelleme: {updatedAt ?? "bilinmiyor"}.</p>

      {typeof staleMinutes === "number" ? <p className="muted">Tahmini gecikme: {staleMinutes} dakika</p> : null}
      {recentAlert ? <p className="muted">Son alarm: {recentAlert}</p> : null}
      {hint ? <p className="muted">{hint}</p> : null}
    </section>
  );
}
