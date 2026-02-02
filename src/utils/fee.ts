/**
 * Fee utility for resolving fee presets to micro-STX values.
 *
 * Supports both numeric strings (e.g., "100000") and preset strings
 * ("low", "medium", "high") that are resolved by fetching current
 * fee estimates from the Stacks mempool.
 */

import { getHiroApi, type MempoolFeePriorities } from "../services/hiro-api.js";
import type { Network } from "../config/networks.js";

/**
 * Valid fee preset strings.
 * These map to the mempool fee priorities:
 * - "low" -> low_priority
 * - "medium" -> medium_priority
 * - "high" -> high_priority
 */
export type FeePreset = "low" | "medium" | "high";

/**
 * Check if a string is a valid fee preset.
 */
export function isFeePreset(value: string): value is FeePreset {
  return ["low", "medium", "high"].includes(value.toLowerCase());
}

/**
 * Map fee preset to mempool priority key.
 */
function presetToPriorityKey(preset: FeePreset): keyof MempoolFeePriorities {
  const normalized = preset.toLowerCase() as FeePreset;
  const mapping: Record<FeePreset, keyof MempoolFeePriorities> = {
    low: "low_priority",
    medium: "medium_priority",
    high: "high_priority",
  };
  return mapping[normalized];
}

/**
 * Resolve a fee string to a bigint value in micro-STX.
 *
 * @param fee - Either a numeric string (micro-STX) or preset ("low" | "medium" | "high")
 * @param network - The network to fetch fee estimates from
 * @param txType - The transaction type for more accurate fee estimates.
 *                 Defaults to "all" which uses aggregate fees.
 * @returns The fee in micro-STX as bigint, or undefined if fee is undefined
 *
 * @example
 * // Numeric string - returns as-is
 * await resolveFee("100000", "mainnet") // -> 100000n
 *
 * // Preset string - fetches from mempool
 * await resolveFee("high", "mainnet") // -> fetches high_priority fee
 *
 * // Undefined - returns undefined (auto-estimate)
 * await resolveFee(undefined, "mainnet") // -> undefined
 */
export async function resolveFee(
  fee: string | undefined,
  network: Network,
  txType: "all" | "token_transfer" | "contract_call" | "smart_contract" = "all"
): Promise<bigint | undefined> {
  // If no fee specified, return undefined to use auto-estimation
  if (!fee) {
    return undefined;
  }

  // Check if it's a preset string
  if (isFeePreset(fee)) {
    const hiroApi = getHiroApi(network);
    const mempoolFees = await hiroApi.getMempoolFees();

    // Get the appropriate fee tier based on transaction type
    const feeTier = mempoolFees[txType];
    const priorityKey = presetToPriorityKey(fee);
    const feeValue = feeTier[priorityKey];

    // Return as bigint (values are already in micro-STX)
    return BigInt(Math.ceil(feeValue));
  }

  // Otherwise, treat as numeric string - validate format first
  const normalizedFee = fee.trim();
  if (!/^\d+$/.test(normalizedFee)) {
    throw new Error(
      `Invalid fee value "${fee}" – expected a non-negative integer string in micro-STX or preset ("low", "medium", "high").`
    );
  }
  return BigInt(normalizedFee);
}
