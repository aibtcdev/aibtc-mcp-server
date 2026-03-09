import {
  ClarityValue,
  uintCV,
  contractPrincipalCV,
  cvToJSON,
  hexToCV,
  PostConditionMode,
  Pc,
  principalCV,
  broadcastTransaction,
  makeContractCall,
  listCV,
  tupleCV,
  noneCV,
  someCV,
  bufferCV,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { AlexSDK, Currency, type TokenInfo } from "alex-sdk";
import { HiroApiService, getHiroApi } from "./hiro-api.js";
import {
  getAlexContracts,
  getZestContracts,
  parseContractId,
  type Network,
  ZEST_ASSETS,
  ZEST_ASSETS_LIST,
  type ZestAssetConfig,
} from "../config/index.js";
import { callContract, type Account, type TransferResult } from "../transactions/builder.js";

// ============================================================================
// Types
// ============================================================================

export interface SwapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  priceImpact?: string;
  route: string[];
}

export interface PoolInfo {
  poolId: string;
  tokenX: string;
  tokenY: string;
  reserveX: string;
  reserveY: string;
  totalShares?: string;
}

export interface PoolListing {
  id: number;
  tokenX: string;
  tokenY: string;
  tokenXSymbol: string;
  tokenYSymbol: string;
  factor: string;
}

export interface ZestMarketInfo {
  asset: string;
  totalSupply: string;
  totalBorrow: string;
  supplyRate: string;
  borrowRate: string;
  utilizationRate: string;
}

export interface ZestUserPosition {
  asset: string;
  supplied: string;
  borrowed: string;
  healthFactor?: string;
}

export interface ZestAsset {
  contractId: string;
  symbol: string;
  name: string;
  decimals?: number;
}

// ============================================================================
// ALEX DEX Service (using alex-sdk)
// ============================================================================

export class AlexDexService {
  private sdk: AlexSDK;
  private hiro: HiroApiService;
  private contracts: ReturnType<typeof getAlexContracts>;
  private tokenInfoCache: TokenInfo[] | null = null;

  constructor(private network: Network) {
    this.sdk = new AlexSDK();
    this.hiro = getHiroApi(network);
    this.contracts = getAlexContracts(network);
  }

  private ensureMainnet(): void {
    if (this.network !== "mainnet") {
      throw new Error("ALEX DEX is only available on mainnet");
    }
  }

  /**
   * Get all swappable token info from SDK (cached)
   */
  private async getTokenInfos(): Promise<TokenInfo[]> {
    if (!this.tokenInfoCache) {
      this.tokenInfoCache = await this.sdk.fetchSwappableCurrency();
    }
    return this.tokenInfoCache;
  }

  /**
   * Convert a token identifier (contract ID or symbol) to an ALEX SDK Currency
   */
  private async resolveCurrency(tokenId: string): Promise<Currency> {
    // Handle common aliases
    const normalizedId = tokenId.toUpperCase();
    if (normalizedId === "STX" || normalizedId === "WSTX") {
      return Currency.STX;
    }
    if (normalizedId === "ALEX") {
      return Currency.ALEX;
    }

    // Fetch available tokens from SDK
    const tokens = await this.getTokenInfos();

    for (const token of tokens) {
      // Match by contract ID (strip the ::asset suffix for comparison)
      const wrapContract = token.wrapToken.split("::")[0];
      const underlyingContract = token.underlyingToken.split("::")[0];

      if (wrapContract === tokenId || underlyingContract === tokenId) {
        return token.id;
      }

      // Match by symbol (case-insensitive)
      if (token.name.toLowerCase() === tokenId.toLowerCase()) {
        return token.id;
      }
    }

    throw new Error(`Unknown token: ${tokenId}. Use alex_list_pools to see available tokens.`);
  }

  /**
   * Get a swap quote for token X to token Y using ALEX SDK
   */
  async getSwapQuote(
    tokenX: string,
    tokenY: string,
    amountIn: bigint,
    _senderAddress: string
  ): Promise<SwapQuote> {
    this.ensureMainnet();

    const currencyX = await this.resolveCurrency(tokenX);
    const currencyY = await this.resolveCurrency(tokenY);

    const amountOut = await this.sdk.getAmountTo(currencyX, amountIn, currencyY);

    // Get route info
    const routeCurrencies = await this.sdk.getRouter(currencyX, currencyY);

    return {
      tokenIn: tokenX,
      tokenOut: tokenY,
      amountIn: amountIn.toString(),
      amountOut: amountOut.toString(),
      route: routeCurrencies.map(c => c.toString()),
    };
  }

  /**
   * Execute a swap using ALEX SDK
   * The SDK handles STX wrapping internally
   */
  async swap(
    account: Account,
    tokenX: string,
    tokenY: string,
    amountIn: bigint,
    minAmountOut: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const currencyX = await this.resolveCurrency(tokenX);
    const currencyY = await this.resolveCurrency(tokenY);

    // Use SDK to build the swap transaction parameters
    const txParams = await this.sdk.runSwap(
      account.address,
      currencyX,
      currencyY,
      amountIn,
      minAmountOut
    );

    // Use makeContractCall to build and sign the transaction
    const transaction = await makeContractCall({
      contractAddress: txParams.contractAddress,
      contractName: txParams.contractName,
      functionName: txParams.functionName,
      functionArgs: txParams.functionArgs,
      postConditions: txParams.postConditions,
      senderKey: account.privateKey,
      network: STACKS_MAINNET,
      postConditionMode: PostConditionMode.Deny,
    });

    const broadcastResult = await broadcastTransaction({
      transaction,
      network: STACKS_MAINNET
    });

    if ("error" in broadcastResult) {
      throw new Error(`Broadcast failed: ${broadcastResult.error} - ${broadcastResult.reason}`);
    }

    return {
      txid: broadcastResult.txid,
      rawTx: transaction.serialize(),
    };
  }

  /**
   * Get pool information
   */
  async getPoolInfo(
    tokenX: string,
    tokenY: string,
    senderAddress: string
  ): Promise<PoolInfo | null> {
    this.ensureMainnet();

    if (!this.contracts) return null;

    try {
      const result = await this.hiro.callReadOnlyFunction(
        this.contracts.ammPool,
        "get-pool-details",
        [
          contractPrincipalCV(...parseContractIdTuple(tokenX)),
          contractPrincipalCV(...parseContractIdTuple(tokenY)),
          uintCV(100000000n), // factor
        ],
        senderAddress
      );

      if (!result.okay || !result.result) {
        return null;
      }

      const decoded = cvToJSON(hexToCV(result.result));

      // Parse the pool details response
      if (decoded.value && typeof decoded.value === "object") {
        return {
          poolId: `${tokenX}-${tokenY}`,
          tokenX,
          tokenY,
          reserveX: decoded.value["balance-x"]?.value || "0",
          reserveY: decoded.value["balance-y"]?.value || "0",
          totalShares: decoded.value["total-supply"]?.value,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * List all available pools on ALEX DEX
   * Uses SDK to fetch swappable currencies
   */
  async listPools(limit: number = 50): Promise<PoolListing[]> {
    this.ensureMainnet();

    if (!this.contracts) return [];

    const pools: PoolListing[] = [];

    for (let i = 1; i <= limit; i++) {
      try {
        const result = await this.hiro.callReadOnlyFunction(
          this.contracts.ammPool,
          "get-pool-details-by-id",
          [uintCV(BigInt(i))],
          this.contracts.ammPool.split(".")[0]
        );

        if (!result.okay || !result.result) {
          break;
        }

        const decoded = cvToJSON(hexToCV(result.result));
        if (!decoded.success || !decoded.value?.value) {
          break;
        }

        const pool = decoded.value.value;
        const tokenX = pool["token-x"]?.value || "";
        const tokenY = pool["token-y"]?.value || "";
        const factor = pool["factor"]?.value || "0";

        // Extract symbol from contract name
        const tokenXSymbol = tokenX.split(".")[1]?.replace("token-", "") || tokenX;
        const tokenYSymbol = tokenY.split(".")[1]?.replace("token-", "") || tokenY;

        pools.push({
          id: i,
          tokenX,
          tokenY,
          tokenXSymbol,
          tokenYSymbol,
          factor,
        });
      } catch {
        // No more pools
        break;
      }
    }

    return pools;
  }

  /**
   * Get all swappable currencies from ALEX SDK
   */
  async getSwappableCurrencies(): Promise<TokenInfo[]> {
    this.ensureMainnet();
    return await this.getTokenInfos();
  }

  /**
   * Get latest prices from ALEX SDK
   */
  async getLatestPrices(): Promise<Record<string, number>> {
    this.ensureMainnet();
    const prices = await this.sdk.getLatestPrices();
    // Convert to regular object with string keys
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(prices)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }
}

// ============================================================================
// Zest Protocol Service
// ============================================================================

export class ZestProtocolService {
  private hiro: HiroApiService;
  private contracts: ReturnType<typeof getZestContracts>;
  private assetsListCache: ClarityValue | null = null;

  constructor(private network: Network) {
    this.hiro = getHiroApi(network);
    this.contracts = getZestContracts(network);
  }

  private ensureMainnet(): void {
    if (!this.contracts) {
      throw new Error("Zest Protocol is only available on mainnet");
    }
  }

  /**
   * Get asset configuration from ZEST_ASSETS by symbol or contract ID
   */
  private getAssetConfig(assetOrSymbol: string): ZestAssetConfig {
    // Check by symbol first (case-insensitive)
    const bySymbol = Object.values(ZEST_ASSETS).find(
      (a) => a.symbol.toLowerCase() === assetOrSymbol.toLowerCase()
    );
    if (bySymbol) return bySymbol;

    // Check by token contract ID
    const byContract = Object.values(ZEST_ASSETS).find(
      (a) => a.token === assetOrSymbol
    );
    if (byContract) return byContract;

    throw new Error(
      `Unknown Zest asset: ${assetOrSymbol}. Use zest_list_assets to see available assets.`
    );
  }

  /**
   * Build the assets-list CV required for borrow/withdraw operations
   * This is a list of tuples containing (asset, lp-token, oracle) for all supported assets
   * Result is cached since ZEST_ASSETS_LIST is static
   */
  private buildAssetsListCV(): ClarityValue {
    if (this.assetsListCache) {
      return this.assetsListCache;
    }

    this.assetsListCache = listCV(
      ZEST_ASSETS_LIST.map((asset) => {
        const [assetAddr, assetName] = parseContractIdTuple(asset.token);
        const [lpAddr, lpName] = parseContractIdTuple(asset.lpToken);
        const [oracleAddr, oracleName] = parseContractIdTuple(asset.oracle);

        return tupleCV({
          asset: contractPrincipalCV(assetAddr, assetName),
          "lp-token": contractPrincipalCV(lpAddr, lpName),
          oracle: contractPrincipalCV(oracleAddr, oracleName),
        });
      })
    );

    return this.assetsListCache;
  }

  /**
   * Pyth price feed IDs used by Zest's oracle contracts.
   * BTC and STX feeds cover all current Zest assets.
   */
  // BTC/USD and STX/USD are sufficient for all current Zest assets.
  // Stablecoin assets (aeUSDC, sUSDT, USDA, USDh) use on-chain fixed-price oracles
  // rather than Pyth feeds, so no additional feed IDs are needed here.
  private static PYTH_FEED_IDS = [
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD
    "0xec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17", // STX/USD
  ];

  private priceFeedCache: { value: ClarityValue; timestamp: number } | null = null;
  private static PRICE_FEED_TTL_MS = 30_000; // 30s cache — oracle rejects >360s

  /**
   * Fetch fresh Pyth price update VAA from Hermes API.
   * Caches for 30s to avoid redundant requests when multiple ops run in sequence.
   * Returns someCV(bufferCV(...)) for the price-feed-bytes parameter,
   * or noneCV() if the fetch fails (graceful degradation).
   */
  private async fetchPriceFeedBytes(): Promise<ClarityValue> {
    if (this.priceFeedCache && Date.now() - this.priceFeedCache.timestamp < ZestProtocolService.PRICE_FEED_TTL_MS) {
      return this.priceFeedCache.value;
    }
    try {
      const ids = ZestProtocolService.PYTH_FEED_IDS
        .map((id) => `ids[]=${id}`)
        .join("&");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const res = await fetch(
        `https://hermes.pyth.network/v2/updates/price/latest?${ids}&encoding=hex`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (!res.ok) {
        console.warn(`Pyth Hermes returned HTTP ${res.status}, falling back to noneCV()`);
        return noneCV();
      }
      const data = await res.json() as { binary?: { data?: string[] } };
      const hex = data?.binary?.data?.[0];
      if (!hex) {
        console.warn("Pyth Hermes response missing binary data, falling back to noneCV()");
        return noneCV();
      }
      const value = someCV(bufferCV(Buffer.from(hex, "hex")));
      this.priceFeedCache = { value, timestamp: Date.now() };
      return value;
    } catch (err) {
      console.warn("Failed to fetch Pyth price feed, falling back to noneCV():", err);
      return noneCV();
    }
  }

  /**
   * Get all supported assets from Zest Protocol
   * Returns the hardcoded asset list with full metadata
   */
  async getAssets(): Promise<ZestAsset[]> {
    this.ensureMainnet();

    return Object.values(ZEST_ASSETS).map((asset) => ({
      contractId: asset.token,
      symbol: asset.symbol,
      name: asset.name,
      decimals: asset.decimals,
    }));
  }

  /**
   * Resolve an asset symbol or contract ID to a full contract ID
   */
  async resolveAsset(assetOrSymbol: string): Promise<string> {
    // If it looks like a contract ID, return as-is
    if (assetOrSymbol.includes(".")) {
      return assetOrSymbol;
    }

    const config = this.getAssetConfig(assetOrSymbol);
    return config.token;
  }

  /**
   * Get user's reserve/position data for an asset
   */
  async getUserPosition(
    asset: string,
    userAddress: string
  ): Promise<ZestUserPosition | null> {
    this.ensureMainnet();

    try {
      const result = await this.hiro.callReadOnlyFunction(
        this.contracts!.poolBorrow,
        "get-user-reserve-data",
        [
          principalCV(userAddress),
          contractPrincipalCV(...parseContractIdTuple(asset)),
        ],
        userAddress
      );

      if (!result.okay || !result.result) {
        return null;
      }

      const decoded = cvToJSON(hexToCV(result.result));

      if (decoded && typeof decoded === "object") {
        return {
          asset,
          supplied: decoded["current-a-token-balance"]?.value || "0",
          borrowed: decoded["current-variable-debt"]?.value || "0",
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Supply assets to Zest lending pool via borrow-helper
   *
   * Contract signature: supply(lp, pool-reserve, asset, amount, owner, referral, incentives)
   */
  async supply(
    account: Account,
    asset: string,
    amount: bigint,
    onBehalfOf?: string
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.borrowHelper);
    const [lpAddr, lpName] = parseContractIdTuple(assetConfig.lpToken);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);
    const [incentivesAddr, incentivesName] = parseContractIdTuple(this.contracts!.incentives);

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(lpAddr, lpName),                    // lp
      principalCV(this.contracts!.poolReserve),               // pool-reserve
      contractPrincipalCV(assetAddr, assetName),              // asset
      uintCV(amount),                                         // amount
      principalCV(onBehalfOf || account.address),             // owner
      noneCV(),                                               // referral (none for now)
      contractPrincipalCV(incentivesAddr, incentivesName),    // incentives
    ];

    // Post-condition: user will send the asset
    const postConditions = [
      Pc.principal(account.address)
        .willSendEq(amount)
        .ft(assetConfig.token as `${string}.${string}`, assetName),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "supply",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Withdraw assets from Zest lending pool via borrow-helper
   *
   * Contract signature: withdraw(lp, pool-reserve, asset, oracle, amount, owner, assets, incentives, price-feed-bytes)
   */
  async withdraw(
    account: Account,
    asset: string,
    amount: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.borrowHelper);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);
    const [lpAddr, lpName] = parseContractIdTuple(assetConfig.lpToken);
    const [oracleAddr, oracleName] = parseContractIdTuple(assetConfig.oracle);
    const [incentivesAddr, incentivesName] = parseContractIdTuple(this.contracts!.incentives);

    const priceFeedBytes = await this.fetchPriceFeedBytes();

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(lpAddr, lpName),                    // lp
      principalCV(this.contracts!.poolReserve),               // pool-reserve
      contractPrincipalCV(assetAddr, assetName),              // asset
      contractPrincipalCV(oracleAddr, oracleName),            // oracle
      uintCV(amount),                                         // amount
      principalCV(account.address),                           // owner
      this.buildAssetsListCV(),                               // assets
      contractPrincipalCV(incentivesAddr, incentivesName),    // incentives
      priceFeedBytes,                                          // price-feed-bytes (Pyth VAA)
    ];

    // Post-conditions:
    // 1. pool-vault sends us the withdrawn asset (not pool-reserve)
    // 2. sender pays small STX fee for Pyth oracle update (~2 uSTX)
    // 3. sender burns LP tokens (zsbtc etc.)
    // LP tokens are minted 1:1 with supplied amount, so burning ≤ withdraw amount is safe.
    const [lpFtContract, lpFtAssetName] = assetConfig.lpFungibleToken.split("::");
    const postConditions = [
      Pc.principal(this.contracts!.poolVault as `${string}.${string}`)
        .willSendLte(amount)
        .ft(assetConfig.token as `${string}.${string}`, assetName),
      Pc.principal(account.address)
        .willSendLte(100n)
        .ustx(),
      Pc.principal(account.address)
        .willSendLte(amount)
        .ft(lpFtContract as `${string}.${string}`, lpFtAssetName),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "withdraw",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Borrow assets from Zest lending pool via borrow-helper
   *
   * Contract signature: borrow(pool-reserve, oracle, asset-to-borrow, lp, assets, amount, fee-calculator, interest-rate-mode, owner, price-feed-bytes)
   */
  async borrow(
    account: Account,
    asset: string,
    amount: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.borrowHelper);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);
    const [lpAddr, lpName] = parseContractIdTuple(assetConfig.lpToken);
    const [oracleAddr, oracleName] = parseContractIdTuple(assetConfig.oracle);

    const priceFeedBytes = await this.fetchPriceFeedBytes();

    const functionArgs: ClarityValue[] = [
      principalCV(this.contracts!.poolReserve),               // pool-reserve
      contractPrincipalCV(oracleAddr, oracleName),            // oracle
      contractPrincipalCV(assetAddr, assetName),              // asset-to-borrow
      contractPrincipalCV(lpAddr, lpName),                    // lp
      this.buildAssetsListCV(),                               // assets
      uintCV(amount),                                         // amount-to-be-borrowed
      principalCV(this.contracts!.feesCalculator),            // fee-calculator
      uintCV(BigInt(0)),                                      // interest-rate-mode (0 = variable)
      principalCV(account.address),                           // owner
      priceFeedBytes,                                          // price-feed-bytes (Pyth VAA)
    ];

    // Post-conditions:
    // 1. pool-vault sends borrowed asset (not pool-reserve)
    // 2. sender pays small STX fee for Pyth oracle update (~2 uSTX)
    const postConditions = [
      Pc.principal(this.contracts!.poolVault as `${string}.${string}`)
        .willSendLte(amount)
        .ft(assetConfig.token as `${string}.${string}`, assetName),
      Pc.principal(account.address)
        .willSendLte(100n)
        .ustx(),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "borrow",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Repay borrowed assets
   *
   * Contract signature: repay(asset, amount-to-repay, on-behalf-of, payer)
   */
  async repay(
    account: Account,
    asset: string,
    amount: bigint,
    onBehalfOf?: string
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.poolBorrow);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(assetAddr, assetName),              // asset
      uintCV(amount),                                         // amount-to-repay
      principalCV(onBehalfOf || account.address),             // on-behalf-of
      principalCV(account.address),                           // payer
    ];

    // Post-condition: user will send the asset to repay
    const postConditions = [
      Pc.principal(account.address)
        .willSendLte(amount)
        .ft(assetConfig.token as `${string}.${string}`, assetName),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "repay",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Claim accumulated rewards from Zest incentives program via borrow-helper
   *
   * Currently: sBTC suppliers earn wSTX rewards
   *
   * Contract signature: claim-rewards(lp, pool-reserve, asset, oracle, owner, assets, reward-asset, incentives, price-feed-bytes)
   */
  async claimRewards(
    account: Account,
    asset: string
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.borrowHelper);
    const [lpAddr, lpName] = parseContractIdTuple(assetConfig.lpToken);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);
    const [oracleAddr, oracleName] = parseContractIdTuple(assetConfig.oracle);
    const [incentivesAddr, incentivesName] = parseContractIdTuple(this.contracts!.incentives);
    const [wstxAddr, wstxName] = parseContractIdTuple(this.contracts!.wstx);

    // Pre-check: query pending rewards before broadcasting to avoid wasting gas
    // when there are no rewards (on-chain tx would abort with ERR_NO_REWARDS)
    const rewardsResult = await this.hiro.callReadOnlyFunction(
      this.contracts!.incentives,
      "get-vault-rewards",
      [
        principalCV(account.address),
        contractPrincipalCV(assetAddr, assetName),
        contractPrincipalCV(wstxAddr, wstxName),
      ],
      account.address
    );

    if (rewardsResult.okay && rewardsResult.result) {
      const decoded = cvToJSON(hexToCV(rewardsResult.result));
      // get-vault-rewards returns a bare uint, but handle (ok uint) / (response uint uint)
      // defensively in case the contract is upgraded.
      // Bare uint: { type: "uint", value: "123" }
      // Response-wrapped: { type: "ok", value: { type: "uint", value: "123" } }
      const rawValue =
        typeof decoded?.value === "object" && decoded.value?.value !== undefined
          ? decoded.value.value
          : decoded?.value;

      if (rawValue === undefined) {
        // Can't decode response -- skip pre-check, let the on-chain tx decide
      } else if (BigInt(rawValue) === 0n) {
        throw new Error(
          "No rewards available to claim. Skipping broadcast to avoid wasting gas."
        );
      }
    } else if (!rewardsResult.okay) {
      console.error(
        `[zest] get-vault-rewards read-only call failed: ${rewardsResult.result ?? "unknown error"}. Skipping pre-check.`
      );
    }

    const priceFeedBytes = await this.fetchPriceFeedBytes();

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(lpAddr, lpName),                    // lp
      principalCV(this.contracts!.poolReserve),               // pool-reserve
      contractPrincipalCV(assetAddr, assetName),              // asset
      contractPrincipalCV(oracleAddr, oracleName),            // oracle
      principalCV(account.address),                           // owner
      this.buildAssetsListCV(),                               // assets
      contractPrincipalCV(wstxAddr, wstxName),                // reward-asset (wSTX)
      contractPrincipalCV(incentivesAddr, incentivesName),    // incentives
      priceFeedBytes,                                          // price-feed-bytes (Pyth VAA)
    ];

    // Post-conditions:
    // 1. pool reserve will send wSTX rewards to user
    // 2. sender pays small STX fee for Pyth oracle update (~2 uSTX)
    const postConditions = [
      Pc.principal(this.contracts!.poolReserve)
        .willSendGte(0n)
        .ft(this.contracts!.wstx as `${string}.${string}`, wstxName),
      Pc.principal(account.address)
        .willSendLte(100n)
        .ustx(),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "claim-rewards",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseContractIdTuple(contractId: string): [string, string] {
  const { address, name } = parseContractId(contractId);
  return [address, name];
}

// ============================================================================
// Service Singletons
// ============================================================================

let _alexServiceInstance: AlexDexService | null = null;
let _zestServiceInstance: ZestProtocolService | null = null;

export function getAlexDexService(network: Network): AlexDexService {
  if (!_alexServiceInstance || _alexServiceInstance["network"] !== network) {
    _alexServiceInstance = new AlexDexService(network);
  }
  return _alexServiceInstance;
}

export function getZestProtocolService(network: Network): ZestProtocolService {
  if (!_zestServiceInstance || _zestServiceInstance["network"] !== network) {
    _zestServiceInstance = new ZestProtocolService(network);
  }
  return _zestServiceInstance;
}
