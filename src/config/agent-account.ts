// AIBTC agent account (aibtc-acct) configuration.
//
// The live agent accounts are the "cohort-0" aibtc-acct contracts: a two-role
// smart wallet (ACCOUNT_OWNER with full control + withdrawal destination, and
// ACCOUNT_AGENT with bit-gated permissions). Each account is a full contract;
// the only per-account difference is the ACCOUNT_OWNER and ACCOUNT_AGENT
// constants. We deploy a new account by cloning a live account's source from
// chain and swapping those two constants — no external generator API.
//
// In production the AIBTC backend wallet
// (SP2Z94F6QX847PMXTPJJ2ZCCN79JZDW3PJ4E6ZABY) is the deployer; here the MCP's
// active wallet is the deployer instead.

// A deployed aibtc-acct to clone source from, per network. The reference's
// trait references must match the deploy network, so mainnet clones a mainnet
// account and testnet a testnet account. Override with
// AGENT_ACCOUNT_REFERENCE_MAINNET / AGENT_ACCOUNT_REFERENCE_TESTNET, or pass
// referenceContract to agent_account_deploy.
export function referenceAgentAccount(network: "mainnet" | "testnet"): string | undefined {
  if (network === "mainnet") {
    return (
      process.env.AGENT_ACCOUNT_REFERENCE_MAINNET ||
      "SP2Z94F6QX847PMXTPJJ2ZCCN79JZDW3PJ4E6ZABY.aibtc-acct-SP3TB-5ZP2H-SP1W9-G92M5"
    );
  }
  return process.env.AGENT_ACCOUNT_REFERENCE_TESTNET || undefined;
}

// Contract name convention: aibtc-acct-<ownerFirst5>-<ownerLast5>-<agentFirst5>-<agentLast5>.
export function agentAccountContractName(owner: string, agent: string): string {
  return `aibtc-acct-${owner.slice(0, 5)}-${owner.slice(-5)}-${agent.slice(0, 5)}-${agent.slice(-5)}`;
}

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
