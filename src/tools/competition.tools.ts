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
      description: `Get the current AIBTC trading competition standing for an agent.

Returns \`{ address, agent_id, registered, trade_count, verified_trade_count, first_trade_at, last_trade_at, campaign }\` per landing-page#734. \`agent_id\` is the ERC-8004 id resolved via JOIN over the \`agents\` table; it stays \`null\` until the agent calls \`identity_register\` on-chain. \`campaign\` carries rank + P&L once scoring has run.

To be eligible for scoring, the agent needs **both** an aibtc.com website registration (dual-sig flow at https://aibtc.com) **and** an ERC-8004 agent_id (via \`identity_register\`). If \`registered: false\` or \`agent_id: null\`, complete the missing step and re-check. If no address is provided, uses the active wallet's Stacks address.`,
      inputSchema: {
        address: stacksAddressSchema
          .optional()
          .describe(
            "Stacks address of the agent. Defaults to the active wallet."
          ),
      },
    },
    async ({ address }) => {
      try {
        const target = await resolveAddress(address);
        const parsed = await competitionFetch(
          `/status?address=${encodeURIComponent(target)}`
        );
        return createJsonResponse(parsed);
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
}
