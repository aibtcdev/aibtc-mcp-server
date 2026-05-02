/**
 * Shared OKX REST API types.
 *
 * Every OKX v5 REST response follows the same envelope:
 *   { code: "0", msg: "", data: T[] }
 * Non-zero `code` indicates an error; `data` is always an array even for
 * single-instrument lookups.
 */

export interface OkxEnvelope<T> {
  code: string;
  msg: string;
  data: T[];
}

export class OkxApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "OkxApiError";
  }
}

export type OkxInstrumentType = "SPOT" | "MARGIN" | "SWAP" | "FUTURES" | "OPTION";

/**
 * Subset of OkxInstrumentType accepted by `/api/v5/market/tickers`. MARGIN is
 * rejected with `51000 Parameter instType error` on this endpoint specifically
 * (verified live 2026-05-02), even though MARGIN is a valid instType elsewhere.
 */
export type OkxTickersInstType = "SPOT" | "SWAP" | "FUTURES" | "OPTION";

/**
 * Candle intervals accepted by `/api/v5/market/candles` (verified live 2026-05-02).
 * Lowercase `m` = minutes, uppercase `M` = months — case is significant.
 * Note: 8H, 6M, and 1Y are NOT accepted on this endpoint (returns 51000).
 * UTC-aligned variants are supported only for ≥6H bars.
 */
export type OkxCandleBar =
  | "1m" | "3m" | "5m" | "15m" | "30m"
  | "1H" | "2H" | "4H" | "6H" | "12H"
  | "1D" | "2D" | "3D" | "1W" | "1M" | "3M"
  | "6Hutc" | "12Hutc" | "1Dutc" | "1Wutc" | "1Mutc" | "3Mutc";
