import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const isServerlessRuntime = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? (isServerlessRuntime ? 1 : 10)),
      idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 10000),
      ssl: this.resolveSsl(connectionString)
    });
  }

  async query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }

  async withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private resolveSsl(connectionString: string) {
    if (process.env.DB_SSL_MODE === "disable") {
      return false;
    }

    const requiresSsl =
      connectionString.includes("sslmode=require") ||
      connectionString.includes("neon.tech") ||
      process.env.DB_SSL_MODE === "require";

    if (!requiresSsl) {
      return false;
    }

    return {
      rejectUnauthorized: false
    };
  }
}
