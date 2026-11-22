/**
 * Runestone Builder
 *
 * Minimal Runestone OP_RETURN encoder for single-edict rune transfers.
 * Encodes a Runestone message as an OP_RETURN output script.
 *
 * Protocol spec: https://docs.ordinals.com/runes.html
 */

// ---------------------------------------------------------------------------
// LEB128 encoding
// ---------------------------------------------------------------------------

/**
 * Encode a bigint as unsigned LEB128 bytes.
 */
export function encodeLEB128(value: bigint): Uint8Array {
  if (value < 0n) throw new Error("LEB128 only encodes unsigned values");

  const bytes: number[] = [];
  do {
    let byte = Number(value & 0x7fn);
    value >>= 7n;
    if (value !== 0n) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (value !== 0n);

  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// Runestone encoding
// ---------------------------------------------------------------------------

export interface RuneEdict {
  /** Rune ID block height (e.g., 840000) */
  block: bigint;
  /** Rune ID transaction index within block */
  txIndex: bigint;
  /** Amount of runes to transfer (in smallest unit) */
  amount: bigint;
  /** Output index to send runes to */
  outputIndex: number;
}

export interface RunestoneOptions {
  edict: RuneEdict;
  /** Output index for remaining rune balance (change pointer) */
  changeOutput: number;
}

/**
 * Build a Runestone OP_RETURN script for a single-edict rune transfer.
 * Always includes an explicit change pointer to avoid burning remaining runes.
 */
export function buildRunestoneScript(options: RunestoneOptions): Uint8Array {
  const { edict, changeOutput } = options;

  const parts: Uint8Array[] = [];

  // The message is a sequence of tag/value pairs, and tag 0 (Body) ENDS the
  // field list: every integer after it is read as part of an edict. So the
  // pointer field (tag 22) has to be written first, and the Body tag appears
  // exactly once, followed by the four edict integers (block, tx index,
  // amount, output). Emitting the pointer after the Body tag, or repeating the
  // Body tag before each edict field, produces a malformed runestone that ord
  // deciphers as a cenotaph and burns every rune in the transaction.
  // https://docs.ordinals.com/runes/specification.html

  // Tag 22: pointer (output that keeps the runes no edict allocates)
  parts.push(encodeLEB128(22n), encodeLEB128(BigInt(changeOutput)));

  // Tag 0: Body, then the single edict
  parts.push(encodeLEB128(0n));
  parts.push(encodeLEB128(edict.block));
  parts.push(encodeLEB128(edict.txIndex));
  parts.push(encodeLEB128(edict.amount));
  parts.push(encodeLEB128(BigInt(edict.outputIndex)));

  const payloadLength = parts.reduce((sum, p) => sum + p.length, 0);

  // OP_RETURN (0x6a) OP_13 (0x5d) <pushdata>
  const script: number[] = [0x6a, 0x5d];

  if (payloadLength < 76) {
    script.push(payloadLength);
  } else if (payloadLength < 256) {
    script.push(0x4c, payloadLength);
  } else {
    script.push(0x4d, payloadLength & 0xff, (payloadLength >> 8) & 0xff);
  }

  for (const part of parts) {
    for (const byte of part) {
      script.push(byte);
    }
  }

  return new Uint8Array(script);
}

/**
 * Parse a rune ID string (e.g., "840000:1") into block and tx components.
 */
export function parseRuneId(runeId: string): { block: bigint; txIndex: bigint } {
  const [blockStr, txStr] = runeId.split(":");
  if (!blockStr || !txStr) {
    throw new Error(`Invalid rune ID format: "${runeId}". Expected "block:tx" (e.g., "840000:1")`);
  }
  return {
    block: BigInt(blockStr),
    txIndex: BigInt(txStr),
  };
}
