const ISTANBUL_TIMEZONE = "Europe/Istanbul";

export function formatIstanbulDateForTitle(input: Date = new Date()): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: ISTANBUL_TIMEZONE
  }).format(input);
}

export function formatIstanbulDateWithWeekday(input: Date = new Date()): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
    timeZone: ISTANBUL_TIMEZONE
  }).format(input);
}

export function buildDailyDutyTitle(suffix?: string): string {
  const base = `${formatIstanbulDateForTitle()} Bugün Nöbetçi Eczaneler`;
  if (!suffix) {
    return base;
  }
  return `${base} - ${suffix}`;
}
