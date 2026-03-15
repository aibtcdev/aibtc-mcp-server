/**
 * Tenero API client for Stacks ecosystem market analytics
 *
 * Public API at https://api.tenero.io — no authentication required.
 * Formerly known as STXTools. Covers Stacks, Spark, and SportsFun chains.
 *
 * Endpoint pattern: /v1/{chain}/{resource}
 * Default chain: stacks
 */

const TENERO_BASE = "https://api.tenero.io";

async function fetchTenero(path: string): Promise<unknown> {
  const response = await fetch(`${TENERO_BASE}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`Tenero API error ${response.status}: ${text}`);
  }
  const json = (await response.json()) as {
    statusCode: number;
    message: string;
    data: unknown;
  };
  return json.data;
}

/**
 * Get token details including metadata, price, and volume.
 * @param contractId - Token contract address (e.g. SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex)
 * @param chain - Chain to query (default: stacks)
 */
export async function getTokenInfo(
  contractId: string,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/tokens/${contractId}`);
}

/**
 * Get token market summary including price history, volume, and pool liquidity.
 * @param contractId - Token contract address
 * @param chain - Chain to query (default: stacks)
 */
export async function getMarketSummary(
  contractId: string,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/tokens/${contractId}/market_summary`);
}

/**
 * Get overall market statistics: volume, active traders, netflow.
 * @param chain - Chain to query (default: stacks)
 */
export async function getMarketStats(chain = "stacks"): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/market/stats`);
}

/**
 * Get top gaining tokens by price change percentage.
 * @param limit - Maximum number of results (default: 10)
 * @param chain - Chain to query (default: stacks)
 */
export async function getTopGainers(
  limit = 10,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/market/top_gainers?limit=${limit}`);
}

/**
 * Get top losing tokens by price change percentage.
 * @param limit - Maximum number of results (default: 10)
 * @param chain - Chain to query (default: stacks)
 */
export async function getTopLosers(
  limit = 10,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/market/top_losers?limit=${limit}`);
}

/**
 * Get trending DEX pools by volume within the last hour.
 * @param limit - Maximum number of results (default: 10)
 * @param chain - Chain to query (default: stacks)
 */
export async function getTrendingPools(
  limit = 10,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/pools/trending/1h?limit=${limit}`);
}

/**
 * Get wallet trade history.
 * @param address - Stacks address to query
 * @param limit - Maximum number of results (default: 20)
 * @param chain - Chain to query (default: stacks)
 */
export async function getWalletTrades(
  address: string,
  limit = 20,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/wallets/${address}/trades?limit=${limit}`);
}

/**
 * Get wallet token holdings with current value.
 * @param address - Stacks address to query
 * @param chain - Chain to query (default: stacks)
 */
export async function getWalletHoldings(
  address: string,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/wallets/${address}/holdings_value`);
}

/**
 * Get recent large/whale trades above threshold value.
 * @param limit - Maximum number of results (default: 10)
 * @param chain - Chain to query (default: stacks)
 */
export async function getWhaleTrades(
  limit = 10,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/market/whale_trades?limit=${limit}`);
}

/**
 * Get token holder distribution and statistics.
 * @param contractId - Token contract address
 * @param chain - Chain to query (default: stacks)
 */
export async function getHolderStats(
  contractId: string,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(`/v1/${chain}/tokens/${contractId}/holder_stats`);
}

/**
 * Search tokens, pools, and wallets by name or address.
 * @param query - Search query string
 * @param chain - Chain to query (default: stacks)
 */
export async function searchTokens(
  query: string,
  chain = "stacks"
): Promise<unknown> {
  return fetchTenero(
    `/v1/${chain}/search?q=${encodeURIComponent(query)}`
  );
}
