import { timingSafeEqual } from "crypto";
import { sendJson } from "./http.js";

/**
 * Cron auth policy (SEC-002, SEC-003):
 * 1) CRON_TOKEN ve/veya CRON_SECRET zorunlu — token yoksa 503 (fail-closed).
 *    x-vercel-cron header fallback'i KALDIRILDI: bu header dışarıdan taklit edilebilir.
 * 2) Authorization: Bearer <token> veya x-cron-token header'ı kabul edilir.
 * 3) Karşılaştırma sabit zamanlı (timing-safe).
 * 4) Geliştirme ortamında (NODE_ENV=development) bypass — sadece local.
 */
export function requireCronAuth(req, res) {
  const allowedTokens = [
    (process.env.CRON_TOKEN  || "").trim(),
    (process.env.CRON_SECRET || "").trim()
  ].filter(Boolean);

  // Fail-closed: token hiç yapılandırılmamışsa servis başlamaz.
  if (!allowedTokens.length) {
    if (process.env.NODE_ENV === "development") {
      return true;
    }
    console.error("[cron_auth] CRON_SECRET is not configured — refusing cron request");
    sendJson(res, 503, { error: "cron_not_configured", message: "CRON_SECRET missing" });
    return false;
  }

  const authHeader  = String(req.headers["authorization"] || "").trim();
  const tokenHeader = String(req.headers["x-cron-token"]  || "").trim();
  const provided    = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : tokenHeader;

  if (allowedTokens.some((token) => timingSafeCompare(provided, token))) {
    return true;
  }

  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown")
    .split(",")[0].trim();
  console.warn(`[cron_auth] unauthorized_cron — ip=${ip} path=${req.url}`);
  sendJson(res, 401, { error: "unauthorized_cron" });
  return false;
}

/**
 * Sabit zamanlı string karşılaştırması — uzunluk farkı da timing leak yaratmaz.
 */
function timingSafeCompare(a, b) {
  const BUF_SIZE = 512;
  const bufA = Buffer.alloc(BUF_SIZE);
  const bufB = Buffer.alloc(BUF_SIZE);
  Buffer.from(String(a ?? "")).copy(bufA);
  Buffer.from(String(b ?? "")).copy(bufB);
  return timingSafeEqual(bufA, bufB);
}
