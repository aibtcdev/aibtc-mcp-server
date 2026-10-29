import axios, { type AxiosResponse } from "axios";
import {
  wrapAxiosWithPayment,
  decodePaymentRequired,
  decodePaymentResponse,
  X402_HEADERS,
  type StacksAccount,
} from "x402-stacks";
import { createApiClient, getAccount, isSponsoredRequirement, NETWORK } from "./x402.service.js";
import { getSpendLimiter } from "./spend-limiter.js";

/** One `accepts` entry of an x402 v2 `payment-required` header. */
export type X402Accept = NonNullable<ReturnType<typeof decodePaymentRequired>>["accepts"][number];

export type X402PostResult =
  | { paid: false; status: number; text: string }
  | {
      paid: true;
      response: AxiosResponse;
      accept: X402Accept;
      sponsored: boolean;
      txid?: string;
      payer?: string;
    };

/**
 * True when a failed x402-stacks request had already carried the signed
 * payment: the retried request's config holds the payment-signature header,
 * either on the error itself (the retry failed outright) or on its `cause`
 * (the interceptor's "402 after payment was sent").
 */
export function paymentWasSent(error: unknown): boolean {
  const carried = (e: unknown): boolean => {
    const headers = (e as { config?: { headers?: unknown } } | undefined)?.config?.headers;
    if (!headers || typeof headers !== "object") return false;
    const wanted = X402_HEADERS.PAYMENT_SIGNATURE.toLowerCase();
    return Object.entries(headers).some(
      ([name, value]) => name.toLowerCase() === wanted && value != null
    );
  };
  return carried(error) || carried((error as { cause?: unknown } | undefined)?.cause);
}

/**
 * POST a JSON body to an x402 endpoint, paying the 402 it answers with.
 *
 * The endpoint decides who pays gas. When its 402 advertises `extra.feePayer`,
 * the `x402-stacks` interceptor (`wrapAxiosWithPayment`, >=2.1.0) signs a
 * sponsored sBTC transfer with fee 0 and the facilitator co-signs and pays the
 * STX gas; the amount is booked on the spend limiter here, before signing.
 * Without it, the payment goes through `createApiClient`, which signs a
 * standard transfer at the `sbtc_transfer` fee clamp (max 0.003 STX) with an
 * exact-amount post-condition and meters it itself. The SDK's standard path
 * leaves the fee to stacks.js auto-estimation, which has no ceiling (#700).
 *
 * A bare POST never charges, so the first request is a plain-fetch probe that
 * reads the payment requirements; `beforePay` runs between the probe and the
 * signature (throw from it to abort, e.g. a balance pre-flight). A 2xx probe
 * means the endpoint asked for no payment and is returned as-is.
 */
export async function postWithX402Payment(options: {
  /** Base URL handed to `createApiClient` on the self-paid path. */
  baseUrl: string;
  url: string;
  body: unknown;
  toolName: string;
  beforePay?: (accept: X402Accept, sponsored: boolean) => Promise<void>;
  timeoutMs?: number;
}): Promise<X402PostResult> {
  const { baseUrl, url, body, toolName, beforePay } = options;
  const timeoutMs = options.timeoutMs ?? 120_000;

  const probe = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (probe.status !== 402) {
    const text = await probe.text();
    if (probe.ok) return { paid: false, status: probe.status, text };
    throw new Error(`Expected 402 payment challenge, got ${probe.status}: ${text}`);
  }

  const paymentRequired = decodePaymentRequired(
    probe.headers.get(X402_HEADERS.PAYMENT_REQUIRED)
  );
  if (!paymentRequired?.accepts?.length) {
    throw new Error("402 response missing or empty payment-required header");
  }
  const accept = paymentRequired.accepts[0];

  const sponsored = isSponsoredRequirement(accept.extra);

  if (beforePay) await beforePay(accept, sponsored);

  let response: AxiosResponse;
  // The SDK signs a sponsored (fee 0) transfer only when the requirement names
  // a fee payer; `sponsored: true` without one is signed by createApiClient.
  if (sponsored && typeof accept.extra?.feePayer === "string") {
    const account = await getAccount();
    // The amount is a signed sBTC spend: book it before signing.
    const spendLimiter = getSpendLimiter();
    const reservation = await spendLimiter.reserve(
      [{ unit: "sats", amount: BigInt(accept.amount) }],
      account.address
    );

    const stacksAccount: StacksAccount = {
      address: account.address,
      privateKey: account.privateKey,
      network: NETWORK,
    };
    // x402-stacks is CJS, so its AxiosInstance comes from axios' .d.cts
    // types; ours comes from .d.ts. Same runtime object, different type.
    const api = wrapAxiosWithPayment(
      axios.create({ timeout: timeoutMs }) as unknown as Parameters<typeof wrapAxiosWithPayment>[0],
      stacksAccount
    );
    try {
      response = await api.post(url, body, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      // Once the signed payment rode the retried request, the endpoint may
      // have settled it, so the booking stands.
      if (!paymentWasSent(error)) await spendLimiter.release(reservation);
      throw error;
    }
  } else {
    // createApiClient signs (self-paid with a clamped fee, or sponsored on
    // `sponsored: true`) and meters the spend.
    const api = await createApiClient(baseUrl, { toolName, asset: accept.asset });
    response = await api.post(url, body, {
      headers: { "Content-Type": "application/json" },
    });
  }

  const settlement = decodePaymentResponse(response.headers[X402_HEADERS.PAYMENT_RESPONSE]);
  return {
    paid: true,
    response,
    accept,
    sponsored,
    ...(settlement?.transaction && { txid: settlement.transaction }),
    ...(settlement?.payer && { payer: settlement.payer }),
  };
}
