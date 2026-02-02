import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import { validateMnemonic, generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  encrypt,
  decrypt,
  generateWalletId,
  initializeStorage,
  readWalletIndex,
  readKeystore,
  writeKeystore,
  readAppConfig,
  writeAppConfig,
  addWalletToIndex,
  removeWalletFromIndex,
  deleteWalletStorage,
  updateWalletMetadata,
  type WalletMetadata,
  type KeystoreFile,
  type WalletAddresses,
} from "../utils/index.js";
import {
  WalletNotFoundError,
  InvalidPasswordError,
  InvalidMnemonicError,
} from "../utils/errors.js";
import { NETWORK, type Network } from "../config/networks.js";
import type { Account } from "../transactions/builder.js";
import { deriveBitcoinAddress, deriveBitcoinKeyPair, deriveTaprootAddress } from "../utils/bitcoin.js";

/**
 * Session state for unlocked wallet
 */
interface Session {
  walletId: string;
  account: Account;
  unlockedAt: Date;
  expiresAt: Date | null;
}

/**
 * Base result for wallet operations that return addresses
 */
interface WalletResult extends WalletAddresses {
  walletId: string;
}

/**
 * Result from creating a new wallet (includes mnemonic shown once)
 */
export interface WalletCreateResult extends WalletResult {
  mnemonic: string;
}

/**
 * Result from importing a wallet
 */
export type WalletImportResult = WalletResult;

/**
 * Wallet manager singleton - handles wallet creation, encryption, and session management
 */
class WalletManager {
  private static instance: WalletManager;
  private session: Session | null = null;
  private lockTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  /**
   * Ensure storage is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initializeStorage();
      this.initialized = true;
    }
  }

  /**
   * Store a wallet from mnemonic (shared logic for create/import)
   */
  private async storeWallet(
    name: string,
    mnemonic: string,
    password: string,
    walletNetwork: Network
  ): Promise<WalletResult> {
    const wallet = await generateWallet({
      secretKey: mnemonic,
      password: "",
    });

    const stacksAccount = wallet.accounts[0];
    const stacksAddress = getStxAddress(stacksAccount, walletNetwork);
    const { address: bitcoinAddress } = deriveBitcoinAddress(mnemonic, walletNetwork);
    const { address: taprootAddress } = deriveTaprootAddress(mnemonic, walletNetwork);

    const encrypted = await encrypt(mnemonic, password);
    const walletId = generateWalletId();

    const keystore: KeystoreFile = {
      version: 1,
      encrypted,
      addressIndex: 0,
    };
    await writeKeystore(walletId, keystore);

    const metadata: WalletMetadata = {
      id: walletId,
      name,
      address: stacksAddress,
      btcAddress: bitcoinAddress,
      taprootAddress,
      network: walletNetwork,
      createdAt: new Date().toISOString(),
    };
    await addWalletToIndex(metadata);

    const config = await readAppConfig();
    config.activeWalletId = walletId;
    await writeAppConfig(config);

    return {
      walletId,
      address: stacksAddress,
      btcAddress: bitcoinAddress,
      taprootAddress,
    };
  }

  /**
   * Create a new wallet with BIP39 mnemonic
   */
  async createWallet(
    name: string,
    password: string,
    network?: Network
  ): Promise<WalletCreateResult> {
    await this.ensureInitialized();

    const mnemonic = generateMnemonic(wordlist, 256);
    const result = await this.storeWallet(name, mnemonic, password, network || NETWORK);

    return { ...result, mnemonic };
  }

  /**
   * Import an existing wallet from mnemonic
   */
  async importWallet(
    name: string,
    mnemonic: string,
    password: string,
    network?: Network
  ): Promise<WalletImportResult> {
    await this.ensureInitialized();

    const normalizedMnemonic = mnemonic.trim().toLowerCase();
    if (!validateMnemonic(normalizedMnemonic, wordlist)) {
      throw new InvalidMnemonicError();
    }

    return this.storeWallet(name, normalizedMnemonic, password, network || NETWORK);
  }

  /**
   * Unlock a wallet for use
   */
  async unlock(walletId: string, password: string): Promise<Account> {
    await this.ensureInitialized();

    // Get wallet metadata
    const index = await readWalletIndex();
    const walletMeta = index.wallets.find((w) => w.id === walletId);
    if (!walletMeta) {
      throw new WalletNotFoundError(walletId);
    }

    // Read keystore
    let keystore: KeystoreFile;
    try {
      keystore = await readKeystore(walletId);
    } catch {
      throw new WalletNotFoundError(walletId);
    }

    // Decrypt mnemonic
    let mnemonic: string;
    try {
      mnemonic = await decrypt(keystore.encrypted, password);
    } catch {
      throw new InvalidPasswordError();
    }

    // Generate account from mnemonic
    const wallet = await generateWallet({
      secretKey: mnemonic,
      password: "",
    });

    const stacksAccount = wallet.accounts[0];
    const address = getStxAddress(stacksAccount, walletMeta.network);

    // Derive Bitcoin key pair (includes private key for signing)
    const {
      address: btcAddress,
      privateKey: btcPrivateKey,
      publicKeyBytes: btcPublicKey,
    } = deriveBitcoinKeyPair(mnemonic, walletMeta.network);

    // Derive Taproot address for receiving inscriptions
    const { address: taprootAddress } = deriveTaprootAddress(mnemonic, walletMeta.network);

    const account: Account = {
      address,
      btcAddress,
      taprootAddress,
      privateKey: stacksAccount.stxPrivateKey,
      btcPrivateKey,
      btcPublicKey,
      network: walletMeta.network,
    };

    // Update last used timestamp
    await updateWalletMetadata(walletId, {
      lastUsed: new Date().toISOString(),
    });

    // Get auto-lock timeout
    const config = await readAppConfig();

    // Create session
    const now = new Date();
    this.session = {
      walletId,
      account,
      unlockedAt: now,
      expiresAt:
        config.autoLockTimeout > 0
          ? new Date(now.getTime() + config.autoLockTimeout * 60 * 1000)
          : null,
    };

    // Start auto-lock timer
    this.startAutoLockTimer(config.autoLockTimeout);

    // Update active wallet
    config.activeWalletId = walletId;
    await writeAppConfig(config);

    return account;
  }

  /**
   * Lock the wallet (clear session)
   */
  lock(): void {
    this.clearAutoLockTimer();
    this.session = null;
  }

  /**
   * Get the active account if unlocked
   */
  getActiveAccount(): Account | null {
    if (!this.session) {
      return null;
    }

    // Check if session expired
    if (this.session.expiresAt && new Date() > this.session.expiresAt) {
      this.lock();
      return null;
    }

    return this.session.account;
  }

  /**
   * Check if a wallet is unlocked
   */
  isUnlocked(): boolean {
    return this.getActiveAccount() !== null;
  }

  /**
   * Get session info (without sensitive data)
   */
  getSessionInfo(): (WalletAddresses & {
    walletId: string;
    expiresAt: Date | null;
  }) | null {
    if (!this.session) {
      return null;
    }

    // Check expiry
    if (this.session.expiresAt && new Date() > this.session.expiresAt) {
      this.lock();
      return null;
    }

    return {
      walletId: this.session.walletId,
      address: this.session.account.address,
      btcAddress: this.session.account.btcAddress,
      taprootAddress: this.session.account.taprootAddress,
      expiresAt: this.session.expiresAt,
    };
  }

  /**
   * Get the full account (with private keys for signing)
   * WARNING: Returns sensitive data. Only use for transaction signing.
   */
  getAccount(): Account | null {
    if (!this.session) {
      return null;
    }

    // Check expiry
    if (this.session.expiresAt && new Date() > this.session.expiresAt) {
      this.lock();
      return null;
    }

    return this.session.account;
  }

  /**
   * List all wallets (metadata only)
   */
  async listWallets(): Promise<WalletMetadata[]> {
    await this.ensureInitialized();
    const index = await readWalletIndex();
    return index.wallets;
  }

  /**
   * Check if any wallets exist
   */
  async hasWallets(): Promise<boolean> {
    await this.ensureInitialized();
    const index = await readWalletIndex();
    return index.wallets.length > 0;
  }

  /**
   * Get active wallet ID from config
   */
  async getActiveWalletId(): Promise<string | null> {
    await this.ensureInitialized();
    const config = await readAppConfig();
    return config.activeWalletId;
  }

  /**
   * Switch active wallet (note: requires unlock after switching)
   */
  async switchWallet(walletId: string): Promise<void> {
    await this.ensureInitialized();

    // Verify wallet exists
    const index = await readWalletIndex();
    const walletMeta = index.wallets.find((w) => w.id === walletId);
    if (!walletMeta) {
      throw new WalletNotFoundError(walletId);
    }

    // Lock current session
    this.lock();

    // Update active wallet
    const config = await readAppConfig();
    config.activeWalletId = walletId;
    await writeAppConfig(config);
  }

  /**
   * Delete a wallet (requires password confirmation)
   */
  async deleteWallet(walletId: string, password: string): Promise<void> {
    await this.ensureInitialized();

    // Verify wallet exists
    const index = await readWalletIndex();
    const walletMeta = index.wallets.find((w) => w.id === walletId);
    if (!walletMeta) {
      throw new WalletNotFoundError(walletId);
    }

    // Verify password by attempting to decrypt
    let keystore: KeystoreFile;
    try {
      keystore = await readKeystore(walletId);
    } catch {
      throw new WalletNotFoundError(walletId);
    }

    try {
      await decrypt(keystore.encrypted, password);
    } catch {
      throw new InvalidPasswordError();
    }

    // If this wallet is currently active, lock it
    if (this.session?.walletId === walletId) {
      this.lock();
    }

    // Delete wallet storage
    await deleteWalletStorage(walletId);

    // Remove from index
    await removeWalletFromIndex(walletId);

    // Update active wallet if needed
    const config = await readAppConfig();
    if (config.activeWalletId === walletId) {
      const remainingWallets = (await readWalletIndex()).wallets;
      config.activeWalletId =
        remainingWallets.length > 0 ? remainingWallets[0].id : null;
      await writeAppConfig(config);
    }
  }

  /**
   * Export mnemonic (requires password verification)
   */
  async exportMnemonic(walletId: string, password: string): Promise<string> {
    await this.ensureInitialized();

    // Verify wallet exists
    const index = await readWalletIndex();
    const walletMeta = index.wallets.find((w) => w.id === walletId);
    if (!walletMeta) {
      throw new WalletNotFoundError(walletId);
    }

    // Read keystore
    let keystore: KeystoreFile;
    try {
      keystore = await readKeystore(walletId);
    } catch {
      throw new WalletNotFoundError(walletId);
    }

    // Decrypt and return mnemonic
    try {
      return await decrypt(keystore.encrypted, password);
    } catch {
      throw new InvalidPasswordError();
    }
  }

  /**
   * Set auto-lock timeout
   */
  async setAutoLockTimeout(minutes: number): Promise<void> {
    await this.ensureInitialized();
    const config = await readAppConfig();
    config.autoLockTimeout = minutes;
    await writeAppConfig(config);

    // Update current session expiry if unlocked
    if (this.session) {
      this.session.expiresAt =
        minutes > 0
          ? new Date(Date.now() + minutes * 60 * 1000)
          : null;
      this.startAutoLockTimer(minutes);
    }
  }

  /**
   * Start auto-lock timer
   */
  private startAutoLockTimer(minutes: number): void {
    this.clearAutoLockTimer();

    if (minutes <= 0) {
      return; // No auto-lock
    }

    this.lockTimer = setTimeout(() => {
      this.lock();
    }, minutes * 60 * 1000);
  }

  /**
   * Clear auto-lock timer
   */
  private clearAutoLockTimer(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }
}

// Export singleton getter
export function getWalletManager(): WalletManager {
  return WalletManager.getInstance();
}
