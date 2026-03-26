import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  WalletMetadata,
  WalletIndex,
  AppConfig,
  KeystoreFile,
} from "../../src/utils/storage.js";

// In-memory storage for testing
let inMemoryWalletIndex: WalletIndex = {
  version: 1,
  wallets: [],
};

let inMemoryAppConfig: AppConfig = {
  version: 1,
  activeWalletId: null,
  autoLockTimeout: 15,
};

let inMemoryKeystores: Map<string, KeystoreFile> = new Map();

// Mock the entire storage module
vi.mock("../../src/utils/storage.js", () => ({
  initializeStorage: vi.fn(async () => {
    // Initialize in-memory state
    inMemoryWalletIndex = {
      version: 1,
      wallets: [],
    };
    inMemoryAppConfig = {
      version: 1,
      activeWalletId: null,
      autoLockTimeout: 15,
    };
    inMemoryKeystores.clear();
  }),
  readWalletIndex: vi.fn(async () => {
    return { ...inMemoryWalletIndex, wallets: [...inMemoryWalletIndex.wallets] };
  }),
  writeWalletIndex: vi.fn(async (index: WalletIndex) => {
    inMemoryWalletIndex = { ...index, wallets: [...index.wallets] };
  }),
  readAppConfig: vi.fn(async () => {
    return { ...inMemoryAppConfig };
  }),
  writeAppConfig: vi.fn(async (config: AppConfig) => {
    inMemoryAppConfig = { ...config };
  }),
  readKeystore: vi.fn(async (walletId: string) => {
    const keystore = inMemoryKeystores.get(walletId);
    if (!keystore) {
      throw new Error(`Keystore not found for wallet: ${walletId}`);
    }
    return { ...keystore };
  }),
  writeKeystore: vi.fn(async (walletId: string, keystore: KeystoreFile) => {
    inMemoryKeystores.set(walletId, { ...keystore });
  }),
  addWalletToIndex: vi.fn(async (wallet: WalletMetadata) => {
    inMemoryWalletIndex.wallets.push({ ...wallet });
  }),
  removeWalletFromIndex: vi.fn(async (walletId: string) => {
    inMemoryWalletIndex.wallets = inMemoryWalletIndex.wallets.filter(
      (w) => w.id !== walletId
    );
  }),
  deleteWalletStorage: vi.fn(async (_walletId: string) => {
    // No-op in tests
  }),
  updateWalletMetadata: vi.fn(
    async (walletId: string, updates: Partial<WalletMetadata>) => {
      const walletIndex = inMemoryWalletIndex.wallets.findIndex(
        (w) => w.id === walletId
      );
      if (walletIndex === -1) {
        throw new Error(`Wallet not found: ${walletId}`);
      }
      inMemoryWalletIndex.wallets[walletIndex] = {
        ...inMemoryWalletIndex.wallets[walletIndex],
        ...updates,
      };
    }
  ),
  getStorageDir: vi.fn(() => "/tmp/.aibtc-test"),
  storageExists: vi.fn(async () => true),
  getKeystorePath: vi.fn((walletId: string) => `/tmp/.aibtc-test/wallets/${walletId}/keystore.json`),
  backupKeystore: vi.fn(async (walletId: string) => {
    const keystore = inMemoryKeystores.get(walletId);
    if (!keystore) throw new Error(`Keystore not found for wallet: ${walletId}`);
    inMemoryKeystores.set(`${walletId}__backup`, { ...keystore });
  }),
  restoreKeystoreBackup: vi.fn(async (walletId: string) => {
    const backup = inMemoryKeystores.get(`${walletId}__backup`);
    if (!backup) throw new Error(`Backup not found for wallet: ${walletId}`);
    inMemoryKeystores.set(walletId, { ...backup });
    inMemoryKeystores.delete(`${walletId}__backup`);
  }),
  deleteKeystoreBackup: vi.fn(async (walletId: string) => {
    inMemoryKeystores.delete(`${walletId}__backup`);
  }),
}));

// Import after mocking
const { getWalletManager } = await import("../../src/services/wallet-manager.js");

describe("WalletManager", () => {
  let walletManager: Awaited<ReturnType<typeof getWalletManager>>;

  beforeEach(async () => {
    // Reset in-memory storage
    inMemoryWalletIndex = {
      version: 1,
      wallets: [],
    };
    inMemoryAppConfig = {
      version: 1,
      activeWalletId: null,
      autoLockTimeout: 15,
    };
    inMemoryKeystores.clear();

    // Get fresh wallet manager instance
    walletManager = await getWalletManager();
    // Lock it to reset state
    await walletManager.lock();
  });

  describe("createWallet", () => {
    it("should create a new wallet with valid credentials", async () => {
      const result = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      expect(result).toHaveProperty("walletId");
      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("mnemonic");

      // Validate walletId is a UUID
      expect(result.walletId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      // Validate address starts with S
      expect(result.address).toMatch(/^S[A-Z0-9]{38,}$/);

      // Validate mnemonic is 24 words
      const words = result.mnemonic.trim().split(/\s+/);
      expect(words.length).toBe(24);
    });

    it("should store wallet in index with Bitcoin address", async () => {
      const result = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      const wallets = await walletManager.listWallets();
      expect(wallets).toHaveLength(1);
      expect(wallets[0].id).toBe(result.walletId);
      expect(wallets[0].name).toBe("test-wallet");
      expect(wallets[0].address).toBe(result.address);

      // Verify Bitcoin address is present and has correct format
      expect(wallets[0].btcAddress).toBeDefined();
      // Mainnet Bitcoin addresses start with bc1q (native SegWit)
      expect(wallets[0].btcAddress).toMatch(/^bc1q[a-z0-9]{38,}$/);
    });
  });

  describe("importWallet", () => {
    it("should import wallet with valid mnemonic and derive Bitcoin address", async () => {
      // First create a wallet to get a valid mnemonic
      const created = await walletManager.createWallet(
        "original",
        "password123"
      );
      const mnemonic = created.mnemonic;
      const createdWallets = await walletManager.listWallets();
      const originalBtcAddress = createdWallets[0].btcAddress;

      // Reset storage
      inMemoryWalletIndex.wallets = [];
      inMemoryKeystores.clear();

      // Import with the same mnemonic
      const result = await walletManager.importWallet(
        "imported-wallet",
        mnemonic,
        "password456"
      );

      expect(result).toHaveProperty("walletId");
      expect(result).toHaveProperty("address");
      // Same mnemonic should produce same address
      expect(result.address).toBe(created.address);

      // Verify Bitcoin address matches original
      const wallets = await walletManager.listWallets();
      expect(wallets[0].btcAddress).toBe(originalBtcAddress);
      expect(wallets[0].btcAddress).toMatch(/^bc1q[a-z0-9]{38,}$/);
    });

    it("should throw for invalid mnemonic", async () => {
      const invalidMnemonic = "invalid mnemonic phrase";

      await expect(
        walletManager.importWallet("test", invalidMnemonic, "password123")
      ).rejects.toThrow();
    });
  });

  describe("unlock and lock lifecycle", () => {
    it("should unlock wallet with correct password and include Bitcoin address", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      const account = await walletManager.unlock(
        created.walletId,
        "password123"
      );

      expect(account).toHaveProperty("address");
      expect(account.address).toBe(created.address);
      expect(walletManager.isUnlocked()).toBe(true);

      // Verify Bitcoin address is included in account
      expect(account.btcAddress).toBeDefined();
      expect(account.btcAddress).toMatch(/^bc1q[a-z0-9]{38,}$/);

      // Verify Bitcoin address matches metadata
      const wallets = await walletManager.listWallets();
      expect(account.btcAddress).toBe(wallets[0].btcAddress);
    });

    it("should throw when unlocking with wrong password", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await expect(
        walletManager.unlock(created.walletId, "wrongpassword")
      ).rejects.toThrow();
    });

    it("should lock wallet", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );
      await walletManager.unlock(created.walletId, "password123");

      expect(walletManager.isUnlocked()).toBe(true);

      await walletManager.lock();

      expect(walletManager.isUnlocked()).toBe(false);
      expect(walletManager.getActiveAccount()).toBeNull();
    });
  });

  describe("session management", () => {
    it("should return session info when unlocked with Bitcoin address", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );
      await walletManager.unlock(created.walletId, "password123");

      const sessionInfo = walletManager.getSessionInfo();

      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.walletId).toBe(created.walletId);
      expect(sessionInfo?.expiresAt).toBeDefined();

      // Verify Bitcoin address is exposed in session info
      expect(sessionInfo?.btcAddress).toBeDefined();
      expect(sessionInfo?.btcAddress).toMatch(/^bc1q[a-z0-9]{38,}$/);
    });

    it("should return null session info when locked", () => {
      const sessionInfo = walletManager.getSessionInfo();
      expect(sessionInfo).toBeNull();
    });

    it("should handle auto-lock timeout of 0 (never lock)", async () => {
      await walletManager.setAutoLockTimeout(0);

      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );
      await walletManager.unlock(created.walletId, "password123");

      const sessionInfo = walletManager.getSessionInfo();
      expect(sessionInfo?.expiresAt).toBeNull();
    });
  });

  describe("deleteWallet", () => {
    it("should delete wallet with correct password", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await walletManager.deleteWallet(created.walletId, "password123");

      const wallets = await walletManager.listWallets();
      expect(wallets).toHaveLength(0);
    });

    it("should throw when deleting with wrong password", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await expect(
        walletManager.deleteWallet(created.walletId, "wrongpassword")
      ).rejects.toThrow();
    });
  });

  describe("exportMnemonic", () => {
    it("should export mnemonic with correct password", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );
      const originalMnemonic = created.mnemonic;

      const exported = await walletManager.exportMnemonic(
        created.walletId,
        "password123"
      );

      expect(exported).toBe(originalMnemonic);
    });

    it("should throw when exporting with wrong password", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await expect(
        walletManager.exportMnemonic(created.walletId, "wrongpassword")
      ).rejects.toThrow();
    });
  });

  describe("wallet listing and switching", () => {
    it("should list all wallets", async () => {
      await walletManager.createWallet("wallet1", "password123");
      await walletManager.createWallet("wallet2", "password456");

      const wallets = await walletManager.listWallets();
      expect(wallets).toHaveLength(2);
      expect(wallets[0].name).toBe("wallet1");
      expect(wallets[1].name).toBe("wallet2");
    });

    it("should switch active wallet", async () => {
      await walletManager.createWallet("wallet1", "password123");
      const wallet2 = await walletManager.createWallet("wallet2", "password456");

      await walletManager.switchWallet(wallet2.walletId);

      const activeId = await walletManager.getActiveWalletId();
      expect(activeId).toBe(wallet2.walletId);
    });
  });

  describe("rotatePassword", () => {
    it("should rotate password successfully", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await walletManager.rotatePassword(
        created.walletId,
        "password123",
        "newpassword456"
      );

      // New password should work
      const account = await walletManager.unlock(
        created.walletId,
        "newpassword456"
      );
      expect(account.address).toBe(created.address);
    });

    it("should reject old password after rotation", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await walletManager.rotatePassword(
        created.walletId,
        "password123",
        "newpassword456"
      );

      await expect(
        walletManager.unlock(created.walletId, "password123")
      ).rejects.toThrow();
    });

    it("should lock wallet after rotation", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );
      await walletManager.unlock(created.walletId, "password123");
      expect(walletManager.isUnlocked()).toBe(true);

      await walletManager.rotatePassword(
        created.walletId,
        "password123",
        "newpassword456"
      );

      expect(walletManager.isUnlocked()).toBe(false);
    });

    it("should throw for wrong old password", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await expect(
        walletManager.rotatePassword(
          created.walletId,
          "wrongpassword",
          "newpassword456"
        )
      ).rejects.toThrow();
    });

    it("should throw if new password is same as old", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await expect(
        walletManager.rotatePassword(
          created.walletId,
          "password123",
          "password123"
        )
      ).rejects.toThrow("New password must be different from old password");
    });

    it("should throw if new password is too short", async () => {
      const created = await walletManager.createWallet(
        "test-wallet",
        "password123"
      );

      await expect(
        walletManager.rotatePassword(created.walletId, "password123", "short")
      ).rejects.toThrow("New password must be at least 8 characters");
    });

    it("should throw for non-existent wallet", async () => {
      await expect(
        walletManager.rotatePassword(
          "non-existent-id",
          "password123",
          "newpassword456"
        )
      ).rejects.toThrow();
    });
  });

  describe("Bitcoin address lifecycle integration", () => {
    it("should maintain consistent Bitcoin address throughout wallet lifecycle", async () => {
      // Step 1: Create wallet and verify Bitcoin address in metadata
      const created = await walletManager.createWallet(
        "lifecycle-test",
        "password123"
      );
      const originalMnemonic = created.mnemonic;

      const walletsAfterCreate = await walletManager.listWallets();
      expect(walletsAfterCreate).toHaveLength(1);
      const btcAddressFromCreate = walletsAfterCreate[0].btcAddress;
      expect(btcAddressFromCreate).toBeDefined();
      expect(btcAddressFromCreate).toMatch(/^bc1q[a-z0-9]{38,}$/);

      // Step 2: Unlock wallet and verify Bitcoin address in Account matches metadata
      const account = await walletManager.unlock(
        created.walletId,
        "password123"
      );
      expect(account.btcAddress).toBeDefined();
      expect(account.btcAddress).toBe(btcAddressFromCreate);

      // Verify session info also includes Bitcoin address
      const sessionInfo = walletManager.getSessionInfo();
      expect(sessionInfo?.btcAddress).toBe(btcAddressFromCreate);

      // Step 3: Lock wallet and verify state clears properly
      await walletManager.lock();
      expect(walletManager.isUnlocked()).toBe(false);
      expect(walletManager.getActiveAccount()).toBeNull();
      expect(walletManager.getSessionInfo()).toBeNull();

      // Step 4: Reset storage and import same wallet
      inMemoryWalletIndex.wallets = [];
      inMemoryKeystores.clear();

      const imported = await walletManager.importWallet(
        "imported-lifecycle",
        originalMnemonic,
        "newpassword456"
      );

      // Step 5: Verify Bitcoin address is consistent across create/import
      const walletsAfterImport = await walletManager.listWallets();
      expect(walletsAfterImport).toHaveLength(1);
      const btcAddressFromImport = walletsAfterImport[0].btcAddress;
      expect(btcAddressFromImport).toBe(btcAddressFromCreate);

      // Step 6: Unlock imported wallet and verify Bitcoin address still matches
      const importedAccount = await walletManager.unlock(
        imported.walletId,
        "newpassword456"
      );
      expect(importedAccount.btcAddress).toBe(btcAddressFromCreate);

      // Final verification: All Bitcoin addresses match across entire lifecycle
      expect(btcAddressFromCreate).toBe(btcAddressFromImport);
      expect(account.btcAddress).toBe(importedAccount.btcAddress);
    });
  });
});
