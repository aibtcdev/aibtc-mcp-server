import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { NETWORK, API_URL } from "../config/networks.js";

/**
 * Register wallet management tools
 */
export function registerWalletManagementTools(server: McpServer): void {
  /**
   * Create a new wallet with BIP39 mnemonic
   */
  server.registerTool(
    "wallet_create",
    {
      description: `Create a new wallet for the agent with a generated BIP39 24-word mnemonic.
The wallet is encrypted locally and stored in ~/.aibtc/.
IMPORTANT: Save the mnemonic securely - it will only be shown once!`,
      inputSchema: {
        name: z.string().describe("Name for the wallet (e.g., 'main', 'trading')"),
        password: z
          .string()
          .min(8)
          .describe("Password to protect the wallet (minimum 8 characters) - WARNING: sensitive value"),
        network: z
          .enum(["mainnet", "testnet"])
          .optional()
          .describe("Network for the wallet (default: current network)"),
      },
    },
    async ({ name, password, network }) => {
      try {
        const walletManager = getWalletManager();
        const result = await walletManager.createWallet(name, password, network);

        return createJsonResponse({
          success: true,
          message:
            "Wallet created successfully! Bitcoin L1 (SegWit + Taproot) and Stacks L2 addresses ready.",
          walletId: result.walletId,
          "Bitcoin (L1)": {
            "Native SegWit": `${result.btcAddress} (send/receive BTC)`,
            "Taproot": `${result.taprootAddress} (receive inscriptions)`,
          },
          "Stacks (L2)": {
            "Address": result.address,
            "Tip": "Register a BNS name for on-chain identity",
          },
          network: network || NETWORK,
          "---": "",
          mnemonic: result.mnemonic,
          warning:
            "CRITICAL: Save this mnemonic phrase securely! It will NOT be shown again. " +
            "This is the only way to recover the wallet if the password is forgotten.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Import an existing wallet from mnemonic
   */
  server.registerTool(
    "wallet_import",
    {
      description: `Import an existing wallet for the agent using a BIP39 mnemonic phrase.
The wallet is encrypted locally and stored in ~/.aibtc/.`,
      inputSchema: {
        name: z.string().describe("Name for the wallet"),
        mnemonic: z.string().describe("24-word BIP39 mnemonic phrase - WARNING: sensitive value"),
        password: z
          .string()
          .min(8)
          .describe("Password to protect the wallet (minimum 8 characters) - WARNING: sensitive value"),
        network: z
          .enum(["mainnet", "testnet"])
          .optional()
          .describe("Network for the wallet (default: current network)"),
      },
    },
    async ({ name, mnemonic, password, network }) => {
      try {
        const walletManager = getWalletManager();
        const result = await walletManager.importWallet(
          name,
          mnemonic,
          password,
          network
        );

        return createJsonResponse({
          success: true,
          message: "Wallet imported successfully! Bitcoin L1 (SegWit + Taproot) and Stacks L2 addresses ready.",
          walletId: result.walletId,
          "Bitcoin (L1)": {
            "Native SegWit": `${result.btcAddress} (send/receive BTC)`,
            "Taproot": `${result.taprootAddress} (receive inscriptions)`,
          },
          "Stacks (L2)": {
            "Address": result.address,
            "Tip": "Register a BNS name for on-chain identity",
          },
          network: network || NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Unlock a wallet for use
   */
  server.registerTool(
    "wallet_unlock",
    {
      description: `Unlock the agent's wallet to enable transactions.
If no wallet ID is provided, unlocks the active wallet.`,
      inputSchema: {
        walletId: z
          .string()
          .optional()
          .describe("Wallet ID to unlock (uses active wallet if not specified)"),
        password: z.string().describe("Wallet password - WARNING: sensitive value"),
      },
    },
    async ({ walletId, password }) => {
      try {
        const walletManager = getWalletManager();

        // Get wallet ID to unlock
        let targetWalletId: string | undefined = walletId;
        if (!targetWalletId) {
          const activeId = await walletManager.getActiveWalletId();
          if (!activeId) {
            return createErrorResponse(
              new Error(
                "I don't have a wallet yet. Use wallet_create to give me one, or wallet_list to see available wallets."
              )
            );
          }
          targetWalletId = activeId;
        }

        const account = await walletManager.unlock(targetWalletId, password);

        return createJsonResponse({
          success: true,
          message: "Wallet unlocked successfully! Bitcoin L1 (SegWit + Taproot) and Stacks L2 transactions enabled.",
          walletId: targetWalletId,
          "Bitcoin (L1)": {
            "Native SegWit": `${account.btcAddress} (send/receive BTC)`,
            "Taproot": `${account.taprootAddress} (receive inscriptions)`,
          },
          "Stacks (L2)": {
            "Address": account.address,
            "Tip": "Register a BNS name for on-chain identity",
          },
          network: account.network,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Lock the wallet (clear from memory)
   */
  server.registerTool(
    "wallet_lock",
    {
      description: "Lock the agent's wallet, clearing sensitive data from memory.",
    },
    async () => {
      try {
        const walletManager = getWalletManager();
        const wasUnlocked = walletManager.isUnlocked();
        await walletManager.lock();

        return createJsonResponse({
          success: true,
          message: wasUnlocked
            ? "My wallet is now locked. I'll need it unlocked again to perform transactions."
            : "My wallet was already locked.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * List available wallets
   */
  server.registerTool(
    "wallet_list",
    {
      description: "List all wallets available for the agent to use.",
    },
    async () => {
      try {
        const walletManager = getWalletManager();
        const wallets = await walletManager.listWallets();
        const activeWalletId = await walletManager.getActiveWalletId();
        const sessionInfo = walletManager.getSessionInfo();

        if (wallets.length === 0) {
          return createJsonResponse({
            message: "I don't have any wallets yet. Use wallet_create to give me one.",
            wallets: [],
            totalCount: 0,
          });
        }

        return createJsonResponse({
          message: `I have ${wallets.length} wallet(s) available.`,
          wallets: wallets.map((w) => ({
            id: w.id,
            name: w.name,
            btcAddress: w.btcAddress,
            address: w.address,
            network: w.network,
            createdAt: w.createdAt,
            lastUsed: w.lastUsed,
            isActive: w.id === activeWalletId,
            isUnlocked: sessionInfo?.walletId === w.id,
          })),
          totalCount: wallets.length,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Switch active wallet
   */
  server.registerTool(
    "wallet_switch",
    {
      description: `Switch to a different wallet.
Note: The new wallet will need to be unlocked before use.`,
      inputSchema: {
        walletId: z.string().describe("Wallet ID to switch to"),
      },
    },
    async ({ walletId }) => {
      try {
        const walletManager = getWalletManager();
        await walletManager.switchWallet(walletId);

        // Get wallet info
        const wallets = await walletManager.listWallets();
        const wallet = wallets.find((w) => w.id === walletId);

        return createJsonResponse({
          success: true,
          message:
            "Switched to wallet. Use wallet_unlock to unlock it for transactions.",
          activeWalletId: walletId,
          btcAddress: wallet?.btcAddress,
          address: wallet?.address,
          network: wallet?.network,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Delete a wallet
   */
  server.registerTool(
    "wallet_delete",
    {
      description: `Permanently delete a wallet.
WARNING: This cannot be undone! Make sure you have backed up your mnemonic.`,
      inputSchema: {
        walletId: z.string().describe("Wallet ID to delete"),
        password: z.string().describe("Wallet password for confirmation - WARNING: sensitive value"),
        confirm: z
          .literal("DELETE")
          .describe("Type 'DELETE' to confirm deletion"),
      },
    },
    async ({ walletId, password, confirm }) => {
      try {
        if (confirm !== "DELETE") {
          return createErrorResponse(
            new Error("Confirmation required: set confirm to 'DELETE'")
          );
        }

        const walletManager = getWalletManager();

        // Get wallet info before deletion
        const wallets = await walletManager.listWallets();
        const wallet = wallets.find((w) => w.id === walletId);

        await walletManager.deleteWallet(walletId, password);

        return createJsonResponse({
          success: true,
          message: "Wallet deleted permanently.",
          deletedWalletId: walletId,
          deletedBtcAddress: wallet?.btcAddress,
          deletedAddress: wallet?.address,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Export mnemonic (with security warning)
   */
  server.registerTool(
    "wallet_export",
    {
      description: `Export the mnemonic phrase for a wallet.
WARNING: Only use this in a secure environment! Anyone with the mnemonic can access your funds.`,
      inputSchema: {
        walletId: z
          .string()
          .optional()
          .describe("Wallet ID to export (uses active wallet if not specified)"),
        password: z.string().describe("Wallet password - WARNING: sensitive value"),
        confirm: z
          .literal("I_UNDERSTAND_THE_RISKS")
          .describe("Type 'I_UNDERSTAND_THE_RISKS' to confirm"),
      },
    },
    async ({ walletId, password, confirm }) => {
      try {
        if (confirm !== "I_UNDERSTAND_THE_RISKS") {
          return createErrorResponse(
            new Error(
              "Confirmation required: set confirm to 'I_UNDERSTAND_THE_RISKS'"
            )
          );
        }

        const walletManager = getWalletManager();

        // Get wallet ID
        let targetWalletId: string | undefined = walletId;
        if (!targetWalletId) {
          const activeId = await walletManager.getActiveWalletId();
          if (!activeId) {
            return createErrorResponse(
              new Error("No wallet specified and no active wallet set.")
            );
          }
          targetWalletId = activeId;
        }

        const mnemonic = await walletManager.exportMnemonic(
          targetWalletId,
          password
        );

        return createJsonResponse({
          walletId: targetWalletId,
          mnemonic,
          warning:
            "SECURITY WARNING: This mnemonic provides full access to your wallet. " +
            "Store it securely and never share it with anyone.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Rotate wallet password
   */
  server.registerTool(
    "wallet_rotate_password",
    {
      description: `Change the password for a wallet's encrypted keystore.
Performs an atomic operation: backs up the keystore, re-encrypts with the new password, verifies the round-trip, then cleans up. If anything fails, the original keystore is restored.
If the wallet is currently unlocked, it will be locked after rotation (requires re-unlock with new password).`,
      inputSchema: {
        walletId: z
          .string()
          .optional()
          .describe("Wallet ID to rotate password for (uses active wallet if not specified)"),
        oldPassword: z.string().describe("Current wallet password - WARNING: sensitive value"),
        newPassword: z
          .string()
          .min(8)
          .describe("New password (minimum 8 characters) - WARNING: sensitive value"),
      },
    },
    async ({ walletId, oldPassword, newPassword }) => {
      try {
        const walletManager = getWalletManager();

        // Resolve wallet ID
        let targetWalletId: string | undefined = walletId;
        if (!targetWalletId) {
          const activeId = await walletManager.getActiveWalletId();
          if (!activeId) {
            return createErrorResponse(
              new Error(
                "No wallet specified and no active wallet set. Use wallet_list to see available wallets."
              )
            );
          }
          targetWalletId = activeId;
        }

        await walletManager.rotatePassword(
          targetWalletId,
          oldPassword,
          newPassword
        );

        return createJsonResponse({
          success: true,
          message:
            "Password rotated successfully. The wallet has been locked — use wallet_unlock with the new password.",
          walletId: targetWalletId,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Set auto-lock timeout
   */
  server.registerTool(
    "wallet_set_timeout",
    {
      description:
        "Set how long the agent's wallet stays unlocked before automatically locking. Set to 0 to disable auto-lock.",
      inputSchema: {
        minutes: z
          .number()
          .min(0)
          .describe("Minutes until auto-lock (0 = never auto-lock)"),
      },
    },
    async ({ minutes }) => {
      try {
        const walletManager = getWalletManager();
        await walletManager.setAutoLockTimeout(minutes);

        const message =
          minutes === 0
            ? "Auto-lock disabled. My wallet will stay unlocked until manually locked."
            : `Auto-lock set to ${minutes} minutes. My wallet will lock automatically after ${minutes} minutes of inactivity.`;

        return createJsonResponse({
          success: true,
          message,
          autoLockMinutes: minutes,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  /**
   * Get wallet status
   */
  server.registerTool(
    "wallet_status",
    {
      description:
        "Get the agent's wallet status - whether it has a wallet, if it's unlocked, and what it can do.",
    },
    async () => {
      try {
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();
        const activeWalletId = await walletManager.getActiveWalletId();
        const hasWallets = await walletManager.hasWallets();
        const hasMnemonic = !!process.env.CLIENT_MNEMONIC;

        // Determine source and ready state
        let readyForTransactions = false;
        let message: string;
        let nextAction: string | null = null;

        if (sessionInfo) {
          readyForTransactions = true;
          message = "I have a wallet and it's unlocked. I can perform transactions.";
        } else if (hasMnemonic) {
          readyForTransactions = true;
          message = "I have a wallet configured and I'm ready to perform transactions.";
        } else if (hasWallets) {
          message = "I have a wallet but it's locked. Please unlock it so I can perform transactions.";
          nextAction = "Use wallet_unlock with the wallet password.";
        } else {
          message = "I don't have a wallet yet. Please assign me one so I can perform transactions.";
          nextAction = "Use wallet_create to give me a new wallet, or wallet_import to assign an existing one.";
        }

        // Get active wallet info if exists
        let activeWallet = null;
        if (activeWalletId) {
          const wallets = await walletManager.listWallets();
          const wallet = wallets.find((w) => w.id === activeWalletId);
          if (wallet) {
            activeWallet = {
              id: wallet.id,
              name: wallet.name,
              btcAddress: wallet.btcAddress,
              address: wallet.address,
              network: wallet.network,
            };
          }
        }

        // Build response
        const response: Record<string, unknown> = {
          message,
          readyForTransactions,
          isUnlocked: !!sessionInfo,
          currentNetwork: NETWORK,
        };

        if (sessionInfo) {
          response.wallet = {
            id: sessionInfo.walletId,
            btcAddress: sessionInfo.btcAddress,
            address: sessionInfo.address,
            sessionExpiresAt: sessionInfo.expiresAt?.toISOString() || "never",
          };
        } else if (activeWallet) {
          response.wallet = activeWallet;
        }

        if (hasWallets && !sessionInfo && !hasMnemonic) {
          const wallets = await walletManager.listWallets();
          response.availableWallets = wallets.map((w) => ({
            id: w.id,
            name: w.name,
            btcAddress: w.btcAddress,
            address: w.address,
          }));
        }

        if (nextAction) {
          response.nextAction = nextAction;
        }

        return createJsonResponse(response);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
