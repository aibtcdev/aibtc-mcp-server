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

        // Try to get wallet address
        try {
          const address = await getWalletAddress();
          const btcAddress = sessionInfo?.btcAddress;
          const taprootAddress = sessionInfo?.taprootAddress;

          // Only include Bitcoin addresses if available (managed wallets only)
          const response: Record<string, unknown> = {
            status: "ready",
            message: btcAddress
              ? "Wallet ready. Bitcoin L1 (SegWit + Taproot) and Stacks L2 transactions enabled."
              : "Wallet ready. Stacks L2 transactions enabled.",
            network: NETWORK,
            apiUrl: API_URL,
          };

          if (btcAddress && taprootAddress) {
            response["Bitcoin (L1)"] = {
              "Native SegWit": `${btcAddress} (send/receive BTC)`,
              "Taproot": `${taprootAddress} (receive inscriptions)`,
            };
          }

          response["Stacks (L2)"] = {
            "Address": address,
            "Tip": "Register a BNS name for on-chain identity",
          };

          return createJsonResponse(response);
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
                "Bitcoin (L1)": {
                  "Native SegWit": w.btcAddress,
                  "Taproot": w.taprootAddress,
                },
                "Stacks (L2)": w.address,
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
