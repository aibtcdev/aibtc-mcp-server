/**
 * Native AIBTC Bounty Tools
 *
 * Tools for interacting with the native aibtc.com sBTC bounty system.
 * Replaces the external bounty.drx4.xyz proxy with direct API integration.
 *
 * Read-only tools (no auth required):
 * - bounty_list_native       — List bounties with optional filters
 * - bounty_get_native         — Full detail for a single bounty by ID
 * - bounty_submissions_native — List submissions for a bounty
 * - bounty_my_posted          — Bounties posted by this agent
 * - bounty_my_submissions     — Bounties submitted to by this agent
 *
 * Authenticated tools (requires unlocked wallet, BIP-322 signed):
 * - bounty_create_native      — Create a new bounty
 * - bounty_submit_native       — Submit work for a bounty
 * - bounty_accept_native      — Pick a winner for a bounty
 * - bounty_paid_native        — Prove payment for a bounty
 * - bounty_cancel_native      — Cancel a bounty before acceptance
 *
 * Authentication: BIP-322 signing as specified in the native system.
 * Base URL: https://aibtc.com/api/bounties
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

const NATIVE_BOUNTY_BASE = "https://aibtc.com/api/bounties";

// ============================================================================
// Auth header builder for native endpoints
// ============================================================================

type AccountForAuth = {
  btcAddress: string;
  btcPrivateKey: Uint8Array;
  btcPublicKey: Uint8Array;
  address?: string;
};

/**
 * Build BIP-322 auth headers for aibtc.com native bounty operations.
 * The native system expects the signature of the plain-text message string
 * in the X-Signature header.
 *
 * @param message - The formatted string to sign (e.g. "AIBTC Bounty Create | ...")
 * @param account - Pre-fetched account with BTC keys
 */
function buildNativeAuthHeaders(
  message: string,
  account: AccountForAuth
): Record<string, string> {
  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  const signature = bip322Sign(message, account.btcPrivateKey, scriptPubKey);

  return {
    "X-BTC-Address": account.btcAddress,
    "X-Signature": signature,
    "Content-Type": "application/json",
  };
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerNativeBountyTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // READ TOOLS (No Auth)
  // --------------------------------------------------------------------------

  server.registerTool(
    "bounty_list_native",
    {
      description: `List bounties from the native aibtc.com system.

Filters:
- status: "open", "judging", "winner-announced", "paid", "abandoned", "cancelled"
- poster: filter by poster BTC address
- submitter: filter by submitter BTC address
- tag: filter by tag
- limit: max results (default 20)
- offset: pagination offset`,
      inputSchema: {
        status: z.string().optional().describe("Bounty status"),
        poster: z.string().optional().describe("Poster BTC address"),
        submitter: z.string().optional().describe("Submitter BTC address"),
        tag: z.string().optional().describe("Filter by tag"),
        limit: z.number().optional().describe("Max results"),
        offset: z.number().optional().describe("Pagination offset"),
      },
    },
    async (params) => {
      try {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined) query.set(k, String(v));
        });

        const res = await fetch(`${NATIVE_BOUNTY_BASE}?${query.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  server.registerTool(
    "bounty_get_native",
    {
      description: `Get full details for a single native bounty by ID.

Includes derived status, winner block, and payment hints.`,
      inputSchema: {
        id: z.string().describe("Bounty ID"),
      },
    },
    async ({ id }) => {
      try {
        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  server.registerTool(
    "bounty_submissions_native",
    {
      description: `List submissions for a native bounty.`,
      inputSchema: {
        id: z.string().describe("Bounty ID"),
        limit: z.number().optional(),
        offset: z.number().optional(),
      },
    },
    async ({ id, limit, offset }) => {
      try {
        const query = new URLSearchParams();
        if (limit) query.set("limit", String(limit));
        if (offset) query.set("offset", String(offset));

        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(id)}/submissions?${query.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  // --------------------------------------------------------------------------
  // CONVENIENCE VIEWS (Read-only)
  // --------------------------------------------------------------------------

  server.registerTool(
    "bounty_my_posted",
    {
      description: `View bounties this agent has posted. Defaults to current wallet.`,
      inputSchema: {
        btc_address: z.string().optional().describe("Poster BTC address"),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          address = account.btcAddress;
          if (!address) throw new Error("No BTC address found in current wallet.");
        }
        const res = await fetch(`${NATIVE_BOUNTY_BASE}?poster=${encodeURIComponent(address)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  server.registerTool(
    "bounty_my_submissions",
    {
      description: `View bounties this agent has submitted to. Defaults to current wallet.`,
      inputSchema: {
        btc_address: z.string().optional().describe("Submitter BTC address"),
      },
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          address = account.btcAddress;
          if (!address) throw new Error("No BTC address found in current wallet.");
        }
        const res = await fetch(`${NATIVE_BOUNTY_BASE}?submitter=${encodeURIComponent(address)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  // --------------------------------------------------------------------------
  // WRITE TOOLS (Signed POSTs)
  // --------------------------------------------------------------------------

  server.registerTool(
    "bounty_create_native",
    {
      description: `Create a native bounty on aibtc.com.
      
      Message format: AIBTC Bounty Create | {posterBtc} | {title} | {description} | {rewardSats} | {expiresAt} | {tagsCommaJoined} | {signedAt}`,
      inputSchema: {
        title: z.string(),
        description: z.string(),
        reward_sats: z.number().int(),
        expires_at: z.string().describe("ISO 8601 timestamp"),
        tags: z.string().optional().describe("Comma-separated tags"),
      },
    },
    async ({ title, description, reward_sats, expires_at, tags }) => {
      try {
        const account = await getAccount();
        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error("BTC keys not available. Unlock wallet first.");
        }

        const signedAt = new Date().toISOString();
        const tagsCommaJoined = tags || "";
        const formattedMsg = `AIBTC Bounty Create | ${account.btcAddress} | ${title} | ${description} | ${reward_sats} | ${expires_at} | ${tagsCommaJoined} | ${signedAt}`;
        
        const headers = buildNativeAuthHeaders(formattedMsg, account as AccountForAuth);
        const payload = {
          title,
          description,
          reward_sats,
          expires_at,
          tags: tags ? tags.split(",") : [],
          btc_address: account.btcAddress,
          stx_address: account.address,
        };

        const res = await fetch(`${NATIVE_BOUNTY_BASE}`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  server.registerTool(
    "bounty_submit_native",
    {
      description: `Submit work for a native bounty.
      
      Message format: AIBTC Bounty Submit | {bountyId} | {submitterBtc} | {message} | {contentUrl} | {signedAt}`,
      inputSchema: {
        bounty_id: z.string(),
        message: z.string(),
        content_url: z.string().optional(),
      },
    },
    async ({ bounty_id, message, content_url }) => {
      try {
        const account = await getAccount();
        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error("BTC keys not available.");
        }

        const signedAt = new Date().toISOString();
        const formattedMsg = `AIBTC Bounty Submit | ${bounty_id} | ${account.btcAddress} | ${message} | ${content_url || ""} | ${signedAt}`;
        const headers = buildNativeAuthHeaders(formattedMsg, account as AccountForAuth);
        
        const payload = {
          bounty_id,
          message,
          content_url,
          submitter_btc: account.btcAddress,
          submitter_stx: account.address,
        };

        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(bounty_id)}/submit`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  server.registerTool(
    "bounty_accept_native",
    {
      description: `Pick winner for a native bounty.
      
      Message format: AIBTC Bounty Accept | {bountyId} | {submissionId} | {signedAt}`,
      inputSchema: {
        bounty_id: z.string(),
        submission_id: z.string(),
      },
    },
    async ({ bounty_id, submission_id }) => {
      try {
        const account = await getAccount();
        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error("BTC keys not available.");
        }

        const signedAt = new Date().toISOString();
        const formattedMsg = `AIBTC Bounty Accept | ${bounty_id} | ${submission_id} | ${signedAt}`;
        const headers = buildNativeAuthHeaders(formattedMsg, account as AccountForAuth);
        
        const payload = { bounty_id, submission_id };

        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(bounty_id)}/accept`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  server.registerTool(
    "bounty_paid_native",
    {
      description: `Prove payment for a native bounty.
      
      Message format: AIBTC Bounty Paid | {bountyId} | {txid} | {signedAt}`,
      inputSchema: {
        bounty_id: z.string(),
        txid: z.string(),
      },
    },
    async ({ bounty_id, txid }) => {
      try {
        const account = await getAccount();
        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error("BTC keys not available.");
        }

        const signedAt = new Date().toISOString();
        const formattedMsg = `AIBTC Bounty Paid | ${bounty_id} | ${txid} | ${signedAt}`;
        const headers = buildNativeAuthHeaders(formattedMsg, account as AccountForAuth);
        
        const payload = { bounty_id, txid };

        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(bounty_id)}/paid`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );

  server.registerTool(
    "bounty_cancel_native",
    {
      description: `Cancel a native bounty.
      
      Message format: AIBTC Bounty Cancel | {bountyId} | {signedAt}`,
      inputSchema: {
        bounty_id: z.string(),
      },
    },
    async ({ bounty_id }) => {
      try {
        const account = await getAccount();
        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error("BTC keys not available.");
        }

        const signedAt = new Date().toISOString();
        const formattedMsg = `AIBTC Bounty Cancel | ${bounty_id} | ${signedAt}`;
        const headers = buildNativeAuthHeaders(formattedMsg, account as AccountForAuth);
        
        const payload = { bounty_id };

        const res = await fetch(`${NATIVE_BOUNTY_BASE}/${encodeURIComponent(bounty_id)}/cancel`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return createJsonResponse(await res.json());
      } catch (e) {
        return createErrorResponse(e);
      }
    }
  );
}
