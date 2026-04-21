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
      fee?: { originalValue?: number };
    };

    if (!sendRequest.paymentPreimage) {
      throw new Error(
        "Lightning payment did not return a preimage (may have routed over Spark instead of Lightning). " +
          "L402 requires a Lightning preimage for authentication."
      );
    }

    const feesPaid = Number(sendRequest.fee?.originalValue ?? 0);

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
    maxFeeSats: number
  ): Promise<{ creditedSats: number }> {
    const result = await this.wallet.claimStaticDepositWithMaxFee({
      transactionId,
      maxFee: maxFeeSats,
    });

    if (!result) {
      throw new Error(
        `Claim deposit failed: SSP returned no quote for transaction ${transactionId} under max fee ${maxFeeSats} sats.`
      );
    }

    // ClaimStaticDepositOutput exposes a credit amount via `creditAmountSats`
    // (the SSP-confirmed amount). We cast narrowly since the SDK's type is
    // internal-facing.
    const credited = (result as { creditAmountSats?: number }).creditAmountSats;
    if (typeof credited !== "number") {
      throw new Error(
        "Claim deposit succeeded but SSP response is missing creditAmountSats."
      );
    }

    return { creditedSats: credited };
  }

  /**
   * Return the network this provider is configured for.
   */
  getNetwork(): Network {
    return this.network;
  }
}
