import { timingSafeEqual } from "crypto";

// NODE_ENV tanımlı değilse veya "development" değilse production modunda say (fail-safe).
const IS_PROD = process.env.NODE_ENV !== "development";

// ---------------------------------------------------------------------------
// Input validation helpers (SEC-006, SEC-008)
// ---------------------------------------------------------------------------

/**
 * İl/ilçe slug'larını doğrula.
 * Geçerli format: küçük harf Latin + tire, 2-40 karakter, rakamla başlamaz.
 * @param {string} slug
 * @returns {boolean}
 */
export function validateSlug(slug) {
  return typeof slug === "string" && /^[a-z][a-z0-9-]{1,39}$/.test(slug);
}

/**
 * Tarih parametresini hem format hem aralık açısından doğrula.
 * Format: YYYY-MM-DD
 * Aralık: bugünden MAX_PAST_DAYS öncesi ile MAX_FUTURE_DAYS sonrası arası
 * @param {string} tarih     - "YYYY-MM-DD" formatında tarih
 * @param {string} today     - "YYYY-MM-DD" formatında referans tarih (resolveActiveDutyDate())
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTarihRange(tarih, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
    return { valid: false, error: "invalid_tarih_format" };
  }
  const MAX_PAST_DAYS  = 90;
  const MAX_FUTURE_DAYS = 7;
  const todayMs   = new Date(today).getTime();
  const tarihMs   = new Date(tarih).getTime();
  const diffDays  = (todayMs - tarihMs) / 86_400_000;  // pozitif = geçmiş
  if (diffDays > MAX_PAST_DAYS) {
    return { valid: false, error: "tarih_too_old" };
  }
  if (diffDays < -MAX_FUTURE_DAYS) {
    return { valid: false, error: "tarih_too_future" };
  }
  return { valid: true };
}

export function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(payload));
}

export function methodNotAllowed(req, res, allowed = ["GET"]) {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { error: "method_not_allowed" });
}

export function getSingleQueryValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ? String(value) : "";
}

export async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return safeJsonParse(req.body);
  }

  try {
    const raw = await readStream(req);
    return safeJsonParse(raw);
  } catch (err) {
    if (err.statusCode === 413) throw err; // caller'a ilet — 413 response için
    return {};
  }
}

/**
 * Admin token doğrulama — fail-closed tasarım:
 *   • ADMIN_API_TOKEN ayarlanmamışsa → 503 (misconfiguration)
 *   • Authorization: Bearer <token> header'ı eksikse → 401
 *   • Token yanlışsa → 403
 *   • Token doğruysa → true
 *
 * Başarısız denemeleri konsola loglar (brute-force tespiti için).
 */
export function requireAdmin(req, res) {
  const expected = (process.env.ADMIN_API_TOKEN || "").trim();

  // Token yapılandırılmamışsa servis kabul etmez (fail-closed)
  if (!expected) {
    console.error("[admin_auth] ADMIN_API_TOKEN is not configured — refusing all admin requests");
    sendJson(res, 503, { error: "admin_not_configured" });
    return false;
  }

  // Standard Bearer token — Authorization: Bearer <token>
  const authHeader = String(req.headers["authorization"] || "").trim();
  if (!authHeader.startsWith("Bearer ")) {
    logAuthFailure(req, "missing_token");
    sendJson(res, 401, { error: "missing_token" });
    return false;
  }

  const provided = authHeader.slice(7).trim();
  if (!timingSafeCompare(provided, expected)) {
    logAuthFailure(req, "invalid_token");
    sendJson(res, 403, { error: "forbidden" });
    return false;
  }

  return true;
}

/**
 * Tüm endpoint'ler için merkezi 500 handler.
 * Gerçek hata her zaman log'a yazılır.
 * Production'da response'da sadece generic mesaj gönderilir.
 */
export function sendInternalError(res, error) {
  console.error("[internal_error]", error);
  sendJson(res, 500, {
    error: "internal_error",
    message: IS_PROD
      ? "An unexpected error occurred."
      : (error instanceof Error ? error.message : "Unknown error")
  });
}

function logAuthFailure(req, reason) {
  const ip =
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown");
  console.warn(`[admin_auth] ${reason} — ip=${ip} path=${req.url}`);
}

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const BODY_SIZE_LIMIT = 1 * 1024 * 1024; // 1 MB

function readStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req
      .on("data", (chunk) => {
        total += chunk.length;
        // Body size limit — aşıldığında stream'i yok et ve 413 ile reddet.
        if (total > BODY_SIZE_LIMIT) {
          req.destroy();
          reject(Object.assign(new Error("request_body_too_large"), { statusCode: 413 }));
          return;
        }
        chunks.push(chunk);
      })
      .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      .on("error", reject);
  });
}

/**
 * Sabit zamanlı string karşılaştırması (SEC-003).
 * timingSafeEqual uzunluk farkına karşı da güvenli olabilmek için
 * her iki tarafı da sabit boyutlu buffer'a kopyalar.
 */
function timingSafeCompare(a, b) {
  const BUF_SIZE = 512;
  const bufA = Buffer.alloc(BUF_SIZE);
  const bufB = Buffer.alloc(BUF_SIZE);
  Buffer.from(String(a ?? "")).copy(bufA);
  Buffer.from(String(b ?? "")).copy(bufB);
  return timingSafeEqual(bufA, bufB);
}
