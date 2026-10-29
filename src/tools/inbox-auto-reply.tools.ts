/**
 * Inbox auto-reply tools.
 *
 * - inbox_auto_reply_configure: store enabled / model / systemPrompt / dailyCapSats /
 *   maxSatsPerReply in ~/.aibtc/config.json (no args = show the current settings)
 * - inbox_auto_reply: answer paid, unanswered inbox messages with a reply
 *   written by an AIBTC Inference Marketplace model (x402, sBTC), then sign and
 *   post it to the outbox. Built to be called from an agent's autonomy loop.
 *
 * The run logic, ledger and safety rules live in services/inbox-auto-reply.service.ts.
 */

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getAccount, NETWORK } from "../services/x402.service.js";
import {
  DEFAULT_AUTO_REPLY_MODEL,
  DEFAULT_DAILY_CAP_SATS,
  DEFAULT_MAX_REPLIES_PER_RUN,
  DEFAULT_MAX_SATS_PER_REPLY,
  listLiveModels,
  marketplaceReplyGenerator,
  runAutoReply,
} from "../services/inbox-auto-reply.service.js";
import { readAppConfig, writeAppConfig, type AppConfig } from "../utils/storage.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

type StoredConfig = NonNullable<AppConfig["inboxAutoReply"]>;

/**
 * The stored sat limits, defaulted and checked. The config file is plain JSON
 * (shared with the skills CLI), so a missing or hand-edited value must not
 * turn into "no limit" at run time.
 */
function autoReplyLimits(config: StoredConfig): { dailyCapSats: number; maxSatsPerReply: number } {
  const limit = (name: string, value: unknown, fallback: number): number => {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      throw new Error(
        `inboxAutoReply.${name} in ~/.aibtc/config.json must be a non-negative integer, got ${JSON.stringify(value)}. ` +
          `Fix it with inbox_auto_reply_configure { ${name}: <sats> }.`
      );
    }
    return value;
  };
  return {
    dailyCapSats: limit("dailyCapSats", config.dailyCapSats, DEFAULT_DAILY_CAP_SATS),
    maxSatsPerReply: limit("maxSatsPerReply", config.maxSatsPerReply, DEFAULT_MAX_SATS_PER_REPLY),
  };
}

function requireMainnet(): void {
  if (NETWORK !== "mainnet") {
    throw new Error(
      "Inbox auto-reply is mainnet only: the aibtc.com inbox and the inference marketplace settle in mainnet sBTC. Set NETWORK=mainnet."
    );
  }
}

export function registerInboxAutoReplyTools(server: McpServer): void {
  server.registerTool(
    "inbox_auto_reply_configure",
    {
      description:
        "Configure inbox auto-reply (stored in ~/.aibtc/config.json). Call with no arguments to see the current " +
        "settings. A systemPrompt (the agent's voice / personality / what it can help with) is required before " +
        "auto-reply can be enabled. The model must be live on inference.aibtc.com; it is checked against the " +
        "catalog when set. dailyCapSats caps sats spent on reply inference per UTC day, on top of the wallet-wide " +
        "spending limit. maxSatsPerReply is the most one reply may cost; a higher quote stops the run unpaid.",
      inputSchema: z.object({
        enabled: z.boolean().optional().describe("Allow inbox_auto_reply to post replies. Dry runs work while disabled."),
        model: z
          .string()
          .optional()
          .describe(`Inference marketplace model id (see GET https://inference.aibtc.com/v1/models). Default ${DEFAULT_AUTO_REPLY_MODEL}.`),
        systemPrompt: z
          .string()
          .min(1)
          .max(4000)
          .optional()
          .describe("System prompt for reply generation: who the agent is, its tone, what it offers, what it won't do."),
        dailyCapSats: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(`Most sats spent on reply inference per UTC day. Default ${DEFAULT_DAILY_CAP_SATS}.`),
        maxSatsPerReply: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(`Most sats paid for one reply. Default ${DEFAULT_MAX_SATS_PER_REPLY}.`),
      }),
    },
    async ({ enabled, model, systemPrompt, dailyCapSats, maxSatsPerReply }) => {
      try {
        const config = await readAppConfig();
        const current = config.inboxAutoReply;
        if (
          enabled === undefined &&
          model === undefined &&
          systemPrompt === undefined &&
          dailyCapSats === undefined &&
          maxSatsPerReply === undefined
        ) {
          return createJsonResponse({
            configured: Boolean(current),
            settings: current ?? null,
            ...(!current && {
              note: "Not configured. Set at least systemPrompt, then enabled: true.",
            }),
          });
        }

        if (model !== undefined) {
          const live = await listLiveModels();
          if (!live.includes(model)) {
            throw new Error(`Model "${model}" is not live on the inference marketplace. Live models: ${live.join(", ")}`);
          }
        }

        const next: StoredConfig = {
          enabled: enabled ?? current?.enabled ?? false,
          model: model ?? current?.model ?? DEFAULT_AUTO_REPLY_MODEL,
          systemPrompt: systemPrompt ?? current?.systemPrompt ?? "",
          dailyCapSats: dailyCapSats ?? current?.dailyCapSats ?? DEFAULT_DAILY_CAP_SATS,
          maxSatsPerReply: maxSatsPerReply ?? current?.maxSatsPerReply ?? DEFAULT_MAX_SATS_PER_REPLY,
        };
        if (next.enabled && !next.systemPrompt) {
          throw new Error("Set a systemPrompt before enabling auto-reply.");
        }

        await writeAppConfig({ ...config, inboxAutoReply: next });
        return createJsonResponse({ success: true, settings: next });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "inbox_auto_reply",
    {
      description:
        "Answer this agent's paid aibtc.com inbox messages automatically. In one call: reads the inbox, picks paid, " +
        "settled, unanswered messages (oldest first), writes each reply with an AIBTC Inference Marketplace model " +
        "(paid per request in sBTC via x402, ~1 sat), signs it (BIP-322) and posts it to the outbox (free). " +
        "Never answers a message twice (overlapping runs skip a message another run is answering), stops at the " +
        "daily cap or on a quote above maxSatsPerReply, gives up on a message after 2 paid failures, and returns a summary: checked, replied, " +
        "skipped (with reason), failed, inference sats spent and inference cap remaining.\n\n" +
        "Posting a reply is free; the only cost is the inference call that writes it. " +
        "Call it from the autonomy loop when the heartbeat or inbox shows unread messages. Configure first with " +
        "inbox_auto_reply_configure. dryRun writes (and pays for) replies without posting them, so the operator " +
        "can review the voice; each draft is saved and reused by later dry runs and the real run while the " +
        "systemPrompt and model are unchanged. Requires an unlocked wallet with a bc1q address and a little sBTC. Mainnet only.",
      inputSchema: z.object({
        maxRepliesPerRun: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe(`Most messages to answer in this call. Default ${DEFAULT_MAX_REPLIES_PER_RUN}.`),
        dryRun: z
          .boolean()
          .optional()
          .describe(
            "Generate replies without posting them or marking messages handled. A new draft is paid for once; " +
              "a saved draft with the same systemPrompt and model is reused free, here and by the real run."
          ),
      }),
    },
    async ({ maxRepliesPerRun, dryRun }) => {
      try {
        requireMainnet();
        const config = (await readAppConfig()).inboxAutoReply;
        if (!config?.systemPrompt) {
          throw new Error("Inbox auto-reply is not configured. Call inbox_auto_reply_configure with a systemPrompt first.");
        }
        const isDryRun = dryRun ?? false;
        if (!config.enabled && !isDryRun) {
          throw new Error(
            "Inbox auto-reply is disabled. Enable it with inbox_auto_reply_configure { enabled: true }, or pass dryRun: true to preview replies."
          );
        }

        const limits = autoReplyLimits(config);
        const account = await getAccount();
        const summary = await runAutoReply({
          account,
          systemPrompt: config.systemPrompt,
          ...limits,
          maxRepliesPerRun: maxRepliesPerRun ?? DEFAULT_MAX_REPLIES_PER_RUN,
          dryRun: isDryRun,
          generator: marketplaceReplyGenerator(config.model),
        });

        return createJsonResponse({
          success: summary.failed.length === 0,
          dryRun: isDryRun,
          model: config.model,
          ...summary,
          repliedCount: summary.replied.length,
          skippedCount: summary.skipped.length,
          failedCount: summary.failed.length,
          ...limits,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
