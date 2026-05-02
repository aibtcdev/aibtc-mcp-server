/**
 * OKX Wallet API MCP tools — read-only address-level queries.
 *
 * Auth: same lazy credential pattern as DEX tools. First call to any
 * okx_wallet_* tool surfaces an OkxCredentialsMissingError describing
 * which credentials_set calls to make.
 *
 * Note: BRC-20, Runes, and Inscriptions are NOT exposed here — those
 * data sources live on OKLink Explorer (separate API + key) and are
 * out of scope for the OKX WaaS integration.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../../utils/index.js";
import {
  getWalletSupportedChains,
  getWalletTokenBalances,
  getWalletUtxos,
} from "../../services/okx/index.js";

const CRED_NOTE =
  "Requires OKX API credentials (set via credentials_set with service='okx' " +
  "for keys api_key, secret, passphrase, project_id). Get keys at " +
  "https://web3.okx.com/onchainos/dev-docs/home/developer-portal.";

export function registerOkxWalletTools(server: McpServer): void {
  server.registerTool(
    "okx_wallet_supported_chains",
    {
      description:
        "Enumerate chains supported by the OKX Wallet API for the calling account, " +
        "returning the authoritative chainIndex values to use in subsequent token-balance " +
        "and UTXO queries. " + CRED_NOTE,
      inputSchema: {},
    },
    async () => {
      try {
        const data = await getWalletSupportedChains();
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_wallet_token_balances",
    {
      description:
        "Get fungible token balances for an address across one or more chains. " +
        "Returns each token's balance, contract address, symbol, and a USD price snapshot. " +
        "Use okx_wallet_supported_chains first to discover valid chainIndex values. " +
        CRED_NOTE,
      inputSchema: {
        address: z
          .string()
          .describe("Wallet address (EVM 0x… or chain-native, e.g. BTC bc1…)"),
        chains: z
          .string()
          .describe(
            "Comma-separated chainIndex list (e.g. '1' or '1,8453' for Ethereum + Base)"
          ),
      },
    },
    async ({ address, chains }) => {
      try {
        const data = await getWalletTokenBalances(address, chains);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "okx_wallet_utxos",
    {
      description:
        "Get UTXOs for an address on a Bitcoin-family chain. Each entry includes " +
        "txHash, vOut, amount, and confirmation height. " + CRED_NOTE,
      inputSchema: {
        chainIndex: z
          .string()
          .describe(
            "Bitcoin-family chainIndex (call okx_wallet_supported_chains to discover)"
          ),
        address: z.string().describe("Bitcoin address"),
      },
    },
    async ({ chainIndex, address }) => {
      try {
        const data = await getWalletUtxos(chainIndex, address);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
