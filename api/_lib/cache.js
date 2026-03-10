import { createClient } from "redis";

let clientPromise = null;

function getRedisClient() {
  if (!clientPromise) {
    const url = (process.env.REDIS_URL || "").trim();
    if (!url) return null;
    // SEC-010: TLS auto-detect — rediss:// scheme → TLS zorunlu.
    // REDIS_TLS=1 backward-compat için hâlâ geçerli ama artık ikincil kaynak.
    const tlsByScheme = url.startsWith("rediss://");
    const tlsByEnv    = process.env.REDIS_TLS === "1";
    clientPromise = createClient({ url, socket: { tls: tlsByScheme || tlsByEnv } })
      .on("error", (err) => console.error("[redis] error", err?.message))
      .connect();
  }
  return clientPromise;
}

/**
 * SEC-004: Rate limiter için doğrudan Redis client döndürür.
 * Çağıran kendi try/catch'ini yönetir.
 * @returns {Promise<import("redis").RedisClientType | null>}
 */
export async function getRedisRateLimitClient() {
  return getRedisClient(); // clientPromise (veya null)
}

export const TTL_SECONDS = 600;              // Normal veri: 10 dakika
export const TTL_DEGRADED_SECONDS = 30;      // Stale/degraded veri: 30 sn → sık retry
export const TTL_HISTORICAL_SECONDS = 21600; // Geçmiş tarih: 6 saat (veri artık değişmez)

export async function cacheGet(key) {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("[redis] get failed", err?.message);
    return null;
  }
}

/**
 * @param {string}  key
 * @param {*}       value
 * @param {number}  [ttl=TTL_SECONDS]  saniye cinsinden TTL
 */
export async function cacheSet(key, value, ttl = TTL_SECONDS) {
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn("[redis] set failed", err?.message);
    return false;
  }
}

export async function cacheDel(keys) {
  const client = getRedisClient();
  if (!client) return 0;
  try {
    return await client.del(keys);
  } catch (err) {
    console.warn("[redis] del failed", err?.message);
    return 0;
  }
}

export function dutyProvinceKey(ilSlug, date = "today") {
  return `duty:${ilSlug}:${date}`;
}

export function dutyDistrictKey(ilSlug, ilceSlug, date = "today") {
  return `duty:${ilSlug}:${ilceSlug}:${date}`;
}

export function nearestKey(lat, lng) {
  // Round to 2 decimal places (~1.1 km precision) for better cache hit rate
  return `nearest:${Math.round(lat * 100) / 100}:${Math.round(lng * 100) / 100}`;
}

// Tarih bazlı cache anahtarları (geçmiş gün sorguları için)
export function dutyProvinceDateKey(ilSlug, date) {
  return `duty:${ilSlug}:${date}`;
}

export function dutyDistrictDateKey(ilSlug, ilceSlug, date) {
  return `duty:${ilSlug}:${ilceSlug}:${date}`;
}

export function dutyDatesKey(ilSlug, date = "today") {
  return `tarihler:${ilSlug}:${date}`;
}
