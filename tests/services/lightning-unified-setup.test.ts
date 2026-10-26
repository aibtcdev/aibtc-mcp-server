/**
 * Tests for setupFromMainMnemonic — the unified-mnemonic Lightning setup that
 * wallet_create / wallet_import call to derive a Spark-backed Lightning wallet
 * from the same mnemonic as the main Stacks/BTC wallet.
 *
 * Runs offline: fs/promises is stubbed with an in-memory map and
 * SparkLightningProvider.initialize is mocked so no real Spark call is made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import os from "os";

// --- in-memory fs ----------------------------------------------------------

const files = new Map<string, string>();
const dirs = new Set<string>();

class ENOENTError extends Error {
  code = "ENOENT";
}

vi.mock("fs/promises", () => {
  const mkdir = vi.fn(async (p: string) => {
    dirs.add(p);
  });
  const access = vi.fn(async (p: string) => {
    if (!files.has(p) && !dirs.has(p)) throw new ENOENTError(`ENOENT: ${p}`);
  });
  const readFile = vi.fn(async (p: string) => {
    if (!files.has(p)) throw new ENOENTError(`ENOENT: ${p}`);
    return files.get(p)!;
  });
  const writeFile = vi.fn(async (p: string, content: string) => {
    files.set(p, content);
  });
  const rename = vi.fn(async (from: string, to: string) => {
    const content = files.get(from);
    if (content === undefined) throw new ENOENTError(`ENOENT: ${from}`);
    files.set(to, content);
    files.delete(from);
  });

  const api = { mkdir, access, readFile, writeFile, rename };
  return { default: api, ...api };
});

// --- spark provider stub ---------------------------------------------------

const sparkInitialize = vi.fn(async () => ({
  getDepositAddress: vi.fn(async () => "bc1qfake-deposit-address-from-spark"),
  getBalance: vi.fn(async () => ({ balanceSats: 0 })),
  // intentionally omit getLightningAddress to exercise the safeLightningAddress
  // fallback path (returns null when provider doesn't implement it)
}));

vi.mock("../../src/services/lightning/spark-provider.js", () => ({
  SparkLightningProvider: {
    initialize: sparkInitialize,
  },
}));

// --- import after mocks ----------------------------------------------------

const { getLightningManager } = await import(
  "../../src/services/lightning-manager.js"
);

const KEYSTORE_PATH = path.join(
  os.homedir(),
  ".aibtc",
  "lightning",
  "keystore.json"
);

// Standard BIP39 test vector — 12 words, validates against the wordlist.
const VALID_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("LightningManager.setupFromMainMnemonic", () => {
  beforeEach(() => {
    files.clear();
    dirs.clear();
    sparkInitialize.mockClear();
    // reset singleton's in-memory session so each test starts clean
    (getLightningManager() as unknown as { session: unknown }).session = null;
  });

  it("skips on testnet with reason 'network-unsupported'", async () => {
    const result = await getLightningManager().setupFromMainMnemonic(
      VALID_MNEMONIC,
      "password-1234",
      "test-wallet",
      "testnet"
    );

    expect(result.kind).toBe("skipped");
    if (result.kind === "skipped") {
      expect(result.reason).toBe("network-unsupported");
      expect(result.message).toMatch(/mainnet/i);
    }

    // Spark must not have been called
    expect(sparkInitialize).not.toHaveBeenCalled();
    // No keystore written
    expect(files.has(KEYSTORE_PATH)).toBe(false);
  });

  it("skips when an existing Lightning keystore is present", async () => {
    const existingKeystore = JSON.stringify({
      version: 1,
      walletId: "pre-existing",
      name: "old-lightning",
      network: "mainnet",
      encrypted: { ciphertext: "x", iv: "y", salt: "z", tag: "w" },
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    files.set(KEYSTORE_PATH, existingKeystore);

    const result = await getLightningManager().setupFromMainMnemonic(
      VALID_MNEMONIC,
      "password-1234",
      "test-wallet",
      "mainnet"
    );

    expect(result.kind).toBe("skipped");
    if (result.kind === "skipped") {
      expect(result.reason).toBe("existing-lightning-wallet");
    }

    expect(sparkInitialize).not.toHaveBeenCalled();
    // Keystore content untouched
    expect(files.get(KEYSTORE_PATH)).toBe(existingKeystore);
  });

  it("creates a Lightning wallet on mainnet from the main mnemonic", async () => {
    const result = await getLightningManager().setupFromMainMnemonic(
      VALID_MNEMONIC,
      "password-1234",
      "test-wallet",
      "mainnet"
    );

    expect(result.kind).toBe("setup");
    if (result.kind === "setup") {
      expect(result.depositAddress).toBe(
        "bc1qfake-deposit-address-from-spark"
      );
      expect(result.lightningAddress).toBeNull();
      expect(result.walletId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }

    // Spark was initialized exactly once with the user's mnemonic + mainnet
    expect(sparkInitialize).toHaveBeenCalledTimes(1);
    expect(sparkInitialize).toHaveBeenCalledWith(VALID_MNEMONIC, "mainnet");

    // Keystore was persisted
    expect(files.has(KEYSTORE_PATH)).toBe(true);
    const persisted = JSON.parse(files.get(KEYSTORE_PATH)!);
    expect(persisted.network).toBe("mainnet");
    expect(persisted.name).toBe("test-wallet");
    expect(persisted.encrypted).toBeDefined();
    // The plaintext mnemonic must NOT be persisted
    expect(files.get(KEYSTORE_PATH)!).not.toContain(VALID_MNEMONIC);
  });

  it("rejects an invalid mnemonic on mainnet without writing a keystore", async () => {
    await expect(
      getLightningManager().setupFromMainMnemonic(
        "not a valid mnemonic phrase at all",
        "password-1234",
        "test-wallet",
        "mainnet"
      )
    ).rejects.toThrow();

    expect(sparkInitialize).not.toHaveBeenCalled();
    expect(files.has(KEYSTORE_PATH)).toBe(false);
  });

  it("normalizes mnemonic whitespace and case before deriving", async () => {
    const messy = `  ${VALID_MNEMONIC.toUpperCase()}  `;
    const result = await getLightningManager().setupFromMainMnemonic(
      messy,
      "password-1234",
      "test-wallet",
      "mainnet"
    );

    expect(result.kind).toBe("setup");
    // Spark sees the normalized form, not the messy input
    expect(sparkInitialize).toHaveBeenCalledWith(VALID_MNEMONIC, "mainnet");
  });
});
