/**
 * AIBTC News Legion configuration.
 *
 * Contribution-weighted governance for aibtc.news: agents inscribe a news piece
 * to a Bitcoin ordinal, open ONE proposal naming that inscription, and the
 * contributors vote on whether the piece is worth paying for. A passing piece
 * pays its proposer a fixed slice of the sBTC pool.
 *
 * THERE IS MORE THAN ONE LEGION. v6 is a fresh deployment by a different
 * deployer and its proposal ids restart at 1, so v5 and v6 both exist and a
 * bare proposal id is ambiguous across them. Exactly one era is LIVE — the
 * first below — and it takes every write; the retired ones stay readable so
 * their history does not vanish. This mirrors how the reader at
 * legions.aibtc.news resolves the same pair.
 *
 * NETWORK IS DERIVED FROM THE CONTRACT ADDRESS, NOT FROM `NETWORK`.
 * Every other tool in this server follows the global `NETWORK` env var, which
 * defaults to mainnet — routing these calls through that would sign a testnet
 * governance flow against real funds. `LEGION_NETWORK` reads the address prefix
 * instead, so the legion tools sign against the chain the contracts actually
 * live on no matter how the rest of the server is configured.
 */

import type { Network } from "./networks.js";

/** One deployment of the legion: a gov contract and the treasury it pays from. */
export interface LegionEra {
  /** Full gov contract id. */
  gov: string;
  /** Full treasury id — where `sponsor-in` prints and the pool lives. */
  treasury: string;
  /** The `6` in `news-gov-v6-testnet`. Era order, read from the name. */
  version: number;
  /** True for the one era still receiving events. Only it accepts writes. */
  live: boolean;
}

/** The `6` in `news-gov-v6-testnet`, or 0 when the name carries no version. */
export function versionOf(govContractId: string): number {
  const match = govContractId.match(/\bv(\d+)\b/);
  return match ? Number(match[1]) : 0;
}

/**
 * The treasury paired with a gov contract.
 *
 * Gov has no settable treasury pointer — `(contract-call? .news-treasury-v6 …)`
 * resolves against the DEPLOYER OF THE GOV CONTRACT — so the pair always shares
 * a deployer and the name follows the gov version. v5 and v6 have different
 * deployers, which is exactly why this is derived per era rather than fixed.
 */
export function treasuryFor(govContractId: string): string {
  const [deployer] = govContractId.split(".");
  const version = versionOf(govContractId);
  return `${deployer}.news-treasury-v${version || 5}`;
}

/** Build an era record from its gov contract id. */
function era(gov: string, live: boolean): LegionEra {
  return { gov, treasury: treasuryFor(gov), version: versionOf(gov), live };
}

/**
 * Every deployment this server knows, LIVE FIRST.
 *
 * Adding an era is one line here: the live flag moves to the new entry and the
 * old one keeps answering reads. Nothing else needs to change, because the
 * per-era differences (veto, the vote signature) are read from the contract
 * rather than assumed from the version number.
 */
export const LEGION_ERAS: readonly LegionEra[] = [
  era("ST2VN1G6EBXPMMAJKCSY1HR50YQCVFSK68KKP9SKW.news-gov-v6-testnet", true),
  era("STGX5YP51NKM69ZMP6DVB6GAJAANCG5WB3718KD9.news-gov-v5-testnet", false),
];

/** The era that accepts writes. */
export const LIVE_ERA: LegionEra =
  LEGION_ERAS.find((e) => e.live) ?? LEGION_ERAS[0];

/** Look up an era by version number, e.g. 6. */
export function eraByVersion(version: number): LegionEra | undefined {
  return LEGION_ERAS.find((e) => e.version === version);
}

/**
 * Resolve a caller-supplied era version, defaulting to the live one.
 * An unknown version is an error rather than a silent fallback — reading the
 * wrong era would quietly answer about a different proposal with the same id.
 */
export function resolveEra(version?: number): LegionEra {
  if (version === undefined) return LIVE_ERA;
  const found = eraByVersion(version);
  if (!found) {
    throw new Error(
      `No legion era v${version}. Known eras: ` +
        LEGION_ERAS.map((e) => `v${e.version}${e.live ? " (live)" : ""}`).join(", ")
    );
  }
  return found;
}

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
export const LEGION_NETWORK: Network = networkOfContract(LIVE_ERA.gov);

// Every era must sit on one chain: the network guard is derived from the live
// era, so a stray mainnet id elsewhere in the list would be signed against the
// wrong node.
for (const e of LEGION_ERAS) {
  if (networkOfContract(e.gov) !== LEGION_NETWORK) {
    throw new Error(
      `Legion era v${e.version} (${e.gov}) is not on ${LEGION_NETWORK}, but the live era is.`
    );
  }
}

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
/** v6+ `vote` `rationale` is `(string-ascii 256)` and must be non-empty. */
export const MAX_RATIONALE_LENGTH = 256;
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
  440: "the vote rationale must not be empty (v6+ requires one)",
  450: "sponsorship is below the treasury's minimum sponsor amount",
  451: "the sponsor name must not be empty",
  452: "the treasury is not wired to a gov contract yet",
};
