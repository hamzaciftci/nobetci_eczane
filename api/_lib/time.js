/**
 * Tüm tarih/saat mantığı shared/time.js'te yaşar.
 * Bu dosya yalnızca API katmanı için re-export noktasıdır.
 *
 * PostgreSQL muadili: resolve_active_duty_date() fonksiyonu.
 * Bkz: infra/postgres/migrations/20260223_resolve_active_duty_date_fn.sql
 */
export { resolveActiveDutyDate } from "../../shared/time.js";
