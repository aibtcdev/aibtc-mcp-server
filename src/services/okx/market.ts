/**
 * OKX public market data endpoints.
 *
 * All endpoints under /api/v5/market/* are public — no API key required.
 * Verified 2026-05-02 by direct curl on www.okx.com and us.okx.com.
 *
 * Rate limit: 20 requests / 2 seconds per IP (per OKX v5 docs).
 */

import { okxGet } from "./client.js";
import type { OkxCandleBar, OkxTickersInstType } from "./types.js";

export interface OkxTicker {
  instType: string;
  instId: string;
  last: string;
  lastSz: string;
  askPx: string;
  askSz: string;
  bidPx: string;
  bidSz: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
  vol24h: string;
  sodUtc0: string;
  sodUtc8: string;
  ts: string;
}

export interface OkxOrderBook {
  asks: string[][];
  bids: string[][];
  ts: string;
}

/**
 * A single candlestick row from /api/v5/market/candles.
 * Positional tuple: [ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm].
 * Verified live (2026-05-02): always 9 elements, all stringified numbers/timestamps.
 */
export type OkxCandle = [
  ts: string,
  open: string,
  high: string,
  low: string,
  close: string,
  vol: string,
  volCcy: string,
  volCcyQuote: string,
  confirm: string,
];

export async function getTicker(instId: string): Promise<OkxTicker | undefined> {
  const data = await okxGet<OkxTicker>("/api/v5/market/ticker", { instId });
  return data[0];
}

export async function getTickers(
  instType: OkxTickersInstType,
  uly?: string,
  instFamily?: string
): Promise<OkxTicker[]> {
  return okxGet<OkxTicker>("/api/v5/market/tickers", {
    instType,
    uly,
    instFamily,
  });
}

export async function getOrderBook(instId: string, sz?: number): Promise<OkxOrderBook | undefined> {
  const data = await okxGet<OkxOrderBook>("/api/v5/market/books", { instId, sz });
  return data[0];
}

export async function getCandles(
  instId: string,
  bar: OkxCandleBar = "1H",
  limit = 100,
  after?: string,
  before?: string
): Promise<OkxCandle[]> {
  return okxGet<OkxCandle>("/api/v5/market/candles", {
    instId,
    bar,
    limit,
    after,
    before,
  });
}
