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
import { getHiroApi } from "../services/hiro-api.js";
import { callContract } from "../transactions/builder.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// ---------------------------------------------------------------------------
// Constants — mirrored from the stackspot skill
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
 * Call a read-only function on a pot contract and return a JSON-friendly value.
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
// Tool registration
// ---------------------------------------------------------------------------

export function registerStackingLotteryTools(server: McpServer): void {
  // ==========================================================================
  // list-pots
  // ==========================================================================

  server.registerTool(
    "stackspot_list_pots",
    {
      description: `List all known Stackspot stacking lottery pots with current on-chain values.

Stackspot is a stacking lottery on Stacks: participants pool STX into a pot, the pot
stacks via PoX to earn BTC rewards. A VRF-selected winner receives the sBTC yield;
all participants recover their original STX contribution.

Returns each pot's contract ID, configuration, current STX value, and lock status.

Note: Stackspot is only available on mainnet.`,
      inputSchema: {},
    },
    async () => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is only available on mainnet",
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
              // pot may not be deployed or reachable — skip gracefully
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

  // ==========================================================================
  // get-pot-state
  // ==========================================================================

  server.registerTool(
    "stackspot_get_pot_state",
    {
      description: `Get full on-chain state for a Stackspot stacking lottery pot.

Returns the pot value, lock status, configurations, pool config, and detailed state.
Use a bare contract name (e.g., "STXLFG") or a fully-qualified identifier
(e.g., "SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG").

Note: Stackspot is only available on mainnet.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            'Pot contract name or full identifier (e.g., "STXLFG" or "SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG")'
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is only available on mainnet",
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

  // ==========================================================================
  // join-pot
  // ==========================================================================

  server.registerTool(
    "stackspot_join_pot",
    {
      description: `Contribute STX to a Stackspot stacking lottery pot.

Joins a pot by contributing STX. Your STX is locked until the stacking cycle
completes. All participants recover their STX regardless of who wins; only the
VRF-selected winner receives the sBTC yield.

Use a bare contract name (e.g., "STXLFG") or a fully-qualified identifier.
Amount must be in micro-STX (1 STX = 1,000,000 micro-STX).

Requires an unlocked wallet with sufficient STX balance.

Note: Stackspot is only available on mainnet.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            'Pot contract name or full identifier (e.g., "STXLFG" or "SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG")'
          ),
        amount: z
          .string()
          .describe(
            "Amount to contribute in micro-STX (1 STX = 1,000,000 micro-STX)"
          ),
      },
    },
    async ({ contractName, amount }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is only available on mainnet",
            network: NETWORK,
          });
        }

        let amountBigInt: bigint;
        try {
          amountBigInt = BigInt(amount);
        } catch {
          return createJsonResponse({
            error: `Invalid amount "${amount}": must be a whole number in micro-STX (e.g., "1000000" for 1 STX)`,
          });
        }
        if (amountBigInt <= 0n) {
          return createJsonResponse({
            error: "amount must be a positive integer in micro-STX",
          });
        }

        const parsed = parseContractName(contractName);

        // Warn if amount is below the known minimum for this pot
        const knownPot = KNOWN_POTS.find(
          (p) => p.contractName === parsed.contractName
        );
        if (knownPot) {
          const minUstx = BigInt(knownPot.minAmountStx) * 1_000_000n;
          if (amountBigInt < minUstx) {
            return createJsonResponse({
              error: `amount ${amount} is below the minimum for ${parsed.contractName}: ${minUstx} micro-STX (${knownPot.minAmountStx} STX)`,
              minimumUstx: minUstx.toString(),
              minimumStx: knownPot.minAmountStx,
            });
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
            contractId: `${parsed.deployer}.${parsed.contractName}`,
            amountUstx: amount,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // start-pot
  // ==========================================================================

  server.registerTool(
    "stackspot_start_pot",
    {
      description: `Trigger a full Stackspot pot to begin stacking via the platform contract.

Initiates stacking for a pot that has reached its participant limit. This call
goes through the platform contract (stackspots) and must be made during the PoX
prepare phase. Any participant can call this once the pot is full.

Use a bare contract name (e.g., "STXLFG") or a fully-qualified identifier.

Requires an unlocked wallet.

Note: Stackspot is only available on mainnet.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            'Pot contract name or full identifier (e.g., "STXLFG" or "SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG")'
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is only available on mainnet",
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
            contractId: `${parsed.deployer}.${parsed.contractName}`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // claim-rewards
  // ==========================================================================

  server.registerTool(
    "stackspot_claim_rewards",
    {
      description: `Claim rewards from a completed Stackspot stacking lottery pot.

After stacking completes and a winner is selected by VRF, each participant claims
their share: all participants recover their contributed STX; the VRF-selected winner
also receives the sBTC yield earned during the stacking cycle.

Use a bare contract name (e.g., "STXLFG") or a fully-qualified identifier.

Requires an unlocked wallet.

Note: Stackspot is only available on mainnet.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            'Pot contract name or full identifier (e.g., "STXLFG" or "SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG")'
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is only available on mainnet",
            network: NETWORK,
          });
        }

        const parsed = parseContractName(contractName);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: parsed.deployer,
          contractName: parsed.contractName,
          functionName: "claim-pot-reward",
          functionArgs: [],
          // TODO: tighten to PostConditionMode.Deny once post-conditions are
          // defined; kept as Allow to match the upstream stackspot skill for now.
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          pot: {
            contractId: `${parsed.deployer}.${parsed.contractName}`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // cancel-pot
  // ==========================================================================

  server.registerTool(
    "stackspot_cancel_pot",
    {
      description: `Cancel a Stackspot stacking lottery pot before stacking begins.

Cancels an unlocked pot to recover contributed STX. The pot must not yet be locked
(i.e., stacking has not started). Once stacking begins the pot cannot be cancelled.

Use a bare contract name (e.g., "STXLFG") or a fully-qualified identifier.

Requires an unlocked wallet.

Note: Stackspot is only available on mainnet.`,
      inputSchema: {
        contractName: z
          .string()
          .describe(
            'Pot contract name or full identifier (e.g., "STXLFG" or "SPT4SQP5RC1BFAJEQKBHZMXQ8NQ7G118F335BD85.STXLFG")'
          ),
      },
    },
    async ({ contractName }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "Stackspot is only available on mainnet",
            network: NETWORK,
          });
        }

        const parsed = parseContractName(contractName);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: parsed.deployer,
          contractName: parsed.contractName,
          functionName: "cancel-pot",
          functionArgs: [],
          // TODO: tighten to PostConditionMode.Deny once post-conditions are
          // defined; kept as Allow to match the upstream stackspot skill for now.
          postConditionMode: PostConditionMode.Allow,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          pot: {
            contractId: `${parsed.deployer}.${parsed.contractName}`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
