import { createHash } from "crypto";
import { SourceAdapter } from "./adapter.interface";
import { AdapterFetchResult, SourceBatch, SourceEndpointConfig } from "../core/types";
import { parseHtmlToSourceRecords } from "../parsers/html-parser";

interface FetchResult {
  statusCode: number;
  body: string;
  etag: string | null;
  lastModified: string | null;
}

export class HttpHtmlAdapter implements SourceAdapter {
  supports(format: SourceEndpointConfig["format"]): boolean {
    return format === "html" || format === "html_table" || format === "html_js";
  }

  async fetch(
    endpoint: SourceEndpointConfig,
    conditionalHeaders: Record<string, string> = {}
  ): Promise<AdapterFetchResult> {
    const response = await fetchEndpoint(endpoint.endpointUrl, conditionalHeaders);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Source responded with status ${response.statusCode}`);
    }

    const records = parseHtmlToSourceRecords(response.body, endpoint);
    if (!records.length) {
      throw new Error("Parser produced zero records");
    }

    const batch: SourceBatch = {
      source: {
        sourceName: endpoint.sourceName,
        sourceType: endpoint.sourceType,
        sourceUrl: endpoint.endpointUrl,
        authorityWeight: endpoint.authorityWeight,
        sourceEndpointId: endpoint.sourceEndpointId,
        parserKey: endpoint.parserKey
      },
      records
    };

    return {
      batch,
      httpStatus: response.statusCode,
      etag: response.etag,
      lastModified: response.lastModified,
      rawPayload: response.body
    };
  }
}

export async function fetchEndpoint(
  endpointUrl: string,
  headers: Record<string, string> = {}
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        "user-agent": "NobetciEczaneBot/1.0 (+https://example.com/bot-policy)",
        "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
        ...headers
      },
      signal: controller.signal
    });

    return {
      statusCode: response.status,
      body: await response.text(),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    };
  } finally {
    clearTimeout(timer);
  }
}

export function checksumPayload(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
