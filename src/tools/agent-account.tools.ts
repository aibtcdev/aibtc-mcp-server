// AIBTC Agent Account (aibtc-acct) MCP tools.
//
// Two-role smart wallet: ACCOUNT_OWNER (full control, every withdrawal routes
// here) and ACCOUNT_AGENT (bit-gated). The MCP's active wallet acts as the
// agent (or the owner). Accounts are created by AIBTC; these tools operate an
// existing account. All writes are signed headlessly by the MCP wallet through
// callContract, so they are metered by the spending limit.
//
//   - Agent actions (deposit, withdraw, approve/revoke, buy/sell dao token,
//     action proposals): allowed when the matching permission flag is set.
//   - Owner-only actions (set-agent-can-*): only succeed if the MCP wallet is
//     the account OWNER.
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  cvToJSON,
  hexToCV,
  uintCV,
  principalCV,
  boolCV,
  bufferCV,
  stringAsciiCV,
  someCV,
  noneCV,
  PostConditionMode,
  type PostCondition,
  type ClarityValue,
} from "@stacks/transactions";
import { getWalletManager } from "../services/wallet-manager.js";
import { getHiroApi } from "../services/hiro-api.js";
import { getAccount } from "../services/x402.service.js";
import { callContract, type Account } from "../transactions/builder.js";
import type { CallerSpendCaps } from "../services/spend-limiter.js";
import {
  createStxPostCondition,
  createContractStxPostCondition,
  createFungiblePostCondition,
  createContractFungiblePostCondition,
} from "../transactions/post-conditions.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";
import { NETWORK, getExplorerTxUrl, type Network } from "../config/networks.js";
import { PERMISSION_SETTERS, APPROVAL_TYPES } from "../config/agent-account.js";

// Reduce a cvToJSON-decoded tuple to a flat { field: value } object.
function flattenTuple(decoded: { value?: Record<string, { value?: unknown }> }): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(decoded.value ?? {})) {
    out[key] = entry && typeof entry === "object" && "value" in entry ? entry.value : entry;
  }
  return out;
}

function splitContractId(contractId: string): { address: string; name: string } {
  const dot = contractId.indexOf(".");
  if (dot < 0) throw new Error(`Invalid contract id (expected "SP….name"): ${contractId}`);
  return { address: contractId.slice(0, dot), name: contractId.slice(dot + 1) };
}

// The fungible-token asset name a SIP-010 contract defines, for an exact post condition.
async function fungibleAssetName(token: string, network: Network): Promise<string> {
  const iface = await getHiroApi(network).getContractInterface(token);
  const name = iface.fungible_tokens?.[0]?.name;
  if (!name) throw new Error(`${token} defines no fungible token`);
  return name;
}

// Sign and broadcast a call on the agent account with the MCP's active wallet.
async function signAgentCall(
  account: Account,
  params: {
    accountContract: string;
    functionName: string;
    functionArgs: ClarityValue[];
    postConditions?: PostCondition[];
    postConditionMode?: PostConditionMode;
    callerSpendCaps?: CallerSpendCaps;
    fee?: string;
  }
) {
  const { address, name } = splitContractId(params.accountContract);
  const resolvedFee = await resolveFee(params.fee, account.network, "contract_call");
  const result = await callContract(account, {
    contractAddress: address,
    contractName: name,
    functionName: params.functionName,
    functionArgs: params.functionArgs,
    postConditionMode: params.postConditionMode ?? PostConditionMode.Deny,
    ...(params.postConditions && { postConditions: params.postConditions }),
    ...(params.callerSpendCaps && { callerSpendCaps: params.callerSpendCaps }),
    ...(resolvedFee !== undefined && { fee: resolvedFee }),
  });
  return {
    success: true,
    txid: result.txid,
    contract: params.accountContract,
    function: params.functionName,
    sender: account.address,
    network: account.network,
    explorerUrl: getExplorerTxUrl(result.txid, account.network),
  };
}

const feeSchema = z
  .string()
  .optional()
  .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. Defaults to medium.");
const accountSchema = z.string().describe("Deployed agent-account contract id, e.g. SP....aibtc-acct-...");
const uintSchema = (what: string) => z.string().regex(/^\d+$/, "must be a non-negative integer").describe(what);

export function registerAgentAccountTools(server: McpServer): void {
  // ---- Asset management -----------------------------------------------------
  server.registerTool(
    "agent_account_deposit_stx",
    {
      description:
        "Deposit STX from the MCP's active wallet into an agent account. Requires the manage-assets " +
        "permission (granted by default).",
      inputSchema: z.object({
        accountContract: accountSchema,
        amount: uintSchema("Amount in micro-STX (1 STX = 1,000,000)."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, amount, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "deposit-stx",
            functionArgs: [uintCV(amount)],
            postConditions: [createStxPostCondition(account.address, "eq", BigInt(amount))],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_deposit_ft",
    {
      description:
        "Deposit a SIP-010 fungible token from the MCP's active wallet into an agent account. Requires the " +
        "manage-assets permission. The exact amount is pinned by a post condition.",
      inputSchema: z.object({
        accountContract: accountSchema,
        token: z.string().describe("SIP-010 token contract id, e.g. SP....token-x"),
        amount: uintSchema("Amount in the token's base units."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, token, amount, fee }) => {
      try {
        const account = await getAccount();
        const assetName = await fungibleAssetName(token, account.network);
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "deposit-ft",
            functionArgs: [principalCV(token), uintCV(amount)],
            postConditions: [createFungiblePostCondition(account.address, token, assetName, "eq", BigInt(amount))],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_withdraw_stx",
    {
      description:
        "Withdraw STX from an agent account. Funds always go to the account OWNER, not the agent. " +
        "Requires the manage-assets permission.",
      inputSchema: z.object({
        accountContract: accountSchema,
        amount: uintSchema("Amount in micro-STX (1 STX = 1,000,000)."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, amount, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "withdraw-stx",
            functionArgs: [uintCV(amount)],
            postConditions: [createContractStxPostCondition(accountContract, "eq", BigInt(amount))],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_withdraw_ft",
    {
      description:
        "Withdraw a SIP-010 fungible token from an agent account to the OWNER. The token must be on the " +
        "account's allowlist (type=token; sBTC is approved at deploy). Requires the manage-assets permission.",
      inputSchema: z.object({
        accountContract: accountSchema,
        token: z.string().describe("SIP-010 token contract id, e.g. SP....token-x"),
        amount: uintSchema("Amount in the token's base units."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, token, amount, fee }) => {
      try {
        const account = await getAccount();
        const assetName = await fungibleAssetName(token, account.network);
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "withdraw-ft",
            functionArgs: [principalCV(token), uintCV(amount)],
            postConditions: [
              createContractFungiblePostCondition(accountContract, token, assetName, "eq", BigInt(amount)),
            ],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---- Allowlist ------------------------------------------------------------
  server.registerTool(
    "agent_account_approve_contract",
    {
      description:
        "Add a contract to the agent account's allowlist. Requires the approve-revoke-contracts permission " +
        "(granted by default). Types: voting (proposals), swap (DEX adapter), token (SIP-010).",
      inputSchema: z.object({
        accountContract: accountSchema,
        targetContract: z.string().describe("Contract principal to approve."),
        approvalType: z.enum(["voting", "swap", "token"]),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, targetContract, approvalType, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "approve-contract",
            functionArgs: [principalCV(targetContract), uintCV(APPROVAL_TYPES[approvalType])],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_revoke_contract",
    {
      description:
        "Remove a contract from the agent account's allowlist. Requires the approve-revoke-contracts permission.",
      inputSchema: z.object({
        accountContract: accountSchema,
        targetContract: z.string().describe("Contract principal to revoke."),
        approvalType: z.enum(["voting", "swap", "token"]),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, targetContract, approvalType, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "revoke-contract",
            functionArgs: [principalCV(targetContract), uintCV(APPROVAL_TYPES[approvalType])],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---- DAO token trading ----------------------------------------------------
  // The swap runs as-contract, so the account's funds move, never the caller's.
  // Allow mode lets the adapter move several assets; the caller's own STX/sBTC
  // is capped at zero on chain.
  const NO_CALLER_SPEND: CallerSpendCaps = { ustx: 0n, sats: 0n };

  server.registerTool(
    "agent_account_buy_dao_token",
    {
      description:
        "Buy a DAO token through an approved swap adapter with the agent account's funds. Requires the " +
        "buy-sell-assets permission (off by default), the adapter on the allowlist (type=swap) and the DAO " +
        "token on the allowlist (type=token). Runs in allow mode; the caller's own STX/sBTC is capped at 0.",
      inputSchema: z.object({
        accountContract: accountSchema,
        swapAdapter: z.string().describe("Approved swap adapter contract id (dao-swap-adapter trait)."),
        daoToken: z.string().describe("DAO token contract id (ft-trait)."),
        amount: uintSchema("Amount to spend, in base units."),
        minReceive: uintSchema("Optional minimum tokens to receive (slippage guard).").optional(),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, swapAdapter, daoToken, amount, minReceive, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "buy-dao-token",
            functionArgs: [
              principalCV(swapAdapter),
              principalCV(daoToken),
              uintCV(amount),
              minReceive ? someCV(uintCV(minReceive)) : noneCV(),
            ],
            postConditionMode: PostConditionMode.Allow,
            callerSpendCaps: NO_CALLER_SPEND,
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_sell_dao_token",
    {
      description:
        "Sell a DAO token through an approved swap adapter from the agent account. Requires the " +
        "buy-sell-assets permission (off by default), the adapter on the allowlist (type=swap) and the DAO " +
        "token on the allowlist (type=token). Runs in allow mode; the caller's own STX/sBTC is capped at 0.",
      inputSchema: z.object({
        accountContract: accountSchema,
        swapAdapter: z.string().describe("Approved swap adapter contract id (dao-swap-adapter trait)."),
        daoToken: z.string().describe("DAO token contract id (ft-trait)."),
        amount: uintSchema("Amount of DAO token to sell, in base units."),
        minReceive: uintSchema("Optional minimum to receive (slippage guard).").optional(),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, swapAdapter, daoToken, amount, minReceive, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "sell-dao-token",
            functionArgs: [
              principalCV(swapAdapter),
              principalCV(daoToken),
              uintCV(amount),
              minReceive ? someCV(uintCV(minReceive)) : noneCV(),
            ],
            postConditionMode: PostConditionMode.Allow,
            callerSpendCaps: NO_CALLER_SPEND,
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---- DAO action proposals -------------------------------------------------
  server.registerTool(
    "agent_account_create_action_proposal",
    {
      description:
        "Create a DAO action proposal through an approved voting contract. Requires the use-proposals " +
        "permission and the voting contract on the allowlist (type=voting).",
      inputSchema: z.object({
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        action: z.string().describe("Action contract id (the action to execute)."),
        parameters: z
          .string()
          .regex(/^(0x)?([0-9a-fA-F]{2}){0,2048}$/, "must be even-length hex, at most 2048 bytes")
          .describe("Action parameters as a hex buffer (max 2048 bytes), e.g. 0x... ."),
        memo: z.string().max(1024).optional().describe("Optional memo (max 1024 ASCII chars)."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, votingContract, action, parameters, memo, fee }) => {
      try {
        const account = await getAccount();
        const paramBuf = Buffer.from(parameters.replace(/^0x/, ""), "hex");
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "create-action-proposal",
            functionArgs: [
              principalCV(votingContract),
              principalCV(action),
              bufferCV(paramBuf),
              memo ? someCV(stringAsciiCV(memo)) : noneCV(),
            ],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_vote_action_proposal",
    {
      description:
        "Vote on a DAO action proposal through an approved voting contract. Requires the use-proposals permission.",
      inputSchema: z.object({
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        proposalId: uintSchema("Proposal id (uint)."),
        vote: z.boolean().describe("true = for, false = against."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, votingContract, proposalId, vote, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "vote-on-action-proposal",
            functionArgs: [principalCV(votingContract), uintCV(proposalId), boolCV(vote)],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_conclude_action_proposal",
    {
      description:
        "Conclude a DAO action proposal through an approved voting contract. Requires the use-proposals permission.",
      inputSchema: z.object({
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        proposalId: uintSchema("Proposal id (uint)."),
        action: z.string().describe("Action contract id (must match the proposal's action)."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, votingContract, proposalId, action, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "conclude-action-proposal",
            functionArgs: [principalCV(votingContract), uintCV(proposalId), principalCV(action)],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_veto_action_proposal",
    {
      description:
        "Veto a DAO action proposal through an approved voting contract. Requires the use-proposals permission.",
      inputSchema: z.object({
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        proposalId: uintSchema("Proposal id (uint)."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, votingContract, proposalId, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: "veto-action-proposal",
            functionArgs: [principalCV(votingContract), uintCV(proposalId)],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---- Owner-only: set agent permission -------------------------------------
  server.registerTool(
    "agent_account_set_permission",
    {
      description:
        "Grant or revoke one of the agent's permission flags. OWNER-ONLY: this only succeeds if the MCP's " +
        "active wallet is the account owner (otherwise the contract rejects it with u1100). Permissions: " +
        "manage-assets, use-proposals, approve-revoke-contracts, buy-sell-assets.",
      inputSchema: z.object({
        accountContract: accountSchema,
        permission: z.enum([
          "manage-assets",
          "use-proposals",
          "approve-revoke-contracts",
          "buy-sell-assets",
        ]),
        enabled: z.boolean().describe("true to grant, false to revoke."),
        fee: feeSchema,
      }),
    },
    async ({ accountContract, permission, enabled, fee }) => {
      try {
        const account = await getAccount();
        return createJsonResponse(
          await signAgentCall(account, {
            accountContract,
            functionName: PERMISSION_SETTERS[permission],
            functionArgs: [boolCV(enabled)],
            fee,
          })
        );
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---- Read-only: config + permissions --------------------------------------
  server.registerTool(
    "agent_account_get_config",
    {
      description:
        "Read an agent account's configuration (owner, agent, account principal, sBTC token) and the agent's " +
        "current permission flags. Read-only — no wallet or signing required.",
      inputSchema: z.object({
        accountContract: accountSchema,
      }),
    },
    async ({ accountContract }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const sender = getWalletManager().getActiveAccount()?.address || splitContractId(accountContract).address;
        const [cfg, perms] = await Promise.all([
          hiro.callReadOnlyFunction(accountContract, "get-configuration", [], sender),
          hiro.callReadOnlyFunction(accountContract, "get-agent-permissions", [], sender),
        ]);
        for (const [fn, res] of [["get-configuration", cfg], ["get-agent-permissions", perms]] as const) {
          if (!res.okay || !res.result) {
            throw new Error(`${accountContract}.${fn} failed${res.cause ? `: ${res.cause}` : ""}`);
          }
        }
        return createJsonResponse({
          accountContract,
          network: NETWORK,
          configuration: flattenTuple(cvToJSON(hexToCV(cfg.result!))),
          agentPermissions: flattenTuple(cvToJSON(hexToCV(perms.result!))),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
