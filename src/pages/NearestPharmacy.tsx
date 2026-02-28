import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { fetchNearest } from "@/lib/api";
import MainLayout from "@/components/MainLayout";
import PharmacyCard from "@/components/PharmacyCard";
import MapPanel from "@/components/MapPanel";
import { Button } from "@/components/ui/button";

export default function NearestPharmacyPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const { data: pharmacies, isLoading, isError, refetch } = useQuery({
    queryKey: ["nearest", coords?.lat, coords?.lng],
    queryFn: () => fetchNearest(coords!.lat, coords!.lng),
    enabled: !!coords,
    retry: 1,
  });

  const requestLocation = () => {
    setRequesting(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setRequesting(false);
      },
      () => {
        setGeoError(
          "Konum izni verilmedi. En yakın eczaneyi gösterebilmemiz için tarayıcıya konum izni vermeniz gerekiyor."
        );
        setRequesting(false);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  return (
    <MainLayout>
      <div className="container py-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 text-center"
          >
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
          </motion.div>

          {/* Map — shown once we have pharmacy results */}
          {pharmacies && pharmacies.length > 0 && (
            <div className="mb-8">
              <MapPanel pharmacies={pharmacies} />
            </div>
          )}

          {!coords && !geoError && (
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={requestLocation}
                disabled={requesting}
                className="gap-2 rounded-xl"
              >
                {requesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {requesting ? "Konum alınıyor..." : "Konumumu Kullan"}
              </Button>
            </div>
          )}

          {geoError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">Konum izni reddedildi</p>
                <p className="mt-1 text-sm text-muted-foreground">{geoError}</p>
                <Button variant="outline" size="sm" onClick={requestLocation} className="mt-3">
                  Tekrar Dene
                </Button>
              </div>
            </motion.div>
          )}

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {isError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">Eczaneler yüklenemedi</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Bir bağlantı hatası oluştu. Lütfen tekrar deneyin.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
                  Tekrar Dene
                </Button>
              </div>
            </motion.div>
          )}

          {pharmacies && pharmacies.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card py-12 text-center shadow-card"
            >
              <MapPin className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">50 km içinde nöbetçi eczane bulunamadı</p>
              <p className="text-xs text-muted-foreground">İl seçeneğini kullanarak daha geniş arama yapabilirsiniz.</p>
            </motion.div>
          )}

          {pharmacies && pharmacies.length > 0 && (
            <div className="grid gap-4">
              {pharmacies.map((p, i) => (
                <PharmacyCard key={p.id} pharmacy={p} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
