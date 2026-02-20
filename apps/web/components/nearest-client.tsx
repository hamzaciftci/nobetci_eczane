"use client";

import { useMemo, useState } from "react";
import { DutyRecordDto } from "@nobetci/shared";
import { distanceKm } from "../lib/client-distance";
import { toGoogleMapsUrl } from "../lib/maps";

interface NearestClientProps {
  items: DutyRecordDto[];
}

interface NearestItem extends DutyRecordDto {
  distance_km: number;
}

export function NearestClient({ items }: NearestClientProps) {
  const mappable = useMemo(() => items.filter((item) => item.lat !== null && item.lng !== null), [items]);
  const [result, setResult] = useState<NearestItem[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function findNearest() {
    if (!navigator.geolocation) {
      setState("error");
      setErrorMessage("Tarayici konum ozelligini desteklemiyor.");
      return;
    }

    if (!mappable.length) {
      setState("error");
      setErrorMessage("Mesafe hesaplamak icin koordinat bulunamadi.");
      return;
    }

    setState("loading");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = mappable
          .map((item) => ({
            ...item,
            distance_km: distanceKm(pos.coords.latitude, pos.coords.longitude, item.lat as number, item.lng as number)
          }))
          .sort((a, b) => a.distance_km - b.distance_km)
          .slice(0, 3);
        setResult(nearest);
        setState("ready");
      },
      (err) => {
        setState("error");
        setErrorMessage(err.message || "Konum izni alinamadi.");
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60_000
      }
    );
  }

  return (
    <section className="panel">
      <h3 style={{ marginTop: 0 }}>En Yakin Nobetci (Client-Side)</h3>
      <p className="muted">Konumunuz sunucuya gonderilmez. Mesafe hesabi sadece tarayicida yapilir.</p>
      <button type="button" className="btn primary" onClick={findNearest} disabled={state === "loading"}>
        {state === "loading" ? "Konum Aliniyor..." : "En Yakin Eczaneyi Bul"}
      </button>

      {state === "error" && errorMessage ? (
        <p className="danger" style={{ marginBottom: 0 }}>
          {errorMessage}
        </p>
      ) : null}

      {state === "ready" ? (
        <div className="grid" style={{ marginTop: 10 }}>
          {result.map((item) => (
            <article className="panel" key={`${item.eczane_adi}-${item.distance_km}`}>
              <strong>{item.eczane_adi}</strong>
              <p className="muted" style={{ margin: "6px 0" }}>
                Mesafe: {item.distance_km} km
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="btn primary" href={`tel:${item.telefon}`}>
                  Ara
                </a>
                <a className="btn" href={toGoogleMapsUrl(item.lat as number, item.lng as number)} target="_blank" rel="noreferrer">
                  Rotada Ac
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
