import * as btc from "@scure/btc-signer";
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

/**
 * Decode a base64 PSBT for psbt_decode / psbt_sign / psbt_broadcast.
 *
 * Fields the server does not interpret (proprietary 0xFC pairs, unknown keys)
 * must survive decode -> sign -> encode: marketplaces and co-signers put their
 * own data there, and psbt_sign hands the PSBT back to them. The round-trip is
 * pinned in tests/tools/psbt-helpers.test.ts. @scure/btc-signer >= 2.4.0 strips
 * both by default, hence `proprietary` / `unknown: "ignore"` below
 * (https://github.com/paulmillr/scure-btc-signer/releases/tag/2.4.0).
 */
export function decodePsbtBase64(psbtBase64: string): btc.Transaction {
  const bytes = Buffer.from(psbtBase64, "base64");
  if (bytes.length === 0) {
    throw new Error("Invalid PSBT: empty base64 payload");
  }
  return btc.Transaction.fromPSBT(bytes, {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    disableScriptCheck: true,
    proprietary: "ignore",
    unknown: "ignore",
  });
}

export function encodePsbtBase64(tx: btc.Transaction): string {
  return Buffer.from(tx.toPSBT()).toString("base64");
}
