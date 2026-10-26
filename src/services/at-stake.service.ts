/**
 * Chain reads for the At Stake market and its two side legions.
 *
 * Every read here goes to the chain the contracts live on, not the chain the
 * server is configured for — see the note in `config/at-stake.ts`.
 *
 * Clarity values come back through `cvToJSON`, whose shape is nested and
 * stringly typed. The unwrapping lives here so the tool layer reads as the
 * market's own vocabulary rather than as tuple spelunking.
 */

import {
  cvToJSON,
  deserializeCV,
  getAddressFromPrivateKey,
  principalCV,
  uintCV,
} from "@stacks/transactions";
import type { ClarityValue } from "@stacks/transactions";
import { getHiroApi } from "./hiro-api.js";
import { getAccount } from "./x402.service.js";
import type { Account } from "../transactions/builder.js";
import {
  AT_STAKE_NETWORK,
  CLOSE_HEIGHT,
  LEGION_ERRORS,
  MARKET_ADDRESS,
  MARKET_CONTRACT,
  MARKET_ERRORS,
  MARKET_STATUS,
  PROPOSAL_STATUS,
  STATUS_OPEN,
  type AtStakeSide,
} from "../config/at-stake.js";

/**
 * The wallet, re-derived for the legion's chain.
 *
 * A testnet-configured server still holds the same private key; only the
 * c32 encoding of the address differs. Re-deriving means a mainnet call is
 * signed by the mainnet form of the same wallet rather than failing, or worse,
 * quoting one address while signing as another.
 */
export async function getAtStakeAccount(): Promise<Account> {
  const base = await getAccount();
  if (base.network === AT_STAKE_NETWORK) return base;
  return {
    ...base,
    address: getAddressFromPrivateKey(base.privateKey, AT_STAKE_NETWORK),
    network: AT_STAKE_NETWORK,
  };
}

/** Call a read-only function on either contract and return its JSON form. */
export async function readContract(
  contractId: string,
  functionName: string,
  args: ClarityValue[] = []
): Promise<unknown> {
  const hiro = getHiroApi(AT_STAKE_NETWORK);
  const result = await hiro.callReadOnlyFunction(
    contractId,
    functionName,
    args,
    MARKET_ADDRESS
  );
  if (!result.okay) {
    throw new Error(
      `${contractId} ${functionName} failed: ${result.cause ?? "unknown error"}`
    );
  }
  if (!result.result) return null;
  const hex = result.result.startsWith("0x")
    ? result.result.slice(2)
    : result.result;
  return cvToJSON(deserializeCV(Buffer.from(hex, "hex")));
}

/** Read a market function. */
export function readMarket(
  functionName: string,
  args: ClarityValue[] = []
): Promise<unknown> {
  return readContract(MARKET_CONTRACT, functionName, args);
}

/**
 * Flatten one layer of `cvToJSON`'s `{type, value}` nesting.
 *
 * A Clarity tuple arrives as `{type, value: {field: {type, value}}}`, and an
 * optional wraps that again. Callers want the field, not the envelope.
 */
function unwrap(cv: unknown): unknown {
  if (cv && typeof cv === "object" && "value" in cv) {
    return (cv as { value: unknown }).value;
  }
  return cv;
}

/** Read a uint out of a `cvToJSON` node. */
export function num(cv: unknown): number {
  const v = unwrap(cv);
  if (v === null || v === undefined) return 0;
  return Number(v);
}

/** Read a bool out of a `cvToJSON` node. */
function bool(cv: unknown): boolean {
  return unwrap(cv) === true || unwrap(cv) === "true";
}

/** Read a string out of a `cvToJSON` node. */
function str(cv: unknown): string {
  const v = unwrap(cv);
  return v === null || v === undefined ? "" : String(v);
}

/** Fields of a tuple node, or `null` for a `none`. */
function fields(cv: unknown): Record<string, unknown> | null {
  const v = unwrap(cv);
  if (v === null || v === undefined) return null;
  // An optional's payload is itself a {type, value} node.
  if (typeof v === "object" && "value" in v && "type" in v) {
    return fields(v);
  }
  return v as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

export interface MarketSnapshot {
  title: string;
  opened: boolean;
  status: number;
  statusLabel: string;
  closeHeight: number;
  vault: number;
  idleCirc: number;
  bondedCirc: number;
  createdAt: number;
}

export async function getMarket(): Promise<MarketSnapshot> {
  const f = fields(await readMarket("get-market"));
  if (!f) throw new Error("get-market returned nothing.");
  const status = num(f["status"]);
  return {
    title: str(f["title"]),
    opened: bool(f["opened"]),
    status,
    statusLabel: MARKET_STATUS[status] ?? `unknown(${status})`,
    closeHeight: num(f["close-height"]),
    vault: num(f["vault"]),
    idleCirc: num(f["idle-circ"]),
    bondedCirc: num(f["bonded-circ"]),
    createdAt: num(f["created-at"]),
  };
}

export interface Position {
  idle: number;
  bonded: number;
}

export async function getPosition(who: string): Promise<Position> {
  const f = fields(
    await readMarket("get-position", [principal(who)])
  );
  if (!f) return { idle: 0, bonded: 0 };
  return { idle: num(f["idle"]), bonded: num(f["bonded"]) };
}

export interface Bid {
  /** Shares the bid wants. */
  amount: number;
  /** sBTC escrowed against it. */
  escrow: number;
}

export async function getBid(
  who: string,
  side: AtStakeSide
): Promise<Bid | null> {
  const f = fields(
    await readMarket("get-bid", [principal(who), uint(side.side)])
  );
  if (!f) return null;
  return { amount: num(f["amount"]), escrow: num(f["escrow"]) };
}

/** Current burn height — the clock every window in both contracts uses. */
export async function getBurnHeight(): Promise<number> {
  const info = await getHiroApi(AT_STAKE_NETWORK).getCoreApiInfo();
  return info.burn_block_height;
}

/**
 * Whether the market still accepts trades.
 *
 * Mirrors the contract's own `assert-tradeable`: open status AND the close
 * height not yet passed. Derived rather than read so a caller can be told
 * which of the two conditions failed.
 */
export function isTradeable(market: MarketSnapshot, burnHeight: number): boolean {
  return market.status === STATUS_OPEN && burnHeight <= CLOSE_HEIGHT;
}

// ---------------------------------------------------------------------------
// Legions
// ---------------------------------------------------------------------------

export interface LegionParams {
  minPosition: number;
  payout: number;
  minVoters: number;
  proposerCooldown: number;
  votingThreshold: number;
  voteDelay: number;
  voteWindow: number;
  concludeWindow: number;
  globalProposeInterval: number;
}

export async function getLegionParams(
  side: AtStakeSide
): Promise<LegionParams> {
  const f = fields(await readContract(side.legion, "get-params"));
  if (!f) throw new Error(`${side.legion} get-params returned nothing.`);
  return {
    minPosition: num(f["minPosition"]),
    payout: num(f["payout"]),
    minVoters: num(f["minVoters"]),
    proposerCooldown: num(f["proposerCooldown"]),
    votingThreshold: num(f["votingThreshold"]),
    voteDelay: num(f["voteDelay"]),
    voteWindow: num(f["voteWindow"]),
    concludeWindow: num(f["concludeWindow"]),
    globalProposeInterval: num(f["globalProposeInterval"]),
  };
}

export interface ProposeStatus {
  canPropose: boolean;
  eligible: boolean;
  slotOpen: boolean;
  cooledDown: boolean;
  noLiveProposal: boolean;
  potOk: boolean;
  marketTradeable: boolean;
  weight: number;
  vault: number;
  winsLeft: number;
  payout: number;
  votable: number;
  nextProposeHeight: number;
  proposerNextHeight: number;
}

export async function getProposeStatus(
  side: AtStakeSide,
  who: string
): Promise<ProposeStatus> {
  const f = fields(
    await readContract(side.legion, "propose-status", [principal(who)])
  );
  if (!f) throw new Error(`${side.legion} propose-status returned nothing.`);
  return {
    canPropose: bool(f["canPropose"]),
    eligible: bool(f["eligible"]),
    slotOpen: bool(f["slotOpen"]),
    cooledDown: bool(f["cooledDown"]),
    noLiveProposal: bool(f["noLiveProposal"]),
    potOk: bool(f["potOk"]),
    marketTradeable: bool(f["marketTradeable"]),
    weight: num(f["weight"]),
    vault: num(f["vault"]),
    winsLeft: num(f["winsLeft"]),
    payout: num(f["payout"]),
    votable: num(f["votable"]),
    nextProposeHeight: num(f["nextProposeHeight"]),
    proposerNextHeight: num(f["proposerNextHeight"]),
  };
}

export interface Proposal {
  proposer: string;
  payout: number;
  createdAt: number;
  voteEnd: number;
  votableAtOpen: number;
  yesWeight: number;
  noWeight: number;
  voterCount: number;
  yesVoterCount: number;
  status: number;
  statusLabel: string;
  reason: string;
  paidInShares: boolean;
}

export async function getProposal(
  side: AtStakeSide,
  proposalId: number
): Promise<Proposal | null> {
  const f = fields(
    await readContract(side.legion, "get-proposal", [uint(proposalId)])
  );
  if (!f) return null;
  const status = num(f["status"]);
  return {
    proposer: str(f["proposer"]),
    payout: num(f["payout"]),
    createdAt: num(f["createdAt"]),
    voteEnd: num(f["voteEnd"]),
    votableAtOpen: num(f["votableAtOpen"]),
    yesWeight: num(f["yesWeight"]),
    noWeight: num(f["noWeight"]),
    voterCount: num(f["voterCount"]),
    yesVoterCount: num(f["yesVoterCount"]),
    status,
    statusLabel: PROPOSAL_STATUS[status] ?? `unknown(${status})`,
    reason: str(f["reason"]),
    paidInShares: bool(f["paidInShares"]),
  };
}

export interface ProposalMeta {
  title: string;
  description: string;
  link: string;
}

export async function getProposalMeta(
  side: AtStakeSide,
  proposalId: number
): Promise<ProposalMeta | null> {
  const f = fields(
    await readContract(side.legion, "get-proposal-meta", [uint(proposalId)])
  );
  if (!f) return null;
  return {
    title: str(f["title"]),
    description: str(f["description"]),
    link: str(f["link"]),
  };
}

/** The contract's own phase word for a proposal. */
export async function getPhase(
  side: AtStakeSide,
  proposalId: number
): Promise<string> {
  return str(await readContract(side.legion, "get-phase", [uint(proposalId)]));
}

export interface Settlement {
  redeemed: boolean;
  redeemedSats: number;
  paidSats: number;
  unpaidSats: number;
  totalCredits: number;
  won: boolean;
}

export async function getSettlement(side: AtStakeSide): Promise<Settlement> {
  const f = fields(await readContract(side.legion, "get-settlement"));
  if (!f) throw new Error(`${side.legion} get-settlement returned nothing.`);
  return {
    redeemed: bool(f["redeemed"]),
    redeemedSats: num(f["redeemedSats"]),
    paidSats: num(f["paidSats"]),
    unpaidSats: num(f["unpaidSats"]),
    totalCredits: num(f["totalCredits"]),
    won: bool(f["won"]),
  };
}

/**
 * Predict what `conclude` will decide, in the contract's own decision order.
 *
 * The chain decides for real at the block that mines the transaction; this is
 * the tally as of now, so a caller can see that they are about to burn gas on
 * a proposal that fails for want of one more voter.
 */
export function predictOutcome(
  proposal: Proposal,
  params: LegionParams,
  proposerStillHolding: boolean,
  vault: number,
  totalCredits: number,
  tradeable: boolean
): { outcome: "passed" | "failed"; reason: string; payout: number } {
  const cast = proposal.yesWeight + proposal.noWeight;
  if (proposal.yesVoterCount < params.minVoters) {
    return { outcome: "failed", reason: "no-voters", payout: 0 };
  }
  if (cast === 0 || (proposal.yesWeight * 100) / cast < params.votingThreshold) {
    return { outcome: "failed", reason: "voted-down", payout: 0 };
  }
  if (!proposerStillHolding) {
    return { outcome: "failed", reason: "not-holding", payout: 0 };
  }
  if (vault < totalCredits + params.payout) {
    return { outcome: "failed", reason: "pot-short", payout: 0 };
  }
  return {
    outcome: "passed",
    reason: tradeable ? "paid-shares" : "credited",
    payout: params.payout,
  };
}

// ---------------------------------------------------------------------------
// Clarity argument helpers and error translation
// ---------------------------------------------------------------------------

function principal(address: string): ClarityValue {
  return principalCV(address);
}

function uint(value: number): ClarityValue {
  return uintCV(value);
}

/**
 * Turn a contract abort into the sentence behind its code.
 *
 * The two contracts use disjoint ranges — the market is 100-313, the legions
 * 401-450 — so one lookup across both tables cannot collide.
 */
export function explainAbort(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\bu(\d+)\b/);
  if (!match) return error instanceof Error ? error : new Error(message);
  const code = Number(match[1]);
  const explanation = MARKET_ERRORS[code] ?? LEGION_ERRORS[code];
  if (!explanation) return error instanceof Error ? error : new Error(message);
  return new Error(`${explanation} (u${code})\n\nRaw: ${message}`);
}
