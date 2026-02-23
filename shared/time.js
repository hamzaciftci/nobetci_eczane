/**
 * Canonical duty date resolution — JavaScript runtime.
 *
 * Nöbet dönemi: 08:00 Istanbul'dan ertesi gün 08:00'a kadar sürer.
 *   • Saat < 08:00 → bir önceki günün nöbet listesi aktif
 *   • Saat >= 08:00 → bugünün nöbet listesi aktif
 *
 * Bu mantık PostgreSQL'deki resolve_active_duty_date() fonksiyonuyla
 * birebir eşleşmelidir. İkisinde değişiklik yapılırken birlikte güncelleyin.
 *
 * Test senaryoları:
 *   07:59 Istanbul → döner: dün   (YYYY-MM-[D-1])
 *   08:00 Istanbul → döner: bugün (YYYY-MM-DD)
 *   23:59 Istanbul → döner: bugün (YYYY-MM-DD)
 */
export function resolveActiveDutyDate(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });

  const parts = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }

  // UTC base — yerel saatle manipüle etmemek için Date.UTC kullanılır
  const base = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day)
  ));

  if (Number(parts.hour) < 8) {
    base.setUTCDate(base.getUTCDate() - 1);
  }

  return base.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
