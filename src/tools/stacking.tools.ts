import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import {
  MAX_STAKE_CYCLES,
  buildPayoutCalldata,
  getStackingService,
  type PoxState,
  type StakerInfo,
} from "../services/stacking.service.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { btcAddressToPoxAddr } from "../utils/bitcoin.js";

const POX5_NOTE =
  "PoX-5: every stake names a signer manager contract; rewards are paid in sBTC through that manager.";

function stx(ustx: bigint): string {
  const whole = ustx / 1_000_000n;
  const frac = (ustx % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac} STX`;
}

function poxSummary(pox: PoxState) {
  return {
    contract: pox.contractId,
    burnHeight: pox.burnHeight,
    rewardCycle: pox.rewardCycle,
    nextCycleStartHeight: pox.nextCycleStartHeight,
    preparePhaseStartHeight: pox.preparePhaseStartHeight,
    inPreparePhase: pox.inPreparePhase,
  };
}

function stakerSummary(info: StakerInfo) {
  return {
    signerManager: info.signerManager,
    amountUstx: info.amountUstx.toString(),
    amount: stx(info.amountUstx),
    firstRewardCycle: info.firstRewardCycle,
    numCycles: info.numCycles,
    unlockCycle: info.unlockCycle,
    unlockBurnHeight: info.unlockBurnHeight,
  };
}

const payoutInputs = {
  btcRewardAddress: z
    .string()
    .optional()
    .describe(
      "Optional Bitcoin address to receive rewards. Encoded as `{ pox-addr, max-fee }` signer calldata, " +
        "the shape reference signer managers (e.g. Xverse, Fast Pool) use to pay rewards to BTC via an " +
        "sBTC withdrawal. Some managers require it (PlanBetter), some ignore it (native-pool). " +
        "Omit to receive sBTC where the manager supports that."
    ),
  maxWithdrawalFeeSats: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Max sBTC withdrawal fee (sats) per payout when btcRewardAddress is set. Default 3000."),
  signerCalldataHex: z
    .string()
    .optional()
    .describe(
      "Advanced: raw signer calldata (hex, max 500 bytes) for managers with a custom format. " +
        "Cannot be combined with btcRewardAddress."
    ),
};

function resolveCalldata(input: {
  btcRewardAddress?: string;
  maxWithdrawalFeeSats?: number;
  signerCalldataHex?: string;
}): Uint8Array | undefined {
  if (input.btcRewardAddress && input.signerCalldataHex) {
    throw new Error("Pass either btcRewardAddress or signerCalldataHex, not both.");
  }
  if (input.btcRewardAddress) {
    return buildPayoutCalldata(
      btcAddressToPoxAddr(input.btcRewardAddress, NETWORK),
      BigInt(input.maxWithdrawalFeeSats ?? 3000)
    );
  }
  if (input.signerCalldataHex) {
    const hex = input.signerCalldataHex.replace(/^0x/, "");
    if (!/^([0-9a-fA-F]{2})*$/.test(hex)) {
      throw new Error("signerCalldataHex must be an even-length hex string.");
    }
    return Uint8Array.from(Buffer.from(hex, "hex"));
  }
  return undefined;
}

export function registerStackingTools(server: McpServer): void {
  // --- get_pox_info ---
  server.registerTool(
    "get_pox_info",
    {
      description:
        "Current PoX-5 state: reward cycle, burn height, next cycle start, and whether the prepare " +
        "phase is active (stake, extend and unstake are refused during it).",
    },
    async () => {
      try {
        const pox = await getStackingService(NETWORK).getPoxState();
        return createJsonResponse({
          network: NETWORK,
          ...poxSummary(pox),
          firstBurnHeight: pox.firstBurnHeight,
          rewardCycleLength: pox.rewardCycleLength,
          prepareCycleLength: pox.prepareCycleLength,
          signerSetMinUstx: pox.signerSetMinUstx.toString(),
          totalLiquidSupplyUstx: pox.totalLiquidSupplyUstx.toString(),
          note: POX5_NOTE,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- get_stacking_status ---
  server.registerTool(
    "get_stacking_status",
    {
      description:
        "PoX-5 staking status for an address: locked amount, signer manager, lock period, unlock " +
        "cycle and burn height, any protocol bond membership, and locked/unlocked STX balance.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Stacks address to check. Uses the active wallet if omitted."),
      },
    },
    async ({ address }) => {
      try {
        const walletAddress = address || (await getWalletAddress());
        const status = await getStackingService(NETWORK).getStakingStatus(walletAddress);
        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          staking: status.staking !== null,
          stake: status.staking ? stakerSummary(status.staking) : null,
          bond: status.bond
            ? {
                bondIndex: status.bond.bondIndex,
                signerManager: status.bond.signerManager,
                amountUstx: status.bond.amountUstx.toString(),
                amountSats: status.bond.amountSats.toString(),
                isL1Lock: status.bond.isL1Lock,
              }
            : null,
          balance: {
            totalUstx: status.account.balanceUstx.toString(),
            lockedUstx: status.account.lockedUstx.toString(),
            unlockedUstx: status.account.unlockedUstx.toString(),
            burnchainUnlockHeight: status.account.burnchainUnlockHeight,
          },
          pox: poxSummary(status.pox),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- list_stacking_signers ---
  server.registerTool(
    "list_stacking_signers",
    {
      description:
        "List PoX-5 signer managers in the signer set for a reward cycle (default: next cycle), with " +
        "the STX delegated to each. A signer manager is what stack_stx stakes with. Only signers with " +
        "at least the signer-set minimum delegated appear here; other registered managers can still be " +
        "staked with by contract id. Set withPayoutInfo to see how each manager pays stakers (slower).",
      inputSchema: {
        rewardCycle: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Reward cycle to list. Defaults to the next cycle (the one a new stake joins)."),
        withPayoutInfo: z
          .boolean()
          .optional()
          .default(false)
          .describe("Also read each manager's claim path (one extra request per signer)."),
      },
    },
    async ({ rewardCycle, withPayoutInfo }) => {
      try {
        const service = getStackingService(NETWORK);
        const pox = await service.getPoxState();
        const cycle = rewardCycle ?? pox.rewardCycle + 1;
        const signers = (await service.getSignerSet(cycle)).sort((a, b) =>
          b.delegatedUstx > a.delegatedUstx ? 1 : b.delegatedUstx < a.delegatedUstx ? -1 : 0
        );

        const rows = [];
        for (const s of signers) {
          rows.push({
            signerManager: s.signerManager,
            delegatedUstx: s.delegatedUstx.toString(),
            delegated: stx(s.delegatedUstx),
            ...(withPayoutInfo && { stakerClaim: await service.getClaimStyle(s.signerManager) }),
          });
        }

        return createJsonResponse({
          network: NETWORK,
          rewardCycle: cycle,
          count: rows.length,
          signers: rows,
          ...(withPayoutInfo && {
            stakerClaimKey: {
              "staker-arg": "on-chain; claim_stacking_rewards works",
              caller: "on-chain; claim_stacking_rewards works (paid to the caller)",
              none: "no on-chain staker claim; the manager pays off-chain or not at all",
            },
          }),
          note:
            "Managers can restrict who may stake (allowlists, minimums, required payout calldata). " +
            "Check a manager's own terms before staking; a refused stake aborts on chain.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- stack_stx ---
  server.registerTool(
    "stack_stx",
    {
      description: `Lock STX in PoX-5 with a signer manager to earn sBTC rewards.

The lock starts next reward cycle and lasts numCycles cycles (1-${MAX_STAKE_CYCLES}). Pick a signer manager with list_stacking_signers. Refused during the prepare phase and if the address is already staking (use extend_stacking). Locking is not a transfer: the transaction carries a staking post-condition for exactly the locked amount.`,
      inputSchema: {
        signerManager: z
          .string()
          .describe("Signer manager contract id, e.g. SP8HK160YD5GHXP69VGA0TC7AQJ1X4CDW3XVERSE.xverse-signer-manager-2"),
        amount: z.string().describe("Amount to lock, in micro-STX"),
        numCycles: z
          .number()
          .int()
          .min(1)
          .max(MAX_STAKE_CYCLES)
          .describe(`Reward cycles to lock (1-${MAX_STAKE_CYCLES}; one cycle is about two weeks)`),
        ...payoutInputs,
      },
    },
    async ({ signerManager, amount, numCycles, ...payout }) => {
      try {
        const account = await getAccount();
        const result = await getStackingService(NETWORK).stake(account, {
          signerManager,
          amountUstx: BigInt(amount),
          numCycles,
          signerCalldata: resolveCalldata(payout),
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          staker: account.address,
          signerManager,
          amountUstx: amount,
          amount: stx(BigInt(amount)),
          firstRewardCycle: result.pox.rewardCycle + 1,
          numCycles,
          unlockCycle: result.unlockCycle,
          unlockBurnHeight: result.unlockBurnHeight,
          rewardPayout: payout.btcRewardAddress
            ? `BTC to ${payout.btcRewardAddress} (if the manager supports it)`
            : payout.signerCalldataHex
              ? "custom signer calldata"
              : "sBTC (if the manager supports it)",
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- extend_stacking ---
  server.registerTool(
    "extend_stacking",
    {
      description: `Update an existing PoX-5 stake: extend the lock, add STX, switch signer manager, or change payout calldata (pox-5 stake-update).

Any combination in one call. Increasing locks more of the address's unlocked STX. Refused during the prepare phase. The lock may not run more than ${MAX_STAKE_CYCLES} cycles past the next cycle.`,
      inputSchema: {
        cyclesToExtend: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .default(0)
          .describe("Cycles to add to the current unlock cycle"),
        amountIncrease: z
          .string()
          .optional()
          .default("0")
          .describe("Additional micro-STX to lock"),
        signerManager: z
          .string()
          .optional()
          .describe("New signer manager contract id. Defaults to the current one."),
        ...payoutInputs,
      },
    },
    async ({ cyclesToExtend, amountIncrease, signerManager, ...payout }) => {
      try {
        const account = await getAccount();
        const result = await getStackingService(NETWORK).updateStake(account, {
          signerManager,
          cyclesToExtend,
          amountIncreaseUstx: BigInt(amountIncrease),
          signerCalldata: resolveCalldata(payout),
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          staker: account.address,
          previous: stakerSummary(result.previous),
          signerManager: result.signerManager,
          newAmountUstx: result.newAmountUstx.toString(),
          newAmount: stx(result.newAmountUstx),
          unlockCycle: result.unlockCycle,
          unlockBurnHeight: result.unlockBurnHeight,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- unstake_stx ---
  server.registerTool(
    "unstake_stx",
    {
      description:
        "Stop a PoX-5 stake early (pox-5 unstake). The STX stays locked through the current reward " +
        "cycle and unlocks at the start of the next one. Refused during the prepare phase.",
      inputSchema: {},
    },
    async () => {
      try {
        const account = await getAccount();
        const result = await getStackingService(NETWORK).unstake(account);
        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          staker: account.address,
          previous: stakerSummary(result.previous),
          unlockCycle: result.unlockCycle,
          unlockBurnHeight: result.unlockBurnHeight,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- get_stacking_rewards ---
  server.registerTool(
    "get_stacking_rewards",
    {
      description:
        "PoX-5 sBTC rewards an address has earned from its signer manager for one reward cycle and not " +
        "yet claimed (before the manager's fees), whether the manager still has to pull them from pox-5, " +
        "and whether the manager supports an on-chain staker claim.",
      inputSchema: {
        rewardCycle: z.number().int().nonnegative().describe("Reward cycle to check"),
        address: z
          .string()
          .optional()
          .describe("Stacks address. Uses the active wallet if omitted."),
        signerManager: z
          .string()
          .optional()
          .describe("Signer manager to check. Defaults to the address's current signer manager."),
      },
    },
    async ({ rewardCycle, address, signerManager }) => {
      try {
        const service = getStackingService(NETWORK);
        const staker = address || (await getWalletAddress());
        const manager =
          signerManager ?? (await service.getStakerInfo(staker))?.signerManager;
        if (!manager) {
          throw new Error(
            `${staker} is not currently staking; pass signerManager to check rewards from a past signer.`
          );
        }
        const [earnedSats, unpulledSats, claimStyle] = await Promise.all([
          service.getStakerUnclaimedRewards(manager, rewardCycle, staker),
          service.getSignerUnpulledRewards(manager, rewardCycle),
          service.getClaimStyle(manager),
        ]);
        return createJsonResponse({
          address: staker,
          network: NETWORK,
          rewardCycle,
          signerManager: manager,
          unclaimedSatsBeforeFees: earnedSats.toString(),
          managerUnpulledSats: unpulledSats.toString(),
          stakerClaim: claimStyle,
          next:
            earnedSats === 0n
              ? "Nothing to claim for this cycle."
              : claimStyle === "none"
                ? "This manager has no on-chain staker claim; it pays stakers off-chain."
                : "Call claim_stacking_rewards with this rewardCycle.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- claim_stacking_rewards ---
  server.registerTool(
    "claim_stacking_rewards",
    {
      description:
        "Claim PoX-5 sBTC rewards for one reward cycle through the staker's signer manager. If the " +
        "manager has not yet pulled that cycle's rewards from pox-5, this first sends the manager's " +
        "permissionless claim-rewards (a second transaction, paid by this wallet), then the staker " +
        "claim. Rewards arrive as sBTC, or as a BTC withdrawal if a payout address was set when " +
        "staking. Not available for managers that pay off-chain.",
      inputSchema: {
        rewardCycle: z.number().int().nonnegative().describe("Reward cycle to claim"),
        signerManager: z
          .string()
          .optional()
          .describe("Signer manager to claim from. Defaults to the wallet's current signer manager."),
      },
    },
    async ({ rewardCycle, signerManager }) => {
      try {
        const service = getStackingService(NETWORK);
        const account = await getAccount();
        const manager =
          signerManager ?? (await service.getStakerInfo(account.address))?.signerManager;
        if (!manager) {
          throw new Error(
            `${account.address} is not currently staking; pass signerManager to claim from a past signer.`
          );
        }

        const [earnedSats, unpulledSats, claimStyle] = await Promise.all([
          service.getStakerUnclaimedRewards(manager, rewardCycle, account.address),
          service.getSignerUnpulledRewards(manager, rewardCycle),
          service.getClaimStyle(manager),
        ]);
        if (claimStyle === "none") {
          throw new Error(
            `${manager} has no on-chain staker claim (claim-staker-rewards); it pays stakers off-chain.`
          );
        }
        if (earnedSats === 0n) {
          throw new Error(
            `No unclaimed rewards for ${account.address} from ${manager} in cycle ${rewardCycle}.`
          );
        }

        let pull: { txid: string; explorerUrl: string } | null = null;
        if (unpulledSats > 0n) {
          const pulled = await service.pullSignerRewards(account, manager, rewardCycle, unpulledSats);
          pull = { txid: pulled.txid, explorerUrl: getExplorerTxUrl(pulled.txid, NETWORK) };
        }

        const claim = await service.claimStakerRewards(account, manager, rewardCycle, claimStyle);
        return createJsonResponse({
          success: true,
          network: NETWORK,
          rewardCycle,
          signerManager: manager,
          unclaimedSatsBeforeFees: earnedSats.toString(),
          managerPull: pull,
          txid: claim.txid,
          explorerUrl: getExplorerTxUrl(claim.txid, NETWORK),
          note: pull
            ? "Two transactions were sent in nonce order: the manager's pull, then the staker claim."
            : undefined,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
