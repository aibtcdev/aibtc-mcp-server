import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount } from "../services/x402.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

const BOUNTY_API_BASE = "https://bounty.drx4.xyz/api";

/**
 * Register bounty scanner tools with the MCP server.
 *
 * Tools:
 *   bounty_list       — List bounties with optional status/tag filter
 *   bounty_get        — Get full detail for a single bounty by ID
 *   bounty_claim      — Submit a claim on a bounty (authenticated via wallet BTC address)
 *   bounty_submit     — Submit a proof/solution against an existing claim
 *   bounty_status     — Check the status of a claim by ID
 *   bounty_my_claims  — List all claims filed by the active wallet
 *
 * API base: https://bounty.drx4.xyz/api
 */
export function registerBountyTools(server: McpServer): void {
  // ─── bounty_list ──────────────────────────────────────────────────────────
  server.registerTool(
    "bounty_list",
    {
      description:
        "List bounties from the AIBTC bounty platform. " +
        "By default returns open bounties. " +
        "Use the status filter to see bounties in other states (open, claimed, completed). " +
        "Use the tag filter to narrow results by topic (e.g. 'mcp', 'frontend', 'bug').",
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe(
            "Filter by status: 'open' (default), 'claimed', or 'completed'"
          ),
        tag: z
          .string()
          .optional()
          .describe("Filter by tag (e.g. 'mcp', 'frontend', 'bug')"),
      },
    },
    async ({ status, tag }) => {
      try {
        const params = new URLSearchParams();
        params.set("status", status ?? "open");
        if (tag) {
          params.set("tag", tag);
        }

        const url = `${BOUNTY_API_BASE}/bounties?${params.toString()}`;
        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`bounty_list failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ─── bounty_get ───────────────────────────────────────────────────────────
  server.registerTool(
    "bounty_get",
    {
      description:
        "Get full detail for a single bounty by its ID. " +
        "Returns the bounty description, reward amount, status, tags, and any existing claims.",
      inputSchema: {
        id: z.string().describe("The bounty ID to look up"),
      },
    },
    async ({ id }) => {
      try {
        const url = `${BOUNTY_API_BASE}/bounties/${encodeURIComponent(id)}`;
        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`bounty_get failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ─── bounty_claim ─────────────────────────────────────────────────────────
  server.registerTool(
    "bounty_claim",
    {
      description:
        "Submit a claim on an open bounty. " +
        "The claim is associated with the active wallet's Bitcoin address (claimer_btc). " +
        "Include a message explaining how you plan to complete the bounty. " +
        "The wallet must be unlocked before calling this tool. " +
        "NOTE: Full BIP-137 request signing is a TODO — currently the wallet BTC address " +
        "is sent as the claimer identifier without a cryptographic signature.",
      inputSchema: {
        bounty_id: z.string().describe("The ID of the bounty to claim"),
        message: z
          .string()
          .describe(
            "A message explaining your approach or intent for completing this bounty"
          ),
      },
    },
    async ({ bounty_id, message }) => {
      try {
        const account = await getAccount();
        const claimerBtc = account.btcAddress;

        if (!claimerBtc) {
          throw new Error(
            "Active wallet has no BTC address. " +
              "Unlock a wallet with a full BIP-32 seed to obtain a BTC address."
          );
        }

        const body = {
          bounty_id,
          message,
          claimer_btc: claimerBtc,
          // TODO: Add BIP-137 signature over the claim payload using account.btcPrivateKey
          // Pattern: sign(sha256d(`Bitcoin Signed Message:\n${payload}`), btcPrivKey)
          // Library: bitcoinjs-message (same library used by other signing tools)
        };

        const res = await fetch(`${BOUNTY_API_BASE}/claims`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`bounty_claim failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ─── bounty_submit ────────────────────────────────────────────────────────
  server.registerTool(
    "bounty_submit",
    {
      description:
        "Submit proof of completion for an existing bounty claim. " +
        "Provide the claim ID, a description of what was done, and optionally a URL " +
        "pointing to the work product (e.g. a GitHub PR, deployed contract, or gist). " +
        "The wallet must be unlocked — the submission is associated with the active wallet's " +
        "BTC address.",
      inputSchema: {
        claim_id: z
          .string()
          .describe("The ID of the claim to submit proof for"),
        description: z
          .string()
          .describe("Description of the completed work and how it satisfies the bounty"),
        proof_url: z
          .string()
          .optional()
          .describe(
            "Optional URL pointing to the proof (GitHub PR, deployed contract, gist, etc.)"
          ),
      },
    },
    async ({ claim_id, description, proof_url }) => {
      try {
        const account = await getAccount();
        const claimerBtc = account.btcAddress;

        if (!claimerBtc) {
          throw new Error(
            "Active wallet has no BTC address. " +
              "Unlock a wallet with a full BIP-32 seed to obtain a BTC address."
          );
        }

        const body: Record<string, string> = {
          claim_id,
          description,
          claimer_btc: claimerBtc,
        };
        if (proof_url) {
          body["proof_url"] = proof_url;
        }

        const res = await fetch(`${BOUNTY_API_BASE}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`bounty_submit failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ─── bounty_status ────────────────────────────────────────────────────────
  server.registerTool(
    "bounty_status",
    {
      description:
        "Check the current status of a specific claim by its ID. " +
        "Returns the claim state (pending, approved, rejected), any reviewer notes, " +
        "and payment status.",
      inputSchema: {
        id: z.string().describe("The claim ID to check"),
      },
    },
    async ({ id }) => {
      try {
        const url = `${BOUNTY_API_BASE}/claims/${encodeURIComponent(id)}`;
        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`bounty_status failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ─── bounty_my_claims ─────────────────────────────────────────────────────
  server.registerTool(
    "bounty_my_claims",
    {
      description:
        "List all bounty claims filed by the currently active wallet. " +
        "Uses the wallet's Bitcoin address as the claimer identifier. " +
        "The wallet must be unlocked. " +
        "Returns an array of claims including their status, associated bounty, and any submissions.",
      inputSchema: {},
    },
    async () => {
      try {
        const account = await getAccount();
        const claimerBtc = account.btcAddress;

        if (!claimerBtc) {
          throw new Error(
            "Active wallet has no BTC address. " +
              "Unlock a wallet with a full BIP-32 seed to obtain a BTC address."
          );
        }

        const params = new URLSearchParams({ claimer_btc: claimerBtc });
        const url = `${BOUNTY_API_BASE}/claims?${params.toString()}`;
        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`bounty_my_claims failed (${res.status}): ${text}`);
        }

        const data = await res.json();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
