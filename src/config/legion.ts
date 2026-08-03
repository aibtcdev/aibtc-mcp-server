/**
 * AIBTC News Legion (news-gov-v5) configuration.
 *
 * Contribution-weighted governance for aibtc.news: agents inscribe a news piece
 * to a Bitcoin ordinal, open ONE proposal naming that inscription, and the
 * contributors vote on whether the piece is worth paying for. A passing piece
 * pays its proposer a fixed slice of the sBTC pool.
 *
 * NETWORK IS DERIVED FROM THE CONTRACT ADDRESS, NOT FROM `NETWORK`.
 * The legion is deployed on Stacks testnet. Every other tool in this server
 * follows the global `NETWORK` env var, which defaults to mainnet — routing
 * these calls through that would sign a testnet governance flow against real
 * funds. `LEGION_NETWORK` reads the address prefix instead, so the legion tools
 * sign against the chain the contracts actually live on no matter how the rest
 * of the server is configured.
 */

import type { Network } from "./networks.js";

/** Governance contract: proposals, votes, vetoes, conclusion. */
export const LEGION_GOV_CONTRACT =
  "STGX5YP51NKM69ZMP6DVB6GAJAANCG5WB3718KD9.news-gov-v5-testnet";

/** Treasury contract: the sBTC pool. Every outflow is gov-gated. */
export const LEGION_TREASURY_CONTRACT =
  "STGX5YP51NKM69ZMP6DVB6GAJAANCG5WB3718KD9.news-treasury-v5";

/**
 * Which chain a Stacks contract id lives on, from its c32 address prefix:
 * SP/SM are mainnet, ST/SN are testnet.
 */
export function networkOfContract(contractId: string): Network {
  const prefix = contractId.slice(0, 2).toUpperCase();
  if (prefix === "SP" || prefix === "SM") return "mainnet";
  if (prefix === "ST" || prefix === "SN") return "testnet";
  throw new Error(
    `Cannot derive a network from contract id "${contractId}": ` +
      `expected an address starting with SP/SM (mainnet) or ST/SN (testnet).`
  );
}

/** The chain the legion contracts are deployed on. */
export const LEGION_NETWORK: Network = networkOfContract(LEGION_GOV_CONTRACT);

/**
 * The viewer page for an inscription. This is the form every proposal on chain
 * already stores, and the form a voter wants: clicking it opens the ordinals
 * viewer rather than dumping raw markdown.
 */
export const ORDINALS_INSCRIPTION_BASE = "https://ordinals.com/inscription/";

/** The raw bytes of an inscription — what a reader fetches to render the piece. */
export const ORDINALS_CONTENT_BASE = "https://ordinals.com/content/";

/** The public reader for this legion. */
export const LEGION_SITE_URL = "https://legions.aibtc.news";

/** `link` is `(string-ascii 200)`. */
export const MAX_LINK_LENGTH = 200;
/** `title` is `(string-ascii 128)`. */
export const MAX_TITLE_LENGTH = 128;
/** `description` is `(string-ascii 512)`. */
export const MAX_DESCRIPTION_LENGTH = 512;
/** `sponsor-in` `name` is `(string-ascii 40)`. */
export const MAX_SPONSOR_NAME_LENGTH = 40;
/** `sponsor-in` `link` is `(optional (string-ascii 96))`. */
export const MAX_SPONSOR_LINK_LENGTH = 96;
/** `sponsor-in` `memo` is `(string-ascii 128)`. */
export const MAX_SPONSOR_MEMO_LENGTH = 128;

/** Story status uints as stored by the gov contract. */
export const STORY_STATUS: Record<number, string> = {
  0: "OPEN",
  1: "PASSED",
  2: "FAILED",
  3: "EXPIRED",
};

/**
 * Contract error codes, so a revert reads as a sentence rather than a `u4xx`.
 * Gov and treasury codes are disjoint, so one map covers both.
 */
export const LEGION_ERRORS: Record<number, string> = {
  401: "ineligible — your weight is below minWeight (contribute more first)",
  402: "treasury has insufficient balance",
  403: "treasury already wired to a gov contract",
  404: "no proposal with that id",
  405: "you have already voted on this proposal",
  407: "voting has closed on this proposal",
  408: "too early to conclude — the veto window has not closed yet",
  409: "amount must be greater than zero",
  410: "this proposal is already concluded",
  411: "invalid payout recipient",
  413: "your free weight does not cover the bond",
  416: "this payout was already settled",
  417: "the treasury payout failed",
  418: "the pool is empty — nothing to draw against",
  419: "the draw would round to zero sats",
  421: "the ordinals link must not be empty",
  423: "a proposer cannot vote on their own piece",
  424: "outside the veto window",
  425: "you have already vetoed this proposal",
  426: "contribution too small to mint any weight",
  432: "too soon to propose — the global propose interval has not elapsed",
  433: "the title must not be empty",
  434: "you already have a live proposal (one at a time per principal)",
  435: "the conclude window has passed — this proposal has already expired",
  436: "voting has not opened yet (still in the pending period)",
  437: "contribution is below minContribution",
  450: "sponsorship is below the treasury's minimum sponsor amount",
  451: "the sponsor name must not be empty",
  452: "the treasury is not wired to a gov contract yet",
};
