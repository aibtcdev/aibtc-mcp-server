import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PostConditionMode, PostCondition } from "@stacks/transactions";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { callContract, deployContract, type TransferResult } from "../transactions/builder.js";
import { sponsoredContractCall, sponsoredContractDeploy } from "../transactions/sponsor-builder.js";
import { parseArgToClarityValue } from "../transactions/clarity-values.js";
import { getHiroApi, getTransactionStatus } from "../services/hiro-api.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";
import { sponsoredSchema } from "./schemas.js";
import {
  createStxPostCondition,
  createContractStxPostCondition,
  createFungiblePostCondition,
  createContractFungiblePostCondition,
  createNftSendPostCondition,
  createNftNotSendPostCondition,
} from "../transactions/post-conditions.js";

/**
 * Parse a post condition descriptor from JSON to a PostCondition object
 */
function parsePostCondition(pc: unknown): PostCondition {
  if (typeof pc !== "object" || pc === null) {
    throw new Error("Post condition must be an object");
  }

  const condition = pc as Record<string, unknown>;
  const { type, principal, conditionCode, amount, asset, assetName, tokenId, notSend } = condition;

  if (typeof principal !== "string") {
    throw new Error("Post condition 'principal' must be a string");
  }

  const validConditionCodes = ["eq", "gt", "gte", "lt", "lte"];

  if (type === "stx") {
    if (typeof amount !== "string" && typeof amount !== "number") {
      throw new Error("STX post condition 'amount' must be a string or number");
    }
    if (typeof conditionCode !== "string" || !validConditionCodes.includes(conditionCode)) {
      throw new Error(`STX post condition 'conditionCode' must be one of: ${validConditionCodes.join(", ")}`);
    }
    const amountBigInt = BigInt(amount);
    const code = conditionCode as "eq" | "gt" | "gte" | "lt" | "lte";

    // Check if principal is a contract (contains a dot)
    if (principal.includes(".")) {
      return createContractStxPostCondition(principal, code, amountBigInt);
    }
    return createStxPostCondition(principal, code, amountBigInt);
  }

  if (type === "ft") {
    if (typeof asset !== "string") {
      throw new Error("FT post condition 'asset' must be a string (contract ID)");
    }
    if (typeof assetName !== "string") {
      throw new Error("FT post condition 'assetName' must be a string (token name)");
    }
    if (typeof amount !== "string" && typeof amount !== "number") {
      throw new Error("FT post condition 'amount' must be a string or number");
    }
    if (typeof conditionCode !== "string" || !validConditionCodes.includes(conditionCode)) {
      throw new Error(`FT post condition 'conditionCode' must be one of: ${validConditionCodes.join(", ")}`);
    }
    const amountBigInt = BigInt(amount);
    const code = conditionCode as "eq" | "gt" | "gte" | "lt" | "lte";

    // Check if principal is a contract (contains a dot)
    if (principal.includes(".")) {
      return createContractFungiblePostCondition(principal, asset, assetName, code, amountBigInt);
    }
    return createFungiblePostCondition(principal, asset, assetName, code, amountBigInt);
  }

  if (type === "nft") {
    if (typeof asset !== "string") {
      throw new Error("NFT post condition 'asset' must be a string (contract ID)");
    }
    if (typeof assetName !== "string") {
      throw new Error("NFT post condition 'assetName' must be a string (NFT name)");
    }
    if (typeof tokenId !== "string" && typeof tokenId !== "number") {
      throw new Error("NFT post condition 'tokenId' must be a string or number");
    }
    let tokenIdBigInt: bigint;
    try {
      tokenIdBigInt = BigInt(tokenId);
    } catch {
      throw new Error(`NFT post condition 'tokenId' must be a valid integer, got: ${tokenId}`);
    }

    if (notSend === true) {
      return createNftNotSendPostCondition(principal, asset, assetName, tokenIdBigInt);
    }
    return createNftSendPostCondition(principal, asset, assetName, tokenIdBigInt);
  }

  throw new Error(`Invalid post condition type: ${type}. Must be 'stx', 'ft', or 'nft'.`);
}

export function registerContractTools(server: McpServer): void {
  // Call contract
  server.registerTool(
    "call_contract",
    {
      description: `Call a function on a Stacks smart contract. Signs and broadcasts the transaction.

For typed arguments, use objects like {type: 'uint', value: 100} or {type: 'principal', value: 'SP...'}

Post conditions constrain what assets the transaction can move. Each condition is an object:
- STX: {type: 'stx', principal: 'SP...', conditionCode: 'eq'|'gt'|'gte'|'lt'|'lte', amount: '1000000'}
- FT: {type: 'ft', principal: 'SP...', asset: 'SP...contract', assetName: 'token-name', conditionCode: 'eq', amount: '1000'}
- NFT: {type: 'nft', principal: 'SP...', asset: 'SP...contract', assetName: 'nft-name', tokenId: '1', notSend?: boolean}`,
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
        postConditions: z
          .array(z.unknown())
          .optional()
          .describe("Optional post conditions to constrain asset movements. See description for format."),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated. Ignored when sponsored=true."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ contractAddress, contractName, functionName, functionArgs, postConditionMode, postConditions, fee, sponsored }) => {
      try {
        const account = await getAccount();
        const clarityArgs = functionArgs.map(parseArgToClarityValue);

        // Parse post conditions if provided
        const parsedPostConditions = postConditions
          ? postConditions.map(parsePostCondition)
          : undefined;

        const contractCallOptions = {
          contractAddress,
          contractName,
          functionName,
          functionArgs: clarityArgs,
          postConditionMode:
            postConditionMode === "allow" ? PostConditionMode.Allow : PostConditionMode.Deny,
          ...(parsedPostConditions && { postConditions: parsedPostConditions }),
        };

        let result: TransferResult;
        if (sponsored) {
          // Sponsored: relay pays gas fees, so fee parameter is ignored
          result = await sponsoredContractCall(account, contractCallOptions, NETWORK);
        } else {
          const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
          result = await callContract(account, {
            ...contractCallOptions,
            ...(resolvedFee !== undefined && { fee: resolvedFee }),
          });
        }

        return createJsonResponse({
          success: true,
          txid: result.txid,
          contract: `${contractAddress}.${contractName}`,
          function: functionName,
          args: functionArgs,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          ...(sponsored && { sponsored: true }),
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
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated. Ignored when sponsored=true."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ contractName, codeBody, fee, sponsored }) => {
      try {
        const account = await getAccount();

        let result: TransferResult;
        if (sponsored) {
          // Sponsored: relay pays gas fees, so fee parameter is ignored
          result = await sponsoredContractDeploy(account, { contractName, codeBody }, NETWORK);
        } else {
          const resolvedFee = await resolveFee(fee, NETWORK, "smart_contract");
          result = await deployContract(account, {
            contractName,
            codeBody,
            ...(resolvedFee !== undefined && { fee: resolvedFee }),
          });
        }

        return createJsonResponse({
          success: true,
          txid: result.txid,
          contractId: `${account.address}.${contractName}`,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          ...(sponsored && { sponsored: true }),
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
