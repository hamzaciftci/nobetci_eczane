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

const TTL_SECONDS = 600; // 10 dakika

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

export async function cacheSet(key, value) {
  const client = getRedisClient();
  if (!client) return false;
  try {
    await client.setEx(key, TTL_SECONDS, JSON.stringify(value));
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
  return `nearest:${lat}:${lng}`;
}
