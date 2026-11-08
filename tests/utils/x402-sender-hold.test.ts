import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  assertNoSenderHold,
  clearSenderHolds,
  recordSenderHold,
  type SenderHoldChain,
} from "../../src/utils/x402-sender-hold.js";

const ADDRESS = "SP000000000000000000002Q6VF78";

function chain(opts: { pending: boolean; txStatus?: string }): SenderHoldChain {
  return {
    getNonceInfo: vi.fn().mockResolvedValue({
      last_mempool_tx_nonce: opts.pending ? 8 : null,
      last_executed_tx_nonce: 7,
      detected_mempool_nonces: opts.pending ? [8] : [],
    }),
    getTransactionStatus: vi.fn().mockResolvedValue({ status: opts.txStatus ?? "pending" }),
  };
}

describe("x402 sender hold (#757)", () => {
  beforeEach(() => clearSenderHolds());

  it("does nothing without a hold", async () => {
    const c = chain({ pending: true });
    await expect(assertNoSenderHold(ADDRESS, c)).resolves.toBeUndefined();
    expect(c.getNonceInfo).not.toHaveBeenCalled();
  });

  it("refuses while the sender has a pending tx, and keeps the hold", async () => {
    recordSenderHold(ADDRESS, { paymentId: "pay_dup" });
    await expect(assertNoSenderHold(ADDRESS, chain({ pending: true }))).rejects.toThrow(/pay_dup/);
    await expect(assertNoSenderHold(ADDRESS, chain({ pending: true }))).rejects.toThrow(/pending transaction/);
  });

  it("releases once nothing is pending and the held tx did not confirm", async () => {
    recordSenderHold(ADDRESS, { paymentId: "pay_dup", txid: "0xabc" });
    await expect(assertNoSenderHold(ADDRESS, chain({ pending: false, txStatus: "abort_by_response" }))).resolves.toBeUndefined();
    const after = chain({ pending: true });
    await assertNoSenderHold(ADDRESS, after);
    expect(after.getNonceInfo).not.toHaveBeenCalled();
  });

  it("refuses once when the held payment confirmed, then releases", async () => {
    recordSenderHold(ADDRESS, { paymentId: "pay_dup", txid: "0xabc" });
    await expect(assertNoSenderHold(ADDRESS, chain({ pending: false, txStatus: "success" }))).rejects.toThrow(/confirmed on chain/);
    await expect(assertNoSenderHold(ADDRESS, chain({ pending: false, txStatus: "success" }))).resolves.toBeUndefined();
  });

  it("expires after 30 minutes", async () => {
    vi.useFakeTimers();
    try {
      recordSenderHold(ADDRESS, { paymentId: "pay_dup" });
      vi.advanceTimersByTime(30 * 60 * 1000 + 1);
      await expect(assertNoSenderHold(ADDRESS, chain({ pending: true }))).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
