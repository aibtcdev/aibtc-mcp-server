import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { getExplorerTxUrl, getExplorerAddressUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

/**
 * Format micro-STX to STX with appropriate decimal places.
 * Uses BigInt arithmetic to avoid floating-point precision loss.
 */
function formatStx(microStx: number | bigint): string {
  const micro = typeof microStx === "bigint" ? microStx : BigInt(Math.round(microStx));
  const whole = micro / 1_000_000n;
  const fraction = micro % 1_000_000n;

  // Convert fractional micro-STX to a 6-digit decimal part, then trim trailing zeros
  const rawFractionStr = fraction.toString().padStart(6, "0");
  const trimmedFractionStr = rawFractionStr.replace(/0+$/, "");

  const stxStr =
    trimmedFractionStr.length > 0
      ? `${whole.toString()}.${trimmedFractionStr}`
      : whole.toString();

  return stxStr + " STX";
}

export function registerQueryTools(server: McpServer): void {
  // Get STX fee estimates
  server.registerTool(
    "get_stx_fees",
    {
      description:
        "Get current STX fee estimates for different priority levels. " +
        "Returns low, medium, and high fee tiers in micro-STX, based on mempool analysis.",
    },
    async () => {
      try {
        const hiro = getHiroApi(NETWORK);
        const fees = await hiro.getMempoolFees();

        // Use token_transfer fees as the default since they're most common
        // and provide a good baseline for STX operations
        const transferFees = fees.token_transfer;

        return createJsonResponse({
          network: NETWORK,
          fees: {
            low: {
              microStx: transferFees.low_priority,
              stx: formatStx(transferFees.low_priority),
              description: "Lower fee, may take longer to confirm",
            },
            medium: {
              microStx: transferFees.medium_priority,
              stx: formatStx(transferFees.medium_priority),
              description: "Standard fee, typical confirmation time",
            },
            high: {
              microStx: transferFees.high_priority,
              stx: formatStx(transferFees.high_priority),
              description: "Higher fee, faster confirmation",
            },
          },
          byTransactionType: {
            tokenTransfer: {
              low: transferFees.low_priority,
              medium: transferFees.medium_priority,
              high: transferFees.high_priority,
            },
            contractCall: {
              low: fees.contract_call.low_priority,
              medium: fees.contract_call.medium_priority,
              high: fees.contract_call.high_priority,
            },
            smartContract: {
              low: fees.smart_contract.low_priority,
              medium: fees.smart_contract.medium_priority,
              high: fees.smart_contract.high_priority,
            },
          },
          unit: "micro-STX",
          note: "1 STX = 1,000,000 micro-STX. Fees are estimates based on current mempool conditions.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get account info
  server.registerTool(
    "get_account_info",
    {
      description: "Get detailed account information including nonce and balance.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Stacks address. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const info = await hiro.getAccountInfo(walletAddress);

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          nonce: info.nonce,
          balance: info.balance,
          explorerUrl: getExplorerAddressUrl(walletAddress, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get account transactions
  server.registerTool(
    "get_account_transactions",
    {
      description: "Get transaction history for an account.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Stacks address. Uses configured wallet if not provided."),
        limit: z.number().optional().default(20).describe("Maximum number of results"),
        offset: z.number().optional().default(0).describe("Offset for pagination"),
      },
    },
    async ({ address, limit, offset }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const result = await hiro.getAccountTransactions(walletAddress, { limit, offset });

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          transactions: result.results.map((tx) => ({
            txId: tx.tx_id,
            type: tx.tx_type,
            status: tx.tx_status,
            sender: tx.sender_address,
            blockHeight: tx.block_height,
            fee: tx.fee_rate,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get block info
  server.registerTool(
    "get_block_info",
    {
      description: "Get information about a specific block.",
      inputSchema: {
        heightOrHash: z.string().describe("Block height (number) or block hash"),
      },
    },
    async ({ heightOrHash }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const isHeight = /^\d+$/.test(heightOrHash);

        const block = isHeight
          ? await hiro.getBlockByHeight(parseInt(heightOrHash, 10))
          : await hiro.getBlockByHash(heightOrHash);

        return createJsonResponse({
          network: NETWORK,
          hash: block.hash,
          height: block.height,
          canonical: block.canonical,
          burnBlockHeight: block.burn_block_height,
          burnBlockTime: block.burn_block_time,
          txCount: block.txs.length,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get mempool info
  server.registerTool(
    "get_mempool_info",
    {
      description: "Get pending transactions in the mempool.",
      inputSchema: {
        senderAddress: z.string().optional().describe("Filter by sender address"),
        limit: z.number().optional().default(20).describe("Maximum number of results"),
        offset: z.number().optional().default(0).describe("Offset for pagination"),
      },
    },
    async ({ senderAddress, limit, offset }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const result = await hiro.getMempoolTransactions({
          sender_address: senderAddress,
          limit,
          offset,
        });

        return createJsonResponse({
          network: NETWORK,
          total: result.total,
          transactions: result.results.map((tx) => ({
            txId: tx.tx_id,
            type: tx.tx_type,
            sender: tx.sender_address,
            fee: tx.fee_rate,
            nonce: tx.nonce,
            receiptTime: tx.receipt_time_iso,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get contract info
  server.registerTool(
    "get_contract_info",
    {
      description: "Get information about a smart contract including its ABI.",
      inputSchema: {
        contractId: z.string().describe("Contract ID in format: address.contract-name"),
      },
    },
    async ({ contractId }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const info = await hiro.getContractInfo(contractId);
        const iface = await hiro.getContractInterface(contractId);

        return createJsonResponse({
          contractId,
          network: NETWORK,
          txId: info.tx_id,
          blockHeight: info.block_height,
          functions: iface.functions.map((f) => ({
            name: f.name,
            access: f.access,
            args: f.args,
            outputs: f.outputs,
          })),
          variables: iface.variables,
          maps: iface.maps,
          fungibleTokens: iface.fungible_tokens,
          nonFungibleTokens: iface.non_fungible_tokens,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get contract events
  server.registerTool(
    "get_contract_events",
    {
      description: "Get events emitted by a smart contract.",
      inputSchema: {
        contractId: z.string().describe("Contract ID in format: address.contract-name"),
        limit: z.number().optional().default(20).describe("Maximum number of results"),
        offset: z.number().optional().default(0).describe("Offset for pagination"),
      },
    },
    async ({ contractId, limit, offset }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const result = await hiro.getContractEvents(contractId, { limit, offset });

        return createJsonResponse({
          contractId,
          network: NETWORK,
          events: result.results,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get network status
  server.registerTool(
    "get_network_status",
    {
      description: "Get the current status of the Stacks network.",
    },
    async () => {
      try {
        const hiro = getHiroApi(NETWORK);
        const status = await hiro.getNetworkStatus();
        const coreInfo = await hiro.getCoreApiInfo();

        return createJsonResponse({
          network: NETWORK,
          serverVersion: status.server_version,
          status: status.status,
          chainTip: status.chain_tip,
          coreInfo: {
            peerVersion: coreInfo.peer_version,
            stacksTipHeight: coreInfo.stacks_tip_height,
            burnBlockHeight: coreInfo.burn_block_height,
            networkId: coreInfo.network_id,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
