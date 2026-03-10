import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Pharmacy } from "@/types/pharmacy";
import EczaneLogoIcon from "@/components/EczaneLogoIcon";

// Nöbet dönemi metnini döndürür.
// Nöbet her gün 08:00 İstanbul saatiyle değişir.
// Örnek: "27 Şubat Cuma akşamından 28 Şubat C.tesi sabahına kadar"
function getDutyPeriodText(): string {
  const now = new Date();
  // Istanbul = UTC+3 (Türkiye DST uygulamıyor)
  const istMs = now.getTime() + 3 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const istHour = ist.getUTCHours();

  // 08:00'den önce dünün nöbeti gösterilir
  const duty = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  if (istHour < 8) duty.setUTCDate(duty.getUTCDate() - 1);

  const next = new Date(duty);
  next.setUTCDate(duty.getUTCDate() + 1);

  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const days   = ["Pazar","Pzt.","Salı","Çrş.","Prş.","Cuma","C.tesi"];
  const lbl = (d: Date) => `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${days[d.getUTCDay()]}`;

  return `${lbl(duty)} akşamından ${lbl(next)} sabahına kadar`;
}

interface PharmacyCardProps {
  pharmacy: Pharmacy;
  onReport?: (pharmacy: Pharmacy) => void;
  index?: number;
}

const PharmacyCard = ({ pharmacy, onReport, index = 0 }: PharmacyCardProps) => {
  const hasCoords = pharmacy.lat !== null && pharmacy.lng !== null;
  const lat = pharmacy.lat ?? 0;
  const lng = pharmacy.lng ?? 0;

  const googleUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.address)}`;

  const phoneClean = pharmacy.phone ? pharmacy.phone.replace(/\s/g, "") : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      {/* Degraded warning */}
      {pharmacy.isDegraded && (
        <div className="flex items-center gap-1.5 rounded-t-lg border border-b-0 border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Kaynak yenileniyor — veri eski olabilir
        </div>
      )}

      {/* Main row */}
      <div
        className={`flex items-center gap-4 border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40 ${
          pharmacy.isDegraded
            ? "rounded-b-lg border-amber-200 dark:border-amber-800/40"
            : "rounded-lg"
        }`}
      >
        {/* Icon */}
        <div className="hidden shrink-0 sm:flex h-14 w-14 items-center justify-center rounded-md bg-[#C21A26]/8 dark:bg-[#C21A26]/15">
          <EczaneLogoIcon className="h-12 w-12 text-[#C21A26]" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-[15px] font-bold text-card-foreground leading-snug">
              {pharmacy.name}
            </h3>
            {pharmacy.district && (
              <span className="text-xs font-medium text-muted-foreground">
                {pharmacy.district}
              </span>
            )}
            {pharmacy.distance !== undefined && (
              <span className="text-xs font-semibold text-[#C21A26]">
                {pharmacy.distance < 1
                  ? `${Math.round(pharmacy.distance * 1000)} m`
                  : `${pharmacy.distance.toFixed(1)} km`}
              </span>
            )}
          </div>

          {pharmacy.address && (
            <p className="mt-0.5 text-sm text-muted-foreground leading-snug line-clamp-2">
              {pharmacy.address}
              {pharmacy.addressDetail && (
                <span className="block text-xs">{pharmacy.addressDetail}</span>
              )}
            </p>
          )}

          {pharmacy.phone && (
            <a
              href={`tel:${phoneClean}`}
              className="mt-0.5 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              aria-label={`${pharmacy.name} ara`}
            >
              {pharmacy.phone}
            </a>
          )}

          <p className="mt-1 text-[11px] text-muted-foreground/80">
            {getDutyPeriodText()}
          </p>
        </div>

        {/* Action links */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-semibold text-[#C21A26] transition-opacity hover:opacity-70"
          >
            Yol Tarifi Alın
            <ArrowUpRight className="h-4 w-4" />
          </a>
          {phoneClean && (
            <a
              href={`tel:${phoneClean}`}
              className="flex items-center gap-1 text-sm font-semibold text-[#C21A26] transition-opacity hover:opacity-70"
              aria-label={`${pharmacy.name} ara`}
            >
              Hemen Arayın
              <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Report wrong info */}
      {onReport && (
        <button
          onClick={() => onReport(pharmacy)}
          className="mt-1 flex w-full items-center gap-1 px-1 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none"
        >
          <AlertTriangle className="h-3 w-3" />
          Yanlış bilgi bildir
        </button>
      )}
    </motion.div>
  );
};

export default PharmacyCard;
