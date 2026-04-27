/**
 * Styx BTC→sBTC conversion tools
 *
 * Headless BTC→sBTC conversion via the Styx protocol (btc2sbtc.com).
 * Uses @faktoryfun/styx-sdk for deposit reservation and tracking,
 * @scure/btc-signer for local PSBT construction and signing,
 * mempool.space for broadcast.
 *
 * Tools:
 * - styx_pool_status: Pool liquidity info
 * - styx_pools: All available pools
 * - styx_fees: Bitcoin fee estimates
 * - styx_price: BTC price in USD
 * - styx_deposit: Full headless deposit flow
 * - styx_status: Deposit status by ID or txid
 * - styx_history: Deposit history for a Stacks address
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import {
  styxSDK,
  MIN_DEPOSIT_SATS,
} from "@faktoryfun/styx-sdk";
import type {
  FeePriority,
  PoolStatus,
  FeeEstimates,
  Deposit,
  PoolConfig,
} from "@faktoryfun/styx-sdk";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import { UnisatIndexer } from "../services/unisat-indexer.js";
import { getBtcNetwork } from "../transactions/bitcoin-builder.js";

const FEE_PRIORITIES = ["low", "medium", "high"] as const;

export function registerStyxTools(server: McpServer): void {
  // ---------------------------------------------------------------------------
  // styx_pool_status
  // ---------------------------------------------------------------------------
  server.registerTool(
    "styx_pool_status",
    {
      description:
        "Get current Styx pool liquidity and status. " +
        "Shows realAvailable and estimatedAvailable BTC in the pool.",
      inputSchema: {
        pool: z
          .string()
          .optional()
          .describe('Pool ID: "main" (300k sat max) or "aibtc" (1M sat max). Defaults to "main".'),
      },
    },
    async ({ pool = "main" }) => {
      try {
        const status: PoolStatus = await styxSDK.getPoolStatus(pool);
        return createJsonResponse({
          pool,
          realAvailable: status.realAvailable,
          estimatedAvailable: status.estimatedAvailable,
          estimatedAvailableSats: Math.round(status.estimatedAvailable * 1e8),
          lastUpdated: status.lastUpdated,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // styx_pools
  // ---------------------------------------------------------------------------
  server.registerTool(
    "styx_pools",
    {
      description:
        "List all available Styx pools with their configurations. " +
        "Pools: main (up to 300k sats, sbtc/usda/pepe), aibtc (up to 1M sats, sbtc/aibtc). " +
        "Minimum deposit: 10,000 sats for both pools.",
      inputSchema: {},
    },
    async () => {
      try {
        const pools: PoolConfig[] = await styxSDK.getAvailablePools();
        return createJsonResponse({ pools, network: NETWORK });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // styx_fees
  // ---------------------------------------------------------------------------
  server.registerTool(
    "styx_fees",
    {
      description: "Get current Bitcoin network fee estimates (sat/vB) from Styx: low, medium, high.",
      inputSchema: {},
    },
    async () => {
      try {
        const fees: FeeEstimates = await styxSDK.getFeeEstimates();
        return createJsonResponse({ ...fees, network: NETWORK });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // styx_price
  // ---------------------------------------------------------------------------
  server.registerTool(
    "styx_price",
    {
      description: "Get current BTC price in USD from Styx.",
      inputSchema: {},
    },
    async () => {
      try {
        const price = await styxSDK.getBTCPrice();
        return createJsonResponse({ priceUsd: price, network: NETWORK });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // styx_deposit
  // ---------------------------------------------------------------------------
  server.registerTool(
    "styx_deposit",
    {
      description:
        "Full headless BTC→sBTC deposit via the Styx protocol. " +
        "Flow: reserve pool liquidity → build PSBT locally → sign with wallet keys → " +
        "broadcast to mempool.space → update deposit status. " +
        "Requires an unlocked wallet with sufficient BTC balance. " +
        "On mainnet, ordinal UTXOs are automatically filtered out to protect inscriptions. " +
        "Minimum deposit: 10,000 sats. Pool limits: main=300k sats, aibtc=1M sats.",
      inputSchema: {
        amount: z
          .coerce
          .number()
          .int()
          .min(MIN_DEPOSIT_SATS)
          .describe(`Amount to deposit in satoshis (min ${MIN_DEPOSIT_SATS}). Example: 50000`),
        stxReceiver: z
          .string()
          .optional()
          .describe("Stacks address to receive sBTC. Uses active wallet address if omitted."),
        btcSender: z
          .string()
          .optional()
          .describe(
            "BTC address sending funds. Must match the active wallet's BTC address. " +
              "Uses active wallet if omitted."
          ),
        pool: z
          .string()
          .optional()
          .describe('Pool ID: "main" or "aibtc". Defaults to "main".'),
        fee: z
          .enum(["low", "medium", "high"])
          .optional()
          .describe('Fee priority: "low", "medium", or "high". Defaults to "medium".'),
      },
    },
    async ({ amount, stxReceiver, btcSender, pool = "main", fee = "medium" }) => {
      let depositId: string | undefined;
      let broadcastTxid: string | undefined;

      try {
        // amount is validated by z.coerce.number().int().min(MIN_DEPOSIT_SATS) — no manual checks needed
        const amountSats = amount;

        // Validate fee priority (belt-and-suspenders since zod enum already validates)
        const feePriority = fee as FeePriority;
        if (!FEE_PRIORITIES.includes(feePriority)) {
          throw new Error(
            `Invalid fee value "${fee}". Must be one of: ${FEE_PRIORITIES.join(", ")}`
          );
        }

        // Get wallet
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error("Wallet is not unlocked. Unlock your wallet first.");
        }
        if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error("Bitcoin keys not available. Unlock your wallet again.");
        }

        // Validate btcSender if provided — must match the active wallet
        if (btcSender && btcSender !== account.btcAddress) {
          throw new Error(
            `btcSender "${btcSender}" must match the active wallet BTC address ` +
              `(${account.btcAddress}). This tool signs with the active wallet's keys.`
          );
        }
        const resolvedBtcSender = account.btcAddress;
        const resolvedStxReceiver = stxReceiver || account.address;

        // Check pool liquidity
        const poolStatus = await styxSDK.getPoolStatus(pool);
        const availableSats = Math.round(poolStatus.estimatedAvailable * 1e8);
        if (amountSats > availableSats) {
          throw new Error(
            `Insufficient pool liquidity: need ${amountSats} sats, pool has ~${availableSats} sats`
          );
        }

        // Step 1: Reserve pool liquidity
        const btcAmount = (amountSats / 1e8).toFixed(8);
        depositId = await styxSDK.createDeposit({
          btcAmount: parseFloat(btcAmount),
          stxReceiver: resolvedStxReceiver,
          btcSender: resolvedBtcSender,
          poolId: pool,
        });

        // Step 2: Prepare transaction (UTXOs, deposit address, OP_RETURN)
        const prepared = await styxSDK.prepareTransaction({
          amount: btcAmount,
          userAddress: resolvedStxReceiver,
          btcAddress: resolvedBtcSender,
          feePriority,
          walletProvider: null,
          poolId: pool,
        });

        // Step 3: Filter ordinal/rune UTXOs to protect inscriptions and runes
        let safeUtxos = prepared.utxos;
        let ordinalsFiltered = false;
        const indexer = new UnisatIndexer(NETWORK);
        const cardinalUtxos = await indexer.getCardinalUtxos(resolvedBtcSender);
        const cardinalSet = new Set(
          cardinalUtxos.map((u) => `${u.txid}:${u.vout}`)
        );
        const filtered = prepared.utxos.filter((u) =>
          cardinalSet.has(`${u.txid}:${u.vout}`)
        );
        if (filtered.length < prepared.utxos.length) {
          const removed = prepared.utxos.length - filtered.length;
          if (filtered.length === 0) {
            throw new Error(
              `All ${removed} UTXO(s) selected by Styx carry inscriptions or runes. ` +
                "Cannot deposit without risking inscription or rune loss."
            );
          }
          // Recompute change after removing ordinal/rune inputs
          const originalTotal = prepared.utxos.reduce((sum, u) => sum + u.value, 0);
          const filteredTotal = filtered.reduce((sum, u) => sum + u.value, 0);
          const originalFee =
            originalTotal - prepared.amountInSatoshis - prepared.changeAmount;
          if (originalFee < 0) {
            throw new Error(
              "Invalid Styx transaction preparation: negative implied fee."
            );
          }
          const requiredTotal = prepared.amountInSatoshis + originalFee;
          if (filteredTotal < requiredTotal) {
            throw new Error(
              `After removing ${removed} inscription/rune UTXO(s), remaining cardinal balance ` +
                `(${filteredTotal} sats) is insufficient for deposit (${amountSats} sats) ` +
                `and fee (${originalFee} sats).`
            );
          }
          prepared.changeAmount =
            filteredTotal - prepared.amountInSatoshis - originalFee;
          ordinalsFiltered = true;
        }
        safeUtxos = filtered;

        // Step 4: Build PSBT locally with @scure/btc-signer
        const btcNetwork = getBtcNetwork(NETWORK);
        const tx = new btc.Transaction({ allowUnknownOutputs: true });
        const senderP2wpkh = btc.p2wpkh(account.btcPublicKey, btcNetwork);

        for (const utxo of safeUtxos) {
          tx.addInput({
            txid: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              script: senderP2wpkh.script,
              amount: BigInt(utxo.value),
            },
          });
        }

        // OP_RETURN output FIRST (output index 0) — Styx contract requires OP_RETURN at index 0
        // Styx SDK provides a full script hex (starts with 6a = OP_RETURN opcode)
        if (prepared.opReturnData) {
          tx.addOutput({
            script: hex.decode(prepared.opReturnData),
            amount: BigInt(0),
          });
        }

        // Deposit output to Styx address (output index 1)
        tx.addOutputAddress(
          prepared.depositAddress,
          BigInt(prepared.amountInSatoshis),
          btcNetwork
        );

        // Change output
        if (prepared.changeAmount > 0) {
          tx.addOutputAddress(
            resolvedBtcSender,
            BigInt(prepared.changeAmount),
            btcNetwork
          );
        }

        // Step 5: Sign and finalize
        tx.sign(account.btcPrivateKey);
        tx.finalize();

        // Step 6: Broadcast
        const mempoolApi = new MempoolApi(NETWORK);
        broadcastTxid = await mempoolApi.broadcastTransaction(tx.hex);

        // Step 7: Update deposit status (retry once on failure)
        let statusUpdateWarning: string | undefined;
        const statusPayload = {
          id: depositId,
          data: { btcTxId: broadcastTxid, status: "broadcast" as const },
        };
        try {
          await styxSDK.updateDepositStatus(statusPayload);
        } catch (statusError) {
          try {
            await styxSDK.updateDepositStatus(statusPayload);
          } catch {
            statusUpdateWarning =
              "Deposit broadcast succeeded but status update failed after retry. " +
              "Save depositId and txid for manual recovery. " +
              (statusError instanceof Error
                ? statusError.message
                : String(statusError));
          }
        }

        return createJsonResponse({
          success: true,
          depositId,
          txid: broadcastTxid,
          explorerUrl: getMempoolTxUrl(broadcastTxid, NETWORK),
          amount: { sats: amountSats, btc: btcAmount },
          pool,
          depositAddress: prepared.depositAddress,
          // fee/feeRate are omitted when ordinal filtering occurred — those values were
          // computed against the original UTXO set and no longer reflect the actual tx
          ...(ordinalsFiltered
            ? { feeNote: "fee metadata omitted — UTXO set was filtered for ordinals" }
            : { fee: prepared.fee, feeRate: prepared.feeRate }),
          status: "broadcast",
          network: NETWORK,
          note: "sBTC will be credited to your Stacks address after Bitcoin confirmation.",
          ...(statusUpdateWarning ? { warning: statusUpdateWarning } : {}),
        });
      } catch (error) {
        // Best-effort: cancel reservation if we never broadcast
        if (depositId && !broadcastTxid) {
          try {
            await styxSDK.updateDepositStatus({
              id: depositId,
              data: { status: "canceled" },
            });
          } catch {
            // Reservation will expire server-side; don't mask the original error
          }
        }
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // styx_status
  // ---------------------------------------------------------------------------
  server.registerTool(
    "styx_status",
    {
      description:
        "Check the status of a Styx BTC→sBTC deposit by deposit ID or Bitcoin transaction ID.",
      inputSchema: {
        id: z.string().optional().describe("Styx deposit ID"),
        txid: z.string().optional().describe("Bitcoin transaction ID"),
      },
    },
    async ({ id, txid }) => {
      try {
        if (!id && !txid) {
          throw new Error("Provide either id (deposit ID) or txid (Bitcoin transaction ID).");
        }
        let deposit: Deposit;
        if (id) {
          deposit = await styxSDK.getDepositStatus(id);
        } else {
          deposit = await styxSDK.getDepositStatusByTxId(txid!);
        }
        return createJsonResponse({
          id: deposit.id,
          status: deposit.status,
          btcAmount: deposit.btcAmount,
          sbtcAmount: deposit.sbtcAmount,
          stxReceiver: deposit.stxReceiver,
          btcSender: deposit.btcSender,
          btcTxId: deposit.btcTxId,
          stxTxId: deposit.stxTxId,
          createdAt: deposit.createdAt,
          updatedAt: deposit.updatedAt,
          network: NETWORK,
          explorerUrl: deposit.btcTxId
            ? getMempoolTxUrl(deposit.btcTxId, NETWORK)
            : null,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---------------------------------------------------------------------------
  // styx_history
  // ---------------------------------------------------------------------------
  server.registerTool(
    "styx_history",
    {
      description:
        "Get BTC→sBTC deposit history for a Stacks address via Styx. " +
        "Uses the active wallet's Stacks address if no address is provided.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Stacks address to query. Uses active wallet if omitted."),
      },
    },
    async ({ address }) => {
      try {
        let resolvedAddress = address;
        if (!resolvedAddress) {
          const walletManager = getWalletManager();
          const account = walletManager.getActiveAccount();
          if (!account) {
            throw new Error("No address provided and wallet is not unlocked.");
          }
          resolvedAddress = account.address;
        }

        const deposits: Deposit[] = await styxSDK.getDepositHistory(resolvedAddress);
        return createJsonResponse({
          address: resolvedAddress,
          count: deposits.length,
          network: NETWORK,
          deposits: deposits.map((d) => ({
            id: d.id,
            status: d.status,
            btcAmount: d.btcAmount,
            sbtcAmount: d.sbtcAmount,
            btcTxId: d.btcTxId,
            createdAt: d.createdAt,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
