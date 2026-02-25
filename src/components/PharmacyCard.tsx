import { Phone, Navigation, MapPin, AlertTriangle, ShieldCheck, Clock, ExternalLink, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { Pharmacy } from "@/types/pharmacy";
import { Badge } from "@/components/ui/badge";
import { formatTimeAgo } from "@/lib/date";

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

  const appleUrl = hasCoords
    ? `https://maps.apple.com/?daddr=${lat},${lng}`
    : `https://maps.apple.com/?q=${encodeURIComponent(pharmacy.address)}`;

  const osmUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover ${
        pharmacy.isDegraded ? "border-accent/40 bg-accent/[0.03]" : "border-border"
      }`}
    >
      {/* Degraded warning */}
      {pharmacy.isDegraded && (
        <div className="flex items-center gap-1.5 border-b border-accent/20 bg-accent/10 px-5 py-2.5 text-xs font-medium text-accent-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Kaynak yenileniyor — veri eski olabilir
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border p-5 pb-4">
        <h3 className="text-[15px] font-bold text-card-foreground leading-tight">
          {pharmacy.name}
        </h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {pharmacy.verificationCount > 0 && (
            <Badge variant="secondary" className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold gap-1">
              <ShieldCheck className="h-3 w-3 text-accent" />
              {pharmacy.verificationCount}×
            </Badge>
          )}
          <Badge variant="secondary" className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold">
            {pharmacy.district}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start gap-2.5 text-sm text-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium leading-snug">{pharmacy.address}</span>
            {pharmacy.addressDetail && (
              <span className="text-xs text-muted-foreground leading-relaxed">
                {pharmacy.addressDetail}
              </span>
            )}
          </div>
        </div>

        {pharmacy.phone && (
          <div className="flex items-center gap-2.5 text-sm">
            <Phone className="h-4 w-4 shrink-0 text-primary" />
            <a
              href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
              className="font-medium text-foreground hover:text-primary transition-colors"
              aria-label={`${pharmacy.name} eczanesini ara`}
            >
              {pharmacy.phone}
            </a>
          </div>
        )}

        {/* Distance badge (nearest mode) */}
        {pharmacy.distance !== undefined && (
          <Badge variant="outline" className="w-fit rounded-full border-accent/40 bg-accent/5 text-xs font-semibold text-accent">
            {pharmacy.distance < 1
              ? `${Math.round(pharmacy.distance * 1000)} m uzaklıkta`
              : `${pharmacy.distance.toFixed(1)} km uzaklıkta`}
          </Badge>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-5 py-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatTimeAgo(pharmacy.lastUpdated)}
        </span>
        {pharmacy.sourceUrl ? (
          <a
            href={pharmacy.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            {pharmacy.source}
          </a>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            {pharmacy.source}
          </span>
        )}
        {pharmacy.accuracyScore > 0 && (
          <span className="text-[11px] text-muted-foreground">
            Güven: %{Math.round(pharmacy.accuracyScore)}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex border-t border-border">
        {pharmacy.phone ? (
          <a
            href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
            className="flex flex-1 items-center justify-center gap-2 border-r border-border py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            aria-label={`${pharmacy.name} eczanesini ara`}
          >
            <Phone className="h-4 w-4" />
            Ara
          </a>
        ) : (
          <span
            className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 border-r border-border py-3.5 text-sm font-semibold text-muted-foreground opacity-40"
            title="Telefon numarası yok"
          >
            <Phone className="h-4 w-4" />
            Ara
          </span>
        )}
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 border-r border-border py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          <Navigation className="h-4 w-4" />
          Yol Tarifi
        </a>
        {osmUrl ? (
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-14 items-center justify-center py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="OpenStreetMap"
          >
            <Globe className="h-4 w-4" />
          </a>
        ) : (
          <span className="flex w-14 cursor-not-allowed items-center justify-center py-3.5 opacity-30" title="Koordinat yok">
            <Globe className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
      </div>

      {/* Report wrong info */}
      {onReport && (
        <button
          onClick={() => onReport(pharmacy)}
          className="border-t border-border px-5 py-2.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Yanlış bilgi bildir
        </button>
      )}
    </motion.div>
  );
};

export default PharmacyCard;
