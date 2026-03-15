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

        const [
          enrolledThisCycleRaw,
          enrolledNextCycleRaw,
          minimumAmountRaw,
          aprDataRaw,
          cycleOverviewRaw,
        ] = await Promise.all([
          callDualStackingReadOnly("is-enrolled-this-cycle", [principalCV(resolvedAddress)]),
          callDualStackingReadOnly("is-enrolled-in-next-cycle", [principalCV(resolvedAddress)]),
          callDualStackingReadOnly("get-minimum-enrollment-amount", []),
          callDualStackingReadOnly("get-apr-data", []),
          callDualStackingReadOnly("current-overview-data", []),
        ]);

        // Parse APR data — returns {min-apr: uint, max-apr: uint} divided by 1_000_000 for %
        let apr: { minApr: number; maxApr: number; unit: string; note: string } = {
          minApr: 0,
          maxApr: 0,
          unit: "%",
          note: "Multiplier up to 10x with stacked STX",
        };
        if (aprDataRaw && typeof aprDataRaw === "object") {
          const aprObj = aprDataRaw as Record<string, { value?: string | number }>;
          const minAprRaw = aprObj["min-apr"]?.value;
          const maxAprRaw = aprObj["max-apr"]?.value;
          apr = {
            minApr: minAprRaw !== undefined ? Number(minAprRaw) / 1_000_000 : 0,
            maxApr: maxAprRaw !== undefined ? Number(maxAprRaw) / 1_000_000 : 0,
            unit: "%",
            note: "Multiplier up to 10x with stacked STX",
          };
        }

        // Parse cycle overview — returns tuple with cycle-id, snapshot-index, snapshots-per-cycle
        let cycleOverview: {
          currentCycleId: number;
          snapshotIndex: number;
          snapshotsPerCycle: number;
        } = { currentCycleId: 0, snapshotIndex: 0, snapshotsPerCycle: 0 };
        if (cycleOverviewRaw && typeof cycleOverviewRaw === "object") {
          const co = cycleOverviewRaw as Record<string, { value?: string | number }>;
          cycleOverview = {
            currentCycleId: co["cycle-id"]?.value !== undefined ? Number(co["cycle-id"].value) : 0,
            snapshotIndex:
              co["snapshot-index"]?.value !== undefined ? Number(co["snapshot-index"].value) : 0,
            snapshotsPerCycle:
              co["snapshots-per-cycle"]?.value !== undefined
                ? Number(co["snapshots-per-cycle"].value)
                : 0,
          };
        }

        // Parse minimum enrollment amount
        let minimumEnrollmentSats = 0;
        if (minimumAmountRaw !== null && minimumAmountRaw !== undefined) {
          const raw = minimumAmountRaw as { value?: string | number };
          minimumEnrollmentSats = raw.value !== undefined ? Number(raw.value) : 0;
        }

        // Parse boolean enrollment flags
        const parseBoolean = (raw: unknown): boolean => {
          if (raw === null || raw === undefined) return false;
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
