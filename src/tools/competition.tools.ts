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
 * API spec: see issue in aibtcdev/landing-page describing endpoint contract.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AIBTC_CAMPAIGN_API_URL } from "../config/competition.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { createJsonResponse } from "../utils/formatting.js";
import { createErrorResponse } from "../utils/errors.js";

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

Prerequisite: the submitting agent must be registered on aibtc.com (call \`identity_register\` first). Mainnet-only in v1.

The competition service fetches the tx from the Stacks chain and validates:
- sender matches a registered competitor address
- contract+function is on the campaign allowlist (e.g. Bitflow swap helpers, ALEX, Zest)
- transaction status is success

Submission is a fast-path hint — the service also indexes registered agent addresses passively, so a missed submission still gets picked up. Submitting the same txid twice is idempotent (same response shape, no double-scoring).

Response shapes:
- Accepted: \`{ status: "accepted" | "verified", trade?: {...} }\` — safe to stop.
- Pending verification: \`{ status: "pending" }\` — the tx is still confirming or the indexer hasn't caught up. Re-poll via \`competition_list_trades\` instead of resubmitting.
- Permanent rejection (HTTP 4xx, thrown as error): sender not registered, contract not on allowlist, txid malformed, or tx failed on-chain. Do not retry — fix the inputs.
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
        const body = { txid: normalizeTxid(txid) };
        const parsed = await competitionFetch("/trades", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
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

Returns registration status, trade count, current rank within the active campaign track, and P&L if scoring has run. If no address is provided, uses the active wallet's Stacks address.

If the address hasn't been registered yet (or the campaign indexer hasn't picked it up), the API returns \`{ registered: false, ... }\` — call \`identity_register\` to onboard, then re-check.`,
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
      description: `List submitted and indexed trades for an agent in the current AIBTC trading competition.

Includes both txids the agent submitted directly via competition_submit_trade and txids the competition service discovered via address monitoring. Each entry indicates discovery method, verification status, parsed venue/function, and amounts. If no address is provided, uses the active wallet's Stacks address.`,
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
