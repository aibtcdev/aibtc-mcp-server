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

/** PoX burn address used as the recipient for gap-fill/RBF self-transfers. */
const POX_BURN_ADDRESS = "SP000000000000000000002Q6VF78";

/** Result of a single gap-fill broadcast attempt. */
interface GapFillResult {
  nonce: number;
  txid: string | null;
  status: "broadcast" | "failed";
  error?: string;
  explorer?: string;
}

/**
 * Broadcast a 1 uSTX gap-fill transaction at the given nonce.
 *
 * Shared by both the nonce_fill_gap tool (single gap) and nonce_heal
 * (batch gaps). Records the nonce in the shared tracker on success.
 */
async function broadcastGapFill(
  privateKey: string,
  senderAddress: string,
  nonce: number,
  fee: bigint,
): Promise<GapFillResult> {
  const networkName = getStacksNetwork(NETWORK);
  const transaction = await makeSTXTokenTransfer({
    recipient: POX_BURN_ADDRESS,
    amount: 1n,
    senderKey: privateKey,
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
    return {
      nonce,
      txid: null,
      status: "failed",
      error: `${broadcastResponse.error} - ${broadcastResponse.reason}`,
    };
  }

  await recordNonceUsed(senderAddress, nonce, broadcastResponse.txid);

  return {
    nonce,
    txid: broadcastResponse.txid,
    status: "broadcast",
    explorer: getExplorerTxUrl(broadcastResponse.txid, NETWORK),
  };
}

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

        // Build local status
        const isStale = localState
          ? Date.now() - new Date(localState.lastUpdated).getTime() > STALE_NONCE_MS
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

        const fee = await resolveDefaultFee(NETWORK, "token_transfer");
        const result = await broadcastGapFill(
          walletAccount.privateKey,
          walletAccount.address,
          nonce,
          fee,
        );

        if (result.status === "failed") {
          return createJsonResponse({
            success: false,
            nonce,
            error: `Broadcast failed: ${result.error}`,
          });
        }

        return createJsonResponse({
          success: true,
          nonce,
          txid: result.txid,
          explorer: result.explorer,
          message: `Gap-fill transaction sent at nonce ${nonce}. txid: ${result.txid}`,
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

  // ============================================================================
  // nonce_heal — diagnose, fill gaps, and optionally RBF-bump the chain head
  // ============================================================================
  server.registerTool(
    "nonce_heal",
    {
      description: `Diagnose and heal the full nonce state for the active wallet in one shot.

Handles 90% of stuck-tx cases automatically:
1. Fetches current nonce state from Hiro API (gaps, mempool)
2. In dryRun mode: shows what would happen without broadcasting
3. In execute mode (dryRun=false):
   - Fills every gap with a 1 uSTX self-transfer to the PoX burn address
   - Optionally RBF-bumps the chain head (lowest non-gap pending tx) to kick off processing

RBF bump behavior:
- Token-transfer txs: rebuilt at same nonce with fee * feeMultiplier and rebroadcast
- Sponsored txs: skipped with explanation (sender cannot RBF without sponsor key)
- Contract-call txs: skipped with manual RBF instructions

Always run nonce_health first to understand the current state.
Requires wallet to be unlocked for execute mode (dryRun=false).

Returns:
- address, dryRun flag, confirmedNonce
- gapsFound: list of missing nonces
- actions: per-action detail (fill_gap or bump_head) with txids, fees, status
- warnings: informational notes
- summary: human-readable description of what happened`,
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "STX address to heal. Defaults to the active wallet address."
          ),
        dryRun: z
          .boolean()
          .default(true)
          .describe(
            "If true (default), preview proposed actions without broadcasting. Set to false to execute."
          ),
        bumpHead: z
          .boolean()
          .default(true)
          .describe(
            "Whether to RBF-bump the first real pending tx (chain head) after filling gaps. Default true."
          ),
        feeMultiplier: z
          .number()
          .min(1.1)
          .default(1.5)
          .describe(
            "Fee multiplier for RBF bump (e.g. 1.5 = 50% higher fee). Minimum 1.1. Default 1.5."
          ),
      },
    },
    async ({ address: inputAddress, dryRun, bumpHead, feeMultiplier }) => {
      try {
        const walletAccount = getWalletManager().getAccount();
        const address = inputAddress || walletAccount?.address;

        if (!address) {
          return createJsonResponse({
            error:
              "No address provided and no wallet is unlocked. Provide an address or unlock a wallet first.",
          });
        }

        if (!dryRun && !walletAccount) {
          return createJsonResponse({
            error:
              "Wallet must be unlocked to execute heal actions. Use wallet_unlock first, or set dryRun=true to preview.",
          });
        }

        // Reload from disk to pick up changes from other processes
        await reloadFromDisk();

        const nonceInfo = await getHiroApi(NETWORK).getNonceInfo(address);

        const confirmedNonce = nonceInfo.last_executed_tx_nonce;
        const gapsFound: number[] = nonceInfo.detected_missing_nonces ?? [];
        const mempoolNonces: number[] = nonceInfo.detected_mempool_nonces ?? [];

        const gapSet = new Set(gapsFound);

        type HealAction =
          | {
              type: "fill_gap";
              nonce: number;
              txid: string | null;
              status: "proposed" | "broadcast" | "failed";
              error?: string;
            }
          | {
              type: "bump_head";
              nonce: number;
              originalTxid: string;
              newTxid: string | null;
              newFee?: string;
              status: "proposed" | "broadcast" | "skipped" | "failed";
              reason?: string;
              error?: string;
            };

        const actions: HealAction[] = [];
        const warnings: string[] = [];

        // Identify chain head: lowest non-gap mempool nonce
        const chainHeadNonce =
          mempoolNonces.length > 0
            ? mempoolNonces.filter((n) => !gapSet.has(n)).sort((a, b) => a - b)[0]
            : undefined;

        // ----------------------------------------------------------------
        // dryRun: build proposed actions and return early
        // ----------------------------------------------------------------
        if (dryRun) {
          for (const n of gapsFound) {
            actions.push({ type: "fill_gap", nonce: n, txid: null, status: "proposed" });
          }

          if (bumpHead && chainHeadNonce !== undefined) {
            // Find the chain head tx to inspect its type
            const mempoolResult = await getHiroApi(NETWORK)
              .getMempoolTransactions({ sender_address: address, limit: 50 })
              .catch(() => null);

            const headTx = mempoolResult?.results.find((tx) => tx.nonce === chainHeadNonce);

            if (!headTx) {
              warnings.push(
                `Could not find chain head tx at nonce ${chainHeadNonce} in mempool. It may have confirmed already.`
              );
            } else if (headTx.sponsored) {
              actions.push({
                type: "bump_head",
                nonce: chainHeadNonce,
                originalTxid: headTx.tx_id,
                newTxid: null,
                status: "skipped",
                reason:
                  "Sponsored tx — sender cannot RBF. Relay must recover.",
              });
            } else {
              // Fetch the full tx for tx_type
              const fullTx = await getHiroApi(NETWORK)
                .getTransaction(headTx.tx_id)
                .catch(() => null);
              if (fullTx?.tx_type === "token_transfer") {
                const originalFee = parseInt(headTx.fee_rate ?? "0", 10);
                const newFee = Math.ceil(originalFee * (feeMultiplier ?? 1.5));
                actions.push({
                  type: "bump_head",
                  nonce: chainHeadNonce,
                  originalTxid: headTx.tx_id,
                  newTxid: null,
                  newFee: String(newFee),
                  status: "proposed",
                });
              } else {
                actions.push({
                  type: "bump_head",
                  nonce: chainHeadNonce,
                  originalTxid: headTx.tx_id,
                  newTxid: null,
                  status: "skipped",
                  reason: `Manual RBF needed for ${fullTx?.tx_type ?? "unknown"} at nonce ${chainHeadNonce} — rebuild and resubmit manually.`,
                });
              }
            }
          }

          const gapCount = gapsFound.length;
          const bumpAction = actions.find((a) => a.type === "bump_head");
          const summary =
            gapCount === 0 && !bumpAction
              ? "No gaps found and no head bump needed. Nonce state looks healthy."
              : `Would fill ${gapCount} gap(s)${bumpAction ? ` and ${bumpAction.status === "proposed" ? "bump" : "skip"} chain head at nonce ${bumpAction.nonce}` : ""}. Set dryRun=false to execute.`;

          return createJsonResponse({
            address,
            dryRun: true,
            confirmedNonce,
            gapsFound,
            actions,
            warnings,
            summary,
          });
        }

        // ----------------------------------------------------------------
        // Execute mode
        // ----------------------------------------------------------------
        const fee = await resolveDefaultFee(NETWORK, "token_transfer");

        // Fill each gap
        for (const n of gapsFound) {
          try {
            const result = await broadcastGapFill(
              walletAccount!.privateKey,
              walletAccount!.address,
              n,
              fee,
            );
            actions.push({ type: "fill_gap", ...result });
            if (result.status === "failed") {
              warnings.push(`Gap fill at nonce ${n} failed: ${result.error}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            actions.push({ type: "fill_gap", nonce: n, txid: null, status: "failed", error: msg });
            warnings.push(`Gap fill at nonce ${n} threw: ${msg}`);
          }
        }

        // RBF bump chain head
        if (bumpHead && chainHeadNonce !== undefined) {
          const mempoolResult = await getHiroApi(NETWORK)
            .getMempoolTransactions({ sender_address: address, limit: 50 })
            .catch(() => null);

          const headTx = mempoolResult?.results.find(
            (tx) => tx.nonce === chainHeadNonce
          );

          if (!headTx) {
            warnings.push(
              `Could not find chain head tx at nonce ${chainHeadNonce} in mempool. It may have confirmed already.`
            );
          } else if (headTx.sponsored) {
            actions.push({
              type: "bump_head",
              nonce: chainHeadNonce,
              originalTxid: headTx.tx_id,
              newTxid: null,
              status: "skipped",
              reason:
                "Sponsored tx — sender cannot RBF. Relay must recover.",
            });
          } else {
            const fullTx = await getHiroApi(NETWORK)
              .getTransaction(headTx.tx_id)
              .catch(() => null);

            if (fullTx?.tx_type === "token_transfer") {
              try {
                const originalFee = parseInt(headTx.fee_rate ?? "0", 10);
                const newFee = Math.ceil(
                  originalFee * (feeMultiplier ?? 1.5)
                );

                const rbfTx = await makeSTXTokenTransfer({
                  recipient: POX_BURN_ADDRESS,
                  amount: 1n,
                  senderKey: walletAccount!.privateKey,
                  network: getStacksNetwork(NETWORK),
                  memo: `rbf-bump:${chainHeadNonce}`,
                  nonce: BigInt(chainHeadNonce),
                  fee: BigInt(newFee),
                });

                const rbfBroadcast = await broadcastTransaction({
                  transaction: rbfTx,
                  network: getStacksNetwork(NETWORK),
                });

                if ("error" in rbfBroadcast) {
                  actions.push({
                    type: "bump_head",
                    nonce: chainHeadNonce,
                    originalTxid: headTx.tx_id,
                    newTxid: null,
                    newFee: String(newFee),
                    status: "failed",
                    error: `${rbfBroadcast.error} - ${rbfBroadcast.reason}`,
                  });
                  warnings.push(
                    `RBF bump at nonce ${chainHeadNonce} failed: ${rbfBroadcast.error}`
                  );
                } else {
                  await recordNonceUsed(
                    walletAccount!.address,
                    chainHeadNonce,
                    rbfBroadcast.txid
                  );
                  actions.push({
                    type: "bump_head",
                    nonce: chainHeadNonce,
                    originalTxid: headTx.tx_id,
                    newTxid: rbfBroadcast.txid,
                    newFee: String(newFee),
                    status: "broadcast",
                  });
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                actions.push({
                  type: "bump_head",
                  nonce: chainHeadNonce,
                  originalTxid: headTx.tx_id,
                  newTxid: null,
                  status: "failed",
                  error: msg,
                });
                warnings.push(`RBF bump at nonce ${chainHeadNonce} threw: ${msg}`);
              }
            } else {
              actions.push({
                type: "bump_head",
                nonce: chainHeadNonce,
                originalTxid: headTx.tx_id,
                newTxid: null,
                status: "skipped",
                reason: `Manual RBF needed for ${fullTx?.tx_type ?? "unknown"} at nonce ${chainHeadNonce} — rebuild and resubmit manually.`,
              });
            }
          }
        }

        // Build summary
        const filledCount = actions.filter(
          (a) => a.type === "fill_gap" && a.status === "broadcast"
        ).length;
        const failedGaps = actions.filter(
          (a) => a.type === "fill_gap" && a.status === "failed"
        ).length;
        const bumpAction = actions.find((a) => a.type === "bump_head");

        let summary = "";
        if (filledCount > 0) {
          summary += `Filled ${filledCount} gap(s). `;
        }
        if (failedGaps > 0) {
          summary += `${failedGaps} gap fill(s) failed (see warnings). `;
        }
        if (bumpAction) {
          if (bumpAction.status === "broadcast") {
            summary += `Bumped chain head at nonce ${bumpAction.nonce}. Chain should unstick within 1-2 blocks.`;
          } else if (bumpAction.status === "skipped") {
            summary += `Chain head at nonce ${bumpAction.nonce} skipped: ${bumpAction.reason}`;
          } else if (bumpAction.status === "failed") {
            summary += `Chain head bump at nonce ${bumpAction.nonce} failed (see warnings).`;
          }
        }
        if (!summary) {
          summary =
            gapsFound.length === 0
              ? "No gaps found. Nonce state looks healthy."
              : "Actions attempted — check action statuses for details.";
        }

        return createJsonResponse({
          address,
          dryRun: false,
          confirmedNonce,
          gapsFound,
          actions,
          warnings,
          summary: summary.trim(),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
