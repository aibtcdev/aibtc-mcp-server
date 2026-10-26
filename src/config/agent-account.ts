// AIBTC agent account (aibtc-acct) configuration.
//
// The live agent accounts are the "cohort-0" aibtc-acct contracts: a two-role
// smart wallet (ACCOUNT_OWNER with full control + withdrawal destination, and
// ACCOUNT_AGENT with bit-gated permissions). Accounts are created by AIBTC: the
// deploy-time auto-register call into agent-account-registry only succeeds when
// AIBTC's deployer sends it, so this server operates existing accounts only.

// Permission flag -> owner-only setter function on the contract.
export const PERMISSION_SETTERS = {
  "manage-assets": "set-agent-can-manage-assets",
  "use-proposals": "set-agent-can-use-proposals",
  "approve-revoke-contracts": "set-agent-can-approve-revoke-contracts",
  "buy-sell-assets": "set-agent-can-buy-sell-assets",
} as const;

export type PermissionFlag = keyof typeof PERMISSION_SETTERS;

// Contract approval types (from on-chain get-approval-types: proposalVoting=1, swap=2, token=3).
export const APPROVAL_TYPES = {
  voting: 1,
  swap: 2,
  token: 3,
} as const;

export type ApprovalType = keyof typeof APPROVAL_TYPES;
