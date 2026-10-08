/**
 * Spending-limit metering for Bitcoin L1 transactions.
 *
 * Every tool that signs a spend from this wallet's Bitcoin keys meters the
 * sats that actually leave it: the value of the inputs it owns minus the
 * outputs that come back to its own SegWit / Taproot addresses. That counts
 * the payment, the fee and anything else the transaction sends away, whatever
 * builder produced it.
 */
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { getBtcNetwork } from "../transactions/bitcoin-builder.js";
import { BroadcastRejectedError, type MempoolApi } from "./mempool-api.js";
import { getSpendLimiter } from "./spend-limiter.js";
import type { Network } from "../config/networks.js";

/** The wallet a Bitcoin spend is billed to. */
export interface BtcSpender {
  /** Stacks address: the spend limiter's ledger key, shared with STX/sBTC spends. */
  address: string;
  btcAddress?: string;
  taprootAddress?: string;
}

function ownAddresses(spender: BtcSpender): string[] {
  return [spender.btcAddress, spender.taprootAddress].filter((a): a is string => !!a);
}

function ownScripts(spender: BtcSpender, network: Network): string[] {
  const decoder = btc.Address(getBtcNetwork(network));
  return ownAddresses(spender).map((a) => hex.encode(btc.OutScript.encode(decoder.decode(a))));
}

/** Sats paid back to the wallet by the transaction's outputs. */
function ownOutputSats(tx: btc.Transaction, spender: BtcSpender, network: Network): bigint {
  const own = new Set(ownScripts(spender, network));
  let total = 0n;
  for (let i = 0; i < tx.outputsLength; i++) {
    const out = tx.getOutput(i);
    if (out.script && out.amount !== undefined && own.has(hex.encode(out.script))) {
      total += out.amount;
    }
  }
  return total;
}

/**
 * Sats a signed raw transaction takes out of the wallet. Input values come
 * from the previous transactions (mempool or chain), so this holds for any
 * builder and for inputs the wallet does not own.
 */
export async function btcTxOutflowSats(
  api: MempoolApi,
  txHex: string,
  spender: BtcSpender,
  network: Network
): Promise<bigint> {
  const tx = btc.Transaction.fromRaw(hex.decode(txHex), {
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
  });
  const own = new Set(ownAddresses(spender));
  const prevTxs = new Map<string, Awaited<ReturnType<MempoolApi["getTx"]>>>();

  let ownIn = 0n;
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);
    if (!input.txid || input.index === undefined) {
      throw new Error(`Cannot meter Bitcoin spend: input ${i} has no outpoint.`);
    }
    const txid = hex.encode(input.txid);
    let prev = prevTxs.get(txid);
    if (!prev) {
      prev = await api.getTx(txid);
      prevTxs.set(txid, prev);
    }
    const prevOut = prev.vout[input.index];
    if (!prevOut) {
      throw new Error(`Cannot meter Bitcoin spend: ${txid}:${input.index} does not exist.`);
    }
    if (prevOut.scriptpubkey_address && own.has(prevOut.scriptpubkey_address)) {
      ownIn += BigInt(prevOut.value);
    }
  }

  const outflow = ownIn - ownOutputSats(tx, spender, network);
  return outflow > 0n ? outflow : 0n;
}

/**
 * Sats the inputs this wallet just signed in a PSBT take out of it. Metered
 * at signing, because a signed PSBT can be broadcast by anyone. Every signed
 * input must carry its prevout amount (witnessUtxo); one without it cannot be
 * metered, so signing is refused.
 */
export function psbtOutflowSats(
  tx: btc.Transaction,
  signedInputs: number[],
  spender: BtcSpender,
  network: Network
): bigint {
  let ownIn = 0n;
  for (const idx of signedInputs) {
    const amount = tx.getInput(idx).witnessUtxo?.amount;
    if (amount === undefined) {
      throw new Error(
        `Cannot meter input ${idx}: it has no witnessUtxo amount, so the spending limit ` +
          "cannot tell what it spends. Refusing to sign."
      );
    }
    ownIn += amount;
  }
  const outflow = ownIn - ownOutputSats(tx, spender, network);
  return outflow > 0n ? outflow : 0n;
}

/**
 * Broadcast a signed transaction that spends from this wallet, metered by the
 * spending limit: booked before broadcast (refused when it would exceed the
 * cap), given back only when the node rejects it. A network error leaves it
 * unknown whether the transaction was relayed, so the booking stands.
 */
export async function meteredBtcBroadcast(
  api: MempoolApi,
  txHex: string,
  spender: BtcSpender,
  network: Network
): Promise<string> {
  const amount = await btcTxOutflowSats(api, txHex, spender, network);
  const limiter = getSpendLimiter();
  const reservation = await limiter.reserve([{ unit: "sats", amount }], spender.address);
  try {
    return await api.broadcastTransaction(txHex);
  } catch (error) {
    if (error instanceof BroadcastRejectedError) await limiter.release(reservation);
    throw error;
  }
}
