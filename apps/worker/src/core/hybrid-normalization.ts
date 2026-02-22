const TURKISH_ASCII_MAP: Record<string, string> = {
  Ç: "C",
  Ğ: "G",
  İ: "I",
  Ö: "O",
  Ş: "S",
  Ü: "U",
  ç: "c",
  ğ: "g",
  ı: "i",
  i: "i",
  ö: "o",
  ş: "s",
  ü: "u"
};

export function normalizePharmacyName(name: string): string {
  const cleaned = cleanText(name);
  if (!cleaned) {
    return "";
  }

  const withoutSuffix = cleaned.replace(/\bECZANES[İI]\b/gi, "").replace(/\bECZANE\b/gi, "").trim();
  const base = toUpperTr(withoutSuffix || cleaned)
    .replace(/[^\dA-ZÇĞİÖŞÜ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) {
    return "ECZANESI";
  }

  return `${base} ECZANESI`;
}

export function normalizeAddress(address: string): string {
  return toUpperTr(cleanText(address))
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

export function normalizeTime(timeString: string): string | null {
  const cleaned = cleanText(timeString)
    .replace(/['’`]/g, "")
    .replace(/\bSAATLER[Iİ]\b/gi, "")
    .replace(/\bSAAT\b/gi, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const explicitRange = cleaned.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*[-–—]\s*(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (explicitRange) {
    return `${toClock(explicitRange[1], explicitRange[2])}-${toClock(explicitRange[3], explicitRange[4])}`;
  }

  const points = [...cleaned.matchAll(/(\d{1,2})\s*[:.]\s*(\d{2})/g)]
    .map((match) => toClock(match[1], match[2]))
    .filter((value): value is string => Boolean(value));

  if (points.length >= 2) {
    return `${points[0]}-${points[1]}`;
  }

  return null;
}

export function normalizeCompareKey(value: string): string {
  return cleanText(value)
    .split("")
    .map((ch) => TURKISH_ASCII_MAP[ch] ?? ch)
    .join("")
    .toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9]/g, "");
}

export function formatDutyHours(startIso: string | Date, endIso: string | Date): string {
  const start = toDate(startIso);
  const end = toDate(endIso);
  const startClock = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(start);
  const endClock = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(end);
  return `${startClock}-${endClock}`;
}

function cleanText(value: string): string {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toUpperTr(value: string): string {
  return cleanText(value).toLocaleUpperCase("tr-TR");
}

function toClock(hoursRaw: string, minutesRaw: string): string | null {
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return null;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}
