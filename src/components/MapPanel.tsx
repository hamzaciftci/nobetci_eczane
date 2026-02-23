import { Map, ExternalLink } from "lucide-react";
import { Pharmacy } from "@/types/pharmacy";

interface MapPanelProps {
  pharmacies: Pharmacy[];
  collapsed?: boolean;
}

const MapPanel = ({ pharmacies, collapsed = false }: MapPanelProps) => {
  const geoPharmacies = pharmacies.filter((item): item is Pharmacy & { lat: number; lng: number } => item.lat !== null && item.lng !== null);

  if (collapsed || geoPharmacies.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 flex items-center justify-center min-h-[200px]">
        <div className="text-center text-muted-foreground">
          <Map className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs font-medium">
            {geoPharmacies.length === 0 ? "Koordinat bilgisi yok" : "Harita gizli"}
          </p>
        </div>
      </div>
    );
  }

  // Use OSM embed for a lightweight map
  const center = geoPharmacies.length > 0
    ? {
        lat: geoPharmacies.reduce((s, p) => s + (p.lat || 0), 0) / geoPharmacies.length,
        lng: geoPharmacies.reduce((s, p) => s + (p.lng || 0), 0) / geoPharmacies.length,
      }
    : { lat: 39.9334, lng: 32.8597 };

  const bbox = (() => {
    if (geoPharmacies.length === 0) return "";
    const lats = geoPharmacies.map(p => p.lat!);
    const lngs = geoPharmacies.map(p => p.lng!);
    const pad = 0.02;
    return `${Math.min(...lngs) - pad},${Math.min(...lats) - pad},${Math.max(...lngs) + pad},${Math.max(...lats) + pad}`;
  })();

  const osmEmbedUrl = bbox
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`
    : `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - 0.05},${center.lat - 0.05},${center.lng + 0.05},${center.lat + 0.05}&layer=mapnik`;

  const osmFullUrl = `https://www.openstreetmap.org/#map=13/${center.lat}/${center.lng}`;

  return (
    <div className="rounded-lg border overflow-hidden">
      <iframe
        title="Nöbetçi eczane haritası"
        src={osmEmbedUrl}
        className="w-full border-0"
        style={{ height: "360px" }}
        loading="lazy"
      />
      {/* Pharmacy list under map */}
      <div className="p-2.5 space-y-1.5 border-t bg-card max-h-48 overflow-y-auto">
        {geoPharmacies.map((p) => (
          <a
            key={p.id}
            href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-xs group"
          >
            <span className="font-medium text-foreground">{p.name}</span>
            <ExternalLink className="h-2.5 w-2.5 text-muted-foreground group-hover:text-primary shrink-0" />
          </a>
        ))}
      </div>
      <a
        href={osmFullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center text-[10px] text-muted-foreground hover:text-primary py-1.5 border-t transition-colors"
      >
        OpenStreetMap'te aç →
      </a>
    </div>
  );
};

export default MapPanel;
