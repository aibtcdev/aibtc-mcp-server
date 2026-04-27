/**
 * Lightning wallet manager — singleton that parallels WalletManager.
 *
 * Stores an encrypted Lightning mnemonic at ~/.aibtc/lightning/keystore.json
 * and holds the initialized Spark-backed LightningProvider in-memory while
 * the wallet is unlocked.
 */

import fs from "fs/promises";
import path from "path";
import os from "os";
import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  encrypt,
  decrypt,
  generateWalletId,
  type EncryptedData,
} from "../utils/index.js";
import {
  InvalidPasswordError,
  InvalidMnemonicError,
  WalletError,
} from "../utils/errors.js";
import { NETWORK, type Network } from "../config/networks.js";
import { SparkLightningProvider } from "./lightning/spark-provider.js";
import type { LightningProvider } from "./lightning/provider.js";

const LIGHTNING_DIR = path.join(os.homedir(), ".aibtc", "lightning");
const KEYSTORE_FILE = path.join(LIGHTNING_DIR, "keystore.json");

/**
 * On-disk keystore layout for the Lightning wallet.
 */
interface LightningKeystore {
  version: 1;
  walletId: string;
  name: string;
  network: Network;
  encrypted: EncryptedData;
  createdAt: string;
}

/**
 * In-memory session for an unlocked Lightning wallet.
 */
interface LightningSession {
  walletId: string;
  name: string;
  network: Network;
  provider: SparkLightningProvider;
}

export interface LightningCreateResult {
  walletId: string;
  mnemonic: string;
  depositAddress: string;
  lightningAddress: string | null;
}

export interface LightningImportResult {
  walletId: string;
  depositAddress: string;
  lightningAddress: string | null;
}

export interface LightningUnlockResult {
  walletId: string;
  balanceSats: number;
  lightningAddress: string | null;
}

export interface LightningStatus {
  locked: boolean;
  walletId?: string;
  name?: string;
  network?: Network;
  lightningAddress?: string | null;
  depositAddress?: string;
  balanceSats?: number;
}

/**
 * Singleton manager for the embedded Lightning wallet.
 */
class LightningManager {
  private static instance: LightningManager;
  private session: LightningSession | null = null;

  private constructor() {}

  static getInstance(): LightningManager {
    if (!LightningManager.instance) {
      LightningManager.instance = new LightningManager();
    }
    return LightningManager.instance;
  }

  /**
   * Ensure the ~/.aibtc/lightning directory exists with 0700 perms.
   */
  private async ensureStorage(): Promise<void> {
    await fs.mkdir(LIGHTNING_DIR, { recursive: true, mode: 0o700 });
  }

  private async keystoreExists(): Promise<boolean> {
    try {
      await fs.access(KEYSTORE_FILE);
      return true;
    } catch {
      return false;
    }
  }

  private async readKeystore(): Promise<LightningKeystore> {
    const content = await fs.readFile(KEYSTORE_FILE, "utf8");
    return JSON.parse(content) as LightningKeystore;
  }

  private async writeKeystore(keystore: LightningKeystore): Promise<void> {
    await this.ensureStorage();
    const tempFile = `${KEYSTORE_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(keystore, null, 2), {
      mode: 0o600,
    });
    await fs.rename(tempFile, KEYSTORE_FILE);
  }

  /**
   * Store a mnemonic (shared logic for create/import).
   *
   * Initialize the Spark provider FIRST so connectivity / SDK validation
   * failures don't leave behind an encrypted keystore that blocks future
   * `lightning_create` / `lightning_import` calls (keystoreExists() short-
   * circuits both paths). Only after the provider is up do we persist the
   * keystore and establish the session.
   */
  private async storeWallet(
    name: string,
    mnemonic: string,
    password: string,
    network: Network
  ): Promise<{ walletId: string; provider: SparkLightningProvider }> {
    // 1. Bring up the Spark provider — validates the mnemonic + connectivity.
    //    If this throws, no keystore is written and the user can retry cleanly.
    const provider = await SparkLightningProvider.initialize(mnemonic, network);

    // 2. Persist the keystore now that we know the provider is functional.
    const encrypted = await encrypt(mnemonic, password);
    const walletId = generateWalletId();

    const keystore: LightningKeystore = {
      version: 1,
      walletId,
      name,
      network,
      encrypted,
      createdAt: new Date().toISOString(),
    };
    await this.writeKeystore(keystore);

    // 3. Establish the in-memory session.
    this.session = {
      walletId,
      name,
      network,
      provider,
    };

    return { walletId, provider };
  }

  /**
   * Create a new Lightning wallet with a fresh BIP39 mnemonic.
   */
  async createWallet(
    password: string,
    name: string,
    network?: Network
  ): Promise<LightningCreateResult> {
    if (await this.keystoreExists()) {
      throw new WalletError(
        "A Lightning wallet already exists. Use lightning_unlock to access it, or delete ~/.aibtc/lightning/keystore.json to replace it."
      );
    }

    const mnemonic = generateMnemonic(wordlist, 256);
    const walletNetwork = network || NETWORK;
    const { walletId, provider } = await this.storeWallet(
      name,
      mnemonic,
      password,
      walletNetwork
    );

    const depositAddress = await provider.getDepositAddress();
    const lightningAddress = await this.safeLightningAddress(provider);

    return {
      walletId,
      mnemonic,
      depositAddress,
      lightningAddress,
    };
  }

  /**
   * Import an existing Lightning wallet from a BIP39 mnemonic.
   */
  async importWallet(
    mnemonic: string,
    password: string,
    name: string,
    network?: Network
  ): Promise<LightningImportResult> {
    if (await this.keystoreExists()) {
      throw new WalletError(
        "A Lightning wallet already exists. Use lightning_unlock to access it, or delete ~/.aibtc/lightning/keystore.json to replace it."
      );
    }

    const normalized = mnemonic.trim().toLowerCase();
    if (!validateMnemonic(normalized, wordlist)) {
      throw new InvalidMnemonicError();
    }

    const walletNetwork = network || NETWORK;
    const { walletId, provider } = await this.storeWallet(
      name,
      normalized,
      password,
      walletNetwork
    );

    const depositAddress = await provider.getDepositAddress();
    const lightningAddress = await this.safeLightningAddress(provider);

    return {
      walletId,
      depositAddress,
      lightningAddress,
    };
  }

  /**
   * Unlock the Lightning wallet by decrypting the keystore and initializing
   * a SparkWallet session in-memory.
   */
  async unlock(password: string): Promise<LightningUnlockResult> {
    if (!(await this.keystoreExists())) {
      throw new WalletError(
        "No Lightning wallet found. Use lightning_create or lightning_import to set one up."
      );
    }

    const keystore = await this.readKeystore();

    let mnemonic: string;
    try {
      mnemonic = await decrypt(keystore.encrypted, password);
    } catch {
      throw new InvalidPasswordError();
    }

    const provider = await SparkLightningProvider.initialize(
      mnemonic,
      keystore.network
    );

    this.session = {
      walletId: keystore.walletId,
      name: keystore.name,
      network: keystore.network,
      provider,
    };

    const balance = await provider.getBalance();
    const lightningAddress = await this.safeLightningAddress(provider);

    return {
      walletId: keystore.walletId,
      balanceSats: balance.balanceSats,
      lightningAddress,
    };
  }

  /**
   * Clear the in-memory session.
   */
  lock(): void {
    this.session = null;
  }

  /**
   * Return the active LightningProvider, or null if locked.
   */
  getProvider(): LightningProvider | null {
    return this.session?.provider ?? null;
  }

  /**
   * Is a Lightning wallet currently unlocked?
   */
  isUnlocked(): boolean {
    return this.session !== null;
  }

  /**
   * Lightweight status snapshot for lightning_status.
   */
  async getStatus(): Promise<LightningStatus> {
    if (!this.session) {
      if (!(await this.keystoreExists())) {
        return { locked: true };
      }
      const keystore = await this.readKeystore();
      return {
        locked: true,
        walletId: keystore.walletId,
        name: keystore.name,
        network: keystore.network,
      };
    }

    const { walletId, name, network, provider } = this.session;
    const [balance, depositAddress, lightningAddress] = await Promise.all([
      provider.getBalance(),
      provider.getDepositAddress(),
      this.safeLightningAddress(provider),
    ]);

    return {
      locked: false,
      walletId,
      name,
      network,
      balanceSats: balance.balanceSats,
      depositAddress,
      lightningAddress,
    };
  }

  /**
   * Provider.getLightningAddress may be unimplemented — normalize to null.
   */
  private async safeLightningAddress(
    provider: LightningProvider
  ): Promise<string | null> {
    if (!provider.getLightningAddress) return null;
    return provider.getLightningAddress();
  }
}

export function getLightningManager(): LightningManager {
  return LightningManager.getInstance();
}
