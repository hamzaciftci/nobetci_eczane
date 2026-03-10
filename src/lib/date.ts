/**
 * Canonical duty date resolution — frontend runtime.
 *
 * Aktif nöbet tarihi: Istanbul saatine göre takvim günü.
 *   • 00:00 sonrası yeni gün aktif olur.
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

export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

