import axios from "axios";
import {
  BitflowSDK,
  type Token,
  type QuoteResult,
  type SwapExecutionData,
  type SelectedSwapRoute,
  KeeperType,
  type CreateOrderParams,
  type GetKeeperContractParams,
} from "@bitflowlabs/core-sdk";
import {
  makeContractCall,
  broadcastTransaction,
  PostConditionMode,
  hexToCV,
  cvToJSON,
} from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";
import {
  getBitflowConfig,
  BITFLOW_PUBLIC_API,
  type Network,
} from "../config/index.js";
import type { Account, TransferResult } from "../transactions/builder.js";

// ============================================================================
// Types
// ============================================================================

export interface BitflowTicker {
  ticker_id: string;
  base_currency: string;
  target_currency: string;
  last_price: string;
  base_volume: string;
  target_volume: string;
  bid: string;
  ask: string;
  high: string;
  low: string;
  liquidity_in_usd: string;
}

export interface PriceImpactHop {
  pool: string;
  tokenIn: string;
  tokenOut: string;
  reserveIn: string;
  reserveOut: string;
  feeBps: number;
  impact: number; // 0-1 decimal (fee-excluded)
}

export type ImpactSeverity = "low" | "medium" | "high" | "severe";

export interface PriceImpactResult {
  /** Combined pure price impact across all hops (0-1 decimal, fee-excluded) */
  combinedImpact: number;
  /** Human-readable percentage string e.g. "2.34%" */
  combinedImpactPct: string;
  /** Severity tier */
  severity: ImpactSeverity;
  /** Per-hop breakdown */
  hops: PriceImpactHop[];
  /** Total fee across all hops in basis points (approximate) */
  totalFeeBps: number;
}

export interface BitflowSwapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut: string;
  route: string[];
  priceImpact?: PriceImpactResult;
}

export interface BitflowToken {
  id: string;
  name: string;
  symbol: string;
  contractId: string;
  decimals: number;
}

// ============================================================================
// Bitflow Service
// ============================================================================

/**
 * Bitflow Service
 *
 * As of @bitflowlabs/core-sdk v2.4.2, all API keys are optional.
 * The SDK works out of the box with public rate limits (500 req/min per IP).
 *
 * Optional env vars for higher rate limits:
 *   - BITFLOW_API_KEY: Core API (tokens, quotes, routes)
 *   - BITFLOW_API_HOST: Override API host
 *   - BITFLOW_KEEPER_API_KEY: Keeper automation features
 *   - BITFLOW_KEEPER_API_HOST: Override Keeper API host
 *   - BITFLOW_READONLY_API_HOST: Override Stacks read-only node
 *
 * Request higher limits: help@bitflow.finance
 */
export class BitflowService {
  private sdk: BitflowSDK | null = null;
  private sdkInitialized = false;
  private tokenCache: Token[] | null = null;

  constructor(private network: Network) {
    this.initializeSdk();
  }

  /**
   * Initialize the Bitflow SDK.
   * API keys are optional — public endpoints work without them.
   */
  private initializeSdk(): void {
    if (this.sdkInitialized) return;
    this.sdkInitialized = true;

    const config = getBitflowConfig();

    try {
      this.sdk = new BitflowSDK({
        BITFLOW_API_HOST: config.apiHost,
        ...(config.apiKey && { BITFLOW_API_KEY: config.apiKey }),
        READONLY_CALL_API_HOST: config.readOnlyCallApiHost,
        BITFLOW_PROVIDER_ADDRESS: "",
        READONLY_CALL_API_KEY: "",
        KEEPER_API_HOST: config.keeperApiHost || "",
        ...(config.keeperApiKey && { KEEPER_API_KEY: config.keeperApiKey }),
      });
    } catch (error) {
      console.error("Failed to initialize Bitflow SDK:", error);
      this.sdk = null;
    }
  }


  /**
   * Ensure mainnet for Bitflow operations
   */
  private ensureMainnet(): void {
    if (this.network !== "mainnet") {
      throw new Error("Bitflow is only available on mainnet");
    }
  }

  /**
   * Ensure SDK is available
   */
  private ensureSdk(): BitflowSDK {
    if (!this.sdk) {
      throw new Error(
        "Bitflow SDK failed to initialize. Check BITFLOW_API_HOST / BITFLOW_READONLY_API_HOST configuration."
      );
    }
    return this.sdk;
  }

  // ==========================================================================
  // Public API (No API Key Required)
  // ==========================================================================

  /**
   * Get ticker data from public API (no API key required)
   */
  async getTicker(): Promise<BitflowTicker[]> {
    this.ensureMainnet();

    const response = await axios.get<BitflowTicker[]>(`${BITFLOW_PUBLIC_API}/ticker`);
    return response.data;
  }

  /**
   * Get ticker for a specific pair
   */
  async getTickerByPair(baseCurrency: string, targetCurrency: string): Promise<BitflowTicker | null> {
    const tickers = await this.getTicker();
    const tickerId = `${baseCurrency}_${targetCurrency}`;
    return tickers.find((t) => t.ticker_id === tickerId) || null;
  }

  // ==========================================================================
  // SDK Functions (Public API, no key required)
  // ==========================================================================

  /**
   * Get all available tokens for swapping
   */
  async getAvailableTokens(): Promise<BitflowToken[]> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    if (!this.tokenCache) {
      this.tokenCache = await sdk.getAvailableTokens();
    }

    return this.tokenCache.map((t: Token) => ({
      id: t.tokenId,
      name: t.name,
      symbol: t.symbol,
      contractId: t.tokenId,
      decimals: t.tokenDecimals,
    }));
  }

  /**
   * Get possible swap targets for a given token
   * Returns token IDs that can be swapped to from tokenX
   */
  async getPossibleSwapTargets(tokenXId: string): Promise<string[]> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    // getAllPossibleTokenY returns string[]
    const targets = await sdk.getAllPossibleTokenY(tokenXId);
    return targets;
  }

  /**
   * Get all possible routes between two tokens
   */
  async getAllRoutes(tokenXId: string, tokenYId: string): Promise<SelectedSwapRoute[]> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    const routes = await sdk.getAllPossibleTokenYRoutes(tokenXId, tokenYId);
    return routes;
  }

  /**
   * Get swap quote with price impact calculation.
   */
  async getSwapQuote(
    tokenXId: string,
    tokenYId: string,
    amount: number
  ): Promise<BitflowSwapQuote> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    const quoteResult: QuoteResult = await sdk.getQuoteForRoute(tokenXId, tokenYId, amount);

    if (!quoteResult.bestRoute) {
      throw new Error(`No route found for ${tokenXId} -> ${tokenYId}`);
    }

    // Calculate price impact from on-chain pool reserves
    const priceImpact = await this.calculatePriceImpact(quoteResult, amount);

    return {
      tokenIn: tokenXId,
      tokenOut: tokenYId,
      amountIn: amount.toString(),
      expectedAmountOut: quoteResult.bestRoute.quote?.toString() || "0",
      route: quoteResult.bestRoute.tokenPath,
      priceImpact: priceImpact ?? undefined,
    };
  }

  // ==========================================================================
  // Price Impact Calculation
  // ==========================================================================

  /**
   * Classify price impact into severity tiers.
   */
  private classifyImpact(impact: number): ImpactSeverity {
    if (impact < 0.01) return "low";       // < 1%
    if (impact < 0.03) return "medium";    // 1-3%
    if (impact < 0.10) return "high";      // 3-10%
    return "severe";                        // > 10%
  }

  /**
   * Call a read-only contract function on the Stacks node used by Bitflow.
   */
  private async callReadOnly(
    contractAddress: string,
    contractName: string,
    functionName: string,
    args: string[] = []
  ): Promise<any> {
    const config = getBitflowConfig();
    const host = config.readOnlyCallApiHost;
    const url = `${host}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: "SP000000000000000000002Q6VF78",
        arguments: args,
      }),
    });
    const json = await res.json();
    if (!json.okay) {
      throw new Error(`Contract call failed: ${JSON.stringify(json)}`);
    }
    return cvToJSON(hexToCV(json.result));
  }

  /**
   * Extract a uint value from a Clarity tuple response.
   */
  private getUintFromPool(pool: any, key: string): bigint | null {
    const val = pool?.value?.value?.[key]?.value;
    return val !== undefined ? BigInt(val) : null;
  }

  /**
   * Calculate price impact for a swap route.
   *
   * Uses the XYK constant-product formula: impact = dx / (x + dx)
   * This gives the pure slippage component, excluding fees.
   * For multi-hop: combined = 1 - (1-i1) * (1-i2) * ...
   *
   * The SDK's QuoteResult.bestRoute.swapData.parameters contains:
   *   "xyk-pools": { a: "addr.pool-1", b: "addr.pool-2", ... }
   *   "xyk-tokens": { a: "tokenIn", b: "intermediate", c: "intermediate", d: "tokenOut" }
   * Pool keys are sequential letters (a, b, c...), one per hop.
   *
   * @param quoteResult The SDK quote result containing route and swap data
   * @param amountIn The input amount in human-readable units (e.g. 1.0 for 1 sBTC)
   * @returns PriceImpactResult or null if pools can't be read
   */
  async calculatePriceImpact(
    quoteResult: QuoteResult,
    amountIn: number
  ): Promise<PriceImpactResult | null> {
    try {
      const bestRoute = quoteResult.bestRoute;
      if (!bestRoute) return null;

      // swapData is a single object (not an array)
      const swapData = bestRoute.swapData;
      if (!swapData?.parameters) return null;

      // Extract pool contracts from xyk-pools: { a: "pool1", b: "pool2" }
      const xykPools: Record<string, string> | undefined = swapData.parameters["xyk-pools"];
      if (!xykPools) return null;

      // Sort pool keys alphabetically to get hop order
      const poolKeys = Object.keys(xykPools).sort();
      if (poolKeys.length === 0) return null;

      const tokenPath: string[] = bestRoute.tokenPath || [];
      const hops: PriceImpactHop[] = [];
      let currentAmountRaw: bigint | null = null;

      // Fetch all pool states in parallel
      const poolFetches = poolKeys.map(async (key) => {
        const poolContractId = xykPools[key];
        const dotIdx = poolContractId.indexOf(".");
        if (dotIdx === -1) return null;
        const poolAddr = poolContractId.substring(0, dotIdx);
        const poolName = poolContractId.substring(dotIdx + 1);
        try {
          const pool = await this.callReadOnly(poolAddr, poolName, "get-pool");
          return { key, poolContractId, pool };
        } catch {
          return null; // stableswap or unsupported pool
        }
      });

      const poolResults = await Promise.all(poolFetches);

      for (let i = 0; i < poolResults.length; i++) {
        const result = poolResults[i];
        if (!result) continue;

        const { poolContractId, pool } = result;

        const xBalance = this.getUintFromPool(pool, "x-balance");
        const yBalance = this.getUintFromPool(pool, "y-balance");
        if (!xBalance || !yBalance) continue;

        // Read fee fields (protocol + provider for input direction)
        const xProtocolFee = this.getUintFromPool(pool, "x-protocol-fee") || 0n;
        const xProviderFee = this.getUintFromPool(pool, "x-provider-fee") || 0n;
        const feeBps = Number(xProtocolFee + xProviderFee);

        // Determine input amount for this hop
        let dxRaw: bigint;
        if (i === 0) {
          // First hop: use the original input amount scaled to token decimals
          const tokenXDecimals = bestRoute.tokenXDecimals ?? 8;
          dxRaw = BigInt(Math.round(amountIn * 10 ** tokenXDecimals));
        } else if (currentAmountRaw !== null) {
          dxRaw = currentAmountRaw;
        } else {
          continue;
        }

        // Pure price impact (fee-excluded): dx / (x + dx)
        const dxF = Number(dxRaw);
        const xF = Number(xBalance);
        const impact = dxF / (xF + dxF);

        // Calculate output with fee for the next hop's input
        const feeNumer = 10000n - BigInt(feeBps);
        const dxWithFee = dxRaw * feeNumer;
        const numerator = dxWithFee * yBalance;
        const denominator = xBalance * 10000n + dxWithFee;
        currentAmountRaw = numerator / denominator;

        hops.push({
          pool: poolContractId,
          tokenIn: tokenPath[i] || `hop${i}-in`,
          tokenOut: tokenPath[i + 1] || `hop${i}-out`,
          reserveIn: xBalance.toString(),
          reserveOut: yBalance.toString(),
          feeBps,
          impact,
        });
      }

      if (hops.length === 0) return null;

      // Combined impact: 1 - (1-i1) * (1-i2) * ...
      const combinedImpact = 1 - hops.reduce((acc, h) => acc * (1 - h.impact), 1);
      const combinedImpactPct = (combinedImpact * 100).toFixed(2) + "%";

      // Approximate total fees (not perfectly additive but close enough for display)
      const totalFeeBps = hops.reduce((sum, h) => sum + h.feeBps, 0);

      return {
        combinedImpact,
        combinedImpactPct,
        severity: this.classifyImpact(combinedImpact),
        hops,
        totalFeeBps,
      };
    } catch (error) {
      console.error("Failed to calculate price impact:", error);
      return null;
    }
  }

  /**
   * Execute a swap
   * @param fee Optional fee in micro-STX. If omitted, fee is auto-estimated.
   */
  async swap(
    account: Account,
    tokenXId: string,
    tokenYId: string,
    amountIn: number,
    slippageTolerance: number = 0.01,
    fee?: bigint
  ): Promise<TransferResult> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    // Get quote first to build swap execution data
    const quoteResult = await sdk.getQuoteForRoute(tokenXId, tokenYId, amountIn);

    if (!quoteResult.bestRoute) {
      throw new Error(`No route found for ${tokenXId} -> ${tokenYId}`);
    }

    // Build swap execution data
    const swapExecutionData: SwapExecutionData = {
      route: quoteResult.bestRoute.route,
      amount: amountIn,
      tokenXDecimals: quoteResult.bestRoute.tokenXDecimals,
      tokenYDecimals: quoteResult.bestRoute.tokenYDecimals,
    };

    // Get swap parameters
    const swapParams = await sdk.getSwapParams(
      swapExecutionData,
      account.address,
      slippageTolerance
    );

    // Build and sign the transaction
    const network = this.network === "mainnet" ? STACKS_MAINNET : STACKS_TESTNET;

    const transaction = await makeContractCall({
      contractAddress: swapParams.contractAddress,
      contractName: swapParams.contractName,
      functionName: swapParams.functionName,
      functionArgs: swapParams.functionArgs,
      postConditions: swapParams.postConditions,
      senderKey: account.privateKey,
      network,
      postConditionMode: PostConditionMode.Deny,
      ...(fee !== undefined && { fee }),
    });

    const broadcastResult = await broadcastTransaction({
      transaction,
      network,
    });

    if ("error" in broadcastResult) {
      throw new Error(`Broadcast failed: ${broadcastResult.error} - ${broadcastResult.reason}`);
    }

    return {
      txid: broadcastResult.txid,
      rawTx: transaction.serialize(),
    };
  }

  // ==========================================================================
  // Keeper Functions (public endpoints)
  // ==========================================================================

  /**
   * Get or create keeper contract for user
   */
  async getOrCreateKeeperContract(
    stacksAddress: string,
    keeperType: KeeperType = KeeperType.MULTI_ACTION_V1
  ): Promise<{ contractIdentifier: string; status: string }> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    const params: GetKeeperContractParams = {
      stacksAddress,
      keeperType,
    };

    const result = await sdk.getOrCreateKeeperContract(params);

    return {
      contractIdentifier: result.keeperContract.contractIdentifier,
      status: result.keeperContract.contractStatus,
    };
  }

  /**
   * Create a swap order via Keeper
   */
  async createKeeperOrder(params: {
    contractIdentifier: string;
    stacksAddress: string;
    actionType: string;
    fundingTokens: Record<string, string>;
    actionAmount: string;
    minReceived?: { amount: string; autoAdjust: boolean };
  }): Promise<{ orderId: string; status: string }> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    const orderParams: CreateOrderParams = {
      contractIdentifier: params.contractIdentifier,
      stacksAddress: params.stacksAddress,
      keeperType: KeeperType.MULTI_ACTION_V1,
      actionType: params.actionType,
      fundingTokens: params.fundingTokens,
      actionAmount: params.actionAmount,
      minReceived: params.minReceived,
      bitcoinTxId: "", // Required field but not always used
    };

    const result = await sdk.createOrder(orderParams);

    return {
      orderId: result.keeperOrder.orderId,
      status: result.keeperOrder.orderStatus,
    };
  }

  /**
   * Get order details
   */
  async getKeeperOrder(orderId: string): Promise<{
    orderId: string;
    status: string;
    actionType: string;
    actionAmount: string;
  }> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    const result = await sdk.getOrder(orderId);

    return {
      orderId: result.order.orderId,
      status: result.order.orderStatus,
      actionType: result.order.actionType,
      actionAmount: result.order.actionAmount,
    };
  }

  /**
   * Cancel a keeper order
   */
  async cancelKeeperOrder(orderId: string): Promise<{ success: boolean }> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    const result = await sdk.cancelOrder(orderId);
    return { success: result.success };
  }

  /**
   * Get user's keeper info and orders
   */
  async getKeeperUser(stacksAddress: string): Promise<{
    stacksAddress: string;
    contracts: Array<{ identifier: string; status: string }>;
    orders: Array<{ orderId: string; status: string }>;
  }> {
    this.ensureMainnet();
    const sdk = this.ensureSdk();

    const result = await sdk.getUser(stacksAddress);

    const contracts = Object.values(result.user.keeperContracts).map((c) => ({
      identifier: c.contractIdentifier,
      status: c.contractStatus,
    }));

    const orders = Object.values(result.user.keeperOrders).map((o) => ({
      orderId: o.orderId,
      status: o.orderStatus,
    }));

    return {
      stacksAddress: result.user.stacksAddress,
      contracts,
      orders,
    };
  }
}

// ============================================================================
// Service Singleton
// ============================================================================

let _bitflowServiceInstance: BitflowService | null = null;

export function getBitflowService(network: Network): BitflowService {
  if (!_bitflowServiceInstance || _bitflowServiceInstance["network"] !== network) {
    _bitflowServiceInstance = new BitflowService(network);
  }
  return _bitflowServiceInstance;
}
