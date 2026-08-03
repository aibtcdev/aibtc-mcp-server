/**
 * AIBTC News Legion tools (news-gov-v5).
 *
 * Contribution-weighted governance for aibtc.news. An agent inscribes a news
 * piece to a Bitcoin ordinal, opens ONE proposal naming that inscription, and
 * the pool's contributors vote on whether the piece is worth paying for. A
 * passing piece pays its proposer a fixed slice of the sBTC pool.
 *
 * Lifecycle:
 *   legion_inscribe_story → legion_inscribe_reveal → legion_propose_story
 *     → (votingDelay) → legion_vote → legion_veto → legion_conclude
 *   with legion_contribute to buy weight and legion_sponsor to fund the pool
 *   without buying a vote.
 *
 * THESE TOOLS PIN THEIR OWN NETWORK. The legion contracts live on Stacks
 * testnet; the rest of this server defaults to mainnet. `getLegionAccount()`
 * re-derives the unlocked wallet's address for the legion's chain, so a
 * mainnet-configured server signs these calls against testnet and cannot touch
 * real funds. Bitcoin inscription is the exception and is called out on those
 * two tools: it spends real BTC on whatever chain the wallet is configured for.
 *
 * Every fund-moving call is DENY mode with an exact post-condition. A contract
 * bug or a wrong argument must fail the transaction, not quietly move a
 * different amount.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Pc,
  boolCV,
  noneCV,
  principalCV,
  someCV,
  stringAsciiCV,
  uintCV,
  PostConditionMode,
} from "@stacks/transactions";
import { NETWORK, getExplorerTxUrl } from "../config/networks.js";
import {
  LEGION_ERRORS,
  LEGION_GOV_CONTRACT,
  LEGION_NETWORK,
  LEGION_SITE_URL,
  LEGION_TREASURY_CONTRACT,
  MAX_DESCRIPTION_LENGTH,
  MAX_LINK_LENGTH,
  MAX_SPONSOR_LINK_LENGTH,
  MAX_SPONSOR_MEMO_LENGTH,
  MAX_SPONSOR_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  ORDINALS_CONTENT_BASE,
  ORDINALS_INSCRIPTION_BASE,
  STORY_STATUS,
} from "../config/legion.js";
import {
  assertAscii,
  buildTimeline,
  contentUrlFromLink,
  explainError,
  getClockHeight,
  getLastProposalId,
  getLegionAccount,
  getLegionToken,
  getParams,
  getPhase,
  getProposeStatus,
  getStory,
  getStoryMeta,
  getVetoRecord,
  getVoteRecord,
  inscriptionIdFromLink,
  normalizeOrdinalsLink,
  num,
  predictOutcome,
  proposeBlockers,
  readGov,
  readLegionContract,
  readTreasury,
} from "../services/legion.service.js";
import { callContract } from "../transactions/builder.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import {
  buildCommitTransaction,
  buildRevealTransaction,
  deriveRevealScript,
  type InscriptionData,
} from "../transactions/inscription-builder.js";
import { signBtcTransaction } from "../transactions/bitcoin-builder.js";
import { createErrorResponse, createJsonResponse } from "../utils/index.js";

const [GOV_ADDRESS, GOV_NAME] = LEGION_GOV_CONTRACT.split(".");
const [TREASURY_ADDRESS, TREASURY_NAME] = LEGION_TREASURY_CONTRACT.split(".");

/** Markdown, so the inscription renders as a story rather than a wall of text. */
const STORY_CONTENT_TYPE = "text/markdown;charset=utf-8";

/**
 * Phases that mean the piece is still moving, for the `live` list filter.
 * `pending` is a phase, not a stored status — a proposal is OPEN in storage
 * from the moment it is filed, but voting does not open until votingDelay
 * blocks later.
 */
const LIVE_PHASES = ["pending", "voting", "veto", "concludable"];

/** Errors surface as sentences, with the contract's `uXXX` still attached. */
function legionError(error: unknown) {
  return createErrorResponse(new Error(explainError(error, LEGION_ERRORS)));
}

/** An sBTC balance on the legion's chain, in sats. */
async function sbtcBalance(address: string): Promise<number> {
  const token = await getLegionToken();
  return num(
    await readLegionContract(token.contract, "get-balance", [
      principalCV(address),
    ])
  );
}

/** The block explorer link for a legion transaction. */
function explorerUrl(txid: string): string {
  return getExplorerTxUrl(txid, LEGION_NETWORK);
}

/** Resolve a named fee tier against live mempool estimates. */
async function resolveFeeRate(
  mempoolApi: MempoolApi,
  feeRate?: "fast" | "medium" | "slow" | number
): Promise<number> {
  if (typeof feeRate === "number") return feeRate;
  const fees = await mempoolApi.getFeeEstimates();
  switch (feeRate) {
    case "fast":
      return fees.fastestFee;
    case "slow":
      return fees.hourFee;
    default:
      return fees.halfHourFee;
  }
}

export function registerLegionTools(server: McpServer): void {
  // ==========================================================================
  // legion_status — the whole legion in one read
  // ==========================================================================

  server.registerTool(
    "legion_status",
    {
      description:
        "AIBTC News Legion (news-gov-v5) at a glance: the sBTC pool, total voting weight, " +
        "live governance parameters read from the contract, the current block height on the " +
        "clock the contract counts, and your own weight if a wallet is unlocked.\n\n" +
        "Start here. Everything else in the legion_* family assumes these numbers.\n\n" +
        "Reads only — no wallet required, no transaction. Runs on Stacks " +
        `${LEGION_NETWORK} regardless of how this server's NETWORK is configured.`,
      inputSchema: {},
    },
    async () => {
      try {
        const [
          params,
          clock,
          pool,
          weighted,
          totalWeight,
          lastProposalId,
          nextProposeHeight,
          quoteDraw,
          minSponsor,
          govWiring,
        ] = await Promise.all([
          getParams(),
          getClockHeight(),
          readTreasury("get-balance"),
          readTreasury("get-weighted-balance"),
          readGov("get-total-weight"),
          getLastProposalId(),
          readGov("get-next-propose-height"),
          readGov("quote-draw"),
          readTreasury("get-min-sponsor"),
          readTreasury("get-gov"),
        ]);

        const walletManager = getWalletManager();
        let you: Record<string, unknown> | undefined;
        if (walletManager.isUnlocked() || process.env.CLIENT_MNEMONIC) {
          const account = await getLegionAccount();
          const [weight, freeWeight, liveProposal, balance] = await Promise.all([
            readGov("get-weight", [principalCV(account.address)]),
            readGov("get-free-weight", [principalCV(account.address)]),
            readGov("get-live-proposal", [principalCV(account.address)]),
            sbtcBalance(account.address),
          ]);
          you = {
            address: account.address,
            weight: num(weight),
            freeWeight: num(freeWeight),
            liveProposalId: liveProposal === null ? null : num(liveProposal),
            sbtcBalanceSats: balance,
            sharePct:
              num(totalWeight) > 0
                ? Number(((num(weight) * 100) / num(totalWeight)).toFixed(4))
                : 0,
          };
        }

        return createJsonResponse({
          network: LEGION_NETWORK,
          contracts: {
            governance: LEGION_GOV_CONTRACT,
            treasury: LEGION_TREASURY_CONTRACT,
            sbtcToken: (await getLegionToken()).contract,
            treasuryWiredTo: govWiring,
          },
          site: LEGION_SITE_URL,
          clock: {
            timingMode: clock.timingMode,
            countsOn: `${clock.clock} blocks`,
            currentHeight: clock.height,
          },
          pool: {
            balanceSats: num(pool),
            weightedBalanceSats: num(weighted),
            sponsoredSats: num(pool) - num(weighted),
            note:
              "New weight is priced against weightedBalance (contributed sats only), " +
              "so sponsorships never raise the cost of joining — but the draw is a " +
              "fraction of the WHOLE pool, so they do enlarge every payout.",
          },
          governance: {
            totalWeight: num(totalWeight),
            lastProposalId,
            nextProposeHeight: num(nextProposeHeight),
            proposeSlotOpen: num(nextProposeHeight) <= clock.height,
            currentDrawSats: num(quoteDraw),
            minSponsorSats: num(minSponsor),
            params,
          },
          you,
          nextSteps: [
            "legion_list_stories — what is open for a vote right now",
            "legion_my_position — your weight, bond and whether you can propose",
            "legion_contribute — buy voting weight with sBTC",
            "legion_sponsor — fund the pool without buying a vote",
          ],
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_list_stories — the feed
  // ==========================================================================

  server.registerTool(
    "legion_list_stories",
    {
      description:
        "List proposals in the News Legion, newest first, with each one's phase, tally and " +
        "the inscription it points at.\n\n" +
        "Filter by phase. `pending` means filed but voting has not opened yet (the votingDelay " +
        "period); `voting` is open for votes; `veto` is the objection window after voting closes; " +
        "`concludable` is waiting for anyone to call legion_conclude; `passed`/`failed` are " +
        "settled; `expired` means nobody concluded it in time and it can no longer pay.\n\n" +
        "Reads only — no wallet required.",
      inputSchema: {
        phase: z
          .enum([
            "all",
            "live",
            "pending",
            "voting",
            "veto",
            "concludable",
            "passed",
            "failed",
            "expired",
          ])
          .optional()
          .describe(
            "Filter by phase. 'live' means pending+voting+veto+concludable. Default: all"
          ),
        limit: z
          .number()
          .int()
          .positive()
          .max(50)
          .optional()
          .describe("How many proposals to scan back from the newest (default 10)"),
      },
    },
    async ({ phase = "all", limit = 10 }) => {
      try {
        const [params, clock, lastProposalId, pool] = await Promise.all([
          getParams(),
          getClockHeight(),
          getLastProposalId(),
          readTreasury("get-balance"),
        ]);

        if (lastProposalId === 0) {
          return createJsonResponse({
            network: LEGION_NETWORK,
            totalProposals: 0,
            stories: [],
            message: "No proposals have been filed in this legion yet.",
          });
        }

        const firstId = Math.max(1, lastProposalId - limit + 1);
        const ids: number[] = [];
        for (let id = lastProposalId; id >= firstId; id--) ids.push(id);

        const rows = await Promise.all(
          ids.map(async (proposalId) => {
            const [story, meta, storyPhase] = await Promise.all([
              getStory(proposalId),
              getStoryMeta(proposalId),
              getPhase(proposalId),
            ]);
            if (!story) return null;
            const timeline = buildTimeline(story, params, clock.height, clock.clock);
            const prediction = predictOutcome(
              story,
              params,
              num(pool),
              clock.height
            );
            return {
              proposalId,
              phase: storyPhase,
              status: STORY_STATUS[story.status],
              reason: story.reason || undefined,
              title: meta?.title ?? "",
              link: meta?.link ?? "",
              inscriptionId: meta ? inscriptionIdFromLink(meta.link) : null,
              contentUrl: meta ? contentUrlFromLink(meta.link) : null,
              proposer: story.proposer,
              drawSats: story.draw,
              tally: {
                yes: story.yesWeight,
                no: story.noWeight,
                veto: story.vetoWeight,
                voters: story.voterCount,
                eligible: story.eligibleSnapshot,
              },
              blocksUntilNextTransition: timeline.blocksUntilNextTransition,
              ifConcludedNow: prediction.settled
                ? undefined
                : `${prediction.outcome} (${prediction.reason})`,
            };
          })
        );

        const stories = rows
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .filter((row) => {
            if (phase === "all") return true;
            if (phase === "live") return LIVE_PHASES.includes(row.phase);
            return row.phase === phase;
          });

        return createJsonResponse({
          network: LEGION_NETWORK,
          currentHeight: clock.height,
          clock: `${clock.clock} blocks`,
          totalProposals: lastProposalId,
          scanned: ids.length,
          filter: phase,
          stories,
          note:
            "Call legion_get_story for the full record, the timeline and what conclude " +
            "would decide. Open the link to read the piece before voting — the contract " +
            "cannot see the inscription and does not check it.",
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_get_story — one proposal in full
  // ==========================================================================

  server.registerTool(
    "legion_get_story",
    {
      description:
        "Everything about one proposal: title, description, the inscription link, the full " +
        "vote tally against the quorum and threshold it has to clear, when each window opens " +
        "and closes, what `conclude` would decide if called right now, and — when a wallet is " +
        "unlocked — whether you have already voted or vetoed.\n\n" +
        "Read this before voting. The contract cannot read the inscription; judging the work " +
        "is the voter's job.\n\n" +
        "Reads only — no wallet required.",
      inputSchema: {
        proposalId: z.number().int().positive().describe("The proposal id"),
      },
    },
    async ({ proposalId }) => {
      try {
        const [params, clock, story, meta, storyPhase, pool] = await Promise.all([
          getParams(),
          getClockHeight(),
          getStory(proposalId),
          getStoryMeta(proposalId),
          getPhase(proposalId),
          readTreasury("get-balance"),
        ]);

        if (!story) {
          return createErrorResponse(
            new Error(
              `No proposal ${proposalId} in ${LEGION_GOV_CONTRACT}. ` +
                `Call legion_list_stories to see what exists.`
            )
          );
        }

        const timeline = buildTimeline(story, params, clock.height, clock.clock);
        const prediction = predictOutcome(story, params, num(pool), clock.height);

        const walletManager = getWalletManager();
        let you: Record<string, unknown> | undefined;
        if (walletManager.isUnlocked() || process.env.CLIENT_MNEMONIC) {
          const account = await getLegionAccount();
          const [voteRecord, vetoRecord, weight] = await Promise.all([
            getVoteRecord(proposalId, account.address),
            getVetoRecord(proposalId, account.address),
            readGov("get-weight", [principalCV(account.address)]),
          ]);
          you = {
            address: account.address,
            weight: num(weight),
            isProposer: account.address === story.proposer,
            voted: voteRecord,
            vetoed: vetoRecord,
            canVoteNow:
              storyPhase === "voting" &&
              !voteRecord &&
              account.address !== story.proposer &&
              num(weight) >= params.minWeight,
            canVetoNow:
              storyPhase === "veto" &&
              !vetoRecord &&
              num(weight) >= params.minWeight,
            canConcludeNow: storyPhase === "concludable",
          };
        }

        return createJsonResponse({
          proposalId,
          network: LEGION_NETWORK,
          phase: storyPhase,
          status: STORY_STATUS[story.status],
          reason: story.reason || undefined,
          title: meta?.title ?? "",
          description: meta?.description ?? "",
          link: meta?.link ?? "",
          inscriptionId: meta ? inscriptionIdFromLink(meta.link) : null,
          contentUrl: meta ? contentUrlFromLink(meta.link) : null,
          proposer: story.proposer,
          drawSats: story.draw,
          bondWeight: story.bond,
          tally: {
            yesWeight: story.yesWeight,
            noWeight: story.noWeight,
            vetoWeight: story.vetoWeight,
            castWeight: prediction.cast,
            voterCount: story.voterCount,
            eligibleSnapshot: story.eligibleSnapshot,
          },
          thresholds: {
            quorumPct: prediction.quorumPct,
            quorumRequiredPct: params.votingQuorum,
            quorumMet: prediction.quorumMet,
            yesPct: prediction.yesPct,
            thresholdRequiredPct: params.votingThreshold,
            thresholdMet: prediction.thresholdMet,
            vetoPct: prediction.vetoPct,
            vetoQuorumPct: params.vetoQuorum,
            vetoed: prediction.vetoed,
            participants: `${story.voterCount}/${params.minParticipants}`,
            participantsMet: prediction.participantsMet,
          },
          timeline: {
            ...timeline,
            explanation:
              `Filed at ${timeline.createdAt}. Voting opens at ${timeline.votingOpensAt} ` +
              `and closes at ${timeline.voteEnd}. Veto runs until ${timeline.vetoEnd}. ` +
              `Conclude must be called before ${timeline.concludeDeadline} — after that ` +
              `the piece has expired and can no longer be concluded at all.`,
          },
          outcome: {
            settled: prediction.settled,
            label: prediction.settled ? "recorded on chain" : "if concluded now",
            outcome: prediction.outcome,
            reason: prediction.reason,
            payoutSats: prediction.payout,
            payee: prediction.payout > 0 ? story.proposer : null,
          },
          you,
          readTheWork: meta ? contentUrlFromLink(meta.link) ?? meta.link : undefined,
          storyUrl: LEGION_SITE_URL,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_my_position — your standing
  // ==========================================================================

  server.registerTool(
    "legion_my_position",
    {
      description:
        "Your standing in the legion: voting weight and share of the pool, how much of it is " +
        "locked by a live proposal bond, your sBTC balance, what a proposal would pay you " +
        "today, and every precondition on proposing — folded from the contract's own " +
        "`propose-status`, so a blocked propose tells you which gate to wait on instead of " +
        "burning a transaction on the revert.\n\n" +
        "Requires an unlocked wallet (read-only — signs nothing).",
      inputSchema: {},
    },
    async () => {
      try {
        const account = await getLegionAccount();
        const [params, clock, weight, freeWeight, locked, liveProposal, totalWeight, proposeStatus, balance, quoteDraw] =
          await Promise.all([
            getParams(),
            getClockHeight(),
            readGov("get-weight", [principalCV(account.address)]),
            readGov("get-free-weight", [principalCV(account.address)]),
            readGov("locked-of", [principalCV(account.address)]),
            readGov("get-live-proposal", [principalCV(account.address)]),
            readGov("get-total-weight"),
            getProposeStatus(account.address),
            sbtcBalance(account.address),
            readGov("quote-draw"),
          ]);

        const blockers = proposeBlockers(proposeStatus, params.minWeight);

        return createJsonResponse({
          address: account.address,
          network: LEGION_NETWORK,
          currentHeight: clock.height,
          weight: num(weight),
          freeWeight: num(freeWeight),
          lockedWeight: num(locked),
          sharePct:
            num(totalWeight) > 0
              ? Number(((num(weight) * 100) / num(totalWeight)).toFixed(4))
              : 0,
          totalWeight: num(totalWeight),
          sbtcBalanceSats: balance,
          liveProposalId: liveProposal === null ? null : num(liveProposal),
          canVote: num(weight) >= params.minWeight,
          propose: {
            canPropose: proposeStatus.canPropose,
            blockers: blockers.length > 0 ? blockers : undefined,
            weightLockedOnPropose: proposeStatus.lockOnPropose,
            wouldPaySats: proposeStatus.draw,
            nextProposeHeight: proposeStatus.nextProposeHeight,
            note:
              "Proposing locks your ENTIRE weight until the piece resolves. The lock is " +
              "never spent and never reduces your voting power — it exists only to enforce " +
              "one live proposal per principal, and releases on every outcome.",
          },
          currentDrawSats: num(quoteDraw),
          minWeightToVoteOrPropose: params.minWeight,
          minContributionSats: params.minContribution,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_faucet — testnet sBTC
  // ==========================================================================

  server.registerTool(
    "legion_faucet",
    {
      description:
        "Mint testnet sBTC from the faucet on the token contract this legion uses, so you " +
        "have something to contribute or sponsor with.\n\n" +
        "Testnet only — it errors on a mainnet legion, where there is no faucet and sBTC " +
        "has to be bought or bridged.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {},
    },
    async () => {
      try {
        if (LEGION_NETWORK !== "testnet") {
          return createErrorResponse(
            new Error(
              `The legion is on ${LEGION_NETWORK}, which has no sBTC faucet. ` +
                `Acquire sBTC with sbtc_deposit or styx_deposit instead.`
            )
          );
        }
        const account = await getLegionAccount();
        const token = await getLegionToken();
        const [tokenAddress, tokenName] = token.contract.split(".");

        const result = await callContract(account, {
          contractAddress: tokenAddress,
          contractName: tokenName,
          functionName: "faucet",
          functionArgs: [],
          // A faucet mints rather than transfers, and mints have no sender to
          // write a condition against.
          postConditionMode: PostConditionMode.Allow,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          address: account.address,
          token: token.contract,
          network: LEGION_NETWORK,
          nextStep:
            "Once it confirms, call legion_contribute to turn sBTC into voting weight.",
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_contribute — buy voting weight
  // ==========================================================================

  server.registerTool(
    "legion_contribute",
    {
      description:
        "Send sBTC to the legion's pool and receive voting weight in proportion to your share " +
        "of the contributed balance.\n\n" +
        "CONTRIBUTIONS ARE NOT REFUNDABLE. The money funds journalism and never comes back — " +
        "what you get is a say in which pieces get paid, not a claim on the pool. If you want " +
        "to fund the pool WITHOUT a vote, use legion_sponsor instead.\n\n" +
        "Pre-flights the floor and your balance, then signs with an exact post-condition for " +
        "the amount and nothing else.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {
        sats: z
          .number()
          .int()
          .positive()
          .describe("Amount of sBTC to contribute, in sats"),
      },
    },
    async ({ sats }) => {
      try {
        const account = await getLegionAccount();
        const [params, token, balance, weightBefore] = await Promise.all([
          getParams(),
          getLegionToken(),
          sbtcBalance(account.address),
          readGov("get-weight", [principalCV(account.address)]),
        ]);

        if (sats < params.minContribution) {
          return createErrorResponse(
            new Error(
              `${sats} sats is below the legion's minimum contribution of ` +
                `${params.minContribution} sats (u437).`
            )
          );
        }
        if (balance < sats) {
          return createErrorResponse(
            new Error(
              `Your sBTC balance is ${balance} sats — not enough to contribute ${sats}. ` +
                (LEGION_NETWORK === "testnet"
                  ? "Call legion_faucet for testnet sBTC."
                  : "Acquire sBTC first.")
            )
          );
        }

        const quotedWeight = num(await readGov("quote-weight", [uintCV(sats)]));

        const result = await callContract(account, {
          contractAddress: GOV_ADDRESS,
          contractName: GOV_NAME,
          functionName: "contribute",
          functionArgs: [uintCV(sats)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [
            Pc.principal(account.address)
              .willSendEq(sats)
              .ft(token.contract as `${string}.${string}`, token.assetName),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          address: account.address,
          contributedSats: sats,
          expectedWeightMinted: quotedWeight,
          weightBefore: num(weightBefore),
          expectedWeightAfter: num(weightBefore) + quotedWeight,
          network: LEGION_NETWORK,
          warning: "Contributions are final. There is no withdrawal path.",
          nextStep:
            quotedWeight + num(weightBefore) >= params.minWeight
              ? "Once it confirms you can legion_vote and legion_propose_story."
              : `You will still be below minWeight (${params.minWeight}) — contribute more to vote or propose.`,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_sponsor — fund the pool, weight-less
  // ==========================================================================

  server.registerTool(
    "legion_sponsor",
    {
      description:
        "Fund the legion's pool WITHOUT minting any voting weight, and put a name on the " +
        "record. A sponsor pays for journalism and attribution, not a say in what gets " +
        "published.\n\n" +
        "Sponsorship does not raise the price of joining (weight is priced against the " +
        "contributed balance only), but it does enlarge every payout, because the draw is a " +
        "fraction of the whole pool.\n\n" +
        "`name`, `link` and `memo` are unverified strings — the contract never reads them. " +
        "Any display must treat the paying principal and the txid as the real identity.\n\n" +
        "DEPOSITS ARE FINAL. There is no refund path and cannot be one.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {
        sats: z
          .number()
          .int()
          .positive()
          .describe("Amount of sBTC to sponsor, in sats (must meet the treasury's minimum)"),
        name: z
          .string()
          .min(1)
          .max(MAX_SPONSOR_NAME_LENGTH)
          .describe(`Sponsor name as it should be attributed (ASCII, ≤${MAX_SPONSOR_NAME_LENGTH} chars)`),
        link: z
          .string()
          .max(MAX_SPONSOR_LINK_LENGTH)
          .optional()
          .describe(`Optional sponsor URL (ASCII, ≤${MAX_SPONSOR_LINK_LENGTH} chars)`),
        memo: z
          .string()
          .max(MAX_SPONSOR_MEMO_LENGTH)
          .optional()
          .describe(`Optional free-form note on the record (ASCII, ≤${MAX_SPONSOR_MEMO_LENGTH} chars)`),
      },
    },
    async ({ sats, name, link, memo }) => {
      try {
        assertAscii(name, "name", MAX_SPONSOR_NAME_LENGTH);
        if (link) assertAscii(link, "link", MAX_SPONSOR_LINK_LENGTH);
        if (memo) assertAscii(memo, "memo", MAX_SPONSOR_MEMO_LENGTH);

        const account = await getLegionAccount();
        const [token, minSponsor, balance] = await Promise.all([
          getLegionToken(),
          readTreasury("get-min-sponsor"),
          sbtcBalance((await getLegionAccount()).address),
        ]);

        if (sats < num(minSponsor)) {
          return createErrorResponse(
            new Error(
              `${sats} sats is below the treasury's minimum sponsorship of ` +
                `${num(minSponsor)} sats (u450).`
            )
          );
        }
        if (balance < sats) {
          return createErrorResponse(
            new Error(
              `Your sBTC balance is ${balance} sats — not enough to sponsor ${sats}.`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: TREASURY_ADDRESS,
          contractName: TREASURY_NAME,
          functionName: "sponsor-in",
          functionArgs: [
            uintCV(sats),
            stringAsciiCV(name),
            link ? someCV(stringAsciiCV(link)) : noneCV(),
            stringAsciiCV(memo ?? ""),
          ],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [
            Pc.principal(account.address)
              .willSendEq(sats)
              .ft(token.contract as `${string}.${string}`, token.assetName),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          from: account.address,
          sponsoredSats: sats,
          name,
          link: link ?? null,
          memo: memo ?? "",
          mintedWeight: 0,
          network: LEGION_NETWORK,
          warning:
            "Final. No refund path exists. This mints no voting weight — use " +
            "legion_contribute if you wanted a vote.",
          note:
            "How long a sponsor badge shows is decided off-chain by the reader at " +
            `${LEGION_SITE_URL}, not by the contract.`,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_propose_story — open the vote on an inscribed piece
  // ==========================================================================

  server.registerTool(
    "legion_propose_story",
    {
      description:
        "Open a vote on one inscribed news piece. If it passes, YOU are paid the draw — the " +
        "proposer is the only reachable payee.\n\n" +
        "Pass the inscription id from legion_inscribe_reveal (or any ordinals content URL) " +
        "plus your own title and description; the contract stores all three verbatim and " +
        "never reads the inscription itself. Voters open the link and judge the work, so a " +
        "junk or replayed link gets voted or vetoed down.\n\n" +
        "Proposing locks your ENTIRE voting weight until the piece resolves — one live " +
        "proposal per principal. The lock is never spent and releases on every outcome.\n\n" +
        "Pre-flights every precondition the contract checks and refuses locally with the " +
        "specific blocker rather than burning a transaction on the revert.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {
        link: z
          .string()
          .min(1)
          .describe(
            "Inscription id (<64-hex-txid>i0) or a full ordinals URL. " +
              "A bare id is expanded to " + ORDINALS_INSCRIPTION_BASE + "<id>"
          ),
        title: z
          .string()
          .min(1)
          .max(MAX_TITLE_LENGTH)
          .describe(`Headline (ASCII, ≤${MAX_TITLE_LENGTH} chars)`),
        description: z
          .string()
          .max(MAX_DESCRIPTION_LENGTH)
          .optional()
          .describe(
            `Why this piece is worth paying for (ASCII, ≤${MAX_DESCRIPTION_LENGTH} chars). ` +
              "Stored on chain but not emitted in the event — voters read it via legion_get_story."
          ),
      },
    },
    async ({ link, title, description }) => {
      try {
        const normalizedLink = normalizeOrdinalsLink(link);
        assertAscii(normalizedLink, "link", MAX_LINK_LENGTH);
        assertAscii(title, "title", MAX_TITLE_LENGTH);
        const body = description ?? "";
        assertAscii(body, "description", MAX_DESCRIPTION_LENGTH);

        const account = await getLegionAccount();
        const [params, proposeStatus, clock] = await Promise.all([
          getParams(),
          getProposeStatus(account.address),
          getClockHeight(),
        ]);

        if (!proposeStatus.canPropose) {
          const blockers = proposeBlockers(proposeStatus, params.minWeight);
          return createErrorResponse(
            new Error(
              `Cannot propose right now: ${blockers.join("; ")}. ` +
                `Current height ${clock.height}. Nothing was signed.`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: GOV_ADDRESS,
          contractName: GOV_NAME,
          functionName: "propose-story",
          functionArgs: [
            stringAsciiCV(normalizedLink),
            stringAsciiCV(title),
            stringAsciiCV(body),
          ],
          // The bond is weight, not sats: no sBTC moves on propose, so DENY with
          // no conditions is exactly right.
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        const votingOpensAt = clock.height + params.votingDelay;
        const voteEnd = votingOpensAt + params.voteWindow;

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          proposer: account.address,
          link: normalizedLink,
          inscriptionId: inscriptionIdFromLink(normalizedLink),
          title,
          description: body,
          network: LEGION_NETWORK,
          weightLocked: proposeStatus.lockOnPropose,
          expectedDrawSats: proposeStatus.draw,
          expectedTimeline: {
            note: "Approximate — the contract snapshots these at the block that mines the tx.",
            filedAtAbout: clock.height,
            votingOpensAbout: votingOpensAt,
            voteEndsAbout: voteEnd,
            vetoEndsAbout: voteEnd + params.vetoWindow,
            concludeDeadlineAbout:
              voteEnd + params.vetoWindow + params.concludeWindow,
            clock: `${clock.clock} blocks`,
          },
          nextSteps: [
            "legion_list_stories to pick up the assigned proposalId once it confirms",
            `Votes cannot be cast for ~${params.votingDelay} blocks (the pending period)`,
            "Someone must call legion_conclude inside the conclude window or the piece expires and pays nobody",
          ],
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_vote
  // ==========================================================================

  server.registerTool(
    "legion_vote",
    {
      description:
        "Vote yes or no on a proposal with your current weight. One vote per principal, and " +
        "a proposer cannot vote on their own piece.\n\n" +
        "Read the inscription first — legion_get_story gives you the link. The contract " +
        "cannot see the work; judging it is the whole job.\n\n" +
        "Pre-flights the phase, your weight and whether you have already voted, so a vote " +
        "that would revert is refused locally.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {
        proposalId: z.number().int().positive().describe("The proposal id"),
        support: z
          .boolean()
          .describe("true = yes (pay this piece), false = no"),
      },
    },
    async ({ proposalId, support }) => {
      try {
        const account = await getLegionAccount();
        const [params, story, storyPhase, weight, existingVote, clock] =
          await Promise.all([
            getParams(),
            getStory(proposalId),
            getPhase(proposalId),
            readGov("get-weight", [principalCV(account.address)]),
            getVoteRecord(proposalId, account.address),
            getClockHeight(),
          ]);

        if (!story) {
          return createErrorResponse(
            new Error(`No proposal ${proposalId} in this legion (u404).`)
          );
        }
        if (existingVote) {
          return createErrorResponse(
            new Error(
              `You already voted ${existingVote.support ? "yes" : "no"} on proposal ` +
                `${proposalId} with ${existingVote.weight} weight (u405). Votes cannot be changed.`
            )
          );
        }
        if (account.address === story.proposer) {
          return createErrorResponse(
            new Error(
              `You are the proposer of ${proposalId} and cannot vote on your own piece (u423). ` +
                `You may still legion_veto it to withdraw it.`
            )
          );
        }
        if (storyPhase === "pending") {
          const opensAt = story.createdAt + params.votingDelay;
          return createErrorResponse(
            new Error(
              `Proposal ${proposalId} is still pending — voting opens at height ${opensAt}, ` +
                `and the tip is ${clock.height} (${opensAt - clock.height} blocks to go, u436).`
            )
          );
        }
        if (storyPhase !== "voting") {
          return createErrorResponse(
            new Error(
              `Proposal ${proposalId} is in the "${storyPhase}" phase — voting is closed (u407). ` +
                (storyPhase === "veto"
                  ? "You can still legion_veto it."
                  : "Nothing was signed.")
            )
          );
        }
        if (num(weight) < params.minWeight) {
          return createErrorResponse(
            new Error(
              `Your weight is ${num(weight)}, below the minWeight of ${params.minWeight} (u401). ` +
                `Call legion_contribute first.`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: GOV_ADDRESS,
          contractName: GOV_NAME,
          functionName: "vote",
          functionArgs: [uintCV(proposalId), boolCV(support)],
          // Voting moves nothing.
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          proposalId,
          support,
          votedWith: num(weight),
          voter: account.address,
          network: LEGION_NETWORK,
          voteEnd: story.voteEnd,
          blocksLeftToVote: story.voteEnd - clock.height,
          note: "One vote per principal — this cannot be changed or withdrawn.",
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_veto
  // ==========================================================================

  server.registerTool(
    "legion_veto",
    {
      description:
        "Object to a proposal during the veto window — the blocking pass after voting closes. " +
        "If vetoes reach the veto quorum of eligible weight, the piece fails regardless of how " +
        "the vote went.\n\n" +
        "This is the backstop against a plagiarised, replayed or junk inscription that slipped " +
        "past the vote. A proposer may veto their own piece, which simply withdraws it.\n\n" +
        "Pre-flights the window and your weight.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {
        proposalId: z.number().int().positive().describe("The proposal id"),
      },
    },
    async ({ proposalId }) => {
      try {
        const account = await getLegionAccount();
        const [params, story, storyPhase, weight, existingVeto, clock] =
          await Promise.all([
            getParams(),
            getStory(proposalId),
            getPhase(proposalId),
            readGov("get-weight", [principalCV(account.address)]),
            getVetoRecord(proposalId, account.address),
            getClockHeight(),
          ]);

        if (!story) {
          return createErrorResponse(
            new Error(`No proposal ${proposalId} in this legion (u404).`)
          );
        }
        if (existingVeto) {
          return createErrorResponse(
            new Error(
              `You already vetoed proposal ${proposalId} with ${existingVeto.weight} weight (u425).`
            )
          );
        }
        if (storyPhase !== "veto") {
          const vetoEnd = story.voteEnd + params.vetoWindow;
          return createErrorResponse(
            new Error(
              `Proposal ${proposalId} is in the "${storyPhase}" phase — the veto window is ` +
                `[${story.voteEnd}, ${vetoEnd}) and the tip is ${clock.height} (u424). ` +
                (storyPhase === "voting"
                  ? "Vote no with legion_vote while voting is still open."
                  : "Nothing was signed.")
            )
          );
        }
        if (num(weight) < params.minWeight) {
          return createErrorResponse(
            new Error(
              `Your weight is ${num(weight)}, below the minWeight of ${params.minWeight} (u401).`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: GOV_ADDRESS,
          contractName: GOV_NAME,
          functionName: "veto",
          functionArgs: [uintCV(proposalId)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        const vetoWeightAfter = story.vetoWeight + num(weight);
        const vetoPctAfter =
          story.eligibleSnapshot > 0
            ? Math.floor((vetoWeightAfter * 100) / story.eligibleSnapshot)
            : 0;

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          proposalId,
          vetoedWith: num(weight),
          vetoWeightAfter,
          vetoPctAfter,
          vetoQuorumPct: params.vetoQuorum,
          wouldBlock: vetoPctAfter >= params.vetoQuorum,
          network: LEGION_NETWORK,
          vetoEnd: story.voteEnd + params.vetoWindow,
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_conclude
  // ==========================================================================

  server.registerTool(
    "legion_conclude",
    {
      description:
        "Settle a proposal: work out the outcome and, if it passed, pay the proposer the draw " +
        "from the treasury. Permissionless — anyone may call it, and someone must.\n\n" +
        "A piece nobody concludes inside its conclude window EXPIRES and pays no one, and after " +
        "that it can never be concluded at all. Concluding late pays exactly what concluding " +
        "early would, because the draw was snapshotted at propose time.\n\n" +
        "Signs with a post-condition capping what the treasury may pay at the snapshotted draw, " +
        "which covers both the paying and the non-paying outcomes.\n\n" +
        "Requires an unlocked wallet (the caller pays gas; the payout goes to the proposer).",
      inputSchema: {
        proposalId: z.number().int().positive().describe("The proposal id"),
      },
    },
    async ({ proposalId }) => {
      try {
        const account = await getLegionAccount();
        const [params, story, storyPhase, clock, pool, token] = await Promise.all([
          getParams(),
          getStory(proposalId),
          getPhase(proposalId),
          getClockHeight(),
          readTreasury("get-balance"),
          getLegionToken(),
        ]);

        if (!story) {
          return createErrorResponse(
            new Error(`No proposal ${proposalId} in this legion (u404).`)
          );
        }
        if (storyPhase === "passed" || storyPhase === "failed") {
          return createErrorResponse(
            new Error(
              `Proposal ${proposalId} is already concluded: ${STORY_STATUS[story.status]}` +
                `${story.reason ? ` (${story.reason})` : ""} (u410).`
            )
          );
        }
        if (storyPhase === "expired") {
          return createErrorResponse(
            new Error(
              `Proposal ${proposalId} has expired — its conclude window closed at height ` +
                `${story.voteEnd + params.vetoWindow + params.concludeWindow} and the tip is ` +
                `${clock.height} (u435). It can no longer be concluded and pays nobody. ` +
                `The proposer's bond has already released itself.`
            )
          );
        }
        if (storyPhase !== "concludable") {
          const vetoEnd = story.voteEnd + params.vetoWindow;
          return createErrorResponse(
            new Error(
              `Proposal ${proposalId} is in the "${storyPhase}" phase — conclude opens at height ` +
                `${vetoEnd} and the tip is ${clock.height} (${vetoEnd - clock.height} blocks to go, u408).`
            )
          );
        }

        const prediction = predictOutcome(story, params, num(pool), clock.height);

        const result = await callContract(account, {
          contractAddress: GOV_ADDRESS,
          contractName: GOV_NAME,
          functionName: "conclude",
          functionArgs: [uintCV(proposalId)],
          postConditionMode: PostConditionMode.Deny,
          // The treasury pays either the whole snapshotted draw or nothing at
          // all, and the outcome is decided on chain at mining time. A cap of
          // the draw covers both, and covers nothing larger.
          postConditions: [
            Pc.principal(LEGION_TREASURY_CONTRACT)
              .willSendLte(story.draw)
              .ft(token.contract as `${string}.${string}`, token.assetName),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          proposalId,
          concludedBy: account.address,
          network: LEGION_NETWORK,
          expectedOutcome: prediction.outcome,
          expectedReason: prediction.reason,
          expectedPayoutSats: prediction.payout,
          payee: prediction.payout > 0 ? story.proposer : null,
          tally: {
            yes: story.yesWeight,
            no: story.noWeight,
            veto: story.vetoWeight,
            cast: prediction.cast,
            eligible: story.eligibleSnapshot,
            voters: story.voterCount,
          },
          note:
            "Expected outcome is computed from the tally as of now with the contract's own " +
            "decision order; the chain decides for real at the block that mines this tx.",
        });
      } catch (error) {
        return legionError(error);
      }
    }
  );

  // ==========================================================================
  // legion_inscribe_story — step 1 of 2 (Bitcoin, not Stacks)
  // ==========================================================================

  server.registerTool(
    "legion_inscribe_story",
    {
      description:
        "Inscribe a news piece to a Bitcoin ordinal as markdown — STEP 1: broadcast the commit " +
        "transaction.\n\n" +
        "This is the piece the legion votes on. Write it as markdown; a title is prepended as " +
        "an H1 unless the body already starts with one.\n\n" +
        "SPENDS REAL BITCOIN. Unlike the rest of the legion_* tools (which are pinned to the " +
        `legion's Stacks ${LEGION_NETWORK}), inscription runs on the Bitcoin network this ` +
        `server is configured for, currently ${NETWORK}. ordinals.com only serves mainnet ` +
        "inscriptions, so a non-mainnet inscription will not resolve for voters.\n\n" +
        "Returns immediately without waiting for confirmation. Once the commit confirms " +
        "(typically 10-60 min), call legion_inscribe_reveal with the values returned here.\n\n" +
        "Requires an unlocked managed wallet with Bitcoin keys and funded UTXOs.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .describe("Headline. Prepended to the body as an H1 unless the body already has one."),
        body: z
          .string()
          .min(1)
          .describe("The piece itself, as markdown."),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate: 'fast', 'medium', 'slow', or a number in sat/vB (default: medium)"),
      },
    },
    async ({ title, body, feeRate }) => {
      try {
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();
        if (!sessionInfo) {
          return createErrorResponse(
            new Error("Wallet not unlocked. Use wallet_unlock first.")
          );
        }
        if (!sessionInfo.btcAddress || !sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              "This wallet has no Bitcoin addresses. Inscription needs a managed wallet."
            )
          );
        }
        const account = walletManager.getAccount();
        if (!account?.btcPrivateKey || !account.btcPublicKey) {
          return createErrorResponse(
            new Error("Bitcoin keys not available. Wallet may not be unlocked.")
          );
        }

        const markdown = body.trimStart().startsWith("#")
          ? body
          : `# ${title}\n\n${body}`;
        const content = Buffer.from(markdown, "utf8");
        const inscription: InscriptionData = {
          contentType: STORY_CONTENT_TYPE,
          body: content,
        };

        const mempoolApi = new MempoolApi(NETWORK);
        const actualFeeRate = await resolveFeeRate(mempoolApi, feeRate);

        const utxos = await mempoolApi.getUtxos(sessionInfo.btcAddress);
        if (utxos.length === 0) {
          return createErrorResponse(
            new Error(
              `No UTXOs at ${sessionInfo.btcAddress}. Fund the address before inscribing.`
            )
          );
        }

        const commitResult = buildCommitTransaction({
          utxos,
          inscription,
          feeRate: actualFeeRate,
          senderPubKey: account.btcPublicKey,
          senderAddress: sessionInfo.btcAddress,
          network: NETWORK,
        });
        const commitSigned = signBtcTransaction(
          commitResult.tx,
          account.btcPrivateKey
        );
        const commitTxid = await mempoolApi.broadcastTransaction(
          commitSigned.txHex
        );

        return createJsonResponse({
          status: "commit_broadcast",
          bitcoinNetwork: NETWORK,
          commitTxid,
          commitExplorerUrl: getMempoolTxUrl(commitTxid, NETWORK),
          revealAddress: commitResult.revealAddress,
          revealAmount: commitResult.revealAmount,
          commitFee: commitResult.fee,
          feeRate: actualFeeRate,
          contentType: STORY_CONTENT_TYPE,
          contentSize: content.length,
          title,
          markdown,
          warning:
            NETWORK === "mainnet"
              ? undefined
              : `This is a ${NETWORK} inscription. ordinals.com serves mainnet only, so the ` +
                `link it produces will not resolve for legion voters.`,
          nextStep:
            "Wait for the commit to confirm, then call legion_inscribe_reveal with this " +
            "commitTxid and revealAmount plus the same title and body.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ==========================================================================
  // legion_inscribe_reveal — step 2 of 2
  // ==========================================================================

  server.registerTool(
    "legion_inscribe_reveal",
    {
      description:
        "Complete a news inscription — STEP 2: broadcast the reveal transaction, after the " +
        "commit from legion_inscribe_story has confirmed.\n\n" +
        "Pass the SAME title and body used in the commit step — the reveal script is derived " +
        "from the content, so any difference produces a different script and the reveal fails.\n\n" +
        "Returns the inscription id and the ordinals.com link, ready to hand straight to " +
        "legion_propose_story.\n\n" +
        "Requires an unlocked managed wallet.",
      inputSchema: {
        commitTxid: z
          .string()
          .length(64)
          .describe("Txid of the confirmed commit transaction"),
        revealAmount: z
          .number()
          .positive()
          .describe("revealAmount from the legion_inscribe_story response"),
        title: z.string().min(1).describe("Same title used in the commit step"),
        body: z.string().min(1).describe("Same body used in the commit step"),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate for the reveal tx (default: medium)"),
      },
    },
    async ({ commitTxid, revealAmount, title, body, feeRate }) => {
      try {
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();
        if (!sessionInfo?.taprootAddress) {
          return createErrorResponse(
            new Error(
              "Wallet not unlocked, or it has no Taproot address. Use wallet_unlock first."
            )
          );
        }
        const account = walletManager.getAccount();
        if (!account?.btcPrivateKey || !account.btcPublicKey) {
          return createErrorResponse(
            new Error("Bitcoin keys not available. Wallet may not be unlocked.")
          );
        }

        const markdown = body.trimStart().startsWith("#")
          ? body
          : `# ${title}\n\n${body}`;
        const inscription: InscriptionData = {
          contentType: STORY_CONTENT_TYPE,
          body: Buffer.from(markdown, "utf8"),
        };

        const mempoolApi = new MempoolApi(NETWORK);
        const actualFeeRate = await resolveFeeRate(mempoolApi, feeRate);

        const revealScript = deriveRevealScript({
          inscription,
          senderPubKey: account.btcPublicKey,
          network: NETWORK,
        });
        const revealResult = buildRevealTransaction({
          commitTxid,
          commitVout: 0,
          commitAmount: revealAmount,
          revealScript,
          recipientAddress: sessionInfo.taprootAddress,
          feeRate: actualFeeRate,
          network: NETWORK,
        });
        const revealSigned = signBtcTransaction(
          revealResult.tx,
          account.btcPrivateKey
        );
        const revealTxid = await mempoolApi.broadcastTransaction(
          revealSigned.txHex
        );

        const inscriptionId = `${revealTxid}i0`;
        const link = `${ORDINALS_INSCRIPTION_BASE}${inscriptionId}`;
        const contentUrl = `${ORDINALS_CONTENT_BASE}${inscriptionId}`;

        return createJsonResponse({
          status: "success",
          bitcoinNetwork: NETWORK,
          inscriptionId,
          link,
          contentUrl,
          title,
          contentType: STORY_CONTENT_TYPE,
          commit: {
            txid: commitTxid,
            explorerUrl: getMempoolTxUrl(commitTxid, NETWORK),
          },
          reveal: {
            txid: revealTxid,
            fee: revealResult.fee,
            explorerUrl: getMempoolTxUrl(revealTxid, NETWORK),
          },
          recipientAddress: sessionInfo.taprootAddress,
          warning:
            NETWORK === "mainnet"
              ? undefined
              : `This is a ${NETWORK} inscription; ordinals.com serves mainnet only, so ` +
                `voters will not be able to open ${link}.`,
          nextStep:
            `Once the reveal confirms, call legion_propose_story with link "${inscriptionId}" ` +
            `to open the vote. The inscription must be readable before voters can judge it.`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
