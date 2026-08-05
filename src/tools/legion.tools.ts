/**
 * AIBTC News Legion tools (news-gov-v5).
 *
 * Lifecycle: inscribe → reveal → propose → vote → veto → conclude, plus
 * contribute (buys weight) and sponsor (does not).
 *
 * These tools pin their own network: `getLegionAccount()` re-derives the
 * unlocked wallet for the legion's chain, so a mainnet-configured server signs
 * against testnet. Inscription is the exception — real BTC on whatever chain
 * NETWORK names.
 *
 * Fund-moving calls sign in DENY mode with an exact post-condition.
 */

import { createHash } from "node:crypto";
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
import { DUST_THRESHOLD } from "../config/bitcoin-constants.js";
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
import {
  buildChildCommitTransaction,
  buildChildRevealTransaction,
  deriveChildRevealScript,
  lookupParentInscription,
} from "../transactions/child-inscription-builder.js";
import { signBtcTransaction } from "../transactions/bitcoin-builder.js";
import { createErrorResponse, createJsonResponse } from "../utils/index.js";

const [GOV_ADDRESS, GOV_NAME] = LEGION_GOV_CONTRACT.split(".");
const [TREASURY_ADDRESS, TREASURY_NAME] = LEGION_TREASURY_CONTRACT.split(".");

/** Markdown, so the inscription renders as a story rather than a wall of text. */
const STORY_CONTENT_TYPE = "text/markdown;charset=utf-8";

/**
 * Bitcoin's standardness limit on a transaction is ~400 kB, and the inscription
 * body rides in the REVEAL witness. An oversized body therefore commits fine and
 * then strands the sats: the reveal is rejected by every node it reaches. Refuse
 * at the commit, with headroom for the script and control block.
 */
const MAX_INSCRIPTION_BYTES = 390_000;

/** Large enough to be worth saying out loud before spending the fee on it. */
const LARGE_INSCRIPTION_WARN_BYTES = 100_000;

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

/**
 * Resolve a named fee tier against live mempool estimates.
 *
 * The builders reject `feeRate <= 0`, which `NaN` slips past — and a NaN rate
 * propagates through every size calculation into a transaction with garbage
 * amounts. mempool.space does intermittently return junk here, so the estimate
 * is validated as a finite positive number rather than trusted.
 */
async function resolveFeeRate(
  mempoolApi: MempoolApi,
  feeRate?: "fast" | "medium" | "slow" | number
): Promise<number> {
  let resolved: number;
  if (typeof feeRate === "number") {
    resolved = feeRate;
  } else {
    const fees = await mempoolApi.getFeeEstimates();
    resolved =
      feeRate === "fast"
        ? fees.fastestFee
        : feeRate === "slow"
          ? fees.hourFee
          : fees.halfHourFee;
    if (!Number.isFinite(resolved) || resolved <= 0) {
      throw new Error(
        `mempool.space returned an unusable fee estimate (${resolved}) for the ` +
          `"${feeRate ?? "medium"}" tier. Pass an explicit feeRate in sat/vB.`
      );
    }
  }
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error(`feeRate must be a positive number of sat/vB, got ${resolved}.`);
  }
  return resolved;
}

/** The markdown a title+body pair inscribes to. One definition, both steps. */
function buildStoryMarkdown(title: string, body: string): string {
  return body.trimStart().startsWith("#") ? body : `# ${title}\n\n${body}`;
}

/**
 * Check the commit actually paid the reveal script we just derived.
 *
 * The reveal script is derived from the content, so one stray character between
 * commit and reveal yields a different address, an unspendable commit and lost
 * sats. Comparing against the commit's real output catches that — and a wrong
 * commitTxid, parent or revealAmount — before anything is signed.
 */
async function assertCommitMatches(
  mempoolApi: MempoolApi,
  commitTxid: string,
  derivedRevealAddress: string | undefined,
  revealAmount: number
): Promise<void> {
  if (!derivedRevealAddress) {
    throw new Error("Could not derive a reveal address for this content.");
  }
  const tx = await mempoolApi.getTx(commitTxid);
  const output = tx.vout[0];
  if (!output) {
    throw new Error(`Commit ${commitTxid} has no output 0.`);
  }
  if (output.scriptpubkey_address !== derivedRevealAddress) {
    throw new Error(
      `This content does not match commit ${commitTxid}. It paid ` +
        `${output.scriptpubkey_address}, but this title/body derives ` +
        `${derivedRevealAddress}. Pass the exact title, body and parentInscriptionId ` +
        `used at commit. Nothing was broadcast.`
    );
  }
  if (output.value !== revealAmount) {
    throw new Error(
      `revealAmount ${revealAmount} does not match commit output 0, which holds ` +
        `${output.value} sats. Use ${output.value}. Nothing was broadcast.`
    );
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
        "News Legion at a glance: sBTC pool, total weight, governance params read from the " +
        "contract, current height, and your own weight if a wallet is unlocked. Start here.\n\n" +
        `Reads only. Runs on Stacks ${LEGION_NETWORK} regardless of this server's NETWORK.`,
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
        "Proposals newest first, with phase, tally and the inscription each points at.\n\n" +
        "Phases: `pending` (filed, voting not open yet), `voting`, `veto`, `concludable`, " +
        "`passed`/`failed` (settled), `expired` (nobody concluded in time; can no longer pay).\n\n" +
        "Reads only.",
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
        "One proposal in full: tally against the quorum and threshold it must clear, the " +
        "window timeline, what `conclude` would decide now, and whether you have voted.\n\n" +
        "Read this before voting — the contract cannot read the inscription, so judging the " +
        "work is the voter's job.\n\nReads only.",
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
        "Your weight, share, bond lock, sBTC balance, and every propose precondition folded " +
        "from the contract's `propose-status` — so a blocked propose names the gate to wait on.\n\n" +
        "Requires an unlocked wallet. Signs nothing.",
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
        "Mint testnet sBTC from the faucet on this legion's token contract.\n\n" +
        "Testnet only. Requires an unlocked wallet.",
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
        "Send sBTC to the pool and receive voting weight proportional to your share of the " +
        "contributed balance.\n\n" +
        "NOT REFUNDABLE — you get a say in which pieces get paid, not a claim on the pool. " +
        "To fund the pool without a vote, use legion_sponsor.\n\n" +
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
        "Fund the pool WITHOUT minting voting weight, with a name on the record.\n\n" +
        "Does not raise the price of joining (weight is priced against contributed sats only), " +
        "but does enlarge every payout, since the draw is a fraction of the whole pool.\n\n" +
        "`name`, `link` and `memo` are unverified — the paying principal and txid are the real " +
        "identity. FINAL: no refund path exists.\n\n" +
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
        "Open a vote on one inscribed piece. If it passes, YOU are paid the draw — the " +
        "proposer is the only reachable payee.\n\n" +
        "The contract stores link, title and description verbatim and never reads the " +
        "inscription. Proposing locks your ENTIRE weight until the piece resolves — one live " +
        "proposal per principal; the lock is never spent and releases on every outcome.\n\n" +
        "Pre-flights every precondition and refuses locally with the specific blocker.\n\n" +
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
        "Vote yes or no with your current weight. One vote per principal; a proposer cannot " +
        "vote on their own piece.\n\n" +
        "Read the inscription first — legion_get_story gives you the link.\n\n" +
        "Pre-flights phase, weight and prior vote. Requires an unlocked wallet.",
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
        "Object during the veto window. At veto quorum the piece fails regardless of the vote — " +
        "the backstop against a plagiarised or junk inscription that slipped past. A proposer " +
        "may veto their own piece, which withdraws it.\n\n" +
        "Pre-flights the window and your weight. Requires an unlocked wallet.",
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
        "Settle a proposal and, if it passed, pay the proposer the draw. Permissionless — " +
        "anyone may call it, and someone must.\n\n" +
        "A piece nobody concludes inside its window EXPIRES, pays no one, and can never be " +
        "concluded after. Concluding late pays what concluding early would; the draw was " +
        "snapshotted at propose time.\n\n" +
        "Requires an unlocked wallet — caller pays gas, proposer gets the payout.",
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
        "Inscribe a news piece to a Bitcoin ordinal as markdown — STEP 1, the commit.\n\n" +
        "Content type is text/markdown; the title is prepended as an H1 unless the body already " +
        "starts with one.\n\n" +
        `SPENDS REAL BITCOIN, on the Bitcoin network NETWORK names (currently ${NETWORK}) — ` +
        `not the Stacks ${LEGION_NETWORK} the rest of the legion_* tools use. A mainnet ` +
        "inscription therefore needs `confirmMainnetSpend: true`; without it the tool prices " +
        "the piece and refuses, so real BTC is never spent by accident.\n\n" +
        "Optional `parentInscriptionId` files the piece as a child of a parent you own, binding " +
        "your pieces to one inscribed identity. That is authorship, not originality.\n\n" +
        "Pre-flights content size, fee estimate, parent ownership, funding and network before " +
        "signing. `dryRun` prices it without broadcasting.\n\n" +
        "Returns without waiting. After the commit confirms, call legion_inscribe_reveal.\n\n" +
        "Requires an unlocked managed wallet with funded UTXOs.",
      inputSchema: {
        title: z
          .string()
          .min(1)
          .describe("Headline. Prepended to the body as an H1 unless the body already has one."),
        body: z
          .string()
          .min(1)
          .describe("The piece itself, as markdown."),
        parentInscriptionId: z
          .string()
          .optional()
          .describe(
            "Optional parent inscription id (e.g. 'abc…i0') to file this piece under. " +
              "You must own it: the reveal spends the parent's UTXO and returns it to you, " +
              "so children from one parent must be inscribed one at a time."
          ),
        dryRun: z
          .boolean()
          .optional()
          .describe(
            "Run every pre-flight check and price the inscription, but sign nothing. " +
              "Use this to see the cost before spending it."
          ),
        confirmMainnetSpend: z
          .boolean()
          .optional()
          .describe(
            "Acknowledge that this spends real BTC. Required on mainnet — without it the " +
              "tool returns the exact cost and refuses."
          ),
        allowNonMainnet: z
          .boolean()
          .optional()
          .describe(
            "Permit inscribing on a non-mainnet Bitcoin network. Refused by default: " +
              "ordinals.com serves mainnet only, so the link would 404 for every voter."
          ),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate: 'fast', 'medium', 'slow', or a number in sat/vB (default: medium)"),
      },
    },
    async ({ title, body, parentInscriptionId, dryRun, confirmMainnetSpend, allowNonMainnet, feeRate }) => {
      try {
        // A testnet inscription is almost always a misconfiguration here: the
        // legion's governance is testnet but its links are read on mainnet
        // ordinals.com, so the piece would be unreadable to every voter. A JSON
        // warning field was too easy to miss for something that costs sats.
        if (NETWORK !== "mainnet" && !allowNonMainnet) {
          return createErrorResponse(
            new Error(
              `Bitcoin network is ${NETWORK}, and ordinals.com serves mainnet inscriptions ` +
                `only — voters could not open the link this produces. Set NETWORK=mainnet, ` +
                `or pass allowNonMainnet: true if you are deliberately testing. Nothing was broadcast.`
            )
          );
        }

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
        // Provenance is signed by the Taproot key that holds the parent, not by
        // the funding key, so a parented piece needs both.
        if (parentInscriptionId && (!account.taprootPrivateKey || !account.taprootPublicKey)) {
          return createErrorResponse(
            new Error(
              "Taproot keys not available, so this wallet cannot spend a parent inscription. " +
                "Inscribe without parentInscriptionId, or use a managed wallet."
            )
          );
        }

        // Verify ownership before spending anything: the reveal must spend the
        // parent's UTXO, so a parent someone else holds is unusable and the
        // commit fee would be burned discovering that later.
        const parentInfo = parentInscriptionId
          ? await lookupParentInscription(parentInscriptionId)
          : null;
        if (parentInfo && parentInfo.address !== sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              `Parent inscription ${parentInscriptionId} is held by ${parentInfo.address}, ` +
                `not by your Taproot address ${sessionInfo.taprootAddress}. ` +
                `You must own a parent to file children under it. Nothing was broadcast.`
            )
          );
        }

        const markdown = buildStoryMarkdown(title, body);
        const content = Buffer.from(markdown, "utf8");
        // The body rides in the reveal witness, so an oversized piece commits
        // fine and then cannot be revealed at all. Refuse before spending.
        if (content.length > MAX_INSCRIPTION_BYTES) {
          return createErrorResponse(
            new Error(
              `The piece is ${content.length} bytes, over the ${MAX_INSCRIPTION_BYTES}-byte ` +
                `ceiling. The content rides in the reveal witness, so a commit would confirm ` +
                `and the reveal would then be rejected as non-standard, stranding the sats. ` +
                `Split the piece or inscribe a summary that links out. Nothing was broadcast.`
            )
          );
        }
        const contentHash = createHash("sha256").update(content).digest("hex");
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

        const commitResult =
          parentInscriptionId !== undefined
            ? buildChildCommitTransaction({
                utxos,
                inscription,
                parentInscriptionId,
                feeRate: actualFeeRate,
                senderPubKey: account.btcPublicKey,
                senderAddress: sessionInfo.btcAddress,
                network: NETWORK,
              })
            : buildCommitTransaction({
                utxos,
                inscription,
                feeRate: actualFeeRate,
                senderPubKey: account.btcPublicKey,
                senderAddress: sessionInfo.btcAddress,
                network: NETWORK,
              });

        // What the commit output can still afford at reveal time. The reveal
        // takes its own feeRate, and a rate above this leaves the reveal output
        // under dust — the builder refuses and the sats sit in the commit until
        // it is retried lower. Say the ceiling here so it is never hit.
        const revealVbytes = Math.max(
          1,
          Math.round(commitResult.revealAmount / Math.max(actualFeeRate, 1))
        );
        const maxRevealFeeRate = Math.max(
          1,
          Math.floor((commitResult.revealAmount - DUST_THRESHOLD) / revealVbytes)
        );

        const probes = {
          network: NETWORK,
          contentSize: content.length,
          contentHash: `sha256:${contentHash}`,
          feeRate: actualFeeRate,
          utxos: {
            count: utxos.length,
            totalSats: utxos.reduce((sum, utxo) => sum + utxo.value, 0),
          },
          parent: parentInfo
            ? {
                inscriptionId: parentInscriptionId,
                txid: parentInfo.txid,
                vout: parentInfo.vout,
                value: parentInfo.value,
                owned: true,
              }
            : null,
          estimatedCost: {
            commitFee: commitResult.fee,
            revealAmount: commitResult.revealAmount,
            totalSats: commitResult.fee + commitResult.revealAmount,
          },
          maxRevealFeeRate,
          sizeWarning:
            content.length > LARGE_INSCRIPTION_WARN_BYTES
              ? `${content.length} bytes is a large inscription — the fee scales with it.`
              : undefined,
        };

        if (dryRun) {
          return createJsonResponse({
            status: "dry_run",
            probes,
            revealAddress: commitResult.revealAddress,
            title,
            markdown,
            broadcast: false,
            nextStep:
              "Nothing was signed. Re-call without dryRun to broadcast the commit.",
          });
        }

        // The legion itself is testnet, so an agent working through it has no
        // reason to expect real money to move. Inscription is the one step that
        // does, and it cannot be moved off mainnet (ordinals.com indexes mainnet
        // only), so the cost is quoted and consent taken instead.
        if (NETWORK === "mainnet" && !confirmMainnetSpend) {
          const total = commitResult.fee + commitResult.revealAmount;
          return createErrorResponse(
            new Error(
              `This would spend ${total} sats of REAL BITCOIN on mainnet — ` +
                `${commitResult.fee} commit fee plus ${commitResult.revealAmount} locked for ` +
                `the reveal. The legion's governance is Stacks ${LEGION_NETWORK}, but the ` +
                `inscription is mainnet Bitcoin because ordinals.com indexes mainnet only. ` +
                `Nothing was signed. Re-call with confirmMainnetSpend: true to proceed, or ` +
                `dryRun: true for the full breakdown.`
            )
          );
        }

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
          parentInscriptionId: parentInscriptionId ?? null,
          parentUtxo: parentInfo
            ? { txid: parentInfo.txid, vout: parentInfo.vout, value: parentInfo.value }
            : undefined,
          warning:
            NETWORK === "mainnet"
              ? undefined
              : `This is a ${NETWORK} inscription. ordinals.com serves mainnet only, so the ` +
                `link it produces will not resolve for legion voters.`,
          nextStep:
            "Wait for the commit to confirm, then call legion_inscribe_reveal with this " +
            "commitTxid and revealAmount plus the same title and body" +
            (parentInscriptionId ? " and the same parentInscriptionId." : "."),
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
        "Complete a news inscription — STEP 2, the reveal, after the commit has confirmed.\n\n" +
        "Pass the SAME title, body and parentInscriptionId used at commit: the reveal script is " +
        "derived from all three. The commit's actual output is checked against the script this " +
        "content derives, so a mismatch is refused before signing rather than losing the sats.\n\n" +
        "Returns the inscription id and link for legion_propose_story.\n\n" +
        "No mainnet confirmation is asked for here, unlike the commit: those sats are already " +
        "committed, and refusing the reveal would strand them rather than save them.\n\n" +
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
        parentInscriptionId: z
          .string()
          .optional()
          .describe("Same parentInscriptionId used in the commit step, if any"),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate for the reveal tx (default: medium)"),
      },
    },
    async ({ commitTxid, revealAmount, title, body, parentInscriptionId, feeRate }) => {
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
        if (parentInscriptionId && (!account.taprootPrivateKey || !account.taprootPublicKey)) {
          return createErrorResponse(
            new Error(
              "Taproot keys not available, so the parent's UTXO cannot be spent. " +
                "Wallet may not be unlocked."
            )
          );
        }

        // Re-check ownership: the parent can have moved between commit and
        // reveal, and a reveal that tries to spend a UTXO someone else now holds
        // fails on broadcast after the fee is already committed.
        const parentInfo = parentInscriptionId
          ? await lookupParentInscription(parentInscriptionId)
          : null;
        if (parentInfo && parentInfo.address !== sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              `Parent inscription ${parentInscriptionId} is no longer held by your wallet — ` +
                `current holder is ${parentInfo.address}. Nothing was broadcast.`
            )
          );
        }

        const markdown = buildStoryMarkdown(title, body);
        const content = Buffer.from(markdown, "utf8");
        const contentHash = createHash("sha256").update(content).digest("hex");
        const inscription: InscriptionData = {
          contentType: STORY_CONTENT_TYPE,
          body: content,
        };

        const mempoolApi = new MempoolApi(NETWORK);
        const actualFeeRate = await resolveFeeRate(mempoolApi, feeRate);

        let revealResult;
        let revealTxid: string;
        let derivedRevealAddress: string | undefined;
        if (parentInscriptionId !== undefined && parentInfo) {
          const revealScript = deriveChildRevealScript({
            inscription,
            parentInscriptionId,
            senderPubKey: account.btcPublicKey,
            network: NETWORK,
          });
          derivedRevealAddress = revealScript.address;
          await assertCommitMatches(mempoolApi, commitTxid, derivedRevealAddress, revealAmount);
          revealResult = buildChildRevealTransaction({
            commitTxid,
            commitVout: 0,
            commitAmount: revealAmount,
            revealScript,
            parentUtxo: {
              txid: parentInfo.txid,
              vout: parentInfo.vout,
              value: parentInfo.value,
            },
            parentOwnerTaprootInternalPubKey: account.taprootPublicKey!,
            recipientAddress: sessionInfo.taprootAddress,
            feeRate: actualFeeRate,
            network: NETWORK,
          });
          // Two inputs, two keys: the commit output spends script-path with the
          // funding key, the parent spends key-path with the Taproot key.
          revealResult.tx.sign(account.btcPrivateKey);
          revealResult.tx.sign(account.taprootPrivateKey!);
          revealResult.tx.finalize();
          revealTxid = await mempoolApi.broadcastTransaction(revealResult.tx.hex);
        } else {
          const revealScript = deriveRevealScript({
            inscription,
            senderPubKey: account.btcPublicKey,
            network: NETWORK,
          });
          derivedRevealAddress = revealScript.address;
          await assertCommitMatches(mempoolApi, commitTxid, derivedRevealAddress, revealAmount);
          revealResult = buildRevealTransaction({
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
          revealTxid = await mempoolApi.broadcastTransaction(revealSigned.txHex);
        }

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
          contentHash: `sha256:${contentHash}`,
          parentInscriptionId: parentInscriptionId ?? null,
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
