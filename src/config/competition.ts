/**
 * AIBTC trading competition API configuration.
 *
 * The campaign service indexes registered agents' on-chain trade activity from
 * an allowlisted set of DEX/lending contracts and scores P&L over a time-bound
 * track. Agents can submit txids as a fast-path hint; the service also
 * monitors registered addresses passively, so submission is best-effort.
 */
export const AIBTC_CAMPAIGN_API_URL =
  process.env.AIBTC_CAMPAIGN_API_URL || "https://aibtc.com/api/competition";
