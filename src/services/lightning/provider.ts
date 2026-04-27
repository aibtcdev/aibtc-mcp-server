/**
 * Lightning Network provider interface.
 *
 * Implementations wrap a specific Lightning backend (e.g. Spark SDK, NWC) and
 * expose a uniform shape the L402 interceptor and lightning tools can depend on.
 */

export interface LightningProvider {
  /**
   * Pay a BOLT-11 Lightning invoice.
   *
   * @param bolt11 - BOLT-11 encoded Lightning invoice
   * @param maxFeeSats - Optional maximum routing fee in sats (provider default applies when omitted)
   * @returns Payment preimage (hex) and fees paid (in sats)
   */
  payInvoice(
    bolt11: string,
    maxFeeSats?: number
  ): Promise<{ preimage: string; feesPaid: number }>;

  /**
   * Create a BOLT-11 Lightning invoice for receiving a payment.
   *
   * @param amountSats - Amount to invoice in sats
   * @param memo - Optional description
   * @returns BOLT-11 invoice string and payment hash (hex)
   */
  createInvoice(
    amountSats: number,
    memo?: string
  ): Promise<{ bolt11: string; paymentHash: string }>;

  /**
   * Get the spendable Lightning balance in sats.
   */
  getBalance(): Promise<{ balanceSats: number }>;

  /**
   * Get an on-chain deposit address for funding the Lightning wallet from L1 BTC.
   */
  getDepositAddress(): Promise<string>;

  /**
   * Claim an on-chain deposit (credits the Lightning balance).
   *
   * Implementations should follow the canonical Spark deposit flow:
   *   1. Fetch a quote from the SSP (signed `creditAmountSats`).
   *   2. Submit the quote's signature with the claim.
   *
   * The caller commits to whatever the SSP's signed quote charges in fees;
   * callers that need a max-fee guard should fetch the quote separately and
   * inspect it before invoking this method.
   *
   * @param transactionId - Bitcoin transaction id sending BTC to the deposit address
   * @param outputIndex - Optional output index of the deposit (vout). Required when
   *                      the deposit is not at the default vout the SSP would auto-detect.
   * @returns Number of sats credited to the Lightning balance and the resulting
   *          Spark transfer id (so callers can correlate the claim with the
   *          subsequent transfer).
   */
  claimDeposit(
    transactionId: string,
    outputIndex?: number
  ): Promise<{ creditedSats: number; transferId: string }>;

  /**
   * Optional: return a Lightning address (user@domain) the wallet can receive to.
   * Implementations may return null when unsupported.
   */
  getLightningAddress?(): Promise<string | null>;
}
