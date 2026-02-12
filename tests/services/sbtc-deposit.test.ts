/**
 * SbtcDepositService Integration Tests
 *
 * These tests verify the SbtcDepositService's core behaviors:
 * - Cardinal UTXO filtering on mainnet (ordinal safety)
 * - All UTXOs on testnet (Hiro API not available)
 * - includeOrdinals flag to override safety
 * - Error handling when no cardinal UTXOs available
 *
 * Note: Due to the complexity of the sbtc library's internal transaction
 * building (using @scure/btc-signer instances that can't be easily mocked),
 * these tests focus on the service's UTXO selection logic and error cases
 * rather than full end-to-end transaction construction.
 *
 * The critical ordinal safety behavior is tested in detail, as ordinal
 * safety was added on top of the base sBTC deposit implementation from PR #66.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SbtcDepositService } from "../../src/services/sbtc-deposit.service.js";
import type { UTXO } from "../../src/services/mempool-api.js";
import { MempoolApi } from "../../src/services/mempool-api.js";
import { OrdinalIndexer } from "../../src/services/ordinal-indexer.js";

describe("SbtcDepositService - Ordinal Safety", () => {
  let service: SbtcDepositService;

  const mockUtxos: UTXO[] = [
    {
      txid: "utxo1abc123",
      vout: 0,
      status: { confirmed: true, block_height: 800000 },
      value: 100000,
    },
    {
      txid: "utxo2def456",
      vout: 1,
      status: { confirmed: true, block_height: 800001 },
      value: 50000,
    },
  ];

  const mockCardinalUtxos: UTXO[] = [mockUtxos[0]]; // First UTXO is cardinal

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock MempoolApi methods
    vi.spyOn(MempoolApi.prototype, "getTxHex").mockResolvedValue(
      "0100000001..."
    );
    vi.spyOn(MempoolApi.prototype, "getUtxos").mockResolvedValue(mockUtxos);

    // Mock OrdinalIndexer methods
    vi.spyOn(OrdinalIndexer.prototype, "getCardinalUtxos").mockResolvedValue(
      mockCardinalUtxos
    );

    service = new SbtcDepositService("mainnet");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("UTXO Selection Logic", () => {
    it("should use cardinal UTXOs by default on mainnet (ordinal safety)", async () => {
      // We can't fully test transaction building without real sbtc library,
      // but we can verify the service calls the right UTXO fetch method
      try {
        await service.buildDepositTransaction(
          50000,
          "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK",
          "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          "03abc123...",
          10
        );
      } catch (error) {
        // Transaction building may fail due to mocking limitations,
        // but we can still verify the UTXO selection logic was called
      }

      // Verify cardinal UTXOs were fetched (ordinal safety)
      expect(OrdinalIndexer.prototype.getCardinalUtxos).toHaveBeenCalledWith(
        "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
      );

      // Verify all UTXOs were NOT fetched (would include ordinals)
      expect(MempoolApi.prototype.getUtxos).not.toHaveBeenCalled();
    });

    it("should use all UTXOs when includeOrdinals=true on mainnet", async () => {
      try {
        await service.buildDepositTransaction(
          50000,
          "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK",
          "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          "03abc123...",
          10,
          undefined, // maxSignerFee
          undefined, // reclaimLockTime
          undefined, // privateKey
          true // includeOrdinals (power user mode)
        );
      } catch (error) {
        // Allow failure due to mocking
      }

      // Verify all UTXOs were fetched (including ordinals)
      expect(MempoolApi.prototype.getUtxos).toHaveBeenCalledWith(
        "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
      );

      // Verify cardinal filtering was NOT used
      expect(OrdinalIndexer.prototype.getCardinalUtxos).not.toHaveBeenCalled();
    });

    it("should throw descriptive error when no cardinal UTXOs available", async () => {
      // Mock OrdinalIndexer to return no cardinal UTXOs
      vi.spyOn(OrdinalIndexer.prototype, "getCardinalUtxos").mockResolvedValue(
        []
      );

      await expect(
        service.buildDepositTransaction(
          50000,
          "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK",
          "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          "03abc123...",
          10
        )
      ).rejects.toThrow(
        /No cardinal.*UTXOs available.*includeOrdinals=true.*destroy inscriptions/
      );
    });

    it("should throw simple error when includeOrdinals=true but no UTXOs at all", async () => {
      vi.spyOn(MempoolApi.prototype, "getUtxos").mockResolvedValue([]);

      await expect(
        service.buildDepositTransaction(
          50000,
          "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK",
          "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          "03abc123...",
          10,
          undefined,
          undefined,
          undefined,
          true // includeOrdinals
        )
      ).rejects.toThrow(/No UTXOs found for address/);
    });

    it("should use all UTXOs on testnet (Hiro API not available)", async () => {
      const testnetService = new SbtcDepositService("testnet");

      try {
        await testnetService.buildDepositTransaction(
          50000,
          "ST2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK",
          "tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          "03abc123...",
          10
        );
      } catch (error) {
        // Allow failure due to mocking
      }

      // On testnet, should use MempoolApi.getUtxos (Hiro Ordinals API is mainnet-only)
      expect(MempoolApi.prototype.getUtxos).toHaveBeenCalledWith(
        "tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
      );

      // Cardinal filtering should NOT be used on testnet
      expect(OrdinalIndexer.prototype.getCardinalUtxos).not.toHaveBeenCalled();
    });
  });

});

describe("SbtcDepositService - Behavioral Tests", () => {
  let service: SbtcDepositService;

  beforeEach(() => {
    service = new SbtcDepositService("mainnet");
  });

  it("should instantiate mainnet service", () => {
    expect(service).toBeInstanceOf(SbtcDepositService);
  });

  it("should instantiate testnet service", () => {
    const testnetService = new SbtcDepositService("testnet");
    expect(testnetService).toBeInstanceOf(SbtcDepositService);
  });

  it("should have getSignersPublicKey method", () => {
    expect(typeof service.getSignersPublicKey).toBe("function");
  });

  it("should have buildDepositAddress method", () => {
    expect(typeof service.buildDepositAddress).toBe("function");
  });

  it("should have buildDepositTransaction method", () => {
    expect(typeof service.buildDepositTransaction).toBe("function");
  });

  it("should have getDepositStatus method", () => {
    expect(typeof service.getDepositStatus).toBe("function");
  });

  it("should have broadcastAndNotify method", () => {
    expect(typeof service.broadcastAndNotify).toBe("function");
  });

  it("should have pollDepositStatus method", () => {
    expect(typeof service.pollDepositStatus).toBe("function");
  });

  it("should have deposit method (high-level helper)", () => {
    expect(typeof service.deposit).toBe("function");
  });
});
