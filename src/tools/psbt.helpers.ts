import {
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  TX_OVERHEAD_VBYTES,
} from "../config/bitcoin-constants.js";

export interface BitcoinOutpoint {
  txid: string;
  vout: number;
}

export function parseOutpoint(outpoint: string): BitcoinOutpoint {
  const trimmed = outpoint.trim();
  const match = /^([0-9a-fA-F]{64}):(\d+)$/.exec(trimmed);
  if (!match) {
    throw new Error(
      "Invalid outpoint format. Use 'txid:vout' where txid is 64 hex chars."
    );
  }

  const vout = Number.parseInt(match[2], 10);
  if (!Number.isSafeInteger(vout) || vout < 0) {
    throw new Error("Invalid outpoint vout: must be a non-negative integer.");
  }

  return { txid: match[1].toLowerCase(), vout };
}

export function estimateBuyPsbtFeeSats(params: {
  feeRate: number;
  buyerInputCount: number;
  sellerInputVbytes: number;
  outputCount: number;
}): number {
  const { feeRate, buyerInputCount, sellerInputVbytes, outputCount } = params;

  if (feeRate <= 0) {
    throw new Error("feeRate must be positive");
  }
  if (buyerInputCount < 0) {
    throw new Error("buyerInputCount must be non-negative");
  }
  if (sellerInputVbytes <= 0) {
    throw new Error("sellerInputVbytes must be positive");
  }
  if (outputCount < 1) {
    throw new Error("outputCount must be at least 1");
  }

  const vsize =
    TX_OVERHEAD_VBYTES +
    sellerInputVbytes +
    buyerInputCount * P2WPKH_INPUT_VBYTES +
    outputCount * P2WPKH_OUTPUT_VBYTES;

  return Math.ceil(vsize * feeRate);
}
