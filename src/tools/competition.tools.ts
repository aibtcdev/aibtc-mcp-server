/**
 * AIBTC Trading Competition Tools
 *
 * Agents registered on aibtc.com (and indexed via ERC-8004) compete on a
 * time-bound track scored by P&L from on-chain trades. The competition service
 * monitors registered addresses passively, but agents can also submit txids
 * as a fast-path hint to skip indexer lag.
 *
 * Tools:
 * - competition_submit_trade  — Submit a trade txid for verification
 * - competition_status        — Get current standing for an agent address
 * - competition_list_trades   — Paginated trade history (submitted + indexed)
 *
 * No request signing in v1: txids are self-attesting (the on-chain tx
 * already carries the agent's signature and sender), and status/list reads
 * are over public addresses. Rate-limited per IP server-side.
 *
 * API spec + verifier implementation: aibtcdev/landing-page#734 (Phase 3.1).
 * Schema source of truth: docs/rfc-d1-schema.md §swaps (migration 005).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AIBTC_CAMPAIGN_API_URL } from "../config/competition.js";
import { NETWORK } from "../config/networks.js";
import { getTransactionStatus } from "../services/hiro-api.js";
import { getTokenInfo } from "../services/tenero-api.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { createJsonResponse } from "../utils/formatting.js";
import { createErrorResponse } from "../utils/errors.js";

/**
 * Stacks tx_status values from Hiro's /extended/v1/tx endpoint.
 * `pending` = in mempool, not confirmed. Everything else is terminal:
 * `success`, `abort_by_response`, `abort_by_post_condition`, and the
 * five `dropped_*` codes. The verifier records terminal failures too
 * (migration 005's CHECK allows all 8 terminal codes) so we only block
 * submission when status is `pending`.
 */
const PENDING_TX_STATUS = "pending";

const stacksAddressSchema = z
  .string()
  .regex(
    /^S[PTM][0-9A-HJKMNP-TV-Z]{38,40}$/,
    "Expected a Stacks address (SP… mainnet, ST… testnet, SM… contract)"
  );

async function resolveAddress(provided?: string): Promise<string> {
  if (provided) return provided;
  const wm = getWalletManager();
  const activeId = await wm.getActiveWalletId();
  if (!activeId) {
    throw new Error(
      "No address provided and no active wallet found. Pass `address` or activate a wallet."
    );
  }
  const wallets = await wm.listWallets();
  const meta = wallets.find((w) => w.id === activeId);
  if (!meta) {
    throw new Error(`Active wallet ${activeId} not found in wallet index.`);
  }
  return meta.address;
}

function normalizeTxid(txid: string): string {
  const trimmed = txid.trim();
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    throw new Error(
      `Invalid Stacks txid: expected 64 hex chars (with optional 0x prefix), got ${JSON.stringify(txid)}`
    );
  }
  return withPrefix.toLowerCase();
}

const COMPETITION_FETCH_TIMEOUT_MS = 10_000;

/**
 * Cap on `/trades` pagination when computing campaign stats. 10 pages × 200
 * trades = 2000 swaps — well above any realistic competition agent's volume.
 * If a real agent ever exceeds this, the response carries `pnl_truncated: true`
 * so the caller knows the totals are a lower bound.
 */
const PNL_MAX_TRADE_PAGES = 10;
const PNL_TRADES_PAGE_SIZE = 200;

/**
 * Per-token Tenero timeout. Field reports (from operators running this on
 * an ~80-calls/day sensor cycle) include 15-30s stalls on tokens that
 * haven't traded recently — without a bound the whole `competition_status`
 * call would block until Node's default socket timeout. 10s matches the
 * competition-API budget so a slow leg is treated the same as a slow
 * status fetch.
 */
const TENERO_TOKEN_TIMEOUT_MS = 10_000;

/**
 * Max concurrent Tenero requests when resolving distinct token prices.
 * Agents with many distinct tokens (30+) would otherwise fire that many
 * simultaneous calls and risk saturating Tenero's unauthenticated rate
 * limit. 10 keeps total wall time bounded while staying well clear of
 * the rate-limit ceiling.
 */
const TENERO_RESOLVE_CONCURRENCY = 10;

/**
 * Synthetic token id the indexer uses for native STX (no `::asset` form on
 * chain). Mirrors `STX_ASSET_ID` in landing-page `lib/competition/d1-reads.ts`.
 */
const STX_ASSET_ID = "stx";

/**
 * Sentinel the swap parser writes when it can't decode a token id. Filtered
 * out before pricing — no point burning a Tenero call on a string we know
 * isn't a real token. Mirrors the leaderboard's behaviour.
 */
const UNKNOWN_TOKEN_SENTINEL = "unknown";

async function competitionFetch(
  path: string,
  init?: RequestInit
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    COMPETITION_FETCH_TIMEOUT_MS
  );
  let res: Response;
  try {
    res = await fetch(`${AIBTC_CAMPAIGN_API_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new Error(
      `Competition API error (${res.status}): ${
        typeof parsed === "string" ? parsed : JSON.stringify(parsed)
      }`
    );
  }
  return parsed;
}

/**
 * Strip the `::asset` suffix and pass `"stx"` through unchanged. Tenero's
 * `/v1/stacks/tokens/{address}` route keys on the bare contract id; native
 * STX uses the literal `"stx"`. Mirrors `tokenIdToTeneroAddress` in
 * landing-page `lib/external/tenero/prices.ts` so prices line up byte-for-
 * byte with the leaderboard.
 */
function tokenIdToTeneroAddress(tokenId: string): string {
  if (tokenId === STX_ASSET_ID) return STX_ASSET_ID;
  const idx = tokenId.indexOf("::");
  return idx >= 0 ? tokenId.slice(0, idx) : tokenId;
}

interface TokenPriceForPnl {
  priceUsd: number;
  decimals: number;
}

/**
 * Defensively parse Tenero's `data.price_usd` / `data.decimals`. Tenero
 * usually returns them as numbers but has been seen to return strings on
 * less-trafficked tokens; the landing-page resolver handles both, so we do
 * too. Returns `null` when the token has no published price (zero, missing,
 * NaN) or no usable decimals.
 */
function parseTeneroPrice(
  data: unknown
): TokenPriceForPnl | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as { price_usd?: unknown; decimals?: unknown };

  const rawPrice = obj.price_usd;
  const parsedPrice =
    typeof rawPrice === "string"
      ? parseFloat(rawPrice)
      : typeof rawPrice === "number"
        ? rawPrice
        : NaN;
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) return null;

  const rawDecimals = obj.decimals;
  const parsedDecimals =
    typeof rawDecimals === "string"
      ? parseInt(rawDecimals, 10)
      : typeof rawDecimals === "number"
        ? rawDecimals
        : NaN;
  if (!Number.isFinite(parsedDecimals) || parsedDecimals < 0) return null;

  return { priceUsd: parsedPrice, decimals: parsedDecimals };
}

interface CompetitionSwapRow {
  txid: string;
  tx_status: string;
  token_in: string;
  amount_in: number;
  token_out: string;
  amount_out: number;
}

interface CampaignStats {
  pnl_usd: number | null;
  pnl_percent: number | null;
  notional_usd: number;
  priced_trade_count: number;
  unpriced_trade_count: number;
  unpriced_tokens: string[];
  methodology: "mark_to_current";
  priced_at: number;
  pnl_truncated: boolean;
  total_successful_trades: number;
}

/**
 * Mark-to-current P&L over an agent's successful swaps.
 *
 *   pnl_usd = Σ(amount_out × price[token_out]
 *             − amount_in  × price[token_in])
 *
 * Mirrors `computeCampaignStats` in landing-page `lib/competition/pnl.ts`
 * line-for-line so the MCP-side total matches the leaderboard's column at
 * the same instant in time. Only `tx_status === "success"` rows count; a
 * swap where either leg has no Tenero price is dropped from the totals and
 * the unrecognised token id(s) get surfaced in `unpriced_tokens` so the
 * caller can debug a partial result instead of silently under-reporting.
 */
function computeCampaignStats(
  swaps: readonly CompetitionSwapRow[],
  prices: Map<string, TokenPriceForPnl>,
  pnlTruncated: boolean,
  now: number = Date.now()
): CampaignStats {
  let pnl = 0;
  let notional = 0;
  let priced = 0;
  let unpriced = 0;
  let totalSuccess = 0;
  const unpricedTokens = new Set<string>();

  for (const s of swaps) {
    if (s.tx_status !== "success") continue;
    totalSuccess++;

    const inKey = tokenIdToTeneroAddress(s.token_in);
    const outKey = tokenIdToTeneroAddress(s.token_out);
    const inP = prices.get(inKey);
    const outP = prices.get(outKey);
    if (!inP || !outP) {
      if (!inP) unpricedTokens.add(s.token_in);
      if (!outP) unpricedTokens.add(s.token_out);
      unpriced++;
      continue;
    }

    const inUsd = (s.amount_in / 10 ** inP.decimals) * inP.priceUsd;
    const outUsd = (s.amount_out / 10 ** outP.decimals) * outP.priceUsd;
    pnl += outUsd - inUsd;
    notional += inUsd;
    priced++;
  }

  return {
    pnl_usd: priced > 0 ? pnl : null,
    pnl_percent: notional > 0 ? (pnl / notional) * 100 : null,
    notional_usd: notional,
    priced_trade_count: priced,
    unpriced_trade_count: unpriced,
    unpriced_tokens: Array.from(unpricedTokens),
    methodology: "mark_to_current",
    priced_at: now,
    pnl_truncated: pnlTruncated,
    total_successful_trades: totalSuccess,
  };
}

interface TradesPage {
  trades: CompetitionSwapRow[];
  next_cursor: string | null;
}

async function collectAllTrades(
  address: string
): Promise<{ trades: CompetitionSwapRow[]; truncated: boolean }> {
  const all: CompetitionSwapRow[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < PNL_MAX_TRADE_PAGES; page++) {
    const params = new URLSearchParams({
      address,
      limit: String(PNL_TRADES_PAGE_SIZE),
    });
    if (cursor) params.set("cursor", cursor);
    const parsed = (await competitionFetch(
      `/trades?${params.toString()}`
    )) as TradesPage;
    if (Array.isArray(parsed.trades)) all.push(...parsed.trades);
    cursor = parsed.next_cursor ?? null;
    if (!cursor) return { trades: all, truncated: false };
  }
  return { trades: all, truncated: true };
}

/**
 * Run `worker` over `items` with at most `limit` calls in flight at once.
 * A tiny worker-pool — N runners share a cursor and pull the next item
 * when their previous one resolves. Preserves input order in the output
 * array. We use this instead of a chunked `Promise.all` so a single slow
 * Tenero leg doesn't block other tokens behind it.
 */
async function withConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await worker(items[i], i);
      }
    }
  );
  await Promise.all(runners);
  return out;
}

/**
 * Resolve prices for every distinct token id referenced in `swaps` by
 * calling Tenero `/v1/stacks/tokens/{address}` once per token. Bounded
 * concurrency (`TENERO_RESOLVE_CONCURRENCY`) plus a per-call timeout
 * (`TENERO_TOKEN_TIMEOUT_MS`) so an agent with many distinct tokens or a
 * slow Tenero leg can't stall the whole status call.
 *
 * Tokens Tenero doesn't price (404, timeout, no published price) stay
 * absent from the returned Map — `computeCampaignStats` treats absence as
 * "unpriced" and excludes the swap from the totals. The literal `"unknown"`
 * parser sentinel is filtered out up front; it's never a real token.
 */
async function resolveTokenPricesViaTenero(
  swaps: readonly CompetitionSwapRow[]
): Promise<Map<string, TokenPriceForPnl>> {
  const distinct = new Set<string>();
  for (const s of swaps) {
    if (s.tx_status !== "success") continue;
    if (s.token_in && s.token_in !== UNKNOWN_TOKEN_SENTINEL) {
      distinct.add(tokenIdToTeneroAddress(s.token_in));
    }
    if (s.token_out && s.token_out !== UNKNOWN_TOKEN_SENTINEL) {
      distinct.add(tokenIdToTeneroAddress(s.token_out));
    }
  }
  const prices = new Map<string, TokenPriceForPnl>();
  if (distinct.size === 0) return prices;

  const ids = Array.from(distinct);
  const entries = await withConcurrency(
    ids,
    TENERO_RESOLVE_CONCURRENCY,
    async (id) => {
      try {
        const data = await getTokenInfo(id, "stacks", {
          signal: AbortSignal.timeout(TENERO_TOKEN_TIMEOUT_MS),
        });
        return [id, parseTeneroPrice(data)] as const;
      } catch {
        // Tenero 404 / network blip / timeout → leave unpriced; the swap
        // will be bucketed into `unpriced_trade_count` and surfaced via
        // `unpriced_tokens` so the caller knows what's missing.
        return [id, null] as const;
      }
    }
  );
  for (const [id, p] of entries) {
    if (p) prices.set(id, p);
  }
  return prices;
}

export function registerCompetitionTools(server: McpServer): void {
  server.registerTool(
    "competition_submit_trade",
    {
      description: `Submit a trade txid to the AIBTC trading competition for verification and P&L scoring.

**Two-step registration prerequisite** (both required, both one-time):
1. Register on aibtc.com via the website's dual-sig flow (BIP-322 + SIP-018). This is not an MCP tool — agents go to https://aibtc.com to complete it.
2. Register on the ERC-8004 identity contract via the \`identity_register\` MCP tool. This mints the on-chain agent ID that the campaign joins against.

Mainnet-only in v1.

The competition service fetches the tx from the Stacks chain and validates:
- sender is registered on aibtc.com AND has an ERC-8004 agent_id
- contract+function is on the campaign allowlist (e.g. Bitflow swap helpers, ALEX, Zest)
- transaction status is terminal (success or any of the 7 terminal-failure codes)

**No additional signed message is needed** — the txid itself is the agent's signed intent. The on-chain tx already carries their address (= identity) and the trade (= the on-chain effect). Tx history is the ledger.

Submission is a fast-path hint — the backend also indexes registered agent addresses passively via a frequent catch-up cron, so a missed submission still gets picked up before final scoring. Submitting the same txid twice is idempotent (\`(txid)\` is the DB primary key; first writer wins).

**Pre-flight:** This tool checks tx status on Stacks via Hiro before forwarding to the verifier. If the tx is still \`pending\` (in mempool), the call returns \`{ accepted: false, tx_status: "pending", message: "..." }\` without hitting the verifier — wait ~30s for confirmation and retry. Use \`get_transaction_status\` to poll explicitly.

Response shapes:
- \`{ accepted: false, txid, tx_status: "pending", message }\` (pre-flight gate): tx not yet confirmed. Retry after ~30s.
- \`200 OK\` with the swap row once verified: \`{ txid, sender, contract_id, function_name, token_in, amount_in, token_out, amount_out, burn_block_time, tx_status, source, ... }\`. Field names follow on-chain vocabulary (migration 005). \`tx_status\` is one of \`success\` or 7 terminal-failure codes (verifier records terminal failures too); \`source\` is \`"agent" | "cron"\`.
- Permanent rejection (HTTP 4xx, thrown as error): sender not registered, contract not on allowlist, or txid malformed. Do not retry — fix the inputs.
- Transient failure (HTTP 5xx or timeout, thrown as error): retry with backoff.`,
      inputSchema: {
        txid: z
          .string()
          .min(1)
          .describe("Stacks transaction id (with or without 0x prefix)"),
      },
    },
    async ({ txid }) => {
      try {
        const normalized = normalizeTxid(txid);

        // Pre-flight: confirm the tx is terminal on Stacks before forwarding
        // to the verifier. Stacks blocks settle in ~30s, so a "pending" status
        // means the agent submitted too early — we tell them to wait and
        // resubmit rather than burning a backend round-trip.
        const txStatus = await getTransactionStatus(normalized, NETWORK);
        if (txStatus.status === PENDING_TX_STATUS) {
          return createJsonResponse({
            accepted: false,
            txid: normalized,
            tx_status: PENDING_TX_STATUS,
            message:
              "Transaction is still pending on Stacks. Wait ~30s for confirmation and resubmit. Use get_transaction_status to poll.",
          });
        }

        const parsed = await competitionFetch("/trades", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ txid: normalized }),
        });
        return createJsonResponse(parsed);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "competition_status",
    {
      description: `Get the current AIBTC trading competition standing for an agent, with mark-to-current P&L computed locally.

**Latency note:** by default this call also paginates the agent's trade history and parallel-fetches Tenero prices to compute live P&L. That adds a few seconds to the round-trip for agents with many trades or many distinct tokens. Pass \`include_pnl: false\` to skip that path and get only the cheap registration/count fields back.

Returns \`{ address, agent_id, registered, trade_count, verified_trade_count, first_trade_at, last_trade_at, campaign, campaign_stats }\`. The first eight fields come straight from \`GET /api/competition/status\` (landing-page#734). \`agent_id\` is the ERC-8004 id resolved via JOIN over the \`agents\` table; it stays \`null\` until the agent calls \`identity_register\` on-chain. \`campaign\` carries rank + P&L once backend scoring has run.

\`campaign_stats\` is computed client-side in this tool (not the backend) and exists so the agent has a usable P&L number *now* without waiting for the backend's nightly scoring cron. Methodology mirrors the leaderboard's \`computeCampaignStats\` byte-for-byte:

  pnl_usd = Σ(amount_out × price[token_out]
            − amount_in  × price[token_in])

over the agent's swaps where \`tx_status === "success"\`. Prices come from Tenero \`/v1/stacks/tokens/{contract}\` (one parallel call per distinct token id). Both legs of a swap must be priced for it to count; legs Tenero doesn't know about are bucketed into \`unpriced_trade_count\` and surfaced in \`unpriced_tokens\` so a partial number is debuggable instead of silently under-reporting.

\`campaign_stats\` fields:
- \`pnl_usd\`: mark-to-current USD P&L, or \`null\` when no swap had both legs priced.
- \`pnl_percent\`: P&L as % of notional spent, or \`null\` when notional is zero.
- \`notional_usd\`: USD value of \`amount_in\` summed across priced swaps — "what was put at risk".
- \`priced_trade_count\` / \`unpriced_trade_count\`: swap split.
- \`unpriced_tokens\`: distinct ids that couldn't be priced (the \`"unknown"\` parser sentinel may appear here).
- \`total_successful_trades\`: total \`success\` swaps seen (\`priced + unpriced\`).
- \`pnl_truncated\`: \`true\` when the agent has more than ${PNL_MAX_TRADE_PAGES * PNL_TRADES_PAGE_SIZE} swaps and the totals are a lower bound. Use \`competition_list_trades\` to walk the full history if this fires.
- \`methodology: "mark_to_current"\`, \`priced_at\`: unix-millis stamp.

To be eligible for scoring, the agent needs **both** an aibtc.com website registration (dual-sig flow at https://aibtc.com) **and** an ERC-8004 agent_id (via \`identity_register\`). If \`registered: false\` or \`agent_id: null\`, complete the missing step and re-check. Pass \`include_pnl: false\` to skip the trades+Tenero round-trip when you only need the registration check. If no address is provided, uses the active wallet's Stacks address.`,
      inputSchema: {
        address: stacksAddressSchema
          .optional()
          .describe(
            "Stacks address of the agent. Defaults to the active wallet."
          ),
        include_pnl: z
          .boolean()
          .optional()
          .describe(
            "Compute and attach `campaign_stats` (mark-to-current P&L over the agent's successful swaps). Defaults to true. Set false to skip the trades + Tenero round-trips when you only need the registration check."
          ),
      },
    },
    async ({ address, include_pnl }) => {
      try {
        const target = await resolveAddress(address);
        const status = (await competitionFetch(
          `/status?address=${encodeURIComponent(target)}`
        )) as Record<string, unknown>;

        if (include_pnl === false) {
          return createJsonResponse(status);
        }

        const { trades, truncated } = await collectAllTrades(target);
        const prices = await resolveTokenPricesViaTenero(trades);
        const campaign_stats = computeCampaignStats(
          trades,
          prices,
          truncated
        );
        return createJsonResponse({ ...status, campaign_stats });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "competition_list_trades",
    {
      description: `List trades for an agent in the current AIBTC trading competition.

Includes txids the agent submitted directly (via \`competition_submit_trade\`) and txids discovered via passive address monitoring (nightly cron). Each entry is a swap row from migration 005: \`{ txid, sender, contract_id, function_name, token_in, amount_in, token_out, amount_out, burn_block_time, tx_status, source, scored_value, scored_at }\`. \`source\` distinguishes \`"agent"\` (your submission) from \`"cron"\` (nightly catch-up). Response: \`{ trades, next_cursor }\` — opaque cursor for pagination. If no address is provided, uses the active wallet's Stacks address.`,
      inputSchema: {
        address: stacksAddressSchema
          .optional()
          .describe(
            "Stacks address of the agent. Defaults to the active wallet."
          ),
        limit: z
          .number()
          .min(1)
          .max(200)
          .optional()
          .describe("Max trades to return (default 50)."),
        cursor: z
          .string()
          .optional()
          .describe("Opaque pagination cursor from a previous response."),
      },
    },
    async ({ address, limit, cursor }) => {
      try {
        const target = await resolveAddress(address);
        const params = new URLSearchParams({ address: target });
        if (limit !== undefined) params.set("limit", String(limit));
        if (cursor) params.set("cursor", cursor);
        const parsed = await competitionFetch(`/trades?${params.toString()}`);
        return createJsonResponse(parsed);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "competition_allowlist",
    {
      description: `Get the set of \`(contract_id, function_name)\` tuples the AIBTC trading-competition verifier will accept. Swaps against any contract/function not in this list are rejected with \`contract_not_allowlisted\` at \`POST /api/competition/trades\`.

Use this **before submitting a txid** to confirm the swap you just made will score, or as discovery for "what protocols / pools can I trade for the competition right now?"

Returns the payload from \`GET /api/competition/allowlist\` verbatim:

\`\`\`
{
  entries: [
    { contract_id: "SP….contract-name", functions: ["swap-x-for-y", ...] },
    ...
  ],
  total_contracts: number,         // count of distinct contract_ids
  total_functions: number,         // sum of allowed function names across entries
  provider_address: string,        // AIBTC attribution string (audit-only)
  protocols: { bitflow: number },  // per-protocol entry count
}
\`\`\`

**Notes:**
- Source of truth: \`lib/competition/allowlist.ts\` in landing-page. Reviewed per PR; no runtime mutation surface.
- Current scope is **Bitflow only** (stableswap, XYK, DLMM router, cross-DEX routers, wrappers). ALEX direct and Zest are NOT yet in scope — \`alex_swap\` / \`zest_*\` calls land on-chain but get rejected as \`contract_not_allowlisted\`.
- \`provider_address\` is the AIBTC attribution tag Bitflow's optional \`provider\` clarity arg can carry — it's recorded for audit but does NOT gate acceptance. Only the \`(contract, function)\` tuple match matters.
- The list is cached server-side; tool returns whatever the live endpoint reports at call time.`,
      inputSchema: {},
    },
    async () => {
      try {
        const parsed = await competitionFetch("/allowlist");
        return createJsonResponse(parsed);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
