"use client";

/**
 * En yakın nöbetçi eczane bulucu — browser geolocation + /api/nearest
 *
 * Akış:
 *  1. Sayfa yüklendiğinde "Konumu Bul" butonu gösterilir.
 *  2. Kullanıcı butona tıklar → navigator.geolocation.getCurrentPosition()
 *  3. Koordinatlar /api/nearest?lat=X&lng=Y'ye gönderilir.
 *  4. Sonuçlar kart listesi olarak render edilir (mesafe + harita linki).
 */

import { useState } from "react";
import { Navigation, MapPin, Phone, Map, AlertCircle, Loader2 } from "lucide-react";

interface PharmacyResult {
  eczane_adi: string;
  adres: string;
  ilce: string;
  il: string;
  telefon?: string;
  lat?: number;
  lng?: number;
  distance_km?: number;
}

interface ApiResponse {
  status: string;
  data: PharmacyResult[];
}

type State =
  | { phase: "idle" }
  | { phase: "locating" }
  | { phase: "loading" }
  | { phase: "done"; results: PharmacyResult[]; lat: number; lng: number }
  | { phase: "error"; message: string };

function mapsUrl(p: PharmacyResult): string {
  if (p.lat != null && p.lng != null) {
    return `https://www.google.com/maps?q=${p.lat},${p.lng}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(`${p.eczane_adi} ${p.adres} ${p.il}`)}`;
}

function kmLabel(km?: number): string {
  if (km == null) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function NearestClient() {
  const [state, setState] = useState<State>({ phase: "idle" });

  async function handleLocate() {
    if (!navigator.geolocation) {
      setState({ phase: "error", message: "Tarayıcınız konum hizmetini desteklemiyor." });
      return;
    }

    setState({ phase: "locating" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setState({ phase: "loading" });

        try {
          const res = await fetch(`/api/nearest?lat=${lat}&lng=${lng}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json: ApiResponse = await res.json();

          if (!json.data?.length) {
            setState({
              phase: "error",
              message: "Yakınınızda nöbetçi eczane bulunamadı. Lütfen il sayfasından bakın.",
            });
            return;
          }

          setState({ phase: "done", results: json.data, lat, lng });
        } catch {
          setState({ phase: "error", message: "Veriler alınamadı. Lütfen tekrar deneyin." });
        }
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: "Konum izni reddedildi. Tarayıcı ayarlarından konum iznini etkinleştirin.",
          2: "Konumunuz alınamadı. Lütfen tekrar deneyin.",
          3: "Konum isteği zaman aşımına uğradı. Lütfen tekrar deneyin.",
        };
        setState({ phase: "error", message: msgs[err.code] ?? "Konum alınamadı." });
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  }

  // ── Idle ────────────────────────────────────────────────────────────────────
  if (state.phase === "idle") {
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Navigation className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        <h2 className="mb-2 text-xl font-bold text-blue-900">
          Konumunuza En Yakın Nöbetçi Eczaneleri Bulun
        </h2>
        <p className="mb-6 text-sm text-blue-700">
          GPS konumunuzu kullanarak yakınınızdaki açık eczaneleri listeleyebilirsiniz.
        </p>
        <button
          onClick={handleLocate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
        >
          <Navigation className="h-5 w-5" />
          Konumumu Kullan
        </button>
        <p className="mt-3 text-xs text-blue-500">
          Konum bilginiz yalnızca eczane araması için kullanılır, saklanmaz.
        </p>
      </div>
    );
  }

  // ── Locating / Loading ───────────────────────────────────────────────────────
  if (state.phase === "locating" || state.phase === "loading") {
    const msg = state.phase === "locating" ? "Konumunuz alınıyor…" : "Yakın eczaneler aranıyor…";
    return (
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8 text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-600" />
        <p className="text-blue-800 font-medium">{msg}</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (state.phase === "error") {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">{state.message}</p>
          </div>
        </div>
        <button
          onClick={() => setState({ phase: "idle" })}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Konumunuza göre <strong>{state.results.length}</strong> nöbetçi eczane listelendi
        </p>
        <button
          onClick={() => setState({ phase: "idle" })}
          className="text-xs text-blue-600 hover:underline"
        >
          Konumu Değiştir
        </button>
      </div>

      <ul className="space-y-3">
        {state.results.map((p, i) => (
          <li
            key={i}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 shrink-0">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-gray-900 truncate">{p.eczane_adi}</h3>
                  {p.distance_km != null && (
                    <span className="ml-auto shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {kmLabel(p.distance_km)}
                    </span>
                  )}
                </div>

                <p className="flex items-start gap-1 text-sm text-gray-600 mb-2">
                  <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
                  {p.adres}
                  {p.ilce && p.il && (
                    <span className="text-gray-400 ml-1">· {p.ilce}/{p.il}</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {p.telefon && (
                <a
                  href={`tel:${p.telefon.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {p.telefon}
                </a>
              )}
              <a
                href={mapsUrl(p)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Map className="h-3.5 w-3.5" />
                Haritada Gör
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
