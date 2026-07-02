/**
 * AIBTC Inference Marketplace Tools
 *
 * List an OpenAI-compatible model endpoint on the marketplace and manage it, all
 * authorized by a wallet signature (the same wallet that receives sBTC payouts).
 * Ownership is proven by signing a short message with the payout wallet — no
 * accounts, no API keys. These tools sign locally with the unlocked wallet and
 * call the gateway, so an agent can register/update/check in one step.
 *
 * - inference_register_provider: verify + list an endpoint (signed)
 * - inference_update_provider:   change name/models/payout/endpoint in place (signed)
 * - inference_reveal_key:        reveal or rotate the gateway↔endpoint shared key (signed)
 * - inference_check_provider:    re-run the health/functional probe (unsigned)
 * - inference_list_providers:    list registered providers + health (unsigned)
 *
 * The gateway verifies the signature recovers to `payoutAddress` (which also
 * enforces the network), that the endpoint is reachable AND serving inference,
 * and that model ids are real, text-generation, commercially-licensed HF repos.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  signMessageHashRsv,
  privateKeyToPublic,
  compressPublicKey,
} from "@stacks/transactions";
import { hashMessage } from "@stacks/encryption";
import { bytesToHex } from "@stacks/common";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";

/** Default marketplace gateway; override with the `gateway` arg for local dev. */
const DEFAULT_GATEWAY = "https://inference.aibtc.com";

/** Bound network calls so a hung endpoint can't block the tool call forever. */
const GATEWAY_TIMEOUT_MS = 15_000;

/** Loopback hosts always allowed for local dev. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * These tools sign an ownership message with the payout wallet and may forward
 * the endpoint's own `apiKey` — both secrets. If the gateway destination were
 * free-form, a prompt-injected "use gateway https://attacker.example" could
 * redirect that signed request and leak the signature + apiKey. So the override
 * is restricted to localhost and the marketplace (`*.aibtc.com`); any other host
 * requires an explicit `allowUnsafeGateway: true`, which natural language alone
 * won't set.
 */
function isAllowedGatewayHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return true;
  return host === "aibtc.com" || host.endsWith(".aibtc.com");
}

/** Validate + normalize the gateway base URL (trailing slash stripped). */
function resolveGateway(gateway: string | undefined, allowUnsafe: boolean): string {
  const base = (gateway ?? DEFAULT_GATEWAY).replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`Invalid gateway URL: ${base}`);
  }
  if (!allowUnsafe && !isAllowedGatewayHost(url.hostname)) {
    throw new Error(
      `Gateway host "${url.hostname}" is not allowed. Wallet-signed headers and your endpoint apiKey ` +
        `are only sent to the marketplace (*.aibtc.com) or localhost. To target another host on ` +
        `purpose, pass allowUnsafeGateway: true.`
    );
  }
  return base;
}

type AuthAction = "register" | "update" | "reveal-key";

function requireUnlockedWallet() {
  const account = getWalletManager().getActiveAccount();
  if (!account) {
    throw new Error(
      "Wallet is not unlocked. Use wallet_unlock first to enable signing."
    );
  }
  return account;
}

/** The exact message the gateway rebuilds and verifies. Must match byte-for-byte. */
export function authMessage(action: AuthAction, providerId: string, timestamp: number): string {
  return `Inference Marketplace\nAction: ${action}\nProvider: ${providerId}\nTimestamp: ${timestamp}`;
}

/** Sign an auth message with the unlocked wallet and return the gateway headers. */
export function signAuthHeaders(
  account: { privateKey: string },
  action: AuthAction,
  providerId: string
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = authMessage(action, providerId, timestamp);
  const signature = signMessageHashRsv({
    messageHash: bytesToHex(hashMessage(message)),
    privateKey: account.privateKey,
  });
  const publicKey = compressPublicKey(privateKeyToPublic(account.privateKey));
  return {
    "Content-Type": "application/json",
    "X-Stacks-Signature": signature,
    "X-Stacks-Public-Key": publicKey,
    "X-Stacks-Timestamp": String(timestamp),
  };
}

async function gatewayFetch(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

const gatewayArg = z
  .string()
  .url()
  .optional()
  .describe(`Marketplace gateway base URL. Defaults to ${DEFAULT_GATEWAY}. Use http://localhost:8787 for local dev.`);

const allowUnsafeGatewayArg = z
  .boolean()
  .optional()
  .describe(
    "Allow a gateway host outside localhost / *.aibtc.com. Required to send wallet-signed headers " +
      "(and any apiKey) to an arbitrary host — leave unset unless you deliberately self-host the gateway."
  );

export function registerInferenceMarketplaceTools(server: McpServer): void {
  // Register (verify + list) an endpoint — signed
  server.registerTool(
    "inference_register_provider",
    {
      description:
        "List an OpenAI-compatible model endpoint on the AIBTC Inference Marketplace and get paid per request in sBTC. " +
        "Signs a registration message with the unlocked payout wallet (proving ownership) and POSTs it. " +
        "The gateway verifies the signature recovers to payoutAddress, that the endpoint is reachable AND actually " +
        "serving inference, and that model ids are real/commercial Hugging Face repos — then lists it. " +
        "Requires an unlocked wallet on the gateway's network.",
      inputSchema: {
        name: z.string().describe("Display name for your node, e.g. \"Alice's Qwen node\"."),
        endpoint: z
          .string()
          .url()
          .describe("OpenAI-compatible base URL, e.g. https://my-host/v1 (must expose /models and /chat/completions)."),
        models: z
          .array(z.string())
          .min(1)
          .describe("Hugging Face repo ids you serve, e.g. [\"Qwen/Qwen2.5-7B-Instruct\"]."),
        payoutAddress: z
          .string()
          .optional()
          .describe("Stacks address that receives sBTC. Defaults to the unlocked wallet's address (must match the gateway network)."),
        apiKey: z
          .string()
          .optional()
          .describe("Optional: a key your endpoint requires. Locks the endpoint so only the gateway (which presents it) can call it."),
        gateway: gatewayArg,
        allowUnsafeGateway: allowUnsafeGatewayArg,
      },
    },
    async ({ name, endpoint, models, payoutAddress, apiKey, gateway, allowUnsafeGateway }) => {
      try {
        const account = requireUnlockedWallet();
        const base = resolveGateway(gateway, allowUnsafeGateway ?? false);
        const payout = payoutAddress ?? account.address;
        const headers = signAuthHeaders(account, "register", endpoint);
        const { ok, status, body } = await gatewayFetch(`${base}/v1/providers`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name,
            endpoint,
            payoutAddress: payout,
            models,
            ...(apiKey ? { apiKey } : {}),
          }),
        });
        return createJsonResponse({
          success: ok,
          status,
          payoutAddress: payout,
          gateway: base,
          result: body,
          note: ok
            ? "Registered and verified. Your endpoint is listed and callable."
            : "Registration failed — see result.error (e.g. wrong network, endpoint unreachable, or invalid model id).",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Update a listing in place — signed
  server.registerTool(
    "inference_update_provider",
    {
      description:
        "Update your marketplace listing in place — name, models, payout address, endpoint, or description — no delete/re-add. " +
        "Signs an update message with the unlocked payout wallet and PATCHes it. Only fields you pass change. " +
        "Changing the endpoint re-verifies reachability before taking effect. Requires an unlocked wallet.",
      inputSchema: {
        providerId: z.string().describe("The provider id returned at registration (from inference_list_providers)."),
        name: z.string().optional().describe("New display name."),
        endpoint: z.string().url().optional().describe("New OpenAI-compatible base URL (re-verified before it takes effect)."),
        models: z.array(z.string()).optional().describe("New Hugging Face repo id list."),
        payoutAddress: z.string().optional().describe("New payout address (must match the gateway network)."),
        description: z.string().optional().describe("New description."),
        apiKey: z.string().optional().describe("Set/replace the key your endpoint requires (locks the endpoint)."),
        gateway: gatewayArg,
        allowUnsafeGateway: allowUnsafeGatewayArg,
      },
    },
    async ({ providerId, name, endpoint, models, payoutAddress, description, apiKey, gateway, allowUnsafeGateway }) => {
      try {
        const account = requireUnlockedWallet();
        const base = resolveGateway(gateway, allowUnsafeGateway ?? false);
        const patch: Record<string, unknown> = {};
        if (name !== undefined) patch.name = name;
        if (endpoint !== undefined) patch.endpoint = endpoint;
        if (models !== undefined) patch.models = models;
        if (payoutAddress !== undefined) patch.payoutAddress = payoutAddress;
        if (description !== undefined) patch.description = description;
        if (apiKey !== undefined) patch.apiKey = apiKey;
        if (Object.keys(patch).length === 0) {
          throw new Error("Nothing to update — pass at least one of name/endpoint/models/payoutAddress/description/apiKey.");
        }
        const headers = signAuthHeaders(account, "update", providerId);
        const { ok, status, body } = await gatewayFetch(`${base}/v1/providers/${providerId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(patch),
        });
        return createJsonResponse({
          success: ok,
          status,
          gateway: base,
          result: body,
          note: ok ? "Listing updated." : "Update failed — see result.error.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Reveal or rotate the shared key — signed
  server.registerTool(
    "inference_reveal_key",
    {
      description:
        "Reveal or rotate your provider's shared key — the gateway↔endpoint credential the gateway presents when it " +
        "calls your endpoint (NOT an ownership token; ownership is your wallet). The gateway stores it write-only, so a " +
        "wallet signature is the only way to read it back. Pass rotate=true to issue a new one. Requires an unlocked wallet.",
      inputSchema: {
        providerId: z.string().describe("The provider id (from inference_list_providers)."),
        rotate: z.boolean().optional().describe("true = generate and return a NEW key (invalidates the old one). false/omitted = reveal the current key."),
        gateway: gatewayArg,
        allowUnsafeGateway: allowUnsafeGatewayArg,
      },
    },
    async ({ providerId, rotate, gateway, allowUnsafeGateway }) => {
      try {
        const account = requireUnlockedWallet();
        const base = resolveGateway(gateway, allowUnsafeGateway ?? false);
        const headers = signAuthHeaders(account, "reveal-key", providerId);
        const { ok, status, body } = await gatewayFetch(`${base}/v1/providers/${providerId}/key`, {
          method: "POST",
          headers,
          body: JSON.stringify(rotate ? { rotate: true } : {}),
        });
        return createJsonResponse({
          success: ok,
          status,
          gateway: base,
          result: body,
          note: ok
            ? "Your endpoint must REQUIRE this key (proxy / Cloudflare Access) for it to prevent freeloading — an open endpoint ignores it."
            : "Reveal/rotate failed — see result.error.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Re-run the health/functional probe — unsigned
  server.registerTool(
    "inference_check_provider",
    {
      description:
        "Re-run the marketplace's health + functional probe for a provider on demand (checks the endpoint is reachable and " +
        "actually returns a completion). No signature required. Useful right after (re)starting your node or tunnel.",
      inputSchema: {
        providerId: z.string().describe("The provider id to check."),
        gateway: gatewayArg,
        allowUnsafeGateway: allowUnsafeGatewayArg,
      },
    },
    async ({ providerId, gateway, allowUnsafeGateway }) => {
      try {
        const base = resolveGateway(gateway, allowUnsafeGateway ?? false);
        const { ok, status, body } = await gatewayFetch(`${base}/v1/providers/${providerId}/check`, {
          method: "POST",
        });
        return createJsonResponse({ success: ok, status, gateway: base, result: body });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // List registered providers — unsigned
  server.registerTool(
    "inference_list_providers",
    {
      description:
        "List providers registered on the marketplace with their models, health/status, and flagged state. No signature " +
        "required. Use it to find your provider id (match on payoutAddress) after registering.",
      inputSchema: {
        gateway: gatewayArg,
        allowUnsafeGateway: allowUnsafeGatewayArg,
      },
    },
    async ({ gateway, allowUnsafeGateway }) => {
      try {
        const base = resolveGateway(gateway, allowUnsafeGateway ?? false);
        const { ok, status, body } = await gatewayFetch(`${base}/v1/providers`, { method: "GET" });
        return createJsonResponse({ success: ok, status, gateway: base, result: body });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
