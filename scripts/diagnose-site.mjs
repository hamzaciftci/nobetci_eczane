/**
 * Fetch a specific URL and show HTML near phone/pharmacy data.
 * Usage: node scripts/diagnose-site.mjs <url> [searchterm]
 */
const url = process.argv[2];
const searchTerm = process.argv[3] || "tel:";

if (!url) {
  console.error("Usage: node diagnose-site.mjs <url> [searchterm]");
  process.exit(1);
}

const CRAWL_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0";

const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 15_000);

const resp = await fetch(url, {
  signal: ctrl.signal,
  headers: {
    "User-Agent": CRAWL_UA,
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.9",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
  }
});

const buf = await resp.arrayBuffer();
const ct = resp.headers.get("content-type") || "";
console.log("Content-Type:", ct);
console.log("Status:", resp.status);

// Try both charsets
let html = new TextDecoder("utf-8").decode(buf);
const metaCharset = html.match(/<meta[^>]+charset=["']?([^"'\s>;]+)/i)?.[1]?.toLowerCase();
console.log("Meta charset:", metaCharset || "not found");

if (metaCharset && metaCharset !== "utf-8" && metaCharset !== "utf8") {
  try {
    html = new TextDecoder(metaCharset).decode(buf);
    console.log("Re-decoded as:", metaCharset);
  } catch(e) {
    console.log("Failed to re-decode:", e.message);
  }
}

// Strip scripts and styles for readability
const clean = html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<style[\s\S]*?<\/style>/gi, "");

// Find all occurrences of searchTerm and show context
const lower = clean.toLowerCase();
const search = searchTerm.toLowerCase();
let idx = 0;
let count = 0;
console.log(`\n=== Occurrences of "${searchTerm}" (first 10) ===\n`);
while ((idx = lower.indexOf(search, idx)) >= 0 && count < 10) {
  const snippet = clean.slice(Math.max(0, idx - 300), idx + 500)
    .replace(/\s+/g, " ");
  console.log(`--- Occurrence ${count + 1} at pos ${idx} ---`);
  console.log(snippet);
  console.log();
  idx += search.length;
  count++;
}

if (count === 0) {
  // Show first 3000 chars of body
  const bodyM = clean.match(/<body[^>]*>([\s\S]{0,3000})/i);
  console.log("No occurrences found. First 3000 chars of body:");
  console.log(bodyM ? bodyM[1].replace(/\s+/g, " ") : clean.slice(0, 3000));
}

process.exit(0);
