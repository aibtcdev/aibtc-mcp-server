import { getHiroApi } from "../services/hiro-api.js";
import { ZEST_ASSETS } from "../config/contracts.js";
import type { Network } from "../config/networks.js";

/**
 * Get sBTC balance for a given Stacks address.
 *
 * Looks up the sBTC token in the account's fungible token balances.
 *
 * @param address - Stacks address to check
 * @param network - Network to query (mainnet or testnet)
 * @returns Balance in satoshis (1 sBTC = 100,000,000 sats)
 */
export async function getSbtcBalance(address: string, network: Network): Promise<bigint> {
  const hiro = getHiroApi(network);
  const balances = await hiro.getAccountBalances(address);

  const sbtcToken = ZEST_ASSETS.sBTC.token;
  const sbtcKey = Object.keys(balances.fungible_tokens || {}).find((key) =>
    key.startsWith(sbtcToken)
  );

  if (sbtcKey && balances.fungible_tokens[sbtcKey]) {
    return BigInt(balances.fungible_tokens[sbtcKey].balance);
  }

  return 0n;
}
