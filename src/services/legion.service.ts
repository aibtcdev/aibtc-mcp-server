/**
 * AIBTC News Legion chain reads.
 *
 * Everything here reads the deployed contracts rather than trusting constants:
 * governance parameters, the timing mode, and the sBTC token the treasury
 * holds. A doc that drifts from the contract is a doc; a read that drifts from
 * the contract is a bug, so there is nothing to drift.
 *
 * The mainnet legion has NO VETO and NO QUORUM. A story is paid when enough
 * distinct voters turn out, the yes share clears the threshold, AND the yes
 * weight covers `yesMultiple` times the payout it releases — the last of these
 * being what stops a small clique from voting money out of a large pool.
 * Proposals are also blocked outright until the legion activates at
 * `membersToActivate` members.
 *
 * Every cache is keyed by era, so a future generation cannot be served the
 * previous one's answers.
 */

import {
  ClarityType,
  cvToJSON,
  deserializeCV,
  getAddressFromPrivateKey,
  principalCV,
  uintCV,
  type ClarityValue,
} from "@stacks/transactions";
import {
  LEGION_NETWORK,
  LIVE_ERA,
  ORDINALS_CONTENT_BASE,
  ORDINALS_INSCRIPTION_BASE,
  type LegionEra,
} from "../config/legion.js";
import { getHiroApi } from "./hiro-api.js";
import { getAccount } from "./x402.service.js";
import type { Account } from "../transactions/builder.js";

// ---------------------------------------------------------------------------
// Clarity value → plain JS
// ---------------------------------------------------------------------------

/**
 * Deep-unwrap a ClarityValue into plain JS. `cvToValue` only unwraps the top
 * level — nested tuples and optionals come back as `{type, value}` envelopes —
 * so the legion's tuple-heavy views need this instead.
 *
 * uints/ints become strings to stay exact; callers narrow with `num()`.
 */
export function simplifyCV(cv: ClarityValue): unknown {
  switch (cv.type) {
    case ClarityType.BoolTrue:
      return true;
    case ClarityType.BoolFalse:
      return false;
    case ClarityType.Int:
    case ClarityType.UInt:
      return cv.value.toString();
    case ClarityType.Buffer:
      return `0x${cv.value}`;
    case ClarityType.StringASCII:
    case ClarityType.StringUTF8:
    case ClarityType.PrincipalStandard:
    case ClarityType.PrincipalContract:
      return cv.value;
    case ClarityType.OptionalNone:
      return null;
    case ClarityType.OptionalSome:
    case ClarityType.ResponseOk:
    case ClarityType.ResponseErr:
      return simplifyCV(cv.value);
    case ClarityType.List:
      return cv.value.map(simplifyCV);
    case ClarityType.Tuple: {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(cv.value)) {
        out[key] = simplifyCV(value as ClarityValue);
      }
      return out;
    }
    default:
      return cvToJSON(cv).value;
  }
}

/** A uint field from a simplified tuple, as a JS number. */
export function num(value: unknown): number {
  return Number(value);
}

// ---------------------------------------------------------------------------
// Contract reads
// ---------------------------------------------------------------------------

/**
 * Call a read-only function on a legion contract and return it deep-unwrapped.
 * Always reads the legion's own chain, never the globally configured one.
 */
export async function readLegionContract(
  contractId: string,
  functionName: string,
  functionArgs: ClarityValue[] = []
): Promise<unknown> {
  const hiro = getHiroApi(LEGION_NETWORK);
  const sender = contractId.split(".")[0];
  const result = await hiro.callReadOnlyFunction(
    contractId,
    functionName,
    functionArgs,
    sender
  );
  if (!result.okay || !result.result) {
    throw new Error(
      `${contractId}::${functionName} failed: ${result.cause ?? "no result"}`
    );
  }
  const hex = result.result.startsWith("0x")
    ? result.result.slice(2)
    : result.result;
  return simplifyCV(deserializeCV(Buffer.from(hex, "hex")));
}

export function readGov(
  functionName: string,
  functionArgs: ClarityValue[] = [],
  era: LegionEra = LIVE_ERA
): Promise<unknown> {
  return readLegionContract(era.gov, functionName, functionArgs);
}

export function readTreasury(
  functionName: string,
  functionArgs: ClarityValue[] = [],
  era: LegionEra = LIVE_ERA
): Promise<unknown> {
  return readLegionContract(era.treasury, functionName, functionArgs);
}

// ---------------------------------------------------------------------------
// Cached chain configuration
// ---------------------------------------------------------------------------

export interface LegionParams {
  /** Percent of cast weight that must be yes, e.g. 66. */
  votingThreshold: number;
  /** Distinct voters a story needs before it can pass at all. */
  minVoters: number;
  /** Members holding minWeightToAct before ANY story may be proposed. */
  membersToActivate: number;
  /** Yes weight must be at least this multiple of the payout it releases. */
  yesMultiple: number;
  /** Weight floor to vote or propose. */
  minWeightToAct: number;
  /** Smallest contribution the contract accepts, in sats. */
  minJoinSats: number;
  /** Payout as basis points of the whole pool. */
  payoutBps: number;
  /** Blocks between filing and voting opening. */
  voteDelay: number;
  voteWindow: number;
  concludeWindow: number;
  /** Contract-wide cooldown between any two proposals. */
  globalProposeInterval: number;
}

const paramsCache = new Map<string, LegionParams>();
const timingModeCache = new Map<string, string>();
const tokenCache = new Map<string, { contract: string; assetName: string }>();

/** Every governance parameter, straight from `get-params`. */
export async function getParams(era: LegionEra = LIVE_ERA): Promise<LegionParams> {
  const cached = paramsCache.get(era.gov);
  if (cached) return cached;
  const raw = (await readGov("get-params", [], era)) as Record<string, unknown>;
  const params: LegionParams = {
    votingThreshold: num(raw.votingThreshold),
    minVoters: num(raw.minVoters),
    membersToActivate: num(raw.membersToActivate),
    yesMultiple: num(raw.yesMultiple),
    minWeightToAct: num(raw.minWeightToAct),
    minJoinSats: num(raw.minJoinSats),
    payoutBps: num(raw.payoutBps),
    voteDelay: num(raw.voteDelay),
    voteWindow: num(raw.voteWindow),
    concludeWindow: num(raw.concludeWindow),
    globalProposeInterval: num(raw.globalProposeInterval),
  };
  paramsCache.set(era.gov, params);
  return params;
}

export interface MembershipStatus {
  /** Principals holding at least minWeightToAct. Only ever climbs. */
  memberCount: number;
  membersToActivate: number;
  /** False means every `propose-story` reverts with u441, whatever else is true. */
  activated: boolean;
  membersNeeded: number;
}

/**
 * Whether the legion has enough members to accept proposals at all.
 *
 * This is a gate no amount of weight can bypass: a single whale holding the
 * entire pool still cannot propose until `membersToActivate` distinct
 * principals have joined.
 */
export async function getMembership(
  era: LegionEra = LIVE_ERA
): Promise<MembershipStatus> {
  const [count, activated, params] = await Promise.all([
    readGov("get-member-count", [], era),
    readGov("is-activated", [], era),
    getParams(era),
  ]);
  const memberCount = num(count);
  return {
    memberCount,
    membersToActivate: params.membersToActivate,
    activated: Boolean(activated),
    membersNeeded: Math.max(0, params.membersToActivate - memberCount),
  };
}

/**
 * Which clock the windows count on. `"TEST-STACKS-BLOCKS"` counts Stacks
 * blocks; `"PROD-BURN"` counts Bitcoin burn blocks. Never assume — a window
 * measured against the wrong tip is off by a factor of ten.
 */
export async function getTimingMode(era: LegionEra = LIVE_ERA): Promise<string> {
  const cached = timingModeCache.get(era.gov);
  if (cached) return cached;
  const mode = (await readGov("get-timing-mode", [], era)) as string;
  timingModeCache.set(era.gov, mode);
  return mode;
}

/**
 * The sBTC token the treasury actually moves, plus its fungible-token asset
 * name — both needed to write an exact post-condition. Read from the treasury
 * and its contract interface so a post-condition can never name the wrong asset.
 */
export async function getLegionToken(era: LegionEra = LIVE_ERA): Promise<{
  contract: string;
  assetName: string;
}> {
  const cached = tokenCache.get(era.treasury);
  if (cached) return cached;
  const contract = (await readTreasury("get-token", [], era)) as string;
  const iface = await getHiroApi(LEGION_NETWORK).getContractInterface(contract);
  const assetName = iface.fungible_tokens?.[0]?.name;
  if (!assetName) {
    throw new Error(
      `${contract} declares no fungible token — cannot build a post-condition for it.`
    );
  }
  const token = { contract, assetName };
  tokenCache.set(era.treasury, token);
  return token;
}

/**
 * The height the contract's windows are measured against, on the clock
 * `get-timing-mode` names.
 */
export async function getClockHeight(era: LegionEra = LIVE_ERA): Promise<{
  height: number;
  clock: "stacks" | "burn";
  timingMode: string;
}> {
  const [timingMode, info] = await Promise.all([
    getTimingMode(era),
    getHiroApi(LEGION_NETWORK).getCoreApiInfo(),
  ]);
  const clock = timingMode === "PROD-BURN" ? "burn" : "stacks";
  return {
    height: clock === "burn" ? info.burn_block_height : info.stacks_tip_height,
    clock,
    timingMode,
  };
}

// ---------------------------------------------------------------------------
// The signing account, pinned to the legion's chain
// ---------------------------------------------------------------------------

/**
 * The unlocked wallet, re-derived for the legion's network.
 *
 * The same private key yields a different address per chain, so a mainnet
 * session still signs legion calls from its testnet address against the testnet
 * node. This is the guard that makes a mainnet-configured server safe here.
 */
export async function getLegionAccount(): Promise<Account> {
  const base = await getAccount();
  if (base.network === LEGION_NETWORK) return base;
  return {
    ...base,
    address: getAddressFromPrivateKey(base.privateKey, LEGION_NETWORK),
    network: LEGION_NETWORK,
  };
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export interface StoryRecord {
  proposer: string;
  /** The proposer's whole weight, held until the piece resolves. Never spent. */
  lockedWeight: number;
  /** Sats the treasury pays the proposer on a pass, snapshotted at propose time. */
  payout: number;
  createdAt: number;
  voteEnd: number;
  /**
   * TotalWeight at the moment the story opened — including the proposer's own,
   * which they cannot vote with. Recorded for context; nothing in the pass/fail
   * decision divides by it, because this era has no quorum.
   */
  totalWeightAtOpen: number;
  yesWeight: number;
  noWeight: number;
  voterCount: number;
  status: number;
  reason: string;
}

export interface StoryMeta {
  title: string;
  description: string;
  link: string;
}

export async function getStory(
  proposalId: number,
  era: LegionEra = LIVE_ERA
): Promise<StoryRecord | null> {
  const raw = (await readGov("get-story", [uintCV(proposalId)], era)) as Record<
    string,
    unknown
  > | null;
  if (!raw) return null;
  return {
    proposer: String(raw.proposer),
    lockedWeight: num(raw.lockedWeight),
    payout: num(raw.payout),
    createdAt: num(raw.createdAt),
    voteEnd: num(raw.voteEnd),
    totalWeightAtOpen: num(raw.totalWeightAtOpen),
    yesWeight: num(raw.yesWeight),
    noWeight: num(raw.noWeight),
    voterCount: num(raw.voterCount),
    status: num(raw.status),
    reason: String(raw.reason ?? ""),
  };
}

export async function getStoryMeta(
  proposalId: number,
  era: LegionEra = LIVE_ERA
): Promise<StoryMeta | null> {
  const raw = (await readGov("get-story-meta", [uintCV(proposalId)], era)) as Record<
    string,
    unknown
  > | null;
  if (!raw) return null;
  return {
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    link: String(raw.link ?? ""),
  };
}

/**
 * `"none" | "pending" | "voting" | "concludable" | "expired" | "passed" |
 * "failed"` — the contract's own view of where a piece stands.
 */
export async function getPhase(
  proposalId: number,
  era: LegionEra = LIVE_ERA
): Promise<string> {
  return (await readGov("get-phase", [uintCV(proposalId)], era)) as string;
}

export async function getLastProposalId(era: LegionEra = LIVE_ERA): Promise<number> {
  return num(await readGov("get-last-proposal-id", [], era));
}

export async function getVoteRecord(
  proposalId: number,
  voter: string,
  era: LegionEra = LIVE_ERA
): Promise<{ support: boolean; weight: number; rationale: string } | null> {
  const raw = (await readGov("get-vote-record", [
    uintCV(proposalId),
    principalCV(voter),
  ], era)) as Record<string, unknown> | null;
  if (!raw) return null;
  return {
    support: Boolean(raw.support),
    weight: num(raw.weight),
    rationale: String(raw.rationale ?? ""),
  };
}

export interface ProposeStatus {
  canPropose: boolean;
  eligible: boolean;
  slotOpen: boolean;
  noLiveProposal: boolean;
  poolOk: boolean;
  membersOk: boolean;
  memberCount: number;
  membersToActivate: number;
  nextProposeHeight: number;
  lockOnPropose: number;
  payout: number;
  freeWeight: number;
}

/** Every propose precondition folded into one read, with the individual gates. */
export async function getProposeStatus(
  who: string,
  era: LegionEra = LIVE_ERA
): Promise<ProposeStatus> {
  const raw = (await readGov("propose-status", [principalCV(who)], era)) as Record<
    string,
    unknown
  >;
  return {
    canPropose: Boolean(raw.canPropose),
    eligible: Boolean(raw.eligible),
    slotOpen: Boolean(raw.slotOpen),
    noLiveProposal: Boolean(raw.noLiveProposal),
    poolOk: Boolean(raw.poolOk),
    membersOk: Boolean(raw.membersOk),
    memberCount: num(raw.memberCount),
    membersToActivate: num(raw.membersToActivate),
    nextProposeHeight: num(raw.nextProposeHeight),
    lockOnPropose: num(raw.lockOnPropose),
    payout: num(raw.payout),
    freeWeight: num(raw.freeWeight),
  };
}

/** Why a propose would revert right now, in the caller's words. */
export function proposeBlockers(
  status: ProposeStatus,
  minWeightToAct: number
): string[] {
  const blockers: string[] = [];
  if (!status.membersOk) {
    blockers.push(
      `the legion is not activated — ${status.memberCount}/${status.membersToActivate} ` +
        `members hold the minimum weight, so ${
          status.membersToActivate - status.memberCount
        } more must join before ANY story can be proposed (u441). ` +
        `Nothing you do alone clears this gate`
    );
  }
  if (!status.eligible) {
    blockers.push(
      `your weight is below minWeightToAct (${minWeightToAct}) — call legion_contribute first`
    );
  }
  if (!status.noLiveProposal) {
    blockers.push(
      "you already have a live proposal — one per principal until it concludes or lapses"
    );
  }
  if (!status.slotOpen) {
    blockers.push(
      `the contract-wide propose interval has not elapsed — next open at height ${status.nextProposeHeight}`
    );
  }
  if (!status.poolOk) {
    blockers.push("the pool is empty or the payout would round to zero sats");
  }
  return blockers;
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

export interface StoryTimeline {
  createdAt: number;
  votingOpensAt: number;
  voteEnd: number;
  /** Conclude opens the moment voting closes — there is no veto window. */
  concludeOpensAt: number;
  concludeDeadline: number;
  currentHeight: number;
  clock: "stacks" | "burn";
  blocksUntilNextTransition: number | null;
}

/** When each window opens and closes, on the clock the contract counts. */
export function buildTimeline(
  story: StoryRecord,
  params: LegionParams,
  height: number,
  clock: "stacks" | "burn"
): StoryTimeline {
  const votingOpensAt = story.createdAt + params.voteDelay;
  const concludeDeadline = story.voteEnd + params.concludeWindow;
  const nextBoundary = [votingOpensAt, story.voteEnd, concludeDeadline].find(
    (boundary) => boundary > height
  );
  return {
    createdAt: story.createdAt,
    votingOpensAt,
    voteEnd: story.voteEnd,
    concludeOpensAt: story.voteEnd,
    concludeDeadline,
    currentHeight: height,
    clock,
    blocksUntilNextTransition:
      nextBoundary === undefined ? null : nextBoundary - height,
  };
}

export interface PredictedOutcome {
  outcome: "passed" | "failed" | "expired";
  reason: string;
  /** True when the outcome is what the contract already recorded, not a forecast. */
  settled: boolean;
  cast: number;
  yesPct: number;
  /** Yes weight the story needs to release its payout: payout × yesMultiple. */
  yesWeightRequired: number;
  votersMet: boolean;
  thresholdMet: boolean;
  yesMet: boolean;
  payout: number;
}

/**
 * What `conclude` would decide if it ran at this height, following the
 * contract's decision order exactly (integer division included, since Clarity
 * floors every percentage).
 *
 * A story that is already terminal reports what the contract RECORDED, not a
 * forecast. Forecasting a settled piece would be worse than useless: a passed
 * proposal is necessarily past its conclude window, so the forecast branch
 * would call every settled piece "expired".
 */
export function predictOutcome(
  story: StoryRecord,
  params: LegionParams,
  poolBalance: number,
  height: number
): PredictedOutcome {
  const cast = story.yesWeight + story.noWeight;
  const yesPct = cast > 0 ? Math.floor((story.yesWeight * 100) / cast) : 0;
  const yesWeightRequired = story.payout * params.yesMultiple;

  // The contract's three gates, in its order. There is no quorum here: nothing
  // divides by totalWeightAtOpen, so a story cannot fail for turnout alone.
  const votersMet = story.voterCount >= params.minVoters;
  const thresholdMet = cast > 0 && yesPct >= params.votingThreshold;
  const yesMet = story.yesWeight >= yesWeightRequired;

  const base = { cast, yesPct, yesWeightRequired, votersMet, thresholdMet, yesMet };

  // Already terminal: report the record.
  if (story.status !== 0) {
    const settledOutcome =
      story.status === 1 ? "passed" : story.status === 3 ? "expired" : "failed";
    return {
      ...base,
      settled: true,
      outcome: settledOutcome,
      reason: story.reason || settledOutcome,
      payout: story.status === 1 ? story.payout : 0,
    };
  }

  if (height >= story.voteEnd + params.concludeWindow) {
    return {
      ...base,
      settled: false,
      outcome: "expired",
      reason: "not-concluded — the conclude window closed with nobody calling it",
      payout: 0,
    };
  }
  if (!votersMet) {
    return { ...base, settled: false, outcome: "failed", reason: "no-voters", payout: 0 };
  }
  if (!thresholdMet) {
    return { ...base, settled: false, outcome: "failed", reason: "voted-down", payout: 0 };
  }
  if (!yesMet) {
    // Approved, but by too little weight to justify the sats it would release.
    return { ...base, settled: false, outcome: "failed", reason: "yes-short", payout: 0 };
  }
  if (story.payout > poolBalance) {
    return { ...base, settled: false, outcome: "failed", reason: "pool-short", payout: 0 };
  }
  return { ...base, settled: false, outcome: "passed", reason: "paid", payout: story.payout };
}

// ---------------------------------------------------------------------------
// Links and validation
// ---------------------------------------------------------------------------

/**
 * Accept either a bare inscription id (`<txid>i0`) or a full URL, and return
 * the link the contract should store.
 *
 * A bare id becomes the VIEWER url, not the content url: that is what every
 * proposal already on chain uses, and it is what a voter wants from a click.
 * The reader at legions.aibtc.news accepts either form and both bare ids.
 */
export function normalizeOrdinalsLink(input: string): string {
  const trimmed = input.trim();
  if (/^[0-9a-f]{64}i\d+$/i.test(trimmed)) {
    return `${ORDINALS_INSCRIPTION_BASE}${trimmed.toLowerCase()}`;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  throw new Error(
    `"${input}" is neither an inscription id (<64-hex-txid>i0) nor a URL. ` +
      `Pass the inscription id from legion_inscribe_reveal, or a full https:// link.`
  );
}

/** The inscription id inside an ordinals link, when there is one. */
export function inscriptionIdFromLink(link: string): string | null {
  const match = link.match(/([0-9a-f]{64}i\d+)/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * The raw-bytes url for a stored link, so a voter can read the piece rather
 * than just look at where it lives. Null when the link names no inscription.
 */
export function contentUrlFromLink(link: string): string | null {
  const id = inscriptionIdFromLink(link);
  return id ? `${ORDINALS_CONTENT_BASE}${id}` : null;
}

/**
 * Clarity `string-ascii` holds one byte per character, so a smart quote or an
 * em dash pasted into a headline is a revert, not a truncation. Catch it here
 * with a message that names the character.
 */
export function assertAscii(
  value: string,
  field: string,
  maxLength: number
): void {
  const offender = [...value].find((char) => char.charCodeAt(0) > 127);
  if (offender) {
    throw new Error(
      `${field} must be ASCII — "${offender}" (U+${offender
        .charCodeAt(0)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")}) is not. Clarity string-ascii cannot hold it.`
    );
  }
  if (value.length > maxLength) {
    throw new Error(
      `${field} is ${value.length} characters; the contract accepts at most ${maxLength}.`
    );
  }
}

/** `(err uXXX)` from a failed read or a broadcast rejection, as a sentence. */
export function explainError(error: unknown, errors: Record<number, string>): string {
  const text = error instanceof Error ? error.message : String(error);
  const match = text.match(/\bu(\d{3})\b/);
  if (match) {
    const explanation = errors[Number(match[1])];
    if (explanation) return `${text} — ${explanation}`;
  }
  return text;
}
