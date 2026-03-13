/**
 * Skill reference mappings for MCP tools.
 *
 * Maps each MCP tool name to its corresponding skill in the aibtcdev/skills repository.
 * Skills are loaded via the /skill command in Claude Code and provide higher-level
 * orchestration logic built on top of these MCP tools.
 *
 * Skill source: https://github.com/aibtcdev/skills
 */

export const TOOL_SKILL_MAP: Record<string, string> = {
  // wallet skill — encrypted BIP39 wallet management
  get_wallet_info: "wallet",
  wallet_create: "wallet",
  wallet_import: "wallet",
  wallet_unlock: "wallet",
  wallet_lock: "wallet",
  wallet_list: "wallet",
  wallet_switch: "wallet",
  wallet_delete: "wallet",
  wallet_export: "wallet",
  wallet_rotate_password: "wallet",
  wallet_set_timeout: "wallet",
  wallet_status: "wallet",

  // stx skill — STX transfers and Stacks contract operations
  get_stx_balance: "stx",
  transfer_stx: "stx",
  broadcast_transaction: "stx",
  call_contract: "stx",
  deploy_contract: "stx",
  get_transaction_status: "stx",

  // btc skill — Bitcoin L1 operations
  get_btc_balance: "btc",
  get_btc_fees: "btc",
  get_btc_utxos: "btc",
  transfer_btc: "btc",
  get_cardinal_utxos: "btc",
  get_ordinal_utxos: "btc",
  get_inscriptions_by_address: "btc",

  // sbtc skill — sBTC token operations
  sbtc_get_balance: "sbtc",
  sbtc_transfer: "sbtc",
  sbtc_get_deposit_info: "sbtc",
  sbtc_get_peg_info: "sbtc",
  sbtc_deposit: "sbtc",
  sbtc_deposit_status: "sbtc",
  sbtc_initiate_withdrawal: "sbtc",
  sbtc_withdraw: "sbtc",
  sbtc_withdrawal_status: "sbtc",
  sbtc_withdraw_status: "sbtc",

  // tokens skill — SIP-010 fungible token operations
  get_token_balance: "tokens",
  get_token_info: "tokens",
  list_user_tokens: "tokens",
  get_token_holders: "tokens",
  transfer_token: "tokens",

  // nft skill — SIP-009 NFT operations
  get_nft_holdings: "nft",
  get_nft_metadata: "nft",
  transfer_nft: "nft",
  get_nft_owner: "nft",
  get_collection_info: "nft",
  get_nft_history: "nft",

  // stacking skill — STX stacking and PoX operations
  get_pox_info: "stacking",
  get_stacking_status: "stacking",
  stack_stx: "stacking",
  extend_stacking: "stacking",

  // bns skill — Bitcoin Name System operations
  lookup_bns_name: "bns",
  reverse_bns_lookup: "bns",
  get_bns_info: "bns",
  check_bns_availability: "bns",
  get_bns_price: "bns",
  list_user_domains: "bns",
  claim_bns_name_fast: "bns",
  preorder_bns_name: "bns",
  register_bns_name: "bns",

  // query skill — Stacks network and blockchain queries
  get_stx_fees: "query",
  get_account_info: "query",
  get_account_transactions: "query",
  get_block_info: "query",
  get_mempool_info: "query",
  get_contract_info: "query",
  get_contract_events: "query",
  get_network_status: "query",
  call_read_only_function: "query",

  // x402 skill — x402 paid endpoints, inbox, scaffolding, OpenRouter
  list_x402_endpoints: "x402",
  execute_x402_endpoint: "x402",
  probe_x402_endpoint: "x402",
  scaffold_x402_endpoint: "x402",
  scaffold_x402_ai_endpoint: "x402",
  openrouter_integration_guide: "x402",
  openrouter_models: "x402",
  send_inbox_message: "x402",

  // defi skill — ALEX DEX and Zest Protocol
  alex_list_pools: "defi",
  alex_get_swap_quote: "defi",
  alex_swap: "defi",
  alex_get_pool_info: "defi",
  zest_list_assets: "defi",
  zest_get_position: "defi",
  zest_supply: "defi",
  zest_withdraw: "defi",
  zest_borrow: "defi",
  zest_repay: "defi",

  // styx skill — BTC→sBTC conversion via Styx protocol
  styx_pool_status: "styx",
  styx_pools: "styx",
  styx_fees: "styx",
  styx_price: "styx",
  styx_deposit: "styx",
  styx_status: "styx",
  styx_history: "styx",

  // yield-hunter skill — autonomous sBTC yield farming daemon
  yield_hunter_start: "yield-hunter",
  yield_hunter_stop: "yield-hunter",
  yield_hunter_status: "yield-hunter",
  yield_hunter_configure: "yield-hunter",

  // pillar skill — Pillar smart wallet (browser-handoff + agent-signed direct modes)
  pillar_connect: "pillar",
  pillar_disconnect: "pillar",
  pillar_status: "pillar",
  pillar_send: "pillar",
  pillar_fund: "pillar",
  pillar_add_admin: "pillar",
  pillar_supply: "pillar",
  pillar_auto_compound: "pillar",
  pillar_unwind: "pillar",
  pillar_boost: "pillar",
  pillar_position: "pillar",
  pillar_create_wallet: "pillar",
  pillar_invite: "pillar",
  pillar_dca_invite: "pillar",
  pillar_dca_partners: "pillar",
  pillar_dca_leaderboard: "pillar",
  pillar_dca_status: "pillar",
  pillar_key_generate: "pillar",
  pillar_key_unlock: "pillar",
  pillar_key_lock: "pillar",
  pillar_key_info: "pillar",
  pillar_direct_boost: "pillar",
  pillar_direct_unwind: "pillar",
  pillar_direct_supply: "pillar",
  pillar_direct_send: "pillar",
  pillar_direct_auto_compound: "pillar",
  pillar_direct_position: "pillar",
  pillar_direct_withdraw_collateral: "pillar",
  pillar_direct_add_admin: "pillar",
  pillar_direct_create_wallet: "pillar",
  pillar_direct_dca_invite: "pillar",
  pillar_direct_dca_partners: "pillar",
  pillar_direct_dca_leaderboard: "pillar",
  pillar_direct_dca_status: "pillar",
  pillar_direct_quote: "pillar",
  pillar_direct_resolve_recipient: "pillar",
  pillar_direct_stack_stx: "pillar",
  pillar_direct_revoke_fast_pool: "pillar",
  pillar_direct_stacking_status: "pillar",

  // settings skill — MCP server configuration and relay health
  set_hiro_api_key: "settings",
  get_hiro_api_key: "settings",
  delete_hiro_api_key: "settings",
  set_stacks_api_url: "settings",
  get_stacks_api_url: "settings",
  delete_stacks_api_url: "settings",
  get_server_version: "settings",
  check_relay_health: "settings",
  recover_sponsor_nonce: "settings",

  // signing skill — message signing and verification
  stacks_sign_message: "signing",
  stacks_verify_message: "signing",
  btc_sign_message: "signing",
  btc_verify_message: "signing",
  schnorr_sign_digest: "signing",
  schnorr_verify_digest: "signing",
  nostr_sign_event: "signing",

  // ordinals skill — Bitcoin ordinals inscription operations
  get_taproot_address: "ordinals",
  estimate_inscription_fee: "ordinals",
  inscribe: "ordinals",
  inscribe_reveal: "ordinals",
  get_inscription: "ordinals",
  inscribe_child: "ordinals",
  inscribe_child_reveal: "ordinals",
  estimate_child_inscription_fee: "ordinals",

  // ordinals-p2p skill — peer-to-peer ordinals trading via PSBT
  psbt_decode: "ordinals-p2p",
  psbt_sign: "ordinals-p2p",
  psbt_broadcast: "ordinals-p2p",
  psbt_create_ordinal_buy: "ordinals-p2p",

  // identity skill — ERC-8004 on-chain agent identity
  register_identity: "identity",
  get_identity: "identity",

  // reputation skill — ERC-8004 on-chain agent reputation
  give_feedback: "reputation",
  get_reputation: "reputation",

  // validation skill — ERC-8004 on-chain agent validation
  request_validation: "validation",
  get_validation_status: "validation",
  get_validation_summary: "validation",

  // stackspot skill — stacking lottery pots
  stackspot_list_pots: "stackspot",
  stackspot_get_pot_state: "stackspot",
  stackspot_join_pot: "stackspot",
  stackspot_start_pot: "stackspot",
  stackspot_claim_rewards: "stackspot",
  stackspot_cancel_pot: "stackspot",

  // bitflow skill — Bitflow DEX aggregator
  bitflow_get_ticker: "bitflow",
  bitflow_get_tokens: "bitflow",
  bitflow_get_swap_targets: "bitflow",
  bitflow_get_quote: "bitflow",
  bitflow_get_routes: "bitflow",
  bitflow_swap: "bitflow",
  bitflow_get_keeper_contract: "bitflow",
  bitflow_create_order: "bitflow",
  bitflow_get_order: "bitflow",
  bitflow_cancel_order: "bitflow",
  bitflow_get_keeper_user: "bitflow",
};

/**
 * Returns the skill name for a given MCP tool name, or undefined if no mapping exists.
 */
export function getSkillForTool(toolName: string): string | undefined {
  return TOOL_SKILL_MAP[toolName];
}
