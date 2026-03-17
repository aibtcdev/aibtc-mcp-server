/**
 * Ordinals Marketplace Tools
 *
 * MCP tools for buying, selling, and browsing ordinals/inscriptions on
 * the Magic Eden marketplace (api-mainnet.magiceden.dev).
 *
 * Tools:
 * - ordinals_get_listings:          Browse inscriptions listed for sale (no wallet required)
 * - ordinals_list_for_sale:         List a wallet inscription for sale via ME PSBT flow
 * - ordinals_list_for_sale_submit:  Submit the signed listing PSBT to finalize a listing
 * - ordinals_buy:                   Buy a listed inscription — returns PSBT to sign + broadcast
 * - ordinals_cancel_listing:        Cancel an active Magic Eden listing
 *
 * Read operations use the public Magic Eden API (unauthenticated).
 * Write operations use the ME PSBT-based listing flow which requires wallet unlock.
 *
 * Magic Eden API docs: https://api-mainnet.magiceden.dev/swagger
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ME_BASE = "https://api-mainnet.magiceden.dev/v2/ord/btc";
const ME_API_KEY = process.env.MAGIC_EDEN_API_KEY ?? "";

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function meGet(path: string): Promise<unknown> {
  const url = `${ME_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "aibtc-mcp-server/1.0",
      ...(ME_API_KEY ? { Authorization: `Bearer ${ME_API_KEY}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Magic Eden API ${res.status}: ${body}`);
  }
  return res.json();
}

async function mePost(path: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `${ME_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "aibtc-mcp-server/1.0",
      ...(ME_API_KEY ? { Authorization: `Bearer ${ME_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let message: string;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      message = String(parsed.message ?? text);
    } catch {
      message = text;
    }
    throw new Error(`Magic Eden API ${res.status}: ${message}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerOrdinalsMarketplaceTools(server: McpServer): void {
  // ==========================================================================
  // ordinals_get_listings — public read, no wallet required
  // ==========================================================================

  server.registerTool(
    "ordinals_get_listings",
    {
      description: `Browse ordinals/inscriptions listed for sale on Magic Eden.

Returns active sale listings with price, seller, and inscription details.
Supports filtering by collection symbol and price range. No wallet required.

Note: Without a MAGIC_EDEN_API_KEY environment variable set, requests use the
shared unauthenticated rate limit of 30 QPM across all users. Set MAGIC_EDEN_API_KEY
to use an authenticated rate limit.

Examples:
- Browse all listings: ordinals_get_listings {}
- Filter by collection: ordinals_get_listings { collection: "nodemonkes" }
- Price range: ordinals_get_listings { minPriceSats: 100000, maxPriceSats: 1000000 }`,
      inputSchema: {
        collection: z
          .string()
          .optional()
          .describe("Magic Eden collection symbol to filter by (e.g. 'nodemonkes', 'bitcoin-puppets')"),
        minPriceSats: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe("Minimum listing price in satoshis"),
        maxPriceSats: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum listing price in satoshis"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .default(20)
          .describe("Number of results to return (default 20, max 100)"),
        offset: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .default(0)
          .describe("Pagination offset (default 0)"),
        sortBy: z
          .enum(["priceAsc", "priceDesc", "recentlyListed"])
          .optional()
          .default("recentlyListed")
          .describe("Sort order: priceAsc, priceDesc, or recentlyListed (default)"),
      },
    },
    async ({ collection, minPriceSats, maxPriceSats, limit, offset, sortBy }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            note: "Magic Eden ordinals marketplace is only available on mainnet.",
            network: NETWORK,
            listings: [],
          });
        }

        const params = new URLSearchParams();
        params.set("limit", String(limit ?? 20));
        params.set("offset", String(offset ?? 0));
        params.set("sortBy", sortBy ?? "recentlyListed");
        if (collection) params.set("collectionSymbol", collection);
        if (minPriceSats !== undefined) params.set("minPrice", String(minPriceSats));
        if (maxPriceSats !== undefined) params.set("maxPrice", String(maxPriceSats));

        const data = await meGet(`/tokens?${params}`);
        const tokens = (data as Record<string, unknown>).tokens ?? data;

        return createJsonResponse({
          source: "magic_eden",
          network: NETWORK,
          filters: {
            collection: collection ?? null,
            minPriceSats: minPriceSats ?? null,
            maxPriceSats: maxPriceSats ?? null,
            sortBy: sortBy ?? "recentlyListed",
          },
          limit: limit ?? 20,
          offset: offset ?? 0,
          listings: tokens,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_list_for_sale — requires wallet (ME PSBT listing)
  // ==========================================================================

  server.registerTool(
    "ordinals_list_for_sale",
    {
      description: `List a wallet inscription for sale on Magic Eden.

Requests a PSBT-based listing transaction from the Magic Eden API.
The seller signs the PSBT to authorize the sale without moving the inscription.
Requires an unlocked wallet with Bitcoin (Taproot) keys.

Steps:
1. Call this tool with inscriptionId and priceSats
2. Sign the returned PSBT using psbt_sign
3. Submit the signed PSBT back to Magic Eden to complete the listing

Note: The inscription must be in the wallet's Taproot (P2TR) address.`,
      inputSchema: {
        inscriptionId: z
          .string()
          .describe("Inscription ID in txid+index format, e.g. abc123...i0"),
        priceSats: z
          .number()
          .int()
          .positive()
          .describe("Listing price in satoshis"),
        receiverAddress: z
          .string()
          .optional()
          .describe("BTC address to receive payment (defaults to wallet's Taproot address)"),
      },
    },
    async ({ inscriptionId, priceSats, receiverAddress }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createErrorResponse(
            new Error("Magic Eden ordinals marketplace listing is only available on mainnet.")
          );
        }

        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("Wallet is not unlocked. Use wallet_unlock first.");
        }
        if (!account.taprootAddress) {
          throw new Error("Taproot address not available. Unlock your wallet first.");
        }

        const sellerAddress = receiverAddress ?? account.taprootAddress;

        // Request a listing PSBT from Magic Eden
        const listingRequest = await mePost("/instructions/sell", {
          inscriptionId,
          price: priceSats,
          sellerReceiveAddress: sellerAddress,
          sellerOrdAddress: account.taprootAddress,
        });

        const result = listingRequest as Record<string, unknown>;

        return createJsonResponse({
          status: "psbt_ready",
          message:
            "Magic Eden listing PSBT generated. Sign the PSBT using psbt_sign, then call " +
            "ordinals_list_for_sale_submit with the signed PSBT to finalize your listing.",
          inscriptionId,
          priceSats,
          sellerAddress,
          psbtBase64: result.psbtBase64 ?? result.psbt ?? null,
          raw: result,
          nextStep:
            "Use psbt_sign to sign the psbtBase64, then submit the signed PSBT to finalize listing.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_list_for_sale_submit — requires signed PSBT from ordinals_list_for_sale
  // ==========================================================================

  server.registerTool(
    "ordinals_list_for_sale_submit",
    {
      description: `Submit a signed listing PSBT to Magic Eden to finalize an ordinal listing.

Call this after signing the PSBT returned by ordinals_list_for_sale.
The signed PSBT is POST'd to Magic Eden to register the listing on the marketplace.

Steps:
1. Call ordinals_list_for_sale to get a listing PSBT
2. Sign the PSBT using psbt_sign
3. Call this tool with the signed PSBT to publish the listing`,
      inputSchema: {
        inscriptionId: z
          .string()
          .describe("The inscription ID being listed"),
        signedPsbt: z
          .string()
          .describe("The signed PSBT in base64 format returned by psbt_sign"),
      },
    },
    async ({ inscriptionId, signedPsbt }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createErrorResponse(
            new Error("Magic Eden ordinals marketplace listing is only available on mainnet.")
          );
        }

        const result = await mePost("/instructions/sell/submit", {
          signedPsbt,
          inscriptionId,
        });
        return createJsonResponse({ status: "listed", result });
      } catch (err) {
        return createErrorResponse(
          `Failed to submit listing: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  );

  // ==========================================================================
  // ordinals_buy — requires wallet (ME PSBT buy flow)
  // ==========================================================================

  server.registerTool(
    "ordinals_buy",
    {
      description: `Buy a listed inscription from Magic Eden.

Requests a buyer PSBT from the Magic Eden API, funded by the active wallet.
Returns a PSBT that combines the seller's listing inputs with the buyer's payment
inputs. The buyer signs the PSBT then broadcasts it to complete the purchase.

Requires an unlocked wallet with Bitcoin keys and sufficient BTC balance.

Steps:
1. Call ordinals_get_listings to find an inscription and its price
2. Call ordinals_buy with the inscriptionId and desired buyer address
3. Sign the returned PSBT using psbt_sign
4. Broadcast using psbt_broadcast`,
      inputSchema: {
        inscriptionId: z
          .string()
          .describe("Inscription ID to purchase, e.g. abc123...i0"),
        buyerAddress: z
          .string()
          .optional()
          .describe(
            "BTC address to receive the inscription (defaults to wallet's Taproot address)"
          ),
        buyerPaymentAddress: z
          .string()
          .optional()
          .describe(
            "BTC address to fund the purchase (defaults to wallet's SegWit address)"
          ),
        feeRate: z
          .number()
          .positive()
          .optional()
          .describe("Fee rate in sat/vB (optional, uses network default if omitted)"),
      },
    },
    async ({ inscriptionId, buyerAddress, buyerPaymentAddress, feeRate }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createErrorResponse(
            new Error("Magic Eden ordinals marketplace is only available on mainnet.")
          );
        }

        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("Wallet is not unlocked. Use wallet_unlock first.");
        }
        if (!account.taprootAddress) {
          throw new Error("Taproot address not available. Unlock your wallet first.");
        }
        if (!account.btcAddress) {
          throw new Error("Bitcoin SegWit address not available. Unlock your wallet first.");
        }

        const receiveAddress = buyerAddress ?? account.taprootAddress;
        const paymentAddress = buyerPaymentAddress ?? account.btcAddress;

        // Fetch token info (including active listing) from ME
        const tokenInfo = await meGet(`/tokens/${inscriptionId}`) as Record<string, unknown>;

        if (!tokenInfo.listed && !(tokenInfo.listedPrice ?? tokenInfo.price)) {
          return createJsonResponse({
            status: "not_listed",
            message: `Inscription ${inscriptionId} does not appear to be listed for sale on Magic Eden.`,
            inscriptionId,
            tokenInfo,
          });
        }

        const priceSats = Number(tokenInfo.listedPrice ?? tokenInfo.price);

        // Request a buy PSBT from Magic Eden
        const buyRequest = await mePost("/instructions/buy", {
          price: priceSats,
          tokenId: inscriptionId,
          buyerAddress: receiveAddress,
          buyerTokenReceiveAddress: receiveAddress,
          feeRateTier: feeRate ? undefined : "halfHourFee",
          feeRate: feeRate,
          buyerPaymentAddress: paymentAddress,
          buyerPaymentPublicKey: account.btcPublicKey ? Buffer.from(account.btcPublicKey).toString("hex") : undefined,
        });

        const result = buyRequest as Record<string, unknown>;

        return createJsonResponse({
          status: "psbt_ready",
          message:
            "Magic Eden buy PSBT generated. Sign the PSBT using psbt_sign, then broadcast " +
            "using psbt_broadcast to complete the purchase.",
          inscriptionId,
          priceSats,
          buyerReceiveAddress: receiveAddress,
          buyerPaymentAddress: paymentAddress,
          psbtBase64: result.psbtBase64 ?? result.psbt ?? null,
          raw: result,
          nextStep:
            "Use psbt_sign to sign the psbtBase64, then use psbt_broadcast to send the transaction.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_cancel_listing — requires wallet (ME PSBT cancel flow)
  // ==========================================================================

  server.registerTool(
    "ordinals_cancel_listing",
    {
      description: `Cancel an active Magic Eden listing for an inscription.

Requests a cancellation PSBT from Magic Eden. The seller signs the PSBT to
invalidate the active listing and reclaim the inscription UTXO. No BTC fee
is required beyond the miner fee for the cancellation transaction itself.

Requires an unlocked wallet with Bitcoin (Taproot) keys.

Steps:
1. Call this tool with the inscriptionId you want to delist
2. Sign the returned PSBT using psbt_sign
3. Broadcast using psbt_broadcast to finalize the cancellation`,
      inputSchema: {
        inscriptionId: z
          .string()
          .describe("Inscription ID of the active listing to cancel, e.g. abc123...i0"),
        sellerAddress: z
          .string()
          .optional()
          .describe(
            "BTC Taproot address that owns the listing (defaults to wallet's Taproot address)"
          ),
      },
    },
    async ({ inscriptionId, sellerAddress }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createErrorResponse(
            new Error("Magic Eden ordinals marketplace is only available on mainnet.")
          );
        }

        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("Wallet is not unlocked. Use wallet_unlock first.");
        }
        if (!account.taprootAddress) {
          throw new Error("Taproot address not available. Unlock your wallet first.");
        }

        const ownerAddress = sellerAddress ?? account.taprootAddress;

        // Request a cancel listing PSBT from Magic Eden
        const cancelRequest = await mePost("/instructions/cancel", {
          inscriptionId,
          sellerOrdAddress: ownerAddress,
        });

        const result = cancelRequest as Record<string, unknown>;

        return createJsonResponse({
          status: "psbt_ready",
          message:
            "Magic Eden cancellation PSBT generated. Sign the PSBT using psbt_sign, then " +
            "broadcast using psbt_broadcast to finalize the cancellation.",
          inscriptionId,
          sellerAddress: ownerAddress,
          psbtBase64: result.psbtBase64 ?? result.psbt ?? null,
          raw: result,
          nextStep:
            "Use psbt_sign to sign the psbtBase64, then use psbt_broadcast to send the cancellation transaction.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
