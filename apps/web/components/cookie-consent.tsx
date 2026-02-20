"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const pref = localStorage.getItem("cookie_pref");
    if (!pref) {
      setVisible(true);
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className="panel" style={{ position: "fixed", bottom: 16, right: 16, width: "min(480px, 92vw)", zIndex: 40 }}>
      <strong>Cerez Tercihi</strong>
      <p className="muted">Zorunlu cerezler disinda analytics cerezleri varsayilan olarak kapali tutulur.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            localStorage.setItem("cookie_pref", "reject_optional");
            setVisible(false);
          }}
        >
          Opsiyonel Cerezleri Reddet
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            localStorage.setItem("cookie_pref", "accept_optional");
            setVisible(false);
          }}
        >
          Kabul Et
        </button>
        <Link className="btn" href="/cerez-politikasi">
          Politika
        </Link>
      </div>
    </div>
  );
}
