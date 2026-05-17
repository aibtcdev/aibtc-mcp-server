import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount } from "../services/x402.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  buildNativeBountyMessage,
  buildNativeBountyUrl,
  buildNativeBountySignedFields,
  fetchNativeBountyJson,
  fetchNativeBountyUrl,
  type NativeBountyAccount,
  type NativeBountyStatus,
} from "../services/native-bounty.service.js";

function assertNativeBountyAccount(account: unknown): NativeBountyAccount {
  const candidate = account as Partial<NativeBountyAccount>;
  if (!candidate.btcAddress || !candidate.btcPrivateKey || !candidate.btcPublicKey) {
    throw new Error("Bitcoin keys not available. Unlock a wallet with BTC key derivation to use signed native bounty tools.");
  }
  return candidate as NativeBountyAccount;
}

function tagsToArray(tags?: string): string[] {
  if (!tags) return [];
  return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
}

async function signedNativePost(path: string, message: string, signedAt: string, payload: Record<string, unknown>) {
  const account = assertNativeBountyAccount(await getAccount());
  const signedFields = buildNativeBountySignedFields(message, signedAt, account);
  return fetchNativeBountyJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, ...signedFields }),
  });
}

export function registerNativeBountyTools(server: McpServer): void {
  server.registerTool(
    "bounty_list_native",
    {
      description: `List native AIBTC bounties from https://aibtc.com/api/bounties.

Read-only. Supports active/open/judging/winner-announced/paid/abandoned/cancelled status filters plus poster, submitter, tag, limit, and offset.`,
      inputSchema: {
        status: z.enum(["open", "judging", "winner-announced", "paid", "abandoned", "cancelled", "active"]).optional(),
        poster: z.string().optional().describe("Poster BTC address"),
        submitter: z.string().optional().describe("Submitter BTC address"),
        tag: z.string().optional().describe("Tag filter"),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ status, poster, submitter, tag, limit, offset }) => {
      try {
        const url = buildNativeBountyUrl("/api/bounties", {
          status: status as NativeBountyStatus | undefined,
          poster,
          submitter,
          tag,
          limit,
          offset,
        });
        return createJsonResponse(await fetchNativeBountyUrl(url));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_get_native",
    {
      description: "Get native AIBTC bounty detail by ID. Read-only.",
      inputSchema: { id: z.string().min(1).describe("Native bounty ID") },
    },
    async ({ id }) => {
      try {
        return createJsonResponse(await fetchNativeBountyJson(`/api/bounties/${encodeURIComponent(id)}`));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_submissions_native",
    {
      description: "List submissions for a native AIBTC bounty. Read-only.",
      inputSchema: {
        id: z.string().min(1).describe("Native bounty ID"),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ id, limit, offset }) => {
      try {
        const url = buildNativeBountyUrl(`/api/bounties/${encodeURIComponent(id)}/submissions`, { limit, offset });
        return createJsonResponse(await fetchNativeBountyUrl(url));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_submission_native",
    {
      description: "Get a single native AIBTC bounty submission permalink. Read-only.",
      inputSchema: {
        id: z.string().min(1).describe("Native bounty ID"),
        submission_id: z.string().min(1).describe("Submission ID"),
      },
    },
    async ({ id, submission_id }) => {
      try {
        return createJsonResponse(await fetchNativeBountyJson(`/api/bounties/${encodeURIComponent(id)}/submissions/${encodeURIComponent(submission_id)}`));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_my_submissions",
    {
      description: "List native AIBTC bounties the current or provided BTC address submitted to, with up to 50 results by default. Read-only convenience view.",
      inputSchema: {
        btc_address: z.string().optional().describe("BTC address. Omit to use the unlocked wallet's BTC address."),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ btc_address, limit, offset }) => {
      try {
        let submitter = btc_address;
        if (!submitter) {
          const account = assertNativeBountyAccount(await getAccount());
          submitter = account.btcAddress;
        }
        const url = buildNativeBountyUrl("/api/bounties", { submitter, limit: limit ?? 50, offset: offset ?? 0 });
        return createJsonResponse(await fetchNativeBountyUrl(url));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_my_posted",
    {
      description: "List native AIBTC bounties the current or provided BTC address posted, with up to 50 results by default. Read-only convenience view.",
      inputSchema: {
        btc_address: z.string().optional().describe("BTC address. Omit to use the unlocked wallet's BTC address."),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
    },
    async ({ btc_address, limit, offset }) => {
      try {
        let poster = btc_address;
        if (!poster) {
          const account = assertNativeBountyAccount(await getAccount());
          poster = account.btcAddress;
        }
        const url = buildNativeBountyUrl("/api/bounties", { poster, limit: limit ?? 50, offset: offset ?? 0 });
        return createJsonResponse(await fetchNativeBountyUrl(url));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_create_native",
    {
      description: "Create a native AIBTC bounty. Signed POST; requires an unlocked Genesis-level AIBTC wallet.",
      inputSchema: {
        title: z.string().min(1),
        description: z.string().min(1),
        reward_sats: z.number().int().positive(),
        expires_at: z.string().min(1).describe("ISO 8601 expiry timestamp"),
        tags: z.string().optional().describe("Comma-separated tags"),
      },
    },
    async ({ title, description, reward_sats, expires_at, tags }) => {
      try {
        const account = assertNativeBountyAccount(await getAccount());
        const tagList = tagsToArray(tags);
        const signedAt = new Date().toISOString();
        const message = buildNativeBountyMessage("create", {
          posterBtc: account.btcAddress,
          title,
          description,
          rewardSats: reward_sats,
          expiresAt: expires_at,
          tags: tagList,
          signedAt,
        });
        const signedFields = buildNativeBountySignedFields(message, signedAt, account);
        const data = await fetchNativeBountyJson("/api/bounties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posterBtcAddress: account.btcAddress,
            title,
            description,
            rewardSats: reward_sats,
            expiresAt: expires_at,
            tags: tagList,
            ...signedFields,
          }),
        });
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_submit_native",
    {
      description: "Submit work to a native AIBTC bounty. Signed POST; requires an unlocked Registered-level AIBTC wallet.",
      inputSchema: {
        bounty_id: z.string().min(1),
        message: z.string().min(1),
        content_url: z.string().optional(),
      },
    },
    async ({ bounty_id, message, content_url }) => {
      try {
        const account = assertNativeBountyAccount(await getAccount());
        const signedAt = new Date().toISOString();
        const signedMessage = buildNativeBountyMessage("submit", {
          bountyId: bounty_id,
          submitterBtc: account.btcAddress,
          message,
          contentUrl: content_url,
          signedAt,
        });
        const signedFields = buildNativeBountySignedFields(signedMessage, signedAt, account);
        const data = await fetchNativeBountyJson(`/api/bounties/${encodeURIComponent(bounty_id)}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submitterBtcAddress: account.btcAddress,
            message,
            contentUrl: content_url ?? "",
            ...signedFields,
          }),
        });
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_accept_native",
    {
      description: "Accept a native AIBTC bounty submission. Signed POST; poster only.",
      inputSchema: { bounty_id: z.string().min(1), submission_id: z.string().min(1) },
    },
    async ({ bounty_id, submission_id }) => {
      try {
        const signedAt = new Date().toISOString();
        const message = buildNativeBountyMessage("accept", { bountyId: bounty_id, submissionId: submission_id, signedAt });
        return createJsonResponse(await signedNativePost(`/api/bounties/${encodeURIComponent(bounty_id)}/accept`, message, signedAt, { submissionId: submission_id }));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_paid_native",
    {
      description: "Mark a native AIBTC bounty paid with a confirmed sBTC txid. Signed POST; poster only.",
      inputSchema: { bounty_id: z.string().min(1), txid: z.string().min(1) },
    },
    async ({ bounty_id, txid }) => {
      try {
        const signedAt = new Date().toISOString();
        const message = buildNativeBountyMessage("paid", { bountyId: bounty_id, txid, signedAt });
        return createJsonResponse(await signedNativePost(`/api/bounties/${encodeURIComponent(bounty_id)}/paid`, message, signedAt, { txid }));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "bounty_cancel_native",
    {
      description: "Cancel a native AIBTC bounty before acceptance. Signed POST; poster only.",
      inputSchema: { bounty_id: z.string().min(1) },
    },
    async ({ bounty_id }) => {
      try {
        const signedAt = new Date().toISOString();
        const message = buildNativeBountyMessage("cancel", { bountyId: bounty_id, signedAt });
        return createJsonResponse(await signedNativePost(`/api/bounties/${encodeURIComponent(bounty_id)}/cancel`, message, signedAt, {}));
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
