import "dotenv/config";
import axios, { type AxiosInstance } from "axios";
import { wrapAxiosWithPayment } from "x402-stacks";
import { mnemonicToAccount, type Network } from "./wallet.js";

/**
 * @deprecated This module is superseded by src/services/x402.service.ts.
 * - createApiClient → src/services/x402.service.ts createX402Client()
 * - getWalletAddress, getAccount → src/services/x402.service.ts
 * - NETWORK, API_URL → src/config/networks.ts
 * This file will be removed in a future version.
 */

/** @deprecated Use NETWORK from src/config/networks.ts */
export const NETWORK: Network =
  process.env.NETWORK === "mainnet" ? "mainnet" : "testnet";
/** @deprecated Use API_URL from src/config/networks.ts */
export const API_URL = process.env.API_URL || "https://x402.biwas.xyz";

// Cache clients by base URL
const clientCache: Map<string, AxiosInstance> = new Map();

/** @deprecated Use createX402Client from src/services/x402.service.ts */
export async function createApiClient(baseUrl?: string): Promise<AxiosInstance> {
  const url = baseUrl || API_URL;

  // Check cache
  const cached = clientCache.get(url);
  if (cached) {
    return cached;
  }

  const mnemonic = process.env.CLIENT_MNEMONIC || "";
  if (!mnemonic) {
    throw new Error("CLIENT_MNEMONIC is required in environment variables");
  }

  const account = await mnemonicToAccount(mnemonic, NETWORK);
  const axiosInstance = axios.create({
    baseURL: url,
    timeout: 60000,
    transformResponse: [
      (data) => {
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
      },
    ],
  });

  // Ensure 402 payloads are parsed before x402-stacks validates them
  axiosInstance.interceptors.response.use(
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

  const client = wrapAxiosWithPayment(axiosInstance, account);
  clientCache.set(url, client);
  return client;
}

/** @deprecated Use getWalletAddress from src/services/x402.service.ts */
export function getWalletAddress(): Promise<string> {
  const mnemonic = process.env.CLIENT_MNEMONIC || "";
  if (!mnemonic) {
    throw new Error("CLIENT_MNEMONIC is required in environment variables");
  }
  return mnemonicToAccount(mnemonic, NETWORK).then((account) => account.address);
}

/** @deprecated Use getAccount from src/services/x402.service.ts */
export async function getAccount() {
  const mnemonic = process.env.CLIENT_MNEMONIC || "";
  if (!mnemonic) {
    throw new Error("CLIENT_MNEMONIC is required in environment variables");
  }
  return mnemonicToAccount(mnemonic, NETWORK);
}
