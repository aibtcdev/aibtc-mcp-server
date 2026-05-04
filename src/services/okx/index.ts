export * from "./types.js";
export { OKX_CANDLE_BARS } from "./types.js";
export {
  okxGet,
  okxAuthGet,
  getOkxBaseUrl,
  getOkxWeb3BaseUrl,
} from "./client.js";
export type { OkxRequestOptions } from "./client.js";
export {
  getTicker,
  getTickers,
  getOrderBook,
  getCandles,
} from "./market.js";
export type { OkxTicker, OkxOrderBook, OkxCandle } from "./market.js";

export {
  signOkxRequest,
  okxTimestamp,
  buildOkxAuthHeaders,
  getOkxCredentials,
  OkxCredentialsMissingError,
} from "./auth.js";
export type { OkxCredentials } from "./auth.js";

export {
  getDexSupportedChains,
  getDexAllTokens,
  getDexQuote,
  getDexSwapTx,
  getDexApproveTx,
} from "./dex.js";
export type {
  OkxDexChain,
  OkxDexToken,
  OkxDexQuoteParams,
  OkxDexSwapParams,
  OkxDexApproveParams,
} from "./dex.js";

export {
  getWalletSupportedChains,
  getWalletTokenBalances,
  getWalletUtxos,
} from "./wallet.js";
export type {
  OkxWalletChain,
  OkxWalletTokenBalance,
  OkxWalletUtxo,
} from "./wallet.js";
