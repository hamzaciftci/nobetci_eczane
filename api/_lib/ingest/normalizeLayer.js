import { slugify } from "../slug.js";

// Duty window uses Istanbul time; 08:00 local → 05:00 UTC
const DUTY_HOUR_UTC = 5;

export function resolveToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export function resolveDutyWindow(todayStr) {
  const dutyStart = new Date(`${todayStr}T0${DUTY_HOUR_UTC}:00:00Z`);
  const dutyEnd = new Date(dutyStart.getTime() + 24 * 60 * 60 * 1000);
  return { dutyStart: dutyStart.toISOString(), dutyEnd: dutyEnd.toISOString() };
}

export function resolveDistrictId(districts, districtName) {
  if (!districts.length) return null;

  if (districtName && districtName.trim()) {
    const needle = slugify(districtName.trim());

    const bySlug = districts.find((d) => d.slug === needle);
    if (bySlug) return bySlug.id;

    const normNeedle = normalizeText(districtName);
    const byNorm = districts.find((d) => normalizeText(d.name) === normNeedle);
    if (byNorm) return byNorm.id;

    const partial = districts.find((d) => d.slug.includes(needle) || needle.includes(d.slug));
    if (partial) return partial.id;
  }

  const merkez = districts.find(
    (d) => d.slug === "merkez" || d.slug.endsWith("-merkez") || normalizeText(d.name) === "merkez"
  );
  return merkez?.id ?? districts[0]?.id ?? null;
}

export function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/\s+/g, " ")
    .trim();
}
