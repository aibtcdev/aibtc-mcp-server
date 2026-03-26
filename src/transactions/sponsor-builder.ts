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
 * Submit a sponsored transaction to the relay and handle the response.
 *
 * Shared logic for all three sponsored helpers (contract call, STX transfer,
 * contract deploy). Each caller builds its own transaction and provides a
 * fallback function for direct submission when the relay is unavailable.
 */
async function submitSponsoredTransaction(
  account: Account,
  transaction: { serialize(): string; auth: { spendingCondition: { nonce: bigint } | null } },
  network: Network,
  directFallback: () => Promise<TransferResult>,
): Promise<TransferResult> {
  const apiKey = resolveSponsorApiKey(account);
  const senderNonce = Number(transaction.auth.spendingCondition!.nonce);
  const serializedTx = transaction.serialize();
  const response = await submitToSponsorRelay(serializedTx, network, apiKey);

  if (!response.success) {
    const { shouldFallback, reason } = await evaluateFallback(response, network);
    if (shouldFallback) {
      console.warn(`[sponsor] Relay unavailable or nonce error (${reason}), falling back to direct submission (sender pays fee)`);
      const result = await directFallback();
      return { ...result, fallback: true, fallbackReason: reason };
    }
    throw new Error(formatRelayError(response));
  }

  await recordNonceUsed(account.address, senderNonce, response.txid!);
  return { txid: response.txid!, rawTx: serializedTx };
}

/**
 * Build and submit a sponsored contract call via the relay.
 * Falls back to direct submission (sender pays fee) when the relay is unavailable.
 */
export async function sponsoredContractCall(
  account: Account,
  options: ContractCallOptions,
  network: Network
): Promise<TransferResult> {
  const transaction = await makeContractCall({
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    senderKey: account.privateKey,
    network: getStacksNetwork(network),
    postConditionMode: options.postConditionMode || PostConditionMode.Deny,
    postConditions: options.postConditions || [],
    sponsored: true,
    fee: 0n,
  });

  return submitSponsoredTransaction(account, transaction, network, () =>
    callContract(account, options)
  );
}

/**
 * Build and submit a sponsored STX transfer via the relay.
 * Falls back to direct submission (sender pays fee) when the relay is unavailable.
 */
export async function sponsoredStxTransfer(
  account: Account,
  recipient: string,
  amount: bigint,
  memo: string | undefined,
  network: Network
): Promise<TransferResult> {
  const transaction = await makeSTXTokenTransfer({
    recipient,
    amount,
    senderKey: account.privateKey,
    network: getStacksNetwork(network),
    memo: memo || "",
    sponsored: true,
    fee: 0n,
  });

  return submitSponsoredTransaction(account, transaction, network, () =>
    transferStx(account, recipient, amount, memo)
  );
}

/**
 * Build and submit a sponsored contract deploy via the relay.
 * Falls back to direct submission (sender pays fee) when the relay is unavailable.
 */
export async function sponsoredContractDeploy(
  account: Account,
  options: ContractDeployOptions,
  network: Network
): Promise<TransferResult> {
  const transaction = await makeContractDeploy({
    contractName: options.contractName,
    codeBody: options.codeBody,
    senderKey: account.privateKey,
    network: getStacksNetwork(network),
    sponsored: true,
    fee: 0n,
  });

  return submitSponsoredTransaction(account, transaction, network, () =>
    deployContract(account, options)
  );
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
