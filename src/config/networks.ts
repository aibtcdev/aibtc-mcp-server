import { StacksNetworkName } from "@stacks/network";

export type Network = "mainnet" | "testnet";

export const NETWORK: Network =
  process.env.NETWORK === "testnet" ? "testnet" : "mainnet";

// Base URL for bare-path x402 calls. Fixed per network, not read from the
// environment: the server loads the .env of whatever directory the client
// starts it in, and a project's generic API_URL must not redirect payments.
export const API_URL =
  NETWORK === "mainnet" ? "https://x402.aibtc.com" : "https://x402.aibtc.dev";

export function getStacksNetwork(network: Network): StacksNetworkName {
  return network === "mainnet" ? "mainnet" : "testnet";
}

export function getApiBaseUrl(network: Network): string {
  return network === "mainnet"
    ? "https://api.mainnet.hiro.so"
    : "https://api.testnet.hiro.so";
}

export const EXPLORER_URL = "https://explorer.hiro.so";

export function getExplorerTxUrl(txid: string, network: Network): string {
  return `${EXPLORER_URL}/txid/${txid}?chain=${network}`;
}

export function getExplorerAddressUrl(address: string, network: Network): string {
  return `${EXPLORER_URL}/address/${address}?chain=${network}`;
}

export function getExplorerContractUrl(contractId: string, network: Network): string {
  return `${EXPLORER_URL}/txid/${contractId}?chain=${network}`;
}
