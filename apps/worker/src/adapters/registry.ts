import { SourceAdapter } from "./adapter.interface";
import { HttpHtmlAdapter } from "./http-html.adapter";
import { StaticFallbackAdapter } from "./static-fallback.adapter";
import { SourceEndpointConfig } from "../core/types";

export class AdapterRegistry {
  private readonly adapters: SourceAdapter[];
  private readonly fallback: SourceAdapter;

  constructor() {
    this.adapters = [new HttpHtmlAdapter()];
    this.fallback = new StaticFallbackAdapter();
  }

  resolve(endpoint: SourceEndpointConfig): SourceAdapter {
    const adapter = this.adapters.find((candidate) => candidate.supports(endpoint.format));
    if (!adapter) {
      throw new Error(`No adapter supports format ${endpoint.format}`);
    }
    return adapter;
  }

  resolveFallback(endpoint: SourceEndpointConfig): SourceAdapter {
    if (!this.fallback.supports(endpoint.format)) {
      throw new Error(`No fallback adapter for format ${endpoint.format}`);
    }
    return this.fallback;
  }
}
