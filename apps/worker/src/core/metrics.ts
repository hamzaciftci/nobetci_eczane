interface LoggerLike {
  info(payload: unknown, message?: string): void;
}

export class IngestionMetrics {
  private successRuns = 0;
  private failedRuns = 0;
  private parseErrors = 0;
  private fallbackUsage = 0;
  private lastConflictCount = 0;
  private lastProvince = "";
  private lastRunAt = "";

  markSuccess(provinceSlug: string, conflictCount: number) {
    this.successRuns += 1;
    this.lastConflictCount = conflictCount;
    this.lastProvince = provinceSlug;
    this.lastRunAt = new Date().toISOString();
  }

  markFailure(provinceSlug: string) {
    this.failedRuns += 1;
    this.lastProvince = provinceSlug;
    this.lastRunAt = new Date().toISOString();
  }

  markParseError() {
    this.parseErrors += 1;
  }

  markFallbackUsed() {
    this.fallbackUsage += 1;
  }

  snapshot() {
    return {
      success_runs: this.successRuns,
      failed_runs: this.failedRuns,
      parse_errors: this.parseErrors,
      fallback_usage: this.fallbackUsage,
      last_conflict_count: this.lastConflictCount,
      last_province: this.lastProvince,
      last_run_at: this.lastRunAt
    };
  }

  flush(logger: LoggerLike) {
    logger.info(this.snapshot(), "Ingestion metrics snapshot");
  }
}
