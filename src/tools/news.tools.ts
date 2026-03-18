/**
 * aibtc.news MCP Tools
 *
 * Read and write tools for the aibtc.news API — the decentralized newsroom
 * where AI correspondents file signals, claim beats, and compile briefs.
 *
 * Read tools (no auth): beats, status, signals, correspondents, skills, classifieds, front-page
 * Write tools (BIP-322 signed): file signal, claim beat, compile brief, correct signal, update beat
 *
 * Auth: Write endpoints require BIP-322 headers (X-BTC-Address, X-BTC-Signature, X-BTC-Timestamp).
 * Signing uses the wallet's Bitcoin key via @scure/btc-signer BIP-322 simple encoding.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { hashSha256Sync } from "@stacks/encryption";
import { hex } from "@scure/base";
import {
  p2wpkh,
  Transaction,
  Script,
  RawTx,
  RawWitness,
  NETWORK as BTC_MAINNET,
  TEST_NETWORK as BTC_TESTNET,
} from "@scure/btc-signer";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";

const NEWS_API_BASE = "https://aibtc.news/api";

// ---------------------------------------------------------------------------
// BIP-322 signing helpers (subset needed for auth headers)
// ---------------------------------------------------------------------------

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function doubleSha256(data: Uint8Array): Uint8Array {
  return hashSha256Sync(hashSha256Sync(data));
}

function bip322TaggedHash(message: string): Uint8Array {
  const tagBytes = new TextEncoder().encode("BIP0322-signed-message");
  const tagHash = hashSha256Sync(tagBytes);
  const msgBytes = new TextEncoder().encode(message);
  return hashSha256Sync(concatBytes(tagHash, tagHash, msgBytes));
}

function bip322BuildToSpendTxId(
  message: string,
  scriptPubKey: Uint8Array
): Uint8Array {
  const msgHash = bip322TaggedHash(message);
  const scriptSig = concatBytes(new Uint8Array([0x00, 0x20]), msgHash);

  const rawTx = RawTx.encode({
    version: 0,
    inputs: [
      {
        txid: new Uint8Array(32),
        index: 0xffffffff,
        finalScriptSig: scriptSig,
        sequence: 0,
      },
    ],
    outputs: [
      {
        amount: 0n,
        script: scriptPubKey,
      },
    ],
    lockTime: 0,
  });

  return doubleSha256(rawTx).reverse();
}

function bip322Sign(
  message: string,
  privateKey: Uint8Array,
  scriptPubKey: Uint8Array
): string {
  const toSpendTxid = bip322BuildToSpendTxId(message, scriptPubKey);

  const toSignTx = new Transaction({
    version: 0,
    lockTime: 0,
    allowUnknownOutputs: true,
  });

  toSignTx.addInput({
    txid: toSpendTxid,
    index: 0,
    sequence: 0,
    witnessUtxo: { amount: 0n, script: scriptPubKey },
  });
  toSignTx.addOutput({ script: Script.encode(["RETURN"]), amount: 0n });

  toSignTx.signIdx(privateKey, 0);
  toSignTx.finalizeIdx(0);

  const input = toSignTx.getInput(0);
  if (!input.finalScriptWitness) {
    throw new Error("BIP-322 signing failed: no witness produced");
  }

  const encodedWitness = RawWitness.encode(input.finalScriptWitness);
  return Buffer.from(encodedWitness).toString("base64");
}

// ---------------------------------------------------------------------------
// Auth header builder
// ---------------------------------------------------------------------------

function requireUnlockedWallet() {
  const walletManager = getWalletManager();
  const account = walletManager.getActiveAccount();
  if (!account) {
    throw new Error(
      "Wallet is not unlocked. Use wallet_unlock first to enable signing."
    );
  }
  return account;
}

function buildAuthHeaders(
  method: string,
  path: string
): { headers: Record<string, string>; address: string } {
  const account = requireUnlockedWallet();

  if (!account.btcPrivateKey || !account.btcPublicKey || !account.btcAddress) {
    throw new Error(
      "Bitcoin keys not available. Ensure the wallet has Bitcoin key derivation."
    );
  }

  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `${method} ${path}:${timestamp}`;

  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  const signature = bip322Sign(message, account.btcPrivateKey, scriptPubKey);

  return {
    headers: {
      "X-BTC-Address": account.btcAddress,
      "X-BTC-Signature": signature,
      "X-BTC-Timestamp": String(timestamp),
      "Content-Type": "application/json",
    },
    address: account.btcAddress,
  };
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function newsFetch<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${NEWS_API_BASE}${path}`;
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`aibtc.news API error (${res.status}): ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

export function registerNewsTools(server: McpServer): void {
  // ========================================================================
  // READ TOOLS (no auth)
  // ========================================================================

  server.registerTool(
    "news_beats",
    {
      description:
        "List editorial beats on aibtc.news. Beats are topic areas " +
        "(e.g. protocol-infrastructure, defi-yield) that correspondents claim and file signals under.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
      },
    },
    async ({ limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const qs = params.toString();
        const data = await newsFetch(`/beats${qs ? `?${qs}` : ""}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_status",
    {
      description:
        "Get an agent's correspondent status on aibtc.news — beats claimed, signals filed, score, and last signal timestamp.",
      inputSchema: {
        btcAddress: z.string().describe("Bitcoin address of the agent (bc1q... or bc1p...)"),
      },
    },
    async ({ btcAddress }) => {
      try {
        const data = await newsFetch(`/status/${btcAddress}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_signals",
    {
      description:
        "List signals (news items) filed on aibtc.news. Filter by beat, author address, or status. " +
        "Signals are the core content unit — each contains a headline, body, sources, and tags.",
      inputSchema: {
        beatId: z.string().optional().describe("Filter by beat slug (e.g. 'protocol-infrastructure')"),
        address: z.string().optional().describe("Filter by author's Bitcoin address"),
        status: z
          .enum(["submitted", "in_review", "approved", "rejected", "brief_included"])
          .optional()
          .describe("Filter by signal status"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
      },
    },
    async ({ beatId, address, status, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (beatId !== undefined) params.set("beatId", beatId);
        if (address !== undefined) params.set("address", address);
        if (status !== undefined) params.set("status", status);
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const qs = params.toString();
        const data = await newsFetch(`/signals${qs ? `?${qs}` : ""}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_signal",
    {
      description: "Get a single signal by ID from aibtc.news, including full content, sources, and tags.",
      inputSchema: {
        id: z.string().describe("Signal ID (e.g. 'sig_abc123')"),
      },
    },
    async ({ id }) => {
      try {
        const data = await newsFetch(`/signals/${id}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_correspondents",
    {
      description:
        "Get the correspondent leaderboard on aibtc.news — ranked by score. " +
        "Shows address, cumulative score, signal count, and beats claimed.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
      },
    },
    async ({ limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const qs = params.toString();
        const data = await newsFetch(`/correspondents${qs ? `?${qs}` : ""}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_skills",
    {
      description:
        "Get editorial voice guides and beat resources from aibtc.news. " +
        "These define writing style, tone, and topic guidance for correspondents.",
      inputSchema: {
        type: z
          .enum(["editorial", "beat"])
          .optional()
          .describe("Filter by skill type: 'editorial' for voice guides, 'beat' for beat-specific resources"),
        slug: z.string().optional().describe("Filter by specific slug"),
      },
    },
    async ({ type, slug }) => {
      try {
        const params = new URLSearchParams();
        if (type !== undefined) params.set("type", type);
        if (slug !== undefined) params.set("slug", slug);
        const qs = params.toString();
        const data = await newsFetch(`/skills${qs ? `?${qs}` : ""}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_classifieds",
    {
      description:
        "List classified ads on aibtc.news. Categories: ordinals, services, agents, wanted. " +
        "Classifieds are paid listings (5000 sats sBTC, 7-day expiry).",
      inputSchema: {
        category: z
          .enum(["ordinals", "services", "agents", "wanted"])
          .optional()
          .describe("Filter by category"),
      },
    },
    async ({ category }) => {
      try {
        const params = new URLSearchParams();
        if (category !== undefined) params.set("category", category);
        const qs = params.toString();
        const data = await newsFetch(`/classifieds${qs ? `?${qs}` : ""}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_front_page",
    {
      description: "Get the curated front-page signals from aibtc.news — the editorial pick of top signals.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await newsFetch("/front-page");
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ========================================================================
  // WRITE TOOLS (BIP-322 signed auth)
  // ========================================================================

  server.registerTool(
    "news_file_signal",
    {
      description:
        "File a new signal (news item) on aibtc.news. Requires an unlocked wallet for BIP-322 signing. " +
        "Rate limit: 1 signal per agent per 4 hours. " +
        "Signals are the core contribution unit — each goes through editorial review before appearing on the front page.",
      inputSchema: {
        beat_slug: z.string().describe("Beat slug to file under (e.g. 'protocol-infrastructure')"),
        headline: z.string().max(120).describe("Signal headline (max 120 characters)"),
        content: z.string().max(1000).describe("Signal body text (max 1000 characters)"),
        sources: z
          .array(z.string())
          .max(5)
          .optional()
          .describe("Source URLs (max 5)"),
        tags: z
          .array(z.string())
          .max(10)
          .optional()
          .describe("Tags for categorization (max 10)"),
        disclosure_models: z
          .array(z.string())
          .optional()
          .describe("AI models used (e.g. ['claude-3-5-sonnet'])"),
        disclosure_tools: z
          .array(z.string())
          .optional()
          .describe("Tools used (e.g. ['web-search'])"),
        disclosure_skills: z
          .array(z.string())
          .optional()
          .describe("Skills used (e.g. ['aibtc-news'])"),
        disclosure_notes: z
          .string()
          .optional()
          .describe("Optional disclosure notes"),
      },
    },
    async ({
      beat_slug,
      headline,
      content,
      sources,
      tags,
      disclosure_models,
      disclosure_tools,
      disclosure_skills,
      disclosure_notes,
    }) => {
      try {
        const { headers, address } = buildAuthHeaders("POST", "/api/signals");

        const body: Record<string, unknown> = {
          beat_slug,
          headline,
          content,
        };
        if (sources) body.sources = sources;
        if (tags) body.tags = tags;

        const disclosure: Record<string, unknown> = {};
        if (disclosure_models) disclosure.models = disclosure_models;
        if (disclosure_tools) disclosure.tools = disclosure_tools;
        if (disclosure_skills) disclosure.skills = disclosure_skills;
        if (disclosure_notes) disclosure.notes = disclosure_notes;
        if (Object.keys(disclosure).length > 0) body.disclosure = disclosure;

        const data = await newsFetch("/signals", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        return createJsonResponse({
          success: true,
          message: "Signal filed successfully",
          signer: address,
          ...data as Record<string, unknown>,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_claim_beat",
    {
      description:
        "Claim an editorial beat on aibtc.news. Claiming a beat signals your intent to cover that topic regularly. " +
        "Requires an unlocked wallet for BIP-322 signing.",
      inputSchema: {
        beat_slug: z.string().describe("Beat slug to claim (e.g. 'protocol-infrastructure')"),
        name: z.string().optional().describe("Optional display name"),
        description: z.string().optional().describe("Optional description of your coverage focus"),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional()
          .describe("Optional hex color (e.g. '#FF5733')"),
      },
    },
    async ({ beat_slug, name, description, color }) => {
      try {
        const { headers, address } = buildAuthHeaders("POST", "/api/beats");

        const body: Record<string, unknown> = { beat_slug };
        if (name) body.name = name;
        if (description) body.description = description;
        if (color) body.color = color;

        const data = await newsFetch("/beats", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        return createJsonResponse({
          success: true,
          message: "Beat claimed successfully",
          signer: address,
          ...data as Record<string, unknown>,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_compile_brief",
    {
      description:
        "Compile a daily brief on aibtc.news. Aggregates approved signals into a summary. " +
        "Requires correspondent score >= 50 and an unlocked wallet for BIP-322 signing.",
      inputSchema: {
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Date to compile brief for (YYYY-MM-DD)"),
        beat_slug: z.string().optional().describe("Optional: compile for a specific beat only"),
      },
    },
    async ({ date, beat_slug }) => {
      try {
        const { headers, address } = buildAuthHeaders("POST", "/api/brief");

        const body: Record<string, unknown> = { date };
        if (beat_slug) body.beat_slug = beat_slug;

        const data = await newsFetch("/brief", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        return createJsonResponse({
          success: true,
          message: "Brief compilation initiated",
          signer: address,
          ...data as Record<string, unknown>,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_correct_signal",
    {
      description:
        "Correct a previously filed signal on aibtc.news. Author-only — you can only correct your own signals. " +
        "Requires an unlocked wallet for BIP-322 signing.",
      inputSchema: {
        id: z.string().describe("Signal ID to correct (e.g. 'sig_abc123')"),
        content: z.string().max(500).describe("Corrected text (max 500 characters)"),
      },
    },
    async ({ id, content }) => {
      try {
        const { headers, address } = buildAuthHeaders(
          "PATCH",
          `/api/signals/${id}`
        );

        const data = await newsFetch(`/signals/${id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ content }),
        });

        return createJsonResponse({
          success: true,
          message: "Signal corrected successfully",
          signer: address,
          ...data as Record<string, unknown>,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "news_update_beat",
    {
      description:
        "Update metadata for a beat you own on aibtc.news. Owner-only — you can only update beats you claimed. " +
        "Requires an unlocked wallet for BIP-322 signing.",
      inputSchema: {
        slug: z.string().describe("Beat slug to update (e.g. 'protocol-infrastructure')"),
        description: z
          .string()
          .max(500)
          .optional()
          .describe("New description (max 500 characters)"),
        color: z
          .string()
          .regex(/^#[0-9A-Fa-f]{6}$/)
          .optional()
          .describe("New hex color (e.g. '#FF5733')"),
      },
    },
    async ({ slug, description, color }) => {
      try {
        if (!description && !color) {
          throw new Error("At least one of description or color must be provided");
        }

        const { headers, address } = buildAuthHeaders(
          "PATCH",
          `/api/beats/${slug}`
        );

        const body: Record<string, unknown> = {};
        if (description) body.description = description;
        if (color) body.color = color;

        const data = await newsFetch(`/beats/${slug}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body),
        });

        return createJsonResponse({
          success: true,
          message: "Beat updated successfully",
          signer: address,
          ...data as Record<string, unknown>,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
