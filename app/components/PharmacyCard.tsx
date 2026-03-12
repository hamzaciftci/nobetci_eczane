"use client";

import { AlertTriangle, ArrowUpRight } from "lucide-react";
import type { Pharmacy } from "@/app/lib/duty";
import { EczaneLogoIcon } from "@/app/components/EczaneLogoIcon";

// Nöbet dönemi metnini döndürür — nöbet her gün 08:00 İstanbul saatiyle değişir.
function getDutyPeriodText(): string {
  const now = new Date();
  const istMs = now.getTime() + 3 * 60 * 60 * 1000;
  const ist = new Date(istMs);
  const istHour = ist.getUTCHours();
  const duty = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  if (istHour < 8) duty.setUTCDate(duty.getUTCDate() - 1);
  const next = new Date(duty);
  next.setUTCDate(duty.getUTCDate() + 1);
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  const days = ["Pazar","Pzt.","Salı","Çrş.","Prş.","Cuma","C.tesi"];
  const lbl = (d: Date) => `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${days[d.getUTCDay()]}`;
  return `${lbl(duty)} akşamından ${lbl(next)} sabahına kadar`;
}

interface Props {
  pharmacy: Pharmacy;
  onReport?: (pharmacy: Pharmacy) => void;
  index?: number;
}

export function PharmacyCard({ pharmacy: p, onReport, index = 0 }: Props) {
  const hasCoords = p.lat !== null && p.lng !== null;
  const googleUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.adres + " " + p.il)}`;
  const phoneClean = p.telefon ? p.telefon.replace(/\s/g, "") : null;

  return (
    <div style={{ animationDelay: `${index * 40}ms` }} className="animate-fade-in">
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:bg-muted/40">
        {/* Icon */}
        <div className="hidden shrink-0 sm:flex h-14 w-14 items-center justify-center rounded-md bg-[#C21A26]/[0.08]">
          <EczaneLogoIcon className="h-12 w-12 text-[#C21A26]" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-[15px] font-bold text-card-foreground leading-snug">{p.eczane_adi}</h3>
            {p.ilce && <span className="text-xs font-medium text-muted-foreground">{p.ilce}</span>}
          </div>
          {p.adres && (
            <p className="mt-0.5 text-sm text-muted-foreground leading-snug line-clamp-2">{p.adres}</p>
          )}
          {p.telefon && (
            <a href={`tel:${phoneClean}`} className="mt-0.5 inline-block text-sm font-medium text-blue-600 hover:underline">
              {p.telefon}
            </a>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground/80">{getDutyPeriodText()}</p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <a href={googleUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-semibold text-[#C21A26] transition-opacity hover:opacity-70">
            Yol Tarifi Alın <ArrowUpRight className="h-4 w-4" />
          </a>
          {phoneClean && (
            <a href={`tel:${phoneClean}`} className="flex items-center gap-1 text-sm font-semibold text-[#C21A26] transition-opacity hover:opacity-70">
              Hemen Arayın <ArrowUpRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {onReport && (
        <button onClick={() => onReport(p)}
          className="mt-1 flex w-full items-center gap-1 px-1 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none">
          <AlertTriangle className="h-3 w-3" />
          Yanlış bilgi bildir
        </button>
      )}
    </div>
  );
}

export default PharmacyCard;
