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
    <div className="panel cookie-consent">
      <strong>Cerez Tercihi</strong>
      <p className="muted">Zorunlu cerezler disinda analytics cerezleri varsayilan olarak kapali tutulur.</p>
      <div className="cookie-actions">
        <button
          type="button"
          className="btn btn-ghost"
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
