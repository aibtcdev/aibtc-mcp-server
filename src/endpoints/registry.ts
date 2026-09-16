/**
 * Known x402 endpoints registry
 * Endpoints from x402.biwas.xyz, x402.aibtc.com, stx402.com, and aibtc.com
 */

export type X402Source = "x402.biwas.xyz" | "x402.aibtc.com" | "stx402.com" | "aibtc.com";

export interface X402Endpoint {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  cost: string;
  category: string;
  source: X402Source;
  params?: Record<string, string>;
  body?: Record<string, string>;
}

// =============================================================================
// x402.biwas.xyz ENDPOINTS
// =============================================================================

const BIWAS_PAID_ENDPOINTS: X402Endpoint[] = [
  // News & Research
  {
    path: "/api/news",
    method: "GET",
    description: "Get latest Stacks and Bitcoin news with AI analysis",
    cost: "0.001 STX",
    category: "News & Research",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/research/user",
    method: "POST",
    description: "Research user profile from X/Twitter and web sources",
    cost: "0.005 STX",
    category: "News & Research",
    source: "x402.biwas.xyz",
    body: { username: "Twitter/X username to research" },
  },
  {
    path: "/api/sentiment",
    method: "POST",
    description: "Real-time sentiment analysis for crypto tokens on X/Twitter",
    cost: "0.005 STX",
    category: "News & Research",
    source: "x402.biwas.xyz",
    body: { token: "Token symbol to analyze (e.g., STX, BTC)" },
  },

  // Security & Auditing
  {
    path: "/api/audit",
    method: "POST",
    description: "Security audit for Clarity smart contracts",
    cost: "0.02 STX",
    category: "Security",
    source: "x402.biwas.xyz",
    body: { contract: "Clarity contract source code or contract ID" },
  },

  // Wallet Analysis
  {
    path: "/api/wallet/classify",
    method: "POST",
    description: "Classify wallet behavior (trader, whale, bot, dao, bridge)",
    cost: "0.005 STX",
    category: "Wallet Analysis",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/wallet/trading",
    method: "POST",
    description: "AI-enhanced wallet trading behavior analysis",
    cost: "0.005 STX",
    category: "Wallet Analysis",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/wallet/pnl",
    method: "POST",
    description: "AI-enhanced wallet profit/loss analysis",
    cost: "0.005 STX",
    category: "Wallet Analysis",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },

  // ALEX DEX
  {
    path: "/api/alex/swap-optimizer",
    method: "POST",
    description: "AI swap route optimizer - finds optimal routes, calculates slippage",
    cost: "0.005 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
    body: { tokenIn: "Input token", tokenOut: "Output token", amount: "Amount" },
  },
  {
    path: "/api/alex/pool-risk",
    method: "POST",
    description: "LP position risk analyzer - impermanent loss scenarios",
    cost: "0.008 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
    body: { pool: "Pool identifier", amount: "LP amount" },
  },
  {
    path: "/api/alex/arbitrage-scan",
    method: "GET",
    description: "Cross-pool arbitrage scanner - finds price discrepancies",
    cost: "0.01 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/alex/market-regime",
    method: "GET",
    description: "Market regime detector - classifies current market conditions",
    cost: "0.005 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
  },

  // Zest Protocol (Lending)
  {
    path: "/api/zest/liquidation-risk",
    method: "POST",
    description: "Liquidation risk monitor - health factor analysis",
    cost: "0.008 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/zest/yield-optimizer",
    method: "POST",
    description: "Lending yield optimizer - recommends optimal strategy",
    cost: "0.008 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address", amount: "Amount to optimize" },
  },
  {
    path: "/api/zest/interest-forecast",
    method: "GET",
    description: "Interest rate forecaster - predicts rate movements",
    cost: "0.005 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/zest/position-health",
    method: "POST",
    description: "Position health analyzer - comprehensive check with rebalancing recommendations",
    cost: "0.005 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },

  // DeFi Portfolio
  {
    path: "/api/defi/portfolio-analyzer",
    method: "POST",
    description: "DeFi portfolio intelligence - combined analysis across protocols",
    cost: "0.015 STX",
    category: "DeFi",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/defi/strategy-builder",
    method: "POST",
    description: "AI strategy builder - generates complete DeFi strategy",
    cost: "0.02 STX",
    category: "DeFi",
    source: "x402.biwas.xyz",
    body: { address: "Address", riskTolerance: "low|medium|high", goals: "Goals" },
  },
];

const BIWAS_FREE_ENDPOINTS: X402Endpoint[] = [
  // Market Data
  {
    path: "/api/market/stats",
    method: "GET",
    description: "Stacks DeFi market statistics",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/gainers",
    method: "GET",
    description: "Top gaining tokens by price change",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/losers",
    method: "GET",
    description: "Top losing tokens by price change",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/whales",
    method: "GET",
    description: "Recent whale trades",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/netflow",
    method: "GET",
    description: "Hourly net flow of funds",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },

  // Pools
  {
    path: "/api/pools/trending",
    method: "GET",
    description: "Trending liquidity pools",
    cost: "FREE",
    category: "Pools",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/pools/ohlc",
    method: "POST",
    description: "OHLCV candlestick data for pools",
    cost: "FREE",
    category: "Pools",
    source: "x402.biwas.xyz",
    body: { pool: "Pool identifier", interval: "1h | 4h | 1d" },
  },

  // Tokens
  {
    path: "/api/tokens/summary",
    method: "POST",
    description: "Token market summary",
    cost: "FREE",
    category: "Tokens",
    source: "x402.biwas.xyz",
    body: { token: "Token symbol or contract ID" },
  },
  {
    path: "/api/tokens/details",
    method: "POST",
    description: "Full token details including metadata",
    cost: "FREE",
    category: "Tokens",
    source: "x402.biwas.xyz",
    body: { token: "Token symbol or contract ID" },
  },
];

// =============================================================================
// x402.aibtc.com ENDPOINTS
// =============================================================================

const AIBTC_PAID_ENDPOINTS: X402Endpoint[] = [
  // Inference
  {
    path: "/inference/openrouter/chat",
    method: "POST",
    description: "Chat completion via OpenRouter (Claude, GPT-4, etc.)",
    cost: "Dynamic",
    category: "Inference",
    source: "x402.aibtc.com",
    body: { model: "Model name", messages: "Chat messages array" },
  },
  {
    path: "/inference/cloudflare/chat",
    method: "POST",
    description: "Chat completion via Cloudflare Workers AI",
    cost: "Dynamic",
    category: "Inference",
    source: "x402.aibtc.com",
    body: { model: "Model name", messages: "Chat messages array" },
  },

  // Stacks Utilities
  {
    path: "/stacks/address/{address}",
    method: "GET",
    description: "Convert Stacks address between networks",
    cost: "0.001 STX",
    category: "Stacks Utilities",
    source: "x402.aibtc.com",
    params: { targetNetwork: "mainnet or testnet" },
  },
  {
    path: "/stacks/decode/transaction",
    method: "POST",
    description: "Decode a serialized Stacks transaction",
    cost: "0.001 STX",
    category: "Stacks Utilities",
    source: "x402.aibtc.com",
    body: { hex: "Raw transaction hex" },
  },
  {
    path: "/stacks/decode/clarity",
    method: "POST",
    description: "Decode a Clarity value from hex",
    cost: "0.001 STX",
    category: "Stacks Utilities",
    source: "x402.aibtc.com",
    body: { hex: "Clarity value hex" },
  },
  {
    path: "/stacks/profile/{address}",
    method: "GET",
    description: "Get aggregated profile data (BNS, balances, NFTs)",
    cost: "0.001 STX",
    category: "Stacks Utilities",
    source: "x402.aibtc.com",
  },

  // Hashing
  {
    path: "/hashing/sha256",
    method: "POST",
    description: "SHA-256 hash",
    cost: "0.0005 STX",
    category: "Hashing",
    source: "x402.aibtc.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/hashing/keccak256",
    method: "POST",
    description: "Keccak-256 hash",
    cost: "0.0005 STX",
    category: "Hashing",
    source: "x402.aibtc.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/hashing/hash160",
    method: "POST",
    description: "RIPEMD160(SHA256) hash",
    cost: "0.0005 STX",
    category: "Hashing",
    source: "x402.aibtc.com",
    body: { data: "Data to hash" },
  },

  // Storage - KV
  {
    path: "/storage/kv",
    method: "POST",
    description: "Store key-value pair",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { key: "Key name", value: "Value", ttl: "TTL in seconds (optional)" },
  },
  {
    path: "/storage/kv/{key}",
    method: "GET",
    description: "Retrieve value by key",
    cost: "0.0005 STX",
    category: "Storage",
    source: "x402.aibtc.com",
  },
  {
    path: "/storage/kv/{key}",
    method: "DELETE",
    description: "Delete key-value pair",
    cost: "0.0005 STX",
    category: "Storage",
    source: "x402.aibtc.com",
  },

  // Storage - Paste
  {
    path: "/storage/paste",
    method: "POST",
    description: "Create a paste/snippet",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { content: "Content", title: "Title (optional)", language: "Language (optional)", ttl: "TTL in seconds (optional)" },
  },
  {
    path: "/storage/paste/{id}",
    method: "GET",
    description: "Retrieve paste by ID",
    cost: "0.0005 STX",
    category: "Storage",
    source: "x402.aibtc.com",
  },

  // Storage - DB
  {
    path: "/storage/db/query",
    method: "POST",
    description: "Execute read-only SELECT query",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { sql: "SELECT query" },
  },
  {
    path: "/storage/db/execute",
    method: "POST",
    description: "Execute write operations (INSERT, UPDATE, DELETE)",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { sql: "SQL statement" },
  },

  // Storage - Memory
  {
    path: "/storage/memory/store",
    method: "POST",
    description: "Store memory with optional embedding",
    cost: "0.002 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { key: "Memory key", content: "Content", embed: "Generate embedding (bool)" },
  },
  {
    path: "/storage/memory/search",
    method: "POST",
    description: "Semantic search across memories",
    cost: "0.002 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { query: "Search query", limit: "Max results" },
  },
];

const AIBTC_FREE_ENDPOINTS: X402Endpoint[] = [
  {
    path: "/health",
    method: "GET",
    description: "Service health status",
    cost: "FREE",
    category: "System",
    source: "x402.aibtc.com",
  },
];

// =============================================================================
// stx402.com ENDPOINTS
// =============================================================================

const STX402_FREE_ENDPOINTS: X402Endpoint[] = [
  {
    path: "/health",
    method: "GET",
    description: "Service health status",
    cost: "FREE",
    category: "System",
    source: "stx402.com",
  },
  {
    path: "/registry/list",
    method: "GET",
    description: "List all registered x402 endpoints",
    cost: "FREE",
    category: "Registry",
    source: "stx402.com",
  },
  {
    path: "/links/expand/{slug}",
    method: "GET",
    description: "Expand short link with click tracking",
    cost: "FREE",
    category: "Links",
    source: "stx402.com",
    params: { slug: "Short link slug" },
  },
  {
    path: "/agent/registry",
    method: "GET",
    description: "Agent registry contract info (ERC-8004)",
    cost: "FREE",
    category: "Agent Registry",
    source: "stx402.com",
  },
];

// =============================================================================
// aibtc.com ENDPOINTS (Inbox Messaging)
// =============================================================================

const AIBTC_INBOX_FREE_ENDPOINTS: X402Endpoint[] = [
  {
    path: "/api/inbox/{address}",
    method: "GET",
    description: "Retrieve messages for an address",
    cost: "FREE",
    category: "Inbox",
    source: "aibtc.com",
    params: { address: "Stacks address" },
  },
  {
    path: "/api/inbox/{address}/{messageId}",
    method: "DELETE",
    description: "Delete a message by ID",
    cost: "FREE",
    category: "Inbox",
    source: "aibtc.com",
    params: { address: "Stacks address", messageId: "Message ID" },
  },
];

const AIBTC_INBOX_PAID_ENDPOINTS: X402Endpoint[] = [
  {
    path: "/api/inbox/{address}",
    method: "POST",
    description: "Send a message to an address",
    cost: "0.000001 sBTC",
    category: "Inbox",
    source: "aibtc.com",
    params: { address: "Recipient Stacks address" },
    body: { from: "Sender address or identifier", message: "Message content" },
  },
];

const STX402_PAID_ENDPOINTS: X402Endpoint[] = [
  // Registry
  {
    path: "/registry/probe",
    method: "POST",
    description: "Discover x402 payment info for an endpoint",
    cost: "Paid",
    category: "Registry",
    source: "stx402.com",
    body: { url: "Endpoint URL to probe" },
  },
  {
    path: "/registry/register",
    method: "POST",
    description: "Register a new x402 endpoint",
    cost: "Paid",
    category: "Registry",
    source: "stx402.com",
    body: { url: "Endpoint URL", description: "Description" },
  },
  {
    path: "/registry/details",
    method: "POST",
    description: "Get full details of registered endpoint",
    cost: "Paid",
    category: "Registry",
    source: "stx402.com",
    body: { url: "Endpoint URL" },
  },

  // Links
  {
    path: "/links/create",
    method: "POST",
    description: "Create a short link",
    cost: "Paid",
    category: "Links",
    source: "stx402.com",
    body: { url: "URL to shorten", slug: "Custom slug (optional)" },
  },
  {
    path: "/links/stats",
    method: "POST",
    description: "Get link analytics",
    cost: "Paid",
    category: "Links",
    source: "stx402.com",
    body: { slug: "Link slug" },
  },
  {
    path: "/links/list",
    method: "GET",
    description: "List all your links",
    cost: "Paid",
    category: "Links",
    source: "stx402.com",
  },

  // Agent Registry (ERC-8004)
  {
    path: "/agent/info",
    method: "POST",
    description: "Get agent info by ID",
    cost: "Paid",
    category: "Agent Registry",
    source: "stx402.com",
    body: { agentId: "Agent ID" },
  },
  {
    path: "/agent/lookup",
    method: "POST",
    description: "Lookup agent by owner address",
    cost: "Paid",
    category: "Agent Registry",
    source: "stx402.com",
    body: { owner: "Owner address" },
  },

  // Agent Reputation
  {
    path: "/agent/reputation/summary",
    method: "POST",
    description: "Get agent reputation summary",
    cost: "Paid",
    category: "Agent Reputation",
    source: "stx402.com",
    body: { agentId: "Agent ID" },
  },
  {
    path: "/agent/reputation/list",
    method: "POST",
    description: "List all feedback for agent",
    cost: "Paid",
    category: "Agent Reputation",
    source: "stx402.com",
    body: { agentId: "Agent ID" },
  },
];

// =============================================================================
// EXPORTS
// =============================================================================

const PAID_ENDPOINTS = [
  ...BIWAS_PAID_ENDPOINTS,
  ...AIBTC_PAID_ENDPOINTS,
  ...AIBTC_INBOX_PAID_ENDPOINTS,
  ...STX402_PAID_ENDPOINTS,
];
const FREE_ENDPOINTS = [
  ...BIWAS_FREE_ENDPOINTS,
  ...AIBTC_FREE_ENDPOINTS,
  ...AIBTC_INBOX_FREE_ENDPOINTS,
  ...STX402_FREE_ENDPOINTS,
];
export const ALL_ENDPOINTS = [...PAID_ENDPOINTS, ...FREE_ENDPOINTS];

/**
 * Search endpoints by keyword
 */
export function searchEndpoints(query: string): X402Endpoint[] {
  const lowerQuery = query.toLowerCase();
  return ALL_ENDPOINTS.filter(
    (endpoint) =>
      endpoint.path.toLowerCase().includes(lowerQuery) ||
      endpoint.description.toLowerCase().includes(lowerQuery) ||
      endpoint.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get endpoints by source
 */
export function getEndpointsBySource(source: X402Source): X402Endpoint[] {
  return ALL_ENDPOINTS.filter((endpoint) => endpoint.source === source);
}

/**
 * Format endpoints for display
 */
export function formatEndpointsTable(endpoints: X402Endpoint[]): string {
  const grouped = endpoints.reduce(
    (acc, endpoint) => {
      const key = `${endpoint.category} (${endpoint.source})`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(endpoint);
      return acc;
    },
    {} as Record<string, X402Endpoint[]>
  );

  let output = "";
  for (const [category, eps] of Object.entries(grouped)) {
    output += `\n## ${category}\n`;
    for (const ep of eps) {
      output += `- ${ep.method} ${ep.path} (${ep.cost})\n  ${ep.description}\n`;
      if (ep.params) {
        output += `  Params: ${JSON.stringify(ep.params)}\n`;
      }
      if (ep.body) {
        output += `  Body: ${JSON.stringify(ep.body)}\n`;
      }
    }
  }
  return output.trim();
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const categories = new Set(ALL_ENDPOINTS.map((ep) => ep.category));
  return Array.from(categories).sort();
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function normalizeSource(url: string): X402Source | undefined {
  let hostname: string | undefined;

  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    try {
      hostname = new URL(`https://${url}`).hostname.toLowerCase();
    } catch {
      return undefined;
    }
  }

  if (matchesDomain(hostname, "x402.biwas.xyz")) return "x402.biwas.xyz";
  if (matchesDomain(hostname, "x402.aibtc.com")) return "x402.aibtc.com";
  if (matchesDomain(hostname, "stx402.com")) return "stx402.com";
  if (matchesDomain(hostname, "aibtc.com")) return "aibtc.com";
  return undefined;
}

// Memoization cache for path pattern regexes
const pathRegexCache = new Map<string, RegExp>();

/**
 * Convert a path pattern with placeholders to a regex.
 * Example: "/api/inbox/{address}" → /^\/api\/inbox\/([^/]+)$/
 */
function pathToRegex(pattern: string): RegExp {
  const cached = pathRegexCache.get(pattern);
  if (cached) {
    return cached;
  }

  // Split on {paramName} placeholders, escape literal segments, rejoin with capture groups
  const parts = pattern.split(/\{[^}]+\}/);
  const escaped = parts.map(p => p.replace(/[.*+?^$|()[\]{}\\]/g, '\\$&')).join('([^/]+)');
  const regex = new RegExp(`^${escaped}$`);

  pathRegexCache.set(pattern, regex);
  return regex;
}

/**
 * Lookup an endpoint in the registry by method, path, and source URL.
 * Used to determine if an endpoint is known-FREE or known-PAID before
 * deciding whether to use a payment-capable client.
 *
 * Supports path patterns with placeholders like {address}, {messageId}, etc.
 */
export function lookupEndpoint(
  method: string,
  path: string,
  sourceUrl: string
): X402Endpoint | undefined {
  const source = normalizeSource(sourceUrl);
  if (!source) {
    return undefined;
  }

  const pathWithoutQuery = path.split("?")[0];
  const normalizedPath = pathWithoutQuery.startsWith("/") ? pathWithoutQuery : `/${pathWithoutQuery}`;
  const normalizedMethod = method.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE";

  // Fast path: try exact match first
  const exactMatch = ALL_ENDPOINTS.find(
    (ep) =>
      ep.method === normalizedMethod &&
      ep.path === normalizedPath &&
      ep.source === source
  );

  if (exactMatch) {
    return exactMatch;
  }

  // Slow path: try pattern matching for endpoints with placeholders
  for (const ep of ALL_ENDPOINTS) {
    if (ep.method !== normalizedMethod || ep.source !== source) {
      continue;
    }

    // Skip if pattern has no placeholders (already tried exact match)
    if (!ep.path.includes('{')) {
      continue;
    }

    const regex = pathToRegex(ep.path);
    if (regex.test(normalizedPath)) {
      return ep;
    }
  }

  return undefined;
}
