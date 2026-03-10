import { sendJson } from "./http.js";
import { getRedisRateLimitClient } from "./cache.js";

// ---------------------------------------------------------------------------
// Distributed rate limiter (SEC-004)
// ---------------------------------------------------------------------------
// Redis varsa: distributed fixed-window (INCR + EXPIRE) — tüm instance'ları kapsar.
// Redis yoksa: per-instance in-memory fallback — brute force'a yeterli direnç sağlar.
// ---------------------------------------------------------------------------

const WINDOW_SEC  = 60;     // 1 dakika
const WINDOW_MS   = WINDOW_SEC * 1000;
const MAX_REQUESTS = 20;    // pencere başına maksimum istek

// In-memory fallback — Redis erişilemediğinde aktif
const rateLimitMap = new Map();

/**
 * Admin endpoint'ler için IP bazlı rate limiter.
 * Redis varsa distributed, yoksa in-memory fallback.
 * İzin verilen isteklerde true döner.
 * Limit aşıldığında 429 yanıtı gönderir ve false döner.
 * @returns {Promise<boolean>}
 */
export async function checkRateLimit(req, res) {
  const ip  = getClientIp(req);
  const now = Date.now();

  try {
    const client = await getRedisRateLimitClient();
    if (client) {
      return await redisRateLimit(client, ip, now, res);
    }
  } catch {
    // Redis erişilemez → in-memory fallback (sessizce düş)
  }

  return inMemoryRateLimit(ip, now, res);
}

async function redisRateLimit(client, ip, now, res) {
  const key   = `rl:admin:${ip}`;
  const count = await client.incr(key);

  // İlk istek: TTL'i set et (INCR key yoksa oluştururken TTL sıfırlanmış olmaz)
  if (count === 1) {
    await client.expire(key, WINDOW_SEC);
  }

  const ttlSec   = Math.max(await client.ttl(key), 0);
  const resetSec = Math.ceil(now / 1000) + ttlSec;
  const remaining = Math.max(0, MAX_REQUESTS - count);

  res.setHeader("X-RateLimit-Limit",     String(MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset",     String(resetSec));

  if (count > MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.max(ttlSec, 1)));
    sendJson(res, 429, { error: "rate_limit_exceeded" });
    return false;
  }
  return true;
}

function inMemoryRateLimit(ip, now, res) {
  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    rateLimitMap.set(ip, entry);
  } else {
    entry.count++;
  }

  const remaining = Math.max(0, MAX_REQUESTS - entry.count);
  const resetSec  = Math.ceil(entry.resetAt / 1000);

  res.setHeader("X-RateLimit-Limit",     String(MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset",     String(resetSec));

  if (entry.count > MAX_REQUESTS) {
    res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    sendJson(res, 429, { error: "rate_limit_exceeded" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// IP extraction — SEC-013 hardening
// ---------------------------------------------------------------------------
// Vercel proxy: istek → Edge → serverless
// x-real-ip: Vercel'in güvenilir olarak set ettiği gerçek client IP.
// x-forwarded-for: proxy zinciri — başa ekleme mümkün, SON entry güvenilir.
// Öncelik: x-real-ip > x-forwarded-for[last] > socket.remoteAddress

export function getClientIp(req) {
  const realIp = String(req.headers["x-real-ip"] || "").trim();
  if (realIp) return realIp;

  const forwarded = String(req.headers["x-forwarded-for"] || "").trim();
  if (forwarded) {
    // Son entry — Vercel edge'in eklediği, güvenilir taraf
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }

  return String(req.socket?.remoteAddress || "unknown");
}

// In-memory map temizliği
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, WINDOW_MS);
