import {
  makeSTXTokenTransfer,
  makeContractCall,
  ClarityValue,
  PostConditionMode,
  PostCondition,
} from "@stacks/transactions";
import { getStacksNetwork, type Network } from "../config/networks.js";
import { getSponsorRelayUrl } from "../config/sponsor.js";

export interface SponsoredTransferOptions {
  senderKey: string;
  recipient: string;
  amount: bigint;
  memo?: string;
  network: Network;
}

export interface SponsoredContractCallOptions {
  senderKey: string;
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditionMode?: PostConditionMode;
  postConditions?: PostCondition[];
  network: Network;
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
 * Build and submit a sponsored STX transfer transaction
 */
export async function transferStxSponsored(
  options: SponsoredTransferOptions,
  apiKey: string
): Promise<SponsorRelayResponse> {
  const networkName = getStacksNetwork(options.network);

  const transaction = await makeSTXTokenTransfer({
    recipient: options.recipient,
    amount: options.amount,
    senderKey: options.senderKey,
    network: networkName,
    memo: options.memo || "",
    sponsored: true,
    fee: 0n,
  });

  const serializedTx = Buffer.from(transaction.serialize()).toString("hex");
  return submitToSponsorRelay(serializedTx, options.network, apiKey);
}

/**
 * Build and submit a sponsored contract call transaction
 */
export async function callContractSponsored(
  options: SponsoredContractCallOptions,
  apiKey: string
): Promise<SponsorRelayResponse> {
  const networkName = getStacksNetwork(options.network);

  const transaction = await makeContractCall({
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    senderKey: options.senderKey,
    network: networkName,
    postConditionMode: options.postConditionMode || PostConditionMode.Deny,
    postConditions: options.postConditions || [],
    sponsored: true,
    fee: 0n,
  });

  const serializedTx = Buffer.from(transaction.serialize()).toString("hex");
  return submitToSponsorRelay(serializedTx, options.network, apiKey);
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

  const data = await response.json();

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
