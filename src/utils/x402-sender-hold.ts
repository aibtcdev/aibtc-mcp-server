/**
 * Sender holds for x402 payments (#757).
 *
 * When the relay reports sender_nonce_duplicate as retryable, the earlier
 * payment tx may still be pending. Signing another payment would take the next
 * nonce, and both could confirm. A hold, keyed by sender address, makes the
 * payment interceptor refuse to sign while that sender still has a pending tx,
 * and refuse once if the held payment's tx has confirmed.
 */

const HOLD_TTL_MS = 30 * 60 * 1000;

export interface SenderHold {
  paymentId: string;
  txid?: string;
  recordedAt: number;
}

/** The Hiro calls a hold check needs. */
export interface SenderHoldChain {
  getNonceInfo(address: string): Promise<{
    last_mempool_tx_nonce: number | null;
    last_executed_tx_nonce: number;
    detected_mempool_nonces: number[];
  }>;
  getTransactionStatus(txid: string): Promise<{ status: string }>;
}

const holds = new Map<string, SenderHold>();

export function recordSenderHold(address: string, hold: Omit<SenderHold, "recordedAt">): void {
  holds.set(address, { ...hold, recordedAt: Date.now() });
}

export function clearSenderHolds(): void {
  holds.clear();
}

/**
 * Throws if a new payment from `address` could duplicate a held one. Clears
 * the hold when it is safe to pay again. Chain lookup errors propagate, so a
 * failed check blocks the payment instead of risking a second one.
 */
export async function assertNoSenderHold(address: string, chain: SenderHoldChain): Promise<void> {
  const hold = holds.get(address);
  if (!hold) return;
  if (Date.now() - hold.recordedAt > HOLD_TTL_MS) {
    holds.delete(address);
    return;
  }

  const nonces = await chain.getNonceInfo(address);
  const pending =
    nonces.detected_mempool_nonces.length > 0 ||
    (nonces.last_mempool_tx_nonce !== null &&
      nonces.last_mempool_tx_nonce > nonces.last_executed_tx_nonce);
  if (pending) {
    throw new Error(
      `Not signing a new payment: payment ${hold.paymentId} failed with sender_nonce_duplicate ` +
        `and ${address} still has a pending transaction, which may be that payment. ` +
        `A new payment now could be paid twice. Retry after the pending transaction confirms or drops.`
    );
  }

  if (hold.txid) {
    const { status } = await chain.getTransactionStatus(hold.txid);
    if (status === "success") {
      holds.delete(address);
      throw new Error(
        `Not signing a new payment: payment ${hold.paymentId} confirmed on chain (txid ${hold.txid}) ` +
          `after the relay reported sender_nonce_duplicate, so the endpoint has been paid. ` +
          `Contact the endpoint with that txid. Retry the request only if you mean to pay again.`
      );
    }
  }

  holds.delete(address);
}
