/**
 * Price Engine — Universal Asset Prices
 *
 * Sources (all free, no API key required):
 *   Crypto  → CoinGecko public API
 *   Forex   → open.er-api.com (free tier)
 *   Stocks  → Yahoo Finance (unofficial public endpoint)
 *
 * All prices anchored to Bitcoin as the base unit.
 * SHA256 hash of each price snapshot for auditability.
 */

import { createHash } from "crypto";

export interface PriceResult {
  symbol:       string;
  name:         string;
  type:         "crypto" | "fiat" | "stock" | "commodity";
  price_usd:    number;
  price_btc?:   number;         // relative to Bitcoin
  change_24h?:  number;         // percent
  volume_24h?:  number;
  market_cap?:  number;
  source:       string;
  fetched_at:   number;
  snapshot_hash: string;        // SHA256 of price data
}

export interface MarketSnapshot {
  btc_usd:      number;
  assets:       PriceResult[];
  snapshot_at:  number;
  chain_hash:   string;         // SHA256(prev_hash + snapshot)
}

// ── CoinGecko IDs for common crypto ──────────────────────────────────────────

const COINGECKO_IDS: Record<string, string> = {
  BTC:   "bitcoin",       ETH:   "ethereum",      SOL:  "solana",
  BNB:   "binancecoin",   XRP:   "ripple",        ADA:  "cardano",
  AVAX:  "avalanche-2",   DOT:   "polkadot",      MATIC:"matic-network",
  LINK:  "chainlink",     LTC:   "litecoin",      BCH:  "bitcoin-cash",
  ATOM:  "cosmos",        UNI:   "uniswap",        DOGE: "dogecoin",
  SHIB:  "shiba-inu",     TRX:   "tron",          STX:  "blockstack",
  sBTC:  "sbtc",
};

// ── Common forex pairs ────────────────────────────────────────────────────────

export const FIAT_CURRENCIES = [
  "USD","EUR","GBP","JPY","CNY","AED","SAR","KWD","BHD",
  "CHF","CAD","AUD","NZD","SGD","HKD","KRW","INR","MXN",
  "BRL","RUB","TRY","ZAR","SEK","NOK","DKK","PLN","CZK",
  "HUF","ILS","THB","MYR","IDR","PHP","VND","EGP","NGN",
  "LBP","JOD","QAR","OMR","MAD","DZD","TND","PKR","BDT",
];

// ── Snapshot chain ────────────────────────────────────────────────────────────

let _prevChainHash = createHash("sha256")
  .update("aibtc-price-engine:genesis")
  .digest("hex");

function snapshotHash(data: string): string {
  const h = createHash("sha256")
    .update(_prevChainHash + data)
    .digest("hex");
  _prevChainHash = h;
  return h;
}

function priceHash(symbol: string, price: number, ts: number): string {
  return createHash("sha256")
    .update(`${symbol}:${price}:${ts}`)
    .digest("hex");
}

// ── Crypto prices via CoinGecko ───────────────────────────────────────────────

export async function getCryptoPrices(symbols: string[]): Promise<PriceResult[]> {
  const ids = symbols
    .map(s => COINGECKO_IDS[s.toUpperCase()])
    .filter(Boolean)
    .join(",");

  if (!ids) return [];

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,btc&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;

  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json() as Record<string, {
    usd: number; btc?: number; usd_24h_change?: number;
    usd_24h_vol?: number; usd_market_cap?: number;
  }>;

  const ts = Date.now();
  return symbols
    .filter(s => COINGECKO_IDS[s.toUpperCase()])
    .map(s => {
      const id    = COINGECKO_IDS[s.toUpperCase()];
      const entry = data[id];
      if (!entry) return null;
      const price = entry.usd;
      return {
        symbol:        s.toUpperCase(),
        name:          id,
        type:          "crypto" as const,
        price_usd:     price,
        price_btc:     entry.btc,
        change_24h:    entry.usd_24h_change,
        volume_24h:    entry.usd_24h_vol,
        market_cap:    entry.usd_market_cap,
        source:        "coingecko",
        fetched_at:    ts,
        snapshot_hash: priceHash(s, price, ts),
      };
    })
    .filter(Boolean) as PriceResult[];
}

// ── Forex rates via open.er-api.com ──────────────────────────────────────────

export async function getForexRates(
  currencies: string[],
  base = "USD",
): Promise<PriceResult[]> {
  const url = `https://open.er-api.com/v6/latest/${base}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json() as { rates: Record<string, number>; time_last_update_unix: number };

  const ts     = Date.now();
  const usdRate = data.rates["USD"] ?? 1;

  return currencies
    .filter(c => data.rates[c.toUpperCase()])
    .map(c => {
      const rate    = data.rates[c.toUpperCase()];
      const priceUsd = usdRate / rate;
      return {
        symbol:        c.toUpperCase(),
        name:          c.toUpperCase(),
        type:          "fiat" as const,
        price_usd:     priceUsd,
        source:        "open.er-api.com",
        fetched_at:    ts,
        snapshot_hash: priceHash(c, priceUsd, ts),
      };
    });
}

// ── Stock prices via Yahoo Finance ────────────────────────────────────────────

export async function getStockPrice(ticker: string): Promise<PriceResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const res  = await fetch(url, {
      signal:  AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const data = await res.json() as {
      chart: { result?: Array<{
        meta: { regularMarketPrice: number; symbol: string; shortName?: string };
        indicators: { quote: Array<{ close: number[] }> };
      }> };
    };

    const result = data.chart.result?.[0];
    if (!result) return null;

    const price = result.meta.regularMarketPrice;
    const ts    = Date.now();

    return {
      symbol:        ticker.toUpperCase(),
      name:          result.meta.shortName ?? ticker,
      type:          "stock",
      price_usd:     price,
      source:        "yahoo-finance",
      fetched_at:    ts,
      snapshot_hash: priceHash(ticker, price, ts),
    };
  } catch {
    return null;
  }
}

// ── Universal price lookup ────────────────────────────────────────────────────

export async function getPrice(symbol: string): Promise<PriceResult | null> {
  const upper = symbol.toUpperCase();

  // Crypto
  if (COINGECKO_IDS[upper]) {
    const results = await getCryptoPrices([upper]);
    return results[0] ?? null;
  }

  // Fiat
  if (FIAT_CURRENCIES.includes(upper)) {
    const results = await getForexRates([upper]);
    return results[0] ?? null;
  }

  // Stock (default)
  return getStockPrice(upper);
}

// ── Full market snapshot ──────────────────────────────────────────────────────

export async function getMarketSnapshot(
  cryptos  = ["BTC","ETH","SOL","STX"],
  fiats    = ["EUR","GBP","JPY","AED","SAR"],
  stocks   = ["AAPL","TSLA","MSFT"],
): Promise<MarketSnapshot> {

  const [cryptoResults, fiatResults, stockResults] = await Promise.allSettled([
    getCryptoPrices(cryptos),
    getForexRates(fiats),
    Promise.all(stocks.map(getStockPrice)).then(r => r.filter(Boolean) as PriceResult[]),
  ]);

  const assets = [
    ...(cryptoResults.status === "fulfilled" ? cryptoResults.value : []),
    ...(fiatResults.status  === "fulfilled"  ? fiatResults.value  : []),
    ...(stockResults.status === "fulfilled"  ? stockResults.value : []),
  ];

  const btcUsd = assets.find(a => a.symbol === "BTC")?.price_usd ?? 0;
  const ts     = Date.now();
  const hash   = snapshotHash(JSON.stringify(assets));

  return { btc_usd: btcUsd, assets, snapshot_at: ts, chain_hash: hash };
}
