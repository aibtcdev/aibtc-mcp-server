/**
 * At Stake — the El Salvador PoX-5 prediction market and its two side legions.
 *
 * The market asks one bit: did any of twenty frozen El Salvador reserve scripts
 * spend an output into a Stacks PoX-5 protocol bond before burn height 994,699?
 * Chips are sBTC; the subject is native L1 BTC. The two are unrelated — holding
 * a share is not holding the coins it is about.
 *
 * Complete-set escrow: 1 sat of sBTC mints 1 IDLE + 1 BONDED share, and the pair
 * merges back to 1 sat any time before resolve. That is why the two prices sum
 * to 1, and why `vault == idle-circ == bonded-circ` holds across every mint and
 * merge.
 *
 * THERE IS NO ADMIN KEY AND NO ORACLE PRINCIPAL. Status is settable by exactly
 * two permissionless functions: `resolve-bonded`, which carries a Bitcoin SPV
 * proof that a subject output was consumed into a lockup, and `resolve-idle`,
 * which anyone may call once the close height passes.
 *
 * On top of the market sit two legions — one per side. Voting weight IS the
 * caller's share balance on that side, read live out of the market, so a legion
 * is a DAO whose membership is whoever is exposed to the claim it argues. A
 * passing proposal is paid in shares while the market still trades, and in
 * sBTC credits after it resolves.
 *
 * LIVE ON STACKS MAINNET WITH REAL sBTC. `atstake_mint_complete_set` and
 * `atstake_place_bid` spend sBTC, and both meter against the wallet's `sats`
 * spending rail. That metering happens inside `callContract`, which reads the
 * exact post-condition these calls sign in DENY mode — so it must NOT be
 * repeated in the tools, or every mint would bill the rail twice.
 *
 * NETWORK IS DERIVED FROM THE CONTRACT ADDRESS, NOT FROM `NETWORK`.
 * Every other tool in this server follows the global `NETWORK` env var. Reading
 * it here would let a testnet-configured server sign market calls against a
 * testnet node while quoting mainnet balances. `AT_STAKE_NETWORK` reads the
 * address prefix instead, so these tools always follow the chain the contracts
 * actually live on.
 *
 * NOT THE SAME THING AS `legion_*`. Those tools govern `aibtc-news-gov`, where
 * weight is bought by contributing sBTC and proposals name a Bitcoin ordinal.
 * These govern the El Salvador market's two sides, where weight is a share
 * balance and proposals name a public link. Same word, different contracts.
 */

import type { Network } from "./networks.js";

/** The market contract. One deployment, mainnet, no upgrade path. */
export const MARKET_CONTRACT =
  "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.elsalvador-stakes-btc-v2";

/** Which chain a Stacks contract id lives on, from its c32 address prefix. */
function networkFromContract(contractId: string): Network {
  return contractId.startsWith("SP") || contractId.startsWith("SM")
    ? "mainnet"
    : "testnet";
}

/** The chain these contracts live on, derived rather than configured. */
export const AT_STAKE_NETWORK: Network = networkFromContract(MARKET_CONTRACT);

export const [MARKET_ADDRESS, MARKET_NAME] = MARKET_CONTRACT.split(".") as [
  string,
  string,
];

/**
 * sBTC, the only asset either contract moves. Declared here rather than read
 * from `CONTRACTS` because the market hardcodes this exact principal — a
 * post-condition naming any other token would be a post-condition on an asset
 * that never moves, which in DENY mode aborts every call it guards.
 */
export const SBTC_CONTRACT =
  "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";

/** The FT asset name inside `sbtc-token`, for post-condition construction. */
export const SBTC_ASSET_NAME = "sbtc-token";

/**
 * One side of the market: a share balance, a legion that votes with it, and the
 * market status that makes it the winner.
 */
export interface AtStakeSide {
  /** `side` argument the market takes for this side. */
  side: number;
  /** Key in the market's position tuple. */
  positionKey: "idle" | "bonded";
  /** The legion governing this side. */
  legion: string;
  /** What the legion argues: "yes" pays if the coins bonded. */
  argues: "yes" | "no";
  /** Market status under which this side redeems 1 sat per share. */
  winStatus: number;
  /** Human label the contracts print in their events. */
  label: string;
}

export const SIDE_IDLE = 0;
export const SIDE_BONDED = 1;

export const STATUS_OPEN = 0;
export const STATUS_BONDED = 1;
export const STATUS_IDLE = 2;

/** Market status code to the word the site and the contracts use. */
export const MARKET_STATUS: Record<number, string> = {
  [STATUS_OPEN]: "open",
  [STATUS_BONDED]: "resolved-bonded",
  [STATUS_IDLE]: "resolved-idle",
};

/**
 * Both sides, keyed by the word a caller is most likely to type.
 *
 * BONDED IS YES AND IDLE IS NO, and the mapping is not guessable from the
 * numbers: `SIDE_IDLE` is u0 while `STATUS_IDLE` is u2. Every place a side is
 * resolved goes through here so that off-by-one never becomes a trade on the
 * side the caller did not mean.
 */
export const SIDES: Record<"yes" | "no", AtStakeSide> = {
  yes: {
    side: SIDE_BONDED,
    positionKey: "bonded",
    legion: "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.elsalvador-yes-legion-v2",
    argues: "yes",
    winStatus: STATUS_BONDED,
    label: "bonded",
  },
  no: {
    side: SIDE_IDLE,
    positionKey: "idle",
    legion: "SP5Y3W3F78NKFH4HYFNDQMJC484VZWKDH35ZR2M9.elsalvador-no-legion-v2",
    argues: "no",
    winStatus: STATUS_IDLE,
    label: "idle",
  },
};

/** Accept the share label as a synonym for the side it names. */
export function resolveSide(name: string): AtStakeSide {
  const key = name.trim().toLowerCase();
  if (key === "yes" || key === "bonded") return SIDES.yes;
  if (key === "no" || key === "idle") return SIDES.no;
  throw new Error(
    `Unknown side "${name}". Use "yes" (bonded shares) or "no" (idle shares).`
  );
}

/** The burn height after which the market can be resolved idle. */
export const CLOSE_HEIGHT = 994699;

/** Bids must fill at least this share of their size, in basis points. */
export const MIN_FILL_BPS = 100;

/** PoX-5 reward cycle indices the claim covers, inclusive. */
export const BOND_INDICES = [2, 3, 4, 5, 6, 7];

/** The aggregated read the site itself renders from. */
export const AT_STAKE_API = "https://aibtc.com/api/legions";

export const MARKET_SITE_URL = "https://elsalvadorstakesbtc.com";
export const LEGIONS_SITE_URL = "https://aibtc.com/legions";

/** Legion `propose` and `vote` string-ascii bounds, from the contracts. */
export const MAX_LINK_LENGTH = 200;
export const MAX_TITLE_LENGTH = 128;
export const MAX_DESCRIPTION_LENGTH = 512;
export const MAX_RATIONALE_LENGTH = 256;

/** Legion proposal status codes. */
export const PROPOSAL_STATUS: Record<number, string> = {
  0: "open",
  1: "passed",
  2: "failed",
  3: "expired",
};

/**
 * Market error codes, so an abort reads as a sentence instead of `u107`.
 * Only the codes a caller can actually trip through these tools are listed;
 * the SPV-proof range belongs to `resolve-bonded`, which this server does not
 * build.
 */
export const MARKET_ERRORS: Record<number, string> = {
  100: "The market is already open.",
  102: "The market is not open — it has already resolved, so shares can no longer be traded or merged.",
  103: "The close height has passed.",
  104: "The trading window is still open — the market cannot be resolved idle until burn height exceeds the close height.",
  105: "The market has not opened yet.",
  106: "Amount must be greater than zero.",
  107: "You do not hold enough shares on that side.",
  108: "The market has not resolved yet, so there is nothing to redeem.",
  109: "Unknown side — use yes/bonded or no/idle.",
  110: "You cannot transfer shares to yourself.",
  129: "You already have a resting bid on that side. Cancel it before placing another.",
  130: "You have no resting bid on that side.",
  131: "The two bids together do not cover one sat per share.",
  132: "Both sides of the match are the same buyer.",
  133: "A share pays at most one sat, so a bid above par is always a mistake.",
  206: "That principal holds no position.",
};

/** Legion error codes. */
export const LEGION_ERRORS: Record<number, string> = {
  401: "You hold fewer than the minimum shares on this side, so you cannot propose or vote.",
  404: "No proposal with that id in this legion.",
  405: "You have already voted on this proposal.",
  407: "Voting on this proposal is closed.",
  408: "Voting is still open — conclude opens when the vote window ends.",
  410: "This proposal has already been concluded.",
  417: "The payout transfer failed.",
  421: "The link cannot be empty.",
  423: "A proposer cannot vote on their own proposal.",
  432: "Too soon — the legion's global propose interval has not elapsed since the last proposal.",
  433: "The title cannot be empty.",
  434: "You already have a live proposal. Wait for it to conclude or lapse.",
  435: "The conclude window has passed — this proposal has expired and pays nobody.",
  436: "Voting has not started yet; there is a delay after propose.",
  440: "The rationale cannot be empty.",
  441: "The description cannot be empty.",
  442: "The market has closed, so this legion no longer accepts proposals.",
  443: "The vault cannot cover its outstanding credits plus this payout.",
  444: "The market has not resolved yet.",
  445: "The vault has already been redeemed.",
  446: "There are no credits to settle.",
  447: "Proposals are still live — the vault cannot be redeemed until they settle.",
  448: "The vault has not been redeemed yet, so there is nothing to claim.",
  449: "You have no unpaid credit to claim.",
  450: "You are still inside your proposer cooldown.",
};
