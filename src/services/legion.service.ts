/**
 * AIBTC News Legion (news-gov-v5) chain reads.
 *
 * Everything here reads the deployed contracts rather than trusting constants:
 * governance parameters, the timing mode (which clock the windows count on),
 * and the sBTC token the treasury actually holds all come off chain and are
 * cached per process. A doc that drifts from the contract is a doc; a read that
 * drifts from the contract is a bug, so there is nothing to drift.
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
  LEGION_GOV_CONTRACT,
  LEGION_NETWORK,
  LEGION_TREASURY_CONTRACT,
  ORDINALS_CONTENT_BASE,
  ORDINALS_INSCRIPTION_BASE,
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
  functionArgs: ClarityValue[] = []
): Promise<unknown> {
  return readLegionContract(LEGION_GOV_CONTRACT, functionName, functionArgs);
}

export function readTreasury(
  functionName: string,
  functionArgs: ClarityValue[] = []
): Promise<unknown> {
  return readLegionContract(LEGION_TREASURY_CONTRACT, functionName, functionArgs);
}

// ---------------------------------------------------------------------------
// Cached chain configuration
// ---------------------------------------------------------------------------

export interface LegionParams {
  votingQuorum: number;
  votingThreshold: number;
  vetoQuorum: number;
  minParticipants: number;
  minWeight: number;
  minContribution: number;
  drawBps: number;
  votingDelay: number;
  voteWindow: number;
  vetoWindow: number;
  concludeWindow: number;
  proposeInterval: number;
}

let paramsCache: LegionParams | null = null;
let timingModeCache: string | null = null;
let tokenCache: { contract: string; assetName: string } | null = null;

/** Every governance parameter, straight from `get-params`. */
export async function getParams(): Promise<LegionParams> {
  if (paramsCache) return paramsCache;
  const raw = (await readGov("get-params")) as Record<string, unknown>;
  paramsCache = {
    votingQuorum: num(raw.votingQuorum),
    votingThreshold: num(raw.votingThreshold),
    vetoQuorum: num(raw.vetoQuorum),
    minParticipants: num(raw.minParticipants),
    minWeight: num(raw.minWeight),
    minContribution: num(raw.minContribution),
    drawBps: num(raw.drawBps),
    votingDelay: num(raw.votingDelay),
    voteWindow: num(raw.voteWindow),
    vetoWindow: num(raw.vetoWindow),
    concludeWindow: num(raw.concludeWindow),
    proposeInterval: num(raw.proposeInterval),
  };
  return paramsCache;
}

/**
 * Which clock the windows count on. `"TEST-STACKS-BLOCKS"` counts Stacks
 * blocks; `"PROD-BURN"` counts Bitcoin burn blocks. Never assume — a window
 * measured against the wrong tip is off by a factor of ten.
 */
export async function getTimingMode(): Promise<string> {
  if (timingModeCache) return timingModeCache;
  timingModeCache = (await readGov("get-timing-mode")) as string;
  return timingModeCache;
}

/**
 * The sBTC token the treasury actually moves, plus its fungible-token asset
 * name — both needed to write an exact post-condition. Read from the treasury
 * and its contract interface so a post-condition can never name the wrong asset.
 */
export async function getLegionToken(): Promise<{
  contract: string;
  assetName: string;
}> {
  if (tokenCache) return tokenCache;
  const contract = (await readTreasury("get-token")) as string;
  const iface = await getHiroApi(LEGION_NETWORK).getContractInterface(contract);
  const assetName = iface.fungible_tokens?.[0]?.name;
  if (!assetName) {
    throw new Error(
      `${contract} declares no fungible token — cannot build a post-condition for it.`
    );
  }
  tokenCache = { contract, assetName };
  return tokenCache;
}

/**
 * The height the contract's windows are measured against, on the clock
 * `get-timing-mode` names.
 */
export async function getClockHeight(): Promise<{
  height: number;
  clock: "stacks" | "burn";
  timingMode: string;
}> {
  const [timingMode, info] = await Promise.all([
    getTimingMode(),
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
  bond: number;
  draw: number;
  createdAt: number;
  voteEnd: number;
  eligibleSnapshot: number;
  yesWeight: number;
  noWeight: number;
  vetoWeight: number;
  voterCount: number;
  status: number;
  reason: string;
}

export interface StoryMeta {
  title: string;
  description: string;
  link: string;
}

export async function getStory(proposalId: number): Promise<StoryRecord | null> {
  const raw = (await readGov("get-story", [uintCV(proposalId)])) as Record<
    string,
    unknown
  > | null;
  if (!raw) return null;
  return {
    proposer: String(raw.proposer),
    bond: num(raw.bond),
    draw: num(raw.draw),
    createdAt: num(raw.createdAt),
    voteEnd: num(raw.voteEnd),
    eligibleSnapshot: num(raw.eligibleSnapshot),
    yesWeight: num(raw.yesWeight),
    noWeight: num(raw.noWeight),
    vetoWeight: num(raw.vetoWeight),
    voterCount: num(raw.voterCount),
    status: num(raw.status),
    reason: String(raw.reason ?? ""),
  };
}

export async function getStoryMeta(
  proposalId: number
): Promise<StoryMeta | null> {
  const raw = (await readGov("get-story-meta", [uintCV(proposalId)])) as Record<
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
 * `"none" | "pending" | "voting" | "veto" | "concludable" | "expired" |
 * "passed" | "failed"` — the contract's own view of where a piece stands.
 */
export async function getPhase(proposalId: number): Promise<string> {
  return (await readGov("get-phase", [uintCV(proposalId)])) as string;
}

export async function getLastProposalId(): Promise<number> {
  return num(await readGov("get-last-proposal-id"));
}

export async function getVoteRecord(
  proposalId: number,
  voter: string
): Promise<{ support: boolean; weight: number } | null> {
  const raw = (await readGov("get-vote-record", [
    uintCV(proposalId),
    principalCV(voter),
  ])) as Record<string, unknown> | null;
  if (!raw) return null;
  return { support: Boolean(raw.support), weight: num(raw.weight) };
}

export async function getVetoRecord(
  proposalId: number,
  voter: string
): Promise<{ weight: number } | null> {
  const raw = (await readGov("get-veto-record", [
    uintCV(proposalId),
    principalCV(voter),
  ])) as Record<string, unknown> | null;
  if (!raw) return null;
  return { weight: num(raw.weight) };
}

export interface ProposeStatus {
  canPropose: boolean;
  eligible: boolean;
  slotOpen: boolean;
  noLiveProposal: boolean;
  poolOk: boolean;
  nextProposeHeight: number;
  lockOnPropose: number;
  draw: number;
  freeWeight: number;
}

/** Every propose precondition folded into one read, with the individual gates. */
export async function getProposeStatus(who: string): Promise<ProposeStatus> {
  const raw = (await readGov("propose-status", [principalCV(who)])) as Record<
    string,
    unknown
  >;
  return {
    canPropose: Boolean(raw.canPropose),
    eligible: Boolean(raw.eligible),
    slotOpen: Boolean(raw.slotOpen),
    noLiveProposal: Boolean(raw.noLiveProposal),
    poolOk: Boolean(raw.poolOk),
    nextProposeHeight: num(raw.nextProposeHeight),
    lockOnPropose: num(raw.lockOnPropose),
    draw: num(raw.draw),
    freeWeight: num(raw.freeWeight),
  };
}

/** Why a propose would revert right now, in the caller's words. */
export function proposeBlockers(status: ProposeStatus, minWeight: number): string[] {
  const blockers: string[] = [];
  if (!status.eligible) {
    blockers.push(
      `your weight is below minWeight (${minWeight}) — call legion_contribute first`
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
    blockers.push("the pool is empty or the draw would round to zero sats");
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
  vetoEnd: number;
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
  const votingOpensAt = story.createdAt + params.votingDelay;
  const vetoEnd = story.voteEnd + params.vetoWindow;
  const concludeDeadline = vetoEnd + params.concludeWindow;
  const nextBoundary = [votingOpensAt, story.voteEnd, vetoEnd, concludeDeadline].find(
    (boundary) => boundary > height
  );
  return {
    createdAt: story.createdAt,
    votingOpensAt,
    voteEnd: story.voteEnd,
    vetoEnd,
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
  quorumPct: number;
  yesPct: number;
  vetoPct: number;
  quorumMet: boolean;
  thresholdMet: boolean;
  vetoed: boolean;
  participantsMet: boolean;
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
  const eligible = story.eligibleSnapshot;
  const quorumPct = eligible > 0 ? Math.floor((cast * 100) / eligible) : 0;
  const yesPct = cast > 0 ? Math.floor((story.yesWeight * 100) / cast) : 0;
  const vetoPct =
    eligible > 0 ? Math.floor((story.vetoWeight * 100) / eligible) : 0;

  const participantsMet = story.voterCount >= params.minParticipants;
  const quorumMet = eligible > 0 && participantsMet && quorumPct >= params.votingQuorum;
  const thresholdMet = cast > 0 && yesPct >= params.votingThreshold;
  const vetoed = eligible > 0 && vetoPct >= params.vetoQuorum;

  const base = {
    cast,
    quorumPct,
    yesPct,
    vetoPct,
    quorumMet,
    thresholdMet,
    vetoed,
    participantsMet,
  };

  // Already terminal: report the record.
  if (story.status !== 0) {
    const settledOutcome =
      story.status === 1 ? "passed" : story.status === 3 ? "expired" : "failed";
    return {
      ...base,
      settled: true,
      outcome: settledOutcome,
      reason: story.reason || settledOutcome,
      payout: story.status === 1 ? story.draw : 0,
    };
  }

  const concludeDeadline = story.voteEnd + params.vetoWindow + params.concludeWindow;
  if (height >= concludeDeadline) {
    return {
      ...base,
      settled: false,
      outcome: "expired",
      reason: "not-concluded — the conclude window closed with nobody calling it",
      payout: 0,
    };
  }
  if (vetoed) {
    return { ...base, settled: false, outcome: "failed", reason: "vetoed", payout: 0 };
  }
  if (!quorumMet) {
    return { ...base, settled: false, outcome: "failed", reason: "no-quorum", payout: 0 };
  }
  if (!thresholdMet) {
    return { ...base, settled: false, outcome: "failed", reason: "voted-down", payout: 0 };
  }
  if (story.draw > poolBalance) {
    return { ...base, settled: false, outcome: "failed", reason: "pool-short", payout: 0 };
  }
  return { ...base, settled: false, outcome: "passed", reason: "paid", payout: story.draw };
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
