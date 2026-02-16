import axios, { type AxiosInstance } from "axios";
import { wrapAxiosWithPayment, decodePaymentRequired, X402_HEADERS, type PaymentRequiredV2 } from "x402-stacks";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import { NETWORK, API_URL, type Network } from "../config/networks.js";
import type { Account } from "../transactions/builder.js";
import { getWalletManager } from "./wallet-manager.js";
import { formatStx, formatSbtc } from "../utils/formatting.js";

// Cache clients by base URL
const clientCache: Map<string, AxiosInstance> = new Map();

/**
 * Safe JSON transform - parses string responses without throwing
 */
function safeJsonTransform(data: unknown): unknown {
  if (typeof data !== "string") {
    return data;
  }
  const trimmed = data.trim();
  if (!trimmed) {
    return data;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
}

/**
 * Create a plain axios instance with JSON parsing for both success and error responses.
 * Used as the base for both payment-wrapped clients and probe requests.
 * Timeout is 120 seconds to accommodate sBTC contract-call settlements which can take 60+ seconds.
 */
function createBaseAxiosInstance(baseURL?: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 120000,
    transformResponse: [safeJsonTransform],
  });

  // Ensure error response bodies (especially 402 payloads) are also parsed as JSON
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.data) {
        error.response.data = safeJsonTransform(error.response.data);
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * Convert mnemonic to account
 */
export async function mnemonicToAccount(
  mnemonic: string,
  network: Network
): Promise<Account> {
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });

  const account = wallet.accounts[0];
  const address = getStxAddress(account, network);

  return {
    address,
    privateKey: account.stxPrivateKey,
    network,
  };
}

/**
 * Create an API client with x402 payment interceptor
 */
export async function createApiClient(baseUrl?: string): Promise<AxiosInstance> {
  const url = baseUrl || API_URL;

  // Check cache
  const cached = clientCache.get(url);
  if (cached) {
    return cached;
  }

  // Get account (from managed wallet or env mnemonic)
  const account = await getAccount();
  const axiosInstance = createBaseAxiosInstance(url);
  const client = wrapAxiosWithPayment(axiosInstance, account);
  clientCache.set(url, client);
  return client;
}

/**
 * Create a plain axios client without payment interceptor.
 * Used for known-free endpoints where 402 responses should fail, not auto-pay.
 */
export function createPlainClient(baseUrl?: string): AxiosInstance {
  return createBaseAxiosInstance(baseUrl);
}

/**
 * Get wallet address - checks managed wallet first, then env mnemonic
 */
export async function getWalletAddress(): Promise<string> {
  const account = await getAccount();
  return account.address;
}

/**
 * Get account - checks managed wallet first, then env mnemonic
 */
export async function getAccount(): Promise<Account> {
  // Check managed wallet session first
  const walletManager = getWalletManager();
  const sessionAccount = walletManager.getActiveAccount();

  if (sessionAccount) {
    return sessionAccount;
  }

  // Fall back to environment mnemonic
  const mnemonic = process.env.CLIENT_MNEMONIC || "";
  if (!mnemonic) {
    throw new Error(
      "No wallet available. Either unlock a managed wallet (wallet_unlock) " +
        "or set CLIENT_MNEMONIC environment variable."
    );
  }
  return mnemonicToAccount(mnemonic, NETWORK);
}

/**
 * Probe result types
 */
export type ProbeResultFree = {
  type: 'free';
  data: unknown;
};

export type ProbeResultPaymentRequired = {
  type: 'payment_required';
  amount: string;
  asset: string;
  recipient: string;
  network: string;
  endpoint: string;
  resource?: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  maxTimeoutSeconds?: number;
};

export type ProbeResult = ProbeResultFree | ProbeResultPaymentRequired;

/**
 * Detect token type from asset identifier
 * @param asset - Full contract identifier or token name
 * @returns 'STX' for native STX, 'sBTC' for sBTC token
 */
export function detectTokenType(asset: string): 'STX' | 'sBTC' {
  const assetLower = asset.trim().toLowerCase();
  // Treat as sBTC only if the asset is exactly "sbtc" (token name)
  // or a full contract identifier ending with "::token-sbtc"
  if (assetLower === 'sbtc' || assetLower.endsWith('::token-sbtc')) {
    return 'sBTC';
  }
  return 'STX';
}

/**
 * Format payment amount into human-readable string with token symbol
 * @param amount - Raw amount string (microSTX or satoshis)
 * @param asset - Token asset identifier
 * @returns Formatted string like "0.000001 sBTC" or "0.001 STX"
 */
export function formatPaymentAmount(amount: string, asset: string): string {
  const tokenType = detectTokenType(asset);
  if (tokenType === 'sBTC') {
    return formatSbtc(amount);
  }
  return formatStx(amount);
}

/**
 * Probe an endpoint without payment interceptor
 * Returns either free response data or payment requirements
 */
export async function probeEndpoint(options: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  params?: Record<string, string>;
  data?: Record<string, unknown>;
}): Promise<ProbeResult> {
  const { method, url, params, data } = options;
  const axiosInstance = createBaseAxiosInstance();

  try {
    const response = await axiosInstance.request({ method, url, params, data });

    // 200 response - free endpoint
    return {
      type: 'free',
      data: response.data,
    };
  } catch (error) {
    const axiosError = error as { response?: { status?: number; data?: unknown; headers?: Record<string, string> } };

    // 402 Payment Required - parse payment info
    if (axiosError.response?.status === 402) {
      // Try to parse v2 payment-required header first
      const headerValue = axiosError.response.headers?.[X402_HEADERS.PAYMENT_REQUIRED];
      let paymentRequired: PaymentRequiredV2 | null = null;

      if (headerValue) {
        try {
          paymentRequired = decodePaymentRequired(headerValue);
        } catch {
          paymentRequired = null;
        }
      }

      // If v2 header is successfully parsed, use it
      if (paymentRequired && paymentRequired.accepts && paymentRequired.accepts.length > 0) {
        const acceptedPayment = paymentRequired.accepts[0];

        // Convert CAIP-2 or simple network identifier to normalized format
        let network: string = acceptedPayment.network;
        if (network === 'stacks:1' || network === 'mainnet') {
          network = 'mainnet';
        } else if (network === 'stacks:2147483648' || network === 'testnet') {
          network = 'testnet';
        } else {
          // Fallback to configured default network if identifier is unrecognized
          network = NETWORK;
        }

        return {
          type: 'payment_required',
          amount: acceptedPayment.amount,
          asset: acceptedPayment.asset,
          recipient: acceptedPayment.payTo,
          network: network,
          endpoint: url,
          resource: paymentRequired.resource,
          maxTimeoutSeconds: acceptedPayment.maxTimeoutSeconds,
        };
      }

      // Fall back to v1 body parsing
      const paymentData = axiosError.response.data as {
        amount?: string;
        asset?: string;
        recipient?: string;
        network?: string;
      };

      if (!paymentData.amount || !paymentData.asset || !paymentData.recipient || !paymentData.network) {
        const headerDebug = headerValue !== undefined && headerValue !== null
          ? `present (length=${String(headerValue).length})`
          : 'missing';
        throw new Error(
          `Invalid 402 response from ${url}: missing payment fields in both v2 header and v1 body. ` +
          `v2 header: ${headerDebug}; v1 body keys: ${Object.keys(paymentData as object).join(', ') || 'none'}`
        );
      }

      return {
        type: 'payment_required',
        amount: paymentData.amount,
        asset: paymentData.asset,
        recipient: paymentData.recipient,
        network: paymentData.network,
        endpoint: url,
      };
    }

    // Other errors - propagate
    if (axiosError.response) {
      throw new Error(
        `HTTP ${axiosError.response.status} from ${url}: ${JSON.stringify(axiosError.response.data)}`
      );
    }

    throw error;
  }
}

export { NETWORK, API_URL };
