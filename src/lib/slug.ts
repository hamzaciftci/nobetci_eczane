const TR_MAP: Record<string, string> = {
  "\u00e7": "c",
  "\u011f": "g",
  "\u0131": "i",
  "\u00f6": "o",
  "\u015f": "s",
  "\u00fc": "u",
  "\u00c7": "c",
  "\u011e": "g",
  "\u0130": "i",
  "\u00d6": "o",
  "\u015e": "s",
  "\u00dc": "u"
};

export function toSlug(value: string): string {
  return value
    .trim()
    .split("")
    .map((char) => TR_MAP[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

