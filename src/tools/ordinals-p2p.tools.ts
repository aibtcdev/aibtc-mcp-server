/**
 * Ordinals P2P Trading Tools
 *
 * MCP tools for peer-to-peer ordinals trading via the public trade ledger at ledger.drx4.xyz.
 * Supports listing trades, creating offers, countering, transferring, cancelling, and
 * recording PSBT atomic swaps. All write operations are authenticated with BIP-137 signatures.
 *
 * Tools:
 * - ordinals_p2p_list_trades: Browse trade ledger with optional filters
 * - ordinals_p2p_get_trade:   Fetch full details for a single trade
 * - ordinals_p2p_my_trades:   List trades for the active wallet's BTC address
 * - ordinals_p2p_agents:      List active agents on the ledger
 * - ordinals_p2p_create_offer: Post a new inscription offer (BIP-137 signed)
 * - ordinals_p2p_counter:      Counter an existing offer (BIP-137 signed)
 * - ordinals_p2p_transfer:     Record a completed transfer (BIP-137 signed)
 * - ordinals_p2p_cancel:       Cancel an open offer or counter (BIP-137 signed)
 * - ordinals_p2p_psbt_swap:    Record a completed PSBT atomic swap (BIP-137 signed)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha256";
import { hexToBytes } from "@noble/hashes/utils";
import { NETWORK } from "../config/networks.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LEDGER_BASE =
  NETWORK === "testnet"
    ? "https://ledger-test.drx4.xyz"
    : "https://ledger.drx4.xyz";

const BITCOIN_MSG_PREFIX = "\x18Bitcoin Signed Message:\n";

// BIP-137 header bytes by address type
const BIP137_HEADER_BASE = {
  P2PKH_COMPRESSED: 31,
  P2SH_P2WPKH: 35,
  P2WPKH: 39,
} as const;

// ---------------------------------------------------------------------------
// BIP-137 signing helpers
// ---------------------------------------------------------------------------

function encodeVarInt(n: number): Uint8Array {
  if (n < 0xfd) return new Uint8Array([n]);
  if (n <= 0xffff) {
    const b = new Uint8Array(3);
    b[0] = 0xfd;
    b[1] = n & 0xff;
    b[2] = (n >> 8) & 0xff;
    return b;
  }
  throw new Error(`VarInt too large: ${n}`);
}

function formatBitcoinMessage(message: string): Uint8Array {
  const prefixBytes = new TextEncoder().encode(BITCOIN_MSG_PREFIX);
  const messageBytes = new TextEncoder().encode(message);
  const lengthBytes = encodeVarInt(messageBytes.length);
  const result = new Uint8Array(
    prefixBytes.length + lengthBytes.length + messageBytes.length
  );
  result.set(prefixBytes, 0);
  result.set(lengthBytes, prefixBytes.length);
  result.set(messageBytes, prefixBytes.length + lengthBytes.length);
  return result;
}

function doubleSha256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

function ensureBytes(key: Uint8Array | string): Uint8Array {
  if (typeof key === "string") return hexToBytes(key);
  return key;
}

/**
 * Sign a message with BIP-137 and return a base64-encoded signature.
 * The header byte encodes both the address type and the recovery ID.
 *
 * Uses `format: "recovered"` which returns a flat 65-byte Uint8Array:
 *   [recoveryId (1 byte), r (32 bytes), s (32 bytes)]
 */
function signBip137(
  message: string,
  privateKey: Uint8Array,
  btcAddress: string
): string {
  const formatted = formatBitcoinMessage(message);
  const msgHash = doubleSha256(formatted);

  // format: "recovered" returns Uint8Array [recoveryId, r(32), s(32)]
  const sigWithRecovery = secp256k1.sign(msgHash, privateKey, {
    prehash: false,
    lowS: true,
    format: "recovered",
  });

  const recoveryId = sigWithRecovery[0];
  const rBytes = sigWithRecovery.slice(1, 33);
  const sBytes = sigWithRecovery.slice(33, 65);

  const prefix = btcAddress[0];
  let headerBase: number;
  if (prefix === "1" || prefix === "m" || prefix === "n") {
    headerBase = BIP137_HEADER_BASE.P2PKH_COMPRESSED;
  } else if (prefix === "3" || prefix === "2") {
    headerBase = BIP137_HEADER_BASE.P2SH_P2WPKH;
  } else {
    // bc1q (P2WPKH) or bc1p (P2TR) — both use the P2WPKH header per BIP-137 convention
    headerBase = BIP137_HEADER_BASE.P2WPKH;
  }

  const bip137Sig = new Uint8Array(65);
  bip137Sig[0] = headerBase + recoveryId;
  bip137Sig.set(rBytes, 1);
  bip137Sig.set(sBytes, 33);

  return Buffer.from(bip137Sig).toString("base64");
}

// ---------------------------------------------------------------------------
// Ledger API helpers
// ---------------------------------------------------------------------------

async function ledgerGet(path: string): Promise<unknown> {
  const res = await fetch(`${LEDGER_BASE}${path}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ledger API ${res.status}: ${body}`);
  }
  return res.json();
}

async function ledgerPost(
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${LEDGER_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Ledger API ${res.status}: ${(data as Record<string, unknown>).error ?? JSON.stringify(data)}`
    );
  }
  return data;
}

// ---------------------------------------------------------------------------
// Wallet helpers
// ---------------------------------------------------------------------------

interface SignedAccount {
  btcAddress: string;
  address: string;
  btcPrivateKey: Uint8Array;
}

function getSignedAccount(): SignedAccount {
  const walletManager = getWalletManager();
  const account = walletManager.getActiveAccount();
  if (!account) throw new Error("Wallet is not unlocked. Use wallet_unlock first.");
  if (!account.btcAddress || !account.btcPrivateKey) {
    throw new Error("Bitcoin keys not available. Unlock your wallet first.");
  }
  return {
    btcAddress: account.btcAddress,
    address: account.address,
    btcPrivateKey: ensureBytes(account.btcPrivateKey as Uint8Array | string),
  };
}

/**
 * Build the authentication fields required for all ledger write operations.
 * Message format: "ordinals-ledger | <type> | <btcAddress> | <inscriptionId> | <timestamp>"
 */
function buildAuthFields(
  type: string,
  inscriptionId: string,
  account: SignedAccount
): {
  from_agent: string;
  from_stx_address: string;
  signature: string;
  timestamp: string;
} {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
  const message = `ordinals-ledger | ${type} | ${account.btcAddress} | ${inscriptionId} | ${timestamp}`;
  const signature = signBip137(message, account.btcPrivateKey, account.btcAddress);
  return {
    from_agent: account.btcAddress,
    from_stx_address: account.address,
    signature,
    timestamp,
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerOrdinalsP2PTools(server: McpServer): void {
  // ==========================================================================
  // ordinals_p2p_list_trades — public read
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_list_trades",
    {
      description: `Browse the public ordinals P2P trade ledger at ledger.drx4.xyz.

Returns a paginated list of trades with optional filters. Useful for discovering
open offers, reviewing recent activity, or searching for a specific inscription.

No wallet required.`,
      inputSchema: {
        status: z
          .enum(["open", "completed", "cancelled", "countered"])
          .optional()
          .describe("Filter by trade status"),
        agent: z
          .string()
          .optional()
          .describe("Filter by agent BTC address"),
        inscription_id: z
          .string()
          .optional()
          .describe("Filter by inscription ID (txid + 'i' + index, e.g. abc123i0)"),
        type: z
          .enum(["offer", "counter", "transfer", "cancel", "psbt_swap"])
          .optional()
          .describe("Filter by trade type"),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .default(50)
          .describe("Results per page (default 50)"),
        offset: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .default(0)
          .describe("Pagination offset (default 0)"),
      },
    },
    async ({ status, agent, inscription_id, type, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (agent) params.set("agent", agent);
        if (inscription_id) params.set("inscription", inscription_id);
        if (type) params.set("type", type);
        params.set("limit", String(limit ?? 50));
        params.set("offset", String(offset ?? 0));

        const data = await ledgerGet(`/api/trades?${params}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_get_trade — public read
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_get_trade",
    {
      description: `Fetch full details for a single trade from the ordinals P2P ledger.

Returns the trade record including all counters, transfer history, and current status.

No wallet required.`,
      inputSchema: {
        trade_id: z
          .number()
          .int()
          .positive()
          .describe("Numeric trade ID"),
      },
    },
    async ({ trade_id }) => {
      try {
        const data = await ledgerGet(`/api/trades/${trade_id}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_my_trades — requires wallet (to get BTC address)
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_my_trades",
    {
      description: `List all trades involving the active wallet's BTC address.

Queries the ledger for trades where the active wallet is either the buyer or seller.
Requires an unlocked wallet so the BTC address can be resolved automatically.

You can optionally filter by status.`,
      inputSchema: {
        status: z
          .enum(["open", "completed", "cancelled", "countered"])
          .optional()
          .describe("Filter by trade status"),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .default(50)
          .describe("Results per page (default 50)"),
        offset: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .default(0)
          .describe("Pagination offset (default 0)"),
      },
    },
    async ({ status, limit, offset }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) throw new Error("Wallet is not unlocked. Use wallet_unlock first.");
        if (!account.btcAddress) throw new Error("Bitcoin address not available.");

        const btcAddress = account.btcAddress;
        const params = new URLSearchParams();
        params.set("agent", btcAddress);
        if (status) params.set("status", status);
        params.set("limit", String(limit ?? 50));
        params.set("offset", String(offset ?? 0));

        const data = await ledgerGet(`/api/trades?${params}`);
        return createJsonResponse({
          btcAddress,
          ...(data as Record<string, unknown>),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_agents — public read
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_agents",
    {
      description: `List active agents registered on the ordinals P2P trade ledger.

Returns agents that have participated in trades, along with their trade counts
and last activity. Useful for discovering counterparties.

No wallet required.`,
      inputSchema: {
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .default(50)
          .describe("Results per page (default 50)"),
      },
    },
    async ({ limit }) => {
      try {
        const data = await ledgerGet(`/api/agents?limit=${limit ?? 50}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_create_offer — requires wallet (BIP-137 signed)
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_create_offer",
    {
      description: `List an inscription for sale on the P2P trade ledger.

Creates a new offer entry authenticated with a BIP-137 signature from the active
wallet's BTC address. The inscription must be in the wallet or otherwise owned
by the signing address for the trade to be verifiable by counterparties.

Requires an unlocked wallet with Bitcoin keys.`,
      inputSchema: {
        inscription_id: z
          .string()
          .describe("Inscription ID in txid+index format, e.g. abc123...i0"),
        asking_price_sats: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Asking price in satoshis (omit for open price negotiation)"),
        to_agent: z
          .string()
          .optional()
          .describe("Target buyer BTC address (omit for public listing)"),
        metadata: z
          .string()
          .optional()
          .describe("Optional freeform metadata (e.g. description, terms)"),
      },
    },
    async ({ inscription_id, asking_price_sats, to_agent, metadata }) => {
      try {
        if (inscription_id && !/^[0-9a-f]{64}i\d+$/.test(inscription_id)) {
          throw new Error("inscription_id must be in format: <64-char-hex-txid>i<index> e.g. abc123...i0");
        }
        const account = getSignedAccount();
        const auth = buildAuthFields("offer", inscription_id, account);

        const body: Record<string, unknown> = {
          type: "offer",
          ...auth,
          inscription_id,
        };
        if (asking_price_sats !== undefined) body.amount_sats = asking_price_sats;
        if (to_agent) body.to_agent = to_agent;
        if (metadata) body.metadata = metadata;

        const data = await ledgerPost("/api/trades", body);
        return createJsonResponse({ success: true, ...(data as Record<string, unknown>) });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_counter — requires wallet (BIP-137 signed)
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_counter",
    {
      description: `Counter an existing offer with a new proposed price.

Submits a counter-offer linked to a parent trade. The active wallet signs the
counter with BIP-137 to prove identity. Either party in a trade may counter.

Requires an unlocked wallet with Bitcoin keys.`,
      inputSchema: {
        parent_trade_id: z
          .number()
          .int()
          .positive()
          .describe("ID of the trade being countered"),
        inscription_id: z
          .string()
          .describe("Inscription ID (must match the parent trade)"),
        amount_sats: z
          .number()
          .int()
          .positive()
          .describe("Counter-offer price in satoshis"),
        metadata: z
          .string()
          .optional()
          .describe("Optional freeform metadata"),
      },
    },
    async ({ parent_trade_id, inscription_id, amount_sats, metadata }) => {
      try {
        if (inscription_id && !/^[0-9a-f]{64}i\d+$/.test(inscription_id)) {
          throw new Error("inscription_id must be in format: <64-char-hex-txid>i<index> e.g. abc123...i0");
        }
        const account = getSignedAccount();
        const auth = buildAuthFields("counter", inscription_id, account);

        const body: Record<string, unknown> = {
          type: "counter",
          ...auth,
          inscription_id,
          parent_trade_id,
          amount_sats,
        };
        if (metadata) body.metadata = metadata;

        const data = await ledgerPost("/api/trades", body);
        return createJsonResponse({ success: true, ...(data as Record<string, unknown>) });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_transfer — requires wallet (BIP-137 signed)
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_transfer",
    {
      description: `Record a completed inscription transfer on the trade ledger.

Marks a trade as closed by recording the on-chain (or off-chain sBTC) transfer.
The active wallet signs the record with BIP-137 to prove the transfer was
authorized by the sending party.

Requires an unlocked wallet with Bitcoin keys.`,
      inputSchema: {
        inscription_id: z
          .string()
          .describe("Inscription ID being transferred"),
        to_agent: z
          .string()
          .describe("Recipient BTC address"),
        tx_hash: z
          .string()
          .optional()
          .describe("On-chain transaction hash (optional for sBTC/off-chain transfers)"),
        parent_trade_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Parent trade ID being fulfilled (if closing an open offer)"),
        amount_sats: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Transfer amount in satoshis"),
        metadata: z
          .string()
          .optional()
          .describe("Optional freeform metadata"),
      },
    },
    async ({ inscription_id, to_agent, tx_hash, parent_trade_id, amount_sats, metadata }) => {
      try {
        if (!/^[0-9a-f]{64}i\d+$/.test(inscription_id)) {
          throw new Error("inscription_id must be in format: <64-char-hex-txid>i<index> e.g. abc123...i0");
        }
        const account = getSignedAccount();
        const auth = buildAuthFields("transfer", inscription_id, account);

        const body: Record<string, unknown> = {
          type: "transfer",
          ...auth,
          inscription_id,
          to_agent,
        };
        if (tx_hash) body.tx_hash = tx_hash;
        if (parent_trade_id !== undefined) body.parent_trade_id = parent_trade_id;
        if (amount_sats !== undefined) body.amount_sats = amount_sats;
        if (metadata) body.metadata = metadata;

        const data = await ledgerPost("/api/trades", body);
        return createJsonResponse({ success: true, ...(data as Record<string, unknown>) });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_cancel — requires wallet (BIP-137 signed)
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_cancel",
    {
      description: `Cancel an open offer or counter on the trade ledger.

Only the parties involved in a trade may cancel it. The active wallet signs
the cancellation with BIP-137 to prove authorization.

Requires an unlocked wallet with Bitcoin keys.`,
      inputSchema: {
        parent_trade_id: z
          .number()
          .int()
          .positive()
          .describe("Trade ID to cancel"),
        inscription_id: z
          .string()
          .describe("Inscription ID (must match the trade being cancelled)"),
        metadata: z
          .string()
          .optional()
          .describe("Optional reason or metadata"),
      },
    },
    async ({ parent_trade_id, inscription_id, metadata }) => {
      try {
        if (!/^[0-9a-f]{64}i\d+$/.test(inscription_id)) {
          throw new Error("inscription_id must be in format: <64-char-hex-txid>i<index> e.g. abc123...i0");
        }
        const account = getSignedAccount();
        const auth = buildAuthFields("cancel", inscription_id, account);

        const body: Record<string, unknown> = {
          type: "cancel",
          ...auth,
          inscription_id,
          parent_trade_id,
        };
        if (metadata) body.metadata = metadata;

        const data = await ledgerPost("/api/trades", body);
        return createJsonResponse({ success: true, ...(data as Record<string, unknown>) });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // ordinals_p2p_psbt_swap — requires wallet (BIP-137 signed)
  // ==========================================================================

  server.registerTool(
    "ordinals_p2p_psbt_swap",
    {
      description: `Record a completed PSBT atomic swap on the trade ledger.

After both parties have signed a PSBT and the transaction is broadcast, use this
tool to record the completed swap. The active wallet signs the record with BIP-137.

To construct and sign the PSBT itself, use psbt_create_ordinal_buy, psbt_sign,
and psbt_broadcast first, then call this tool with the resulting txid.

Requires an unlocked wallet with Bitcoin keys.`,
      inputSchema: {
        inscription_id: z
          .string()
          .describe("Inscription ID swapped"),
        to_agent: z
          .string()
          .describe("Counterparty BTC address (new owner of the inscription)"),
        amount_sats: z
          .number()
          .int()
          .positive()
          .describe("Swap amount in satoshis"),
        tx_hash: z
          .string()
          .describe("Broadcast atomic swap transaction hash"),
        parent_trade_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Parent trade ID being fulfilled (if closing an existing offer)"),
        metadata: z
          .string()
          .optional()
          .describe("Optional freeform metadata"),
      },
    },
    async ({ inscription_id, to_agent, amount_sats, tx_hash, parent_trade_id, metadata }) => {
      try {
        if (!/^[0-9a-f]{64}i\d+$/.test(inscription_id)) {
          throw new Error("inscription_id must be in format: <64-char-hex-txid>i<index> e.g. abc123...i0");
        }
        const account = getSignedAccount();
        const auth = buildAuthFields("psbt_swap", inscription_id, account);

        const body: Record<string, unknown> = {
          type: "psbt_swap",
          ...auth,
          inscription_id,
          to_agent,
          amount_sats,
          tx_hash,
        };
        if (parent_trade_id !== undefined) body.parent_trade_id = parent_trade_id;
        if (metadata) body.metadata = metadata;

        const data = await ledgerPost("/api/trades", body);
        return createJsonResponse({ success: true, ...(data as Record<string, unknown>) });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
