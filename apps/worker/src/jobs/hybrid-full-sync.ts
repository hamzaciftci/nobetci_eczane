import { DateTime } from "luxon";
import { Pool } from "pg";
import { archiveHistoricalDutyRows, refreshAccuracyStats } from "../core/hybrid-sync-repository";
import { IngestionMetrics } from "../core/metrics";
import { pullProvinceAndPublish } from "./pull-province";

interface LoggerLike {
  info(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
  error(payload: unknown, message?: string): void;
}

export async function runHybridFullSync(db: Pool, logger: LoggerLike, metrics: IngestionMetrics) {
  const startedAt = new Date();
  const dutyDate = DateTime.now().setZone("Europe/Istanbul").toISODate();
  if (!dutyDate) {
    throw new Error("Could not resolve Istanbul duty date for full sync");
  }

  const provinces = await resolveActiveProvinceSlugs(db);
  if (!provinces.length) {
    throw new Error("No active provinces found for full sync");
  }

  const archiveClient = await db.connect();
  try {
    await archiveClient.query("begin");
    const archiveResult = await archiveHistoricalDutyRows(archiveClient, dutyDate);
    await archiveClient.query("commit");
    logger.info(
      {
        duty_date: dutyDate,
        archived_rows: archiveResult.archived,
        deleted_rows: archiveResult.deleted
      },
      "Hybrid archive step completed"
    );
  } catch (error) {
    await archiveClient.query("rollback");
    throw error;
  } finally {
    archiveClient.release();
  }

  const failures: Array<{ province: string; error: string }> = [];
  for (const provinceSlug of provinces) {
    try {
      await pullProvinceAndPublish({ provinceSlug }, db, logger, metrics);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({
        province: provinceSlug,
        error: message
      });
      logger.error(
        {
          province: provinceSlug,
          error: message
        },
        "Province full-sync failed"
      );
    }
  }

  const accuracyClient = await db.connect();
  try {
    await accuracyClient.query("begin");
    await refreshAccuracyStats(accuracyClient, dutyDate);
    await accuracyClient.query("commit");
  } catch (error) {
    await accuracyClient.query("rollback");
    throw error;
  } finally {
    accuracyClient.release();
  }

  logger.info(
    {
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duty_date: dutyDate,
      province_count: provinces.length,
      failures: failures.length
    },
    "Hybrid full sync completed"
  );

  if (failures.length) {
    throw new Error(`Hybrid full sync completed with ${failures.length} province failures`);
  }
}

async function resolveActiveProvinceSlugs(db: Pool): Promise<string[]> {
  const configured = process.env.INGESTION_PROVINCES?.trim() ?? process.env.PROVINCE_SLUGS?.trim() ?? "all";
  if (configured.toLowerCase() !== "all") {
    return [...new Set(configured.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean))];
  }

  const rows = await db.query<{ slug: string }>(
    `
    select distinct p.slug
    from provinces p
    join sources s on s.province_id = p.id and s.enabled = true
    join source_endpoints se on se.source_id = s.id and se.enabled = true
    order by p.slug asc
    `
  );

  return rows.rows.map((row) => row.slug).filter(Boolean);
}
