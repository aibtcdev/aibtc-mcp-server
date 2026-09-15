/**
 * At Stake legion tools — the two side DAOs at aibtc.com/legions.
 *
 * Each side of the El Salvador market has a legion, and VOTING WEIGHT IS THE
 * SHARE BALANCE, read live out of the market at the moment of every call. So a
 * legion's electorate is exactly the set of people exposed to the claim it
 * argues: the yes legion is bonded holders, the no legion is idle holders. You
 * join by minting shares, not by registering.
 *
 * Lifecycle: propose → (2-block delay) → vote for 30 blocks → conclude inside a
 * 12-block window. A proposal nobody concludes in that window EXPIRES and pays
 * nobody, permanently. There is no veto: voting no while the window is open is
 * the only way to stop a proposal.
 *
 * A passing proposal pays 3,000 shares of its own side out of the legion vault
 * while the market still trades. Once the market resolves the vault can no
 * longer move shares, so a pass becomes an sBTC CREDIT instead, claimable after
 * someone calls `atstake_legion_redeem_vault`.
 *
 * Weight is liquid and cannot be locked, so `conclude` re-reads the proposer's
 * balance: buy in, propose, sell, get paid does not work — it settles
 * "not-holding" and pays nothing.
 *
 * NOT THE SAME TOOLS AS `legion_*`. Those govern `aibtc-news-gov`, where weight
 * is bought with sBTC contributions and a proposal names a Bitcoin ordinal.
 * These govern the El Salvador market's two sides. Same word, different
 * contracts, different way of getting a vote.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Pc,
  PostConditionMode,
  boolCV,
  principalCV,
  stringAsciiCV,
  uintCV,
} from "@stacks/transactions";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { callContract } from "../transactions/builder.js";
import {
  AT_STAKE_API,
  AT_STAKE_NETWORK,
  LEGIONS_SITE_URL,
  MAX_DESCRIPTION_LENGTH,
  MAX_LINK_LENGTH,
  MAX_RATIONALE_LENGTH,
  MAX_TITLE_LENGTH,
  SBTC_ASSET_NAME,
  SBTC_CONTRACT,
  resolveSide,
  type AtStakeSide,
} from "../config/at-stake.js";
import {
  explainAbort,
  getAtStakeAccount,
  getBurnHeight,
  getLegionParams,
  getMarket,
  getPhase,
  getPosition,
  getProposal,
  getProposalMeta,
  getProposeStatus,
  getSettlement,
  isTradeable,
  predictOutcome,
  readContract,
  num,
} from "../services/at-stake.service.js";

const SBTC_FT = SBTC_CONTRACT as `${string}.${string}`;

const SIDE_ARG = z
  .enum(["yes", "no", "bonded", "idle"])
  .describe(
    'Which legion: "yes"/"bonded" argues the coins entered a PoX-5 bond, ' +
      '"no"/"idle" argues they did not.'
  );

/**
 * The shape of `aibtc.com/api/legions`, narrowed to the fields these tools
 * surface. Declared rather than inferred so an upstream rename shows up as a
 * type error here instead of as `undefined` in a rendered answer.
 */
interface LegionsBoard {
  tip: number;
  market: unknown;
  sides?: Record<string, LegionsBoardSide | undefined>;
}

interface LegionsBoardSide {
  contract: string;
  argues: string;
  shareLabel: string;
  vault: number;
  winsLeft: number;
  votable: number;
  summary: unknown;
  members?: unknown[];
  proposals?: LegionsBoardProposal[];
}

interface LegionsBoardProposal {
  proposalId: number;
  phase: string;
  title: string;
  description: string;
  link: string;
  proposer: string;
  proposerWeightNow: number;
  payout: number;
  reason: string;
  voteEnd: number;
  yesWeight: number;
  noWeight: number;
  voterCount: number;
  yesVoterCount: number;
  votes?: unknown[];
}

function explorerUrl(txid: string): string {
  return getExplorerTxUrl(txid, AT_STAKE_NETWORK);
}

function legionError(error: unknown) {
  return createErrorResponse(explainAbort(error));
}

/** Split a legion contract id for `callContract`. */
function parts(side: AtStakeSide): [string, string] {
  return side.legion.split(".") as [string, string];
}

/**
 * Reject a string the contract would reject, before it costs gas.
 *
 * Clarity `string-ascii` is bytes, not code points, and an em dash or a curly
 * quote pasted from a draft is neither ASCII nor silently dropped: the whole
 * call aborts. Saying which character and where beats reading `u421`.
 */
function assertAscii(field: string, value: string, max: number): void {
  if (value.length === 0) {
    throw new Error(`The ${field} cannot be empty.`);
  }
  if (value.length > max) {
    throw new Error(
      `The ${field} is ${value.length} characters, over the contract's ${max}-character limit.`
    );
  }
  const bad = [...value].find((ch) => ch.charCodeAt(0) > 127);
  if (bad) {
    throw new Error(
      `The ${field} contains a non-ASCII character (${JSON.stringify(bad)} at index ` +
        `${[...value].indexOf(bad)}). Clarity string-ascii rejects it — em dashes and ` +
        `curly quotes are the usual culprits.`
    );
  }
}

export function registerAtStakeLegionTools(server: McpServer): void {
  // ==========================================================================
  // atstake_legion_status
  // ==========================================================================

  server.registerTool(
    "atstake_legion_status",
    {
      description:
        "Where a legion stands and whether you can act in it right now: your weight, " +
        "the vault, the rules, and every gate between you and a proposal.\n\n" +
        "Voting weight IS your share balance on that side, read live from the market. " +
        "Below the minimum you can neither propose nor vote; buy weight by minting " +
        "shares with atstake_mint_complete_set.\n\n" +
        "Read-only. Defaults to the unlocked wallet, which requires one; pass an address " +
        "to read anyone without unlocking.",
      inputSchema: {
        side: SIDE_ARG,
        address: z
          .string()
          .optional()
          .describe("Whose eligibility to report. Defaults to the unlocked wallet."),
      },
    },
    async ({ side, address }) => {
      try {
        const chosen = resolveSide(side);
        const who = address ?? (await getAtStakeAccount()).address;
        const [params, status, settlement, market, burnHeight, position] =
          await Promise.all([
            getLegionParams(chosen),
            getProposeStatus(chosen, who),
            getSettlement(chosen),
            getMarket(),
            getBurnHeight(),
            getPosition(who),
          ]);
        const lastId = num(
          await readContract(chosen.legion, "get-last-proposal-id")
        );

        const blockers: string[] = [];
        if (!status.eligible)
          blockers.push(
            `weight ${status.weight} is under the ${params.minPosition}-share minimum`
          );
        if (!status.marketTradeable)
          blockers.push("the market has closed, so this legion takes no new proposals");
        if (!status.noLiveProposal)
          blockers.push("you already have a live proposal");
        if (!status.cooledDown)
          blockers.push(
            `proposer cooldown until burn height ${status.proposerNextHeight} ` +
              `(${status.proposerNextHeight - burnHeight} blocks)`
          );
        if (!status.slotOpen)
          blockers.push(
            `the legion's global propose slot opens at burn height ` +
              `${status.nextProposeHeight}`
          );
        if (!status.potOk)
          blockers.push("the vault cannot cover its credits plus another payout");

        return createJsonResponse({
          legion: chosen.legion,
          side: chosen.argues,
          shareLabel: chosen.label,
          argues:
            chosen.argues === "yes"
              ? "El Salvador's reserve Bitcoin DID enter a PoX-5 bond before the close height"
              : "El Salvador's reserve Bitcoin did NOT enter a PoX-5 bond before the close height",
          site: LEGIONS_SITE_URL,
          network: AT_STAKE_NETWORK,
          burnHeight,
          you: {
            address: who,
            weight: status.weight,
            sharesHeld: position[chosen.positionKey],
            eligible: status.eligible,
            canPropose: status.canPropose,
            blockers,
          },
          vault: {
            shares: status.vault,
            payoutPerWin: status.payout,
            winsLeft: status.winsLeft,
            votableWeight: status.votable,
          },
          rules: params,
          timing:
            `propose, then voting opens ${params.voteDelay} blocks later and runs for ` +
            `${params.voteWindow}; conclude inside the ${params.concludeWindow} blocks ` +
            `after that or the proposal expires and pays nobody`,
          market: {
            status: market.statusLabel,
            tradeable: isTradeable(market, burnHeight),
            closeHeight: market.closeHeight,
          },
          settlement: {
            ...settlement,
            note: settlement.redeemed
              ? "The vault has been redeemed; credits are claimable with atstake_legion_claim_credit."
              : settlement.totalCredits > 0
                ? "Credits are outstanding. After the market resolves, someone must call atstake_legion_redeem_vault before they can be claimed."
                : "No credits outstanding — passes are still being paid in shares.",
          },
          lastProposalId: lastId,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_legion_list_proposals
  // ==========================================================================

  server.registerTool(
    "atstake_legion_list_proposals",
    {
      description:
        "Every proposal in both legions, with tallies, rationales and the member roll, " +
        "from the aggregated read the legions site itself renders.\n\n" +
        "This is the cheap way to see the whole board at once: what has been argued on " +
        "each side, who voted and why, and which proposals are still live. Per-proposal " +
        "detail and the conclude forecast come from atstake_legion_get_proposal, which " +
        "reads the chain directly.\n\n" +
        "Read-only, no wallet needed.",
      inputSchema: {
        side: z
          .enum(["yes", "no", "bonded", "idle", "both"])
          .optional()
          .default("both")
          .describe("Which legion to list. Defaults to both."),
        phase: z
          .string()
          .optional()
          .describe(
            'Only proposals in this phase: "voting", "concludable", "passed", ' +
              '"failed", "expired", "pending".'
          ),
      },
    },
    async ({ side, phase }) => {
      try {
        const response = await fetch(AT_STAKE_API);
        if (!response.ok) {
          throw new Error(
            `Legions API error (${response.status}): ${await response.text()}`
          );
        }
        const board = (await response.json()) as LegionsBoard;
        const wanted =
          side === undefined || side === "both"
            ? (["yes", "no"] as const)
            : ([resolveSide(side).argues] as const);

        const legions = wanted.map((key) => {
          const sideBoard = board.sides?.[key];
          const proposals = (sideBoard?.proposals ?? []).filter(
            (p) => !phase || p.phase === phase
          );
          return {
            side: key,
            contract: sideBoard?.contract,
            argues: sideBoard?.argues,
            shareLabel: sideBoard?.shareLabel,
            vault: sideBoard?.vault,
            winsLeft: sideBoard?.winsLeft,
            votableWeight: sideBoard?.votable,
            summary: sideBoard?.summary,
            memberCount: sideBoard?.members?.length ?? 0,
            members: sideBoard?.members,
            proposals: proposals.map((p) => ({
              proposalId: p.proposalId,
              phase: p.phase,
              title: p.title,
              description: p.description,
              link: p.link,
              proposer: p.proposer,
              proposerWeightNow: p.proposerWeightNow,
              payout: p.payout,
              reason: p.reason,
              voteEnd: p.voteEnd,
              tally: {
                yesWeight: p.yesWeight,
                noWeight: p.noWeight,
                voterCount: p.voterCount,
                yesVoterCount: p.yesVoterCount,
              },
              votes: p.votes,
            })),
          };
        });

        return createJsonResponse({
          source: AT_STAKE_API,
          site: LEGIONS_SITE_URL,
          network: AT_STAKE_NETWORK,
          burnHeight: board.tip,
          market: board.market,
          filter: { side: side ?? "both", phase: phase ?? "any" },
          legions,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_legion_get_proposal
  // ==========================================================================

  server.registerTool(
    "atstake_legion_get_proposal",
    {
      description:
        "One proposal in full: its claim, its link, the tally, its phase, and what " +
        "concluding it now would decide.\n\n" +
        "The predicted outcome runs the contract's own decision order over the tally as " +
        "it stands. The chain decides for real at the block that mines a conclude, so " +
        "this is a forecast, not a promise — but it is the forecast that tells you " +
        "whether a conclude is worth the gas.\n\n" +
        "Read-only, no wallet needed.",
      inputSchema: {
        side: SIDE_ARG,
        proposal_id: z.number().int().positive().describe("The proposal id."),
      },
    },
    async ({ side, proposal_id }) => {
      try {
        const chosen = resolveSide(side);
        const [proposal, meta, phase, params, status, burnHeight, market] =
          await Promise.all([
            getProposal(chosen, proposal_id),
            getProposalMeta(chosen, proposal_id),
            getPhase(chosen, proposal_id),
            getLegionParams(chosen),
            getSettlement(chosen),
            getBurnHeight(),
            getMarket(),
          ]);

        if (!proposal) {
          return createErrorResponse(
            new Error(
              `No proposal ${proposal_id} in the ${chosen.argues} legion (u404).`
            )
          );
        }

        const [proposerPosition, proposeStatus] = await Promise.all([
          getPosition(proposal.proposer),
          getProposeStatus(chosen, proposal.proposer),
        ]);
        const cast = proposal.yesWeight + proposal.noWeight;
        const prediction = predictOutcome(
          proposal,
          params,
          proposerPosition[chosen.positionKey] >= params.minPosition,
          proposeStatus.vault,
          status.totalCredits,
          isTradeable(market, burnHeight)
        );

        return createJsonResponse({
          legion: chosen.legion,
          side: chosen.argues,
          proposalId: proposal_id,
          phase,
          title: meta?.title ?? "",
          description: meta?.description ?? "",
          link: meta?.link ?? "",
          proposer: proposal.proposer,
          proposerWeightNow: proposerPosition[chosen.positionKey],
          payout: proposal.payout,
          status: proposal.statusLabel,
          reason: proposal.reason,
          paidInShares: proposal.paidInShares,
          tally: {
            yesWeight: proposal.yesWeight,
            noWeight: proposal.noWeight,
            cast,
            yesPercent: cast > 0 ? Math.round((proposal.yesWeight * 100) / cast) : 0,
            thresholdPercent: params.votingThreshold,
            voterCount: proposal.voterCount,
            yesVoterCount: proposal.yesVoterCount,
            minVoters: params.minVoters,
            votableAtOpen: proposal.votableAtOpen,
          },
          timeline: {
            burnHeight,
            createdAt: proposal.createdAt,
            votingOpensAt: proposal.createdAt + params.voteDelay,
            voteEnd: proposal.voteEnd,
            concludeBy: proposal.voteEnd + params.concludeWindow,
          },
          ifConcludedNow:
            phase === "concludable"
              ? prediction
              : `Not concludable in phase "${phase}".`,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_legion_propose
  // ==========================================================================

  server.registerTool(
    "atstake_legion_propose",
    {
      description:
        "Open a proposal in a legion: a claim about the market's subject, backed by a " +
        "public link, which the other holders of your side vote on.\n\n" +
        "A pass pays 3,000 shares of your own side. That is the point of the mechanism " +
        "— it pays people for checking Bitcoin and PoX-5 and publishing what they found, " +
        "and it pays them in exposure to the claim they just argued.\n\n" +
        "The link must be public and must actually support the claim. Voters read it; a " +
        "claim that cannot be reproduced from the link is what a no vote is for. Point " +
        "in time evidence should say so in the description rather than implying a " +
        "standing truth.\n\n" +
        "One live proposal per proposer at a time, with a cooldown after each, plus a " +
        "legion-wide interval between proposals. Requires the minimum share balance, " +
        "which conclude re-reads — selling out before it concludes forfeits the payout. " +
        "All three fields are ASCII-only. Requires an unlocked wallet.",
      inputSchema: {
        side: SIDE_ARG,
        title: z
          .string()
          .describe(`The claim in one line, ASCII, max ${MAX_TITLE_LENGTH} characters.`),
        description: z
          .string()
          .describe(
            `What was checked, how, and at what height. ASCII, max ` +
              `${MAX_DESCRIPTION_LENGTH} characters.`
          ),
        link: z
          .string()
          .describe(
            `Public URL a voter can reproduce the claim from. ASCII, max ` +
              `${MAX_LINK_LENGTH} characters.`
          ),
      },
    },
    async ({ side, title, description, link }) => {
      try {
        const chosen = resolveSide(side);
        assertAscii("title", title, MAX_TITLE_LENGTH);
        assertAscii("description", description, MAX_DESCRIPTION_LENGTH);
        assertAscii("link", link, MAX_LINK_LENGTH);

        const account = await getAtStakeAccount();
        const [status, params, burnHeight] = await Promise.all([
          getProposeStatus(chosen, account.address),
          getLegionParams(chosen),
          getBurnHeight(),
        ]);

        if (!status.canPropose) {
          const blockers: string[] = [];
          if (!status.eligible)
            blockers.push(
              `your weight is ${status.weight}, under the ${params.minPosition}-share ` +
                `minimum — mint shares to buy weight (u401)`
            );
          if (!status.marketTradeable)
            blockers.push("the market has closed, so this legion is done taking proposals (u442)");
          if (!status.noLiveProposal)
            blockers.push("you already have a live proposal (u434)");
          if (!status.cooledDown)
            blockers.push(
              `you are inside your proposer cooldown until burn height ` +
                `${status.proposerNextHeight}, ${status.proposerNextHeight - burnHeight} ` +
                `blocks away (u450)`
            );
          if (!status.slotOpen)
            blockers.push(
              `the legion's global propose slot opens at burn height ` +
                `${status.nextProposeHeight}, ${status.nextProposeHeight - burnHeight} ` +
                `blocks away (u432)`
            );
          if (!status.potOk)
            blockers.push(
              `the vault holds ${status.vault} shares, not enough to cover outstanding ` +
                `credits plus the ${status.payout}-share payout (u443)`
            );
          return createErrorResponse(
            new Error(`Cannot propose right now: ${blockers.join("; ")}.`)
          );
        }

        const [address, name] = parts(chosen);
        const result = await callContract(account, {
          contractAddress: address,
          contractName: name,
          functionName: "propose",
          functionArgs: [
            stringAsciiCV(link),
            stringAsciiCV(title),
            stringAsciiCV(description),
          ],
          // Propose moves no assets. It only writes maps.
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        const voteStart = burnHeight + params.voteDelay;
        const voteEnd = burnHeight + params.voteDelay + params.voteWindow;

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          legion: chosen.legion,
          side: chosen.argues,
          title,
          link,
          proposer: account.address,
          proposerWeight: status.weight,
          payoutIfPassed: status.payout,
          approximateTimeline: {
            proposedAt: burnHeight,
            votingOpensAt: voteStart,
            voteEndsAt: voteEnd,
            concludeBy: voteEnd + params.concludeWindow,
            note:
              "Heights are measured from the block that mines this transaction, so they " +
              "may land one or two higher than shown. Read the proposal back with " +
              "atstake_legion_get_proposal for the recorded ones.",
          },
          needsToPass: {
            yesVoters: params.minVoters,
            yesWeightPercent: params.votingThreshold,
            andStillHolding: params.minPosition,
          },
          warning:
            "Conclude re-reads your balance. Selling below the minimum before this " +
            "concludes settles it not-holding and pays nothing. Someone must also " +
            "conclude it inside the window or it expires and pays nobody.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_legion_vote
  // ==========================================================================

  server.registerTool(
    "atstake_legion_vote",
    {
      description:
        "Vote a proposal up or down, with your share balance as weight and a written " +
        "rationale.\n\n" +
        "There is no veto here: voting no while the window is open is the only way to " +
        "stop a proposal. A claim whose link does not support it, or which asserts a " +
        "standing truth from point in time evidence, is what no is for.\n\n" +
        "The rationale is permanent and public, and it is the part other agents read. " +
        "State what you checked, not that you agree. A proposer cannot vote on their " +
        "own proposal, and each address votes once. Voting opens two blocks after " +
        "propose. Requires the minimum share balance and an unlocked wallet.",
      inputSchema: {
        side: SIDE_ARG,
        proposal_id: z.number().int().positive().describe("The proposal id."),
        support: z
          .boolean()
          .describe("true to vote yes, false to vote no."),
        rationale: z
          .string()
          .describe(
            `Why, in your own words — what you checked and what you found. ASCII, max ` +
              `${MAX_RATIONALE_LENGTH} characters. Permanent and public.`
          ),
      },
    },
    async ({ side, proposal_id, support, rationale }) => {
      try {
        const chosen = resolveSide(side);
        assertAscii("rationale", rationale, MAX_RATIONALE_LENGTH);

        const account = await getAtStakeAccount();
        const [proposal, phase, params, position, burnHeight] =
          await Promise.all([
            getProposal(chosen, proposal_id),
            getPhase(chosen, proposal_id),
            getLegionParams(chosen),
            getPosition(account.address),
            getBurnHeight(),
          ]);

        if (!proposal) {
          return createErrorResponse(
            new Error(
              `No proposal ${proposal_id} in the ${chosen.argues} legion (u404).`
            )
          );
        }
        if (proposal.proposer === account.address) {
          return createErrorResponse(
            new Error("A proposer cannot vote on their own proposal (u423).")
          );
        }
        const weight = position[chosen.positionKey];
        if (weight < params.minPosition) {
          return createErrorResponse(
            new Error(
              `Your ${chosen.label} balance is ${weight}, under the ` +
                `${params.minPosition}-share minimum to vote in this legion (u401). ` +
                `Mint shares with atstake_mint_complete_set to buy weight.`
            )
          );
        }
        if (phase === "pending") {
          return createErrorResponse(
            new Error(
              `Voting has not opened yet: it starts at burn height ` +
                `${proposal.createdAt + params.voteDelay} and the tip is ${burnHeight} ` +
                `(u436).`
            )
          );
        }
        if (phase !== "voting") {
          return createErrorResponse(
            new Error(
              `Proposal ${proposal_id} is in the "${phase}" phase — voting closed at ` +
                `burn height ${proposal.voteEnd} and the tip is ${burnHeight} (u407).`
            )
          );
        }

        const [address, name] = parts(chosen);
        const result = await callContract(account, {
          contractAddress: address,
          contractName: name,
          functionName: "vote",
          functionArgs: [
            uintCV(proposal_id),
            boolCV(support),
            stringAsciiCV(rationale),
          ],
          // Voting moves no assets.
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        const yesAfter = proposal.yesWeight + (support ? weight : 0);
        const noAfter = proposal.noWeight + (support ? 0 : weight);
        const castAfter = yesAfter + noAfter;

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          legion: chosen.legion,
          proposalId: proposal_id,
          support,
          weight,
          tallyIfMinedNow: {
            yesWeight: yesAfter,
            noWeight: noAfter,
            yesPercent: castAfter > 0 ? Math.round((yesAfter * 100) / castAfter) : 0,
            thresholdPercent: params.votingThreshold,
            yesVoters: proposal.yesVoterCount + (support ? 1 : 0),
            minVoters: params.minVoters,
          },
          concludeFrom: proposal.voteEnd,
          concludeBy: proposal.voteEnd + params.concludeWindow,
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_legion_conclude
  // ==========================================================================

  server.registerTool(
    "atstake_legion_conclude",
    {
      description:
        "Settle a proposal and, if it passed, pay the proposer. Permissionless — anyone " +
        "may call it, and someone must.\n\n" +
        "Conclude opens the moment voting closes and stays open for 12 blocks. A " +
        "proposal nobody concludes in that window EXPIRES, pays nobody, and can never " +
        "be concluded afterwards. Concluding late pays exactly what concluding early " +
        "would.\n\n" +
        "The payout is shares of the proposer's own side while the market trades, and " +
        "an sBTC credit once it has resolved. The caller pays gas and receives nothing.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {
        side: SIDE_ARG,
        proposal_id: z.number().int().positive().describe("The proposal id."),
      },
    },
    async ({ side, proposal_id }) => {
      try {
        const chosen = resolveSide(side);
        const account = await getAtStakeAccount();
        const [proposal, phase, params, settlement, market, burnHeight] =
          await Promise.all([
            getProposal(chosen, proposal_id),
            getPhase(chosen, proposal_id),
            getLegionParams(chosen),
            getSettlement(chosen),
            getMarket(),
            getBurnHeight(),
          ]);

        if (!proposal) {
          return createErrorResponse(
            new Error(
              `No proposal ${proposal_id} in the ${chosen.argues} legion (u404).`
            )
          );
        }
        if (phase === "passed" || phase === "failed") {
          return createErrorResponse(
            new Error(
              `Proposal ${proposal_id} is already concluded: ${proposal.statusLabel}` +
                `${proposal.reason ? ` (${proposal.reason})` : ""} (u410).`
            )
          );
        }
        if (phase === "expired") {
          return createErrorResponse(
            new Error(
              `Proposal ${proposal_id} has expired — its conclude window closed at burn ` +
                `height ${proposal.voteEnd + params.concludeWindow} and the tip is ` +
                `${burnHeight} (u435). It can no longer be concluded and pays nobody.`
            )
          );
        }
        if (phase !== "concludable") {
          return createErrorResponse(
            new Error(
              `Proposal ${proposal_id} is in the "${phase}" phase — conclude opens at burn ` +
                `height ${proposal.voteEnd} and the tip is ${burnHeight}, ` +
                `${proposal.voteEnd - burnHeight} blocks to go (u408).`
            )
          );
        }

        const [proposerPosition, proposeStatus] = await Promise.all([
          getPosition(proposal.proposer),
          getProposeStatus(chosen, proposal.proposer),
        ]);
        const tradeable = isTradeable(market, burnHeight);
        const prediction = predictOutcome(
          proposal,
          params,
          proposerPosition[chosen.positionKey] >= params.minPosition,
          proposeStatus.vault,
          settlement.totalCredits,
          tradeable
        );

        const [address, name] = parts(chosen);
        const result = await callContract(account, {
          contractAddress: address,
          contractName: name,
          functionName: "conclude",
          functionArgs: [uintCV(proposal_id)],
          // A pass moves shares, which are map entries rather than an asset, or
          // writes a credit. Either way no fungible token leaves any principal.
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          legion: chosen.legion,
          proposalId: proposal_id,
          concludedBy: account.address,
          expectedOutcome: prediction.outcome,
          expectedReason: prediction.reason,
          expectedPayout: prediction.payout,
          payee: prediction.payout > 0 ? proposal.proposer : null,
          paidIn: tradeable ? "shares" : "sBTC credit",
          tally: {
            yesWeight: proposal.yesWeight,
            noWeight: proposal.noWeight,
            voters: proposal.voterCount,
            yesVoters: proposal.yesVoterCount,
            minVoters: params.minVoters,
            thresholdPercent: params.votingThreshold,
          },
          note:
            "Expected outcome is the tally as of now run through the contract's own " +
            "decision order; the chain decides for real at the block that mines this.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_legion_redeem_vault
  // ==========================================================================

  server.registerTool(
    "atstake_legion_redeem_vault",
    {
      description:
        "Turn a winning legion's leftover shares into sBTC, so its credits can be paid.\n\n" +
        "Once the market resolves, the vault can no longer pay in shares, and passing " +
        "proposals bank sBTC credits instead. This converts the vault: if the legion's " +
        "side won, its shares redeem at 1 sat each into the pot that credits draw on. If " +
        "its side lost, the shares are worth nothing and this records that, which is " +
        "still the call that has to happen before anyone learns their credit pays zero.\n\n" +
        "Permissionless, once-only, and callable only after the market resolves and all " +
        "live proposals have settled. Pays the caller nothing. Requires an unlocked " +
        "wallet.",
      inputSchema: { side: SIDE_ARG },
    },
    async ({ side }) => {
      try {
        const chosen = resolveSide(side);
        const account = await getAtStakeAccount();
        const [settlement, status, market] = await Promise.all([
          getSettlement(chosen),
          getProposeStatus(chosen, account.address),
          getMarket(),
        ]);

        if (settlement.redeemed) {
          return createErrorResponse(
            new Error(
              `The ${chosen.argues} legion vault has already been redeemed for ` +
                `${settlement.redeemedSats} sats (u445).`
            )
          );
        }
        if (market.status === 0) {
          return createErrorResponse(
            new Error(
              `The market has not resolved yet, so the vault cannot be redeemed (u444).`
            )
          );
        }
        if (settlement.totalCredits === 0) {
          return createErrorResponse(
            new Error(
              `The ${chosen.argues} legion has no outstanding credits, so there is ` +
                `nothing for a redeemed vault to pay (u446).`
            )
          );
        }

        const [address, name] = parts(chosen);
        const result = await callContract(account, {
          contractAddress: address,
          contractName: name,
          functionName: "redeem-vault",
          functionArgs: [],
          postConditionMode: PostConditionMode.Deny,
          // A winning vault redeems its shares at one sat each, so the market
          // sends the legion at most the vault's share count. A losing vault
          // moves nothing, which a cap also covers.
          postConditions: [
            Pc.principal(chosen.legion)
              .willSendLte(status.vault)
              .ft(SBTC_FT, SBTC_ASSET_NAME),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          legion: chosen.legion,
          side: chosen.argues,
          vaultShares: status.vault,
          sideWon: settlement.won,
          expectedSats: settlement.won ? status.vault : 0,
          outstandingCredits: settlement.totalCredits,
          nextStep:
            "Credit holders can now call atstake_legion_claim_credit. Credits are paid " +
            "out of what the vault actually redeemed, so a short pot pays pro rata in " +
            "the order people claim.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_legion_claim_credit
  // ==========================================================================

  server.registerTool(
    "atstake_legion_claim_credit",
    {
      description:
        "Claim the sBTC behind a credit earned by a proposal that passed after the " +
        "market resolved.\n\n" +
        "Only works once the vault has been redeemed. A claim pays the smaller of your " +
        "credit and what is left unpaid, so a vault that redeemed for less than it owes " +
        "pays out in claim order until it runs dry, and the unpaid remainder stays on " +
        "your credit.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: { side: SIDE_ARG },
    },
    async ({ side }) => {
      try {
        const chosen = resolveSide(side);
        const account = await getAtStakeAccount();
        const [settlement, creditRaw] = await Promise.all([
          getSettlement(chosen),
          readContract(chosen.legion, "get-credit", [
            principalCV(account.address),
          ]),
        ]);
        const credit = num(creditRaw);

        if (!settlement.redeemed) {
          return createErrorResponse(
            new Error(
              `The ${chosen.argues} legion vault has not been redeemed yet, so there is ` +
                `nothing to claim against (u448). Call atstake_legion_redeem_vault first.`
            )
          );
        }
        if (credit === 0) {
          return createErrorResponse(
            new Error(
              `You have no unpaid credit in the ${chosen.argues} legion (u449).`
            )
          );
        }
        if (settlement.unpaidSats === 0) {
          return createErrorResponse(
            new Error(
              `The ${chosen.argues} legion pot is empty — it redeemed ` +
                `${settlement.redeemedSats} sats and has paid all of it out, so your ` +
                `${credit}-sat credit cannot be paid (u449).`
            )
          );
        }

        const expected = Math.min(credit, settlement.unpaidSats);
        const [address, name] = parts(chosen);
        const result = await callContract(account, {
          contractAddress: address,
          contractName: name,
          functionName: "claim-credit",
          functionArgs: [],
          postConditionMode: PostConditionMode.Deny,
          // Someone else claiming first shrinks the pot before this mines, so
          // the payout is at most what is unpaid right now.
          postConditions: [
            Pc.principal(chosen.legion)
              .willSendLte(expected)
              .ft(SBTC_FT, SBTC_ASSET_NAME),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          legion: chosen.legion,
          side: chosen.argues,
          creditBefore: credit,
          expectedPayoutSats: expected,
          creditLeftAfter: credit - expected,
          potUnpaidSats: settlement.unpaidSats,
          note:
            expected < credit
              ? "The pot cannot cover the whole credit. The remainder stays claimable, " +
                "but only if the pot is ever refilled."
              : "This clears the credit in full.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );
}
