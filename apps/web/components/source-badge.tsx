interface SourceBadgeProps {
  source: string;
  updatedAt: string | null;
  verificationCount?: number;
}

export function SourceBadge({ source, updatedAt, verificationCount }: SourceBadgeProps) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <span className="pill">Kaynak: {source}</span>
      <span className="pill">Son Guncelleme: {updatedAt ? new Date(updatedAt).toLocaleTimeString("tr-TR") : "-"}</span>
      {typeof verificationCount === "number" ? (
        <span className="pill">Dogrulama: {verificationCount} kaynak</span>
      ) : null}
    </div>
  );
}
