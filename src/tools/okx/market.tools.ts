/**
 * OKX public market data MCP tools.
 *
 * No API key required — these endpoints are publicly accessible on
 * www.okx.com (and us.okx.com for US-restricted users). Switch host with
 * the OKX_BASE_URL env var.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../../utils/index.js";
import {
  getCandles,
  getOrderBook,
  getTicker,
  getTickers,
} from "../../services/okx/index.js";

// /api/v5/market/tickers does NOT accept MARGIN (verified live: returns 51000).
const TICKERS_INSTRUMENT_TYPES = ["SPOT", "SWAP", "FUTURES", "OPTION"] as const;

// Verified live (2026-05-02): 8H, 6M, 1Y are NOT accepted on /market/candles.
// Lowercase m = minutes, uppercase M = months. UTC variants only for ≥6H bars.
const CANDLE_BARS = [
  "1m", "3m", "5m", "15m", "30m",
  "1H", "2H", "4H", "6H", "12H",
  "1D", "2D", "3D", "1W", "1M", "3M",
  "6Hutc", "12Hutc", "1Dutc", "1Wutc", "1Mutc", "3Mutc",
] as const;

export function registerOkxMarketTools(server: McpServer): void {
  server.registerTool(
    "okx_market_ticker",
    {
      description:
        "Get the latest ticker for a single OKX instrument (last price, 24h volume, " +
        "best bid/ask). Public endpoint — no API key required. Set OKX_BASE_URL=https://us.okx.com " +
        "for US-restricted accounts.",
      inputSchema: {
        instId: z
          .string()
          .describe("Instrument id, e.g. 'BTC-USDT' (spot), 'BTC-USDT-SWAP' (perp)"),
      },
    },
    async ({ instId }) => {
      try {
        const ticker = await getTicker(instId);
        if (!ticker) {
          return createErrorResponse(new Error(`No ticker found for ${instId}`));
        }
        return createJsonResponse(ticker);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_market_tickers",
    {
      description:
        "List tickers for all instruments of a given type (SPOT/MARGIN/SWAP/FUTURES/OPTION). " +
        "Public endpoint — no API key required.",
      inputSchema: {
        instType: z
          .enum(TICKERS_INSTRUMENT_TYPES)
          .describe("Instrument type to list (MARGIN not supported on this endpoint)"),
        uly: z
          .string()
          .optional()
          .describe("Underlying, only for FUTURES/SWAP/OPTION (e.g. 'BTC-USD')"),
        instFamily: z
          .string()
          .optional()
          .describe("Instrument family, only for FUTURES/SWAP/OPTION"),
      },
    },
    async ({ instType, uly, instFamily }) => {
      try {
        const data = await getTickers(instType, uly, instFamily);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_market_orderbook",
    {
      description:
        "Get the order book snapshot for an OKX instrument. Public endpoint — no API key required.",
      inputSchema: {
        instId: z.string().describe("Instrument id, e.g. 'BTC-USDT'"),
        sz: z
          .number()
          .int()
          .min(1)
          .max(400)
          .optional()
          .describe("Depth per side (1-400, default 1)"),
      },
    },
    async ({ instId, sz }) => {
      try {
        const book = await getOrderBook(instId, sz);
        if (!book) {
          return createErrorResponse(new Error(`No orderbook found for ${instId}`));
        }
        return createJsonResponse(book);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_market_candles",
    {
      description:
        "Get candlestick (OHLCV) data for an OKX instrument. Each candle is " +
        "[ts, open, high, low, close, vol, volCcy, volCcyQuote, confirm]. Public endpoint — " +
        "no API key required.",
      inputSchema: {
        instId: z.string().describe("Instrument id, e.g. 'BTC-USDT'"),
        bar: z
          .enum(CANDLE_BARS)
          .optional()
          .default("1H")
          .describe("Candle interval (default '1H')"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(300)
          .optional()
          .default(100)
          .describe("Number of candles (1-300, default 100)"),
        after: z
          .string()
          .optional()
          .describe("Pagination: return records earlier than this timestamp (ms)"),
        before: z
          .string()
          .optional()
          .describe("Pagination: return records newer than this timestamp (ms)"),
      },
    },
    async ({ instId, bar, limit, after, before }) => {
      try {
        const data = await getCandles(instId, bar, limit, after, before);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
