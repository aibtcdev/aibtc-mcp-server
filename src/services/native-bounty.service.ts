import { p2wpkh, NETWORK as BTC_MAINNET, TEST_NETWORK as BTC_TESTNET } from "@scure/btc-signer";
import { NETWORK } from "../config/networks.js";
import { bip322Sign } from "../utils/bip322.js";

export const AIBTC_BOUNTY_BASE = "https://aibtc.com";

export type NativeBountyStatus =
  | "open"
  | "judging"
  | "winner-announced"
  | "paid"
  | "abandoned"
  | "cancelled"
  | "active";

export type NativeBountyListParams = {
  status?: NativeBountyStatus;
  poster?: string;
  submitter?: string;
  tag?: string;
  limit?: number;
  offset?: number;
};

export type NativeBountyAccount = {
  btcAddress: string;
  btcPrivateKey: Uint8Array;
  btcPublicKey: Uint8Array;
  address?: string;
};

export function normalizeNativeBountyListParams(params: NativeBountyListParams): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (params.status) normalized.status = params.status;
  if (params.poster) normalized.poster = params.poster;
  if (params.submitter) normalized.submitter = params.submitter;
  if (params.tag) normalized.tag = params.tag;
  if (params.limit !== undefined) normalized.limit = String(Math.min(100, Math.max(1, params.limit)));
  if (params.offset !== undefined) normalized.offset = String(Math.max(0, params.offset));
  return normalized;
}

export function buildNativeBountyUrl(path: string, params: NativeBountyListParams = {}): URL {
  const url = new URL(path, AIBTC_BOUNTY_BASE);
  const normalized = normalizeNativeBountyListParams(params);
  for (const [key, value] of Object.entries(normalized)) {
    url.searchParams.set(key, value);
  }
  return url;
}

export type NativeBountyMessageInput =
  | {
      posterBtc: string;
      title: string;
      description: string;
      rewardSats: number;
      expiresAt: string;
      tags?: string[];
      signedAt: string;
    }
  | {
      bountyId: string;
      submitterBtc: string;
      message: string;
      contentUrl?: string;
      signedAt: string;
    }
  | {
      bountyId: string;
      submissionId: string;
      signedAt: string;
    }
  | {
      bountyId: string;
      txid: string;
      signedAt: string;
    }
  | {
      bountyId: string;
      signedAt: string;
    };

export function buildNativeBountyMessage(
  action: "create" | "submit" | "accept" | "paid" | "cancel",
  input: NativeBountyMessageInput
): string {
  switch (action) {
    case "create": {
      const data = input as Extract<NativeBountyMessageInput, { posterBtc: string }>;
      return `AIBTC Bounty Create | ${data.posterBtc} | ${data.title} | ${data.description} | ${data.rewardSats} | ${data.expiresAt} | ${(data.tags ?? []).join(",")} | ${data.signedAt}`;
    }
    case "submit": {
      const data = input as Extract<NativeBountyMessageInput, { submitterBtc: string }>;
      return `AIBTC Bounty Submit | ${data.bountyId} | ${data.submitterBtc} | ${data.message} | ${data.contentUrl ?? ""} | ${data.signedAt}`;
    }
    case "accept": {
      const data = input as Extract<NativeBountyMessageInput, { submissionId: string }>;
      return `AIBTC Bounty Accept | ${data.bountyId} | ${data.submissionId} | ${data.signedAt}`;
    }
    case "paid": {
      const data = input as Extract<NativeBountyMessageInput, { txid: string }>;
      return `AIBTC Bounty Paid | ${data.bountyId} | ${data.txid} | ${data.signedAt}`;
    }
    case "cancel": {
      const data = input as Extract<NativeBountyMessageInput, { bountyId: string }>;
      return `AIBTC Bounty Cancel | ${data.bountyId} | ${data.signedAt}`;
    }
  }
}

export function signNativeBountyMessage(message: string, account: NativeBountyAccount): string {
  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  return bip322Sign(message, account.btcPrivateKey, scriptPubKey);
}

export function buildNativeBountySignedFields(
  message: string,
  signedAt: string,
  account: NativeBountyAccount
): {
  signedAt: string;
  signature: string;
} {
  return {
    signedAt,
    signature: signNativeBountyMessage(message, account),
  };
}

export async function fetchNativeBountyUrl(url: URL, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`AIBTC bounty API ${response.status}: ${text}`);
  }
  return data;
}

export async function fetchNativeBountyJson(path: string, init?: RequestInit): Promise<unknown> {
  return fetchNativeBountyUrl(new URL(path, AIBTC_BOUNTY_BASE), init);
}
