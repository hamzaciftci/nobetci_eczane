import { createClient } from "redis";

let clientPromise = null;

function getRedisClient() {
  if (!clientPromise) {
    const url = (process.env.REDIS_URL || "").trim();
    if (!url) return null;
    clientPromise = createClient({ url, socket: { tls: process.env.REDIS_TLS === "1" } })
      .on("error", (err) => console.error("[redis] error", err?.message))
      .connect();
  }
  return clientPromise;
}

export const TTL_SECONDS = 600;         // Normal veri: 10 dakika
export const TTL_DEGRADED_SECONDS = 30; // Stale/degraded veri: 30 sn → sık retry

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

export function dutyProvinceKey(ilSlug) {
  return `duty:${ilSlug}`;
}

export function dutyDistrictKey(ilSlug, ilceSlug) {
  return `duty:${ilSlug}:${ilceSlug}`;
}

export function nearestKey(lat, lng) {
  // Round to 2 decimal places (~1.1 km precision) for better cache hit rate
  return `nearest:${Math.round(lat * 100) / 100}:${Math.round(lng * 100) / 100}`;
}
