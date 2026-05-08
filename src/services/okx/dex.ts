/**
 * OKX DEX Aggregator (WaaS) — single-chain swap endpoints.
 *
 * Base: https://web3.okx.com/api/v5/dex/aggregator/*
 * Auth: OK-ACCESS-{KEY,SIGN,PASSPHRASE,TIMESTAMP,PROJECT} (signed)
 *
 * IMPORTANT: /swap does NOT broadcast. The response contains a `tx` object
 * the caller must sign and broadcast through the user's own wallet
 * (web3.js, ethers, or our internal bitcoin-builder for BTC routes once
 * those are added). Do not claim a swap executed after calling /swap.
 *
 * Phase 2 covers single-chain swaps only. Cross-chain bridge endpoints
 * exist on /api/v5/dex/cross-chain/* but their exact param shapes were
 * not verifiable without a live key — deferred until verified.
 */

import { okxAuthGet, getOkxWeb3BaseUrl } from "./client.js";
import { getOkxCredentials } from "./auth.js";

export interface OkxDexChain {
  chainId: string;
  chainName: string;
  dexTokenApproveAddress?: string;
  [k: string]: unknown;
}

export interface OkxDexToken {
  decimals: string;
  tokenContractAddress: string;
  tokenLogoUrl?: string;
  tokenName: string;
  tokenSymbol: string;
  [k: string]: unknown;
}

/**
 * Param interfaces include `[k: string]: string | undefined` so they
 * conform structurally to the okxAuthGet query-params type without a
 * cast. The named keys are still documented and required where marked.
 */
export interface OkxDexQuoteParams {
  chainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  /** Amount in the smallest unit of fromToken (wei for ETH, satoshi for BTC) */
  amount: string;
  /** Optional decimal slippage, e.g. "0.05" for 5% */
  slippage?: string;
  [k: string]: string | undefined;
}

export interface OkxDexSwapParams extends OkxDexQuoteParams {
  /** EVM address that will execute the swap. Required. */
  userWalletAddress: string;
  slippage: string;
  /** Optional referrer fee address (per OKX docs) */
  referrerAddress?: string;
}

export interface OkxDexApproveParams {
  chainId: string;
  tokenContractAddress: string;
  /** Approval amount in the smallest unit (typically max uint256) */
  approveAmount: string;
  [k: string]: string | undefined;
}

/**
 * Token sub-object included in quote and swap responses.
 * Shape per OKX WaaS DEX docs (https://web3.okx.com/build/docs/waas/dex-swap).
 */
export interface OkxDexTokenInfo {
  decimal: string;
  tokenContractAddress: string;
  tokenSymbol: string;
  tokenUnitPrice?: string;
  [k: string]: unknown;
}

/** Quote response — read-only, no tx returned. */
export interface OkxDexQuoteResponse {
  chainId: string;
  dexRouterList: unknown[];
  estimateGasFee: string;
  fromToken: OkxDexTokenInfo;
  toToken: OkxDexTokenInfo;
  fromTokenAmount: string;
  toTokenAmount: string;
  [k: string]: unknown;
}

/**
 * Swap response — extends quote with a `tx` object the caller must
 * sign and broadcast separately. This service does NOT broadcast.
 */
export interface OkxDexSwapResponse extends OkxDexQuoteResponse {
  tx: {
    data: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    minReceiveAmount: string;
    [k: string]: unknown;
  };
}

/** ERC-20 approval calldata response. */
export interface OkxDexApproveResponse {
  data: string;
  dexContractAddress: string;
  gasLimit: string;
  gasPrice: string;
  [k: string]: unknown;
}

export async function getDexSupportedChains(): Promise<OkxDexChain[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxDexChain>(
    "/api/v5/dex/aggregator/supported/chain",
    undefined,
    creds,
    { baseUrl: getOkxWeb3BaseUrl() }
  );
}

export async function getDexAllTokens(chainId: string): Promise<OkxDexToken[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxDexToken>(
    "/api/v5/dex/aggregator/all-tokens",
    { chainId },
    creds,
    { baseUrl: getOkxWeb3BaseUrl() }
  );
}

/**
 * Get an estimated swap output. Read-only — does not produce a tx.
 * Response includes router path, gas estimate, and toTokenAmount.
 */
export async function getDexQuote(
  params: OkxDexQuoteParams
): Promise<OkxDexQuoteResponse[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxDexQuoteResponse>(
    "/api/v5/dex/aggregator/quote",
    params,
    creds,
    { baseUrl: getOkxWeb3BaseUrl() }
  );
}

/**
 * Get a pre-built swap transaction. The response's `data[0].tx` object
 * contains `{ data, from, to, value, gas, gasPrice, minReceiveAmount }`
 * which the caller must sign + broadcast separately.
 */
export async function getDexSwapTx(
  params: OkxDexSwapParams
): Promise<OkxDexSwapResponse[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxDexSwapResponse>(
    "/api/v5/dex/aggregator/swap",
    params,
    creds,
    { baseUrl: getOkxWeb3BaseUrl() }
  );
}

/**
 * Get the calldata required to approve an ERC-20 token for the OKX DEX
 * router. Only needed for ERC-20 swaps (not native ETH or BTC).
 */
export async function getDexApproveTx(
  params: OkxDexApproveParams
): Promise<OkxDexApproveResponse[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxDexApproveResponse>(
    "/api/v5/dex/aggregator/approve-transaction",
    params,
    creds,
    { baseUrl: getOkxWeb3BaseUrl() }
  );
}
