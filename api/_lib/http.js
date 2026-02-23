// NODE_ENV tanımlı değilse veya "development" değilse production modunda say (fail-safe).
const IS_PROD = process.env.NODE_ENV !== "development";

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

  const raw = await readStream(req);
  return safeJsonParse(raw);
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
  if (provided !== expected) {
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

function readStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req
      .on("data", (chunk) => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      .on("error", reject);
  });
}
