import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MempoolApi,
  createMempoolApi,
  getMempoolApiUrl,
  getMempoolExplorerUrl,
  getMempoolTxUrl,
  getMempoolAddressUrl,
  type UTXO,
  type FeeEstimates,
} from "../../src/services/mempool-api.js";

describe("mempool-api", () => {
  describe("URL helpers", () => {
    it("should return correct mainnet API URL", () => {
      expect(getMempoolApiUrl("mainnet")).toBe("https://mempool.space/api");
    });

    it("should return correct testnet API URL", () => {
      expect(getMempoolApiUrl("testnet")).toBe(
        "https://mempool.space/testnet/api"
      );
    });

    it("should return correct mainnet explorer URL", () => {
      expect(getMempoolExplorerUrl("mainnet")).toBe("https://mempool.space");
    });

    it("should return correct testnet explorer URL", () => {
      expect(getMempoolExplorerUrl("testnet")).toBe(
        "https://mempool.space/testnet"
      );
    });

    it("should generate correct mainnet transaction URL", () => {
      const txid =
        "abc123def456789012345678901234567890123456789012345678901234abcd";
      expect(getMempoolTxUrl(txid, "mainnet")).toBe(
        `https://mempool.space/tx/${txid}`
      );
    });

    it("should generate correct testnet transaction URL", () => {
      const txid =
        "abc123def456789012345678901234567890123456789012345678901234abcd";
      expect(getMempoolTxUrl(txid, "testnet")).toBe(
        `https://mempool.space/testnet/tx/${txid}`
      );
    });

    it("should generate correct mainnet address URL", () => {
      const address = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";
      expect(getMempoolAddressUrl(address, "mainnet")).toBe(
        `https://mempool.space/address/${address}`
      );
    });

    it("should generate correct testnet address URL", () => {
      const address = "tb1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el";
      expect(getMempoolAddressUrl(address, "testnet")).toBe(
        `https://mempool.space/testnet/address/${address}`
      );
    });
  });

  describe("createMempoolApi", () => {
    it("should create mainnet API client", () => {
      const api = createMempoolApi("mainnet");
      expect(api).toBeInstanceOf(MempoolApi);
      expect(api.getNetwork()).toBe("mainnet");
    });

    it("should create testnet API client", () => {
      const api = createMempoolApi("testnet");
      expect(api).toBeInstanceOf(MempoolApi);
      expect(api.getNetwork()).toBe("testnet");
    });
  });

  describe("MempoolApi", () => {
    let api: MempoolApi;
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      api = new MempoolApi("mainnet");
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    describe("getUtxos", () => {
      it("should fetch and return UTXOs for an address", async () => {
        const mockUtxos: UTXO[] = [
          {
            txid: "abc123",
            vout: 0,
            status: { confirmed: true, block_height: 800000 },
            value: 50000,
          },
          {
            txid: "def456",
            vout: 1,
            status: { confirmed: false },
            value: 30000,
          },
        ];

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockUtxos),
        } as Response);

        const address = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";
        const utxos = await api.getUtxos(address);

        expect(fetch).toHaveBeenCalledWith(
          `https://mempool.space/api/address/${address}/utxo`,
          expect.objectContaining({ signal: expect.anything() })
        );
        expect(utxos).toEqual(mockUtxos);
        expect(utxos).toHaveLength(2);
      });

      it("should throw error when API returns non-ok response", async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: () => Promise.resolve("Address not found"),
        } as Response);

        const address = "invalid-address";
        await expect(api.getUtxos(address)).rejects.toThrow(
          "Failed to fetch UTXOs"
        );
      });
    });

    describe("getFeeEstimates", () => {
      it("should fetch and return fee estimates", async () => {
        const mockFees: FeeEstimates = {
          fastestFee: 50,
          halfHourFee: 30,
          hourFee: 20,
          economyFee: 10,
          minimumFee: 5,
        };

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockFees),
        } as Response);

        const fees = await api.getFeeEstimates();

        expect(fetch).toHaveBeenCalledWith(
          "https://mempool.space/api/v1/fees/recommended",
          expect.objectContaining({ signal: expect.anything() })
        );
        expect(fees).toEqual(mockFees);
        expect(fees.fastestFee).toBe(50);
      });

      it("should throw error when API returns non-ok response", async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: () => Promise.resolve("API unavailable"),
        } as Response);

        await expect(api.getFeeEstimates()).rejects.toThrow(
          "Failed to fetch fee estimates"
        );
      });
    });

    describe("getFeeTiers", () => {
      it("should return simplified fee tiers", async () => {
        const mockFees: FeeEstimates = {
          fastestFee: 50,
          halfHourFee: 30,
          hourFee: 20,
          economyFee: 10,
          minimumFee: 5,
        };

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockFees),
        } as Response);

        const tiers = await api.getFeeTiers();

        expect(tiers.fast).toBe(50);
        expect(tiers.medium).toBe(30);
        expect(tiers.slow).toBe(20);
      });
    });

    describe("getBalance", () => {
      it("should calculate total balance from UTXOs", async () => {
        const mockUtxos: UTXO[] = [
          {
            txid: "abc123",
            vout: 0,
            status: { confirmed: true },
            value: 50000,
          },
          {
            txid: "def456",
            vout: 1,
            status: { confirmed: false },
            value: 30000,
          },
        ];

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockUtxos),
        } as Response);

        const balance = await api.getBalance("bc1q...");

        expect(balance).toBe(80000); // 50000 + 30000
      });

      it("should return 0 for address with no UTXOs", async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

        const balance = await api.getBalance("bc1q...");

        expect(balance).toBe(0);
      });
    });

    describe("getConfirmedBalance", () => {
      it("should calculate balance from confirmed UTXOs only", async () => {
        const mockUtxos: UTXO[] = [
          {
            txid: "abc123",
            vout: 0,
            status: { confirmed: true, block_height: 800000 },
            value: 50000,
          },
          {
            txid: "def456",
            vout: 1,
            status: { confirmed: false },
            value: 30000,
          },
          {
            txid: "ghi789",
            vout: 2,
            status: { confirmed: true, block_height: 800001 },
            value: 20000,
          },
        ];

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockUtxos),
        } as Response);

        const balance = await api.getConfirmedBalance("bc1q...");

        expect(balance).toBe(70000); // 50000 + 20000 (confirmed only)
      });
    });

    describe("broadcastTransaction", () => {
      it("should broadcast transaction and return txid", async () => {
        const mockTxid =
          "abc123def456789012345678901234567890123456789012345678901234abcd";

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve(mockTxid),
        } as Response);

        const txHex = "0100000001...";
        const txid = await api.broadcastTransaction(txHex);

        expect(fetch).toHaveBeenCalledWith("https://mempool.space/api/tx",
          expect.objectContaining({ method: "POST", body: txHex, signal: expect.anything() })
        );
        expect(txid).toBe(mockTxid);
      });

      it("should throw error when broadcast fails", async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          text: () => Promise.resolve("Invalid transaction"),
        } as Response);

        await expect(api.broadcastTransaction("invalid-tx")).rejects.toThrow(
          "Failed to broadcast transaction"
        );
      });

      it("should trim whitespace from returned txid", async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          text: () => Promise.resolve("  abc123  \n"),
        } as Response);

        const txid = await api.broadcastTransaction("0100000001...");

        expect(txid).toBe("abc123");
      });
    });

    describe("testnet API", () => {
      it("should use testnet URL for testnet API", async () => {
        const testnetApi = new MempoolApi("testnet");

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response);

        await testnetApi.getUtxos("tb1q...");

        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("mempool.space/testnet/api"),
          expect.objectContaining({ signal: expect.anything() })
        );
      });
    });
  });
});
