"use client";

import type { DutyRecordDto } from "../lib/shared";
import dynamic from "next/dynamic";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface MapPanelProps {
  items: DutyRecordDto[];
  title?: string;
}

export function MapPanel({ items, title = "Harita" }: MapPanelProps) {
  const points = items.filter((item) => item.lat !== null && item.lng !== null);
  if (!points.length) {
    return (
      <section className="panel">
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p className="muted">Bu liste icin harita koordinati bulunamadi.</p>
      </section>
    );
  }

  const center = averageCenter(points);

  return (
    <section className="panel">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div className="map-shell">
        <MapContainer center={[center.lat, center.lng]} zoom={12} style={{ width: "100%", height: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((item) => (
            <CircleMarker
              key={`${item.ilce}-${item.eczane_adi}-${item.lat}-${item.lng}`}
              center={[item.lat as number, item.lng as number]}
              radius={8}
              pathOptions={{ color: "#005f46", weight: 2 }}
            >
              <Popup>
                <strong>{item.eczane_adi}</strong>
                <br />
                {item.adres}
                <br />
                <a href={`tel:${item.telefon}`}>Ara</a>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="muted" style={{ marginBottom: 0, marginTop: 8 }}>
        Harita: OpenStreetMap + Leaflet
      </p>
    </section>
  );
}

function averageCenter(items: DutyRecordDto[]) {
  const valid = items.filter((item) => item.lat !== null && item.lng !== null);
  const total = valid.reduce(
    (acc, item) => ({
      lat: acc.lat + (item.lat as number),
      lng: acc.lng + (item.lng as number)
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / valid.length,
    lng: total.lng / valid.length
  };
}
