import fs from "fs/promises";
import path from "path";
import os from "os";
import type { EncryptedData } from "./encryption.js";
import type { Network } from "../config/networks.js";

/**
 * Storage directory location
 * Migrated from ~/.stx402/ to ~/.aibtc/ in v1.0.0
 */
const OLD_STORAGE_DIR = path.join(os.homedir(), ".stx402");
const STORAGE_DIR = path.join(os.homedir(), ".aibtc");
const WALLETS_DIR = path.join(STORAGE_DIR, "wallets");
const WALLET_INDEX_FILE = path.join(STORAGE_DIR, "wallets.json");
const CONFIG_FILE = path.join(STORAGE_DIR, "config.json");

/**
 * Migrate storage from ~/.stx402/ to ~/.aibtc/ (one-time migration)
 */
async function migrateStorage(): Promise<void> {
  try {
    const oldExists = await fs.access(OLD_STORAGE_DIR).then(() => true).catch(() => false);
    const newExists = await fs.access(STORAGE_DIR).then(() => true).catch(() => false);
    if (oldExists && !newExists) {
      await fs.rename(OLD_STORAGE_DIR, STORAGE_DIR);
      console.error(`Migrated wallet storage from ${OLD_STORAGE_DIR} to ${STORAGE_DIR}`);
    }
  } catch (error) {
    console.error(`Failed to migrate storage directory: ${error}`);
  }
}

/**
 * Migrate wallet metadata to use new Bitcoin-first field names.
 * Copies legacy fields (btcAddress, address) to new fields (bitcoinAddress, stacksAddress)
 * for existing wallets that were created before the v2.0 naming convention.
 */
async function migrateWalletMetadata(): Promise<void> {
  try {
    const index = await readWalletIndex();
    let needsWrite = false;

    for (const wallet of index.wallets) {
      // Migrate btcAddress -> bitcoinAddress
      if (wallet.btcAddress && !wallet.bitcoinAddress) {
        wallet.bitcoinAddress = wallet.btcAddress;
        needsWrite = true;
      }
      // Migrate address -> stacksAddress
      if (wallet.address && !wallet.stacksAddress) {
        wallet.stacksAddress = wallet.address;
        needsWrite = true;
      }
    }

    if (needsWrite) {
      await writeWalletIndex(index);
    }
  } catch (error) {
    // Silently ignore migration errors - index may not exist yet
  }
}

/**
 * Common address fields for wallet-related types.
 * Includes both new Bitcoin-first naming and deprecated fields for backward compatibility.
 */
export interface WalletAddresses {
  /** Bitcoin L1 address (primary). Added in v2.0. */
  bitcoinAddress?: string;
  /** Stacks L2 address. Added in v2.0. */
  stacksAddress?: string;
  /** @deprecated Use stacksAddress instead. Required for backward compatibility with existing code. */
  address: string;
  /** @deprecated Use bitcoinAddress instead. */
  btcAddress?: string;
}

/**
 * Wallet metadata (stored in index, no sensitive data)
 */
export interface WalletMetadata extends WalletAddresses {
  id: string;
  name: string;
  network: Network;
  createdAt: string;
  lastUsed?: string;
}

/**
 * Wallet index file structure
 */
export interface WalletIndex {
  version: number;
  wallets: WalletMetadata[];
}

/**
 * App configuration
 */
export interface AppConfig {
  version: number;
  activeWalletId: string | null;
  autoLockTimeout: number; // Minutes, 0 = never
}

/**
 * Keystore file structure (contains encrypted mnemonic)
 */
export interface KeystoreFile {
  version: number;
  encrypted: EncryptedData;
  addressIndex: number; // BIP44 address index
}

const CURRENT_INDEX_VERSION = 1;
const CURRENT_CONFIG_VERSION = 1;

/**
 * Get storage directory path
 */
export function getStorageDir(): string {
  return STORAGE_DIR;
}

/**
 * Check if storage directory exists
 */
export async function storageExists(): Promise<boolean> {
  try {
    await fs.access(STORAGE_DIR);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize storage directory structure
 */
export async function initializeStorage(): Promise<void> {
  await migrateStorage();
  await migrateWalletMetadata();
  // Create directories
  await fs.mkdir(WALLETS_DIR, { recursive: true, mode: 0o700 });

  // Create wallet index if it doesn't exist
  try {
    await fs.access(WALLET_INDEX_FILE);
  } catch {
    const defaultIndex: WalletIndex = {
      version: CURRENT_INDEX_VERSION,
      wallets: [],
    };
    await writeWalletIndex(defaultIndex);
  }

  // Create config if it doesn't exist
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    const defaultConfig: AppConfig = {
      version: CURRENT_CONFIG_VERSION,
      activeWalletId: null,
      autoLockTimeout: 15, // 15 minutes default
    };
    await writeAppConfig(defaultConfig);
  }
}

/**
 * Read wallet index
 */
export async function readWalletIndex(): Promise<WalletIndex> {
  try {
    const content = await fs.readFile(WALLET_INDEX_FILE, "utf8");
    return JSON.parse(content) as WalletIndex;
  } catch {
    return {
      version: CURRENT_INDEX_VERSION,
      wallets: [],
    };
  }
}

/**
 * Write wallet index (atomic write with temp file)
 */
export async function writeWalletIndex(index: WalletIndex): Promise<void> {
  const tempFile = `${WALLET_INDEX_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(index, null, 2), {
    mode: 0o600,
  });
  await fs.rename(tempFile, WALLET_INDEX_FILE);
}

/**
 * Read app config
 */
export async function readAppConfig(): Promise<AppConfig> {
  try {
    const content = await fs.readFile(CONFIG_FILE, "utf8");
    return JSON.parse(content) as AppConfig;
  } catch {
    return {
      version: CURRENT_CONFIG_VERSION,
      activeWalletId: null,
      autoLockTimeout: 15,
    };
  }
}

/**
 * Write app config (atomic write)
 */
export async function writeAppConfig(config: AppConfig): Promise<void> {
  const tempFile = `${CONFIG_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
  await fs.rename(tempFile, CONFIG_FILE);
}

/**
 * Get keystore file path for a wallet
 */
function getKeystorePath(walletId: string): string {
  return path.join(WALLETS_DIR, walletId, "keystore.json");
}

/**
 * Read keystore for a wallet
 */
export async function readKeystore(walletId: string): Promise<KeystoreFile> {
  const keystorePath = getKeystorePath(walletId);
  const content = await fs.readFile(keystorePath, "utf8");
  return JSON.parse(content) as KeystoreFile;
}

/**
 * Write keystore for a wallet (creates directory if needed)
 */
export async function writeKeystore(
  walletId: string,
  keystore: KeystoreFile
): Promise<void> {
  const walletDir = path.join(WALLETS_DIR, walletId);
  await fs.mkdir(walletDir, { recursive: true, mode: 0o700 });

  const keystorePath = getKeystorePath(walletId);
  const tempFile = `${keystorePath}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(keystore, null, 2), {
    mode: 0o600,
  });
  await fs.rename(tempFile, keystorePath);
}

/**
 * Delete a wallet directory and its contents
 */
export async function deleteWalletStorage(walletId: string): Promise<void> {
  const walletDir = path.join(WALLETS_DIR, walletId);
  await fs.rm(walletDir, { recursive: true, force: true });
}

/**
 * Update wallet metadata in index
 */
export async function updateWalletMetadata(
  walletId: string,
  updates: Partial<WalletMetadata>
): Promise<void> {
  const index = await readWalletIndex();
  const walletIndex = index.wallets.findIndex((w) => w.id === walletId);

  if (walletIndex === -1) {
    throw new Error(`Wallet not found: ${walletId}`);
  }

  index.wallets[walletIndex] = {
    ...index.wallets[walletIndex],
    ...updates,
  };

  await writeWalletIndex(index);
}

/**
 * Add wallet to index
 */
export async function addWalletToIndex(wallet: WalletMetadata): Promise<void> {
  const index = await readWalletIndex();
  index.wallets.push(wallet);
  await writeWalletIndex(index);
}

/**
 * Remove wallet from index
 */
export async function removeWalletFromIndex(walletId: string): Promise<void> {
  const index = await readWalletIndex();
  index.wallets = index.wallets.filter((w) => w.id !== walletId);
  await writeWalletIndex(index);
}
