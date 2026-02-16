import "dotenv/config";
import axios, { type AxiosInstance } from "axios";
import { wrapAxiosWithPayment, decodePaymentRequired, X402_HEADERS, type PaymentRequiredV2 } from "x402-stacks";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import { NETWORK, API_URL, type Network } from "../config/networks.js";
import type { Account } from "../transactions/builder.js";
import { getWalletManager } from "./wallet-manager.js";

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
      const data = error?.response?.data;
      if (typeof data === "string") {
        const trimmed = data.trim();
        if (trimmed) {
          try {
            error.response.data = JSON.parse(trimmed);
          } catch {
            // Leave as-is if it's not JSON
          }
        }
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
  // Check managed wallet session first
  const walletManager = getWalletManager();
  const sessionAccount = walletManager.getActiveAccount();

  if (sessionAccount) {
    return sessionAccount.address;
  }

  // Fall back to environment mnemonic
  const mnemonic = process.env.CLIENT_MNEMONIC || "";
  if (!mnemonic) {
    throw new Error(
      "No wallet available. Either unlock a managed wallet (wallet_unlock) " +
        "or set CLIENT_MNEMONIC environment variable."
    );
  }
  const account = await mnemonicToAccount(mnemonic, NETWORK);
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
 * Clear the client cache (useful for testing)
 */
export function clearClientCache(): void {
  clientCache.clear();
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
  const assetLower = asset.toLowerCase();
  if (assetLower.includes('token-sbtc') || assetLower.includes('sbtc')) {
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
  const rawAmount = BigInt(amount);

  if (tokenType === 'sBTC') {
    // sBTC: 1 sBTC = 100,000,000 satoshis
    const sbtcAmount = Number(rawAmount) / 100_000_000;
    return `${sbtcAmount.toFixed(8)} sBTC`;
  } else {
    // STX: 1 STX = 1,000,000 microSTX
    const stxAmount = Number(rawAmount) / 1_000_000;
    return `${stxAmount.toFixed(6)} STX`;
  }
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
        paymentRequired = decodePaymentRequired(headerValue);
      }

      // If v2 header is successfully parsed, use it
      if (paymentRequired && paymentRequired.accepts && paymentRequired.accepts.length > 0) {
        const acceptedPayment = paymentRequired.accepts[0];

        // Convert CAIP-2 network identifier to simple format if needed
        let network: string = acceptedPayment.network;
        if (network === 'stacks:1') {
          network = 'mainnet';
        } else if (network === 'stacks:2147483648') {
          network = 'testnet';
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
        throw new Error(`Invalid 402 response from ${url}: missing payment fields in both header and body`);
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
