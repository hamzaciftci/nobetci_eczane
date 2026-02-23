/**
 * Canonical duty date resolution — frontend runtime.
 *
 * Nöbet dönemi: 08:00 Istanbul'dan ertesi gün 08:00'a kadar sürer.
 * Backend muadili: shared/time.js → resolveActiveDutyDate()
 * PostgreSQL muadili: resolve_active_duty_date() fonksiyonu
 *
 * Değişiklik yapılırken üç muadil birlikte güncellenmelidir.
 */
export function resolveActiveDutyDate(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });

  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }

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

export function formatTimeAgo(input: string): string {
  const value = new Date(input).getTime();
  if (!Number.isFinite(value)) {
    return "-";
  }

  const diff = Date.now() - value;
  const mins = Math.floor(diff / 60000);

  if (mins < 1) {
    return "Az once";
  }
  if (mins < 60) {
    return `${mins} dk once`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours} saat once`;
  }

  return `${Math.floor(hours / 24)} gun once`;
}

export function formatDateTime(input: string | Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(new Date(input));
}

export function formatDate(input: string | Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul"
  }).format(new Date(input));
}

