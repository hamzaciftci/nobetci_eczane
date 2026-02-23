import { sendJson } from "./http.js";

// Per-process rate limiter (Vercel: her warm instance kendi belleğini tutar;
// global doğruluk garantisi yoktur, ancak brute-force'a karşı etkilidir).
const rateLimitMap = new Map(); // ip → { count: number, resetAt: number }

const WINDOW_MS = 60_000; // 1 dakika
const MAX_REQUESTS = 20;  // pencere başına maksimum istek

/**
 * Admin endpoint'ler için IP bazlı rate limiter.
 * İzin verilen isteklerde true döner.
 * Limit aşıldığında 429 yanıtı gönderir ve false döner.
 */
export function checkRateLimit(req, res) {
  const ip = getClientIp(req);
  const now = Date.now();

  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    rateLimitMap.set(ip, entry);
  } else {
    entry.count++;
  }

  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  const resetSec = Math.ceil(entry.resetAt / 1000);

  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(resetSec));

  if (entry.count > MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    sendJson(res, 429, { error: "rate_limit_exceeded" });
    return false;
  }

  return true;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return String(forwarded).split(",")[0].trim();
  }
  return String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown");
}

// Eski pencereleri periyodik olarak temizle (bellek sızıntısı önlemi)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, WINDOW_MS);
