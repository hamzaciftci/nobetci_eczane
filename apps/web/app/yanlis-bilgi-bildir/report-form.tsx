"use client";

import { FormEvent, useState } from "react";
import { publicEnv } from "../../lib/env";

const API_BASE_URL = publicEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");

export function ReportForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      il: String(form.get("il") ?? ""),
      ilce: String(form.get("ilce") ?? ""),
      eczane_adi: String(form.get("eczane_adi") ?? ""),
      sorun_turu: String(form.get("sorun_turu") ?? "diger"),
      not: String(form.get("not") ?? ""),
      iletisim_izni: Boolean(form.get("iletisim_izni"))
    };

    const response = await fetch(`${API_BASE_URL}/api/yanlis-bilgi`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    setLoading(false);
    if (response.ok) {
      setMessage("Bildiriminiz alindi. Tesekkur ederiz.");
      event.currentTarget.reset();
      return;
    }

    const text = await response.text();
    setMessage(`Hata: ${text}`);
  }

  return (
    <form className="panel grid" onSubmit={onSubmit}>
      <h2 style={{ marginTop: 0 }}>Yanlis Bilgi Bildirimi</h2>
      <input className="btn" name="il" placeholder="Il" required />
      <input className="btn" name="ilce" placeholder="Ilce (opsiyonel)" />
      <input className="btn" name="eczane_adi" placeholder="Eczane Adi" required />
      <select className="btn" name="sorun_turu" defaultValue="diger">
        <option value="telefon_yanlis">Telefon Yanlis</option>
        <option value="adres_yanlis">Adres Yanlis</option>
        <option value="nobette_degil">Nobette Degil</option>
        <option value="kapali">Kapali</option>
        <option value="diger">Diger</option>
      </select>
      <textarea className="btn" name="not" placeholder="Not (opsiyonel)" rows={4} />
      <label>
        <input type="checkbox" name="iletisim_izni" /> Geri donus icin iletisim izni veriyorum.
      </label>
      <button className="btn primary" disabled={loading} type="submit">
        {loading ? "Gonderiliyor..." : "Bildirimi Gonder"}
      </button>
      {message ? <p className="muted">{message}</p> : null}
    </form>
  );
}
