import { DutyRecordDto } from "@nobetci/shared";
import { toAppleMapsUrl, toGoogleMapsUrl, toOsmUrl } from "../lib/maps";
import { SourceBadge } from "./source-badge";

interface PharmacyCardProps {
  item: DutyRecordDto;
}

export function PharmacyCard({ item }: PharmacyCardProps) {
  return (
    <article className="panel">
      <h3 style={{ marginTop: 0 }}>{item.eczane_adi}</h3>
      <p className="muted">{item.adres}</p>
      <SourceBadge
        source={item.kaynak}
        updatedAt={item.son_guncelleme}
        verificationCount={item.dogrulama_kaynagi_sayisi}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <a className="btn primary" href={`tel:${item.telefon}`}>
          Tek Tikla Ara
        </a>
        {item.lat !== null && item.lng !== null ? (
          <>
            <a className="btn" href={toOsmUrl(item.lat, item.lng)} target="_blank" rel="noreferrer">
              OSM
            </a>
            <a className="btn" href={toGoogleMapsUrl(item.lat, item.lng)} target="_blank" rel="noreferrer">
              Google Maps
            </a>
            <a className="btn" href={toAppleMapsUrl(item.lat, item.lng)} target="_blank" rel="noreferrer">
              Apple Maps
            </a>
          </>
        ) : null}
      </div>
    </article>
  );
}
