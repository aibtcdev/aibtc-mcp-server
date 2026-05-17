/**
 * Bounty Scanner Tools
 *
 * Tools for interacting with bounty boards.
 *
 * Legacy `bounty_*` tools target bounty.drx4.xyz and are kept for backwards
 * compatibility. Native `bounty_*_native` tools target aibtc.com/api/bounties.
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
  p2tr,
  NETWORK as BTC_MAINNET,
  TEST_NETWORK as BTC_TESTNET,
} from "@scure/btc-signer";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hashSha256Sync } from "@stacks/encryption";
import { NETWORK } from "../config/networks.js";
import { getAccount } from "../services/x402.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { bip322Sign } from "../utils/bip322.js";

const BOUNTY_BASE = "https://bounty.drx4.xyz/api";
const NATIVE_BOUNTY_BASE = "https://aibtc.com/api/bounties";

const NATIVE_BOUNTY_STATUSES = [
  "open",
  "judging",
  "winner-announced",
  "paid",
  "abandoned",
  "cancelled",
] as const;

const BITCOIN_MSG_PREFIX = "\x18Bitcoin Signed Message:\n";

const BIP137_HEADER_BASE = {
  P2PKH_COMPRESSED: 31,
  P2SH_P2WPKH: 35,
} as const;

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
  taprootAddress?: string;
  taprootPrivateKey?: Uint8Array;
  taprootPublicKey?: Uint8Array;
  address?: string;
};

function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) return new Uint8Array([0xfd, n & 0xff, (n >> 8) & 0xff]);
  if (n <= 0xffffffff) {
    return new Uint8Array([
      0xfe,
      n & 0xff,
      (n >> 8) & 0xff,
      (n >> 16) & 0xff,
      (n >> 24) & 0xff,
    ]);
  }
  throw new Error("Message too long for Bitcoin message signing");
}

function formatBitcoinMessage(message: string): Uint8Array {
  const prefixBytes = new TextEncoder().encode(BITCOIN_MSG_PREFIX);
  const messageBytes = new TextEncoder().encode(message);
  const lengthBytes = encodeVarInt(messageBytes.length);
  const result = new Uint8Array(prefixBytes.length + lengthBytes.length + messageBytes.length);
  result.set(prefixBytes, 0);
  result.set(lengthBytes, prefixBytes.length);
  result.set(messageBytes, prefixBytes.length + lengthBytes.length);
  return result;
}

function doubleSha256(data: Uint8Array): Uint8Array {
  return hashSha256Sync(hashSha256Sync(data));
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

function isLegacyBtcAddress(address: string): boolean {
  return /^[13mn2]/.test(address);
}

function isTaprootAddress(address: string): boolean {
  return address.startsWith("bc1p") || address.startsWith("tb1p") || address.startsWith("bcrt1p");
}

function signBip137(message: string, account: AccountForAuth): string {
  const formattedMsg = formatBitcoinMessage(message);
  const msgHash = doubleSha256(formattedMsg);
  const compact = secp256k1.sign(msgHash, account.btcPrivateKey, {
    prehash: false,
    lowS: true,
  });

  const expectedPublicKey = secp256k1.getPublicKey(account.btcPrivateKey, true);
  let recoveryId: number | undefined;
  for (let candidate = 0; candidate < 4; candidate += 1) {
    const recoveredSignature = new Uint8Array(65);
    recoveredSignature[0] = candidate;
    recoveredSignature.set(compact, 1);
    try {
      const recoveredPublicKey = secp256k1.recoverPublicKey(recoveredSignature, msgHash, {
        prehash: false,
      });
      if (bytesEqual(recoveredPublicKey, expectedPublicKey)) {
        recoveryId = candidate;
        break;
      }
    } catch {
      // Some recovery IDs are invalid for a given signature; try the next one.
    }
  }

  if (recoveryId === undefined) {
    throw new Error("Could not recover BIP-137 signature recovery ID.");
  }

  const headerBase =
    account.btcAddress.startsWith("1") ||
    account.btcAddress.startsWith("m") ||
    account.btcAddress.startsWith("n")
      ? BIP137_HEADER_BASE.P2PKH_COMPRESSED
      : BIP137_HEADER_BASE.P2SH_P2WPKH;

  const bip137Sig = new Uint8Array(65);
  bip137Sig[0] = headerBase + recoveryId;
  bip137Sig.set(compact.subarray(0, 32), 1);
  bip137Sig.set(compact.subarray(32, 64), 33);
  return Buffer.from(bip137Sig).toString("base64");
}

function signNativeBountyMessage(message: string, account: AccountForAuth): string {
  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;

  if (isLegacyBtcAddress(account.btcAddress)) {
    return signBip137(message, account);
  }

  if (isTaprootAddress(account.btcAddress)) {
    if (!account.taprootPrivateKey || !account.taprootPublicKey) {
      throw new Error("Taproot keys not available for native bounty signing.");
    }
    const scriptPubKey = p2tr(account.taprootPublicKey, undefined, btcNetwork).script;
    return bip322Sign(message, account.taprootPrivateKey, scriptPubKey, account.taprootPublicKey);
  }

  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  return bip322Sign(message, account.btcPrivateKey, scriptPubKey);
}

async function getBountySigningAccount(): Promise<AccountForAuth> {
  const account = await getAccount();
  if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
    throw new Error("Bitcoin keys not available. Unlock a wallet with BTC key derivation.");
  }
  return account as AccountForAuth;
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchNativeBounty(path: string, params?: URLSearchParams): Promise<unknown> {
  const query = params?.toString();
  const res = await fetch(`${NATIVE_BOUNTY_BASE}${path}${query ? `?${query}` : ""}`);
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(`AIBTC bounty API request failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function postNativeBounty(path: string, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${NATIVE_BOUNTY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(`AIBTC bounty API request failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

function normalizeTags(tags?: string[] | string): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((tag) => tag.trim()).filter(Boolean);
  return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function nativeListParams(filters: {
  status?: string;
  poster?: string;
  submitter?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("status", filters.status ?? "active");
  if (filters.poster) params.set("poster", filters.poster);
  if (filters.submitter) params.set("submitter", filters.submitter);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.offset !== undefined) params.set("offset", String(filters.offset));
  return params;
}

function extractBountyRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.bounties)) return obj.bounties as Array<Record<string, unknown>>;
    if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
    if (Array.isArray(obj.results)) return obj.results as Array<Record<string, unknown>>;
  }
  return [];
}

async function fetchNativeBountyView(filter: "poster" | "submitter", address: string): Promise<{
  address: string;
  bounties: Array<Record<string, unknown>>;
}> {
  const seen = new Set<string>();
  const bounties: Array<Record<string, unknown>> = [];

  for (const status of NATIVE_BOUNTY_STATUSES) {
    const params = nativeListParams({ [filter]: address, status, limit: 50 });
    const data = await fetchNativeBounty("", params);
    for (const bounty of extractBountyRows(data)) {
      const id = typeof bounty.id === "string" ? bounty.id : JSON.stringify(bounty);
      if (seen.has(id)) continue;
      seen.add(id);
      bounties.push(bounty);
      if (bounties.length >= 50) break;
    }
    if (bounties.length >= 50) break;
  }

  return { address, bounties };
}

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
      description: `[DEPRECATED — targets bounty.drx4.xyz, use bounty_get_native for aibtc.com] Get full details for a single bounty on bounty.drx4.xyz.

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
      description: `[DEPRECATED — targets bounty.drx4.xyz, use bounty_list_native for aibtc.com] Score open bounties against an agent's capability profile.

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
      description: `[DEPRECATED — targets bounty.drx4.xyz, use bounty_create_native for aibtc.com] Create a new bounty on bounty.drx4.xyz.

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
      description: `[DEPRECATED — targets bounty.drx4.xyz. Native aibtc.com bounties do not use claims; use bounty_submit_native to submit work.] Claim a bounty on bounty.drx4.xyz.

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
      description: `[DEPRECATED — targets bounty.drx4.xyz, use bounty_get_native for aibtc.com] Check the current status of a bounty on bounty.drx4.xyz.

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
      description: `[DEPRECATED — targets bounty.drx4.xyz, use bounty_my_posted or bounty_my_submissions for aibtc.com] List all bounty claims and submissions for the current wallet's BTC address.

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
      description: `[DEPRECATED — targets bounty.drx4.xyz; native aibtc.com exposes list/detail/submission views instead.] Get aggregate platform statistics from bounty.drx4.xyz.

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

  // --------------------------------------------------------------------------
  // bounty_list_native — List native aibtc.com bounties
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_list_native",
    {
      description: `List native AIBTC bounties from aibtc.com/api/bounties.

Filters:
- status: open, judging, winner-announced, paid, abandoned, cancelled, active
- poster: BTC address that posted the bounty
- submitter: BTC address that submitted work; rows include yourSubmissions when supported by the API
- tag: single tag filter
- limit/offset: pagination controls

No authentication required.`,
      inputSchema: {
        status: z
          .enum(["open", "judging", "winner-announced", "paid", "abandoned", "cancelled", "active"])
          .optional()
          .describe("Filter by derived bounty status. Omit for the API default active view."),
        poster: z.string().optional().describe("Filter by poster BTC address"),
        submitter: z.string().optional().describe("Filter by submitter BTC address"),
        tag: z.string().optional().describe("Filter by a single tag"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20, max 100)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
      },
    },
    async ({ status, poster, submitter, tag, limit, offset }) => {
      try {
        const params = nativeListParams({ status, poster, submitter, tag, limit, offset });
        const data = await fetchNativeBounty("", params);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_get_native — Native bounty detail
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_get_native",
    {
      description: `Get a native AIBTC bounty detail record from aibtc.com.

Returns the derived status, first submissions page, winner block when accepted,
and payment hint when the bounty is waiting for payment.

No authentication required.`,
      inputSchema: {
        bounty_id: z.string().describe("Native AIBTC bounty ID"),
      },
    },
    async ({ bounty_id }) => {
      try {
        const data = await fetchNativeBounty(`/${encodeURIComponent(bounty_id)}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_submissions_native — Native bounty submissions page
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_submissions_native",
    {
      description: `List submissions for a native AIBTC bounty.

No authentication required.`,
      inputSchema: {
        bounty_id: z.string().describe("Native AIBTC bounty ID"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20, max 100)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
      },
    },
    async ({ bounty_id, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const data = await fetchNativeBounty(`/${encodeURIComponent(bounty_id)}/submissions`, params);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_create_native — Signed native bounty create
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_create_native",
    {
      description: `Create a native AIBTC bounty on aibtc.com/api/bounties.

Requires an unlocked wallet with a registered Genesis-level (L2+) BTC identity.
Signs: "AIBTC Bounty Create | {posterBtc} | {title} | {description} | {rewardSats} | {expiresAt} | {tagsCommaJoined} | {signedAt}".`,
      inputSchema: {
        title: z.string().min(1).describe("Bounty title"),
        description: z.string().min(1).describe("Full task description and acceptance criteria"),
        reward_sats: z.number().int().positive().describe("Reward amount in satoshis"),
        expires_at: z.string().describe("ISO 8601 expiration timestamp"),
        tags: z
          .union([z.array(z.string()), z.string()])
          .optional()
          .describe("Tags as an array or comma-separated string"),
      },
    },
    async ({ title, description, reward_sats, expires_at, tags }) => {
      try {
        const account = await getBountySigningAccount();
        const normalizedTags = normalizeTags(tags);
        const signedAt = new Date().toISOString();
        const tagsCommaJoined = normalizedTags.join(",");
        const message =
          `AIBTC Bounty Create | ${account.btcAddress} | ${title} | ${description} | ` +
          `${reward_sats} | ${expires_at} | ${tagsCommaJoined} | ${signedAt}`;
        const signature = signNativeBountyMessage(message, account);

        const data = await postNativeBounty("", {
          posterBtcAddress: account.btcAddress,
          title,
          description,
          rewardSats: reward_sats,
          expiresAt: expires_at,
          tags: normalizedTags,
          signedAt,
          signature,
        });

        return createJsonResponse({
          success: true,
          message: "Native AIBTC bounty created",
          signedMessage: message,
          bounty: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_submit_native — Signed native bounty submission
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_submit_native",
    {
      description: `Submit work to a native AIBTC bounty.

Requires an unlocked wallet with a registered L1+ BTC identity.
Signs: "AIBTC Bounty Submit | {bountyId} | {submitterBtc} | {message} | {contentUrl} | {signedAt}".`,
      inputSchema: {
        bounty_id: z.string().describe("Native AIBTC bounty ID"),
        message: z.string().min(1).describe("Submission message"),
        content_url: z.string().optional().describe("Optional proof URL, such as a PR or demo"),
      },
    },
    async ({ bounty_id, message, content_url }) => {
      try {
        const account = await getBountySigningAccount();
        const signedAt = new Date().toISOString();
        const contentUrl = content_url ?? "";
        const signedMessage =
          `AIBTC Bounty Submit | ${bounty_id} | ${account.btcAddress} | ` +
          `${message} | ${contentUrl} | ${signedAt}`;
        const signature = signNativeBountyMessage(signedMessage, account);

        const data = await postNativeBounty(`/${encodeURIComponent(bounty_id)}/submit`, {
          submitterBtcAddress: account.btcAddress,
          message,
          contentUrl,
          signedAt,
          signature,
        });

        return createJsonResponse({
          success: true,
          message: "Native AIBTC bounty submission created",
          signedMessage,
          submission: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_accept_native — Signed native bounty winner selection
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_accept_native",
    {
      description: `Accept a winning submission for a native AIBTC bounty.

Requires the poster's unlocked wallet. Signs:
"AIBTC Bounty Accept | {bountyId} | {submissionId} | {signedAt}".`,
      inputSchema: {
        bounty_id: z.string().describe("Native AIBTC bounty ID"),
        submission_id: z.string().describe("Submission ID to accept as winner"),
      },
    },
    async ({ bounty_id, submission_id }) => {
      try {
        const account = await getBountySigningAccount();
        const signedAt = new Date().toISOString();
        const signedMessage = `AIBTC Bounty Accept | ${bounty_id} | ${submission_id} | ${signedAt}`;
        const signature = signNativeBountyMessage(signedMessage, account);

        const data = await postNativeBounty(`/${encodeURIComponent(bounty_id)}/accept`, {
          submissionId: submission_id,
          signedAt,
          signature,
        });

        return createJsonResponse({
          success: true,
          message: "Native AIBTC bounty winner accepted",
          signedMessage,
          bounty: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_paid_native — Signed native bounty payment proof
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_paid_native",
    {
      description: `Prove payment for a native AIBTC bounty with a confirmed sBTC txid.

Requires the poster's unlocked wallet. Verify the transaction is confirmed first.
Signs: "AIBTC Bounty Paid | {bountyId} | {txid} | {signedAt}".`,
      inputSchema: {
        bounty_id: z.string().describe("Native AIBTC bounty ID"),
        txid: z.string().min(1).describe("Confirmed sBTC payment transaction ID"),
      },
    },
    async ({ bounty_id, txid }) => {
      try {
        const account = await getBountySigningAccount();
        const signedAt = new Date().toISOString();
        const signedMessage = `AIBTC Bounty Paid | ${bounty_id} | ${txid} | ${signedAt}`;
        const signature = signNativeBountyMessage(signedMessage, account);

        const data = await postNativeBounty(`/${encodeURIComponent(bounty_id)}/paid`, {
          txid,
          signedAt,
          signature,
        });

        return createJsonResponse({
          success: true,
          message: "Native AIBTC bounty payment verified",
          signedMessage,
          bounty: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_cancel_native — Signed native bounty cancel
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_cancel_native",
    {
      description: `Cancel a native AIBTC bounty before any winner is accepted.

Requires the poster's unlocked wallet. Signs:
"AIBTC Bounty Cancel | {bountyId} | {signedAt}".`,
      inputSchema: {
        bounty_id: z.string().describe("Native AIBTC bounty ID"),
      },
    },
    async ({ bounty_id }) => {
      try {
        const account = await getBountySigningAccount();
        const signedAt = new Date().toISOString();
        const signedMessage = `AIBTC Bounty Cancel | ${bounty_id} | ${signedAt}`;
        const signature = signNativeBountyMessage(signedMessage, account);

        const data = await postNativeBounty(`/${encodeURIComponent(bounty_id)}/cancel`, {
          signedAt,
          signature,
        });

        return createJsonResponse({
          success: true,
          message: "Native AIBTC bounty cancelled",
          signedMessage,
          bounty: data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_my_posted — Native poster activity view
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_my_posted",
    {
      description: `List up to 50 native AIBTC bounties posted by the current wallet.

If btc_address is omitted, the tool uses the unlocked wallet's BTC address.
Queries all native derived statuses so terminal paid/cancelled/abandoned bounties
are included alongside active work.`,
      inputSchema: {
        btc_address: z.string().optional().describe("Poster BTC address. Omit to use the unlocked wallet."),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error("No BTC address found. Provide btc_address or unlock a wallet.");
          }
          address = account.btcAddress;
        }

        const data = await fetchNativeBountyView("poster", address);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_my_submissions — Native submitter activity view
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_my_submissions",
    {
      description: `List up to 50 native AIBTC bounties the current wallet has submitted to.

If btc_address is omitted, the tool uses the unlocked wallet's BTC address.
The aibtc.com API includes the submitter's matching submissions on rows when
the submitter filter is present.`,
      inputSchema: {
        btc_address: z.string().optional().describe("Submitter BTC address. Omit to use the unlocked wallet."),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error("No BTC address found. Provide btc_address or unlock a wallet.");
          }
          address = account.btcAddress;
        }

        const data = await fetchNativeBountyView("submitter", address);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
