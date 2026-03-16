/**
 * Shared helpers for ERC-8004 tool files.
 *
 * Extracted to avoid duplication between erc8004.tools.ts and reputation.tools.ts.
 */

import { NETWORK } from "../config/networks.js";
import { getWalletManager } from "../services/wallet-manager.js";

/** Default read-only caller address per network (boot addresses) */
export const DEFAULT_CALLER: Record<string, string> = {
  mainnet: "SP000000000000000000002Q6VF78",
  testnet: "ST000000000000000000002AMW42H",
};

/**
 * Strip optional 0x prefix and validate a hex string.
 * Optionally enforce an exact byte length.
 */
export function normalizeHex(hex: string, label: string, exactBytes?: number): string {
  let normalized = hex;
  if (normalized.startsWith("0x") || normalized.startsWith("0X")) {
    normalized = normalized.slice(2);
  }
  if (normalized.length === 0 || normalized.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(normalized)) {
    throw new Error(`${label} must be a non-empty, even-length hex string`);
  }
  if (exactBytes !== undefined && normalized.length !== exactBytes * 2) {
    throw new Error(`${label} must be exactly ${exactBytes} bytes (${exactBytes * 2} hex characters)`);
  }
  return normalized;
}

/**
 * Return the active wallet's Stacks address, or fall back to the network boot address
 * when no wallet session is open. Used for read-only contract calls.
 */
export function getCallerAddress(): string {
  const walletManager = getWalletManager();
  const sessionInfo = walletManager.getSessionInfo();
  return sessionInfo?.address || DEFAULT_CALLER[NETWORK] || DEFAULT_CALLER.testnet;
}
