/**
 * Lightning Network (L402) tools.
 *
 * Exposes MCP tools for managing an embedded Spark-backed Lightning wallet,
 * funding it from the user's L1 BTC wallet, and paying / creating Lightning
 * invoices. The L402 interceptor in src/services/x402.service.ts uses the
 * same LightningProvider singleton to auto-pay invoice challenges on 402s.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getLightningManager } from "../services/lightning-manager.js";
import { getWalletManager } from "../services/wallet-manager.js";
import {
  MempoolApi,
  getMempoolTxUrl,
  type UTXO,
} from "../services/mempool-api.js";
import { buildAndSignBtcTransaction } from "../transactions/bitcoin-builder.js";
import { OrdinalIndexer } from "../services/ordinal-indexer.js";
import { NETWORK } from "../config/networks.js";

export function registerLightningTools(server: McpServer): void {
  // --- Wallet lifecycle -----------------------------------------------------

  server.registerTool(
    "lightning_create",
    {
      description:
        "Create a new embedded Lightning wallet backed by the Spark SDK. " +
        "Generates a fresh BIP39 mnemonic (shown once), encrypts it with the " +
        "provided password, and stores it at ~/.aibtc/lightning/keystore.json. " +
        "Returns the deposit address for funding the wallet from L1 BTC.",
      inputSchema: {
        name: z.string().describe("Name for the Lightning wallet (e.g., 'main')"),
        password: z
          .string()
          .min(8)
          .describe(
            "Password to protect the Lightning wallet (minimum 8 characters) - WARNING: sensitive value"
          ),
      },
    },
    async ({ name, password }) => {
      try {
        const manager = getLightningManager();
        const result = await manager.createWallet(password, name);
        return createJsonResponse({
          success: true,
          message:
            "Lightning wallet created. Save the mnemonic — it will NOT be shown again.",
          walletId: result.walletId,
          lightningAddress: result.lightningAddress,
          depositAddress: result.depositAddress,
          mnemonic: result.mnemonic,
          network: NETWORK,
          nextSteps: [
            "Save the mnemonic in a secure location.",
            "Use lightning_fund_from_btc to deposit L1 BTC into the wallet, then claim it once confirmed.",
          ],
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "lightning_import",
    {
      description:
        "Import an existing Lightning wallet into the embedded Spark-backed " +
        "store from a BIP39 mnemonic phrase. Encrypted locally at " +
        "~/.aibtc/lightning/keystore.json.",
      inputSchema: {
        name: z.string().describe("Name for the Lightning wallet"),
        mnemonic: z
          .string()
          .describe("BIP39 mnemonic phrase - WARNING: sensitive value"),
        password: z
          .string()
          .min(8)
          .describe(
            "Password to protect the Lightning wallet (minimum 8 characters) - WARNING: sensitive value"
          ),
      },
    },
    async ({ name, mnemonic, password }) => {
      try {
        const manager = getLightningManager();
        const result = await manager.importWallet(mnemonic, password, name);
        return createJsonResponse({
          success: true,
          message: "Lightning wallet imported.",
          walletId: result.walletId,
          lightningAddress: result.lightningAddress,
          depositAddress: result.depositAddress,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "lightning_unlock",
    {
      description:
        "Unlock the Lightning wallet for the current session. Required before " +
        "paying or creating invoices, and before the L402 interceptor can " +
        "auto-pay challenges.",
      inputSchema: {
        password: z.string().describe("Wallet password - WARNING: sensitive value"),
      },
    },
    async ({ password }) => {
      try {
        const manager = getLightningManager();
        const result = await manager.unlock(password);
        return createJsonResponse({
          success: true,
          message: "Lightning wallet unlocked.",
          walletId: result.walletId,
          lightningAddress: result.lightningAddress,
          balanceSats: result.balanceSats,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "lightning_lock",
    {
      description:
        "Lock the Lightning wallet and drop the Spark session from memory. " +
        "L402 auto-pay will stop working until the wallet is unlocked again.",
    },
    async () => {
      try {
        const manager = getLightningManager();
        manager.lock();
        return createJsonResponse({
          success: true,
          message: "Lightning wallet locked.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "lightning_status",
    {
      description:
        "Get the status of the embedded Lightning wallet: whether it's " +
        "unlocked, its wallet id, current balance (if unlocked), deposit " +
        "address, and optional Lightning address.",
    },
    async () => {
      try {
        const manager = getLightningManager();
        const status = await manager.getStatus();
        return createJsonResponse(status);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- L1 → LN funding ------------------------------------------------------

  server.registerTool(
    "lightning_fund_from_btc",
    {
      description:
        "Fund the Lightning wallet from the user's L1 BTC wallet. " +
        "Sends BTC to the Spark deposit address and returns the L1 txid. " +
        "After the transaction confirms on-chain, the deposit must be " +
        "claimed to credit the Lightning balance (separate follow-up step; " +
        "not automated in this PR). Requires the main wallet to be unlocked " +
        "AND the Lightning wallet to be unlocked (to fetch the deposit address).",
      inputSchema: {
        amountSats: z
          .number()
          .int()
          .positive()
          .describe("Amount to deposit in satoshis (1 BTC = 100,000,000 satoshis)"),
        feeRate: z
          .union([
            z.enum(["fast", "medium", "slow"]),
            z.number().int().positive(),
          ])
          .optional()
          .default("medium")
          .describe(
            "Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or number in sat/vB"
          ),
      },
    },
    async ({ amountSats, feeRate }) => {
      try {
        // Lightning wallet must be unlocked so we can fetch a deposit address.
        const ln = getLightningManager();
        const lnProvider = ln.getProvider();
        if (!lnProvider) {
          throw new Error(
            "Lightning wallet is locked. Use lightning_unlock first so we can fetch a deposit address."
          );
        }

        // L1 BTC wallet must be unlocked for signing.
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error(
            "Wallet is not unlocked. Use wallet_unlock first to enable transactions."
          );
        }
        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error(
            "Bitcoin keys not available. Please unlock your wallet again."
          );
        }

        const depositAddress = await lnProvider.getDepositAddress();

        const api = new MempoolApi(NETWORK);

        // Prefer cardinal UTXOs on mainnet so we don't burn inscriptions.
        let utxos: UTXO[];
        let testnetWarning = "";
        if (NETWORK === "testnet") {
          utxos = await api.getUtxos(account.btcAddress);
          testnetWarning =
            " Ordinal protection is not available on testnet. All UTXOs were used.";
        } else {
          const indexer = new OrdinalIndexer(NETWORK);
          utxos = await indexer.getCardinalUtxos(account.btcAddress);
        }

        if (utxos.length === 0) {
          throw new Error(
            `No cardinal UTXOs available for address ${account.btcAddress}. ` +
              `Deposit L1 BTC to this address before funding Lightning.`
          );
        }

        let resolvedFeeRate: number;
        if (typeof feeRate === "number") {
          resolvedFeeRate = feeRate;
        } else {
          const tiers = await api.getFeeTiers();
          resolvedFeeRate =
            feeRate === "fast"
              ? tiers.fast
              : feeRate === "slow"
              ? tiers.slow
              : tiers.medium;
        }

        const txResult = buildAndSignBtcTransaction(
          {
            utxos,
            recipient: depositAddress,
            amount: amountSats,
            feeRate: resolvedFeeRate,
            senderPubKey: account.btcPublicKey,
            senderAddress: account.btcAddress,
            network: NETWORK,
          },
          account.btcPrivateKey
        );

        const txid = await api.broadcastTransaction(txResult.txHex);

        const response: Record<string, unknown> = {
          success: true,
          btcTxid: txid,
          amountSats,
          depositAddress,
          explorerUrl: getMempoolTxUrl(txid, NETWORK),
          feeSats: txResult.fee,
          feeRateUsed: `${resolvedFeeRate} sat/vB`,
          estimatedConfirmation:
            feeRate === "fast"
              ? "~10 minutes"
              : feeRate === "slow"
              ? "~1 hour"
              : "~30 minutes",
          nextStep:
            "Once this transaction confirms on-chain, the deposit must be claimed " +
            "to credit the Lightning balance. Automatic claim is out of scope for this PR.",
        };
        if (testnetWarning) {
          response.warning = testnetWarning.trim();
        }
        return createJsonResponse(response);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "lightning_claim_deposit",
    {
      description:
        "Claim a confirmed BTC L1 deposit into the Spark Lightning wallet. " +
        "Call this AFTER lightning_fund_from_btc and after the on-chain " +
        "transaction has 3 confirmations. Fetches a signed quote from the " +
        "SSP, submits the claim, and returns the credited sats + Spark " +
        "transfer id. Requires an unlocked Lightning wallet.",
      inputSchema: {
        transactionId: z
          .string()
          .describe("Bitcoin txid of the deposit transaction"),
        outputIndex: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Vout index of the deposit output (default: SSP auto-detects)"
          ),
      },
    },
    async ({ transactionId, outputIndex }) => {
      try {
        const manager = getLightningManager();
        const provider = manager.getProvider();
        if (!provider) {
          throw new Error(
            "Lightning wallet not unlocked. Run lightning_unlock first."
          );
        }
        const result = await provider.claimDeposit(transactionId, outputIndex);
        return createJsonResponse({
          success: true,
          ...result,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- Manual Lightning ops -------------------------------------------------

  server.registerTool(
    "lightning_pay_invoice",
    {
      description:
        "Pay a BOLT-11 Lightning invoice from the embedded Lightning wallet. " +
        "Returns the payment preimage (proof of payment) and fees paid.",
      inputSchema: {
        bolt11: z
          .string()
          .describe("BOLT-11 encoded Lightning invoice (starts with lnbc... or lntb...)"),
        maxFeeSats: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            "Maximum routing fee to pay in sats (provider default applies when omitted)"
          ),
      },
    },
    async ({ bolt11, maxFeeSats }) => {
      try {
        const manager = getLightningManager();
        const provider = manager.getProvider();
        if (!provider) {
          throw new Error(
            "Lightning wallet is locked. Use lightning_unlock first."
          );
        }
        const result = await provider.payInvoice(bolt11, maxFeeSats);
        return createJsonResponse({
          success: true,
          preimage: result.preimage,
          feesPaidSats: result.feesPaid,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "lightning_create_invoice",
    {
      description:
        "Create a BOLT-11 Lightning invoice that can receive a payment into " +
        "the embedded Lightning wallet.",
      inputSchema: {
        amountSats: z
          .number()
          .int()
          .positive()
          .describe("Amount to request in satoshis"),
        memo: z
          .string()
          .optional()
          .describe("Optional description attached to the invoice"),
      },
    },
    async ({ amountSats, memo }) => {
      try {
        const manager = getLightningManager();
        const provider = manager.getProvider();
        if (!provider) {
          throw new Error(
            "Lightning wallet is locked. Use lightning_unlock first."
          );
        }
        const result = await provider.createInvoice(amountSats, memo);
        return createJsonResponse({
          success: true,
          bolt11: result.bolt11,
          paymentHash: result.paymentHash,
          amountSats,
          memo,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
