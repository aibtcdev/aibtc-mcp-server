/**
 * Live x402 endpoint discovery.
 *
 * x402.aibtc.com and stx402.com publish an OpenAPI spec, and stx402.com runs a
 * directory of x402 endpoints registered by third parties. Reading those at call
 * time keeps `list_x402_endpoints` in step with what the hosts actually serve,
 * instead of a hand-maintained list that goes stale when routes move.
 *
 * Results are cached briefly. A failed fetch is never cached and never replaced
 * with stale or invented entries: the source is reported as unavailable.
 */

import { NETWORK, type Network } from "../config/networks.js";
import type { X402Endpoint } from "../endpoints/registry.js";

export interface OpenApiSource {
  /** Label shown to the agent. */
  source: string;
  /** Base URL per network; a network without one is not served by this host. */
  baseUrl: Partial<Record<Network, string>>;
}

export const OPENAPI_SOURCES: OpenApiSource[] = [
  {
    source: "x402.aibtc.com",
    baseUrl: { mainnet: "https://x402.aibtc.com", testnet: "https://x402.aibtc.dev" },
  },
  {
    source: "stx402.com",
    baseUrl: { mainnet: "https://stx402.com" },
  },
];

const DIRECTORY_URL = "https://stx402.com/registry/list";
const DIRECTORY_PAGE_SIZE = 50;
/** Hard stop so a misbehaving `total` cannot turn one call into hundreds of requests. */
const DIRECTORY_MAX_PAGES = 20;

export const DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

/** An endpoint registered in the stx402.com directory by its owner. */
export interface DirectoryEntry {
  name: string;
  url: string;
  category: string;
  status: string;
  owner: string;
}

export interface UnavailableSource {
  source: string;
  error: string;
}

const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < DISCOVERY_CACHE_TTL_MS) {
    return hit.value as T;
  }
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Test seam. */
export function clearDiscoveryCache(): void {
  cache.clear();
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`GET ${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

interface OpenApiParameter {
  name: string;
  in: string;
  description?: string;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    content?: Record<string, { schema?: { properties?: Record<string, { description?: string }>; required?: string[] } }>;
  };
}

interface OpenApiSpec {
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

const METHODS = ["get", "post", "put", "delete"] as const;

/**
 * Summaries on these hosts lead with the pricing tier, e.g. "(paid, standard) Decode a
 * transaction" or "(free) List models". Split that into a cost label and a description.
 * The exact price is only known from the 402 challenge, so it is not guessed here.
 */
export function parseSummary(summary: string): { cost: string; description: string } {
  const match = summary.match(/^\((free|paid)(?:,\s*([^)]+))?\)\s*(.*)$/i);
  if (match) {
    const [, kind, tier, rest] = match;
    return {
      cost: kind.toLowerCase() === "free" ? "FREE" : `paid${tier ? ` (${tier.trim()})` : ""}`,
      description: rest,
    };
  }
  if (/\(free\)/i.test(summary)) {
    return { cost: "FREE", description: summary.replace(/\s*\(free\)/i, "") };
  }
  return { cost: "see probe_x402_endpoint", description: summary };
}

/** Map an OpenAPI spec to endpoint entries. Admin-only operations are left out. */
export function endpointsFromOpenApi(spec: OpenApiSpec, source: string): X402Endpoint[] {
  const endpoints: X402Endpoint[] = [];

  for (const [path, operations] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = operations[method];
      if (!op) continue;
      const tags = op.tags ?? [];
      if (tags.some((tag) => /admin/i.test(tag))) continue;

      const { cost, description } = parseSummary(op.summary ?? op.description ?? "");

      // tokenType selects the payment asset; execute_x402_endpoint handles that itself.
      const params = Object.fromEntries(
        (op.parameters ?? [])
          .filter((p) => p.name !== "tokenType")
          .map((p) => [p.name, p.description ?? p.in])
      );

      const schema = op.requestBody?.content?.["application/json"]?.schema;
      const required = new Set(schema?.required ?? []);
      const body = Object.fromEntries(
        Object.entries(schema?.properties ?? {}).map(([name, prop]) => [
          name,
          `${prop.description ?? name}${required.has(name) ? "" : " (optional)"}`,
        ])
      );

      endpoints.push({
        path,
        method: method.toUpperCase() as X402Endpoint["method"],
        description,
        cost,
        category: tags[0] ?? "Other",
        source,
        ...(Object.keys(params).length > 0 && { params }),
        ...(Object.keys(body).length > 0 && { body }),
      });
    }
  }

  return endpoints;
}

/** Fetch one host's endpoints from its OpenAPI spec. */
export function fetchOpenApiEndpoints(
  source: OpenApiSource,
  network: Network = NETWORK
): Promise<X402Endpoint[]> {
  const baseUrl = source.baseUrl[network];
  if (!baseUrl) {
    return Promise.reject(new Error(`${source.source} has no ${network} deployment`));
  }
  return cached(`openapi:${baseUrl}`, async () => {
    const spec = (await fetchJson(`${baseUrl}/openapi.json`)) as OpenApiSpec;
    if (!spec.paths) {
      throw new Error(`${baseUrl}/openapi.json has no paths`);
    }
    return endpointsFromOpenApi(spec, source.source);
  });
}

interface DirectoryPage {
  entries?: Array<Partial<DirectoryEntry>>;
  total?: number;
}

/** Fetch every entry in the stx402.com endpoint directory (mainnet only). */
export function fetchDirectoryEntries(): Promise<DirectoryEntry[]> {
  return cached("directory", async () => {
    const entries: DirectoryEntry[] = [];
    let total = Infinity;
    for (let page = 0; page < DIRECTORY_MAX_PAGES && entries.length < total; page++) {
      const offset = page * DIRECTORY_PAGE_SIZE;
      const data = (await fetchJson(
        `${DIRECTORY_URL}?limit=${DIRECTORY_PAGE_SIZE}&offset=${offset}`
      )) as DirectoryPage;
      if (!Array.isArray(data.entries)) {
        throw new Error(`${DIRECTORY_URL} response has no entries array`);
      }
      total = data.total ?? entries.length + data.entries.length;
      for (const e of data.entries) {
        if (!e.url) continue;
        entries.push({
          name: e.name ?? e.url,
          url: e.url,
          category: e.category ?? "other",
          status: e.status ?? "unknown",
          owner: e.owner ?? "",
        });
      }
      if (data.entries.length < DIRECTORY_PAGE_SIZE) break;
    }
    return entries;
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Fetch every OpenAPI source in parallel, reporting failures per source. */
export async function discoverOpenApiEndpoints(
  sources: OpenApiSource[] = OPENAPI_SOURCES,
  network: Network = NETWORK
): Promise<{ endpoints: X402Endpoint[]; unavailable: UnavailableSource[] }> {
  const results = await Promise.allSettled(
    sources.map((s) => fetchOpenApiEndpoints(s, network))
  );
  const endpoints: X402Endpoint[] = [];
  const unavailable: UnavailableSource[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      endpoints.push(...result.value);
    } else {
      unavailable.push({ source: sources[i].source, error: errorMessage(result.reason) });
    }
  });
  return { endpoints, unavailable };
}
