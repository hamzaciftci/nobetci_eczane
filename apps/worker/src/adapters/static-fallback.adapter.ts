import { SourceAdapter } from "./adapter.interface";
import { AdapterFetchResult, SourceEndpointConfig } from "../core/types";

export class StaticFallbackAdapter implements SourceAdapter {
  supports(): boolean {
    return true;
  }

  async fetch(endpoint: SourceEndpointConfig): Promise<AdapterFetchResult> {
    throw new Error(
      `Static fallback is disabled for data integrity. Endpoint must return live data: ${endpoint.endpointUrl}`
    );
  }
}
