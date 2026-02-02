import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getNftService } from "../services/nft.service.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";

export function registerNftTools(server: McpServer): void {
  // Get NFT holdings
  server.registerTool(
    "get_nft_holdings",
    {
      description: "List all NFTs owned by an address.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Wallet address to check. Uses configured wallet if not provided."),
        contractId: z.string().optional().describe("Filter by specific NFT collection contract"),
        limit: z.number().optional().default(20).describe("Maximum number of results"),
        offset: z.number().optional().default(0).describe("Offset for pagination"),
      },
    },
    async ({ address, contractId, limit, offset }) => {
      try {
        const nftService = getNftService(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const result = await nftService.getHoldings(walletAddress, { limit, offset, contractId });

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          total: result.total,
          nfts: result.nfts.map((nft) => ({
            collection: nft.asset_identifier,
            tokenId: nft.value.repr,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get NFT metadata
  server.registerTool(
    "get_nft_metadata",
    {
      description: "Get metadata for a specific NFT (SIP-016).",
      inputSchema: {
        contractId: z.string().describe("NFT collection contract ID"),
        tokenId: z.number().describe("Token ID of the NFT"),
      },
    },
    async ({ contractId, tokenId }) => {
      try {
        const nftService = getNftService(NETWORK);
        const metadata = await nftService.getMetadata(contractId, tokenId);

        return createJsonResponse({
          contractId,
          tokenId,
          network: NETWORK,
          metadata,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Transfer NFT
  server.registerTool(
    "transfer_nft",
    {
      description: "Transfer an NFT (SIP-009) to a recipient address.",
      inputSchema: {
        contractId: z.string().describe("NFT collection contract ID"),
        tokenId: z.number().describe("Token ID of the NFT to transfer"),
        recipient: z.string().describe("The recipient's Stacks address"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated."),
      },
    },
    async ({ contractId, tokenId, recipient, fee }) => {
      try {
        const nftService = getNftService(NETWORK);
        const account = await getAccount();
        const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
        const result = await nftService.transfer(account, contractId, tokenId, recipient, resolvedFee);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          from: account.address,
          recipient,
          contractId,
          tokenId,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get NFT owner
  server.registerTool(
    "get_nft_owner",
    {
      description: "Get the current owner of a specific NFT.",
      inputSchema: {
        contractId: z.string().describe("NFT collection contract ID"),
        tokenId: z.number().describe("Token ID of the NFT"),
      },
    },
    async ({ contractId, tokenId }) => {
      try {
        const nftService = getNftService(NETWORK);
        const walletAddress = await getWalletAddress();
        const owner = await nftService.getOwner(contractId, tokenId, walletAddress);

        return createJsonResponse({
          contractId,
          tokenId,
          network: NETWORK,
          owner: owner || "Unknown",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get collection info
  server.registerTool(
    "get_collection_info",
    {
      description: "Get information about an NFT collection.",
      inputSchema: {
        contractId: z.string().describe("NFT collection contract ID"),
      },
    },
    async ({ contractId }) => {
      try {
        const nftService = getNftService(NETWORK);
        const info = await nftService.getCollectionInfo(contractId);

        return createJsonResponse({
          network: NETWORK,
          ...info,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get NFT history
  server.registerTool(
    "get_nft_history",
    {
      description: "Get the transfer history of NFTs in a collection.",
      inputSchema: {
        contractId: z.string().describe("NFT collection contract ID"),
        limit: z.number().optional().default(20).describe("Maximum number of results"),
        offset: z.number().optional().default(0).describe("Offset for pagination"),
      },
    },
    async ({ contractId, limit, offset }) => {
      try {
        const nftService = getNftService(NETWORK);
        const result = await nftService.getHistory(contractId, { limit, offset });

        return createJsonResponse({
          contractId,
          network: NETWORK,
          total: result.total,
          events: result.events,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
