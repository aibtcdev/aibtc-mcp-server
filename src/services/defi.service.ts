import {
  ClarityValue,
  uintCV,
  contractPrincipalCV,
  cvToJSON,
  hexToCV,
  PostConditionMode,
  Pc,
  principalCV,
  noneCV,
  someCV,
} from "@stacks/transactions";
import { AlexSDK, Currency, type TokenInfo } from "alex-sdk";
import { HiroApiService, getHiroApi } from "./hiro-api.js";
import {
  getAlexContracts,
  getZestContracts,
  parseContractId,
  type Network,
  ZEST_ASSETS,
  ZEST_V2_MARKET,
  ZEST_V2_MARKET_VAULT,
  type ZestAssetConfig,
} from "../config/index.js";
import { callContract, type Account, type TransferResult, type ContractCallOptions } from "../transactions/builder.js";

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
  suppliedShares: string;
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

    // Use callContract from builder so nonce tracking and fee clamping apply automatically.
    const callOptions: ContractCallOptions = {
      contractAddress: txParams.contractAddress,
      contractName: txParams.contractName,
      functionName: txParams.functionName,
      functionArgs: txParams.functionArgs,
      postConditions: txParams.postConditions,
      postConditionMode: PostConditionMode.Deny,
    };

    return callContract(account, callOptions);
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
// Zest Protocol v2 Service
// ============================================================================

export class ZestProtocolService {
  private hiro: HiroApiService;
  private contracts: ReturnType<typeof getZestContracts>;

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
   * Get all supported assets from Zest Protocol (v0-4-market)
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
    if (assetOrSymbol.includes(".")) {
      return assetOrSymbol;
    }
    const config = this.getAssetConfig(assetOrSymbol);
    return config.token;
  }

  /**
   * Get user's full position on Zest via the protocol-data helper contract.
   * Returns collateral, debt, health factor, and LTV data in a single call.
   */
  async getUserPosition(
    asset: string,
    userAddress: string
  ): Promise<ZestUserPosition | null> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);

    try {
      const result = await this.hiro.callReadOnlyFunction(
        this.contracts!.data,
        "get-user-position",
        [principalCV(userAddress)],
        userAddress
      );

      if (!result.okay || !result.result) {
        return null;
      }

      const decoded = cvToJSON(hexToCV(result.result));
      if (!decoded || decoded.success === false) {
        return null;
      }

      // Unwrap (ok ...) → tuple with nested .value from cvToJSON
      const position = decoded.value?.value ?? decoded.value;
      if (!position) {
        return null;
      }

      // Extract collateral shares for this asset from collateral list
      // collateral: list of { aid: uint, amount: uint }
      // Collateral uses zToken IDs (assetId + 1): zSTX=1, zsBTC=3, zstSTX=5, etc.
      const zTokenId = assetConfig.assetId + 1;
      const collateralList: any[] = position["collateral"]?.value ?? [];
      const collateralEntry = collateralList.find(
        (c: any) => String(c.value?.aid?.value) === String(zTokenId)
      );
      const suppliedShares = collateralEntry?.value?.amount?.value ?? "0";

      // Extract debt for this asset from debt list
      // debt: list of { actual-debt: uint, asset-id: uint, ... }
      const debtList: any[] = position["debt"]?.value ?? [];
      const debtEntry = debtList.find(
        (d: any) => String(d.value?.["asset-id"]?.value) === String(assetConfig.assetId)
      );
      const borrowed = debtEntry?.value?.["actual-debt"]?.value ?? "0";

      return {
        asset,
        suppliedShares,
        borrowed,
        healthFactor: position["health-factor"]?.value,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get detailed per-asset supply balances via the data helper.
   * Returns vault share balances, underlying equivalents, and market collateral.
   */
  async getUserSupplies(userAddress: string): Promise<Record<string, unknown> | null> {
    this.ensureMainnet();

    try {
      const result = await this.hiro.callReadOnlyFunction(
        this.contracts!.data,
        "get-supplies-user",
        [principalCV(userAddress)],
        userAddress
      );

      if (!result.okay || !result.result) {
        return null;
      }

      return cvToJSON(hexToCV(result.result));
    } catch {
      return null;
    }
  }

  /**
   * Build post-conditions for a principal sending tokens.
   * Handles wSTX (native STX transfers) vs FT transfers.
   */
  private buildSendPC(
    principal: string,
    amount: bigint,
    assetConfig: ZestAssetConfig,
    mode: "eq" | "lte"
  ) {
    if (assetConfig.isNativeStx) {
      return mode === "eq"
        ? Pc.principal(principal).willSendEq(amount).ustx()
        : Pc.principal(principal).willSendLte(amount).ustx();
    }
    const builder = mode === "eq"
      ? Pc.principal(principal).willSendEq(amount)
      : Pc.principal(principal).willSendLte(amount);
    return builder.ft(
      assetConfig.token as `${string}.${string}`,
      assetConfig.tokenAssetName!
    );
  }

  /**
   * Query the vault's convert-to-assets to predict underlying amount for a given share amount.
   * Used to set accurate post-conditions for withdraw operations (shares appreciate over time).
   */
  private async getExpectedUnderlying(
    assetConfig: ZestAssetConfig,
    shares: bigint,
    senderAddress: string
  ): Promise<bigint> {
    try {
      const result = await this.hiro.callReadOnlyFunction(
        assetConfig.vault,
        "convert-to-assets",
        [uintCV(shares)],
        senderAddress
      );
      if (result.okay && result.result) {
        const decoded = cvToJSON(hexToCV(result.result));
        const value = decoded?.value?.value ?? decoded?.value;
        if (value !== undefined) {
          return BigInt(value);
        }
      }
    } catch {
      // Fall back to shares as lower bound estimate
    }
    return shares;
  }

  /**
   * Query the vault's convert-to-shares to predict zToken amount for a given underlying amount.
   * Used to set accurate post-conditions for supply operations.
   */
  private async getExpectedShares(
    assetConfig: ZestAssetConfig,
    amount: bigint,
    senderAddress: string
  ): Promise<bigint> {
    try {
      const result = await this.hiro.callReadOnlyFunction(
        assetConfig.vault,
        "convert-to-shares",
        [uintCV(amount)],
        senderAddress
      );
      if (result.okay && result.result) {
        const decoded = cvToJSON(hexToCV(result.result));
        const value = decoded?.value?.value ?? decoded?.value;
        if (value !== undefined) {
          return BigInt(value);
        }
      }
    } catch {
      // Fall back to amount as upper bound
    }
    return amount;
  }

  /**
   * Supply assets to Zest Protocol via market's supply-collateral-add.
   * Atomically deposits into vault and adds zTokens as collateral.
   * This earns yield AND provides borrowing power.
   *
   * Token flow (3 ft-transfers):
   * 1. user → market (underlying)
   * 2. market → vault (underlying)
   * 3. user → market-vault (zTokens, minted to user then transferred)
   *
   * Contract: v0-4-market.supply-collateral-add(ft, amount, min-shares, price-feeds)
   */
  async supply(
    account: Account,
    asset: string,
    amount: bigint,
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.market);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);

    // Pre-query expected zToken shares for accurate post-conditions
    const expectedShares = await this.getExpectedShares(assetConfig, amount, account.address);

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(assetAddr, assetName),  // ft (underlying token)
      uintCV(amount),                              // amount
      uintCV(expectedShares > 0n ? (expectedShares * 95n) / 100n : 0n),  // min-shares (5% slippage tolerance)
      noneCV(),                                    // price-feeds (use cached)
    ];

    // Post-conditions for all 3 ft-transfers:
    // 1. User sends underlying → market
    // 2. Market forwards underlying → vault
    // 3. User sends minted zTokens → market-vault (as collateral)
    const postConditions = [
      this.buildSendPC(account.address, amount, assetConfig, "eq"),
      this.buildSendPC(ZEST_V2_MARKET, amount, assetConfig, "lte"),
      Pc.principal(account.address)
        .willSendLte(expectedShares)
        .ft(assetConfig.vault as `${string}.${string}`, "zft"),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "supply-collateral-add",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Add existing zTokens as collateral on Zest Protocol.
   * Use this when you deposited directly to a vault (via depositToVault)
   * and need to register those zTokens as collateral for borrowing.
   *
   * Note: supply() already calls supply-collateral-add which handles this
   * atomically. This method is only needed for the deposit → collateral flow.
   *
   * Token flow (1 ft-transfer):
   * 1. user → market-vault (zTokens registered as collateral)
   *
   * Contract: v0-4-market.collateral-add(ft, amount, price-feeds)
   */
  async enableCollateral(
    account: Account,
    asset: string,
    amount: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.market);
    const [vaultAddr, vaultName] = parseContractIdTuple(assetConfig.vault);

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(vaultAddr, vaultName),  // ft (zToken vault contract)
      uintCV(amount),                              // amount of zTokens
      noneCV(),                                    // price-feeds (use cached)
    ];

    // Post-condition: user sends zTokens to market-vault
    const postConditions = [
      Pc.principal(account.address)
        .willSendLte(amount)
        .ft(assetConfig.vault as `${string}.${string}`, "zft"),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "collateral-add",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Withdraw assets from Zest Protocol via market's collateral-remove-redeem.
   * Atomically removes zToken collateral and redeems for underlying.
   *
   * Token flow (3 ft-transfers):
   * 1. market-vault → market (zTokens released from collateral)
   * 2. market → vault (zTokens for redemption/burn)
   * 3. vault → user (underlying redeemed)
   *
   * Contract: v0-4-market.collateral-remove-redeem(ft, amount, min-underlying, receiver, price-feeds)
   *
   * @param amount - Amount in zToken shares to withdraw
   */
  async withdraw(
    account: Account,
    asset: string,
    amount: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.market);
    const [vaultAddr, vaultName] = parseContractIdTuple(assetConfig.vault);

    // Pre-query: how much underlying will we get for these shares?
    // Shares appreciate over time, so underlying > shares amount.
    const expectedUnderlying = await this.getExpectedUnderlying(assetConfig, amount, account.address);

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(vaultAddr, vaultName),  // ft (zToken / vault contract, NOT underlying)
      uintCV(amount),                              // amount (zToken shares)
      uintCV(expectedUnderlying > 0n ? (expectedUnderlying * 95n) / 100n : 0n),  // min-underlying (5% slippage tolerance)
      noneCV(),                                    // receiver (none = tx-sender)
      noneCV(),                                    // price-feeds (use cached)
    ];

    // Post-conditions (Deny mode requires ALL ft-transfers to be covered):
    // 1. market-vault transfers zTokens (collateral release)
    // 2. market transfers zTokens (internal accounting)
    // 3. vault sends underlying → user (redemption, amount = convert-to-assets result)
    const postConditions = [
      Pc.principal(ZEST_V2_MARKET_VAULT as `${string}.${string}`)
        .willSendLte(amount)
        .ft(assetConfig.vault as `${string}.${string}`, "zft"),
      Pc.principal(ZEST_V2_MARKET as `${string}.${string}`)
        .willSendLte(amount)
        .ft(assetConfig.vault as `${string}.${string}`, "zft"),
      this.buildSendPC(assetConfig.vault, expectedUnderlying, assetConfig, "lte"),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "collateral-remove-redeem",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Borrow assets from Zest v2 via market's borrow function.
   * Requires sufficient collateral to maintain healthy LTV.
   *
   * Token flow (1 ft-transfer):
   * 1. vault → user (borrowed underlying)
   *
   * Contract: v0-4-market.borrow(ft, amount, receiver, price-feeds)
   */
  async borrow(
    account: Account,
    asset: string,
    amount: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.market);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(assetAddr, assetName),  // ft (token to borrow)
      uintCV(amount),                              // amount
      noneCV(),                                    // receiver (none = tx-sender)
      noneCV(),                                    // price-feeds (use cached)
    ];

    // Post-condition: vault sends borrowed underlying to user
    const postConditions = [
      this.buildSendPC(assetConfig.vault, amount, assetConfig, "lte"),
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
   * Repay borrowed assets on Zest v2.
   *
   * Token flow (1 ft-transfer):
   * 1. user → vault (repayment, amount may be capped to actual debt on-chain)
   *
   * Contract: v0-4-market.repay(ft, amount, on-behalf-of)
   */
  async repay(
    account: Account,
    asset: string,
    amount: bigint,
    onBehalfOf?: string
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(this.contracts!.market);
    const [assetAddr, assetName] = parseContractIdTuple(assetConfig.token);

    const functionArgs: ClarityValue[] = [
      contractPrincipalCV(assetAddr, assetName),                               // ft
      uintCV(amount),                                                           // amount
      onBehalfOf ? someCV(principalCV(onBehalfOf)) : noneCV(),                 // on-behalf-of
    ];

    // Post-condition: user sends repayment (use lte since contract may cap to actual debt)
    const postConditions = [
      this.buildSendPC(account.address, amount, assetConfig, "lte"),
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
   * Deposit directly into a Zest v2 vault for yield without collateral.
   * Mints zTokens that earn supply yield. Simpler than supply-collateral-add
   * but the zTokens won't be usable as collateral for borrowing.
   *
   * Token flow (1 ft-transfer):
   * 1. user → vault (underlying)
   * Note: zTokens minted to recipient (ft-mint, no PC needed)
   *
   * Contract: vault.deposit(amount, min-out, recipient)
   */
  async depositToVault(
    account: Account,
    asset: string,
    amount: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(assetConfig.vault);

    const functionArgs: ClarityValue[] = [
      uintCV(amount),                     // amount
      uintCV(0n),                          // min-out (0 = no slippage protection)
      principalCV(account.address),        // recipient
    ];

    // Post-condition: user sends underlying token to vault
    const postConditions = [
      this.buildSendPC(account.address, amount, assetConfig, "eq"),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "deposit",
      functionArgs,
      postConditionMode: PostConditionMode.Deny,
      postConditions,
    });
  }

  /**
   * Redeem zTokens from a Zest v2 vault for underlying assets.
   *
   * Token flow:
   * 1. user sends zTokens → vault (ft-burn, but transfer happens first)
   * 2. vault sends underlying → recipient
   *
   * Contract: vault.redeem(amount, min-out, recipient)
   *
   * @param amount - Amount of zTokens to redeem
   */
  async redeemFromVault(
    account: Account,
    asset: string,
    amount: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();

    const assetConfig = this.getAssetConfig(asset);
    const { address, name } = parseContractId(assetConfig.vault);

    // Pre-query: shares → underlying (shares appreciate, so underlying > shares)
    const expectedUnderlying = await this.getExpectedUnderlying(assetConfig, amount, account.address);

    const functionArgs: ClarityValue[] = [
      uintCV(amount),                     // amount (zToken shares)
      uintCV(0n),                          // min-out (0 = no slippage protection)
      principalCV(account.address),        // recipient
    ];

    // Post-conditions:
    // 1. Vault sends underlying to user (amount from convert-to-assets)
    const postConditions = [
      this.buildSendPC(assetConfig.vault, expectedUnderlying, assetConfig, "lte"),
    ];

    return callContract(account, {
      contractAddress: address,
      contractName: name,
      functionName: "redeem",
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
