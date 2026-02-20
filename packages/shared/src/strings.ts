import slugify from "slugify";

export function toSlug(value: string): string {
  return slugify(value, {
    lower: true,
    strict: true,
    locale: "tr"
  });
}

export function normalizePharmacyName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
