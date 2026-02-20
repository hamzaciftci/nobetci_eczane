import { AdapterFetchResult, SourceEndpointConfig, SourceFormat } from "../core/types";

export interface SourceAdapter {
  supports(format: SourceFormat): boolean;
  fetch(endpoint: SourceEndpointConfig, headers?: Record<string, string>): Promise<AdapterFetchResult>;
}
