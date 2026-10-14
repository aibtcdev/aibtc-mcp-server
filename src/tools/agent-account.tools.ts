// AIBTC Agent Account (aibtc-acct) MCP tools.
//
// Two-role smart wallet: ACCOUNT_OWNER (full control, every withdrawal routes
// here) and ACCOUNT_AGENT (bit-gated). The MCP's active wallet acts as the
// agent (and as the deployer when creating an account). All writes are signed
// headlessly by the MCP wallet.
//
//   - Deploy: source is fetched from the AIBTC generator API (owner/agent
//     injected), then broadcast as a contract deploy by the MCP wallet.
//   - Agent actions (deposit, withdraw, approve/revoke, buy/sell dao token,
//     action proposals): signed directly; allowed by default permissions.
//   - Owner-only actions (set-agent-can-*): signed directly too, but the call
//     only succeeds if the MCP wallet is the account OWNER.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
import { callContract, deployContract, type Account } from "../transactions/builder.js";
import {
  createStxPostCondition,
  createContractStxPostCondition,
  createFungiblePostCondition,
  createContractFungiblePostCondition,
} from "../transactions/post-conditions.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";
import { NETWORK, getExplorerTxUrl } from "../config/networks.js";
import {
  referenceAgentAccount,
  agentAccountContractName,
  PERMISSION_SETTERS,
  APPROVAL_TYPES,
} from "../config/agent-account.js";

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

// Clone a deployed aibtc-acct's source and swap in a new owner/agent. Each
// account is a full contract whose only per-account difference is the two
// ACCOUNT_OWNER/ACCOUNT_AGENT constants; the name is set at deploy time and not
// embedded. Trait references come from the reference account, so it must be on
// the same network as the deploy.
function retemplateAgentAccount(source: string, owner: string, agent: string): string {
  const withOwner = source.replace(
    /(\(define-constant ACCOUNT_OWNER ')[0-9A-Z]+(\))/,
    `$1${owner}$2`
  );
  if (withOwner === source) {
    throw new Error("Reference source has no ACCOUNT_OWNER constant — wrong reference contract?");
  }
  const withAgent = withOwner.replace(
    /(\(define-constant ACCOUNT_AGENT ')[0-9A-Z]+(\))/,
    `$1${agent}$2`
  );
  if (withAgent === withOwner) {
    throw new Error("Reference source has no ACCOUNT_AGENT constant — wrong reference contract?");
  }
  return withAgent;
}

// Sign and broadcast an agent-side contract call with the MCP's active wallet.
async function signAgentCall(
  account: Account,
  params: {
    accountContract: string;
    functionName: string;
    functionArgs: ClarityValue[];
    postConditions?: PostCondition[];
    postConditionMode?: PostConditionMode;
    fee?: string;
  }
) {
  const { address, name } = splitContractId(params.accountContract);
  const resolvedFee = await resolveFee(params.fee, NETWORK, "contract_call");
  const result = await callContract(account, {
    contractAddress: address,
    contractName: name,
    functionName: params.functionName,
    functionArgs: params.functionArgs,
    postConditionMode: params.postConditionMode ?? PostConditionMode.Deny,
    ...(params.postConditions && { postConditions: params.postConditions }),
    ...(resolvedFee !== undefined && { fee: resolvedFee }),
  });
  return {
    success: true,
    txid: result.txid,
    contract: params.accountContract,
    function: params.functionName,
    agent: account.address,
    network: NETWORK,
    explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
  };
}

const feeSchema = z
  .string()
  .optional()
  .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. Defaults to medium.");
const accountSchema = z.string().describe("Deployed agent-account contract id, e.g. SP....aibtc-acct-...");

export function registerAgentAccountTools(server: McpServer): void {
  // ---- Deploy (generator API -> MCP wallet broadcasts) ----------------------
  server.registerTool(
    "agent_account_deploy",
    {
      description:
        "Deploy a new AIBTC agent account (aibtc-acct). Clones the source of a live agent account from chain, " +
        "swaps in your owner + agent, and broadcasts the deploy from the MCP's active wallet (the deployer). " +
        "The owner gets full control and receives every withdrawal; the agent (defaults to the MCP wallet) " +
        "gets bit-gated permissions. No external API — just Hiro to read the reference source. The MCP wallet " +
        "needs STX for the deploy fee.",
      inputSchema: {
        ownerAddress: z
          .string()
          .describe("Owner principal (SP.../ST...) — full control; all withdrawals route here."),
        agentAddress: z
          .string()
          .optional()
          .describe("Agent principal — the limited operator. Defaults to the MCP's active wallet."),
        referenceContract: z
          .string()
          .optional()
          .describe("Deployed aibtc-acct to clone source from (must match the deploy network). Defaults to a known account for the network."),
        fee: feeSchema,
      },
    },
    async ({ ownerAddress, agentAddress, referenceContract, fee }) => {
      try {
        const account = await getAccount();
        const network = account.network as "mainnet" | "testnet";
        const agent = agentAddress || account.address;
        const reference = referenceContract || referenceAgentAccount(network);
        if (!reference) {
          return createJsonResponse({
            success: false,
            message: `No reference agent account configured for ${network}. Pass referenceContract (a deployed aibtc-acct on ${network}) or set AGENT_ACCOUNT_REFERENCE_${network.toUpperCase()}.`,
          });
        }
        const { source } = await getHiroApi(network).getContractSource(reference);
        const templated = retemplateAgentAccount(source, ownerAddress, agent);
        const contractName = agentAccountContractName(ownerAddress, agent);
        const resolvedFee = await resolveFee(fee, NETWORK, "smart_contract");
        const result = await deployContract(account, {
          contractName,
          codeBody: templated,
          ...(resolvedFee !== undefined && { fee: resolvedFee }),
        });
        const contractId = `${account.address}.${contractName}`;
        return createJsonResponse({
          success: true,
          action: "deploy",
          owner: ownerAddress,
          agent,
          deployer: account.address,
          contract: contractId,
          clonedFrom: reference,
          txid: result.txid,
          network,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          message: `Deploying ${contractId} (cloned from ${reference}). Owner=${ownerAddress}, agent=${agent}. Once confirmed, use it as the accountContract for the other tools.`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ---- Asset management -----------------------------------------------------
  server.registerTool(
    "agent_account_deposit_stx",
    {
      description:
        "Deposit STX from the MCP's active wallet into a deployed agent account. Requires manage-assets " +
        "permission (granted by default).",
      inputSchema: {
        accountContract: accountSchema,
        amount: z.string().describe("Amount in micro-STX (1 STX = 1,000,000)."),
        fee: feeSchema,
      },
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
        "Deposit a SIP-010 fungible token from the MCP's active wallet into a deployed agent account. Provide " +
        "assetName (the token's fungible-token name) for an exact post-condition; without it the call runs in " +
        "allow mode.",
      inputSchema: {
        accountContract: accountSchema,
        token: z.string().describe("SIP-010 token contract id, e.g. SP....token-x"),
        amount: z.string().describe("Amount in the token's base units."),
        assetName: z.string().optional().describe("The token's fungible-token asset name (for a precise post-condition)."),
        fee: feeSchema,
      },
    },
    async ({ accountContract, token, amount, assetName, fee }) => {
      try {
        const account = await getAccount();
        const args = [principalCV(token), uintCV(amount)];
        if (assetName) {
          return createJsonResponse(
            await signAgentCall(account, {
              accountContract,
              functionName: "deposit-ft",
              functionArgs: args,
              postConditions: [createFungiblePostCondition(account.address, token, assetName, "eq", BigInt(amount))],
              fee,
            })
          );
        }
        return createJsonResponse({
          ...(await signAgentCall(account, {
            accountContract,
            functionName: "deposit-ft",
            functionArgs: args,
            postConditionMode: PostConditionMode.Allow,
            fee,
          })),
          warning: "Sent in allow mode (no post-condition). Pass assetName for a transfer guard.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "agent_account_withdraw_stx",
    {
      description:
        "Withdraw STX from a deployed agent account. Funds always go to the account OWNER, not the agent. " +
        "Signed by the MCP wallet; requires manage-assets permission.",
      inputSchema: {
        accountContract: accountSchema,
        amount: z.string().describe("Amount in micro-STX (1 STX = 1,000,000)."),
        fee: feeSchema,
      },
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
        "Withdraw a SIP-010 fungible token from a deployed agent account to the OWNER. The token must be on " +
        "the account's allowlist (type=token). Provide assetName for an exact post-condition; without it the " +
        "call runs in allow mode.",
      inputSchema: {
        accountContract: accountSchema,
        token: z.string().describe("SIP-010 token contract id, e.g. SP....token-x"),
        amount: z.string().describe("Amount in the token's base units."),
        assetName: z.string().optional().describe("The token's fungible-token asset name (for a precise post-condition)."),
        fee: feeSchema,
      },
    },
    async ({ accountContract, token, amount, assetName, fee }) => {
      try {
        const account = await getAccount();
        const args = [principalCV(token), uintCV(amount)];
        if (assetName) {
          return createJsonResponse(
            await signAgentCall(account, {
              accountContract,
              functionName: "withdraw-ft",
              functionArgs: args,
              postConditions: [
                createContractFungiblePostCondition(accountContract, token, assetName, "eq", BigInt(amount)),
              ],
              fee,
            })
          );
        }
        return createJsonResponse({
          ...(await signAgentCall(account, {
            accountContract,
            functionName: "withdraw-ft",
            functionArgs: args,
            postConditionMode: PostConditionMode.Allow,
            fee,
          })),
          warning: "Sent in allow mode (no post-condition). Pass assetName for a transfer guard.",
        });
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
        "Add a contract to the agent account's allowlist. Signed by the MCP wallet; requires " +
        "approve-revoke-contracts permission (granted by default). Types: voting (proposals), swap (DEX " +
        "adapter), token (SIP-010).",
      inputSchema: {
        accountContract: accountSchema,
        targetContract: z.string().describe("Contract principal to approve."),
        approvalType: z.enum(["voting", "swap", "token"]),
        fee: feeSchema,
      },
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
        "Remove a contract from the agent account's allowlist. Signed by the MCP wallet; requires " +
        "approve-revoke-contracts permission.",
      inputSchema: {
        accountContract: accountSchema,
        targetContract: z.string().describe("Contract principal to revoke."),
        approvalType: z.enum(["voting", "swap", "token"]),
        fee: feeSchema,
      },
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

  // ---- Faktory DAO token trading --------------------------------------------
  server.registerTool(
    "agent_account_buy_dao_token",
    {
      description:
        "Buy a DAO token through an approved swap adapter, using the agent account's funds. Signed by the MCP " +
        "wallet; requires buy-sell-assets permission and the swap adapter on the allowlist (type=swap). Runs " +
        "in allow mode (swap moves multiple assets).",
      inputSchema: {
        accountContract: accountSchema,
        swapAdapter: z.string().describe("Approved swap adapter contract id (dao-swap-adapter trait)."),
        daoToken: z.string().describe("DAO token contract id (ft-trait)."),
        amount: z.string().describe("Amount to spend, in base units."),
        minReceive: z.string().optional().describe("Optional minimum tokens to receive (slippage guard)."),
        fee: feeSchema,
      },
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
        "Sell a DAO token through an approved swap adapter, using the agent account's funds. Signed by the MCP " +
        "wallet; requires buy-sell-assets permission and the swap adapter on the allowlist (type=swap). Runs " +
        "in allow mode.",
      inputSchema: {
        accountContract: accountSchema,
        swapAdapter: z.string().describe("Approved swap adapter contract id (dao-swap-adapter trait)."),
        daoToken: z.string().describe("DAO token contract id (ft-trait)."),
        amount: z.string().describe("Amount of DAO token to sell, in base units."),
        minReceive: z.string().optional().describe("Optional minimum to receive (slippage guard)."),
        fee: feeSchema,
      },
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
        "Create a DAO action proposal through an approved voting contract. Signed by the MCP wallet; requires " +
        "use-proposals permission and the voting contract on the allowlist (type=voting).",
      inputSchema: {
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        action: z.string().describe("Action contract id (the action to execute)."),
        parameters: z.string().describe("Action parameters as a hex buffer (max 2048 bytes), e.g. 0x... ."),
        memo: z.string().max(1024).optional().describe("Optional memo (max 1024 ASCII chars)."),
        fee: feeSchema,
      },
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
        "Vote on a DAO action proposal through an approved voting contract. Signed by the MCP wallet; requires " +
        "use-proposals permission.",
      inputSchema: {
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        proposalId: z.string().describe("Proposal id (uint)."),
        vote: z.boolean().describe("true = for, false = against."),
        fee: feeSchema,
      },
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
        "Conclude a DAO action proposal through an approved voting contract. Signed by the MCP wallet; " +
        "requires use-proposals permission.",
      inputSchema: {
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        proposalId: z.string().describe("Proposal id (uint)."),
        action: z.string().describe("Action contract id (must match the proposal's action)."),
        fee: feeSchema,
      },
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
        "Veto a DAO action proposal through an approved voting contract. Signed by the MCP wallet; requires " +
        "use-proposals permission.",
      inputSchema: {
        accountContract: accountSchema,
        votingContract: z.string().describe("Approved action-proposal-voting contract id."),
        proposalId: z.string().describe("Proposal id (uint)."),
        fee: feeSchema,
      },
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
        "active wallet is the account owner (otherwise the contract rejects it). Permissions: manage-assets, " +
        "use-proposals, approve-revoke-contracts, buy-sell-assets.",
      inputSchema: {
        accountContract: accountSchema,
        permission: z.enum([
          "manage-assets",
          "use-proposals",
          "approve-revoke-contracts",
          "buy-sell-assets",
        ]),
        enabled: z.boolean().describe("true to grant, false to revoke."),
        fee: feeSchema,
      },
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
        "Read a deployed agent account's configuration (owner, agent, account principal) and the agent's " +
        "current permission flags. Read-only — no wallet or signing required.",
      inputSchema: {
        accountContract: accountSchema,
      },
    },
    async ({ accountContract }) => {
      try {
        const hiro = getHiroApi(NETWORK);
        const sender = getWalletManager().getActiveAccount()?.address || splitContractId(accountContract).address;

        const cfg = await hiro.callReadOnlyFunction(accountContract, "get-configuration", [], sender);
        if (!cfg.okay || !cfg.result) {
          return createJsonResponse({
            success: false,
            message: `Could not read ${accountContract}. Is it deployed? ${cfg.cause || ""}`.trim(),
          });
        }
        const perms = await hiro.callReadOnlyFunction(accountContract, "get-agent-permissions", [], sender);

        return createJsonResponse({
          success: true,
          accountContract,
          configuration: flattenTuple(cvToJSON(hexToCV(cfg.result))),
          agentPermissions:
            perms.okay && perms.result ? flattenTuple(cvToJSON(hexToCV(perms.result))) : null,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
