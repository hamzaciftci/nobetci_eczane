"use client";

import { FormEvent, useState } from "react";
import { publicEnv } from "../../lib/env";

const API_BASE_URL = publicEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");

interface ManualOverrideFormProps {
  provinces: string[];
}

export function ManualOverrideForm({ provinces }: ManualOverrideFormProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      il: String(formData.get("il") ?? ""),
      ilce: String(formData.get("ilce") ?? ""),
      eczane_adi: String(formData.get("eczane_adi") ?? ""),
      adres: String(formData.get("adres") ?? ""),
      telefon: String(formData.get("telefon") ?? ""),
      lat: toNumberOrUndefined(formData.get("lat")),
      lng: toNumberOrUndefined(formData.get("lng")),
      duty_date: String(formData.get("duty_date") ?? "") || undefined,
      dogruluk_puani: toNumberOrUndefined(formData.get("dogruluk_puani")),
      dogrulama_kaynagi_sayisi: toNumberOrUndefined(formData.get("dogrulama_kaynagi_sayisi")),
      source_note: String(formData.get("source_note") ?? "") || undefined,
      updated_by: String(formData.get("updated_by") ?? "") || undefined
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/ingestion/manual-override`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {})
        },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      if (!response.ok) {
        setMessage(`Manual override hatasi: ${text}`);
        return;
      }

      setMessage("Manual override kaydi yazildi ve cache temizlendi.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Manual override istegi basarisiz");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h3 style={{ marginTop: 0 }}>Manual Override</h3>
      <p className="muted">Admin panelden manuel nobet kaydi yazilir; duty record ve evidence tablosu guncellenir.</p>
      <form className="grid" onSubmit={submit}>
        <input
          className="btn"
          type="password"
          placeholder="Admin token (opsiyonel)"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
        />
        <label className="muted">
          Il
          <select className="btn" name="il" defaultValue={provinces[0] ?? ""} required>
            {provinces.map((il) => (
              <option key={il} value={il}>
                {il}
              </option>
            ))}
          </select>
        </label>
        <input className="btn" name="ilce" placeholder="Ilce" required />
        <input className="btn" name="eczane_adi" placeholder="Eczane Adi" required />
        <input className="btn" name="adres" placeholder="Adres" required />
        <input className="btn" name="telefon" placeholder="Telefon" required />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="btn" name="lat" placeholder="Lat (opsiyonel)" />
          <input className="btn" name="lng" placeholder="Lng (opsiyonel)" />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="btn" name="duty_date" placeholder="YYYY-MM-DD (opsiyonel)" />
          <input className="btn" name="dogruluk_puani" placeholder="Dogruluk puani (default 100)" />
          <input className="btn" name="dogrulama_kaynagi_sayisi" placeholder="Kaynak sayisi (default 1)" />
        </div>
        <input className="btn" name="updated_by" placeholder="Guncelleyen (opsiyonel)" />
        <textarea className="btn" name="source_note" placeholder="Not (opsiyonel)" rows={3} />
        <button type="submit" className="btn primary" disabled={busy}>
          {busy ? "Kaydediliyor..." : "Manual Override Kaydet"}
        </button>
        {message ? <p className="muted">{message}</p> : null}
      </form>
    </section>
  );
}

function toNumberOrUndefined(value: FormDataEntryValue | null): number | undefined {
  if (value === null || String(value).trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
