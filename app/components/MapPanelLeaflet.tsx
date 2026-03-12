"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Map } from "lucide-react";
import type { Pharmacy } from "@/app/lib/duty";

interface Props {
  pharmacies: Pharmacy[];
}

type GeoPharmacy = Pharmacy & { lat: number; lng: number };

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44">
  <rect x="1" y="1" width="32" height="32" rx="6" fill="#C21A26"/>
  <rect x="7" y="8" width="20" height="3.5" fill="white"/>
  <rect x="7" y="8" width="3.5" height="18" fill="white"/>
  <rect x="7" y="15.5" width="14" height="3" fill="white"/>
  <rect x="7" y="22.5" width="20" height="3.5" fill="white"/>
  <path d="M17 44 L7 32 L27 32 Z" fill="#C21A26"/>
</svg>`;

const pharmacyIcon = L.divIcon({
  html: PIN_SVG,
  className: "",
  iconSize: [34, 44],
  iconAnchor: [17, 44],
  popupAnchor: [0, -46],
});

function BoundsUpdater({ pharmacies }: { pharmacies: GeoPharmacy[] }) {
  const map = useMap();
  useEffect(() => {
    if (pharmacies.length === 0) return;
    const bounds = L.latLngBounds(pharmacies.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [pharmacies, map]);
  return null;
}

export default function MapPanelLeaflet({ pharmacies }: Props) {
  const geo = pharmacies.filter(
    (p): p is GeoPharmacy =>
      typeof p.lat === "number" &&
      typeof p.lng === "number" &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng)
  );

  if (geo.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 flex items-center justify-center min-h-[200px]">
        <div className="text-center text-muted-foreground">
          <Map className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs font-medium">Koordinat bilgisi yok</p>
        </div>
      </div>
    );
  }

  const center: [number, number] = [
    geo.reduce((s, p) => s + p.lat, 0) / geo.length,
    geo.reduce((s, p) => s + p.lng, 0) / geo.length,
  ];

  return (
    <div className="rounded-lg border overflow-hidden">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "380px" }}
        className="w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <BoundsUpdater pharmacies={geo} />
        {geo.map((p, i) => {
          const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
          return (
            <Marker
              key={`${p.eczane_adi}-${i}`}
              position={[p.lat, p.lng]}
              icon={pharmacyIcon}
            >
              <Popup minWidth={180} maxWidth={240}>
                <div style={{ fontFamily: "inherit", lineHeight: 1.4 }}>
                  <p style={{ fontWeight: 700, fontSize: "13px", margin: "0 0 4px" }}>
                    {p.eczane_adi}
                  </p>
                  {p.adres && (
                    <p style={{ fontSize: "11px", color: "#666", margin: "0 0 8px" }}>
                      {p.adres}
                    </p>
                  )}
                  {p.telefon && (
                    <a
                      href={`tel:${p.telefon.replace(/\s/g, "")}`}
                      style={{ display: "block", fontSize: "12px", color: "#2563eb", marginBottom: "6px" }}
                    >
                      {p.telefon}
                    </a>
                  )}
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#C21A26", fontWeight: 600, fontSize: "12px", textDecoration: "none" }}
                  >
                    Yol Tarifi Alın →
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
