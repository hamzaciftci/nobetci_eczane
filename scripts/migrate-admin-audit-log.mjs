/**
 * Admin Audit Log Migration
 * Çalıştırma: node scripts/migrate-admin-audit-log.mjs
 *
 * Oluşturulan tablo: admin_audit_log
 * Amaç: Kim, ne zaman, hangi admin işlemini yaptı?
 */

import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL veya NEON_DATABASE_URL ayarlanmamış");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("[migrate] admin_audit_log tablosu oluşturuluyor...");

  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id            BIGSERIAL     PRIMARY KEY,
      action        VARCHAR(64)   NOT NULL,
      actor         VARCHAR(128)  NOT NULL DEFAULT 'web-admin',
      ip            TEXT,
      resource_type VARCHAR(64),
      resource_id   TEXT,
      payload       JSONB,
      created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_aal_created_at
      ON admin_audit_log (created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_aal_action
      ON admin_audit_log (action)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_aal_resource
      ON admin_audit_log (resource_type, resource_id)
      WHERE resource_type IS NOT NULL
  `;

  console.log("[migrate] admin_audit_log tablosu hazır.");
}

run().catch((err) => {
  console.error("[migrate] hata:", err.message);
  process.exit(1);
});
