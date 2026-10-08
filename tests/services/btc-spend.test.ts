import { describe, expect, it, vi, beforeEach } from "vitest";
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { secp256k1 } from "@noble/curves/secp256k1.js";

const { check, record } = vi.hoisted(() => ({
  check: vi.fn(async () => {}),
  record: vi.fn(async () => {}),
}));

vi.mock("../../src/services/spend-limiter.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/services/spend-limiter.js")>();
  return { ...actual, getSpendLimiter: () => ({ check, record }) };
});

import {
  btcTxOutflowSats,
  meteredBtcBroadcast,
  psbtOutflowSats,
} from "../../src/services/btc-spend.js";

const NET = btc.TEST_NETWORK;
const key = (n: number) => {
  const k = new Uint8Array(32);
  k[31] = n;
  return k;
};
const ownKey = key(1);
const ownWpkh = btc.p2wpkh(secp256k1.getPublicKey(ownKey, true), NET);
const ownTr = btc.p2tr(secp256k1.getPublicKey(key(2), true).slice(1), undefined, NET);
const other = btc.p2wpkh(secp256k1.getPublicKey(key(3), true), NET);

const spender = {
  address: "ST000000000000000000002AMW42H",
  btcAddress: ownWpkh.address!,
  taprootAddress: ownTr.address!,
};

const PREV_TXID = "aa".repeat(31) + "01"; // asymmetric, so a byte-order mix-up shows

/** Signed tx spending one 100_000-sat UTXO of ours: 30_000 away, change back, fee the rest. */
function signedSpend(change: bigint, to = other.address!) {
  const tx = new btc.Transaction();
  tx.addInput({
    txid: PREV_TXID,
    index: 1,
    witnessUtxo: { script: ownWpkh.script, amount: 100_000n },
  });
  tx.addOutputAddress(to, 30_000n, NET);
  tx.addOutputAddress(ownWpkh.address!, change, NET);
  tx.sign(ownKey);
  tx.finalize();
  return tx.hex;
}

function mempool(prevOwner: string) {
  return {
    getTx: vi.fn(async (txid: string) => ({
      txid,
      vout: [
        { value: 5, scriptpubkey_address: other.address, scriptpubkey_type: "v0_p2wpkh" },
        { value: 100_000, scriptpubkey_address: prevOwner, scriptpubkey_type: "v0_p2wpkh" },
      ],
    })),
    broadcastTransaction: vi.fn(async () => "broadcast-txid"),
  };
}

beforeEach(() => {
  check.mockReset();
  record.mockReset();
});

describe("btcTxOutflowSats", () => {
  it("counts payment plus fee: own inputs minus change to own addresses", async () => {
    const api = mempool(ownWpkh.address!);
    const outflow = await btcTxOutflowSats(api as never, signedSpend(69_000n), spender, "testnet");
    // 100_000 in, 69_000 change back → 30_000 payment + 1_000 fee leave the wallet.
    expect(outflow).toBe(31_000n);
    // The prevout is looked up by the txid as explorers show it.
    expect(api.getTx).toHaveBeenCalledWith(PREV_TXID);
  });

  it("counts a payment to the wallet's own Taproot address as not leaving", async () => {
    const api = mempool(ownWpkh.address!);
    const outflow = await btcTxOutflowSats(
      api as never,
      signedSpend(69_000n, ownTr.address!),
      spender,
      "testnet"
    );
    expect(outflow).toBe(1_000n);
  });

  it("ignores inputs the wallet does not own", async () => {
    const api = mempool(other.address!);
    const outflow = await btcTxOutflowSats(api as never, signedSpend(69_000n), spender, "testnet");
    expect(outflow).toBe(0n);
  });

  it("refuses to meter an input whose outpoint does not exist", async () => {
    const api = {
      getTx: vi.fn(async () => ({ vout: [] })),
      broadcastTransaction: vi.fn(),
    };
    await expect(
      btcTxOutflowSats(api as never, signedSpend(69_000n), spender, "testnet")
    ).rejects.toThrow(/does not exist/);
  });
});

describe("meteredBtcBroadcast", () => {
  it("checks before broadcasting and records after", async () => {
    const api = mempool(ownWpkh.address!);
    const txid = await meteredBtcBroadcast(api as never, signedSpend(69_000n), spender, "testnet");
    expect(txid).toBe("broadcast-txid");
    expect(check).toHaveBeenCalledWith("sats", 31_000n, spender.address);
    expect(record).toHaveBeenCalledWith("sats", 31_000n, spender.address);
  });

  it("does not broadcast when the limit refuses", async () => {
    check.mockRejectedValueOnce(new Error("spend limit exceeded"));
    const api = mempool(ownWpkh.address!);
    await expect(
      meteredBtcBroadcast(api as never, signedSpend(69_000n), spender, "testnet")
    ).rejects.toThrow("spend limit exceeded");
    expect(api.broadcastTransaction).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe("psbtOutflowSats", () => {
  it("meters the signed inputs minus outputs back to the wallet", () => {
    const tx = new btc.Transaction();
    tx.addInput({ txid: PREV_TXID, index: 0, witnessUtxo: { script: ownWpkh.script, amount: 50_000n } });
    tx.addInput({ txid: PREV_TXID, index: 1, witnessUtxo: { script: other.script, amount: 546n } });
    tx.addOutputAddress(ownTr.address!, 546n, NET); // inscription lands with us
    tx.addOutputAddress(other.address!, 40_000n, NET); // seller payment
    tx.addOutputAddress(ownWpkh.address!, 9_000n, NET); // change
    expect(psbtOutflowSats(tx, [0], spender, "testnet")).toBe(50_000n - 546n - 9_000n);
  });

  it("refuses a signed input without a witnessUtxo amount", () => {
    const tx = new btc.Transaction();
    tx.addInput({ txid: PREV_TXID, index: 0 });
    tx.addOutputAddress(other.address!, 1_000n, NET);
    expect(() => psbtOutflowSats(tx, [0], spender, "testnet")).toThrow(/witnessUtxo/);
  });
});
