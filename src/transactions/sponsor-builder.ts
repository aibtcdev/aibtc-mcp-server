import {
  makeSTXTokenTransfer,
  makeContractCall,
  makeContractDeploy,
  PostConditionMode,
} from "@stacks/transactions";
import { getStacksNetwork, type Network } from "../config/networks.js";
import { getSponsorRelayUrl, getSponsorApiKey, isFallbackEnabled } from "../config/sponsor.js";
import type { Account, ContractCallOptions, ContractDeployOptions, TransferResult } from "./builder.js";
import { callContract, transferStx, deployContract } from "./builder.js";
import { recordNonceUsed } from "../services/nonce-tracker.js";
import { isRelayHealthy } from "../utils/relay-health.js";

/**
 * Relay-side error codes and keywords that indicate a nonce conflict on the
 * relay, not a user-side error. When these are present the tx itself is valid
 * and a direct fallback makes sense.
 */
const NONCE_FAULT_PATTERNS = [
  "ConflictingNonceInMempool",
  "TooMuchChaining",
  "BadNonce",
  "nonce",
];

/**
 * Returns true when a failed relay response is caused by a relay-side nonce
 * problem rather than a user-side error (bad args, insufficient balance, etc).
 */
function isRelayNonceFault(response: SponsorRelayResponse): boolean {
  const code = response.code ?? "";
  const error = response.error ?? "";
  const details = response.details ?? "";
  const haystack = `${code} ${error} ${details}`.toLowerCase();
  return NONCE_FAULT_PATTERNS.some((p) => haystack.includes(p.toLowerCase()));
}

/**
 * Decide whether to fall back to direct submission for a relay failure.
 * Returns { shouldFallback: true, reason } or { shouldFallback: false }.
 */
async function evaluateFallback(
  response: SponsorRelayResponse,
  network: Network
): Promise<{ shouldFallback: boolean; reason?: string }> {
  if (!isFallbackEnabled()) {
    return { shouldFallback: false };
  }

  if (isRelayNonceFault(response)) {
    return {
      shouldFallback: true,
      reason: `relay nonce error: ${response.code ?? response.error}`,
    };
  }

  const healthy = await isRelayHealthy(network);
  if (!healthy) {
    return { shouldFallback: true, reason: "relay unhealthy" };
  }

  return { shouldFallback: false };
}

export interface SponsorRelayResponse {
  success: boolean;
  requestId?: string;
  txid?: string;
  explorerUrl?: string;
  fee?: number;
  error?: string;
  code?: string;
  details?: string;
  retryable?: boolean;
  retryAfter?: number;
}

/**
 * Format a failed SponsorRelayResponse into an error message
 */
function formatRelayError(response: SponsorRelayResponse): string {
  const errorMsg = response.error || "Sponsor relay request failed";
  const details = response.details ? ` (${response.details})` : "";
  const retryInfo = response.retryable
    ? typeof response.retryAfter === "number"
      ? ` [Retryable after ${response.retryAfter}s]`
      : " [Retryable; try again later]"
    : "";
  return `${errorMsg}${details}${retryInfo}`;
}

/**
 * Resolve the sponsor API key from the account or environment.
 * Throws if no key is available.
 */
function resolveSponsorApiKey(account: Account): string {
  const apiKey = account.sponsorApiKey || getSponsorApiKey();
  if (!apiKey) {
    throw new Error(
      "Sponsored transactions require SPONSOR_API_KEY environment variable or wallet-level sponsorApiKey"
    );
  }
  return apiKey;
}

/**
 * High-level helper: build a sponsored contract call, submit to relay, and
 * return a TransferResult. Resolves the API key and handles relay errors.
 *
 * This is the primary entry point for services that need sponsored contract calls.
 */
export async function sponsoredContractCall(
  account: Account,
  options: ContractCallOptions,
  network: Network
): Promise<TransferResult> {
  const apiKey = resolveSponsorApiKey(account);

  const networkName = getStacksNetwork(network);
  const transaction = await makeContractCall({
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    senderKey: account.privateKey,
    network: networkName,
    postConditionMode: options.postConditionMode || PostConditionMode.Deny,
    postConditions: options.postConditions || [],
    sponsored: true,
    fee: 0n,
  });

  const senderNonce = Number(transaction.auth.spendingCondition!.nonce);
  const serializedTx = transaction.serialize();
  const response = await submitToSponsorRelay(serializedTx, network, apiKey);

  if (!response.success) {
    const { shouldFallback, reason } = await evaluateFallback(response, network);
    if (shouldFallback) {
      console.warn(`[sponsor] Relay unavailable or nonce error (${reason}), falling back to direct submission (sender pays fee)`);
      const result = await callContract(account, options);
      return { ...result, fallback: true, fallbackReason: reason };
    }
    throw new Error(formatRelayError(response));
  }

  await recordNonceUsed(account.address, senderNonce, response.txid!);

  return { txid: response.txid!, rawTx: serializedTx };
}

/**
 * High-level helper: build a sponsored STX transfer, submit to relay, and
 * return a TransferResult. Resolves the API key and handles relay errors.
 *
 * This is the primary entry point for services that need sponsored STX transfers.
 */
export async function sponsoredStxTransfer(
  account: Account,
  recipient: string,
  amount: bigint,
  memo: string | undefined,
  network: Network
): Promise<TransferResult> {
  const apiKey = resolveSponsorApiKey(account);

  const networkName = getStacksNetwork(network);
  const transaction = await makeSTXTokenTransfer({
    recipient,
    amount,
    senderKey: account.privateKey,
    network: networkName,
    memo: memo || "",
    sponsored: true,
    fee: 0n,
  });

  const senderNonce = Number(transaction.auth.spendingCondition!.nonce);
  const serializedTx = transaction.serialize();
  const response = await submitToSponsorRelay(serializedTx, network, apiKey);

  if (!response.success) {
    const { shouldFallback, reason } = await evaluateFallback(response, network);
    if (shouldFallback) {
      console.warn(`[sponsor] Relay unavailable or nonce error (${reason}), falling back to direct submission (sender pays fee)`);
      const result = await transferStx(account, recipient, amount, memo);
      return { ...result, fallback: true, fallbackReason: reason };
    }
    throw new Error(formatRelayError(response));
  }

  await recordNonceUsed(account.address, senderNonce, response.txid!);

  return { txid: response.txid!, rawTx: serializedTx };
}

/**
 * High-level helper: build a sponsored contract deploy, submit to relay, and
 * return a TransferResult. Resolves the API key and handles relay errors.
 *
 * This is the primary entry point for services that need sponsored contract deployments.
 */
export async function sponsoredContractDeploy(
  account: Account,
  options: ContractDeployOptions,
  network: Network
): Promise<TransferResult> {
  const apiKey = resolveSponsorApiKey(account);

  const networkName = getStacksNetwork(network);
  const transaction = await makeContractDeploy({
    contractName: options.contractName,
    codeBody: options.codeBody,
    senderKey: account.privateKey,
    network: networkName,
    sponsored: true,
    fee: 0n,
  });

  const senderNonce = Number(transaction.auth.spendingCondition!.nonce);
  const serializedTx = transaction.serialize();
  const response = await submitToSponsorRelay(serializedTx, network, apiKey);

  if (!response.success) {
    const { shouldFallback, reason } = await evaluateFallback(response, network);
    if (shouldFallback) {
      console.warn(`[sponsor] Relay unavailable or nonce error (${reason}), falling back to direct submission (sender pays fee)`);
      const result = await deployContract(account, options);
      return { ...result, fallback: true, fallbackReason: reason };
    }
    throw new Error(formatRelayError(response));
  }

  await recordNonceUsed(account.address, senderNonce, response.txid!);

  return { txid: response.txid!, rawTx: serializedTx };
}

/**
 * Submit a serialized transaction to the sponsor relay
 */
async function submitToSponsorRelay(
  transaction: string,
  network: Network,
  apiKey: string
): Promise<SponsorRelayResponse> {
  const relayUrl = getSponsorRelayUrl(network);

  const response = await fetch(`${relayUrl}/sponsor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ transaction }),
  });

  const responseText = await response.text();

  let data: SponsorRelayResponse;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = {
      success: false,
      error: `Sponsor relay returned non-JSON response (status ${response.status})`,
      details: responseText || undefined,
    };
  }

  if (!response.ok || !data.success) {
    return {
      success: false,
      error: data.error || "Sponsor relay request failed",
      code: data.code,
      details: data.details,
      retryable: data.retryable,
      retryAfter: data.retryAfter,
    };
  }

  return data as SponsorRelayResponse;
}
