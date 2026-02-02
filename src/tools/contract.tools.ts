import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PostConditionMode } from "@stacks/transactions";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { callContract, deployContract } from "../transactions/builder.js";
import { parseArgToClarityValue } from "../transactions/clarity-values.js";
import { getHiroApi, getTransactionStatus } from "../services/hiro-api.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

export function registerContractTools(server: McpServer): void {
  // Call contract
  server.registerTool(
    "call_contract",
    {
      description: `Call a function on a Stacks smart contract. Signs and broadcasts the transaction.

For typed arguments, use objects like {type: 'uint', value: 100} or {type: 'principal', value: 'SP...'}`,
      inputSchema: {
        contractAddress: z.string().describe("The contract deployer's address (e.g., SP2...)"),
        contractName: z.string().describe("The contract name (e.g., 'my-token')"),
        functionName: z.string().describe("The function to call (e.g., 'transfer')"),
        functionArgs: z
          .array(z.unknown())
          .default([])
          .describe("Function arguments. For explicit types: {type: 'uint'|'int'|'principal'|..., value: ...}"),
        postConditionMode: z
          .enum(["allow", "deny"])
          .default("deny")
          .describe("'deny' (default): Blocks unexpected transfers. 'allow': Permits any transfers."),
        fee: z
          .string()
          .optional()
          .describe("Optional fee in micro-STX. If omitted, fee is auto-estimated. Example: '100000' for 0.1 STX"),
      },
    },
    async ({ contractAddress, contractName, functionName, functionArgs, postConditionMode, fee }) => {
      try {
        const account = await getAccount();
        const clarityArgs = functionArgs.map(parseArgToClarityValue);

        const result = await callContract(account, {
          contractAddress,
          contractName,
          functionName,
          functionArgs: clarityArgs,
          postConditionMode:
            postConditionMode === "allow" ? PostConditionMode.Allow : PostConditionMode.Deny,
          ...(fee !== undefined && { fee: BigInt(fee) }),
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          contract: `${contractAddress}.${contractName}`,
          function: functionName,
          args: functionArgs,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Deploy contract
  server.registerTool(
    "deploy_contract",
    {
      description: "Deploy a Clarity smart contract to the Stacks blockchain.",
      inputSchema: {
        contractName: z.string().describe("Unique name for the contract (lowercase, hyphens allowed)"),
        codeBody: z.string().describe("The complete Clarity source code"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee in micro-STX. If omitted, fee is auto-estimated. Example: '100000' for 0.1 STX"),
      },
    },
    async ({ contractName, codeBody, fee }) => {
      try {
        const account = await getAccount();
        const result = await deployContract(account, {
          contractName,
          codeBody,
          ...(fee !== undefined && { fee: BigInt(fee) }),
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          contractId: `${account.address}.${contractName}`,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get transaction status
  server.registerTool(
    "get_transaction_status",
    {
      description: "Check the status of a Stacks transaction by its txid.",
      inputSchema: {
        txid: z.string().describe("The transaction ID (64 character hex string)"),
      },
    },
    async ({ txid }) => {
      try {
        const status = await getTransactionStatus(txid, NETWORK);

        return createJsonResponse({
          txid,
          ...status,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Call read-only function
  server.registerTool(
    "call_read_only_function",
    {
      description: "Call a read-only function on a smart contract (no signing required).",
      inputSchema: {
        contractId: z.string().describe("Contract ID in format: address.contract-name"),
        functionName: z.string().describe("The read-only function to call"),
        functionArgs: z
          .array(z.unknown())
          .default([])
          .describe("Function arguments. For explicit types: {type: 'uint'|'int'|'principal'|..., value: ...}"),
        senderAddress: z.string().optional().describe("Optional sender address for the call"),
      },
    },
    async ({ contractId, functionName, functionArgs, senderAddress }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const clarityArgs = functionArgs.map(parseArgToClarityValue);
        const sender = senderAddress || contractId.split(".")[0];

        const result = await hiro.callReadOnlyFunction(contractId, functionName, clarityArgs, sender);

        return createJsonResponse({
          contractId,
          function: functionName,
          result: result.result,
          okay: result.okay,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
