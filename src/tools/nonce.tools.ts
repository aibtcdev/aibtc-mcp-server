/**
 * Nonce Diagnostic Tools
 *
 * MCP tools for inspecting and recovering sender nonce state.
 * Complements the relay-diagnostic tools which focus on sponsor nonce state.
 *
 * @see https://github.com/aibtcdev/aibtc-mcp-server/issues/413
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { NETWORK } from "../services/x402.service.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { getHiroApi } from "../services/hiro-api.js";
import {
  getAddressState,
  reloadFromDisk,
  recordNonceUsed,
  STALE_NONCE_MS,
  type NonceHealthSnapshot,
} from "../services/nonce-tracker.js";
import {
  makeSTXTokenTransfer,
  broadcastTransaction,
} from "@stacks/transactions";
import { getStacksNetwork, getExplorerTxUrl } from "../config/networks.js";
import { resolveDefaultFee } from "../utils/fee.js";
import { SPONSOR_ADDRESSES } from "../utils/relay-health.js";

export function registerNonceTools(server: McpServer): void {
  // ============================================================================
  // nonce_health — surface local tracker state vs chain
  // ============================================================================
  server.registerTool(
    "nonce_health",
    {
      description: `Check the sender nonce health for the active wallet.

Compares the local nonce tracker state (persisted at ~/.aibtc/nonce-state.json)
against the chain's view from Hiro API. Use this to diagnose:
- Nonce conflicts (ConflictingNonceInMempool)
- Stuck transaction queues
- Gaps in the nonce sequence
- Stale local tracker state

Returns:
- local: lastUsedNonce, pending count, staleness
- chain: possibleNextNonce, lastExecuted, mempool nonces, missing nonces
- healthy: whether the nonce state looks good
- issues: list of detected problems with recommendations`,
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "STX address to check. Defaults to the active wallet address."
          ),
      },
    },
    async ({ address: inputAddress }) => {
      try {
        const walletAccount = getWalletManager().getAccount();
        const address = inputAddress || walletAccount?.address;

        if (!address) {
          return createJsonResponse({
            healthy: false,
            issues: [
              "No address provided and no wallet is unlocked. Provide an address or unlock a wallet first.",
            ],
          });
        }

        // Reload from disk to pick up changes from other processes (CLI skills)
        await reloadFromDisk();

        // Gather local and chain state in parallel
        const [localState, nonceInfo] = await Promise.all([
          getAddressState(address),
          getHiroApi(NETWORK)
            .getNonceInfo(address)
            .catch(() => null),
        ]);

        const issues: string[] = [];
        const STALE_MS = STALE_NONCE_MS;

        // Build local status
        const isStale = localState
          ? Date.now() - new Date(localState.lastUpdated).getTime() > STALE_MS
          : true;

        const local = localState
          ? {
              lastUsedNonce: localState.lastUsedNonce,
              lastUpdated: localState.lastUpdated,
              pendingCount: localState.pending.length,
              pendingLog: localState.pending.slice(-10), // last 10 for brevity
              isStale,
            }
          : {
              lastUsedNonce: null,
              lastUpdated: null,
              pendingCount: 0,
              pendingLog: [],
              isStale: true,
            };

        if (!localState) {
          issues.push(
            "No local nonce state for this address. State will be initialized on next transaction."
          );
        } else if (isStale) {
          issues.push(
            `Local nonce state is stale (last updated ${localState.lastUpdated}). Will re-sync from chain on next transaction.`
          );
        }

        // Build chain status
        const chain = nonceInfo
          ? {
              possibleNextNonce: nonceInfo.possible_next_nonce,
              lastExecutedNonce: nonceInfo.last_executed_tx_nonce,
              lastMempoolNonce: nonceInfo.last_mempool_tx_nonce,
              missingNonces: nonceInfo.detected_missing_nonces ?? [],
              mempoolNonces: nonceInfo.detected_mempool_nonces ?? [],
            }
          : null;

        if (!chain) {
          issues.push(
            "Could not fetch chain nonce info from Hiro API. The API may be temporarily unavailable."
          );
        }

        // Cross-check local vs chain
        if (localState && chain) {
          const localNext = localState.lastUsedNonce + 1;
          const chainNext = chain.possibleNextNonce;

          if (localNext > chainNext + 10) {
            issues.push(
              `Local tracker is far ahead of chain (local next=${localNext}, chain next=${chainNext}). ` +
                `This could indicate many pending transactions or a tracker bug. Check mempool.`
            );
          }

          if (chainNext > localNext && !isStale) {
            issues.push(
              `Chain advanced past local tracker (chain next=${chainNext}, local next=${localNext}). ` +
                `Transactions may have been sent outside this MCP server. Tracker will reconcile on next tx.`
            );
          }

          if (chain.missingNonces.length > 0) {
            issues.push(
              `Chain reports missing nonces: [${chain.missingNonces.join(", ")}]. ` +
                `These gaps will stall pending transactions. Use nonce_fill_gap to resolve.`
            );
          }
        }

        const healthy = issues.length === 0;

        const snapshot: NonceHealthSnapshot = {
          address,
          local: {
            lastUsedNonce: local.lastUsedNonce ?? -1,
            lastUpdated: local.lastUpdated ?? "never",
            pendingCount: local.pendingCount,
            isStale: local.isStale,
          },
          chain: chain ?? {
            possibleNextNonce: -1,
            lastExecutedNonce: -1,
            lastMempoolNonce: null,
            missingNonces: [],
            mempoolNonces: [],
          },
          healthy,
          issues,
        };

        return createJsonResponse({
          ...snapshot,
          pendingLog: local.pendingLog,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ============================================================================
  // nonce_fill_gap — send minimal self-transfer at a specific nonce
  // ============================================================================
  server.registerTool(
    "nonce_fill_gap",
    {
      description: `Fill a nonce gap by sending a minimal STX transfer at the specified nonce.

LAST-RESORT recovery action. Each gap-fill is a real on-chain transaction with a real
fee (~0.001-0.01 STX). Most gaps self-resolve within seconds as Stacks blocks are 3-5s.
Only use this after confirming the gap persists via nonce_health.

When transactions are pending but a gap exists in the nonce sequence (e.g., nonces
5 and 7 are pending but 6 is missing), the Stacks mempool will not process nonces
7+ until 6 is filled. This tool fills the gap with a 1 micro-STX transfer to the
PoX burn address.

Use nonce_health first to identify gaps, then call this tool for each missing nonce.

Requires the wallet to be unlocked. The fee is auto-estimated.`,
      inputSchema: {
        nonce: z
          .number()
          .int()
          .nonnegative()
          .describe("The specific nonce to fill"),
      },
    },
    async ({ nonce }) => {
      try {
        const walletAccount = getWalletManager().getAccount();

        if (!walletAccount) {
          return createJsonResponse({
            success: false,
            message:
              "Wallet must be unlocked to fill a nonce gap. Use wallet_unlock first.",
          });
        }

        // Send 1 uSTX to the PoX burn address (self-transfers are rejected by Stacks)
        const POX_BURN_ADDRESS = "SP000000000000000000002Q6VF78";
        const networkName = getStacksNetwork(NETWORK);
        const fee = await resolveDefaultFee(NETWORK, "token_transfer");

        const transaction = await makeSTXTokenTransfer({
          recipient: POX_BURN_ADDRESS,
          amount: 1n,
          senderKey: walletAccount.privateKey,
          network: networkName,
          memo: `nonce-fill:${nonce}`,
          nonce: BigInt(nonce),
          fee,
        });

        const broadcastResponse = await broadcastTransaction({
          transaction,
          network: networkName,
        });

        if ("error" in broadcastResponse) {
          return createJsonResponse({
            success: false,
            nonce,
            error: `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`,
          });
        }

        // Record in shared tracker
        await recordNonceUsed(walletAccount.address, nonce, broadcastResponse.txid);

        return createJsonResponse({
          success: true,
          nonce,
          txid: broadcastResponse.txid,
          explorer: getExplorerTxUrl(broadcastResponse.txid, NETWORK),
          message: `Gap-fill transaction sent at nonce ${nonce}. txid: ${broadcastResponse.txid}`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ============================================================================
  // tx_status_deep — cross-reference sender pending txids with sponsor mempool
  // ============================================================================
  server.registerTool(
    "tx_status_deep",
    {
      description: `Deep diagnostic view correlating sender nonces with sponsor nonces for sponsored transactions.

Reads the sender's local pending txid log and cross-references each entry against
the sponsor's mempool to show the full lifecycle of sponsored transactions:
- Which sender nonce maps to which sponsor nonce
- Whether sponsor nonce gaps are blocking specific transactions
- Which pending txids are missing from the sponsor mempool entirely
- Multiple competing txids (RBF candidates) for the same sender nonce slot

Output per nonce slot:
  Sender nonce N:
    - 0xabc (sponsored, sponsor nonce 47) -- BLOCKED by missing sponsor nonces [44, 45]
    - 0xdef (direct, fee 0.01 STX) -- competing RBF candidate
  Sender nonce M (0xghi, sponsored) -> sponsor nonce 48 -- pending, no gaps ahead
  Sender nonce P (0xjkl, sponsored) -> NOT IN SPONSOR MEMPOOL

Use this when check_relay_health shows issues but you need per-transaction clarity.
Returns structured JSON with pendingSlots, sponsorMissingNonces, and summary counts.`,
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "STX address to check. Defaults to the active wallet address."
          ),
      },
    },
    async ({ address: inputAddress }) => {
      try {
        const walletAccount = getWalletManager().getAccount();
        const address = inputAddress || walletAccount?.address;

        if (!address) {
          return createJsonResponse({
            error:
              "No address provided and no wallet is unlocked. Provide an address or unlock a wallet first.",
            pendingSlots: [],
            summary: { total: 0, sponsored: 0, direct: 0, blocked: 0, notInSponsorMempool: 0 },
          });
        }

        // Reload from disk to pick up changes from other processes
        await reloadFromDisk();

        const localState = await getAddressState(address);

        if (!localState || localState.pending.length === 0) {
          return createJsonResponse({
            address,
            pendingSlots: [],
            sponsorAddress: SPONSOR_ADDRESSES[NETWORK] ?? null,
            sponsorMissingNonces: [],
            summary: { total: 0, sponsored: 0, direct: 0, blocked: 0, notInSponsorMempool: 0 },
            message: "No pending transactions in local tracker for this address.",
          });
        }

        // Group pending log entries by nonce (handle RBF — multiple txids per nonce)
        const byNonce = new Map<number, { nonce: number; txid: string; timestamp: string }[]>();
        for (const entry of localState.pending) {
          const existing = byNonce.get(entry.nonce) ?? [];
          existing.push(entry);
          byNonce.set(entry.nonce, existing);
        }

        // Determine sponsor address for this network
        const sponsorAddress = SPONSOR_ADDRESSES[NETWORK];

        // Fetch sponsor data (best-effort — failures degrade gracefully)
        let sponsorMempoolIndex = new Map<string, { nonce: number; sponsor_nonce?: number; fee_rate: string; tx_status: string; sponsored: boolean }>();
        let sponsorMissingNonces: number[] = [];

        if (sponsorAddress) {
          const hiroApi = getHiroApi(NETWORK);

          // Fetch sponsor mempool txs and nonce gaps in parallel
          const [sponsorMempoolResult, sponsorNonceInfo] = await Promise.all([
            hiroApi
              .getMempoolTransactions({ sender_address: sponsorAddress, limit: 200 })
              .catch(() => null),
            hiroApi.getNonceInfo(sponsorAddress).catch(() => null),
          ]);

          if (sponsorMempoolResult) {
            for (const tx of sponsorMempoolResult.results) {
              sponsorMempoolIndex.set(tx.tx_id, {
                nonce: tx.nonce,
                sponsor_nonce: tx.sponsor_nonce,
                fee_rate: tx.fee_rate ?? "unknown",
                tx_status: tx.tx_status,
                sponsored: tx.sponsored ?? false,
              });
            }
          }

          if (sponsorNonceInfo) {
            sponsorMissingNonces = sponsorNonceInfo.detected_missing_nonces ?? [];
          }
        }

        const sponsorMissingSet = new Set(sponsorMissingNonces);

        // Build diagnostic per nonce slot
        const pendingSlots: Array<{
          senderNonce: number;
          candidates: Array<{
            txid: string;
            timestamp: string;
            sponsored: boolean;
            sponsorNonce?: number;
            feeRate?: string;
            txStatus?: string;
            inSponsorMempool: boolean;
            blocked: boolean;
            blockingGaps?: number[];
          }>;
        }> = [];

        const sortedNonces = [...byNonce.keys()].sort((a, b) => a - b);

        let totalSponsored = 0;
        let totalDirect = 0;
        let totalBlocked = 0;
        let totalNotInSponsorMempool = 0;

        for (const senderNonce of sortedNonces) {
          const entries = byNonce.get(senderNonce)!;
          const candidates: typeof pendingSlots[0]["candidates"] = [];

          for (const entry of entries) {
            const sponsorTx = sponsorMempoolIndex.get(entry.txid);
            const inSponsorMempool = !!sponsorTx;
            const isSponsored = inSponsorMempool ? (sponsorTx!.sponsored || sponsorTx!.sponsor_nonce !== undefined) : false;

            let blocked = false;
            let blockingGaps: number[] = [];

            if (isSponsored && sponsorTx?.sponsor_nonce !== undefined) {
              // Find sponsor nonce gaps below this tx's sponsor_nonce that would block it
              blockingGaps = sponsorMissingNonces.filter(
                (missing) => missing < sponsorTx!.sponsor_nonce!
              );
              blocked = blockingGaps.length > 0;
            }

            candidates.push({
              txid: entry.txid,
              timestamp: entry.timestamp,
              sponsored: isSponsored,
              ...(sponsorTx?.sponsor_nonce !== undefined
                ? { sponsorNonce: sponsorTx.sponsor_nonce }
                : {}),
              ...(sponsorTx ? { feeRate: sponsorTx.fee_rate, txStatus: sponsorTx.tx_status } : {}),
              inSponsorMempool,
              blocked,
              ...(blockingGaps.length > 0 ? { blockingGaps } : {}),
            });

            if (isSponsored) totalSponsored++;
            else totalDirect++;
            if (blocked) totalBlocked++;
            if (!inSponsorMempool) totalNotInSponsorMempool++;
          }

          pendingSlots.push({ senderNonce, candidates });
        }

        const total = localState.pending.length;

        return createJsonResponse({
          address,
          pendingSlots,
          sponsorAddress: sponsorAddress ?? null,
          sponsorMissingNonces,
          summary: {
            total,
            sponsored: totalSponsored,
            direct: totalDirect,
            blocked: totalBlocked,
            notInSponsorMempool: totalNotInSponsorMempool,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
