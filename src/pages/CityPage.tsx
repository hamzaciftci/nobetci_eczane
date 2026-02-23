import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronRight, AlertCircle, MapPin, ShieldCheck, Printer,
  Monitor, Loader2, MapPinned, Navigation, Info
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/MainLayout";
import PharmacyCard from "@/components/PharmacyCard";
import MapPanel from "@/components/MapPanel";
import DegradedBanner from "@/components/DegradedBanner";
import SourcePanel from "@/components/SourcePanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import ErrorState from "@/components/ErrorState";
import { PharmacySkeletonList } from "@/components/PharmacySkeleton";
import ReportModal from "@/components/ReportModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pharmacy } from "@/types/pharmacy";
import { buildSourceInfo, extractDistricts, fetchDutyByDistrict, fetchDutyByProvince } from "@/lib/api";
import { findProvince } from "@/lib/cities";

export default function CityPage() {
  const { il, ilce } = useParams<{ il: string; ilce?: string }>();
  const navigate = useNavigate();
  const province = findProvince(il || "");

  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(ilce || null);
  const [reportTarget, setReportTarget] = useState<Pharmacy | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    setSelectedDistrict(ilce || null);
  }, [ilce, il]);

  const provinceQuery = useQuery({
    queryKey: ["duty", il],
    queryFn: () => fetchDutyByProvince(il || ""),
    enabled: Boolean(il),
    staleTime: 1000 * 60,
  });

  const districtQuery = useQuery({
    queryKey: ["duty", il, selectedDistrict],
    queryFn: () => fetchDutyByDistrict(il || "", selectedDistrict || ""),
    enabled: Boolean(il && selectedDistrict),
    staleTime: 1000 * 60,
  });

  const activeDuty = selectedDistrict ? districtQuery.data : provinceQuery.data;
  const districts = useMemo(
    () => extractDistricts(provinceQuery.data?.data ?? activeDuty?.data ?? []),
    [provinceQuery.data?.data, activeDuty?.data]
  );

  const cityName = activeDuty?.data[0]?.city ?? province?.name ?? titleFromSlug(il || "");
  const selectedDistrictName =
    districts.find((d) => d.slug === selectedDistrict)?.name ?? titleFromSlug(selectedDistrict || "");
  const sourceInfo = useMemo(
    () =>
      activeDuty
        ? buildSourceInfo(activeDuty)
        : { name: "Bilinmiyor", url: null, lastUpdated: new Date().toISOString(), verificationCount: 0, status: "normal" as const },
    [activeDuty]
  );

  const hasDegraded = (activeDuty?.status ?? "ok") === "degraded";
  const isLoading = provinceQuery.isLoading || (Boolean(selectedDistrict) && districtQuery.isLoading);
  const hasError = selectedDistrict ? districtQuery.isError && !districtQuery.data : provinceQuery.isError;

  const printHref = selectedDistrict
    ? `/nobetci-eczane/${il}/${selectedDistrict}/yazdir`
    : `/nobetci-eczane/${il}/yazdir`;
  const screenHref = selectedDistrict
    ? `/nobetci-eczane/${il}/${selectedDistrict}/ekran`
    : `/nobetci-eczane/${il}/ekran`;

  const handleDistrictSelect = useCallback(
    (slug: string | null) => {
      setSelectedDistrict(slug);
      if (slug) {
        navigate(`/il/${il}/${slug}`, { replace: true });
      } else {
        navigate(`/il/${il}`, { replace: true });
      }
    },
    [il, navigate]
  );

  const handleRefresh = useCallback(() => {
    void provinceQuery.refetch();
    if (selectedDistrict) void districtQuery.refetch();
  }, [provinceQuery, districtQuery, selectedDistrict]);

  const today = new Date().toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <MainLayout>
      <div className="container py-8 md:py-12">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-primary">Türkiye</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{cityName}</span>
          {selectedDistrict && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{selectedDistrictName}</span>
            </>
          )}
        </nav>

        {/* Header card */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="p-6 md:p-8">
            <div className="mb-4 flex justify-center">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                {selectedDistrict
                  ? `${selectedDistrictName} nöbetçi eczaneler`
                  : "İl geneli nöbetçi eczane listesi"}
              </Badge>
            </div>
            <h1 className="text-center text-2xl font-extrabold uppercase tracking-tight text-foreground md:text-3xl">
              {selectedDistrict ? `${selectedDistrictName}, ` : ""}{cityName} NÖBETÇİ ECZANELER
            </h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Tarih: {today}
              {activeDuty && (
                <> · Son güncelleme:{" "}
                  {new Date(activeDuty.son_guncelleme ?? Date.now()).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </>
              )}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {activeDuty?.status === "ok" && (
                <Badge variant="secondary" className="gap-1.5 rounded-lg">
                  <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                  Doğrulandı
                </Badge>
              )}
              <Badge variant="secondary" className="rounded-lg">
                {activeDuty?.data.length ?? 0} eczane
              </Badge>
              {activeDuty?.duty_date && (
                <Badge variant="secondary" className="rounded-lg font-mono">
                  {activeDuty.duty_date}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Degraded banner */}
        {hasDegraded && sourceInfo.lastSuccessfulUpdate && (
          <div className="mb-6">
            <DegradedBanner lastSuccessful={sourceInfo.lastSuccessfulUpdate} onRetry={handleRefresh} />
          </div>
        )}

        {/* Source panel */}
        <div className="mb-6">
          <SourcePanel sourceInfo={sourceInfo} onRefresh={handleRefresh} />
        </div>

        {/* Display modes */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-2 text-base font-bold text-foreground">Gösterim Seçenekleri</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Eczane camına asmak için A4 çıktı alın veya canlı panosunu tam ekranda açın.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={printHref}>
              <Button size="default" className="gap-2 rounded-xl">
                <Printer className="h-4 w-4" />
                A4 Çıktı
              </Button>
            </Link>
            <Link to={screenHref}>
              <Button variant="outline" size="default" className="gap-2 rounded-xl">
                <Monitor className="h-4 w-4" />
                Tam Ekran
              </Button>
            </Link>
          </div>
        </div>

        {/* District filter */}
        {districts.length > 0 && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-base font-bold text-foreground">İlçe Filtresi</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleDistrictSelect(null)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  !selectedDistrict
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "border border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                Tümü
              </button>
              {districts.map((d) => (
                <button
                  key={d.slug}
                  onClick={() => handleDistrictSelect(selectedDistrict === d.slug ? null : d.slug)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                    selectedDistrict === d.slug
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "border border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nearest pharmacy CTA */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-2 text-base font-bold text-foreground">En Yakın Nöbetçi Eczane</h2>
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              <strong>KVKK:</strong> Konumunuz sunucuya gönderilmez. Mesafe hesabı tarayıcıda yapılır.
            </p>
          </div>
          <Link to="/en-yakin">
            <Button className="gap-2 rounded-xl">
              <Navigation className="h-4 w-4" />
              Konuma Göre Bul
            </Button>
          </Link>
        </div>

        {/* Map toggle (mobile) */}
        <button
          onClick={() => setShowMap((v) => !v)}
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-primary focus-visible:outline-none lg:hidden"
        >
          <MapPinned className="h-3.5 w-3.5" />
          {showMap ? "Haritayı gizle" : "Haritayı göster"}
        </button>

        {/* Pharmacy list + map */}
        <ErrorBoundary>
          {hasError ? (
            <ErrorState onRetry={handleRefresh} message="Nöbetçi eczane verileri alınamadı." />
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              <div className="lg:col-span-3 space-y-4">
                {isLoading ? (
                  <PharmacySkeletonList count={4} />
                ) : !activeDuty?.data.length ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card py-16 text-center shadow-card"
                  >
                    <MapPin className="h-12 w-12 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">
                      {selectedDistrict
                        ? "Bu ilçe için nöbetçi eczane bulunamadı"
                        : "Bu tarih için nöbetçi eczane bilgisi bulunamadı"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedDistrict ? "Tümü seçeneğini deneyin." : "Veri güncelleniyor, birazdan tekrar deneyin."}
                    </p>
                    <Link to="/" className="text-sm font-medium text-primary hover:underline">
                      Ana sayfaya dön
                    </Link>
                  </motion.div>
                ) : (
                  activeDuty.data.map((item, i) => (
                    <PharmacyCard key={item.id} pharmacy={item} onReport={setReportTarget} index={i} />
                  ))
                )}
              </div>

              <div className={`lg:col-span-2 ${showMap ? "block" : "hidden lg:block"}`}>
                <div className="sticky top-20">
                  <MapPanel pharmacies={activeDuty?.data ?? []} collapsed={false} />
                </div>
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>

      {reportTarget && <ReportModal pharmacy={reportTarget} onClose={() => setReportTarget(null)} />}
    </MainLayout>
  );
}

function titleFromSlug(slug: string) {
  return slug.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
