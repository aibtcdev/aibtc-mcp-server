import { Network } from "./networks.js";

/**
 * Known contract addresses for mainnet
 */
export const MAINNET_CONTRACTS = {
  // sBTC
  SBTC_TOKEN: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
  SBTC_DEPOSIT: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-deposit",
  SBTC_REGISTRY: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-registry",
  SBTC_WITHDRAWAL: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-withdrawal",

  // Stablecoins
  USDCX: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",

  // BNS
  BNS: "SP000000000000000000002Q6VF78.bns",

  // Stacking
  POX_4: "SP000000000000000000002Q6VF78.pox-4",

  // ALEX DEX (SDK handles most operations, but we need pool contract for queries)
  ALEX_AMM_POOL: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.amm-swap-pool-v1-1",
  ALEX_TOKEN: "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex",
  ALEX_WSTX: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wstx-v2",

  // Zest Protocol v2
  ZEST_MARKET: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-4-market",
  ZEST_DATA: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.protocol-data", // read-only helper for v0-4-market positions
  ZEST_MARKET_VAULT: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-market-vault",
  ZEST_VAULT_STX: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-stx",
  ZEST_VAULT_SBTC: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-sbtc",
  ZEST_VAULT_STSTX: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-ststx",
  ZEST_VAULT_USDC: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-usdc",
  ZEST_VAULT_USDH: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-usdh",
  ZEST_VAULT_STSTXBTC: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-ststxbtc",
  ZEST_WSTX: "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.wstx",

  // ERC-8004 Identity & Reputation
  IDENTITY_REGISTRY: "SP1NMR7MY0TJ1QA7WQBZ6504KC79PZNTRQH4YGFJD.identity-registry-v2",
  REPUTATION_REGISTRY: "SP1NMR7MY0TJ1QA7WQBZ6504KC79PZNTRQH4YGFJD.reputation-registry-v2",
  VALIDATION_REGISTRY: "SP1NMR7MY0TJ1QA7WQBZ6504KC79PZNTRQH4YGFJD.validation-registry-v2",
} as const;

/**
 * Zest Protocol v2 asset configuration
 * Each asset has: token, vault, assetId, decimals, symbol, name
 */
export interface ZestAssetConfig {
  token: string;
  /** FT asset name for the underlying (e.g. "sbtc-token" from sbtc-token::sbtc-token). null for wSTX which uses native STX transfers. */
  tokenAssetName: string | null;
  vault: string;
  assetId: number; // asset index from protocol-data: STX=0, zSTX=1, sBTC=2, zsBTC=3, stSTX=4, etc. Evens=underlying, odds=zTokens
  decimals: number;
  symbol: string;
  name: string;
  /** Whether the token uses native STX transfers (true for wSTX) */
  isNativeStx: boolean;
}

export const ZEST_V2_DEPLOYER = "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7";
export const ZEST_V2_MARKET = `${ZEST_V2_DEPLOYER}.v0-4-market`;
export const ZEST_V2_MARKET_VAULT = `${ZEST_V2_DEPLOYER}.v0-market-vault`;

export const ZEST_ASSETS: Record<string, ZestAssetConfig> = {
  wSTX: {
    token: `${ZEST_V2_DEPLOYER}.wstx`,
    tokenAssetName: null, // uses native stx-transfer?, not ft-transfer?
    vault: `${ZEST_V2_DEPLOYER}.v0-vault-stx`,
    assetId: 0,
    decimals: 6,
    symbol: "wSTX",
    name: "Wrapped STX",
    isNativeStx: true,
  },
  sBTC: {
    token: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
    tokenAssetName: "sbtc-token",
    vault: `${ZEST_V2_DEPLOYER}.v0-vault-sbtc`,
    assetId: 2,
    decimals: 8,
    symbol: "sBTC",
    name: "sBTC",
    isNativeStx: false,
  },
  stSTX: {
    token: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token",
    tokenAssetName: "ststx",
    vault: `${ZEST_V2_DEPLOYER}.v0-vault-ststx`,
    assetId: 4,
    decimals: 6,
    symbol: "stSTX",
    name: "Stacked STX",
    isNativeStx: false,
  },
  USDC: {
    token: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
    tokenAssetName: "usdcx-token",
    vault: `${ZEST_V2_DEPLOYER}.v0-vault-usdc`,
    assetId: 6,
    decimals: 6,
    symbol: "USDC",
    name: "USD Coin",
    isNativeStx: false,
  },
  USDH: {
    token: "SPN5AKG35QZSK2M8GAMR4AFX45659RJHDW353HSG.usdh-token-v1",
    tokenAssetName: "usdh",
    vault: `${ZEST_V2_DEPLOYER}.v0-vault-usdh`,
    assetId: 8,
    decimals: 8,
    symbol: "USDH",
    name: "USDH Stablecoin",
    isNativeStx: false,
  },
  stSTXbtc: {
    token: "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststxbtc-token-v2",
    tokenAssetName: "ststxbtc",
    vault: `${ZEST_V2_DEPLOYER}.v0-vault-ststxbtc`,
    assetId: 10,
    decimals: 6,
    symbol: "stSTXbtc",
    name: "Stacked STX BTC",
    isNativeStx: false,
  },
};

/**
 * Known contract addresses for testnet
 */
export const TESTNET_CONTRACTS = {
  // sBTC (testnet) — ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT is the testnet sBTC deployer
  SBTC_TOKEN: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-token",
  SBTC_DEPOSIT: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-deposit",
  SBTC_REGISTRY: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-registry",
  SBTC_WITHDRAWAL: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.sbtc-withdrawal",

  // Stablecoins (testnet — no known testnet USDCx deployment yet, placeholder)
  USDCX: "ST1F7QA2MDF17S807EPA36TSS8AMEFY4KA9TVGWXT.usdcx",

  // BNS
  BNS: "ST000000000000000000002AMW42H.bns",

  // Stacking
  POX_4: "ST000000000000000000002AMW42H.pox-4",

  // ERC-8004 Identity & Reputation
  IDENTITY_REGISTRY: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18.identity-registry-v2",
  REPUTATION_REGISTRY: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18.reputation-registry-v2",
  VALIDATION_REGISTRY: "ST3YT0XW92E6T2FE59B2G5N2WNNFSBZ6MZKQS5D18.validation-registry-v2",
} as const;

/**
 * Get contract addresses for the specified network
 */
export function getContracts(network: Network) {
  return network === "mainnet" ? MAINNET_CONTRACTS : TESTNET_CONTRACTS;
}

/**
 * Parse a contract identifier into address and name
 */
export function parseContractId(contractId: string): { address: string; name: string } {
  const [address, name] = contractId.split(".");
  if (!address || !name) {
    throw new Error(`Invalid contract ID: ${contractId}`);
  }
  return { address, name };
}

/**
 * Fallback token contract IDs (used only when dynamic resolution fails)
 * Prefer using resolveTokenSymbol() which checks user balances first
 */
export const WELL_KNOWN_TOKENS = {
  mainnet: {
    STX: "native",
    sBTC: MAINNET_CONTRACTS.SBTC_TOKEN,
    USDCx: MAINNET_CONTRACTS.USDCX,
    ALEX: MAINNET_CONTRACTS.ALEX_TOKEN,
    wSTX: MAINNET_CONTRACTS.ALEX_WSTX,
  },
  testnet: {
    STX: "native",
    sBTC: TESTNET_CONTRACTS.SBTC_TOKEN,
    USDCx: TESTNET_CONTRACTS.USDCX,
  },
} as const;

/**
 * Get ALEX DEX contract addresses for the network
 * Note: Most ALEX operations use the alex-sdk, but we need the pool contract for queries
 */
export function getAlexContracts(network: Network) {
  if (network === "mainnet") {
    return {
      ammPool: MAINNET_CONTRACTS.ALEX_AMM_POOL,
    };
  }
  // ALEX is mainnet-only currently
  return null;
}

/**
 * Get Zest Protocol v2 contract addresses for the network
 */
export function getZestContracts(network: Network) {
  if (network === "mainnet") {
    return {
      market: MAINNET_CONTRACTS.ZEST_MARKET,
      data: MAINNET_CONTRACTS.ZEST_DATA,
      marketVault: MAINNET_CONTRACTS.ZEST_MARKET_VAULT,
    };
  }
  // Zest is mainnet-only currently
  return null;
}

export function getWellKnownTokens(network: Network) {
  return WELL_KNOWN_TOKENS[network];
}

/**
 * Bitflow DEX contract addresses
 */
export const BITFLOW_CONTRACTS = {
  mainnet: {
    // Primary StableSwap and Earn contracts
    PRIMARY: "SPQC38PW542EQJ5M11CR25P7BS1CA6QT4TBXGB3M",
    // XYK pool contracts
    XYK: "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR",
  },
  testnet: {
    PRIMARY: "STRP7MYBHSMFH5EGN3HGX6KNQ7QBHVTBPF1669DW",
    XYK: null,
  },
} as const;

/**
 * Bitflow configuration
 */
export interface BitflowConfig {
  apiHost: string;
  apiKey: string | undefined;
  readOnlyCallApiHost: string;
  keeperApiHost?: string;
  keeperApiKey?: string;
}

/**
 * Get Bitflow configuration from environment.
 *
 * As of @bitflowlabs/core-sdk v2.4.2, API keys are fully optional.
 * All public endpoints (tokens, quotes, routes, swaps) are accessible
 * without a key at 500 req/min per IP. Keys only needed for higher limits.
 *
 * Optional env vars:
 * - BITFLOW_API_KEY: Core API key (higher rate limits)
 * - BITFLOW_API_HOST: Override default API host
 * - BITFLOW_KEEPER_API_KEY: Keeper automation features
 * - BITFLOW_KEEPER_API_HOST: Override Keeper API host
 * - BITFLOW_READONLY_API_HOST: Override Stacks read-only node (default: api.hiro.so)
 */
export function getBitflowConfig(): BitflowConfig {
  const readOnlyCallApiHost = process.env.BITFLOW_READONLY_API_HOST || "https://api.hiro.so";

  return {
    apiHost: process.env.BITFLOW_API_HOST || "https://bitflowsdk-api-test-7owjsmt8.uk.gateway.dev",
    apiKey: process.env.BITFLOW_API_KEY,
    readOnlyCallApiHost,
    keeperApiHost: process.env.BITFLOW_KEEPER_API_HOST || "https://bitflow-keeper-test-7owjsmt8.uc.gateway.dev",
    keeperApiKey: process.env.BITFLOW_KEEPER_API_KEY,
  };
}

/**
 * Get Bitflow contract addresses for the network
 */
export function getBitflowContracts(network: Network) {
  return BITFLOW_CONTRACTS[network];
}

/**
 * Bitflow public API base URL (no API key required)
 */
export const BITFLOW_PUBLIC_API = "https://bitflow-sdk-api-gateway-7owjsmt8.uc.gateway.dev";

/**
 * Get ERC-8004 contract addresses for the network
 */
export function getErc8004Contracts(network: Network) {
  const contracts = network === "mainnet" ? MAINNET_CONTRACTS : TESTNET_CONTRACTS;
  return {
    identityRegistry: contracts.IDENTITY_REGISTRY,
    reputationRegistry: contracts.REPUTATION_REGISTRY,
    validationRegistry: contracts.VALIDATION_REGISTRY,
  };
}
