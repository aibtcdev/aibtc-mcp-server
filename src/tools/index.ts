import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ── Layer 1 · Bitcoin (L1) ────────────────────────────────────────────────────
import { registerBitcoinTools }             from "./bitcoin.tools.js";
import { registerMempoolTools }             from "./mempool.tools.js";
import { registerBtcChainTools }            from "./btc-chain.tools.js";
import { registerPsbtTools }                from "./psbt.tools.js";
import { registerTaprootMultisigTools }     from "./taproot-multisig.tools.js";
import { registerOrdinalsTools }            from "./ordinals.tools.js";
import { registerOrdinalsP2PTools }         from "./ordinals-p2p.tools.js";
import { registerOrdinalsMarketplaceTools } from "./ordinals-marketplace.tools.js";
import { registerRunesTools }               from "./runes.tools.js";
import { registerChildInscriptionTools }    from "./child-inscription.tools.js";
import { registerSigningTools }             from "./signing.tools.js";

// ── Layer 2 · Wallet & Keys ───────────────────────────────────────────────────
import { registerWalletTools }          from "./wallet.tools.js";
import { registerWalletManagementTools } from "./wallet-management.tools.js";
import { registerTransferTools }        from "./transfer.tools.js";
import { registerSettingsTools }        from "./settings.tools.js";

// ── Layer 3 · Stacks (Bitcoin L2) ────────────────────────────────────────────
import { registerContractTools }  from "./contract.tools.js";
import { registerSbtcTools }      from "./sbtc.tools.js";
import { registerQueryTools }     from "./query.tools.js";
import { registerBnsTools }       from "./bns.tools.js";
import { registerNostrTools }     from "./nostr.tools.js";
import { registerNonceTools }     from "./nonce.tools.js";

// ── Layer 4 · Networks (Multi-chain read) ─────────────────────────────────────
import { registerNetworksTools }  from "./networks.tools.js";

// ── Layer 5 · Assets (Universal prices) ──────────────────────────────────────
import { registerAssetsTools }    from "./assets.tools.js";

// ── Layer 6 · Bridge ─────────────────────────────────────────────────────────
import { registerStyxTools }      from "./styx.tools.js";

// ── Infrastructure ────────────────────────────────────────────────────────────
import { getSkillForTool }   from "./skill-mappings.js";
import { withSessionGuard }  from "./session-guard.js";

/**
 * Injects _meta.skill from TOOL_SKILL_MAP when a mapping exists.
 */
function withSkillMeta(server: McpServer): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (server as any).registerTool;
  const hasOwn = Object.prototype.hasOwnProperty.call(server, "registerTool");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server as any).registerTool = function (name: string, config: Record<string, unknown>, cb: unknown) {
    const skill = getSkillForTool(name);
    const patched = skill
      ? { ...config, _meta: { ...(config._meta as Record<string, unknown> | undefined ?? {}), skill } }
      : config;
    return original.call(server, name, patched, cb);
  };
  return () => {
    if (hasOwn) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (server as any).registerTool = original;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (server as any).registerTool;
    }
  };
}

/**
 * 7-Layer Architecture — aibtc-protocol
 *
 * L1  Bitcoin       btc_*, mempool_*, psbt_*, ordinals_*, runes_*, signing_*
 * L2  Wallet        wallet_*, transfer_*, settings_*
 * L3  Stacks        contract_*, sbtc_*, query_*, bns_*, nostr_*, nonce_*
 * L4  Networks      network_status, network_balance, network_multi_balance
 * L5  Assets        asset_price, asset_batch, asset_convert, asset_market, asset_crypto, asset_forex, asset_stock
 * L6  Bridge        styx_*
 * L7  Protocol      SHA256 chain + session guard (implicit, wraps all layers)
 */
export function registerAllTools(server: McpServer): void {
  const restoreSessionGuard = withSessionGuard(server);
  const restoreRegisterTool = withSkillMeta(server);

  void restoreSessionGuard;

  // L1 — Bitcoin Core
  registerBitcoinTools(server);
  registerMempoolTools(server);
  registerBtcChainTools(server);
  registerPsbtTools(server);
  registerTaprootMultisigTools(server);
  registerOrdinalsTools(server);
  registerOrdinalsP2PTools(server);
  registerOrdinalsMarketplaceTools(server);
  registerRunesTools(server);
  registerChildInscriptionTools(server);
  registerSigningTools(server);

  // L2 — Wallet & Keys
  registerWalletTools(server);
  registerWalletManagementTools(server);
  registerTransferTools(server);
  registerSettingsTools(server);

  // L3 — Stacks (Bitcoin L2)
  registerContractTools(server);
  registerSbtcTools(server);
  registerQueryTools(server);
  registerBnsTools(server);
  registerNostrTools(server);
  registerNonceTools(server);

  // L4 — Networks (multi-chain read)
  registerNetworksTools(server);

  // L5 — Assets (crypto + fiat + stocks)
  registerAssetsTools(server);

  // L6 — Bridge (BTC ↔ sBTC)
  registerStyxTools(server);

  restoreRegisterTool();
}
