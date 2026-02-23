/**
 * /embed/:il — minimal widget page for embedding in third-party sites via iframe.
 *
 * Requirements:
 *  - No header/footer (minimal chrome)
 *  - Shows up to 5 pharmacies for the given il
 *  - "Powered by" link at bottom
 *  - Dark mode compatible (respects prefers-color-scheme)
 *  - X-Frame-Options must allow this route (handled by Vercel config, not here)
 */

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Phone, Navigation, MapPin, Loader2, ExternalLink, Cross } from "lucide-react";
import { fetchDutyByProvince } from "@/lib/api";
import { findProvince } from "@/lib/cities";

export default function EmbedWidget() {
  const { il } = useParams<{ il: string }>();
  const province = findProvince(il || "");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["embed-duty", il],
    queryFn: () => fetchDutyByProvince(il || ""),
    enabled: Boolean(il),
    staleTime: 1000 * 60 * 5,
  });

  const pharmacies = (data?.data ?? []).slice(0, 5);

  return (
    <div className="min-h-screen bg-card text-card-foreground">
      {/* Widget header */}
      <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3">
        <div className="flex items-center gap-2">
          <Cross className="h-4 w-4 text-primary-foreground" />
          <span className="text-sm font-semibold text-primary-foreground">
            {province?.name ?? il} — Nöbetçi Eczaneler
          </span>
        </div>
        {data?.duty_date && (
          <span className="text-[10px] text-primary-foreground/70">{data.duty_date}</span>
        )}
      </div>

      {/* Content */}
      <div className="p-2">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center py-10 text-center">
            <p className="text-sm text-muted-foreground">Veriler yüklenemedi.</p>
          </div>
        )}

        {!isLoading && !isError && pharmacies.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Bugün nöbetçi eczane bulunamadı.</p>
          </div>
        )}

        {pharmacies.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border-b border-border px-3 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-card-foreground">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">{p.district} · {p.address}</p>
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-2">
              <a
                href={`tel:${p.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                title={`Ara: ${p.phone}`}
              >
                <Phone className="h-3 w-3" />
                Ara
              </a>
              {p.lat && p.lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                  title="Yol tarifi"
                >
                  <Navigation className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Powered by footer */}
      <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-center">
        <a
          href={`/il/${il}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Tüm liste · powered by Nöbetçi Eczane
        </a>
      </div>
    </div>
  );
}
