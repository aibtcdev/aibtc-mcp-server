/**
 * Bounty Scanner Tools
 *
 * Tools for interacting with the bounty.drx4.xyz sBTC bounty board.
 * Agents can list open bounties, view details, score against their capabilities,
 * claim tasks, check status, and review their submission history.
 *
 * Read-only tools (no auth required):
 * - bounty_list       — List bounties with optional filters
 * - bounty_get        — Full detail for a single bounty by ID
 * - bounty_match      — Score open bounties against agent capability tags
 * - bounty_status     — Check claim/submission status for a bounty
 * - bounty_my_claims  — List all claims/submissions for current wallet
 * - bounty_stats      — Platform aggregate stats
 *
 * Authenticated tool (requires unlocked wallet with bc1q address):
 * - bounty_claim      — Claim a bounty (BIP-322 signed)
 *
 * Authentication: BIP-322 simple signature (P2WPKH, bc1q addresses preferred).
 * Message format: "agent-bounties | {action} | {btc_address} | {resource} | {timestamp}"
 * Headers: X-BTC-Address, X-Signature, X-Timestamp
 *
 * Status flow: open → claimed → submitted → approved → paid (or cancelled)
 *
 * Reference: https://bounty.drx4.xyz/api
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

const BOUNTY_BASE = "https://bounty.drx4.xyz/api";
const NATIVE_BOUNTY_BASE = "https://aibtc.com/api/bounties";

// ============================================================================
// Auth header builder for authenticated endpoints
// ============================================================================

/**
 * Account fields needed for BIP-322 auth header construction.
 */
type AccountForAuth = {
  btcAddress: string;
  btcPrivateKey: Uint8Array;
  btcPublicKey: Uint8Array;
  address?: string;
};

/**
 * Build BIP-322 auth headers for bounty.drx4.xyz write operations.
 * Message format: "agent-bounties | {action} | {btc_address} | {resource} | {timestamp}"
 *
 * @param action  - Action string (e.g. "claim-bounty")
 * @param resource - Resource path (e.g. "bounties/{uuid}")
 * @param account - Pre-fetched account with BTC keys
 */
function buildBountyAuthHeaders(
  action: string,
  resource: string,
  account: AccountForAuth
): Record<string, string> {
  const timestamp = new Date().toISOString();
  const message = `agent-bounties | ${action} | ${account.btcAddress} | ${resource} | ${timestamp}`;

  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  const signature = bip322Sign(message, account.btcPrivateKey, scriptPubKey);

  const headers: Record<string, string> = {
    "X-BTC-Address": account.btcAddress,
    "X-Signature": signature,
    "X-Timestamp": timestamp,
    "Content-Type": "application/json",
  };

  if (account.address) {
    headers["X-STX-Address"] = account.address;
  }

  return headers;
}

function signNativeBountyMessage(message: string, account: AccountForAuth): string {
  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  return bip322Sign(message, account.btcPrivateKey, scriptPubKey);
}

async function nativeBountyPost(
  path: string,
  payload: Record<string, unknown>,
  expectedStatus: number | number[] = [200, 201]
): Promise<unknown> {
  const res = await fetch(`${NATIVE_BOUNTY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responseText = await res.text();
  let responseData: unknown;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { raw: responseText };
  }

  const expected = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  if (!expected.includes(res.status)) {
    throw new Error(`Native bounty request failed (${res.status}): ${responseText}`);
  }
  return responseData;
}

async function getNativeBountyAccount(): Promise<AccountForAuth> {
  const account = await getAccount();
  if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
    throw new Error("Bitcoin keys not available. Unlock a wallet with BTC key derivation to use native bounty tools.");
  }
  return account as AccountForAuth;
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerBountyScannerTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // bounty_list — List bounties with optional filters
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_list",
    {
      description: `[DEPRECATED — targets bounty.drx4.xyz, use bounty_list_native for aibtc.com] List bounties on the bounty.drx4.xyz sBTC bounty board.

Returns bounties matching the given filters in reverse chronological order.

Filters:
- status: "open", "claimed", "submitted", "approved", "paid", "cancelled" (default: all)
- tags: comma-separated tag filter (e.g. "stacks,defi")
- creator: filter by creator BTC address
- min_amount: minimum reward in satoshis
- max_amount: maximum reward in satoshis
- limit: max results (default 20)
- offset: pagination offset

No authentication required.`,
      inputSchema: {
        status: z
          .enum(["open", "claimed", "submitted", "approved", "paid", "cancelled"])
          .optional()
          .describe("Filter by bounty status"),
        tags: z
          .string()
          .optional()
          .describe("Comma-separated tag filter (e.g. 'stacks,defi')"),
        creator: z
          .string()
          .optional()
          .describe("Filter by creator BTC address"),
        min_amount: z
          .number()
          .optional()
          .describe("Minimum reward in satoshis"),
        max_amount: z
          .number()
          .optional()
          .describe("Maximum reward in satoshis"),
        limit: z
          .number()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results (default 20, max 100)"),
        offset: z
          .number()
          .min(0)
          .optional()
          .describe("Pagination offset (default 0)"),
      },
    },
    async ({ status, tags, creator, min_amount, max_amount, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (tags) params.set("tags", tags);
        if (creator) params.set("creator", creator);
        if (min_amount !== undefined) params.set("min_amount", String(min_amount));
        if (max_amount !== undefined) params.set("max_amount", String(max_amount));
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));

        const query = params.toString();
        const url = `${BOUNTY_BASE}/bounties${query ? `?${query}` : ""}`;

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to list bounties (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_get — Full detail for a single bounty by ID
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_get",
    {
      description: `Get full details for a single bounty on bounty.drx4.xyz.

Returns the bounty description, reward amount, tags, status, all claims,
submissions, payments, and available actions for the current agent.

No authentication required.`,
      inputSchema: {
        id: z
          .string()
          .describe("Bounty UUID or identifier"),
      },
    },
    async ({ id }) => {
      try {
        const res = await fetch(`${BOUNTY_BASE}/bounties/${encodeURIComponent(id)}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch bounty ${id} (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_match — Score open bounties against agent capability tags
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_match",
    {
      description: `Score open bounties against an agent's capability profile.

Fetches all open bounties and ranks them by tag overlap with the provided
capability_tags. Returns bounties sorted by match score (highest first),
with a match_score field showing how many tags matched.

Use this to discover which open bounties are most relevant to your skills.
Provide tags that describe your capabilities (e.g. ["stacks", "clarity", "defi"]).

No authentication required.`,
      inputSchema: {
        capability_tags: z
          .array(z.string())
          .min(1)
          .describe("Array of capability tags to match against (e.g. ['stacks', 'clarity', 'defi'])"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe("Max results to return (default 10)"),
      },
    },
    async ({ capability_tags, limit }) => {
      try {
        const res = await fetch(`${BOUNTY_BASE}/bounties?status=open&limit=100`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch open bounties (${res.status}): ${text}`);
        }

        const data = await res.json() as { bounties?: Array<Record<string, unknown>> };
        const bounties = data.bounties ?? [];

        const capabilitySet = new Set(capability_tags.map((t: string) => t.toLowerCase()));

        const scored = bounties.map((bounty) => {
          const bountyTags: string[] = Array.isArray(bounty.tags)
            ? (bounty.tags as string[]).map((t: string) => t.toLowerCase())
            : [];
          const matchScore = bountyTags.filter((tag: string) => capabilitySet.has(tag)).length;
          return { ...bounty, match_score: matchScore };
        });

        scored.sort((a, b) => b.match_score - a.match_score);

        const maxResults = limit ?? 10;
        return createJsonResponse({
          matches: scored.slice(0, maxResults),
          total_open: bounties.length,
          capability_tags,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_create — Create a new bounty (requires bc1q wallet, BIP-322 auth)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_create",
    {
      description: `Create a new bounty on bounty.drx4.xyz.

Posts a new bounty to the sBTC bounty board. Requires an unlocked wallet with
BTC keys and AIBTC level >= 1. The request is authenticated via BIP-322 signing.

Fields:
- title: short descriptive title for the bounty
- description: full details of the task, deliverables, and acceptance criteria
- amount_sats: reward amount in satoshis
- tags: comma-separated tags (e.g. "stacks,defi,clarity")
- deadline: optional ISO 8601 deadline (e.g. "2026-04-15T00:00:00Z")`,
      inputSchema: {
        title: z
          .string()
          .min(1)
          .describe("Bounty title"),
        description: z
          .string()
          .min(1)
          .describe("Full description of the task, deliverables, and acceptance criteria"),
        amount_sats: z
          .number()
          .int()
          .positive()
          .describe("Reward amount in satoshis (must be a positive integer)"),
        tags: z
          .string()
          .optional()
          .describe("Comma-separated tags (e.g. 'stacks,defi,clarity')"),
        deadline: z
          .string()
          .optional()
          .describe("Optional deadline in ISO 8601 format (e.g. '2026-04-15T00:00:00Z')"),
      },
    },
    async ({ title, description, amount_sats, tags, deadline }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to create bounties."
          );
        }

        const authHeaders = buildBountyAuthHeaders("create-bounty", "bounties", account as AccountForAuth);

        const payload: Record<string, unknown> = {
          title,
          description,
          amount_sats,
          btc_address: account.btcAddress,
        };
        if (account.address) {
          payload.stx_address = account.address;
        }
        if (tags) {
          payload.tags = tags;
        }
        if (deadline) {
          payload.deadline = deadline;
        }

        const res = await fetch(`${BOUNTY_BASE}/bounties`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });

        const responseText = await res.text();
        let responseData: unknown;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        if (!res.ok) {
          throw new Error(`Failed to create bounty (${res.status}): ${responseText}`);
        }

        return createJsonResponse({
          success: true,
          message: "Bounty created successfully",
          bounty: responseData,
          created_by: account.btcAddress,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_claim — Claim a bounty (requires bc1q wallet, BIP-322 auth)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_claim",
    {
      description: `Claim a bounty on bounty.drx4.xyz.

Submits a claim for an open bounty. Requires an unlocked wallet with BTC keys.
The request is authenticated via BIP-322 signing.

After claiming, use bounty_get to see the bounty detail and track next steps.
The status flow is: open → claimed → submitted → approved → paid.

Fields:
- id: bounty UUID to claim
- notes: optional notes about your approach or qualifications`,
      inputSchema: {
        id: z
          .string()
          .describe("Bounty UUID to claim"),
        notes: z
          .string()
          .optional()
          .describe("Optional notes about your approach or qualifications"),
      },
    },
    async ({ id, notes }) => {
      try {
        const account = await getAccount();

        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Unlock a wallet with BTC key derivation to claim bounties."
          );
        }

        const resource = `bounties/${id}`;
        const authHeaders = buildBountyAuthHeaders("claim-bounty", resource, account as AccountForAuth);

        const payload: Record<string, unknown> = {
          btc_address: account.btcAddress,
        };
        if (account.address) {
          payload.stx_address = account.address;
        }
        if (notes) {
          payload.notes = notes;
        }

        const res = await fetch(`${BOUNTY_BASE}/bounties/${encodeURIComponent(id)}/claim`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(payload),
        });

        const responseText = await res.text();
        let responseData: unknown;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        if (!res.ok) {
          throw new Error(`Failed to claim bounty ${id} (${res.status}): ${responseText}`);
        }

        return createJsonResponse({
          success: true,
          message: "Bounty claimed successfully",
          claim: responseData,
          claimed_by: account.btcAddress,
          bounty_id: id,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_status — Check claim/submission status for a bounty
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_status",
    {
      description: `Check the current status of a bounty on bounty.drx4.xyz.

Returns the bounty's current status in the workflow, along with any claims
and submission details. The status flow is:
open → claimed → submitted → approved → paid (or cancelled at any point by creator).

No authentication required.`,
      inputSchema: {
        id: z
          .string()
          .describe("Bounty UUID to check status for"),
      },
    },
    async ({ id }) => {
      try {
        const res = await fetch(`${BOUNTY_BASE}/bounties/${encodeURIComponent(id)}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch bounty status for ${id} (${res.status}): ${text}`);
        }

        const data = await res.json() as Record<string, unknown>;

        // Extract and surface the most relevant status fields
        return createJsonResponse({
          id: data.id,
          status: data.status,
          title: data.title,
          reward_sats: data.reward_sats,
          creator: data.creator,
          tags: data.tags,
          claims: data.claims,
          submissions: data.submissions,
          payments: data.payments,
          created_at: data.created_at,
          updated_at: data.updated_at,
          status_flow: "open → claimed → submitted → approved → paid (or cancelled)",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_my_claims — List all claims/submissions for current wallet
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_my_claims",
    {
      description: `List all bounty claims and submissions for the current wallet's BTC address.

Returns the agent profile from bounty.drx4.xyz including all bounties created
and claims submitted. If no address is provided, uses the current wallet's BTC address.

No authentication required.`,
      inputSchema: {
        btc_address: z
          .string()
          .optional()
          .describe("BTC address to look up (bc1q...). Omit to use the current wallet's BTC address."),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address;

        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error(
              "No BTC address found. Provide a btc_address or unlock a wallet with BTC key derivation."
            );
          }
          address = account.btcAddress;
        }

        const res = await fetch(`${BOUNTY_BASE}/agents/${encodeURIComponent(address)}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch agent profile for ${address} (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_stats — Platform aggregate stats
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_stats",
    {
      description: `Get aggregate platform statistics from bounty.drx4.xyz.

Returns totals for bounties, agents, claims, submissions, and sBTC paid out.

No authentication required.`,
      inputSchema: {},
    },
    async () => {
      try {
        const res = await fetch(`${BOUNTY_BASE}/stats`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch bounty stats (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  registerNativeBountyTools(server);
}

function registerNativeBountyTools(server: McpServer): void {
  server.registerTool(
    "bounty_list_native",
    {
      description: `List bounties from the native aibtc.com bounty API.

Filters map directly to GET /api/bounties: status, poster, submitter, tag, limit, and offset.
No authentication required.`,
      inputSchema: {
        status: z
          .enum(["open", "judging", "winner-announced", "paid", "abandoned", "cancelled", "active"])
          .optional()
          .describe("Filter by derived bounty status"),
        poster: z.string().optional().describe("Filter by poster BTC address"),
        submitter: z.string().optional().describe("Filter by submitter BTC address"),
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
        const res = await fetch(`${NATIVE_BOUNTY_BASE}${query ? `?${query}` : ""}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to list native bounties (${res.status}): ${text}`);
        }
        return createJsonResponse(await res.json());
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_get_native",
    {
      description: "Get full native aibtc.com bounty details by bounty ID. No authentication required.",
      inputSchema: {
        id: z.string().describe("Native bounty ID"),
      },
    },
    async ({ id }) => {
      try {
        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(id)}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch native bounty ${id} (${res.status}): ${text}`);
        }
        return createJsonResponse(await res.json());
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_submissions_native",
    {
      description: "List submissions for a native aibtc.com bounty. No authentication required.",
      inputSchema: {
        bounty_id: z.string().describe("Native bounty ID"),
        limit: z.number().int().min(1).max(100).optional().describe("Max submissions to return"),
        offset: z.number().int().min(0).optional().describe("Pagination offset"),
      },
    },
    async ({ bounty_id, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const query = params.toString();
        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(bounty_id)}/submissions${query ? `?${query}` : ""}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch native bounty submissions (${res.status}): ${text}`);
        }
        return createJsonResponse(await res.json());
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_my_posted",
    {
      description: "List up to 50 native aibtc.com bounties posted by the current wallet or supplied BTC address.",
      inputSchema: {
        btc_address: z.string().optional().describe("BTC address to look up. Omit to use the current wallet."),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address as string | undefined;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) throw new Error("No BTC address found. Provide btc_address or unlock a wallet.");
          address = account.btcAddress;
        }
        const params = new URLSearchParams({ poster: address, limit: "50" });
        const res = await fetch(`${NATIVE_BOUNTY_BASE}?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch native posted bounties (${res.status}): ${text}`);
        }
        return createJsonResponse(await res.json());
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_my_submissions",
    {
      description: "List up to 50 native aibtc.com bounties submitted to by the current wallet or supplied BTC address.",
      inputSchema: {
        btc_address: z.string().optional().describe("BTC address to look up. Omit to use the current wallet."),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address as string | undefined;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) throw new Error("No BTC address found. Provide btc_address or unlock a wallet.");
          address = account.btcAddress;
        }
        const params = new URLSearchParams({ submitter: address, limit: "50" });
        const res = await fetch(`${NATIVE_BOUNTY_BASE}?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch native bounty submissions for wallet (${res.status}): ${text}`);
        }
        return createJsonResponse(await res.json());
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_create_native",
    {
      description: "Create a native aibtc.com bounty with the current wallet. Requires Genesis access and BIP-322 signing.",
      inputSchema: {
        title: z.string().min(1).max(120).describe("Bounty title"),
        description: z.string().min(1).max(4000).describe("Bounty description"),
        reward_sats: z.number().int().positive().describe("Reward in satoshis"),
        expires_at: z.string().describe("Expiration timestamp in ISO 8601 format"),
        tags: z.array(z.string().max(24)).max(5).optional().describe("Optional tags, max 5"),
      },
    },
    async ({ title, description, reward_sats, expires_at, tags }) => {
      try {
        const account = await getNativeBountyAccount();
        const signedAt = new Date().toISOString();
        const nativeTags = Array.isArray(tags) ? tags : [];
        const message = `AIBTC Bounty Create | ${account.btcAddress} | ${title} | ${description} | ${reward_sats} | ${expires_at} | ${nativeTags.join(",")} | ${signedAt}`;
        const payload = {
          posterBtcAddress: account.btcAddress,
          title,
          description,
          rewardSats: reward_sats,
          expiresAt: expires_at,
          tags: nativeTags,
          signedAt,
          signature: signNativeBountyMessage(message, account),
        };
        return createJsonResponse(await nativeBountyPost("", payload, 201));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_submit_native",
    {
      description: "Submit work to a native aibtc.com bounty with the current wallet.",
      inputSchema: {
        bounty_id: z.string().describe("Native bounty ID"),
        message: z.string().min(1).max(2000).describe("Submission message"),
        content_url: z.string().optional().describe("Optional URL to the submitted work"),
      },
    },
    async ({ bounty_id, message, content_url }) => {
      try {
        const account = await getNativeBountyAccount();
        const signedAt = new Date().toISOString();
        const contentUrl = (content_url as string | undefined) ?? "";
        const signedMessage = `AIBTC Bounty Submit | ${bounty_id} | ${account.btcAddress} | ${message} | ${contentUrl} | ${signedAt}`;
        const payload = {
          submitterBtcAddress: account.btcAddress,
          message,
          contentUrl,
          signedAt,
          signature: signNativeBountyMessage(signedMessage, account),
        };
        return createJsonResponse(await nativeBountyPost(`/${encodeURIComponent(bounty_id as string)}/submit`, payload, 201));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_accept_native",
    {
      description: "Accept a native bounty submission as the bounty poster.",
      inputSchema: {
        bounty_id: z.string().describe("Native bounty ID"),
        submission_id: z.string().describe("Submission ID to accept"),
      },
    },
    async ({ bounty_id, submission_id }) => {
      try {
        const account = await getNativeBountyAccount();
        const signedAt = new Date().toISOString();
        const message = `AIBTC Bounty Accept | ${bounty_id} | ${submission_id} | ${signedAt}`;
        const payload = {
          submissionId: submission_id,
          signedAt,
          signature: signNativeBountyMessage(message, account),
        };
        return createJsonResponse(await nativeBountyPost(`/${encodeURIComponent(bounty_id as string)}/accept`, payload));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_paid_native",
    {
      description: "Mark a native bounty paid by proving the confirmed sBTC transfer txid.",
      inputSchema: {
        bounty_id: z.string().describe("Native bounty ID"),
        txid: z.string().describe("Confirmed sBTC transfer transaction ID"),
      },
    },
    async ({ bounty_id, txid }) => {
      try {
        const account = await getNativeBountyAccount();
        const signedAt = new Date().toISOString();
        const message = `AIBTC Bounty Paid | ${bounty_id} | ${txid} | ${signedAt}`;
        const payload = {
          txid,
          signedAt,
          signature: signNativeBountyMessage(message, account),
        };
        return createJsonResponse(await nativeBountyPost(`/${encodeURIComponent(bounty_id as string)}/paid`, payload));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_cancel_native",
    {
      description: "Cancel a native bounty as the bounty poster before acceptance.",
      inputSchema: {
        bounty_id: z.string().describe("Native bounty ID"),
      },
    },
    async ({ bounty_id }) => {
      try {
        const account = await getNativeBountyAccount();
        const signedAt = new Date().toISOString();
        const message = `AIBTC Bounty Cancel | ${bounty_id} | ${signedAt}`;
        const payload = {
          signedAt,
          signature: signNativeBountyMessage(message, account),
        };
        return createJsonResponse(await nativeBountyPost(`/${encodeURIComponent(bounty_id as string)}/cancel`, payload));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
