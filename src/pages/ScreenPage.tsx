import { useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { Phone, RefreshCcw, Maximize, Minimize, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDutyByDistrict, fetchDutyByProvince } from "@/lib/api";
import { formatTimeAgo } from "@/lib/date";

const ScreenPage = () => {
  const { il, ilce } = useParams<{ il: string; ilce?: string }>();
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const query = useQuery({
    queryKey: ["screen-duty", il, ilce],
    queryFn: () => (ilce ? fetchDutyByDistrict(il || "", ilce) : fetchDutyByProvince(il || "")),
    enabled: Boolean(il),
    staleTime: 1000 * 30
  });

  const pharmacies = query.data?.data ?? [];
  const cityName = pharmacies[0]?.city ?? titleFromSlug(il || "");
  const districtName = ilce ? pharmacies[0]?.district ?? titleFromSlug(ilce) : null;

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setNow(new Date());
          void query.refetch();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [query]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "f" || event.key === "F") {
        toggleFullscreen();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggleFullscreen]);

  const today = now.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const time = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="screen-shell min-h-screen text-background p-6 sm:p-8 lg:p-10 flex flex-col select-none">
      <div className="flex items-start justify-between mb-6 lg:mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold leading-tight">
            {districtName ? `${districtName} / ${cityName}` : cityName}
          </h1>
          <p className="text-lg sm:text-xl lg:text-2xl opacity-70 mt-1 font-body">Nobetci Eczaneler</p>
        </div>
        <div className="text-right">
          <p className="text-3xl sm:text-4xl lg:text-6xl font-display font-bold tabular-nums">{time}</p>
          <p className="text-sm lg:text-base opacity-60 mt-1 font-body">{today}</p>
        </div>
      </div>

      <div className="flex-1 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 overflow-auto pr-1">
        {query.isLoading &&
          Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-background/15 p-4 lg:p-5 animate-pulse">
              <div className="h-6 w-1/2 bg-background/10 rounded mb-3" />
              <div className="h-4 w-full bg-background/10 rounded mb-2" />
              <div className="h-4 w-2/3 bg-background/10 rounded" />
            </div>
          ))}

        {!query.isLoading &&
          pharmacies.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-background/15 p-4 lg:p-5 flex flex-col justify-between hover:border-background/30 transition-colors bg-background/5"
            >
              <div>
                <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold mb-1.5 leading-tight">{item.name}</h2>
                <p className="text-xs lg:text-sm opacity-70 leading-relaxed">{item.address}</p>
                <p className="text-[10px] lg:text-xs opacity-50 mt-1">{item.district}</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Phone className="h-4 w-4 lg:h-5 lg:w-5 opacity-60" />
                <span className="text-base lg:text-lg font-semibold tracking-wide font-body">{item.phone}</span>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-4 lg:mt-6 flex items-center justify-between text-xs opacity-60 font-body">
        <div className="flex items-center gap-3">
          <span>Kaynak: {pharmacies[0]?.source || "Eczaci Odasi"}</span>
          {pharmacies[0]?.sourceUrl && (
            <a href={pharmacies[0].sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:opacity-80">
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <span>Durum: {query.data?.status === "degraded" ? "DEGRADED" : "DOGRULANDI"}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <RefreshCcw className={`h-3 w-3 ${countdown <= 5 ? "animate-spin" : ""}`} />
            {countdown}s
          </span>
          <span>Son guncelleme: {pharmacies[0] ? formatTimeAgo(pharmacies[0].lastUpdated) : "-"}</span>
          <button onClick={toggleFullscreen} className="p-1 rounded hover:opacity-70 transition-opacity" title="Tam ekran (F)">
            {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default ScreenPage;

