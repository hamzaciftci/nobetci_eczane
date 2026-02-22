import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { envValue } from "./env.util";

@Injectable()
export class IngestionQueueService implements OnModuleDestroy {
  private readonly queue: Queue | null;

  constructor() {
    const redisUrl = envValue(process.env.REDIS_URL);
    const queueName = envValue(process.env.INGESTION_QUEUE_NAME) ?? "ingestion";
    if (!redisUrl) {
      this.queue = null;
      return;
    }

    this.queue = new Queue(queueName, {
      connection: {
        url: redisUrl
      }
    });
  }

  get isEnabled() {
    return Boolean(this.queue);
  }

  async enqueueProvincePull(provinceSlug: string, reason = "api") {
    if (!this.queue) {
      return {
        queued: false,
        reason: "queue_unavailable"
      };
    }

    const job = await this.queue.add(
      "pull-province-now",
      { provinceSlug, reason },
      {
        jobId: `api-refresh:${provinceSlug}:${Date.now()}`,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 10_000
        },
        removeOnComplete: true,
        removeOnFail: 500
      }
    );

    return {
      queued: true,
      jobId: String(job.id)
    };
  }

  async enqueueFullSync(reason = "cron") {
    if (!this.queue) {
      return {
        queued: false,
        reason: "queue_unavailable"
      };
    }

    const job = await this.queue.add(
      "hybrid-full-sync",
      { reason },
      {
        jobId: `api-full-sync:${Date.now()}`,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 60_000
        },
        removeOnComplete: true,
        removeOnFail: 200
      }
    );

    return {
      queued: true,
      jobId: String(job.id)
    };
  }

  async onModuleDestroy() {
    if (this.queue) {
      await this.queue.close();
    }
  }
}
