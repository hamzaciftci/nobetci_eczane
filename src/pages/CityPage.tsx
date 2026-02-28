import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronRight, MapPin, ShieldCheck, Printer,
  Monitor, MapPinned, Navigation, Info
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import MainLayout from "@/components/MainLayout";
import PharmacyCard from "@/components/PharmacyCard";
import MapPanel from "@/components/MapPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import ErrorState from "@/components/ErrorState";
import { PharmacySkeletonList } from "@/components/PharmacySkeleton";
import ReportModal from "@/components/ReportModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pharmacy } from "@/types/pharmacy";
import { extractDistricts, fetchDutyByDistrict, fetchDutyByProvince, fetchDutyDates } from "@/lib/api";
import { findProvince } from "@/lib/cities";

// Istanbul UTC+3 (DST yok) — duty 08:00'de değişir
function getActiveDutyDate(): string {
  const now = new Date();
  const istMs = now.getTime() + 3 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const duty = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  if (ist.getUTCHours() < 8) duty.setUTCDate(duty.getUTCDate() - 1);
  return duty.toISOString().slice(0, 10);
}

const TR_DAYS = ["Paz", "Pzt", "Sal", "Çrş", "Prş", "Cum", "Cmt"];
const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function formatDayTab(dateStr: string, todayDutyDate: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayName = TR_DAYS[d.getUTCDay()];
  const dayNum = d.getUTCDate();
  const monthName = TR_MONTHS[d.getUTCMonth()];
  if (dateStr === todayDutyDate) return `${dayName} ${dayNum} ${monthName} · Bugün`;
  return `${dayName} ${dayNum} ${monthName}`;
}

export default function CityPage() {
  const { il, ilce } = useParams<{ il: string; ilce?: string }>();
  const navigate = useNavigate();
  const province = findProvince(il || "");

  const TODAY_DUTY = getActiveDutyDate();

  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(ilce || null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // null = bugün
  const [reportTarget, setReportTarget] = useState<Pharmacy | null>(null);
  const [showMap, setShowMap] = useState(false);

  // İl değişince tarihi ve ilçeyi sıfırla
  useEffect(() => {
    setSelectedDistrict(ilce || null);
    setSelectedDate(null);
  }, [il, ilce]);

  // Aktif tarih: null → TODAY_DUTY, başka bir değer → o tarih
  const activeTarih = selectedDate ?? TODAY_DUTY;
  // Bugün (view sorgusu) için tarih parametresi gönderilmez; API kendi TODAY'ı kullanır
  const tarihParam = selectedDate; // null = bugün (param göndermiyoruz)

  const provinceQuery = useQuery({
    queryKey: ["duty", il, tarihParam ?? "today"],
    queryFn: () => fetchDutyByProvince(il || "", tarihParam ?? undefined),
    enabled: Boolean(il),
    staleTime: tarihParam ? 1000 * 60 * 60 : 1000 * 60,
  });

  const districtQuery = useQuery({
    queryKey: ["duty", il, selectedDistrict, tarihParam ?? "today"],
    queryFn: () => fetchDutyByDistrict(il || "", selectedDistrict || "", tarihParam ?? undefined),
    enabled: Boolean(il && selectedDistrict),
    staleTime: tarihParam ? 1000 * 60 * 60 : 1000 * 60,
  });

  const datesQuery = useQuery({
    queryKey: ["tarihler", il],
    queryFn: () => fetchDutyDates(il || ""),
    enabled: Boolean(il),
    staleTime: 1000 * 60 * 5,
  });

  const activeDuty = selectedDistrict ? districtQuery.data : provinceQuery.data;
  const districts = useMemo(
    () => extractDistricts(provinceQuery.data?.data ?? activeDuty?.data ?? []),
    [provinceQuery.data?.data, activeDuty?.data]
  );

  const cityName = activeDuty?.data[0]?.city ?? province?.name ?? titleFromSlug(il || "");
  const selectedDistrictName =
    districts.find((d) => d.slug === selectedDistrict)?.name ?? titleFromSlug(selectedDistrict || "");

  const isLoading = provinceQuery.isLoading || (Boolean(selectedDistrict) && districtQuery.isLoading);
  const hasError = selectedDistrict ? districtQuery.isError && !districtQuery.data : provinceQuery.isError;

  const printHref = selectedDistrict
    ? `/il/${il}/${selectedDistrict}/yazdir`
    : `/il/${il}/yazdir`;
  const screenHref = selectedDistrict
    ? `/il/${il}/${selectedDistrict}/ekran`
    : `/il/${il}/ekran`;

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

  const availableDates = datesQuery.data ?? [];
  // Gösterilecek tarih metni: header'da
  const displayDate = new Date(activeTarih + "T00:00:00Z").toLocaleDateString("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC"
  });

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
              Tarih: {displayDate}
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

        {/* Nöbet günü seçici — birden fazla tarih varsa göster */}
        {availableDates.length > 1 && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-base font-bold text-foreground">Nöbet Günü</h2>
            <div className="flex flex-wrap gap-2">
              {availableDates.map((date) => {
                const isActive = date === activeTarih;
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date === TODAY_DUTY ? null : date)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "border border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    {formatDayTab(date, TODAY_DUTY)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Display modes */}
        <div className="mt-8 mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
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
      </div>

      {reportTarget && <ReportModal pharmacy={reportTarget} onClose={() => setReportTarget(null)} />}
    </MainLayout>
  );
}

function titleFromSlug(slug: string) {
  return slug.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
