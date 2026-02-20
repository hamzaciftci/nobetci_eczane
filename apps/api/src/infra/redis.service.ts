import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

type RedisLike = {
  get(key: string): Promise<string | null>;
  set(...args: Array<unknown>): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  scan(...args: Array<unknown>): Promise<[string, string[]]>;
  ping(): Promise<string>;
  quit(): Promise<string>;
};

class MemoryRedisClient implements RedisLike {
  private readonly data = new Map<
    string,
    {
      value: string;
      expiresAt: number | null;
    }
  >();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(...args: Array<unknown>): Promise<unknown> {
    const [key, value, mode, ttlSeconds] = args as [string, string, "EX" | undefined, number | undefined];
    const expiresAt =
      mode === "EX" && typeof ttlSeconds === "number" ? Date.now() + ttlSeconds * 1000 : null;

    this.data.set(String(key), {
      value: String(value),
      expiresAt
    });

    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.delete(key)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  async scan(...args: Array<unknown>): Promise<[string, string[]]> {
    this.cleanupExpired();

    const cursor = String(args[0] ?? "0");
    const tokens = args.slice(1).map((item) => String(item));
    const startIndex = Number(cursor) || 0;
    let pattern = "*";
    let count = 200;

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i]?.toUpperCase();
      if (token === "MATCH" && tokens[i + 1]) {
        pattern = tokens[i + 1];
        i += 1;
      } else if (token === "COUNT" && tokens[i + 1]) {
        count = Math.max(1, Number(tokens[i + 1]) || 200);
        i += 1;
      }
    }

    const regex = this.globToRegex(pattern);
    const matches = [...this.data.keys()].filter((key) => regex.test(key));
    const slice = matches.slice(startIndex, startIndex + count);
    const nextCursor = startIndex + count >= matches.length ? "0" : String(startIndex + count);

    return [nextCursor, slice];
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  async quit(): Promise<string> {
    return "OK";
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.data.entries()) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.data.delete(key);
      }
    }
  }

  private globToRegex(pattern: string) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
  }
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: RedisLike;

  constructor() {
    const mode = process.env.REDIS_MODE?.toLowerCase();
    const redisUrl = process.env.REDIS_URL;

    if (mode === "memory" || !redisUrl) {
      this.client = new MemoryRedisClient();
      return;
    }

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true
    });
  }

  get raw() {
    return this.client;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
