/**
 * OKX Wallet API (WaaS) — read-only address-level queries.
 *
 * Base: https://web3.okx.com/api/v5/wallet/*
 * Auth: same OK-ACCESS-* scheme as DEX aggregator (signed + project id)
 *
 * Phase 2 covers only the WaaS endpoints whose paths were verified live
 * (return 50111 with dummy auth, not 404). BRC-20 / Runes / Inscriptions
 * are NOT served by WaaS — they live on OKLink Explorer (separate API,
 * separate auth) and are intentionally NOT included here. A future phase
 * can add OKLink integration if needed.
 *
 * chainIndex values are decimal/string identifiers. Do NOT hardcode them
 * client-side — call getWalletSupportedChains() to enumerate the
 * authoritative list returned by OKX (correct for the caller's account).
 */

import { okxAuthGet, getOkxWeb3BaseUrl } from "./client.js";
import { getOkxCredentials } from "./auth.js";

const WAAS = { baseUrl: getOkxWeb3BaseUrl() };

export interface OkxWalletChain {
  name: string;
  logoUrl?: string;
  shortName?: string;
  chainIndex: string;
  [k: string]: unknown;
}

export interface OkxWalletTokenBalance {
  chainIndex: string;
  tokenAddress: string;
  symbol?: string;
  balance: string;
  /** USD-denominated price snapshot at query time */
  tokenPrice?: string;
  isRiskToken?: boolean;
  [k: string]: unknown;
}

export interface OkxWalletUtxo {
  txHash: string;
  vOut: string;
  height?: string;
  blockTime?: string;
  amount: string;
  [k: string]: unknown;
}

/**
 * Enumerate chains supported by the Wallet API for the calling account.
 * Returns the authoritative chainIndex values to use in subsequent calls.
 */
export async function getWalletSupportedChains(): Promise<OkxWalletChain[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxWalletChain>(
    "/api/v5/wallet/chain/supported-chains",
    undefined,
    creds,
    WAAS
  );
}

/**
 * Get fungible token balances for an address on one or more chains.
 *
 * @param address  EVM (0x…) or chain-native address (BTC bc1… etc.)
 * @param chains   Comma-separated chainIndex list, e.g. "1" or "1,8453"
 *                 Use getWalletSupportedChains() to discover valid values.
 */
export async function getWalletTokenBalances(
  address: string,
  chains: string
): Promise<OkxWalletTokenBalance[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxWalletTokenBalance>(
    "/api/v5/wallet/asset/all-token-balances-by-address",
    { address, chains },
    creds,
    WAAS
  );
}

/**
 * Get UTXOs for an address on a Bitcoin-family chain.
 *
 * @param chainIndex  Chain identifier (e.g. Bitcoin L1; verify via
 *                    getWalletSupportedChains())
 * @param address     Bitcoin address
 */
export async function getWalletUtxos(
  chainIndex: string,
  address: string
): Promise<OkxWalletUtxo[]> {
  const creds = await getOkxCredentials();
  return okxAuthGet<OkxWalletUtxo>(
    "/api/v5/wallet/utxo/utxos",
    { chainIndex, address },
    creds,
    WAAS
  );
}
