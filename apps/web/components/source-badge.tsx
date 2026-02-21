interface SourceBadgeProps {
  source: string;
  updatedAt: string | null;
  verificationCount?: number;
}

export function SourceBadge({ source, updatedAt, verificationCount }: SourceBadgeProps) {
  return (
    <div className="source-strip">
      <span className="pill">Kaynak: {source}</span>
      <span className="pill">Son guncelleme: {updatedAt ? new Date(updatedAt).toLocaleTimeString("tr-TR") : "-"}</span>
      {typeof verificationCount === "number" ? <span className="pill">Dogrulama: {verificationCount} kaynak</span> : null}
    </div>
  );
}
