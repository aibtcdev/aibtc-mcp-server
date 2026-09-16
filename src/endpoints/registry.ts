/**
 * Static x402 endpoint entries for hosts that do not publish an OpenAPI spec.
 *
 * x402.aibtc.com and stx402.com publish `openapi.json`, so their endpoints are
 * discovered live (see services/x402-discovery.service.ts) instead of listed here.
 */

export type StaticX402Source = "x402.biwas.xyz" | "aibtc.com";

export interface X402Endpoint {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  cost: string;
  category: string;
  source: string;
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

export const STATIC_ENDPOINTS: X402Endpoint[] = [
  ...BIWAS_PAID_ENDPOINTS,
  ...BIWAS_FREE_ENDPOINTS,
  ...AIBTC_INBOX_PAID_ENDPOINTS,
  ...AIBTC_INBOX_FREE_ENDPOINTS,
];

/**
 * Format endpoints for display, grouped by category and source.
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
