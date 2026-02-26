import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() creates values BEFORE vi.mock hoisting, so they can be referenced in factory functions.
const { mockSdkMethods, mockMakeContractCall, mockBroadcastTransaction, mockHexToCV, mockCvToJSON } = vi.hoisted(() => ({
  mockSdkMethods: {
    getAvailableTokens: vi.fn(),
    getAllPossibleTokenY: vi.fn(),
    getAllPossibleTokenYRoutes: vi.fn(),
    getQuoteForRoute: vi.fn(),
    getSwapParams: vi.fn(),
    getOrCreateKeeperContract: vi.fn(),
    createOrder: vi.fn(),
    getOrder: vi.fn(),
    cancelOrder: vi.fn(),
    getUser: vi.fn(),
  },
  mockMakeContractCall: vi.fn(),
  mockBroadcastTransaction: vi.fn(),
  mockHexToCV: vi.fn(),
  mockCvToJSON: vi.fn(),
}));

vi.mock("@bitflowlabs/core-sdk", () => {
  class MockBitflowSDK {
    getAvailableTokens = mockSdkMethods.getAvailableTokens;
    getAllPossibleTokenY = mockSdkMethods.getAllPossibleTokenY;
    getAllPossibleTokenYRoutes = mockSdkMethods.getAllPossibleTokenYRoutes;
    getQuoteForRoute = mockSdkMethods.getQuoteForRoute;
    getSwapParams = mockSdkMethods.getSwapParams;
    getOrCreateKeeperContract = mockSdkMethods.getOrCreateKeeperContract;
    createOrder = mockSdkMethods.createOrder;
    getOrder = mockSdkMethods.getOrder;
    cancelOrder = mockSdkMethods.cancelOrder;
    getUser = mockSdkMethods.getUser;
  }
  return {
    BitflowSDK: MockBitflowSDK,
    KeeperType: { MULTI_ACTION_V1: "MULTI_ACTION_V1" },
  };
});

vi.mock("@stacks/transactions", () => ({
  makeContractCall: mockMakeContractCall,
  broadcastTransaction: mockBroadcastTransaction,
  PostConditionMode: { Deny: 1 },
  hexToCV: mockHexToCV,
  cvToJSON: mockCvToJSON,
}));

vi.mock("@stacks/network", () => ({
  STACKS_MAINNET: { id: "mainnet" },
  STACKS_TESTNET: { id: "testnet" },
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../../src/config/index.js", () => ({
  getBitflowConfig: vi.fn(() => ({
    apiHost: "https://mock-bitflow-api.test",
    apiKey: undefined,
    readOnlyCallApiHost: "https://mock-readonly.test",
    keeperApiHost: "https://mock-keeper.test",
    keeperApiKey: undefined,
  })),
  BITFLOW_PUBLIC_API: "https://mock-public-api.test",
}));

import { BitflowService, getBitflowService } from "../../src/services/bitflow.service.js";

// Typed accessor for the private static method
const toBaseUnits: (amount: number, decimals: number) => number =
  (BitflowService as any).toBaseUnits.bind(BitflowService);

describe("bitflow.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toBaseUnits", () => {
    it("should convert whole number with 6 decimals", () => {
      expect(toBaseUnits(1, 6)).toBe(1_000_000);
    });

    it("should convert fractional amount with 6 decimals", () => {
      expect(toBaseUnits(0.5, 6)).toBe(500_000);
    });

    it("should round correctly for floating-point precision", () => {
      // 0.123456789 * 10^6 = 123456.789 -> Math.round gives 123457
      expect(toBaseUnits(0.123456789, 6)).toBe(123457);
    });

    it("should handle 8 decimals (sBTC)", () => {
      expect(toBaseUnits(0.00001, 8)).toBe(1000);
    });

    it("should return 0 for zero amount", () => {
      expect(toBaseUnits(0, 6)).toBe(0);
    });

    it("should handle large amounts", () => {
      expect(toBaseUnits(1000, 6)).toBe(1_000_000_000);
    });
  });

  describe("classifyImpact", () => {
    let classifyImpact: (impact: number) => string;

    beforeEach(() => {
      const service = new BitflowService("mainnet");
      classifyImpact = (service as any).classifyImpact.bind(service);
    });

    it("should return 'low' for zero impact", () => {
      expect(classifyImpact(0)).toBe("low");
    });

    it("should return 'low' for impact below 0.01", () => {
      expect(classifyImpact(0.005)).toBe("low");
    });

    it("should return 'medium' at boundary 0.01", () => {
      expect(classifyImpact(0.01)).toBe("medium");
    });

    it("should return 'medium' for impact between 0.01 and 0.03", () => {
      expect(classifyImpact(0.02)).toBe("medium");
    });

    it("should return 'high' at boundary 0.03", () => {
      expect(classifyImpact(0.03)).toBe("high");
    });

    it("should return 'high' for impact between 0.03 and 0.10", () => {
      expect(classifyImpact(0.05)).toBe("high");
    });

    it("should return 'severe' at boundary 0.10", () => {
      expect(classifyImpact(0.10)).toBe("severe");
    });

    it("should return 'severe' for impact above 0.10", () => {
      expect(classifyImpact(0.50)).toBe("severe");
    });
  });

  describe("ensureMainnet", () => {
    it("should not throw when network is mainnet", () => {
      const service = new BitflowService("mainnet");
      expect(() => (service as any).ensureMainnet()).not.toThrow();
    });

    it("should throw when network is testnet", () => {
      const service = new BitflowService("testnet");
      expect(() => (service as any).ensureMainnet()).toThrow(
        "Bitflow is only available on mainnet"
      );
    });

    it("should reject async calls on testnet", async () => {
      const service = new BitflowService("testnet");
      await expect(service.getAvailableTokens()).rejects.toThrow(
        "Bitflow is only available on mainnet"
      );
    });
  });

  describe("ensureSdk", () => {
    it("should throw when SDK failed to initialize", async () => {
      const service = new BitflowService("mainnet");
      (service as any).sdk = null;

      await expect(service.getAvailableTokens()).rejects.toThrow(
        "Bitflow SDK failed to initialize. Check BITFLOW_API_HOST / BITFLOW_READONLY_API_HOST configuration and server logs."
      );
    });

    it("should return the SDK instance when initialized successfully", () => {
      const service = new BitflowService("mainnet");
      const sdk = (service as any).ensureSdk();
      expect(sdk).toBeDefined();
    });
  });

  describe("getBitflowService", () => {
    it("should return a BitflowService instance", () => {
      const service = getBitflowService("mainnet");
      expect(service).toBeInstanceOf(BitflowService);
    });

    it("should return same instance for same network on consecutive calls", () => {
      const first = getBitflowService("mainnet");
      const second = getBitflowService("mainnet");
      expect(first).toBe(second);
    });

    it("should return a new instance when network changes", () => {
      const mainnetService = getBitflowService("mainnet");
      const testnetService = getBitflowService("testnet");
      expect(mainnetService).not.toBe(testnetService);
    });

    it("should return a new instance when switching back to previous network", () => {
      const first = getBitflowService("mainnet");
      getBitflowService("testnet");
      const third = getBitflowService("mainnet");
      expect(third).toBeInstanceOf(BitflowService);
      expect(third).not.toBe(first);
    });
  });

  describe("getAvailableTokens", () => {
    it("should map SDK Token fields to BitflowToken correctly", async () => {
      const mockTokens = [
        {
          tokenId: "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex",
          name: "ALEX Token",
          symbol: "ALEX",
          tokenDecimals: 8,
        },
        {
          tokenId: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
          name: "sBTC",
          symbol: "sBTC",
          tokenDecimals: 8,
        },
      ];

      mockSdkMethods.getAvailableTokens.mockResolvedValueOnce(mockTokens);

      const service = new BitflowService("mainnet");
      const result = await service.getAvailableTokens();

      expect(result).toHaveLength(2);

      expect(result[0]).toEqual({
        id: "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex",
        name: "ALEX Token",
        symbol: "ALEX",
        contractId: "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex",
        decimals: 8,
      });

      expect(result[1]).toEqual({
        id: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
        name: "sBTC",
        symbol: "sBTC",
        contractId: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
        decimals: 8,
      });
    });

    it("should set contractId equal to tokenId", async () => {
      const tokenId = "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token";
      mockSdkMethods.getAvailableTokens.mockResolvedValueOnce([
        { tokenId, name: "USDA", symbol: "USDA", tokenDecimals: 6 },
      ]);

      const service = new BitflowService("mainnet");
      const result = await service.getAvailableTokens();

      expect(result[0].id).toBe(tokenId);
      expect(result[0].contractId).toBe(tokenId);
    });

    it("should cache the token list and only call SDK once on repeated calls", async () => {
      mockSdkMethods.getAvailableTokens.mockResolvedValue([
        { tokenId: "token-a", name: "Token A", symbol: "TA", tokenDecimals: 6 },
      ]);

      const service = new BitflowService("mainnet");
      await service.getAvailableTokens();
      await service.getAvailableTokens();

      expect(mockSdkMethods.getAvailableTokens).toHaveBeenCalledTimes(1);
    });

    it("should use per-instance cache", async () => {
      mockSdkMethods.getAvailableTokens.mockResolvedValue([
        { tokenId: "token-a", name: "Token A", symbol: "TA", tokenDecimals: 6 },
      ]);

      const service1 = new BitflowService("mainnet");
      const service2 = new BitflowService("mainnet");

      await service1.getAvailableTokens();
      await service2.getAvailableTokens();

      expect(mockSdkMethods.getAvailableTokens).toHaveBeenCalledTimes(2);
    });

    it("should return empty array when SDK returns no tokens", async () => {
      mockSdkMethods.getAvailableTokens.mockResolvedValueOnce([]);

      const service = new BitflowService("mainnet");
      const result = await service.getAvailableTokens();

      expect(result).toEqual([]);
    });

    it("should propagate SDK errors", async () => {
      mockSdkMethods.getAvailableTokens.mockRejectedValueOnce(
        new Error("Network error from SDK")
      );

      const service = new BitflowService("mainnet");
      await expect(service.getAvailableTokens()).rejects.toThrow(
        "Network error from SDK"
      );
    });
  });

  // Shared test helpers for calculatePriceImpact and swap tests

  function makeQuoteResult(opts: {
    xykPools?: Record<string, string>;
    tokenPath?: string[];
    tokenXDecimals?: number;
    tokenYDecimals?: number;
    quote?: number;
    bestRoute?: null;
  } = {}): any {
    if (opts.bestRoute === null) {
      return {
        bestRoute: null,
        allRoutes: [],
        inputData: { tokenX: "token-x", tokenY: "token-y", amountInput: 100 },
      };
    }
    return {
      bestRoute: {
        route: {} as any,
        quote: opts.quote ?? 99,
        params: {},
        quoteData: { contract: "", function: "", parameters: {} },
        swapData: {
          contract: "",
          function: "",
          parameters: {
            "xyk-pools": opts.xykPools ?? { "pool-0": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-v1" },
          },
        },
        dexPath: [],
        tokenPath: opts.tokenPath ?? ["token-x", "token-y"],
        tokenXDecimals: opts.tokenXDecimals,
        tokenYDecimals: opts.tokenYDecimals ?? 6,
      },
      allRoutes: [],
      inputData: { tokenX: "token-x", tokenY: "token-y", amountInput: 100 },
    };
  }

  function makePoolData(opts: {
    xBalance: string;
    yBalance: string;
    tokenYName?: string;
    xProtocolFee?: string;
    xProviderFee?: string;
    yProtocolFee?: string;
    yProviderFee?: string;
  }) {
    return {
      value: {
        value: {
          "x-balance": { value: opts.xBalance },
          "y-balance": { value: opts.yBalance },
          "token-y-name": { value: opts.tokenYName ?? "token-y" },
          "x-protocol-fee": { value: opts.xProtocolFee ?? "30" },
          "x-provider-fee": { value: opts.xProviderFee ?? "0" },
          "y-protocol-fee": { value: opts.yProtocolFee ?? "30" },
          "y-provider-fee": { value: opts.yProviderFee ?? "0" },
        },
      },
    };
  }

  /** Create a service with callReadOnly mocked to return the given pool data. */
  function createServiceWithPoolMock(poolMock: ReturnType<typeof vi.fn>): BitflowService {
    const service = new BitflowService("mainnet");
    (service as any).callReadOnly = poolMock;
    return service;
  }

  describe("calculatePriceImpact", () => {
    it("should return null when bestRoute is null", async () => {
      const service = new BitflowService("mainnet");
      const result = await service.calculatePriceImpact(makeQuoteResult({ bestRoute: null }), 100);
      expect(result).toBeNull();
    });

    it("should return null when no xyk-pools in swap data parameters", async () => {
      const service = new BitflowService("mainnet");
      const quoteResult = makeQuoteResult();
      quoteResult.bestRoute.swapData.parameters = {};
      const result = await service.calculatePriceImpact(quoteResult, 100);
      expect(result).toBeNull();
    });

    it("should return null when swapData is missing", async () => {
      const service = new BitflowService("mainnet");
      const quoteResult = makeQuoteResult();
      quoteResult.bestRoute.swapData = null;
      const result = await service.calculatePriceImpact(quoteResult, 100);
      expect(result).toBeNull();
    });

    it("should calculate single-hop price impact using XYK formula", async () => {
      const service = createServiceWithPoolMock(
        vi.fn().mockResolvedValue(makePoolData({ xBalance: "1000000000", yBalance: "1000000000" }))
      );

      const quoteResult = makeQuoteResult({
        xykPools: { "pool-0": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-v1" },
        tokenPath: ["token-x", "token-y"],
        tokenXDecimals: 6,
      });

      // dxRaw = 100 * 10^6 = 100_000_000; reserve = 1_000_000_000
      // impact = 100_000_000 / (1_000_000_000 + 100_000_000) = 0.0909...
      const result = await service.calculatePriceImpact(quoteResult, 100);

      expect(result).not.toBeNull();
      expect(result!.hops).toHaveLength(1);
      expect(result!.hops[0].impact).toBeCloseTo(0.0909, 4);
      expect(result!.severity).toBe("high");
      expect(result!.hops[0].feeBps).toBe(30);
      expect(result!.combinedImpact).toBeCloseTo(0.0909, 4);
    });

    it("should use tokenXDecimals from bestRoute for first hop conversion", async () => {
      const service = createServiceWithPoolMock(
        vi.fn().mockResolvedValue(makePoolData({ xBalance: "100000000000", yBalance: "100000000000" }))
      );

      const quoteResult = makeQuoteResult({
        tokenXDecimals: 8,
        tokenPath: ["token-x", "token-y"],
      });

      // dxRaw = 100 * 10^8 = 10_000_000_000; reserve = 100_000_000_000
      // impact = 10_000_000_000 / (100_000_000_000 + 10_000_000_000) = 0.0909...
      const result = await service.calculatePriceImpact(quoteResult, 100);

      expect(result).not.toBeNull();
      expect(result!.hops[0].impact).toBeCloseTo(0.0909, 4);
    });

    it("should fall back to DEFAULT_TOKEN_DECIMALS (6) when tokenXDecimals is undefined", async () => {
      const service = createServiceWithPoolMock(
        vi.fn().mockResolvedValue(makePoolData({ xBalance: "1000000000", yBalance: "1000000000" }))
      );

      const quoteResult = makeQuoteResult({ tokenPath: ["token-x", "token-y"] });
      quoteResult.bestRoute.tokenXDecimals = undefined;

      // dxRaw = 100 * 10^6 = 100_000_000 (same as 6-decimal case)
      const result = await service.calculatePriceImpact(quoteResult, 100);

      expect(result).not.toBeNull();
      expect(result!.hops[0].impact).toBeCloseTo(0.0909, 4);
    });

    it("should combine multi-hop impacts correctly", async () => {
      const poolA = makePoolData({
        xBalance: "1000000000",
        yBalance: "1000000000",
        tokenYName: "token-b",
      });
      const poolB = makePoolData({
        xBalance: "500000000",
        yBalance: "500000000",
        tokenYName: "token-c",
      });

      const callReadOnlySpy = vi.fn()
        .mockResolvedValueOnce(poolA)
        .mockResolvedValueOnce(poolB);
      const service = createServiceWithPoolMock(callReadOnlySpy);

      const quoteResult = makeQuoteResult({
        xykPools: {
          "pool-0": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-a",
          "pool-1": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-b",
        },
        tokenPath: ["token-a", "token-b", "token-c"],
        tokenXDecimals: 6,
      });

      const result = await service.calculatePriceImpact(quoteResult, 100);

      expect(result).not.toBeNull();
      expect(result!.hops).toHaveLength(2);
      expect(callReadOnlySpy).toHaveBeenCalledTimes(2);

      // combined = 1 - (1-i1)*(1-i2)
      const i1 = result!.hops[0].impact;
      const i2 = result!.hops[1].impact;
      expect(result!.combinedImpact).toBeCloseTo(1 - (1 - i1) * (1 - i2), 6);
      expect(result!.totalFeeBps).toBe(result!.hops[0].feeBps + result!.hops[1].feeBps);
    });

    it("should return null when multi-hop has a failed pool fetch", async () => {
      const callReadOnlySpy = vi.fn()
        .mockResolvedValueOnce(makePoolData({ xBalance: "1000000000", yBalance: "1000000000" }))
        .mockRejectedValueOnce(new Error("Pool fetch failed"));
      const service = createServiceWithPoolMock(callReadOnlySpy);

      const quoteResult = makeQuoteResult({
        xykPools: {
          "pool-0": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-a",
          "pool-1": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-b",
        },
        tokenPath: ["token-a", "token-b", "token-c"],
        tokenXDecimals: 6,
      });

      const result = await service.calculatePriceImpact(quoteResult, 100);
      expect(result).toBeNull();
    });

    it("should return null when single-hop pool fetch fails", async () => {
      const service = createServiceWithPoolMock(
        vi.fn().mockRejectedValueOnce(new Error("Network error"))
      );

      const quoteResult = makeQuoteResult({
        xykPools: { "pool-0": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-v1" },
        tokenPath: ["token-x", "token-y"],
        tokenXDecimals: 6,
      });

      const result = await service.calculatePriceImpact(quoteResult, 100);
      expect(result).toBeNull();
    });

    it("should determine swap direction correctly when token path is Y->X", async () => {
      // Pool's token-y-name matches tokenPath[0], so isYtoX = true
      // Asymmetric reserves verify direction: reserveIn = yBalance, reserveOut = xBalance
      const service = createServiceWithPoolMock(
        vi.fn().mockResolvedValue(makePoolData({
          xBalance: "2000000000",
          yBalance: "500000000",
          tokenYName: "token-y",
        }))
      );

      const quoteResult = makeQuoteResult({
        xykPools: { "pool-0": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-v1" },
        tokenPath: ["token-y", "token-x"],
        tokenXDecimals: 6,
      });

      // isYtoX = true: reserveIn = yBalance = 500_000_000
      // dxRaw = 100 * 10^6 = 100_000_000
      // impact = 100_000_000 / (500_000_000 + 100_000_000) = 0.1667
      const result = await service.calculatePriceImpact(quoteResult, 100);

      expect(result).not.toBeNull();
      expect(result!.hops[0].reserveIn).toBe("500000000");
      expect(result!.hops[0].reserveOut).toBe("2000000000");
      expect(result!.hops[0].impact).toBeCloseTo(0.1667, 4);
      expect(result!.severity).toBe("severe");
    });

    it("should produce low severity for small amount relative to pool", async () => {
      const service = createServiceWithPoolMock(
        vi.fn().mockResolvedValue(makePoolData({ xBalance: "1000000000000", yBalance: "1000000000000" }))
      );

      const quoteResult = makeQuoteResult({
        tokenPath: ["token-x", "token-y"],
        tokenXDecimals: 6,
      });

      // amountIn = 0.001, dxRaw = 1000
      // impact = 1000 / (1_000_000_000_000 + 1000) ~ 0.000001
      const result = await service.calculatePriceImpact(quoteResult, 0.001);

      expect(result).not.toBeNull();
      expect(result!.severity).toBe("low");
    });

    it("should include total fee bps summed across hops", async () => {
      const service = createServiceWithPoolMock(
        vi.fn().mockResolvedValue(makePoolData({
          xBalance: "1000000000",
          yBalance: "1000000000",
          xProtocolFee: "50",
          xProviderFee: "20",
        }))
      );

      const quoteResult = makeQuoteResult({
        tokenPath: ["token-x", "token-y"],
        tokenXDecimals: 6,
      });

      const result = await service.calculatePriceImpact(quoteResult, 100);

      expect(result).not.toBeNull();
      expect(result!.hops[0].feeBps).toBe(70);
      expect(result!.totalFeeBps).toBe(70);
    });

    it("should format combinedImpactPct as percentage string", async () => {
      const service = createServiceWithPoolMock(
        vi.fn().mockResolvedValue(makePoolData({ xBalance: "1000000000", yBalance: "1000000000" }))
      );

      const quoteResult = makeQuoteResult({
        tokenPath: ["token-x", "token-y"],
        tokenXDecimals: 6,
      });

      const result = await service.calculatePriceImpact(quoteResult, 100);

      expect(result).not.toBeNull();
      expect(result!.combinedImpactPct).toMatch(/^\d+\.\d{2}%$/);
    });
  });

  describe("getSwapQuote", () => {
    it("should call getAvailableTokens before getQuoteForRoute", async () => {
      const callOrder: string[] = [];
      mockSdkMethods.getAvailableTokens.mockImplementation(async () => {
        callOrder.push("getAvailableTokens");
        return [];
      });
      mockSdkMethods.getQuoteForRoute.mockImplementation(async () => {
        callOrder.push("getQuoteForRoute");
        return makeQuoteResult({ tokenPath: ["token-x", "token-y"], tokenXDecimals: 6 });
      });

      const service = new BitflowService("mainnet");
      (service as any).calculatePriceImpact = vi.fn().mockResolvedValue(null);

      await service.getSwapQuote("token-x", "token-y", 100);

      expect(callOrder.indexOf("getAvailableTokens")).toBeLessThan(
        callOrder.indexOf("getQuoteForRoute")
      );
    });

    it("should throw when no route found", async () => {
      mockSdkMethods.getAvailableTokens.mockResolvedValue([]);
      mockSdkMethods.getQuoteForRoute.mockResolvedValue(makeQuoteResult({ bestRoute: null }));

      const service = new BitflowService("mainnet");

      await expect(service.getSwapQuote("token-x", "token-y", 100)).rejects.toThrow(
        "No route found for token-x -> token-y"
      );
    });

    it("should return quote with route data when route found", async () => {
      mockSdkMethods.getAvailableTokens.mockResolvedValue([]);
      mockSdkMethods.getQuoteForRoute.mockResolvedValue(
        makeQuoteResult({ tokenPath: ["token-x", "token-y"], tokenXDecimals: 6, quote: 9500 })
      );

      const service = new BitflowService("mainnet");
      (service as any).calculatePriceImpact = vi.fn().mockResolvedValue(null);

      const result = await service.getSwapQuote("token-x", "token-y", 100);

      expect(result.tokenIn).toBe("token-x");
      expect(result.tokenOut).toBe("token-y");
      expect(result.amountIn).toBe("100");
      expect(result.expectedAmountOut).toBe("9500");
      expect(result.route).toEqual(["token-x", "token-y"]);
    });
  });

  describe("swap", () => {
    const mockAccount = {
      address: "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT",
      privateKey: "mock-private-key",
    };

    const mockTx = {
      serialize: vi.fn(() => new Uint8Array([1, 2, 3])),
    };

    const MOCK_SWAP_PARAMS = {
      contractAddress: "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT",
      contractName: "swap-router",
      functionName: "swap-x-for-y",
      functionArgs: [],
      postConditions: [],
    };

    beforeEach(() => {
      mockMakeContractCall.mockResolvedValue(mockTx);
      mockBroadcastTransaction.mockResolvedValue({ txid: "mock-txid-abc123" });
    });

    function makeSwapQuoteResult(tokenXDecimals: number | undefined, amountIn: number = 100) {
      return makeQuoteResult({
        xykPools: { "pool-0": "SP1K0JKPPS18BVNKEV53H3QKMU7FELX76BEJCBPJT.pool-v1" },
        tokenPath: ["token-x", "token-y"],
        tokenXDecimals,
        tokenYDecimals: 6,
        quote: Math.floor(amountIn * 0.95 * 1_000_000),
      });
    }

    /** Set up standard mocks for a successful swap flow. */
    function setupSwapMocks(tokenXDecimals: number | undefined) {
      mockSdkMethods.getAvailableTokens.mockResolvedValue([]);
      mockSdkMethods.getQuoteForRoute.mockResolvedValue(makeSwapQuoteResult(tokenXDecimals));
      mockSdkMethods.getSwapParams.mockResolvedValue(MOCK_SWAP_PARAMS);
    }

    it("should pass base units in SwapExecutionData.amount for 8-decimal token (PR #203 regression)", async () => {
      setupSwapMocks(8);

      const service = new BitflowService("mainnet");
      await service.swap(mockAccount as any, "token-x", "token-y", 100);

      const swapExecutionData = mockSdkMethods.getSwapParams.mock.calls[0][0];

      // PR #203 fix: 100 tokens * 10^8 = 10_000_000_000 base units
      expect(swapExecutionData.amount).toBe(10_000_000_000);
      expect(swapExecutionData.tokenXDecimals).toBe(8);
    });

    it("should pass base units using DEFAULT_TOKEN_DECIMALS (6) when tokenXDecimals is undefined", async () => {
      mockSdkMethods.getAvailableTokens.mockResolvedValue([]);
      const quoteResult = makeSwapQuoteResult(undefined);
      quoteResult.bestRoute.tokenXDecimals = undefined;
      mockSdkMethods.getQuoteForRoute.mockResolvedValue(quoteResult);
      mockSdkMethods.getSwapParams.mockResolvedValue(MOCK_SWAP_PARAMS);

      const service = new BitflowService("mainnet");
      await service.swap(mockAccount as any, "token-x", "token-y", 100);

      const swapExecutionData = mockSdkMethods.getSwapParams.mock.calls[0][0];

      // DEFAULT_TOKEN_DECIMALS = 6: 100 * 10^6 = 100_000_000
      expect(swapExecutionData.amount).toBe(100_000_000);
    });

    it("should call getAvailableTokens before getQuoteForRoute (PR #203 token context fix)", async () => {
      const callOrder: string[] = [];
      mockSdkMethods.getAvailableTokens.mockImplementation(async () => {
        callOrder.push("getAvailableTokens");
        return [];
      });
      mockSdkMethods.getQuoteForRoute.mockImplementation(async () => {
        callOrder.push("getQuoteForRoute");
        return makeSwapQuoteResult(6);
      });
      mockSdkMethods.getSwapParams.mockResolvedValue(MOCK_SWAP_PARAMS);

      const service = new BitflowService("mainnet");
      await service.swap(mockAccount as any, "token-x", "token-y", 100);

      expect(callOrder.indexOf("getAvailableTokens")).toBeLessThan(
        callOrder.indexOf("getQuoteForRoute")
      );
    });

    it("should propagate tokenXDecimals and tokenYDecimals in SwapExecutionData", async () => {
      setupSwapMocks(8);

      const service = new BitflowService("mainnet");
      await service.swap(mockAccount as any, "token-x", "token-y", 100);

      const swapExecutionData = mockSdkMethods.getSwapParams.mock.calls[0][0];
      expect(swapExecutionData.tokenXDecimals).toBe(8);
      expect(swapExecutionData.tokenYDecimals).toBe(6);
    });

    it("should throw when no route found", async () => {
      mockSdkMethods.getAvailableTokens.mockResolvedValue([]);
      mockSdkMethods.getQuoteForRoute.mockResolvedValue(makeQuoteResult({ bestRoute: null }));

      const service = new BitflowService("mainnet");

      await expect(
        service.swap(mockAccount as any, "token-x", "token-y", 100)
      ).rejects.toThrow("No route found for token-x -> token-y");
    });

    it("should throw when broadcast fails with error response", async () => {
      setupSwapMocks(6);
      mockBroadcastTransaction.mockResolvedValue({
        error: "BadNonce",
        reason: "transaction nonce is too high",
      });

      const service = new BitflowService("mainnet");

      await expect(
        service.swap(mockAccount as any, "token-x", "token-y", 100)
      ).rejects.toThrow("Broadcast failed: BadNonce - transaction nonce is too high");
    });

    it("should return txid and rawTx on successful swap", async () => {
      setupSwapMocks(6);

      const service = new BitflowService("mainnet");
      const result = await service.swap(mockAccount as any, "token-x", "token-y", 100);

      expect(result.txid).toBe("mock-txid-abc123");
      expect(result.rawTx).toBeInstanceOf(Uint8Array);
    });

    it("should reject on testnet with mainnet-only error", async () => {
      const service = new BitflowService("testnet");

      await expect(
        service.swap(mockAccount as any, "token-x", "token-y", 100)
      ).rejects.toThrow("Bitflow is only available on mainnet");
    });
  });
});
