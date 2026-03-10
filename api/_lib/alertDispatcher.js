/**
 * Alert Dispatcher — kritik ingestion_alerts için dış bildirim.
 *
 * Desteklenen kanallar:
 *   - Telegram (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env değişkenleri)
 *   - Slack (SLACK_WEBHOOK_URL env değişkeni)
 *
 * Her ikisi de opsiyonel; env yoksa ilgili kanal sessizce atlanır.
 *
 * Kullanım:
 *   await dispatchPendingAlerts(sql);
 *
 * Çağrı yerleri:
 *   - api/cron/freshness-check.js (saatlik)
 *   - api/cron/ingest.js (her ingest sonrası özet)
 */

const TELEGRAM_API = "https://api.telegram.org";
const FETCH_TIMEOUT_MS = 8_000;

/**
 * DB'deki bildirilmemiş kritik alertleri gönderir.
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function dispatchPendingAlerts(sql) {
  const telegramConfigured = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID
  );
  const slackConfigured = Boolean(process.env.SLACK_WEBHOOK_URL);

  if (!telegramConfigured && !slackConfigured) {
    return { sent: 0, failed: 0, reason: "no_channels_configured" };
  }

  // Son 1 saatte oluşan, bildirilmemiş critical alertleri çek
  const alerts = await sql`
    SELECT
      ia.id,
      ia.alert_type,
      ia.severity,
      ia.message,
      ia.payload,
      ia.created_at,
      p.slug   AS il,
      p.name   AS il_name
    FROM ingestion_alerts ia
    JOIN provinces p ON p.id = ia.province_id
    WHERE ia.severity    = 'critical'
      AND ia.notified_at IS NULL
      AND ia.resolved_at IS NULL
      AND ia.created_at  > now() - interval '1 hour'
    ORDER BY ia.created_at DESC
    LIMIT 30
  `;

  if (!alerts.length) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;

  for (const alert of alerts) {
    const text = formatAlertText(alert);
    let ok = false;

    if (telegramConfigured) {
      ok = await sendTelegram(text);
    }
    if (slackConfigured) {
      const slackOk = await sendSlack(text);
      ok = ok || slackOk;
    }

    if (ok) {
      sent++;
      try {
        await sql`
          UPDATE ingestion_alerts
          SET notified_at = now()
          WHERE id = ${alert.id}
        `;
      } catch {/* ignore */}
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Tek bir alert metnini formatlar.
 */
function formatAlertText(alert) {
  const ts    = new Date(alert.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
  const emoji = alert.severity === "critical" ? "🚨" : "⚠️";
  const type  = String(alert.alert_type || "").replace(/_/g, " ").toUpperCase();
  const msg   = String(alert.message || "").slice(0, 200);

  return `${emoji} [${alert.il_name}] ${type}\n${msg}\n🕐 ${ts}`;
}

/**
 * Telegram'a mesaj gönderir.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function sendTelegram(text) {
  try {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method:  "POST",
      signal:  ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        chat_id:    chatId,
        text,
        parse_mode: "HTML",
      }),
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error("[alertDispatcher] telegram failed:", resp.status, body.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error("[alertDispatcher] telegram error:", err.message);
    return false;
  }
}

/**
 * Slack webhook'a mesaj gönderir.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function sendSlack(text) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return false;

    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(webhookUrl, {
      method:  "POST",
      signal:  ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ text }),
    });
    clearTimeout(timer);
    return resp.ok;
  } catch (err) {
    console.error("[alertDispatcher] slack error:", err.message);
    return false;
  }
}
