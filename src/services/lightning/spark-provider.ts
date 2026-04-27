/**
 * Spark SDK-backed LightningProvider implementation.
 *
 * Wraps SparkWallet (from @buildonspark/spark-sdk) to satisfy the
 * LightningProvider interface. Auth is handled by the SDK using the user's
 * BIP39 identity key — no API key is required.
 */

import { SparkWallet } from "@buildonspark/spark-sdk";
import type { Network } from "../../config/networks.js";
import type { LightningProvider } from "./provider.js";

/**
 * Map aibtc Network to Spark SDK network type.
 * aibtc only supports mainnet/testnet; Spark ships MAINNET + REGTEST for
 * self-custodial use, so testnet is mapped to REGTEST per the PR spec.
 */
function toSparkNetwork(network: Network): "MAINNET" | "REGTEST" {
  return network === "mainnet" ? "MAINNET" : "REGTEST";
}

/**
 * Default max routing fee used when the caller does not pass one.
 * 10 sats covers typical small-invoice routing without being permissive.
 */
const DEFAULT_MAX_FEE_SATS = 10;

/**
 * Spark's CurrencyAmount as exposed by the SDK type definitions:
 *   { originalValue: number, originalUnit: CurrencyUnit }
 *
 * The CurrencyUnit enum values are string literals at runtime, so we compare
 * against the literal strings without importing the enum (it is not part of
 * the SDK's public exports).
 */
interface SparkCurrencyAmount {
  originalValue: number;
  originalUnit: string;
}

/**
 * Convert a Spark `CurrencyAmount` to whole satoshis.
 *
 * Sub-satoshi units (MILLISATOSHI, NANOBITCOIN) are floored — the L402 / fee
 * reporting surface deals in whole sats. Fiat units (USD, MXN, PHP, EUR) and
 * the SDK's FUTURE_VALUE sentinel must never appear on a wallet operation; if
 * they do, that is an SDK contract violation we want to surface rather than
 * silently coerce.
 */
function currencyAmountToSats(amount: SparkCurrencyAmount): number {
  const { originalValue: value, originalUnit: unit } = amount;
  switch (unit) {
    case "SATOSHI":
      return value;
    case "MILLISATOSHI":
      return Math.floor(value / 1000);
    case "BITCOIN":
      return value * 100_000_000;
    case "MILLIBITCOIN":
      return value * 100_000;
    case "MICROBITCOIN":
      return value * 100;
    case "NANOBITCOIN":
      return Math.floor(value / 10);
    case "USD":
    case "MXN":
    case "PHP":
    case "EUR":
    case "FUTURE_VALUE":
      throw new Error(
        `Spark returned a CurrencyAmount denominated in ${unit}; expected a Bitcoin unit. ` +
          `This is an SDK contract violation for a wallet-operation amount.`
      );
    default:
      throw new Error(
        `Unknown Spark CurrencyUnit "${unit}"; refusing to coerce to sats.`
      );
  }
}

export class SparkLightningProvider implements LightningProvider {
  private constructor(
    private readonly wallet: SparkWallet,
    private readonly network: Network
  ) {}

  /**
   * Initialize a Spark-backed provider from a mnemonic.
   * The wallet itself is managed by the lightning-manager singleton — this
   * factory is the only place the SDK is touched directly.
   */
  static async initialize(
    mnemonic: string,
    network: Network
  ): Promise<SparkLightningProvider> {
    const { wallet } = await SparkWallet.initialize({
      mnemonicOrSeed: mnemonic,
      options: {
        network: toSparkNetwork(network),
      },
    });
    return new SparkLightningProvider(wallet, network);
  }

  async payInvoice(
    bolt11: string,
    maxFeeSats?: number
  ): Promise<{ preimage: string; feesPaid: number }> {
    const result = await this.wallet.payLightningInvoice({
      invoice: bolt11,
      maxFeeSats: maxFeeSats ?? DEFAULT_MAX_FEE_SATS,
    });

    // payLightningInvoice returns LightningSendRequest | WalletTransfer.
    // A successful Lightning payment yields a LightningSendRequest with a
    // paymentPreimage — Spark-routed fallbacks (WalletTransfer) have no
    // preimage and can't satisfy an L402 challenge.
    const sendRequest = result as {
      paymentPreimage?: string;
      fee?: SparkCurrencyAmount;
    };

    if (!sendRequest.paymentPreimage) {
      throw new Error(
        "Lightning payment did not return a preimage (may have routed over Spark instead of Lightning). " +
          "L402 requires a Lightning preimage for authentication."
      );
    }

    // LightningSendRequest.fee is a CurrencyAmount whose originalUnit can be
    // any of {SATOSHI, MILLISATOSHI, BITCOIN, ...}. Reading originalValue
    // blindly as sats mis-reports fees by orders of magnitude on non-SATOSHI
    // units — pass through the helper so the unit is always honored.
    const feesPaid = sendRequest.fee
      ? currencyAmountToSats(sendRequest.fee)
      : 0;

    return {
      preimage: sendRequest.paymentPreimage,
      feesPaid,
    };
  }

  async createInvoice(
    amountSats: number,
    memo?: string
  ): Promise<{ bolt11: string; paymentHash: string }> {
    const receiveRequest = await this.wallet.createLightningInvoice({
      amountSats,
      memo,
    });

    return {
      bolt11: receiveRequest.invoice.encodedInvoice,
      paymentHash: receiveRequest.invoice.paymentHash,
    };
  }

  async getBalance(): Promise<{ balanceSats: number }> {
    const balance = await this.wallet.getBalance();
    return {
      balanceSats: Number(balance.satsBalance.available),
    };
  }

  async getDepositAddress(): Promise<string> {
    return this.wallet.getStaticDepositAddress();
  }

  async claimDeposit(
    transactionId: string,
    maxFeeSats: number,
    outputIndex?: number
  ): Promise<{ creditedSats: number; transferId: string }> {
    // The SDK's ClaimStaticDepositOutput is exactly { transferId: string } —
    // it does not include the credit amount. Fetch the SSP quote first to
    // capture creditAmountSats, then perform the claim.
    const quote = await this.wallet.getClaimStaticDepositQuote(
      transactionId,
      outputIndex
    );

    const result = await this.wallet.claimStaticDepositWithMaxFee({
      transactionId,
      maxFee: maxFeeSats,
      outputIndex,
    });

    // claimStaticDepositWithMaxFee returns null when the SSP quote charges
    // more in fees than `maxFee` — i.e. the claim was aborted, not failed.
    // Surface this as a clear error rather than a fake success.
    if (!result) {
      throw new Error(
        `Claim aborted: SSP quote exceeded maxFee of ${maxFeeSats} sats ` +
          `for transaction ${transactionId}. Retry with a higher maxFeeSats.`
      );
    }

    return {
      creditedSats: quote.creditAmountSats,
      transferId: result.transferId,
    };
  }

  /**
   * Return the network this provider is configured for.
   */
  getNetwork(): Network {
    return this.network;
  }
}
