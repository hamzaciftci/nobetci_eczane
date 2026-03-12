"use client";

import { useState } from "react";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { PharmacyCard } from "@/app/components/PharmacyCard";
import { MapPanel } from "@/app/components/MapPanel";
import type { Pharmacy } from "@/app/lib/duty";

interface ApiResponse {
  status: string;
  data: Pharmacy[];
}

export function NearestClient() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const requestLocation = () => {
    setLoading(true);
    setGeoError(null);
    setFetchError(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        try {
          const res = await fetch(`/api/nearest?lat=${lat}&lng=${lng}`);
          if (!res.ok) throw new Error("fetch_error");
          const json: ApiResponse = await res.json();
          setPharmacies(json.data ?? []);
        } catch {
          setFetchError(true);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setGeoError(
          "Konum izni verilmedi. En yakın eczaneyi gösterebilmemiz için tarayıcıya konum izni vermeniz gerekiyor."
        );
        setLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <MapPin className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">En Yakın Nöbetçi Eczane</h1>
        <p className="mt-3 text-muted-foreground">
          Konumunuzu paylaşın, size en yakın nöbetçi eczaneleri gösterelim.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Konumunuz sunucuya gönderilmez — 50 km içinde arama yapılır.
        </p>
      </div>

      {/* Map — shown once we have pharmacy results */}
      {pharmacies && pharmacies.length > 0 && (
        <div className="mb-8">
          <MapPanel pharmacies={pharmacies} />
        </div>
      )}

      {/* Location button */}
      {!coords && !geoError && !fetchError && (
        <div className="flex justify-center">
          <button
            onClick={requestLocation}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            {loading ? "Konum alınıyor..." : "Konumumu Kullan"}
          </button>
        </div>
      )}

      {/* Geo error */}
      {geoError && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Konum izni reddedildi</p>
            <p className="mt-1 text-sm text-muted-foreground">{geoError}</p>
            <button
              onClick={requestLocation}
              className="mt-3 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && coords && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Eczaneler yüklenemedi</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Bir bağlantı hatası oluştu. Lütfen tekrar deneyin.
            </p>
            <button
              onClick={requestLocation}
              className="mt-3 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {pharmacies && pharmacies.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-12 text-center shadow-card">
          <MapPin className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">50 km içinde nöbetçi eczane bulunamadı</p>
          <p className="text-xs text-muted-foreground">İl seçeneğini kullanarak daha geniş arama yapabilirsiniz.</p>
        </div>
      )}

      {/* Results */}
      {pharmacies && pharmacies.length > 0 && (
        <div className="grid gap-4">
          {pharmacies.map((p, i) => (
            <PharmacyCard key={`${p.eczane_adi}-${i}`} pharmacy={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
