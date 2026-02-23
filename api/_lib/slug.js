const TR_MAP = {
  c: "c",
  C: "c",
  g: "g",
  G: "g",
  i: "i",
  I: "i",
  o: "o",
  O: "o",
  s: "s",
  S: "s",
  u: "u",
  U: "u",
  "\u00e7": "c",
  "\u00c7": "c",
  "\u011f": "g",
  "\u011e": "g",
  "\u0131": "i",
  "\u0130": "i",
  "\u00f6": "o",
  "\u00d6": "o",
  "\u015f": "s",
  "\u015e": "s",
  "\u00fc": "u",
  "\u00dc": "u"
};

export function slugify(input) {
  return String(input || "")
    .trim()
    .split("")
    .map((char) => TR_MAP[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

