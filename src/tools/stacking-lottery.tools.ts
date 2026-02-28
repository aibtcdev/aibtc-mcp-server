import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  uintCV,
  contractPrincipalCV,
  PostConditionMode,
  type ClarityValue,
  deserializeCV,
  cvToJSON,
} from "@stacks/transactions";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { callContract } from "../transactions/builder.js";
import { getHiroApi } from "../services/hiro-api.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POT_DEPLOYER = "SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85";
const PLATFORM_ADDRESS = "SP7FSE31MWSJJFTQBEQ1TT6TF3G4J6GDKE81SWD9";
const PLATFORM_CONTRACT = "stackspots";

interface PotInfo {
  name: string;
  contractName: string;
  maxParticipants: number;
  minAmountStx: number;
  deployer: string;
}

const KNOWN_POTS: PotInfo[] = [
  {
    name: "Genesis",
    contractName: "Genesis",
    maxParticipants: 2,
    minAmountStx: 20,
    deployer: POT_DEPLOYER,
  },
  {
    name: "BuildOnBitcoin",
    contractName: "BuildOnBitcoin",
    maxParticipants: 10,
    minAmountStx: 100,
    deployer: POT_DEPLOYER,
  },
  {
    name: "STXLFG",
    contractName: "STXLFG",
    maxParticipants: 100,
    minAmountStx: 21,
    deployer: POT_DEPLOYER,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a contract name that may be fully qualified (deployer.name) or bare (name).
 * Returns { deployer, contractName }.
 */
function parseContractName(input: string): {
  deployer: string;
  contractName: string;
} {
  if (input.includes(".")) {
    const [deployer, ...rest] = input.split(".");
    return { deployer, contractName: rest.join(".") };
  }
  return { deployer: POT_DEPLOYER, contractName: input };
}

/**
 * Call a read-only function on a pot contract.
 * Accepts either a bare contract name or fully qualified deployer.name.
 * Returns the deserialized Clarity value as a JSON-friendly object.
 */
async function callPotReadOnly(
  contractNameOrId: string,
  functionName: string,
  args: ClarityValue[]
): Promise<unknown> {
  const hiro = getHiroApi(NETWORK);
  const { deployer, contractName } = parseContractName(contractNameOrId);
  const contractId = `${deployer}.${contractName}`;
  const result = await hiro.callReadOnlyFunction(
    contractId,
    functionName,
    args,
    deployer
  );
  if (!result.okay) {
    throw new Error(
      `Read-only call ${functionName} failed: ${result.cause ?? "unknown error"}`
    );
  }
  if (!result.result) {
    return null;
  }
  const hex = result.result.startsWith("0x")
    ? result.result.slice(2)
    : result.result;
  const cv = deserializeCV(Buffer.from(hex, "hex"));
  return cvToJSON(cv);
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

export function registerStackingLotteryTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // stackspot_list_pots
  // --------------------------------------------------------------------------

  server.registerTool(
    "stackspot_list_pots",
    {
      description: `List all known stackspot stacking lottery pots with their current on-chain value and lock status.

Stackspot is a stacking lottery on mainnet: participants pool STX into pots that get stacked
via Proof of Transfer (PoX). A VRF-selected winner receives sBTC yield; all participants
recover their original STX after the stacking cycle completes.

Returns known pots with name, contract ID, participant limits, minimum STX, current value, and lock status.

Note: Stackspot is mainnet-only.`,
    },
    async () => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is mainnet-only. Set NETWORK=mainnet to use this tool.",
            network: NETWORK,
          });
        }

        const pots = await Promise.all(
          KNOWN_POTS.map(async (pot) => {
            let currentValueUstx: unknown = null;
            let isLocked: unknown = null;
            try {
              currentValueUstx = await callPotReadOnly(
                pot.contractName,
                "get-pot-value",
                []
              );
            } catch {
              // pot may not be queryable — skip gracefully
            }
            try {
              isLocked = await callPotReadOnly(pot.contractName, "is-locked", []);
            } catch {
              // same
            }
            return {
              name: pot.name,
              contract: `${pot.deployer}.${pot.contractName}`,
              maxParticipants: pot.maxParticipants,
              minAmountStx: pot.minAmountStx,
              currentValueUstx,
              isLocked,
            };
          })
        );

        return createJsonResponse({
          network: NETWORK,
          potCount: pots.length,
          pots,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // stackspot_get_pot_state
  // --------------------------------------------------------------------------

  server.registerTool(
    "stackspot_get_pot_state",
    {
      description: `Get full on-chain state for a stackspot stacking lottery pot.

Queries all read-only functions: current value, lock status, configs, pool config, and details.

Note: Stackspot is mainnet-only.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            "Pot contract name or full identifier. Examples: 'STXLFG' or 'SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG'"
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is mainnet-only. Set NETWORK=mainnet to use this tool.",
            network: NETWORK,
          });
        }

        const parsed = parseContractName(contractName);
        const contractId = `${parsed.deployer}.${parsed.contractName}`;

        const [potValue, isLocked, configs, poolConfig, details] =
          await Promise.all([
            callPotReadOnly(contractName, "get-pot-value", []),
            callPotReadOnly(contractName, "is-locked", []),
            callPotReadOnly(contractName, "get-configs", []),
            callPotReadOnly(contractName, "get-pool-config", []),
            callPotReadOnly(contractName, "get-pot-details", []),
          ]);

        return createJsonResponse({
          network: NETWORK,
          contractName: parsed.contractName,
          contractId,
          state: {
            potValueUstx: potValue,
            isLocked,
            configs,
            poolConfig,
            details,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // stackspot_join_pot
  // --------------------------------------------------------------------------

  server.registerTool(
    "stackspot_join_pot",
    {
      description: `Join a stackspot stacking lottery pot by contributing STX.

STX is locked in the pot contract until the stacking cycle completes. A VRF-selected
winner receives sBTC yield; all participants (including the winner) recover their original STX.

WARNING: Your STX will be locked for one full PoX stacking cycle (~2 weeks). Do not join
with STX you need access to in the short term.

Requires an unlocked wallet. Mainnet-only.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            "Pot contract name or full identifier. Examples: 'STXLFG' or 'SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG'"
          ),
        amount: z
          .string()
          .describe(
            "Amount to contribute in micro-STX (1 STX = 1,000,000 micro-STX). Must meet the pot minimum."
          ),
      },
    },
    async ({ contractName, amount }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is mainnet-only. Set NETWORK=mainnet to use this tool.",
            network: NETWORK,
          });
        }

        const amountBigInt = BigInt(amount);
        if (amountBigInt <= 0n) {
          throw new Error("amount must be a positive integer in micro-STX");
        }

        const parsed = parseContractName(contractName);

        // Warn if amount is below the known minimum for this pot
        const knownPot = KNOWN_POTS.find(
          (p) => p.contractName === parsed.contractName
        );
        if (knownPot) {
          const minUstx = BigInt(knownPot.minAmountStx) * 1_000_000n;
          if (amountBigInt < minUstx) {
            throw new Error(
              `amount ${amount} is below the minimum for ${parsed.contractName}: ` +
                `${minUstx} micro-STX (${knownPot.minAmountStx} STX)`
            );
          }
        }

        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: parsed.deployer,
          contractName: parsed.contractName,
          functionName: "join-pot",
          functionArgs: [uintCV(amountBigInt)],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          pot: {
            contractName: parsed.contractName,
            contractId: `${parsed.deployer}.${parsed.contractName}`,
            amountUstx: amount,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // stackspot_start_pot
  // --------------------------------------------------------------------------

  server.registerTool(
    "stackspot_start_pot",
    {
      description: `Start/trigger a stackspot stacking lottery pot to begin stacking via PoX.

Calls the platform contract (stackspots) to initiate the stacking cycle for a full pot.
The pot must have reached its maximum participant count. This must be called during the
PoX prepare phase — use get_pox_info to check the current cycle phase.

Requires an unlocked wallet. Mainnet-only.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            "Pot contract name or full identifier. Examples: 'STXLFG' or 'SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG'"
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is mainnet-only. Set NETWORK=mainnet to use this tool.",
            network: NETWORK,
          });
        }

        const parsed = parseContractName(contractName);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: PLATFORM_ADDRESS,
          contractName: PLATFORM_CONTRACT,
          functionName: "start-stackspot-jackpot",
          functionArgs: [
            contractPrincipalCV(parsed.deployer, parsed.contractName),
          ],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          pot: {
            contractName: parsed.contractName,
            contractId: `${parsed.deployer}.${parsed.contractName}`,
          },
          platform: `${PLATFORM_ADDRESS}.${PLATFORM_CONTRACT}`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // stackspot_claim_rewards
  // --------------------------------------------------------------------------

  server.registerTool(
    "stackspot_claim_rewards",
    {
      description: `Claim sBTC rewards from a completed stackspot stacking lottery pot.

If the active wallet was VRF-selected as the winner, it receives sBTC stacking yield.
All participants (winner and non-winners alike) can recover their original STX via this call.
The pot must have finished its stacking cycle before rewards can be claimed.

Requires an unlocked wallet. Mainnet-only.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            "Pot contract name or full identifier. Examples: 'STXLFG' or 'SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG'"
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is mainnet-only. Set NETWORK=mainnet to use this tool.",
            network: NETWORK,
          });
        }

        const parsed = parseContractName(contractName);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: parsed.deployer,
          contractName: parsed.contractName,
          functionName: "claim-pot-reward",
          functionArgs: [
            contractPrincipalCV(parsed.deployer, parsed.contractName),
          ],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          pot: {
            contractName: parsed.contractName,
            contractId: `${parsed.deployer}.${parsed.contractName}`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // stackspot_cancel_pot
  // --------------------------------------------------------------------------

  server.registerTool(
    "stackspot_cancel_pot",
    {
      description: `Cancel a stackspot stacking lottery pot before stacking begins.

Allows participants to recover their contributed STX. The pot must not be locked
(stacking must not have started yet). Once a pot is locked and stacking has begun,
it cannot be cancelled.

Requires an unlocked wallet. Mainnet-only.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            "Pot contract name or full identifier. Examples: 'STXLFG' or 'SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG'"
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is mainnet-only. Set NETWORK=mainnet to use this tool.",
            network: NETWORK,
          });
        }

        const parsed = parseContractName(contractName);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: parsed.deployer,
          contractName: parsed.contractName,
          functionName: "cancel-pot",
          functionArgs: [
            contractPrincipalCV(parsed.deployer, parsed.contractName),
          ],
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          pot: {
            contractName: parsed.contractName,
            contractId: `${parsed.deployer}.${parsed.contractName}`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
