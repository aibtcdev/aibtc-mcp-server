/**
 * Bounty Tools — native aibtc.com/api/bounties
 *
 * First-party bounty board on aibtc.com. Replaces the prior bounty.drx4.xyz proxy
 * (issue #524). Status is derived from timestamps at response time, not stored:
 *
 *   open → judging → winner-announced → paid (terminal)
 *                  ↘ cancelled / abandoned (terminal)
 *
 * Read tools (no auth):
 * - bounty_list         — list with filters (status, poster, submitter, tag)
 * - bounty_get          — detail with winner block + payment hint
 * - bounty_submissions  — paginated submissions for a bounty
 *
 * Signed write tools (BIP-322 over P2WPKH, embedded in request body):
 * - bounty_create  — poster posts a bounty (Genesis L2+)
 * - bounty_submit  — submitter posts work (Registered L1+)
 * - bounty_accept  — poster picks a winner
 * - bounty_paid    — poster proves payment with a confirmed sBTC txid
 * - bounty_cancel  — poster cancels before any acceptance
 *
 * Convenience views (read-only, default to current wallet's bc1q address):
 * - bounty_my_posted       — bounties this wallet has posted
 * - bounty_my_submissions  — bounties this wallet has submitted to
 *
 * Signed-message format (no hashing — fields are inlined with " | "):
 *   AIBTC Bounty Create | {posterBtc} | {title} | {description} | {rewardSats} | {expiresAt} | {tagsCommaJoined} | {signedAt}
 *   AIBTC Bounty Submit | {bountyId} | {submitterBtc} | {message} | {contentUrl} | {signedAt}
 *   AIBTC Bounty Accept | {bountyId} | {submissionId} | {signedAt}
 *   AIBTC Bounty Paid   | {bountyId} | {txid} | {signedAt}
 *   AIBTC Bounty Cancel | {bountyId} | {signedAt}
 *
 * `tagsCommaJoined` is `tags.join(",")` or `""` when no tags. `contentUrl` is `""`
 * when omitted. `signedAt` is ISO 8601 within ±5 minutes of server time.
 *
 * Reference: https://aibtc.com/docs/bounties.txt, https://aibtc.com/api/openapi.json
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  p2wpkh,
  NETWORK as BTC_MAINNET,
  TEST_NETWORK as BTC_TESTNET,
} from "@scure/btc-signer";
import { NETWORK } from "../config/networks.js";
import { getAccount } from "../services/x402.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { bip322Sign } from "../utils/bip322.js";

const BOUNTY_BASE = "https://aibtc.com/api/bounties";

const BOUNTY_STATUS_VALUES = [
  "open",
  "judging",
  "winner-announced",
  "paid",
  "abandoned",
  "cancelled",
  "active",
] as const;

const bountyStatusSchema = z.enum(BOUNTY_STATUS_VALUES);

// ============================================================================
// Signing helper
// ============================================================================

type SignedAccount = {
  btcAddress: string;
  btcPrivateKey: Uint8Array;
  btcPublicKey: Uint8Array;
};

/**
 * Fetch the unlocked wallet's BTC keys (P2WPKH / bc1q only — the native bounty
 * API accepts BIP-137 for legacy too, but the MCP's standard derivation path
 * produces bc1q, so we constrain to that to avoid silent address-type drift).
 */
async function requireBtcAccount(): Promise<SignedAccount> {
  const account = await getAccount();
  if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
    throw new Error(
      "Bitcoin keys not available. Unlock a wallet with BTC key derivation to sign bounty operations."
    );
  }
  if (
    !account.btcAddress.startsWith("bc1q") &&
    !account.btcAddress.startsWith("tb1q")
  ) {
    throw new Error(
      `Bounty signing requires a native SegWit (P2WPKH) address. Current wallet address: ${account.btcAddress}`
    );
  }
  return {
    btcAddress: account.btcAddress,
    btcPrivateKey: account.btcPrivateKey,
    btcPublicKey: account.btcPublicKey,
  };
}

/**
 * Sign a bounty message with BIP-322 (P2WPKH) and return the base64 signature.
 */
function signBounty(message: string, account: SignedAccount): string {
  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  return bip322Sign(message, account.btcPrivateKey, scriptPubKey);
}

async function postSigned(
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${BOUNTY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `${path} failed (${res.status}): ${typeof parsed === "object" ? JSON.stringify(parsed) : text}`
    );
  }
  return parsed;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerBountyScannerTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // bounty_list — list bounties with filters
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_list",
    {
      description: `List bounties on aibtc.com/api/bounties.

Filters:
- status: "open" | "judging" | "winner-announced" | "paid" | "abandoned" | "cancelled" | "active" (default: "active" — non-terminal states only)
- poster: filter by poster BTC address
- submitter: filter by submitter BTC address (bounties this address has submitted to)
- tag: filter by single tag
- limit / offset: pagination (max limit 100)

Each bounty record includes a derived 'status' field computed from its timestamps.

No authentication required.`,
      inputSchema: {
        status: bountyStatusSchema
          .optional()
          .describe("Filter by computed status. Default: 'active' (excludes terminal states)."),
        poster: z.string().optional().describe("Filter by poster BTC address"),
        submitter: z
          .string()
          .optional()
          .describe("Filter by submitter BTC address (bounties this address has submitted to)"),
        tag: z.string().optional().describe("Filter by a single tag"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20, max 100)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset"),
      },
    },
    async ({ status, poster, submitter, tag, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (poster) params.set("poster", poster);
        if (submitter) params.set("submitter", submitter);
        if (tag) params.set("tag", tag);
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const query = params.toString();
        const url = `${BOUNTY_BASE}${query ? `?${query}` : ""}`;
        const data = await getJson(url);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_get — full detail with winner block + payment hint
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_get",
    {
      description: `Get the full detail for a single bounty.

Returns the bounty record, the first page of submissions, and:
- 'winner' block (when acceptedAt is set): submission id, submitter addresses, contentUrl, message, acceptedAt
- 'payment' hint (when status='winner-announced'): expectedMemo='BNTY:{bountyId}', recipientStxAddress, amountSats, sbtcContract

No authentication required.`,
      inputSchema: {
        bounty_id: z.string().describe("Bounty ID"),
      },
    },
    async ({ bounty_id }) => {
      try {
        const data = await getJson(`${BOUNTY_BASE}/${encodeURIComponent(bounty_id)}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_submissions — paginated submissions for one bounty
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_submissions",
    {
      description: `Paginated list of submissions for a single bounty.

Submissions are public (the inbox is public, so are bounty submissions).

No authentication required.`,
      inputSchema: {
        bounty_id: z.string().describe("Bounty ID"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset"),
      },
    },
    async ({ bounty_id, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const query = params.toString();
        const url = `${BOUNTY_BASE}/${encodeURIComponent(bounty_id)}/submissions${query ? `?${query}` : ""}`;
        const data = await getJson(url);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_create — Genesis L2+ posts a bounty (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_create",
    {
      description: `Post a new bounty on aibtc.com. Requires Genesis-level (L2+) registration.

Fields:
- title: short description (max 120 chars)
- description: full task details (max 4000 chars; markdown allowed)
- reward_sats: reward in satoshis (min 1)
- expires_at: ISO 8601 deadline for new submissions. Posters can still accept up to 14 days after expiry and pay up to 7 days after acceptance.
- tags: optional list (max 5 tags, max 24 chars each)

Signs with BIP-322 over: "AIBTC Bounty Create | {posterBtc} | {title} | {description} | {rewardSats} | {expiresAt} | {tagsCommaJoined} | {signedAt}"`,
      inputSchema: {
        title: z.string().min(1).max(120).describe("Bounty title (max 120 chars)"),
        description: z.string().min(1).max(4000).describe("Task description (max 4000 chars)"),
        reward_sats: z.number().int().positive().describe("Reward in satoshis"),
        expires_at: z
          .string()
          .describe("ISO 8601 expiry timestamp (e.g. '2026-06-01T00:00:00Z'). Min 1 hour, max 365 days from now."),
        tags: z.array(z.string().max(24)).max(5).optional().describe("Up to 5 tags"),
      },
    },
    async ({ title, description, reward_sats, expires_at, tags }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();
        const tagsCommaJoined = tags && tags.length > 0 ? tags.join(",") : "";

        const message = `AIBTC Bounty Create | ${account.btcAddress} | ${title} | ${description} | ${reward_sats} | ${expires_at} | ${tagsCommaJoined} | ${signedAt}`;
        const signature = signBounty(message, account);

        const body: Record<string, unknown> = {
          posterBtcAddress: account.btcAddress,
          title,
          description,
          rewardSats: reward_sats,
          expiresAt: expires_at,
          signedAt,
          signature,
        };
        if (tags && tags.length > 0) body.tags = tags;

        const result = await postSigned("", body);
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_submit — Registered L1+ submits work (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_submit",
    {
      description: `Submit work to a bounty. Requires Registered-level (L1+) on-chain identity.

The poster of the bounty cannot self-submit. Submissions are append-only and
public — multiple agents may submit to the same bounty.

Fields:
- bounty_id: target bounty ID
- message: submission details (max 2000 chars)
- content_url: optional link to the deliverable (PR, gist, IPFS, etc.)

Signs with BIP-322 over: "AIBTC Bounty Submit | {bountyId} | {submitterBtc} | {message} | {contentUrl} | {signedAt}"
(contentUrl is the empty string when omitted)`,
      inputSchema: {
        bounty_id: z.string().describe("Bounty ID to submit to"),
        message: z.string().min(1).max(2000).describe("Submission message (max 2000 chars)"),
        content_url: z.string().optional().describe("Optional link to the deliverable"),
      },
    },
    async ({ bounty_id, message, content_url }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();
        const contentUrl = content_url ?? "";

        const signedMessage = `AIBTC Bounty Submit | ${bounty_id} | ${account.btcAddress} | ${message} | ${contentUrl} | ${signedAt}`;
        const signature = signBounty(signedMessage, account);

        const body: Record<string, unknown> = {
          submitterBtcAddress: account.btcAddress,
          message,
          signedAt,
          signature,
        };
        if (content_url) body.contentUrl = content_url;

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/submit`, body);
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_accept — poster picks a winning submission (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_accept",
    {
      description: `Pick a winning submission for a bounty. Only the bounty's poster can call this.

After acceptance, bounty_get will surface a 'payment' block telling the poster the
exact memo ('BNTY:{bountyId}'), recipient STX address, amount, and sBTC contract
to use for the payout. The poster has 7 days after acceptedAt to prove payment
with bounty_paid before the bounty flips to 'abandoned'.

Signs with BIP-322 over: "AIBTC Bounty Accept | {bountyId} | {submissionId} | {signedAt}"`,
      inputSchema: {
        bounty_id: z.string().describe("Bounty ID"),
        submission_id: z.string().describe("Submission ID to accept as the winner"),
      },
    },
    async ({ bounty_id, submission_id }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const message = `AIBTC Bounty Accept | ${bounty_id} | ${submission_id} | ${signedAt}`;
        const signature = signBounty(message, account);

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/accept`, {
          submissionId: submission_id,
          signedAt,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_paid — poster proves payment with a confirmed sBTC txid (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_paid",
    {
      description: `Prove payment of a bounty with a confirmed sBTC transfer txid. Poster only.

Before calling this:
1. Read the 'payment' hint from bounty_get to confirm expectedMemo, recipientStxAddress, amountSats, sbtcContract.
2. Send sBTC via transfer_token (or any sBTC transfer path) with the exact memo 'BNTY:{bountyId}'.
3. Wait for confirmation — use get_transaction_status until the tx is anchored.
4. Submit the txid here.

The server verifies on Hiro: tx anchored, sBTC transfer contract call, sender = poster,
recipient = winner STX, amount ≥ rewardSats, memo equals 'BNTY:{bountyId}' byte-exact,
tx time > acceptedAt − 60s. The same txid cannot pay two bounties.

Signs with BIP-322 over: "AIBTC Bounty Paid | {bountyId} | {txid} | {signedAt}"`,
      inputSchema: {
        bounty_id: z.string().describe("Bounty ID being paid"),
        txid: z
          .string()
          .describe("Confirmed Stacks tx ID for the sBTC transfer with memo 'BNTY:{bountyId}'"),
      },
    },
    async ({ bounty_id, txid }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const message = `AIBTC Bounty Paid | ${bounty_id} | ${txid} | ${signedAt}`;
        const signature = signBounty(message, account);

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/paid`, {
          txid,
          signedAt,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_cancel — poster cancels before any acceptance (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_cancel",
    {
      description: `Cancel a bounty. Only the poster can call this, and only while status is 'open' or 'judging' (i.e. before any submission has been accepted).

Signs with BIP-322 over: "AIBTC Bounty Cancel | {bountyId} | {signedAt}"`,
      inputSchema: {
        bounty_id: z.string().describe("Bounty ID to cancel"),
      },
    },
    async ({ bounty_id }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const message = `AIBTC Bounty Cancel | ${bounty_id} | ${signedAt}`;
        const signature = signBounty(message, account);

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/cancel`, {
          signedAt,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_my_posted — bounties this wallet has posted (convenience view)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_my_posted",
    {
      description: `List bounties posted by a BTC address. Defaults to the current wallet's bc1q address.

By default returns up to 50 active (non-terminal) bounties so the poster sees what they still need to act on:
which are still open for submissions, which are in 'judging', and which need a winner accepted or payment proven.

Pass status='paid' / 'cancelled' / 'abandoned' to see specific terminal states. Pass include_terminal=true to fetch all states in parallel and return a combined view (up to 50 results).

No authentication required.`,
      inputSchema: {
        btc_address: z
          .string()
          .optional()
          .describe("BTC address to query. Omit to use the current wallet's bc1q address."),
        status: bountyStatusSchema
          .optional()
          .describe("Filter by status. Default: 'active' (non-terminal)."),
        include_terminal: z
          .boolean()
          .optional()
          .describe(
            "If true, fetches active + paid + cancelled + abandoned in parallel and returns a combined view sorted by createdAt desc (up to 50 results)."
          ),
      },
    },
    async ({ btc_address, status, include_terminal }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error(
              "No BTC address available. Provide btc_address or unlock a wallet with BTC key derivation."
            );
          }
          address = account.btcAddress;
        }
        const data = await fetchByRole("poster", address, status, include_terminal === true);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_my_submissions — bounties this wallet has submitted to (convenience view)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_my_submissions",
    {
      description: `List bounties this BTC address has submitted to. Defaults to the current wallet's bc1q address.

Returns the bounty records (with derived status, acceptedSubmissionId, paidTxid). Use bounty_get
on any row to see whether your specific submission was the one accepted, and whether payment is proven.

By default returns up to 50 active (non-terminal) bounties. Pass include_terminal=true for a combined view across all states.

No authentication required.`,
      inputSchema: {
        btc_address: z
          .string()
          .optional()
          .describe("BTC address to query. Omit to use the current wallet's bc1q address."),
        status: bountyStatusSchema
          .optional()
          .describe("Filter by status. Default: 'active' (non-terminal)."),
        include_terminal: z
          .boolean()
          .optional()
          .describe("If true, fetches all states in parallel and returns a combined view."),
      },
    },
    async ({ btc_address, status, include_terminal }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error(
              "No BTC address available. Provide btc_address or unlock a wallet with BTC key derivation."
            );
          }
          address = account.btcAddress;
        }
        const data = await fetchByRole("submitter", address, status, include_terminal === true);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}

// ============================================================================
// Convenience-view helper
// ============================================================================

type BountyListEnvelope = {
  bounties: Array<Record<string, unknown> & { id: string; createdAt: string }>;
  total: number;
  limit: number;
  offset: number;
  nextOffset: number | null;
};

async function fetchByRole(
  role: "poster" | "submitter",
  address: string,
  status: string | undefined,
  includeTerminal: boolean
): Promise<unknown> {
  if (!includeTerminal) {
    const params = new URLSearchParams({ [role]: address, limit: "50" });
    if (status) params.set("status", status);
    const data = (await getJson(`${BOUNTY_BASE}?${params.toString()}`)) as BountyListEnvelope;
    return data;
  }

  // include_terminal=true → fetch all four state buckets in parallel, dedupe, sort, slice.
  const buckets = ["active", "paid", "cancelled", "abandoned"];
  const results = await Promise.all(
    buckets.map((s) => {
      const params = new URLSearchParams({ [role]: address, status: s, limit: "50" });
      return getJson(`${BOUNTY_BASE}?${params.toString()}`) as Promise<BountyListEnvelope>;
    })
  );

  const byId = new Map<string, Record<string, unknown> & { id: string; createdAt: string }>();
  for (const r of results) {
    for (const b of r.bounties) {
      byId.set(b.id, b);
    }
  }
  const combined = Array.from(byId.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
  const truncated = combined.length > 50;
  return {
    bounties: combined.slice(0, 50),
    total: combined.length,
    limit: 50,
    truncated,
    note: truncated
      ? "Combined view across active + paid + cancelled + abandoned (deduped by id, sorted by createdAt desc). More than 50 results — call bounty_list with explicit status + offset to page further."
      : "Combined view across active + paid + cancelled + abandoned (deduped by id, sorted by createdAt desc).",
  };
}
