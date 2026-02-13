import { z } from "zod";
import crypto from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  tupleCV,
  stringAsciiCV,
  uintCV,
  principalCV,
  noneCV,
  trueCV,
  falseCV,
} from "@stacks/transactions";
import {
  getSigningKeyService,
  generateAuthId,
  type SigAuth,
} from "../services/signing-key.service.js";
import { getPillarApi } from "../services/pillar-api.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { NETWORK, getExplorerTxUrl } from "../config/networks.js";
import { MAINNET_CONTRACTS } from "../config/contracts.js";
import { PILLAR_API_KEY } from "../config/pillar.js";
import { createJsonResponse, createErrorResponse, formatStx } from "../utils/index.js";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Derive a deterministic password from the PILLAR_API_KEY.
 * This lets the bot auto-unlock signing keys after restarts
 * without requiring user input. The key is still encrypted at rest.
 */
function getDerivedPassword(): string {
  const secret = PILLAR_API_KEY || "pillar-direct-default";
  return crypto
    .createHash("sha256")
    .update(`pillar-agent-signing-key:${secret}`)
    .digest("hex");
}

/**
 * Get active signing session, auto-unlocking if needed.
 * On first call after restart, finds the stored key and unlocks it
 * with the derived password — seamless, no user prompt needed.
 */
async function requireActiveKey() {
  const keyService = getSigningKeyService();
  let session = keyService.getActiveKey();

  if (!session) {
    // Try auto-unlock: find stored keys and unlock the best one
    const keys = await keyService.listKeys();
    if (keys.length === 0) {
      throw new Error(
        "No signing key found. Use pillar_direct_create_wallet to create one."
      );
    }

    // Prefer keys with an actual wallet address (not "pending")
    const sortedKeys = [...keys].sort((a, b) => {
      const aReady = a.smartWallet !== "pending" ? 0 : 1;
      const bReady = b.smartWallet !== "pending" ? 0 : 1;
      return aReady - bReady;
    });

    const password = getDerivedPassword();
    // Try each key until one unlocks
    let unlocked = false;
    for (const key of sortedKeys) {
      try {
        await keyService.unlock(key.id, password);
        unlocked = true;
        break;
      } catch {
        // Wrong password for this key, try next
      }
    }

    if (!unlocked) {
      throw new Error(
        "Signing key locked and auto-unlock failed. Set PILLAR_API_KEY environment variable or use pillar_key_unlock with your password."
      );
    }

    session = keyService.getActiveKey();
    if (!session) {
      throw new Error("Failed to unlock signing key.");
    }
  }

  return { keyService, session };
}

/**
 * Format sig-auth for the Pillar backend API (matches frontend api-client.ts).
 */
function formatSigAuthForApi(sigAuth: SigAuth) {
  return {
    authId: sigAuth.authId,
    signature: sigAuth.signature.startsWith("0x")
      ? sigAuth.signature
      : "0x" + sigAuth.signature,
    pubkey: sigAuth.pubkey.startsWith("0x")
      ? sigAuth.pubkey
      : "0x" + sigAuth.pubkey,
  };
}

/**
 * Guard that returns an error response if not on mainnet, or null if mainnet.
 */
function requireMainnet(): ReturnType<typeof createJsonResponse> | null {
  if (NETWORK !== "mainnet") {
    return createJsonResponse({
      error: "Pillar Direct tools are only available on mainnet",
      network: NETWORK,
    });
  }
  return null;
}

/**
 * Extract wallet name from contract address (e.g. "SPxxx.telegram-wallet" -> "telegram-wallet").
 */
function getWalletName(contractAddress: string): string {
  return contractAddress.split(".")[1] || contractAddress;
}

/**
 * Resolve a recipient identifier (BNS name, Pillar wallet name, or Stacks address)
 * to a Stacks address. Throws on resolution failure.
 */
async function resolveRecipientAddress(
  api: ReturnType<typeof getPillarApi>,
  to: string,
  recipientType: string
): Promise<string> {
  if (recipientType === "address" || to.startsWith("SP") || to.startsWith("ST")) {
    return to;
  }

  if (recipientType === "wallet") {
    const walletLookup = await api.get<{
      success: boolean;
      data: { contractAddress: string } | null;
    }>(`/api/smart-wallet/${to}`);
    if (!walletLookup.data?.contractAddress) {
      throw new Error(`Pillar wallet "${to}" not found.`);
    }
    return walletLookup.data.contractAddress;
  }

  // BNS name resolution
  const bnsName = to.endsWith(".btc") ? to : `${to}.btc`;
  const bnsLookup = await api.get<{
    success: boolean;
    data: { address: string } | null;
  }>("/api/bns/resolve", { name: bnsName });
  if (!bnsLookup.data?.address) {
    throw new Error(`BNS name "${bnsName}" could not be resolved.`);
  }
  return bnsLookup.data.address;
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerPillarDirectTools(server: McpServer): void {
  // ==========================================================================
  // Key Management Tools (4)
  // ==========================================================================

  server.registerTool(
    "pillar_key_generate",
    {
      description:
        "Generate a new secp256k1 signing keypair for Pillar smart wallet direct operations. " +
        "Returns the compressed public key (33 bytes hex). " +
        "After generation, propose this pubkey on your smart wallet contract (admin must do this).",
      inputSchema: {
        smartWallet: z
          .string()
          .default("pending")
          .describe(
            "Smart wallet contract ID this key is for (e.g. SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.my-wallet). " +
            "Use 'pending' if creating a new wallet — pillar_direct_create_wallet will update it automatically."
          ),
      },
    },
    async ({ smartWallet }) => {
      try {
        const keyService = getSigningKeyService();
        const password = getDerivedPassword();
        const { keyId, pubkey } = await keyService.generateKey(
          password,
          smartWallet
        );

        return createJsonResponse({
          success: true,
          keyId,
          pubkey,
          smartWallet,
          note: "Pubkey generated. An admin must propose and confirm this pubkey on the smart wallet contract before it can sign operations.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "pillar_key_unlock",
    {
      description:
        "Unlock a signing key for Pillar direct operations. " +
        "Uses auto-derived password. Usually not needed — tools auto-unlock on first use.",
      inputSchema: {
        keyId: z
          .string()
          .optional()
          .describe("The signing key ID to unlock. If omitted, unlocks the first stored key."),
      },
    },
    async ({ keyId }) => {
      try {
        const keyService = getSigningKeyService();
        const password = getDerivedPassword();

        let targetKeyId = keyId;
        if (!targetKeyId) {
          const keys = await keyService.listKeys();
          if (keys.length === 0) {
            throw new Error("No signing keys found.");
          }
          targetKeyId = keys[0].id;
        }

        await keyService.unlock(targetKeyId, password);
        const session = keyService.getActiveKey();

        return createJsonResponse({
          success: true,
          message: "Signing key unlocked.",
          keyId: targetKeyId,
          pubkey: session!.pubkey,
          smartWallet: session!.smartWallet,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "pillar_key_lock",
    {
      description: "Lock the signing key, clearing sensitive data from memory.",
      inputSchema: {},
    },
    async () => {
      try {
        const keyService = getSigningKeyService();
        keyService.lock();

        return createJsonResponse({
          success: true,
          message: "Signing key locked.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "pillar_key_info",
    {
      description:
        "Show signing key info: pubkey, smart wallet, lock status, and all stored keys.",
      inputSchema: {},
    },
    async () => {
      try {
        const keyService = getSigningKeyService();
        const session = keyService.getActiveKey();
        const keys = await keyService.listKeys();

        return createJsonResponse({
          unlocked: session !== null,
          activeKey: session
            ? {
                keyId: session.keyId,
                pubkey: session.pubkey,
                smartWallet: session.smartWallet,
              }
            : null,
          storedKeys: keys.map((k) => ({
            keyId: k.id,
            pubkey: k.pubkey,
            smartWallet: k.smartWallet,
            createdAt: k.createdAt,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Direct Operation Tools — twins of handoff tools
  //
  // Each tool: build SIP-018 structured data → sign locally → call Pillar
  // backend API with sigAuth → backend builds tx, sponsors gas, broadcasts.
  // ==========================================================================

  // --- pillar_direct_boost (twin of pillar_boost) ---
  server.registerTool(
    "pillar_direct_boost",
    {
      description:
        "Create or increase a leveraged sBTC position (up to 1.5x) on your Pillar smart wallet. " +
        "Agent-signed, no browser needed. Your sBTC is supplied to Zest, borrowed against, " +
        "and re-supplied for amplified Bitcoin exposure. Backend sponsors gas. " +
        "For simple yield without leverage, use pillar_direct_supply instead.",
      inputSchema: {
        sbtcAmount: z
          .number()
          .positive()
          .describe("sBTC amount in sats to supply as collateral"),
        aeUsdcToBorrow: z
          .number()
          .positive()
          .describe("aeUSDC amount to borrow (6 decimals)"),
        minSbtcFromSwap: z
          .number()
          .positive()
          .describe("Min sBTC from swap in sats (slippage protection)"),
      },
    },
    async ({ sbtcAmount, aeUsdcToBorrow, minSbtcFromSwap }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        const structuredData = tupleCV({
          topic: stringAsciiCV("pillar-boost"),
          "auth-id": uintCV(authId),
          "sbtc-amount": uintCV(sbtcAmount),
          "aeusdc-to-borrow": uintCV(aeUsdcToBorrow),
          "min-sbtc-from-swap": uintCV(minSbtcFromSwap),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/pillar/boost", {
          walletAddress: session.smartWallet,
          sbtcAmount,
          aeUsdcToBorrow,
          minSbtcFromSwap,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "pillar-boost",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_unwind (twin of pillar_unwind) ---
  server.registerTool(
    "pillar_direct_unwind",
    {
      description:
        "Close or reduce your leveraged sBTC position. Agent-signed, no browser needed. " +
        "Swaps sBTC to aeUSDC to repay debt, then withdraws remaining sBTC collateral. Backend sponsors gas.",
      inputSchema: {
        sbtcToSwap: z
          .number()
          .positive()
          .describe("sBTC to swap to aeUSDC for repayment (in sats)"),
        sbtcToWithdraw: z
          .number()
          .min(0)
          .describe("sBTC to withdraw after repayment (in sats)"),
        minAeUsdcFromSwap: z
          .number()
          .positive()
          .describe("Min aeUSDC from swap (slippage protection, 6 decimals)"),
      },
    },
    async ({ sbtcToSwap, sbtcToWithdraw, minAeUsdcFromSwap }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        const structuredData = tupleCV({
          topic: stringAsciiCV("pillar-unwind"),
          "auth-id": uintCV(authId),
          "sbtc-to-swap": uintCV(sbtcToSwap),
          "sbtc-to-withdraw": uintCV(sbtcToWithdraw),
          "min-aeusdc-from-swap": uintCV(minAeUsdcFromSwap),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/pillar/unwind", {
          walletAddress: session.smartWallet,
          sbtcToSwap,
          sbtcToWithdraw,
          minAeUsdcFromSwap,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "pillar-unwind",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_supply (twin of pillar_supply / Earn) ---
  // pillar_supply in handoff = add-collateral (0x leverage supply to Zest)
  server.registerTool(
    "pillar_direct_supply",
    {
      description:
        "Earn yield on your Bitcoin. Supply sBTC from your Pillar smart wallet to Zest Protocol. " +
        "No leverage, no liquidation risk. Agent-signed, no browser needed. Backend sponsors gas. " +
        "For leveraged exposure (1.5x), use pillar_direct_boost instead.",
      inputSchema: {
        sbtcAmount: z
          .number()
          .positive()
          .describe("sBTC amount in sats to supply"),
      },
    },
    async ({ sbtcAmount }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        const structuredData = tupleCV({
          topic: stringAsciiCV("pillar-add-collateral"),
          "auth-id": uintCV(authId),
          "sbtc-amount": uintCV(sbtcAmount),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/pillar/add-collateral", {
          walletAddress: session.smartWallet,
          sbtcAmount,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "pillar-add-collateral",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_send (twin of pillar_send) ---
  // pillar_send sends sBTC via sip010-transfer
  server.registerTool(
    "pillar_direct_send",
    {
      description:
        "Send sBTC from your Pillar smart wallet to a recipient. " +
        "Agent-signed, no browser needed. Supports BNS names, wallet names, or Stacks addresses. " +
        "Backend sponsors gas.",
      inputSchema: {
        to: z
          .string()
          .describe(
            "Recipient: BNS name (muneeb.btc), Pillar wallet name, or Stacks address (SP...)"
          ),
        amount: z
          .number()
          .positive()
          .describe("Amount in satoshis"),
        recipientType: z
          .enum(["bns", "wallet", "address"])
          .default("bns")
          .describe("Type of recipient: 'bns' (default), 'wallet', or 'address'"),
      },
    },
    async ({ to, amount, recipientType }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const api = getPillarApi();

        const resolvedAddress = await resolveRecipientAddress(api, to, recipientType);

        const authId = generateAuthId();
        const structuredData = tupleCV({
          topic: stringAsciiCV("sip010-transfer"),
          "auth-id": uintCV(authId),
          amount: uintCV(amount),
          recipient: principalCV(resolvedAddress),
          memo: noneCV(),
          sip010: principalCV(MAINNET_CONTRACTS.SBTC_TOKEN),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/smart-wallet/sip010-transfer", {
          walletAddress: session.smartWallet,
          amount,
          recipient: resolvedAddress,
          sip010: MAINNET_CONTRACTS.SBTC_TOKEN,
          tokenName: "sbtc-token",
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "sip010-transfer",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
          to,
          resolvedAddress,
          amount,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_auto_compound (twin of pillar_auto_compound) ---
  server.registerTool(
    "pillar_direct_auto_compound",
    {
      description:
        "Configure auto-compound for your Pillar wallet. " +
        "When enabled, a keeper automatically boosts when sBTC accumulates above the trigger. " +
        "Agent-signed, no browser needed. Backend sponsors gas.",
      inputSchema: {
        enabled: z.boolean().describe("Enable or disable auto-compound"),
        minSbtc: z
          .number()
          .min(0)
          .describe("Minimum sBTC to keep in wallet (in sats)"),
        trigger: z
          .number()
          .positive()
          .describe(
            "sBTC amount above minimum that triggers auto-compound (in sats)"
          ),
      },
    },
    async ({ enabled, minSbtc, trigger }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        const structuredData = tupleCV({
          topic: stringAsciiCV("set-keeper-auto-compound"),
          "auth-id": uintCV(authId),
          enabled: enabled ? trueCV() : falseCV(),
          "min-sbtc": uintCV(minSbtc),
          trigger: uintCV(trigger),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/pillar/set-auto-compound", {
          walletAddress: session.smartWallet,
          enabled,
          minSbtc,
          trigger,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "set-keeper-auto-compound",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_position (twin of pillar_position) ---
  // Read-only — no signing needed, just fetches balances
  server.registerTool(
    "pillar_direct_position",
    {
      description:
        "View your Pillar smart wallet balances (STX, sBTC, aeUSDC) and Zest position. " +
        "No signing needed — reads on-chain data.",
      inputSchema: {},
    },
    async () => {
      try {
        const { session } = await requireActiveKey();
        const api = getPillarApi();

        const walletName = getWalletName(session.smartWallet);

        // First check wallet status in backend
        let walletStatus: string | null = null;
        try {
          const walletInfo = await api.get<{
            success: boolean;
            data: { status: string; contractAddress: string } | null;
          }>(`/api/smart-wallet/${walletName}`);
          walletStatus = walletInfo.data?.status || null;
        } catch {
          // Wallet not found in backend
        }

        if (!walletStatus || walletStatus === "pending_init") {
          return createJsonResponse({
            success: true,
            walletAddress: session.smartWallet,
            status: walletStatus || "unknown",
            message: "Wallet is still being onboarded. The on-chain deployment may be confirmed " +
              "but the backend hasn't synced yet. Try again in a minute.",
          });
        }

        // Fetch on-chain balances (STX, sBTC, aeUSDC) from Hiro API
        const hiro = getHiroApi(NETWORK);
        let stxBalance = "0";
        let sbtcBalanceSats = 0;
        let aeusdcBalance = 0;
        let balanceApiError: string | null = null;

        try {
          const balances = await hiro.getAccountBalances(session.smartWallet);

          // STX balance (in micro-STX)
          stxBalance = balances.stx?.balance || "0";

          // sBTC balance (in sats)
          const sbtcKey = Object.keys(balances.fungible_tokens || {}).find(
            (k) => k.includes("sbtc-token")
          );
          if (sbtcKey) {
            sbtcBalanceSats = parseInt(balances.fungible_tokens[sbtcKey].balance || "0");
          }

          // aeUSDC balance (6 decimals)
          const aeusdcKey = Object.keys(balances.fungible_tokens || {}).find(
            (k) => k.includes("token-aeusdc")
          );
          if (aeusdcKey) {
            aeusdcBalance = parseInt(balances.fungible_tokens[aeusdcKey].balance || "0");
          }
        } catch (err) {
          // Hiro API may be down or fail for fresh wallets
          const errMsg = err instanceof Error ? err.message : String(err);
          balanceApiError = `Hiro API unavailable: ${errMsg}`;
        }

        const stxMicro = BigInt(stxBalance);
        const stxFormatted = `${stxMicro / BigInt(1_000_000)}.${(stxMicro % BigInt(1_000_000)).toString().padStart(6, "0")} STX`;

        const walletBalances: Record<string, unknown> = {
          stx: stxFormatted,
          stxMicroStx: stxBalance,
          sbtcSats: sbtcBalanceSats,
          sbtcBtc: sbtcBalanceSats / 1e8,
          aeusdcRaw: aeusdcBalance,
          aeusdcFormatted: (aeusdcBalance / 1e6).toFixed(2),
          ...(balanceApiError ? { apiError: balanceApiError } : {}),
        };

        // Wallet is deployed — fetch Zest position
        let position: Record<string, unknown> | null = null;
        try {
          const unwindQuote = await api.get<{
            success: boolean;
            data: {
              collateralSats: number;
              collateralBtc: number;
              collateralUsd: number;
              borrowedAeUsdc: number;
              borrowedUsd: number;
              btcPrice: number;
              canUnwind: boolean;
            };
          }>("/api/pillar/unwind-quote", {
            walletAddress: session.smartWallet,
          });

          position = unwindQuote.data as Record<string, unknown>;
        } catch {
          // unwind-quote may fail for fresh wallets with no position
        }

        return createJsonResponse({
          success: true,
          walletAddress: session.smartWallet,
          status: walletStatus,
          balances: walletBalances,
          zestPosition: position || {
            collateralSats: 0,
            borrowedAeUsdc: 0,
            message: "No Zest position yet. Supply sBTC or boost to get started.",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_withdraw_collateral ---
  server.registerTool(
    "pillar_direct_withdraw_collateral",
    {
      description:
        "Withdraw sBTC collateral from Zest on the Pillar smart wallet. " +
        "Agent-signed, no browser needed. Backend sponsors gas.",
      inputSchema: {
        sbtcAmount: z
          .number()
          .positive()
          .describe("sBTC amount in sats to withdraw"),
      },
    },
    async ({ sbtcAmount }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        const structuredData = tupleCV({
          topic: stringAsciiCV("pillar-withdraw-collateral"),
          "auth-id": uintCV(authId),
          "sbtc-amount": uintCV(sbtcAmount),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/pillar/withdraw-collateral", {
          walletAddress: session.smartWallet,
          sbtcAmount,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "pillar-withdraw-collateral",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_add_admin (twin of pillar_add_admin) ---
  server.registerTool(
    "pillar_direct_add_admin",
    {
      description:
        "Add a backup admin address to your Pillar smart wallet for recovery purposes. " +
        "Agent-signed, no browser needed. The admin can help recover funds if you lose access to your passkey. " +
        "Backend sponsors gas.",
      inputSchema: {
        newAdmin: z
          .string()
          .describe(
            "Stacks address (SP...) to add as backup admin"
          ),
      },
    },
    async ({ newAdmin }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        const structuredData = tupleCV({
          topic: stringAsciiCV("add-admin"),
          "auth-id": uintCV(authId),
          "new-admin": principalCV(newAdmin),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/smart-wallet/add-admin", {
          walletAddress: session.smartWallet,
          newAdmin,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "add-admin",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
          newAdmin,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_create_wallet (twin of pillar_create_wallet) ---
  // Bundled: generates keypair + unlocks + deploys wallet in one shot.
  // Backend deploys contract + calls onboard(pubkey) in background.
  server.registerTool(
    "pillar_direct_create_wallet",
    {
      description:
        "Create a new Pillar smart wallet for agent direct operations. " +
        "This is a bundled operation: generates a signing keypair, unlocks it, " +
        "and deploys a new smart wallet with the pubkey registered. " +
        "Backend deploys the contract and calls onboard() in background. " +
        "After ~20-30 seconds the wallet is ready for pillar_direct_* operations.",
      inputSchema: {
        walletName: z
          .string()
          .min(3)
          .max(20)
          .describe(
            "Wallet name (3-20 chars, lowercase letters, numbers, hyphens). " +
            "The contract will be deployed as {walletName}-wallet."
          ),
        referredBy: z
          .string()
          .default("SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.beta-v2-wallet")
          .describe(
            "Contract address of the referring wallet. " +
            "Defaults to the Pillar team wallet if not provided."
          ),
      },
    },
    async ({ walletName, referredBy }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const api = getPillarApi();
        const password = getDerivedPassword();

        // Step 0: Check name availability before doing anything
        const nameCheck = await api.get<{
          success: boolean;
          data: {
            name: string;
            available: boolean;
            reason?: string;
            message?: string;
            contractName?: string;
          };
        }>("/api/smart-wallet/check-name", { name: walletName });

        if (!nameCheck.data.available) {
          return createJsonResponse({
            success: false,
            error: nameCheck.data.message || `Wallet name "${walletName}" is not available.`,
            reason: nameCheck.data.reason,
          });
        }

        // Step 1: Generate signing keypair
        const keyService = getSigningKeyService();
        const { keyId, pubkey } = await keyService.generateKey(
          password,
          "pending"
        );

        // Step 2: Unlock it
        await keyService.unlock(keyId, password);

        // Step 3: Deploy wallet with this pubkey
        const pubkeyPrefixed = pubkey.startsWith("0x")
          ? pubkey
          : "0x" + pubkey;

        // Replace hyphens — backend DANGEROUS_CHARS regex blocks them in emails
        const safeWalletName = walletName.replace(/-/g, "");
        const email = `${safeWalletName}@agent.pillarbtc.com`;
        const privyWalletAddress = "0x0000000000000000000000000000000000000000";

        const result = await api.post<{
          success: boolean;
          data: {
            walletName: string;
            contractName: string;
            contractAddress: string;
            deployTxId: string;
            initTxId: string | null;
            status: string;
          };
        }>("/api/smart-wallet/deploy", {
          walletName,
          ownerPubkey: pubkeyPrefixed,
          email,
          privyWalletAddress,
          referredBy,
        });

        // Step 4: Associate signing key with the new wallet
        await keyService.updateKeyWallet(keyId, result.data.contractAddress);

        return createJsonResponse({
          success: true,
          operation: "create-wallet",
          keyId,
          pubkey: pubkeyPrefixed,
          walletName: result.data.walletName,
          contractName: result.data.contractName,
          contractAddress: result.data.contractAddress,
          deployTxId: result.data.deployTxId,
          explorerUrl: getExplorerTxUrl(result.data.deployTxId, NETWORK),
          status: result.data.status,
          note: "Signing key generated, unlocked, and wallet deployed. " +
            "Backend is calling onboard() in background (~20-30s). " +
            "Once status changes to deployed, pillar_direct_* operations are ready.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // DCA Tools — twins of handoff DCA tools
  //
  // These are read-only API calls (no signing), but need the wallet address
  // from the signing key session rather than the handoff session.
  // ==========================================================================

  // --- pillar_direct_dca_invite (twin of pillar_dca_invite) ---
  server.registerTool(
    "pillar_direct_dca_invite",
    {
      description:
        "Invite a DCA partner by email or wallet address. " +
        "DCA partners hold each other accountable — both must boost each week to keep the streak alive.",
      inputSchema: {
        partner: z
          .string()
          .describe("Partner's email address or Stacks wallet address (SP...)"),
      },
    },
    async ({ partner }) => {
      try {
        const { session } = await requireActiveKey();
        const isEmail = partner.includes("@");

        const api = getPillarApi();
        const result = await api.post<{
          partnershipId: string;
          status: string;
          inviteLink?: string;
        }>("/api/dca-partner/invite", {
          walletAddress: session.smartWallet,
          ...(isEmail
            ? { partnerEmail: partner }
            : { partnerWalletAddress: partner }),
        });

        return createJsonResponse({
          success: true,
          partnershipId: result.partnershipId,
          status: result.status,
          message: isEmail
            ? `Invite sent to ${partner}. They'll receive an email with a link to accept.`
            : `Partnership invite sent to ${partner}.`,
          ...(result.inviteLink ? { inviteLink: result.inviteLink } : {}),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_dca_partners (twin of pillar_dca_partners) ---
  server.registerTool(
    "pillar_direct_dca_partners",
    {
      description:
        "View your DCA partners and weekly status. " +
        "Shows active partnerships with streak, PnL, and weekly status badges, plus any pending invites.",
      inputSchema: {},
    },
    async () => {
      try {
        const { session } = await requireActiveKey();

        const api = getPillarApi();
        const result = await api.get<{
          partnerships: Array<{
            partnershipId: string;
            partnerName?: string;
            partnerAddress: string;
            streak: number;
            pnl?: number;
            myStatus: string;
            partnerStatus: string;
            status: string;
          }>;
          pendingInvites: Array<{
            partnershipId: string;
            partnerEmail?: string;
            partnerAddress?: string;
            direction: string;
          }>;
        }>("/api/dca-partner/my-partners", {
          walletAddress: session.smartWallet,
        });

        const active = result.partnerships.filter(
          (p) => p.status === "active"
        );
        const pending = result.pendingInvites || [];

        return createJsonResponse({
          success: true,
          activePartnerships: active.map((p) => ({
            partnershipId: p.partnershipId,
            partner: p.partnerName || p.partnerAddress,
            streak: p.streak,
            pnl: p.pnl,
            myStatus: p.myStatus,
            partnerStatus: p.partnerStatus,
          })),
          pendingInvites: pending.length,
          pendingDetails: pending.map((p) => ({
            partnershipId: p.partnershipId,
            partner: p.partnerEmail || p.partnerAddress,
            direction: p.direction,
          })),
          message:
            active.length > 0
              ? `${active.length} active partnership${active.length > 1 ? "s" : ""}, ${pending.length} pending invite${pending.length !== 1 ? "s" : ""}`
              : `No active partnerships. ${pending.length} pending invite${pending.length !== 1 ? "s" : ""}. Use pillar_direct_dca_invite to invite a partner.`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_dca_leaderboard (twin of pillar_dca_leaderboard) ---
  server.registerTool(
    "pillar_direct_dca_leaderboard",
    {
      description:
        "View the DCA streak leaderboard. Shows top partnerships by streak length, and highlights your entry if you have one.",
      inputSchema: {},
    },
    async () => {
      try {
        const { session } = await requireActiveKey();

        const api = getPillarApi();
        const result = await api.get<{
          leaderboard: Array<{
            rank: number;
            partnerNames: string[];
            streak: number;
            pnl?: number;
            isUser?: boolean;
          }>;
          userEntry?: {
            rank: number;
            partnerName: string;
            streak: number;
            pnl?: number;
          };
        }>("/api/dca-partner/leaderboard", {
          walletAddress: session.smartWallet,
        });

        return createJsonResponse({
          success: true,
          leaderboard: result.leaderboard.map((entry) => ({
            rank: entry.rank,
            partners: entry.partnerNames.join(" & "),
            streak: entry.streak,
            pnl: entry.pnl,
            isYou: entry.isUser || false,
          })),
          yourRank: result.userEntry
            ? {
                rank: result.userEntry.rank,
                partner: result.userEntry.partnerName,
                streak: result.userEntry.streak,
                pnl: result.userEntry.pnl,
              }
            : null,
          message: result.userEntry
            ? `You're ranked #${result.userEntry.rank} with a ${result.userEntry.streak}-week streak with ${result.userEntry.partnerName}.`
            : "You don't have an active partnership on the leaderboard yet. Use pillar_direct_dca_invite to get started.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_dca_status (twin of pillar_dca_status) ---
  server.registerTool(
    "pillar_direct_dca_status",
    {
      description:
        "Check your DCA schedule status. Shows all active DCA schedules (up to 10) with chunk progress " +
        "(completed, pending, failed) and next execution time.",
      inputSchema: {},
    },
    async () => {
      try {
        const { session } = await requireActiveKey();
        const api = getPillarApi();

        interface DcaScheduleInfo {
          id: string;
          totalSbtcAmount: number;
          chunkSizeSats: number;
          totalChunks: number;
          completedChunks: number;
          failedChunks: number;
          status: string;
          btcPriceAtCreation: number | null;
          createdAt: number;
          completedAt: number | null;
        }

        interface DcaChunkInfo {
          id: string;
          chunkIndex: number;
          sbtcAmount: number;
          status: string;
          scheduledAt: number;
          executedAt: number | null;
          txId: string | null;
          retryCount: number;
          errorMessage: string | null;
        }

        interface DcaStatusResult {
          schedule: DcaScheduleInfo;
          chunks: DcaChunkInfo[];
          allSchedules?: {
            schedule: DcaScheduleInfo;
            chunks: DcaChunkInfo[];
          }[];
          activeCount?: number;
          maxSchedules?: number;
        }

        const raw = await api.get<{
          success: boolean;
          data: DcaStatusResult | null;
        }>("/api/pillar/dca-status", {
          walletAddress: session.smartWallet,
        });

        const result = raw.data;

        if (!result) {
          return createJsonResponse({
            success: true,
            hasSchedule: false,
            activeCount: 0,
            maxSchedules: 10,
            message:
              "No active DCA schedule. Use pillar_direct_boost with an amount over 100,000 sats to start one.",
          });
        }

        const allSchedules = result.allSchedules || [
          { schedule: result.schedule, chunks: result.chunks },
        ];
        const activeCount =
          result.activeCount ??
          (result.schedule.status === "active" ? 1 : 0);
        const maxSchedules = result.maxSchedules ?? 10;

        const formatSchedule = (
          s: DcaScheduleInfo,
          chunks: DcaChunkInfo[]
        ) => {
          const pendingChunks = chunks.filter(
            (c) => c.status === "pending" || c.status === "executing"
          ).length;
          const nextPending = chunks
            .filter((c) => c.status === "pending")
            .sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
          const nextExecution = nextPending
            ? new Date(nextPending.scheduledAt).toISOString()
            : null;

          return {
            id: s.id,
            status: s.status,
            totalSbtcAmount: s.totalSbtcAmount,
            chunkSizeSats: s.chunkSizeSats,
            progress: `${s.completedChunks}/${s.totalChunks} chunks completed`,
            completedChunks: s.completedChunks,
            pendingChunks,
            failedChunks: s.failedChunks,
            nextExecution,
            createdAt: new Date(s.createdAt).toISOString(),
          };
        };

        const schedules = allSchedules.map((entry) =>
          formatSchedule(entry.schedule, entry.chunks)
        );

        const activeSchedules = schedules.filter(
          (s) => s.status === "active"
        );

        if (activeSchedules.length === 0) {
          const latest = schedules[0];
          return createJsonResponse({
            success: true,
            hasSchedule: true,
            activeCount: 0,
            maxSchedules,
            schedule: latest,
            message: `DCA ${latest.status}: ${latest.progress}.`,
          });
        }

        if (activeSchedules.length === 1) {
          const s = activeSchedules[0];
          return createJsonResponse({
            success: true,
            hasSchedule: true,
            activeCount,
            maxSchedules,
            schedule: s,
            message: `DCA active: ${s.progress} (${s.chunkSizeSats} sats/chunk). Next: ${s.nextExecution || "pending"}.`,
          });
        }

        const summaries = activeSchedules.map(
          (s) =>
            `Schedule ${s.id.slice(0, 8)}: ${s.progress}, next: ${s.nextExecution || "pending"}`
        );
        return createJsonResponse({
          success: true,
          hasSchedule: true,
          activeCount,
          maxSchedules,
          schedules: activeSchedules,
          message: `${activeCount} active DCA schedules (max ${maxSchedules}):\n${summaries.join("\n")}`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Utility Tools
  // ==========================================================================

  // --- pillar_direct_quote ---
  // Utility tool — get a boost quote before executing
  server.registerTool(
    "pillar_direct_quote",
    {
      description:
        "Get a boost quote showing projected leverage, LTV, and swap details. " +
        "No signing needed. Use this to determine aeUsdcToBorrow and minSbtcFromSwap before calling pillar_direct_boost.",
      inputSchema: {
        sbtcAmount: z
          .number()
          .positive()
          .describe("sBTC amount in sats to boost"),
      },
    },
    async ({ sbtcAmount }) => {
      try {
        const api = getPillarApi();
        const result = await api.get<{
          success: boolean;
          data: {
            sbtcAmount: number;
            aeUsdcToBorrow: number;
            minSbtcFromSwap: number;
            totalCollateralSats: number;
            effectiveLtv: number;
            leverageMultiplier: number;
            btcPriceUsd: number;
          };
        }>("/api/pillar/quote", { sbtcAmount });

        return createJsonResponse({
          success: true,
          quote: result.data,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_resolve_recipient ---
  // Resolve a BNS name, Pillar wallet name, or address before sending
  server.registerTool(
    "pillar_direct_resolve_recipient",
    {
      description:
        "Resolve a recipient before sending. Resolves BNS names (.btc) via backend, " +
        "Pillar wallet names via backend, or validates a Stacks address. " +
        "Use this BEFORE pillar_direct_send to confirm the resolved address with the user.",
      inputSchema: {
        to: z
          .string()
          .describe(
            "Recipient: BNS name (muneeb.btc), Pillar wallet name, or Stacks address (SP...)"
          ),
        recipientType: z
          .enum(["bns", "wallet", "address"])
          .default("bns")
          .describe("Type of recipient: 'bns' (default), 'wallet', or 'address'"),
      },
    },
    async ({ to, recipientType }) => {
      try {
        const api = getPillarApi();
        const resolvedAddress = await resolveRecipientAddress(api, to, recipientType);

        // Determine the effective type for the response
        const effectiveType =
          recipientType === "address" || to.startsWith("SP") || to.startsWith("ST")
            ? "address"
            : recipientType;
        const bnsName = effectiveType === "bns"
          ? (to.endsWith(".btc") ? to : `${to}.btc`)
          : undefined;

        return createJsonResponse({
          success: true,
          input: to,
          resolvedAddress,
          ...(bnsName ? { bnsName } : {}),
          type: effectiveType,
        });
      } catch (error) {
        // Return resolution failures as structured responses instead of error format
        if (error instanceof Error) {
          return createJsonResponse({
            success: false,
            input: to,
            error: error.message,
          });
        }
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // Stacking Tools
  //
  // Stack STX via Fast Pool or Stacking DAO through the smart wallet.
  // Backend: POST /api/pillar/stack-stx
  // Contract: stack-stx-fast-pool / stake-stx-stacking-dao
  // ==========================================================================

  // --- pillar_direct_stack_stx ---
  server.registerTool(
    "pillar_direct_stack_stx",
    {
      description:
        "Stack STX from your Pillar smart wallet via Fast Pool or Stacking DAO. " +
        "Agent-signed, no browser needed. Backend sponsors gas. " +
        "Fast Pool delegates STX to the pox4-fast-pool-v3 contract. " +
        "Stacking DAO deposits STX into Stacking DAO core for stSTX yield. " +
        "Your wallet must be enrolled in dual stacking first (automatic for v2 wallets with sBTC).",
      inputSchema: {
        stxAmount: z
          .number()
          .positive()
          .describe("Amount of STX to stack in micro-STX (1 STX = 1,000,000 micro-STX)"),
        pool: z
          .enum(["fast-pool", "stacking-dao"])
          .describe(
            "Stacking pool to use: 'fast-pool' (delegates to pox4-fast-pool-v3) " +
            "or 'stacking-dao' (deposits into Stacking DAO for stSTX)"
          ),
      },
    },
    async ({ stxAmount, pool }) => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        // Build SIP-018 structured data matching the contract's hash builder.
        // Fast Pool uses topic "stack-stx-fast-pool" with {auth-id, amount-ustx}
        // Stacking DAO uses topic "stake-stx-stacking-dao" with {auth-id, stx-amount}
        const structuredData =
          pool === "fast-pool"
            ? tupleCV({
                topic: stringAsciiCV("stack-stx-fast-pool"),
                "auth-id": uintCV(authId),
                "amount-ustx": uintCV(stxAmount),
              })
            : tupleCV({
                topic: stringAsciiCV("stake-stx-stacking-dao"),
                "auth-id": uintCV(authId),
                "stx-amount": uintCV(stxAmount),
              });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string; walletAddress: string; stxAmount: number; pool: string };
        }>("/api/pillar/stack-stx", {
          walletAddress: session.smartWallet,
          stxAmount,
          pool,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        const stxFormatted = (stxAmount / 1_000_000).toFixed(6);
        const poolLabel = pool === "fast-pool" ? "Fast Pool" : "Stacking DAO";

        return createJsonResponse({
          success: true,
          operation: pool === "fast-pool" ? "stack-stx-fast-pool" : "stake-stx-stacking-dao",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
          stxAmount,
          stxFormatted: `${stxFormatted} STX`,
          pool: poolLabel,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_revoke_fast_pool ---
  server.registerTool(
    "pillar_direct_revoke_fast_pool",
    {
      description:
        "Revoke Fast Pool STX delegation from your Pillar smart wallet. " +
        "Agent-signed, no browser needed. Backend sponsors gas. " +
        "After revoking, STX stays locked until the current PoX cycle ends, then returns to liquid.",
      inputSchema: {},
    },
    async () => {
      try {
        const guard = requireMainnet();
        if (guard) return guard;

        const { keyService, session } = await requireActiveKey();
        const authId = generateAuthId();

        const structuredData = tupleCV({
          topic: stringAsciiCV("revoke-fast-pool"),
          "auth-id": uintCV(authId),
        });

        const sigAuth = keyService.sign(structuredData, authId);
        const api = getPillarApi();
        const result = await api.post<{
          success: boolean;
          data: { txId: string };
        }>("/api/pillar/revoke-fast-pool", {
          walletAddress: session.smartWallet,
          sigAuth: formatSigAuthForApi(sigAuth),
        });

        return createJsonResponse({
          success: true,
          operation: "revoke-fast-pool",
          txId: result.data.txId,
          explorerUrl: getExplorerTxUrl(result.data.txId, NETWORK),
          walletAddress: session.smartWallet,
          note: "Delegation revoked. STX will unlock after the current PoX cycle ends.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- pillar_direct_stacking_status ---
  // Read-only — fetches STX balance (locked vs liquid), PoX cycle info,
  // and enrollment status from on-chain data.
  server.registerTool(
    "pillar_direct_stacking_status",
    {
      description:
        "Check stacking status for your Pillar smart wallet. " +
        "No signing needed — reads on-chain data. " +
        "Shows STX balance (locked vs liquid), current PoX cycle info, " +
        "and dual stacking enrollment status.",
      inputSchema: {},
    },
    async () => {
      try {
        const { session } = await requireActiveKey();
        const hiro = getHiroApi(NETWORK);

        // Fetch STX balance (includes locked amount from stacking)
        const stxBalance = await hiro.getStxBalance(session.smartWallet);

        const balanceMicro = BigInt(stxBalance.balance || "0");
        const lockedMicro = BigInt(stxBalance.locked || "0");
        const liquidMicro = balanceMicro - lockedMicro;

        // Fetch PoX cycle info
        let poxInfo: {
          currentCycleId: number;
          nextCycleId: number;
          blocksUntilNextCycle: number;
          minAmountUstx: number;
          isPoxActive: boolean;
        } | null = null;

        try {
          const pox = await hiro.getPoxInfo();
          poxInfo = {
            currentCycleId: pox.current_cycle.id,
            nextCycleId: pox.next_cycle.id,
            blocksUntilNextCycle: pox.next_cycle.blocks_until_reward_phase,
            minAmountUstx: pox.min_amount_ustx,
            isPoxActive: pox.current_cycle.is_pox_active,
          };
        } catch (err) {
          console.error("PoX info fetch failed:", err instanceof Error ? err.message : err);
        }

        // Check enrollment status via backend
        const api = getPillarApi();
        const walletName = getWalletName(session.smartWallet);

        let enrollmentStatus: {
          enrolled: boolean;
          dualStackingTxId: string | null;
        } = { enrolled: false, dualStackingTxId: null };

        try {
          const walletInfo = await api.get<{
            success: boolean;
            data: {
              status: string;
              dualStackingTxId?: string | null;
            } | null;
          }>(`/api/smart-wallet/${walletName}`);

          if (walletInfo.data) {
            enrollmentStatus = {
              enrolled: !!walletInfo.data.dualStackingTxId,
              dualStackingTxId: walletInfo.data.dualStackingTxId || null,
            };
          }
        } catch (err) {
          console.error("Enrollment status fetch failed:", err instanceof Error ? err.message : err);
        }

        const isStacking = lockedMicro > BigInt(0);

        return createJsonResponse({
          success: true,
          walletAddress: session.smartWallet,
          stxBalance: {
            total: formatStx(balanceMicro),
            totalMicroStx: stxBalance.balance,
            locked: formatStx(lockedMicro),
            lockedMicroStx: stxBalance.locked,
            liquid: formatStx(liquidMicro),
            lockHeight: stxBalance.lock_height || 0,
            burnchainUnlockHeight: stxBalance.burnchain_unlock_height || 0,
          },
          isStacking,
          enrollment: enrollmentStatus,
          poxCycle: poxInfo,
          message: isStacking
            ? `Stacking ${formatStx(lockedMicro)} (${formatStx(liquidMicro)} liquid). ` +
              `${enrollmentStatus.enrolled ? "Dual stacking enrolled." : "Not enrolled in dual stacking."}`
            : `Not currently stacking. ${formatStx(balanceMicro)} STX available. ` +
              `${enrollmentStatus.enrolled ? "Dual stacking enrolled." : "Not enrolled in dual stacking."}`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
