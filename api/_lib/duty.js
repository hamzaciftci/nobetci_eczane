export function buildDutyResponse(rows, dutyDate) {
  const mapped = rows.map((row) => ({
    eczane_adi: row.eczane_adi,
    il: row.il,
    ilce: row.ilce || "Merkez",
    adres: row.adres,
    telefon: row.telefon,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    kaynak: row.kaynak,
    kaynak_url: row.kaynak_url || "",
    son_guncelleme: toIso(row.son_guncelleme),
    dogruluk_puani: Number(row.dogruluk_puani ?? 0),
    dogrulama_kaynagi_sayisi: Number(row.dogrulama_kaynagi_sayisi ?? 1),
    is_degraded: Boolean(row.is_degraded)
  }));

  const latest = mapped.length
    ? mapped.reduce((max, item) => Math.max(max, new Date(item.son_guncelleme).getTime()), 0)
    : 0;
  const latestIso = latest ? new Date(latest).toISOString() : null;
  const hasDegraded = mapped.some((item) => item.is_degraded);
  const status = hasDegraded || mapped.length === 0 ? "degraded" : "ok";

  return {
    status,
    duty_date: dutyDate ?? null,
    son_guncelleme: latestIso,
    degraded_info:
      status === "degraded"
        ? {
            last_successful_update: latestIso,
            stale_minutes: null,
            recent_alert: null,
            hint: mapped.length ? "Kaynaklar yenileniyor. Biraz sonra tekrar deneyin." : "Bu secim icin aktif nobet kaydi bulunamadi."
          }
        : null,
    data: mapped
  };
}

export function buildNearestResponse(rows) {
  const mapped = rows.map((row) => ({
    eczane_adi: row.eczane_adi,
    il: row.il,
    ilce: row.ilce || "Merkez",
    adres: row.adres,
    telefon: row.telefon,
    lat: Number(row.lat),
    lng: Number(row.lng),
    kaynak: row.kaynak,
    kaynak_url: row.kaynak_url || "",
    son_guncelleme: toIso(row.son_guncelleme),
    dogruluk_puani: Number(row.dogruluk_puani ?? 0),
    dogrulama_kaynagi_sayisi: Number(row.dogrulama_kaynagi_sayisi ?? 1),
    distance_km: Number(Number(row.distance_km).toFixed(3)),
    is_degraded: Boolean(row.is_degraded)
  }));

  return {
    status: mapped.some((item) => item.is_degraded) ? "degraded" : "ok",
    data: mapped.map(({ is_degraded, ...item }) => item)
  };
}

function toIso(value) {
  return new Date(value || Date.now()).toISOString();
}

