import {
  makeSTXTokenTransfer,
  makeContractCall,
  makeContractDeploy,
  broadcastTransaction,
  ClarityValue,
  PostConditionMode,
  PostCondition,
} from "@stacks/transactions";
import { hexToBytes } from "@stacks/common";
import { getStacksNetwork, getApiBaseUrl, type Network } from "../config/networks.js";
import { getHiroApi } from "../services/hiro-api.js";
import { resolveDefaultFee } from "../utils/fee.js";
import type { WalletAddresses } from "../utils/storage.js";
import {
  getTrackedNonce,
  recordNonceUsed,
  resetTrackedNonce,
  reconcileWithChain,
} from "../services/nonce-tracker.js";

// ---------------------------------------------------------------------------
// Pending nonce tracking (unified via SharedNonceTracker, issue #413)
//
// All nonce state is now managed by src/services/nonce-tracker.ts which
// persists to ~/.aibtc/nonce-state.json. This module delegates to the tracker
// and keeps the same public API surface for backward compatibility.
// ---------------------------------------------------------------------------

/**
 * Reset the pending nonce for an address (called on wallet unlock/lock/switch
 * so the counter re-syncs with the chain on the next transaction).
 */
export async function resetPendingNonce(address: string): Promise<void> {
  await resetTrackedNonce(address);
}

/**
 * Force-resync the local pending nonce for an address.
 * Identical to resetPendingNonce but exported under a name that makes the
 * intent clear for the recover_sponsor_nonce tool's resync-local-nonce action.
 */
export async function forceResyncNonce(address: string): Promise<void> {
  await resetPendingNonce(address);
}

/**
 * Fetch the next nonce to use for `address`.
 *
 * Algorithm:
 * 1. Check the shared nonce tracker for a locally-tracked next nonce.
 * 2. Fetch `possible_next_nonce` and `detected_missing_nonces` from Hiro.
 * 3. Reconcile: if chain advanced past local, update tracker.
 * 4. Return max(chain_next, local_tracked) so rapid sequential calls
 *    get strictly increasing nonces even before the mempool reflects the first tx.
 * 5. Warn if the network reports missing nonces.
 */
async function getNextNonce(address: string, network: Network): Promise<bigint> {
  // Read local tracker state (no network call)
  const localNext = await getTrackedNonce(address);

  try {
    const hiroApi = getHiroApi(network);
    const nonceInfo = await hiroApi.getNonceInfo(address);
    const networkNext = BigInt(nonceInfo.possible_next_nonce);

    // Reconcile: if chain advanced past local state, update the tracker
    await reconcileWithChain(address, nonceInfo.possible_next_nonce);

    // Warn about detected nonce gaps that could stall the queue.
    if (nonceInfo.detected_missing_nonces && nonceInfo.detected_missing_nonces.length > 0) {
      console.warn(
        `[nonce] detected_missing_nonces for ${address}: [${nonceInfo.detected_missing_nonces.join(", ")}]. ` +
        `These gaps may stall pending transactions. Use recover_sponsor_nonce with action=fill-gaps to resolve.`
      );
    }

    const localNextBig = localNext !== null ? BigInt(localNext) : 0n;
    return networkNext > localNextBig ? networkNext : localNextBig;
  } catch (err) {
    // Fallback: if we have a fresh local counter, use it to keep the queue moving
    // even when Hiro is temporarily unreachable (e.g., between rapid sequential calls).
    if (localNext !== null && localNext > 0) {
      console.warn(`[nonce] API call failed, using local tracked nonce (${localNext}) for ${address}:`, err);
      return BigInt(localNext);
    }
    throw err;
  }
}

/**
 * Record that a transaction with `nonce` was successfully broadcast for
 * `address`, so the next call advances past it.
 *
 * @param txid - Optional transaction ID for the pending log. Pass empty string
 *               if not available (e.g., legacy callers).
 */
export function advancePendingNonce(address: string, nonce: bigint, txid = ""): void {
  // Delegate to shared tracker (fire-and-forget since callers are sync)
  recordNonceUsed(address, Number(nonce), txid).catch((err) => {
    console.error(`[nonce] Failed to record nonce ${nonce} for ${address}:`, err);
  });
}

export interface Account extends WalletAddresses {
  privateKey: string;
  /**
   * Bitcoin private key as raw bytes (32 bytes) for signing BTC transactions.
   * SECURITY: Never serialize to WIF/hex. Only held in memory during session.
   */
  btcPrivateKey?: Uint8Array;
  /**
   * Bitcoin public key as raw bytes (33 bytes compressed) for building transactions.
   */
  btcPublicKey?: Uint8Array;
  /**
   * Taproot private key as raw bytes (32 bytes) for signing Taproot transactions.
   * SECURITY: Never serialize. Only held in memory during session.
   */
  taprootPrivateKey?: Uint8Array;
  /**
   * Taproot internal public key as raw bytes (32 bytes, x-only) for building Taproot transactions.
   */
  taprootPublicKey?: Uint8Array;
  /**
   * Nostr private key as raw bytes (32 bytes) for BIP-340 Schnorr signing of NIP-01 events.
   * Derived via NIP-06 path m/44'/1237'/0'/0/0.
   * SECURITY: Never serialize. Only held in memory during session.
   */
  nostrPrivateKey?: Uint8Array;
  /**
   * Nostr public key as x-only bytes (32 bytes, no 02/03 prefix).
   * Derived via NIP-06 path m/44'/1237'/0'/0/0.
   * This is the Nostr public key used in NIP-01 events.
   */
  nostrPublicKey?: Uint8Array;
  network: Network;
}

export interface TransferResult {
  txid: string;
  rawTx: string;
}

export interface ContractCallOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditionMode?: PostConditionMode;
  postConditions?: PostCondition[];
  /** Optional fee in micro-STX. If omitted, fee is auto-estimated. */
  fee?: bigint;
}

export interface ContractDeployOptions {
  contractName: string;
  codeBody: string;
  /** Optional fee in micro-STX. If omitted, fee is auto-estimated. */
  fee?: bigint;
}

/**
 * Transfer STX tokens to a recipient
 * @param fee Optional fee in micro-STX. If omitted, a medium-priority clamped fee is resolved.
 */
export async function transferStx(
  account: Account,
  recipient: string,
  amount: bigint,
  memo?: string,
  fee?: bigint
): Promise<TransferResult> {
  const networkName = getStacksNetwork(account.network);
  const nonce = await getNextNonce(account.address, account.network);

  // Always resolve a clamped fee — prevents @stacks/transactions from over-estimating.
  const resolvedFee = fee ?? await resolveDefaultFee(account.network, "token_transfer");

  const transaction = await makeSTXTokenTransfer({
    recipient,
    amount,
    senderKey: account.privateKey,
    network: networkName,
    memo: memo || "",
    nonce,
    fee: resolvedFee,
  });

  const broadcastResponse = await broadcastTransaction({
    transaction,
    network: networkName,
  });

  if ("error" in broadcastResponse) {
    throw new Error(
      `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`
    );
  }

  advancePendingNonce(account.address, nonce, broadcastResponse.txid);

  return {
    txid: broadcastResponse.txid,
    rawTx: transaction.serialize(),
  };
}

/**
 * Call a smart contract function
 */
export async function callContract(
  account: Account,
  options: ContractCallOptions
): Promise<TransferResult> {
  const networkName = getStacksNetwork(account.network);
  const nonce = await getNextNonce(account.address, account.network);

  // Always resolve a clamped fee — prevents @stacks/transactions from over-estimating.
  const resolvedFee = options.fee ?? await resolveDefaultFee(account.network, "contract_call");

  const transaction = await makeContractCall({
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    senderKey: account.privateKey,
    network: networkName,
    nonce,
    postConditionMode: options.postConditionMode || PostConditionMode.Deny,
    postConditions: options.postConditions || [],
    fee: resolvedFee,
  });

  const broadcastResponse = await broadcastTransaction({
    transaction,
    network: networkName,
  });

  if ("error" in broadcastResponse) {
    throw new Error(
      `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`
    );
  }

  advancePendingNonce(account.address, nonce, broadcastResponse.txid);

  return {
    txid: broadcastResponse.txid,
    rawTx: transaction.serialize(),
  };
}

/**
 * Deploy a smart contract
 */
export async function deployContract(
  account: Account,
  options: ContractDeployOptions
): Promise<TransferResult> {
  const networkName = getStacksNetwork(account.network);
  const nonce = await getNextNonce(account.address, account.network);

  // Always resolve a clamped fee — prevents @stacks/transactions from over-estimating.
  const resolvedFee = options.fee ?? await resolveDefaultFee(account.network, "smart_contract");

  const transaction = await makeContractDeploy({
    contractName: options.contractName,
    codeBody: options.codeBody,
    senderKey: account.privateKey,
    network: networkName,
    nonce,
    fee: resolvedFee,
  });

  const broadcastResponse = await broadcastTransaction({
    transaction,
    network: networkName,
  });

  if ("error" in broadcastResponse) {
    throw new Error(
      `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`
    );
  }

  advancePendingNonce(account.address, nonce, broadcastResponse.txid);

  return {
    txid: broadcastResponse.txid,
    rawTx: transaction.serialize(),
  };
}

/**
 * Sign a transaction without broadcasting (for offline signing)
 */
export async function signStxTransfer(
  account: Account,
  recipient: string,
  amount: bigint,
  memo?: string,
  fee?: bigint
): Promise<{ signedTx: string; txid: string }> {
  const networkName = getStacksNetwork(account.network);

  const transaction = await makeSTXTokenTransfer({
    recipient,
    amount,
    senderKey: account.privateKey,
    network: networkName,
    memo: memo || "",
    ...(fee !== undefined && { fee }),
  });

  return {
    signedTx: transaction.serialize(),
    txid: transaction.txid(),
  };
}

/**
 * Sign a contract call without broadcasting
 */
export async function signContractCall(
  account: Account,
  options: ContractCallOptions
): Promise<{ signedTx: string; txid: string }> {
  const networkName = getStacksNetwork(account.network);

  const transaction = await makeContractCall({
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    senderKey: account.privateKey,
    network: networkName,
    postConditionMode: options.postConditionMode || PostConditionMode.Deny,
    postConditions: options.postConditions || [],
    ...(options.fee !== undefined && { fee: options.fee }),
  });

  return {
    signedTx: transaction.serialize(),
    txid: transaction.txid(),
  };
}

/**
 * Broadcast a pre-signed transaction
 */
export async function broadcastSignedTransaction(
  signedTx: string,
  network: Network
): Promise<{ txid: string }> {
  const baseUrl = getApiBaseUrl(network);
  const txBytes = Buffer.from(hexToBytes(signedTx));

  const response = await fetch(`${baseUrl}/v2/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: txBytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Broadcast failed: ${response.statusText} - ${errorText}`);
  }

  const txid = await response.text();
  return { txid: txid.replace(/"/g, "") };
}

export * from "./sponsor-builder.js";
