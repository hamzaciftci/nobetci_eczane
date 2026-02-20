"use client";

interface PrintActionsProps {
  screenHref: string;
}

export function PrintActions({ screenHref }: PrintActionsProps) {
  return (
    <div className="a4-toolbar">
      <button type="button" className="btn primary" onClick={() => window.print()}>
        A4 Yazdir
      </button>
      <a href={screenHref} className="btn" target="_blank" rel="noreferrer">
        Tam Ekran Panoyu Ac
      </a>
      <p className="muted" style={{ margin: 0 }}>
        Yazdirma icin bu sayfa A4 formatina otomatik duzenlenir.
      </p>
    </div>
  );
}
