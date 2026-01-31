import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWalletAddress, NETWORK, API_URL } from "../services/x402.service.js";
import { getStxBalance } from "../services/hiro-api.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";

export function registerWalletTools(server: McpServer): void {
  // Get wallet info
  server.registerTool(
    "get_wallet_info",
    {
      description:
        "Get the agent's wallet address and status. " +
        "If the agent doesn't have a wallet yet, provides guidance on how to assign one.",
    },
    async () => {
      try {
        const walletManager = getWalletManager();
        const hasWallets = await walletManager.hasWallets();
        const sessionInfo = walletManager.getSessionInfo();
        const hasMnemonic = !!process.env.CLIENT_MNEMONIC;

        // Try to get wallet address
        try {
          const stacksAddress = await getWalletAddress();
          const bitcoinAddress = sessionInfo?.bitcoinAddress;
          return createJsonResponse({
            status: "ready",
            message: "Wallet ready. Bitcoin and Stacks transactions enabled.",
            bitcoinAddress,
            stacksAddress,
            // Deprecated fields for backward compatibility
            address: stacksAddress,
            btcAddress: sessionInfo?.btcAddress,
            network: NETWORK,
            apiUrl: API_URL,
          });
        } catch {
          // No wallet available - provide helpful guidance
          if (hasWallets) {
            // Has wallets but not unlocked
            const wallets = await walletManager.listWallets();
            return createJsonResponse({
              status: "locked",
              message:
                "I have a wallet but it's locked. Please unlock it so I can perform transactions.",
              wallets: wallets.map((w) => ({
                id: w.id,
                name: w.name,
                bitcoinAddress: w.bitcoinAddress,
                stacksAddress: w.stacksAddress,
                // Deprecated fields for backward compatibility
                address: w.address,
                btcAddress: w.btcAddress,
                network: w.network,
              })),
              network: NETWORK,
              hint: "Use wallet_unlock with the wallet password to unlock.",
            });
          } else {
            // No wallets at all
            return createJsonResponse({
              status: "no_wallet",
              message:
                "I don't have a wallet yet. Would you like to assign me one? " +
                "You can create a fresh wallet for me or import an existing one.",
              network: NETWORK,
              options: [
                {
                  action: "wallet_create",
                  description:
                    "Create a new wallet for the agent (generates a secure 24-word mnemonic)",
                },
                {
                  action: "wallet_import",
                  description:
                    "Import an existing wallet for the agent to use",
                },
              ],
              hint: "Use wallet_create with a name and password to give me a wallet.",
            });
          }
        }
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get STX balance
  server.registerTool(
    "get_stx_balance",
    {
      description: "Get the STX balance for a wallet address.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Wallet address to check. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        const walletAddress = address || (await getWalletAddress());
        const balance = await getStxBalance(walletAddress, NETWORK);

        const stxBalance = (BigInt(balance.stx) / BigInt(1000000)).toString();
        const stxLocked = (BigInt(balance.stxLocked) / BigInt(1000000)).toString();

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          balance: {
            stx: stxBalance + " STX",
            microStx: balance.stx,
          },
          locked: {
            stx: stxLocked + " STX",
            microStx: balance.stxLocked,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
