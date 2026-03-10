import { getClientIp } from "./security.js";

/**
 * Admin işlemlerini admin_audit_log tablosuna yazar.
 * Soft-fail: hata durumunda işlemi engellemez, sadece loglar.
 *
 * @param {import("@neondatabase/serverless").NeonQueryFunction} sql  - DB bağlantısı
 * @param {object}  req           - HTTP request (IP çıkarımı için)
 * @param {object}  opts
 * @param {string}  opts.action        - İşlem adı, örn: "alert.resolve", "ingestion.recovery_trigger"
 * @param {string}  [opts.actor]       - İşlemi yapan kimlik (default: "web-admin")
 * @param {string}  [opts.resourceType] - Etkilenen kaynak türü, örn: "alert", "province"
 * @param {string}  [opts.resourceId]  - Etkilenen kaynak ID'si, örn: alertId, ilSlug
 * @param {object}  [opts.payload]     - Ek bağlam (JSON-serializable)
 * @returns {Promise<void>}
 */
export async function logAdminAction(sql, req, opts) {
  const {
    action,
    actor        = "web-admin",
    resourceType = null,
    resourceId   = null,
    payload      = null,
  } = opts;

  const ip = getClientIp(req);

  try {
    await sql`
      INSERT INTO admin_audit_log
        (action, actor, ip, resource_type, resource_id, payload)
      VALUES (
        ${action},
        ${actor},
        ${ip},
        ${resourceType},
        ${resourceId ? String(resourceId) : null},
        ${payload ? JSON.stringify(payload) : null}
      )
    `;
  } catch (err) {
    // Audit log yazma hatası işlemi engellemez — yalnızca loglanır
    console.error("[admin_audit] log yazma hatası:", err?.message ?? err);
  }
}
