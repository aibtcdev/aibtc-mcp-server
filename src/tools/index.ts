import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ── Bitcoin Core ──────────────────────────────────────────────────────────────
import { registerBitcoinTools }         from "./bitcoin.tools.js";
import { registerMempoolTools }         from "./mempool.tools.js";
import { registerBtcChainTools }        from "./btc-chain.tools.js";
import { registerPsbtTools }            from "./psbt.tools.js";
import { registerTaprootMultisigTools } from "./taproot-multisig.tools.js";
import { registerOrdinalsTools }        from "./ordinals.tools.js";
import { registerOrdinalsP2PTools }     from "./ordinals-p2p.tools.js";
import { registerOrdinalsMarketplaceTools } from "./ordinals-marketplace.tools.js";
import { registerRunesTools }           from "./runes.tools.js";
import { registerChildInscriptionTools } from "./child-inscription.tools.js";
import { registerSigningTools }         from "./signing.tools.js";

// ── Wallet ────────────────────────────────────────────────────────────────────
import { registerWalletTools }          from "./wallet.tools.js";
import { registerWalletManagementTools } from "./wallet-management.tools.js";
import { registerTransferTools }        from "./transfer.tools.js";
import { registerSettingsTools }        from "./settings.tools.js";

// ── Stacks (Bitcoin L2) ───────────────────────────────────────────────────────
import { registerContractTools }        from "./contract.tools.js";
import { registerSbtcTools }            from "./sbtc.tools.js";
import { registerQueryTools }           from "./query.tools.js";
import { registerBnsTools }             from "./bns.tools.js";
import { registerNostrTools }           from "./nostr.tools.js";
import { registerNonceTools }           from "./nonce.tools.js";

// ── Infrastructure ────────────────────────────────────────────────────────────
import { registerStyxTools }            from "./styx.tools.js";
import { getSkillForTool }              from "./skill-mappings.js";
import { withSessionGuard }             from "./session-guard.js";

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
 * Register all tools — Bitcoin protocol only.
 *
 * Foundation: SHA256 + Bitcoin Core
 * Everything passes through the hash chain (session-guard).
 */
export function registerAllTools(server: McpServer): void {
  const restoreSessionGuard = withSessionGuard(server);
  const restoreRegisterTool = withSkillMeta(server);

  void restoreSessionGuard;

  // ── Bitcoin Core (L1) ──────────────────────────────────────────────────────
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

  // ── Wallet & Transfers ─────────────────────────────────────────────────────
  registerWalletTools(server);
  registerWalletManagementTools(server);
  registerTransferTools(server);
  registerSettingsTools(server);

  // ── Stacks — Bitcoin L2 ────────────────────────────────────────────────────
  registerContractTools(server);
  registerSbtcTools(server);
  registerQueryTools(server);
  registerBnsTools(server);
  registerNostrTools(server);
  registerNonceTools(server);

  // ── BTC→sBTC bridge ───────────────────────────────────────────────────────
  registerStyxTools(server);

  restoreRegisterTool();
}
