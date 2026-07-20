import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  uintCV,
  principalCV,
  noneCV,
  someCV,
  PostConditionMode,
  type ClarityValue,
  deserializeCV,
  cvToJSON,
} from "@stacks/transactions";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { callContract } from "../transactions/builder.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { fieldValue, tupleFields } from "./dual-stacking-decode.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DUAL_STACKING_ADDRESS = "SP1HFCRKEJ8BYW4D0E3FAWHFDX8A25PPAA83HWWZ9";
const DUAL_STACKING_CONTRACT = "dual-stacking-v2_0_4";
const DUAL_STACKING_CONTRACT_ID = `${DUAL_STACKING_ADDRESS}.${DUAL_STACKING_CONTRACT}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Call a read-only function on the dual-stacking contract and return a JSON-friendly value.
 */
async function callDualStackingReadOnly(
  functionName: string,
  args: ClarityValue[]
): Promise<unknown> {
  const hiro = getHiroApi(NETWORK);
  const result = await hiro.callReadOnlyFunction(
    DUAL_STACKING_CONTRACT_ID,
    functionName,
    args,
    DUAL_STACKING_ADDRESS
  );
  if (!result.okay) {
    throw new Error(
      `Read-only call ${functionName} failed: ${result.cause ?? "unknown error"}`
    );
  }
  if (!result.result) {
    return null;
  }
  const hex = result.result.startsWith("0x")
    ? result.result.slice(2)
    : result.result;
  const cv = deserializeCV(Buffer.from(hex, "hex"));
  return cvToJSON(cv);
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerDualStackingTools(server: McpServer): void {
  // ==========================================================================
  // dual_stacking_status
  // ==========================================================================

  server.registerTool(
    "dual_stacking_status",
    {
      description: `Check Dual Stacking enrollment status, APR data, minimum amount, and cycle overview.

Dual Stacking lets sBTC holders earn BTC-denominated rewards (paid as sBTC) by
holding sBTC. Enrollment runs per PoX cycle; you enroll now to be active next cycle.

Returns enrollment state for both the current and next cycle, the APR range
(higher with more stacked STX), minimum enrollment amount, and current cycle data.

Note: Dual Stacking is only available on mainnet.`,
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Address to check. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Dual Stacking is only available on mainnet",
            network: NETWORK,
          });
        }

        const resolvedAddress = address || (await getWalletAddress());

        // Use allSettled, not all: `is-enrolled-this-cycle` fails contract-side
        // on mainnet with RuntimeCheck(AtBlockUnavailable) (it reads historical
        // block state Hiro has pruned). With Promise.all a single failing read
        // sinks the whole response, hiding the other 4 useful fields. Recover
        // per-call and surface a `warnings` array instead. (#554)
        const warnings: string[] = [];
        const settled = await Promise.allSettled([
          callDualStackingReadOnly("is-enrolled-this-cycle", [principalCV(resolvedAddress)]),
          callDualStackingReadOnly("is-enrolled-in-next-cycle", [principalCV(resolvedAddress)]),
          callDualStackingReadOnly("get-minimum-enrollment-amount", []),
          callDualStackingReadOnly("get-apr-data", []),
          callDualStackingReadOnly("current-overview-data", []),
        ]);
        const readNames = [
          "is-enrolled-this-cycle",
          "is-enrolled-in-next-cycle",
          "get-minimum-enrollment-amount",
          "get-apr-data",
          "current-overview-data",
        ] as const;
        const values = settled.map((r, i) => {
          if (r.status === "fulfilled") return r.value;
          warnings.push(
            `${readNames[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
          );
          return null;
        });
        const [
          enrolledThisCycleRaw,
          enrolledNextCycleRaw,
          minimumAmountRaw,
          aprDataRaw,
          cycleOverviewRaw,
        ] = values;

        // cvToJSON tuple helpers (shared dual-stacking-decode.ts) — real wire keys MIN_APR / cycle-id.
        // Fallback keys min-apr/minApr kept only as defensive Hiro-shape fallbacks, not observed wire names.

        // Parse APR data — MIN_APR/MAX_APR uints divided by 1_000_000 for %
        let apr: { minApr: number; maxApr: number; unit: string; note: string; multiplier?: number } = {
          minApr: 0,
          maxApr: 0,
          unit: "%",
          note: "Multiplier up to 10x with stacked STX",
        };
        if (aprDataRaw && typeof aprDataRaw === "object") {
          const fields = tupleFields(aprDataRaw);
          const minAprRaw = fieldValue(fields, "MIN_APR", "min-apr", "minApr");
          const maxAprRaw = fieldValue(fields, "MAX_APR", "max-apr", "maxApr");
          const multiplier = fieldValue(fields, "MULTIPLIER", "multiplier");
          const decoded =
            minAprRaw !== undefined || maxAprRaw !== undefined;
          if (!decoded && fields) {
            warnings.push(
              "get-apr-data: tuple decoded but MIN_APR/MAX_APR keys missing; check Clarity wire names"
            );
          }
          apr = {
            minApr: minAprRaw !== undefined ? minAprRaw / 1_000_000 : 0,
            maxApr: maxAprRaw !== undefined ? maxAprRaw / 1_000_000 : 0,
            unit: "%",
            note: "Multiplier up to 10x with stacked STX",
            ...(multiplier !== undefined && { multiplier }),
          };
        }

        // Parse cycle overview — cycle-id, snapshot-index, snapshots-per-cycle
        let cycleOverview: {
          currentCycleId: number;
          snapshotIndex: number;
          snapshotsPerCycle: number;
        } = { currentCycleId: 0, snapshotIndex: 0, snapshotsPerCycle: 0 };
        if (cycleOverviewRaw && typeof cycleOverviewRaw === "object") {
          const fields = tupleFields(cycleOverviewRaw);
          const cycleId = fieldValue(fields, "cycle-id", "cycleId", "currentCycleId");
          const snapshotIndex = fieldValue(fields, "snapshot-index", "snapshotIndex");
          const snapshotsPerCycle = fieldValue(
            fields,
            "snapshots-per-cycle",
            "snapshotsPerCycle"
          );
          if (
            cycleId === undefined &&
            snapshotIndex === undefined &&
            snapshotsPerCycle === undefined &&
            fields
          ) {
            warnings.push(
              "current-overview-data: tuple decoded but cycle-id/snapshot keys missing; check Clarity wire names"
            );
          }
          cycleOverview = {
            currentCycleId: cycleId ?? 0,
            snapshotIndex: snapshotIndex ?? 0,
            snapshotsPerCycle: snapshotsPerCycle ?? 0,
          };
        }

        // Parse minimum enrollment amount (simple uint cvToJSON: { type, value })
        let minimumEnrollmentSats = 0;
        if (minimumAmountRaw !== null && minimumAmountRaw !== undefined) {
          if (typeof minimumAmountRaw === "number" || typeof minimumAmountRaw === "string") {
            minimumEnrollmentSats = Number(minimumAmountRaw);
          } else {
            const raw = minimumAmountRaw as { value?: string | number };
            minimumEnrollmentSats = raw.value !== undefined ? Number(raw.value) : 0;
          }
        }

        // Parse boolean enrollment flags. A failed read stays null (unknown)
        // rather than collapsing to a misleading `false`.
        const parseBoolean = (raw: unknown): boolean | null => {
          if (raw === null || raw === undefined) return null;
          if (typeof raw === "boolean") return raw;
          const obj = raw as { value?: unknown; type?: string };
          if (obj.type === "bool") return obj.value === true || obj.value === "true";
          return Boolean(obj.value);
        };

        return createJsonResponse({
          address: resolvedAddress,
          network: NETWORK,
          enrolledThisCycle: parseBoolean(enrolledThisCycleRaw),
          enrolledNextCycle: parseBoolean(enrolledNextCycleRaw),
          minimumEnrollmentSats,
          apr,
          cycleOverview,
          ...(warnings.length > 0 && { warnings }),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // dual_stacking_get_rewards
  // ==========================================================================

  server.registerTool(
    "dual_stacking_get_rewards",
    {
      description: `Get earned sBTC rewards for a specific Dual Stacking cycle.

Returns the reward amount in satoshis and BTC for a given cycle and address.
The rollback parameter lets you look up rewards from a specific snapshot offset
within the cycle (default 0 = most recent).

Note: Dual Stacking is only available on mainnet.`,
      inputSchema: {
        cycle: z.number().describe("Cycle number to query rewards for"),
        address: z
          .string()
          .optional()
          .describe("Address to query rewards for. Uses configured wallet if not provided."),
        rollback: z
          .number()
          .optional()
          .default(0)
          .describe("Snapshot rollback offset within the cycle (default 0)"),
      },
    },
    async ({ cycle, address, rollback }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Dual Stacking is only available on mainnet",
            network: NETWORK,
          });
        }

        const resolvedAddress = address || (await getWalletAddress());
        const rollbackValue = rollback ?? 0;

        const rewardRaw = await callDualStackingReadOnly(
          "reward-amount-for-cycle-and-address",
          [
            uintCV(BigInt(cycle)),
            uintCV(BigInt(rollbackValue)),
            principalCV(resolvedAddress),
          ]
        );

        let rewardSats = 0;
        if (rewardRaw !== null && rewardRaw !== undefined) {
          const raw = rewardRaw as { value?: string | number };
          rewardSats = raw.value !== undefined ? Number(raw.value) : 0;
        }

        const rewardBtc = rewardSats / 100_000_000;

        return createJsonResponse({
          address: resolvedAddress,
          cycle,
          rollback: rollbackValue,
          rewardSats,
          rewardBtc,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // dual_stacking_enroll
  // ==========================================================================

  server.registerTool(
    "dual_stacking_enroll",
    {
      description: `Enroll in Dual Stacking to earn sBTC rewards.

Enrolls your wallet in the Dual Stacking protocol. Enrollment takes effect at the
start of the next PoX cycle. You must hold the minimum sBTC amount to qualify.

An optional reward address can be specified to receive sBTC rewards at a different
address than the signing wallet. If omitted, rewards go to the signing wallet.

Requires an unlocked wallet with sufficient sBTC balance.

Note: Dual Stacking is only available on mainnet.`,
      inputSchema: {
        rewardAddress: z
          .string()
          .optional()
          .describe(
            "Optional Stacks address to receive sBTC rewards. Uses signing wallet address if not provided."
          ),
      },
    },
    async ({ rewardAddress }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createErrorResponse(
            new Error("Dual Stacking enrollment is only available on mainnet")
          );
        }

        const account = await getAccount();
        const rewardArg = rewardAddress
          ? someCV(principalCV(rewardAddress))
          : noneCV();

        const result = await callContract(account, {
          contractAddress: DUAL_STACKING_ADDRESS,
          contractName: DUAL_STACKING_CONTRACT,
          functionName: "enroll",
          functionArgs: [rewardArg],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          enrolledAddress: account.address,
          rewardAddress: rewardAddress || account.address,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // dual_stacking_opt_out
  // ==========================================================================

  server.registerTool(
    "dual_stacking_opt_out",
    {
      description: `Opt out of Dual Stacking.

Removes your wallet from the Dual Stacking protocol. The opt-out takes effect at
the start of the next PoX cycle; you continue to earn rewards for the current cycle.

Requires an unlocked wallet.

Note: Dual Stacking is only available on mainnet.`,
      inputSchema: {},
    },
    async () => {
      try {
        if (NETWORK !== "mainnet") {
          return createErrorResponse(
            new Error("Dual Stacking opt-out is only available on mainnet")
          );
        }

        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: DUAL_STACKING_ADDRESS,
          contractName: DUAL_STACKING_CONTRACT,
          functionName: "opt-out",
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          address: account.address,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
