/**
 * Assets Layer — Universal Price & Market Intelligence
 *
 * Covers: crypto, fiat, stocks, commodities
 * Sources: CoinGecko · open.er-api.com · Yahoo Finance
 * All prices SHA256-anchored to Bitcoin.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }         from "zod";
import {
  getPrice,
  getCryptoPrices,
  getForexRates,
  getStockPrice,
  getMarketSnapshot,
  FIAT_CURRENCIES,
} from "../services/price-engine.js";

export function registerAssetsTools(server: McpServer): void {

  // ── asset_price ─────────────────────────────────────────────────────────────

  server.registerTool(
    "asset_price",
    {
      title:       "Asset Price",
      description: "Get current price for any asset: crypto (BTC, ETH, SOL, STX…), fiat (USD, EUR, AED, SAR, LBP…), or stock (AAPL, TSLA, MSFT…). Prices are SHA256-anchored.",
      inputSchema: z.object({
        symbol: z.string().describe("Asset symbol — e.g. BTC, ETH, EUR, AAPL"),
      }),
    },
    async ({ symbol }) => {
      const result = await getPrice(symbol.toUpperCase());
      if (!result) {
        return { content: [{ type: "text", text: `No price data found for "${symbol}". Try a known crypto symbol, ISO 4217 fiat code, or stock ticker.` }] };
      }
      const lines = [
        `**${result.symbol}** (${result.name})`,
        `Type:         ${result.type}`,
        `Price USD:    $${result.price_usd.toLocaleString("en-US", { maximumFractionDigits: 8 })}`,
        result.price_btc !== undefined
          ? `Price BTC:    ₿${result.price_btc.toFixed(10)}`
          : null,
        result.change_24h !== undefined
          ? `Change 24h:   ${result.change_24h >= 0 ? "+" : ""}${result.change_24h.toFixed(2)}%`
          : null,
        result.market_cap !== undefined
          ? `Market Cap:   $${(result.market_cap / 1e9).toFixed(2)}B`
          : null,
        result.volume_24h !== undefined
          ? `Volume 24h:   $${(result.volume_24h / 1e6).toFixed(1)}M`
          : null,
        `Source:       ${result.source}`,
        `Fetched:      ${new Date(result.fetched_at).toISOString()}`,
        `SHA256:       ${result.snapshot_hash}`,
      ].filter(Boolean).join("\n");

      return { content: [{ type: "text", text: lines }] };
    },
  );

  // ── asset_batch ──────────────────────────────────────────────────────────────

  server.registerTool(
    "asset_batch",
    {
      title:       "Asset Batch Prices",
      description: "Get prices for multiple assets in one call. Pass up to 20 symbols — mix of crypto, fiat, or stocks.",
      inputSchema: z.object({
        symbols: z.array(z.string()).min(1).max(20).describe("Array of asset symbols"),
      }),
    },
    async ({ symbols }) => {
      const results = await Promise.all(symbols.map(s => getPrice(s.toUpperCase())));
      const rows = results.map((r, i) => {
        if (!r) return `${symbols[i].toUpperCase().padEnd(8)} — not found`;
        const chg = r.change_24h !== undefined ? ` (${r.change_24h >= 0 ? "+" : ""}${r.change_24h.toFixed(2)}%)` : "";
        return `${r.symbol.padEnd(8)} $${r.price_usd.toLocaleString("en-US", { maximumFractionDigits: 6 }).padStart(16)}${chg}  [${r.type}]`;
      });
      return { content: [{ type: "text", text: rows.join("\n") }] };
    },
  );

  // ── asset_convert ────────────────────────────────────────────────────────────

  server.registerTool(
    "asset_convert",
    {
      title:       "Asset Conversion",
      description: "Convert an amount from one asset to another. Works across crypto, fiat, and stocks — all via USD bridge.",
      inputSchema: z.object({
        from:   z.string().describe("Source asset symbol (e.g. BTC)"),
        to:     z.string().describe("Target asset symbol (e.g. EUR)"),
        amount: z.number().positive().describe("Amount in source asset units"),
      }),
    },
    async ({ from, to, amount }) => {
      const [fromPrice, toPrice] = await Promise.all([
        getPrice(from.toUpperCase()),
        getPrice(to.toUpperCase()),
      ]);

      if (!fromPrice) return { content: [{ type: "text", text: `Unknown asset: ${from}` }] };
      if (!toPrice)   return { content: [{ type: "text", text: `Unknown asset: ${to}` }] };

      const usdValue   = amount * fromPrice.price_usd;
      const converted  = usdValue / toPrice.price_usd;
      const precision  = toPrice.type === "crypto" ? 8 : 4;

      return {
        content: [{
          type: "text",
          text: [
            `${amount} ${fromPrice.symbol} = **${converted.toFixed(precision)} ${toPrice.symbol}**`,
            ``,
            `Via USD: $${usdValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
            `Rate: 1 ${fromPrice.symbol} = ${(fromPrice.price_usd / toPrice.price_usd).toFixed(precision)} ${toPrice.symbol}`,
            `Sources: ${fromPrice.source} · ${toPrice.source}`,
          ].join("\n"),
        }],
      };
    },
  );

  // ── asset_market ─────────────────────────────────────────────────────────────

  server.registerTool(
    "asset_market",
    {
      title:       "Market Snapshot",
      description: "Full market snapshot: top crypto, major fiat rates, stock prices. All anchored to BTC and SHA256-hashed.",
      inputSchema: z.object({
        cryptos: z.array(z.string()).optional().describe("Crypto symbols (default: BTC ETH SOL STX)"),
        fiats:   z.array(z.string()).optional().describe("Fiat codes (default: EUR GBP JPY AED SAR)"),
        stocks:  z.array(z.string()).optional().describe("Stock tickers (default: AAPL TSLA MSFT)"),
      }),
    },
    async ({ cryptos, fiats, stocks }) => {
      const snap = await getMarketSnapshot(
        cryptos as string[] | undefined,
        fiats   as string[] | undefined,
        stocks  as string[] | undefined,
      );

      const btcLine = `Bitcoin: $${snap.btc_usd.toLocaleString("en-US")}`;
      const sections: string[] = [btcLine, ""];

      const byType = (type: string) => snap.assets.filter(a => a.type === type);

      const fmt = (a: typeof snap.assets[0]) => {
        const chg = a.change_24h !== undefined ? ` ${a.change_24h >= 0 ? "+" : ""}${a.change_24h.toFixed(1)}%` : "";
        return `  ${a.symbol.padEnd(8)} $${a.price_usd.toLocaleString("en-US", { maximumFractionDigits: 2 }).padStart(14)}${chg}`;
      };

      const cr = byType("crypto");
      if (cr.length) { sections.push("── Crypto ──"); cr.forEach(a => sections.push(fmt(a))); sections.push(""); }

      const fx = byType("fiat");
      if (fx.length) { sections.push("── Fiat ──"); fx.forEach(a => sections.push(fmt(a))); sections.push(""); }

      const st = byType("stock");
      if (st.length) { sections.push("── Stocks ──"); st.forEach(a => sections.push(fmt(a))); sections.push(""); }

      sections.push(`SHA256 chain: ${snap.chain_hash}`);
      sections.push(`Snapshot at:  ${new Date(snap.snapshot_at).toISOString()}`);

      return { content: [{ type: "text", text: sections.join("\n") }] };
    },
  );

  // ── asset_crypto ─────────────────────────────────────────────────────────────

  server.registerTool(
    "asset_crypto",
    {
      title:       "Crypto Prices",
      description: "Fetch prices for one or more cryptocurrencies from CoinGecko. Returns USD price, BTC equivalent, 24h change, volume, and market cap.",
      inputSchema: z.object({
        symbols: z.array(z.string()).min(1).max(20).describe("Crypto symbols: BTC ETH SOL STX BNB XRP ADA AVAX DOT LINK…"),
      }),
    },
    async ({ symbols }) => {
      const results = await getCryptoPrices(symbols.map(s => s.toUpperCase()));
      if (!results.length) return { content: [{ type: "text", text: "No data returned. Check symbols against supported list: BTC ETH SOL STX BNB XRP ADA AVAX DOT MATIC LINK LTC BCH ATOM UNI DOGE SHIB TRX sBTC" }] };

      const lines = results.map(r =>
        `${r.symbol.padEnd(6)}  $${r.price_usd.toLocaleString("en-US").padStart(14)}` +
        (r.change_24h !== undefined ? `  ${r.change_24h >= 0 ? "+" : ""}${r.change_24h.toFixed(2)}%` : "") +
        (r.market_cap ? `  MCap $${(r.market_cap / 1e9).toFixed(1)}B` : "")
      );

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  // ── asset_forex ──────────────────────────────────────────────────────────────

  server.registerTool(
    "asset_forex",
    {
      title:       "Forex Rates",
      description: "Get fiat currency exchange rates anchored to USD. Covers 45+ currencies including AED, SAR, LBP, JOD, EGP, NGN, PKR, INR, and all major pairs.",
      inputSchema: z.object({
        currencies: z.array(z.string()).min(1).max(50).optional().describe("ISO 4217 codes. Omit for all 45+ supported currencies."),
        base:       z.string().optional().describe("Base currency (default: USD)"),
      }),
    },
    async ({ currencies, base }) => {
      const codes  = currencies?.map(c => c.toUpperCase()) ?? FIAT_CURRENCIES;
      const results = await getForexRates(codes, base ?? "USD");

      if (!results.length) return { content: [{ type: "text", text: "No forex data returned." }] };

      const lines = results.map(r =>
        `${r.symbol.padEnd(5)}  $${r.price_usd.toFixed(6).padStart(12)} USD`
      );

      return { content: [{ type: "text", text: [`Forex rates vs USD — ${new Date().toISOString()}`, ...lines].join("\n") }] };
    },
  );

  // ── asset_stock ──────────────────────────────────────────────────────────────

  server.registerTool(
    "asset_stock",
    {
      title:       "Stock Price",
      description: "Get current stock price via Yahoo Finance. Works for any US or international ticker: AAPL, TSLA, MSFT, NVDA, AMZN, GOOGL, BRK-B, etc.",
      inputSchema: z.object({
        ticker: z.string().describe("Stock ticker symbol (e.g. AAPL, TSLA, MSFT, NVDA)"),
      }),
    },
    async ({ ticker }) => {
      const result = await getStockPrice(ticker.toUpperCase());
      if (!result) return { content: [{ type: "text", text: `No data for ticker "${ticker}". Verify it's a valid Yahoo Finance symbol.` }] };

      return {
        content: [{
          type: "text",
          text: [
            `**${result.symbol}** — ${result.name}`,
            `Price: $${result.price_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `Source: ${result.source}`,
            `SHA256: ${result.snapshot_hash}`,
          ].join("\n"),
        }],
      };
    },
  );
}
