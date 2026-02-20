import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";

@Injectable()
export class RecoveryService implements OnModuleDestroy {
  private readonly queue: Queue;

  constructor() {
    const queueName = process.env.INGESTION_QUEUE_NAME ?? "ingestion";
    const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6380";

    this.queue = new Queue(queueName, {
      connection: {
        url: redisUrl
      }
    });
  }

  async triggerProvincePull(provinceSlug: string) {
    const job = await this.queue.add(
      "pull-province-now",
      { provinceSlug },
      {
        jobId: `recovery:${provinceSlug}:${Date.now()}`,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000
        },
        removeOnComplete: true,
        removeOnFail: 200
      }
    );

    return {
      queued: true,
      job_id: String(job.id),
      province: provinceSlug
    };
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
