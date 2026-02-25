export function stripTags(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ");
}

export function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export function cleanPhone(s) {
  return String(s || "").replace(/[^\d+() -]/g, "").replace(/\s+/g, " ").trim();
}
