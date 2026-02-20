import { Injectable } from "@nestjs/common";

@Injectable()
export class ApiMetricsService {
  private cacheHits = 0;
  private cacheMisses = 0;
  private endpointCalls = new Map<string, number>();

  trackCacheHit() {
    this.cacheHits += 1;
  }

  trackCacheMiss() {
    this.cacheMisses += 1;
  }

  trackEndpoint(endpoint: string) {
    const prev = this.endpointCalls.get(endpoint) ?? 0;
    this.endpointCalls.set(endpoint, prev + 1);
  }

  snapshot() {
    const total = this.cacheHits + this.cacheMisses;
    return {
      cache_hits: this.cacheHits,
      cache_misses: this.cacheMisses,
      cache_hit_ratio: total ? Number((this.cacheHits / total).toFixed(4)) : 0,
      endpoint_calls: [...this.endpointCalls.entries()].map(([endpoint, count]) => ({
        endpoint,
        count
      }))
    };
  }
}
