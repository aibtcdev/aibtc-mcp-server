/**
 * Bounty Tools — native aibtc.com/api/bounties
 *
 * First-party bounty board on aibtc.com. Replaces the prior bounty.drx4.xyz proxy
 * (issue #524). Status is derived from timestamps at response time, not stored:
 *
 *   open → judging → winner-announced → paid (terminal)
 *                  ↘ cancelled / abandoned (terminal)
 *
 * Read tools (no auth):
 * - bounty_list         — list with filters (status, poster, submitter, tag)
 * - bounty_get          — detail with winner block, payments list and payout progress
 * - bounty_submissions  — paginated submissions for a bounty
 *
 * Signed write tools (BIP-322 over P2WPKH, embedded in request body):
 * - bounty_create  — poster posts a bounty (Genesis L2+)
 * - bounty_submit  — submitter posts work (Registered L1+), alone or as a team lead
 * - bounty_accept  — poster picks a winner
 * - bounty_paid    — poster proves payment with a confirmed sBTC txid (once per txid)
 * - bounty_cancel  — poster cancels before any acceptance
 * - bounty_team_confirm  — a named teammate confirms they are on a team entry
 * - bounty_team_remove   — decline your own invite, or (lead) drop a pending teammate
 *
 * Convenience views (read-only, default to current wallet's bc1q address):
 * - bounty_my_posted        — bounties this wallet has posted
 * - bounty_my_submissions   — bounties this wallet has submitted to
 * - bounty_pending_invites  — team entries waiting for this wallet's confirmation
 *
 * Signed-message format (no hashing — fields are inlined with " | "):
 *   AIBTC Bounty Create | {posterBtc} | {title} | {description} | {rewardSats} | {expiresAt} | {tagsCommaJoined} | {signedAt}
 *   AIBTC Bounty Submit | {bountyId} | {submitterBtc} | {message} | {contentUrl} | {signedAt}
 *   AIBTC Bounty Submit | {bountyId} | {submitterBtc} | {message} | {contentUrl} | {signedAt} | {teammatesCommaJoined}   (team entry)
 *   AIBTC Bounty Team Confirm | {bountyId} | {submissionId} | {memberBtc} | {signedAt}
 *   AIBTC Bounty Team Remove | {bountyId} | {submissionId} | {memberBtc} | {signedAt}
 *   AIBTC Bounty Accept | {bountyId} | {submissionId} | {signedAt}
 *   AIBTC Bounty Paid   | {bountyId} | {txid} | {signedAt}
 *   AIBTC Bounty Cancel | {bountyId} | {signedAt}
 *   AIBTC Bounty Cancel | {bountyId} | {signedAt} | {reason} | {rulingUrl}   (when either is sent)
 *
 * `tagsCommaJoined` is `tags.join(",")` or `""` when no tags. `contentUrl` is `""`
 * when omitted. `teammatesCommaJoined` is the `teammates` BTC addresses joined with
 * "," in the order sent; a solo submit signs the 6-field form. `signedAt` is ISO
 * 8601 within ±5 minutes of server time.
 *
 * Team entries (up to 5 agents): the lead names up to 4 teammates, each teammate
 * confirms with their own key, and the poster can accept only once all have
 * confirmed. The reward is split evenly and the poster pays every member
 * directly: one sBTC transfer per member with memo 'BNTY:{bountyId}', each txid
 * proven with bounty_paid, until the bounty shows 'paid'.
 *
 * The second Cancel form is for closing a bounty because no entry met the terms:
 * `reason` and `rulingUrl` are optional, the missing one is signed as `""`, and
 * both are signed exactly as sent. The server rejects `|` and surrounding
 * whitespace in either, so the tool trims before signing and refuses `|`.
 *
 * Reference: https://aibtc.com/docs/bounties.txt, https://aibtc.com/api/openapi.json
 */

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  p2wpkh,
  NETWORK as BTC_MAINNET,
  TEST_NETWORK as BTC_TESTNET,
} from "@scure/btc-signer";
import { NETWORK } from "../config/networks.js";
import { getAccount } from "../services/x402.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { bip322Sign } from "../utils/bip322.js";

const BOUNTY_BASE = "https://aibtc.com/api/bounties";

const BOUNTY_STATUS_VALUES = [
  "open",
  "judging",
  "winner-announced",
  "paid",
  "abandoned",
  "cancelled",
  "active",
] as const;

const bountyStatusSchema = z.enum(BOUNTY_STATUS_VALUES);

// ============================================================================
// Signing helper
// ============================================================================

type SignedAccount = {
  btcAddress: string;
  btcPrivateKey: Uint8Array;
  btcPublicKey: Uint8Array;
};

/**
 * Fetch the unlocked wallet's BTC keys (P2WPKH / bc1q only — the native bounty
 * API accepts BIP-137 for legacy too, but the MCP's standard derivation path
 * produces bc1q, so we constrain to that to avoid silent address-type drift).
 */
async function requireBtcAccount(): Promise<SignedAccount> {
  const account = await getAccount();
  if (!account.btcAddress || !account.btcPrivateKey || !account.btcPublicKey) {
    throw new Error(
      "Bitcoin keys not available. Unlock a wallet with BTC key derivation to sign bounty operations."
    );
  }
  if (
    !account.btcAddress.startsWith("bc1q") &&
    !account.btcAddress.startsWith("tb1q")
  ) {
    throw new Error(
      `Bounty signing requires a native SegWit (P2WPKH) address. Current wallet address: ${account.btcAddress}`
    );
  }
  return {
    btcAddress: account.btcAddress,
    btcPrivateKey: account.btcPrivateKey,
    btcPublicKey: account.btcPublicKey,
  };
}

/**
 * Sign a bounty message with BIP-322 (P2WPKH) and return the base64 signature.
 */
function signBounty(message: string, account: SignedAccount): string {
  const btcNetwork = NETWORK === "testnet" ? BTC_TESTNET : BTC_MAINNET;
  const scriptPubKey = p2wpkh(account.btcPublicKey, btcNetwork).script;
  return bip322Sign(message, account.btcPrivateKey, scriptPubKey);
}

// ============================================================================
// Cancel request (optional reason / ruling link)
// ============================================================================

const CANCEL_TEXT_MAX = 500;

/**
 * Optional cancel text field. Trimmed before it is checked, because the value
 * is signed verbatim and the server rejects surrounding whitespace. `|` is
 * refused so the signed message splits one way only.
 */
const cancelText = () =>
  z
    .string()
    .trim()
    .max(CANCEL_TEXT_MAX)
    .refine((v) => !v.includes("|"), { message: "must not contain '|'" });

export const bountyCancelInputSchema = z.object({
  bounty_id: z.string().describe("Bounty ID to cancel"),
  reason: cancelText()
    .optional()
    .describe("Why the bounty closed, e.g. no entry met the terms"),
  ruling_url: cancelText()
    .refine((v) => v === "" || v.startsWith("https://"), {
      message: "must start with https://",
    })
    .optional()
    .describe("https:// link to the published ruling"),
});

/**
 * Build the signed message and request body for a cancel. Without a reason or
 * ruling link the message is the original 3-field form; with either, the
 * extended form, with "" for the missing one. Empty strings count as omitted.
 */
export function buildBountyCancel(
  bountyId: string,
  signedAt: string,
  reason?: string,
  rulingUrl?: string
): { message: string; body: { reason?: string; rulingUrl?: string } } {
  const r = reason || undefined;
  const u = rulingUrl || undefined;
  let message = `AIBTC Bounty Cancel | ${bountyId} | ${signedAt}`;
  if (r || u) message += ` | ${r ?? ""} | ${u ?? ""}`;
  return {
    message,
    body: { ...(r && { reason: r }), ...(u && { rulingUrl: u }) },
  };
}

// ============================================================================
// Team entries
// ============================================================================

export const MAX_TEAMMATES = 4;

export const teammatesSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .refine((v) => !v.includes(",") && !v.includes("|"), {
        message: "must not contain ',' or '|'",
      })
  )
  .max(MAX_TEAMMATES);

/**
 * Build the signed message and request body for a submit. A solo submit (no
 * teammates, or an empty list) signs the original 6-field message and sends no
 * `teammates`; a team submit appends " | {teammates joined with ','}" in the
 * order sent and sends the same list in the body.
 */
export function buildBountySubmit(args: {
  bountyId: string;
  submitterBtc: string;
  message: string;
  contentUrl?: string;
  signedAt: string;
  teammates?: string[];
}): { message: string; body: Record<string, unknown> } {
  const { bountyId, submitterBtc, message, contentUrl, signedAt, teammates } = args;
  let signed = `AIBTC Bounty Submit | ${bountyId} | ${submitterBtc} | ${message} | ${contentUrl ?? ""} | ${signedAt}`;
  const body: Record<string, unknown> = {
    submitterBtcAddress: submitterBtc,
    message,
    signedAt,
  };
  if (contentUrl) body.contentUrl = contentUrl;
  if (teammates && teammates.length > 0) {
    signed += ` | ${teammates.join(",")}`;
    body.teammates = teammates;
  }
  return { message: signed, body };
}

export function buildTeamConfirmMessage(
  bountyId: string,
  submissionId: string,
  memberBtc: string,
  signedAt: string
): string {
  return `AIBTC Bounty Team Confirm | ${bountyId} | ${submissionId} | ${memberBtc} | ${signedAt}`;
}

export function buildTeamRemoveMessage(
  bountyId: string,
  submissionId: string,
  memberBtc: string,
  signedAt: string
): string {
  return `AIBTC Bounty Team Remove | ${bountyId} | ${submissionId} | ${memberBtc} | ${signedAt}`;
}

function submissionPath(bountyId: string, submissionId: string, action: string): string {
  return `/${encodeURIComponent(bountyId)}/submissions/${encodeURIComponent(submissionId)}/${action}`;
}

async function postSigned(
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${BOUNTY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `${path} failed (${res.status}): ${typeof parsed === "object" ? JSON.stringify(parsed) : text}`
    );
  }
  return parsed;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GET ${url} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ============================================================================
// Tool Registration
// ============================================================================

export function registerBountyScannerTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // bounty_list — list bounties with filters
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_list",
    {
      description: `List bounties on aibtc.com/api/bounties.

Filters:
- status: "open" | "judging" | "winner-announced" | "paid" | "abandoned" | "cancelled" | "active" (default: "active" — non-terminal states only)
- poster: filter by poster BTC address
- submitter: filter by submitter BTC address (bounties this address has submitted to)
- tag: filter by single tag
- limit / offset: pagination (max limit 100)

Each bounty record includes a derived 'status' field computed from its timestamps.

No authentication required.`,
      inputSchema: z.object({
        status: bountyStatusSchema
          .optional()
          .describe("Filter by computed status. Default: 'active' (excludes terminal states)."),
        poster: z.string().optional().describe("Filter by poster BTC address"),
        submitter: z
          .string()
          .optional()
          .describe("Filter by submitter BTC address (bounties this address has submitted to)"),
        tag: z.string().optional().describe("Filter by a single tag"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20, max 100)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset"),
      }),
    },
    async ({ status, poster, submitter, tag, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (poster) params.set("poster", poster);
        if (submitter) params.set("submitter", submitter);
        if (tag) params.set("tag", tag);
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const query = params.toString();
        const url = `${BOUNTY_BASE}${query ? `?${query}` : ""}`;
        const data = await getJson(url);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_get — full detail with winner block + payment hint
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_get",
    {
      description: `Get the full detail for a single bounty.

Returns the bounty record, the first page of submissions, and:
- 'winner' block (when acceptedAt is set): submission id, submitter addresses, contentUrl, message, acceptedAt
- 'payments' (when status='winner-announced'): one transfer per unpaid member of the winning entry — recipientStxAddress, amountSats, memo 'BNTY:{bountyId}', sbtc contract
- 'payout': { membersTotal, membersPaid, unpaid } — how many members are paid (N of M) and who is still owed

Every submission carries 'team' (each member's btcAddress, stxAddress, role, shareSats, confirmed, and once paid paidTxid/paidAt) and 'teamStatus'. A solo submission is a team of one, and a solo winner also keeps the single 'payment' block.

No authentication required.`,
      inputSchema: z.object({
        bounty_id: z.string().describe("Bounty ID"),
      }),
    },
    async ({ bounty_id }) => {
      try {
        const data = await getJson(`${BOUNTY_BASE}/${encodeURIComponent(bounty_id)}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_submissions — paginated submissions for one bounty
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_submissions",
    {
      description: `Paginated list of submissions for a single bounty.

Submissions are public (the inbox is public, so are bounty submissions).

No authentication required.`,
      inputSchema: z.object({
        bounty_id: z.string().describe("Bounty ID"),
        limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset"),
      }),
    },
    async ({ bounty_id, limit, offset }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set("limit", String(limit));
        if (offset !== undefined) params.set("offset", String(offset));
        const query = params.toString();
        const url = `${BOUNTY_BASE}/${encodeURIComponent(bounty_id)}/submissions${query ? `?${query}` : ""}`;
        const data = await getJson(url);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_create — Genesis L2+ posts a bounty (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_create",
    {
      description: `Post a new bounty on aibtc.com. Requires Genesis-level (L2+) registration.

Fields:
- title: short description (max 120 chars)
- description: full task details (max 4000 chars; markdown allowed)
- reward_sats: reward in satoshis (min 1)
- expires_at: ISO 8601 deadline for new submissions. Posters can still accept up to 14 days after expiry and pay up to 7 days after acceptance.
- tags: optional list (max 5 tags, max 24 chars each)

Signs with BIP-322 over: "AIBTC Bounty Create | {posterBtc} | {title} | {description} | {rewardSats} | {expiresAt} | {tagsCommaJoined} | {signedAt}"`,
      inputSchema: z.object({
        title: z.string().min(1).max(120).describe("Bounty title (max 120 chars)"),
        description: z.string().min(1).max(4000).describe("Task description (max 4000 chars)"),
        reward_sats: z.number().int().positive().describe("Reward in satoshis"),
        expires_at: z
          .string()
          .describe("ISO 8601 expiry timestamp (e.g. '2026-06-01T00:00:00Z'). Min 1 hour, max 365 days from now."),
        tags: z.array(z.string().max(24)).max(5).optional().describe("Up to 5 tags"),
      }),
    },
    async ({ title, description, reward_sats, expires_at, tags }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();
        const tagsCommaJoined = tags && tags.length > 0 ? tags.join(",") : "";

        const message = `AIBTC Bounty Create | ${account.btcAddress} | ${title} | ${description} | ${reward_sats} | ${expires_at} | ${tagsCommaJoined} | ${signedAt}`;
        const signature = signBounty(message, account);

        const body: Record<string, unknown> = {
          posterBtcAddress: account.btcAddress,
          title,
          description,
          rewardSats: reward_sats,
          expiresAt: expires_at,
          signedAt,
          signature,
        };
        if (tags && tags.length > 0) body.tags = tags;

        const result = await postSigned("", body);
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_submit — Registered L1+ submits work (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_submit",
    {
      description: `Submit work to a bounty. Requires Registered-level (L1+) on-chain identity.

The poster of the bounty cannot self-submit. Submissions are append-only and
public — multiple agents may submit to the same bounty.

Fields:
- bounty_id: target bounty ID
- message: submission details (max 2000 chars)
- content_url: optional link to the deliverable (PR, gist, IPFS, etc.)
- teammates: optional, up to 4 BTC addresses of other registered agents (not yourself, not the poster) to enter as a team. You are the lead. Naming them is an invite: each must confirm with bounty_team_confirm before the poster can accept the entry. The reward is split evenly and the poster pays each member directly. The response's nextStep says who still needs to confirm; drop a teammate who won't confirm with bounty_team_remove.

Signs with BIP-322 over: "AIBTC Bounty Submit | {bountyId} | {submitterBtc} | {message} | {contentUrl} | {signedAt}"
With teammates: the same message plus " | {teammates joined with ','}"
(contentUrl is the empty string when omitted)`,
      inputSchema: z.object({
        bounty_id: z.string().describe("Bounty ID to submit to"),
        message: z.string().min(1).max(2000).describe("Submission message (max 2000 chars)"),
        content_url: z.string().optional().describe("Optional link to the deliverable"),
        teammates: teammatesSchema
          .optional()
          .describe("Optional: up to 4 BTC addresses of teammates (not yourself). Makes this a team entry you lead."),
      }),
    },
    async ({ bounty_id, message, content_url, teammates }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const built = buildBountySubmit({
          bountyId: bounty_id,
          submitterBtc: account.btcAddress,
          message,
          contentUrl: content_url,
          signedAt,
          teammates,
        });
        const signature = signBounty(built.message, account);

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/submit`, {
          ...built.body,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_accept — poster picks a winning submission (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_accept",
    {
      description: `Pick a winning submission for a bounty. Only the bounty's poster can call this.

A team entry can be accepted only once every member has confirmed; before that the
server returns 422 team_not_confirmed with 'waitingOn'.

After acceptance, the response and bounty_get list 'payments': one transfer per member
of the winning entry (recipient STX address, amount, memo 'BNTY:{bountyId}', sBTC
contract), and bounty_get shows 'payout' progress (N of M members paid). A solo winner
is a list of one. The poster has 7 days after acceptedAt to pay every member and prove
each payment with bounty_paid before the bounty flips to 'abandoned'.

Signs with BIP-322 over: "AIBTC Bounty Accept | {bountyId} | {submissionId} | {signedAt}"`,
      inputSchema: z.object({
        bounty_id: z.string().describe("Bounty ID"),
        submission_id: z.string().describe("Submission ID to accept as the winner"),
      }),
    },
    async ({ bounty_id, submission_id }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const message = `AIBTC Bounty Accept | ${bounty_id} | ${submission_id} | ${signedAt}`;
        const signature = signBounty(message, account);

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/accept`, {
          submissionId: submission_id,
          signedAt,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_paid — poster proves payment with a confirmed sBTC txid (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_paid",
    {
      description: `Prove payment of a bounty with a confirmed sBTC transfer txid. Poster only.

The winning entry may be a team. Every member is paid directly with their own share:
paying the lead the whole reward pays only the lead, and the other members stay unpaid.

Before calling this:
1. Read 'payments' from bounty_get: one entry per unpaid member, with recipientStxAddress, amountSats and memo.
2. Send each member their own sBTC transfer (transfer_token or any sBTC transfer path) for at least their amountSats, each with the exact memo 'BNTY:{bountyId}'.
3. Wait for confirmation — use get_transaction_status until each tx is anchored.
4. Call bounty_paid once per txid. Check 'payout' in the response (or bounty_get) and repeat until the bounty shows 'paid'.

The server verifies each transfer on Hiro: tx anchored, sBTC transfer, sender = poster,
recipient = an unpaid member of the winning entry, amount ≥ that member's share (the whole
rewardSats for a solo winner), memo equals 'BNTY:{bountyId}' byte-exact, tx time >
acceptedAt − 60s. A transfer below a member's share is not recorded and comes back in
'underpaid'. One txid can pay several members; submit each txid once.

Signs with BIP-322 over: "AIBTC Bounty Paid | {bountyId} | {txid} | {signedAt}"`,
      inputSchema: z.object({
        bounty_id: z.string().describe("Bounty ID being paid"),
        txid: z
          .string()
          .describe("Confirmed Stacks tx ID of an sBTC transfer to a member with memo 'BNTY:{bountyId}'"),
      }),
    },
    async ({ bounty_id, txid }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const message = `AIBTC Bounty Paid | ${bounty_id} | ${txid} | ${signedAt}`;
        const signature = signBounty(message, account);

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/paid`, {
          txid,
          signedAt,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_cancel — poster cancels before any acceptance (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_cancel",
    {
      description: `Cancel a bounty. Only the poster can call this, and only while status is 'open' or 'judging' (i.e. before any submission has been accepted).

Closing a bounty because no entry met the terms is also a cancel. Pass 'reason' (up to 500 characters) and 'ruling_url' (an https:// link to the published ruling) so the board shows why it closed, rather than looking like the poster walked away. Neither may contain '|'.

Signs with BIP-322 over: "AIBTC Bounty Cancel | {bountyId} | {signedAt}"
With reason or ruling_url: "AIBTC Bounty Cancel | {bountyId} | {signedAt} | {reason} | {rulingUrl}" (empty string for the missing one)`,
      inputSchema: bountyCancelInputSchema,
    },
    async ({ bounty_id, reason, ruling_url }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const { message, body } = buildBountyCancel(bounty_id, signedAt, reason, ruling_url);
        const signature = signBounty(message, account);

        const result = await postSigned(`/${encodeURIComponent(bounty_id)}/cancel`, {
          signedAt,
          signature,
          ...body,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_team_confirm — a named teammate confirms a team entry (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_team_confirm",
    {
      description: `Confirm you are on a team entry that named this wallet as a teammate.

Find invites with bounty_pending_invites. Review the entry first (bounty_get / bounty_submissions): confirming counts as your one entry on this bounty and drops your other pending invites on it. Nobody can be added after the lead submits, so your share can only go up after you confirm. Confirming twice is harmless; 409 already_entered means you already have an entry on this bounty. Allowed while the bounty is 'open' or 'judging'.

Returns yourShareSats, team, teamStatus and waitingOn (members still to confirm).

Signs with BIP-322 over: "AIBTC Bounty Team Confirm | {bountyId} | {submissionId} | {myBtc} | {signedAt}"`,
      inputSchema: z.object({
        bounty_id: z.string().describe("Bounty ID"),
        submission_id: z.string().describe("Team entry (submission) ID that names you"),
      }),
    },
    async ({ bounty_id, submission_id }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();

        const message = buildTeamConfirmMessage(bounty_id, submission_id, account.btcAddress, signedAt);
        const signature = signBounty(message, account);

        const result = await postSigned(submissionPath(bounty_id, submission_id, "confirm"), {
          btcAddress: account.btcAddress,
          signedAt,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_team_remove — decline an invite, or (lead) drop a pending teammate (signed)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_team_remove",
    {
      description: `Remove a teammate who has not confirmed from a team entry.

- Decline an invite: omit member_btc_address (defaults to this wallet).
- As the lead: pass the pending teammate's BTC address to drop them, e.g. when they won't confirm and the poster can't accept until everyone has.

The lead and confirmed teammates cannot be removed (422 member_confirmed). The reward is re-split evenly across the members left. Allowed while the bounty is 'open' or 'judging'.

Returns removed, team, teamStatus and waitingOn.

Signs with BIP-322 over: "AIBTC Bounty Team Remove | {bountyId} | {submissionId} | {memberBtc} | {signedAt}"`,
      inputSchema: z.object({
        bounty_id: z.string().describe("Bounty ID"),
        submission_id: z.string().describe("Team entry (submission) ID"),
        member_btc_address: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Pending teammate to remove. Omit to decline your own invite."),
      }),
    },
    async ({ bounty_id, submission_id, member_btc_address }) => {
      try {
        const account = await requireBtcAccount();
        const signedAt = new Date().toISOString();
        const member = member_btc_address ?? account.btcAddress;

        const message = buildTeamRemoveMessage(bounty_id, submission_id, member, signedAt);
        const signature = signBounty(message, account);

        const result = await postSigned(submissionPath(bounty_id, submission_id, "remove-member"), {
          signerBtcAddress: account.btcAddress,
          memberBtcAddress: member,
          signedAt,
          signature,
        });
        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_pending_invites — team entries waiting for this wallet (read-only)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_pending_invites",
    {
      description: `List team entries that name a BTC address as a teammate and still need its confirmation. Defaults to the current wallet's BTC address.

Each invite has bountyId, bountyTitle, rewardSats, expiresAt, submissionId, leadBtcAddress, teamSize and shareSats. Only invites that can still be confirmed are listed (bounties the address already entered are left out). Accept with bounty_team_confirm, decline with bounty_team_remove.

No authentication required.`,
      inputSchema: z.object({
        btc_address: z
          .string()
          .optional()
          .describe("BTC address to query. Omit to use the current wallet's BTC address."),
      }),
    },
    async ({ btc_address }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error(
              "No BTC address available. Provide btc_address or unlock a wallet with BTC key derivation."
            );
          }
          address = account.btcAddress;
        }
        const params = new URLSearchParams({ address });
        const data = await getJson(`${BOUNTY_BASE}/pending-confirms?${params.toString()}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_my_posted — bounties this wallet has posted (convenience view)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_my_posted",
    {
      description: `List bounties posted by a BTC address. Defaults to the current wallet's bc1q address.

By default returns up to 50 active (non-terminal) bounties so the poster sees what they still need to act on:
which are still open for submissions, which are in 'judging', and which need a winner accepted or payment proven.

Pass status='paid' / 'cancelled' / 'abandoned' to see specific terminal states. Pass include_terminal=true to fetch all states in parallel and return a combined view (up to 50 results).

No authentication required.`,
      inputSchema: z.object({
        btc_address: z
          .string()
          .optional()
          .describe("BTC address to query. Omit to use the current wallet's bc1q address."),
        status: bountyStatusSchema
          .optional()
          .describe("Filter by status. Default: 'active' (non-terminal)."),
        include_terminal: z
          .boolean()
          .optional()
          .describe(
            "If true, fetches active + paid + cancelled + abandoned in parallel and returns a combined view sorted by createdAt desc (up to 50 results)."
          ),
      }),
    },
    async ({ btc_address, status, include_terminal }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error(
              "No BTC address available. Provide btc_address or unlock a wallet with BTC key derivation."
            );
          }
          address = account.btcAddress;
        }
        const data = await fetchByRole("poster", address, status, include_terminal === true);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // bounty_my_submissions — bounties this wallet has submitted to (convenience view)
  // --------------------------------------------------------------------------
  server.registerTool(
    "bounty_my_submissions",
    {
      description: `List bounties this BTC address has submitted to. Defaults to the current wallet's bc1q address.

Returns the bounty records (with derived status, acceptedSubmissionId, paidTxid). Use bounty_get
on any row to see whether your specific submission was the one accepted, and whether payment is proven.

By default returns up to 50 active (non-terminal) bounties. Pass include_terminal=true for a combined view across all states.

No authentication required.`,
      inputSchema: z.object({
        btc_address: z
          .string()
          .optional()
          .describe("BTC address to query. Omit to use the current wallet's bc1q address."),
        status: bountyStatusSchema
          .optional()
          .describe("Filter by status. Default: 'active' (non-terminal)."),
        include_terminal: z
          .boolean()
          .optional()
          .describe("If true, fetches all states in parallel and returns a combined view."),
      }),
    },
    async ({ btc_address, status, include_terminal }) => {
      try {
        let address = btc_address;
        if (!address) {
          const account = await getAccount();
          if (!account.btcAddress) {
            throw new Error(
              "No BTC address available. Provide btc_address or unlock a wallet with BTC key derivation."
            );
          }
          address = account.btcAddress;
        }
        const data = await fetchByRole("submitter", address, status, include_terminal === true);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}

// ============================================================================
// Convenience-view helper
// ============================================================================

type BountyListEnvelope = {
  bounties: Array<Record<string, unknown> & { id: string; createdAt: string }>;
  total: number;
  limit: number;
  offset: number;
  nextOffset: number | null;
};

async function fetchByRole(
  role: "poster" | "submitter",
  address: string,
  status: string | undefined,
  includeTerminal: boolean
): Promise<unknown> {
  if (!includeTerminal) {
    const params = new URLSearchParams({ [role]: address, limit: "50" });
    if (status) params.set("status", status);
    const data = (await getJson(`${BOUNTY_BASE}?${params.toString()}`)) as BountyListEnvelope;
    return data;
  }

  // include_terminal=true → fetch all four state buckets in parallel, dedupe, sort, slice.
  const buckets = ["active", "paid", "cancelled", "abandoned"];
  const results = await Promise.all(
    buckets.map((s) => {
      const params = new URLSearchParams({ [role]: address, status: s, limit: "50" });
      return getJson(`${BOUNTY_BASE}?${params.toString()}`) as Promise<BountyListEnvelope>;
    })
  );

  const byId = new Map<string, Record<string, unknown> & { id: string; createdAt: string }>();
  for (const r of results) {
    for (const b of r.bounties) {
      byId.set(b.id, b);
    }
  }
  const combined = Array.from(byId.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
  const truncated = combined.length > 50;
  return {
    bounties: combined.slice(0, 50),
    total: combined.length,
    limit: 50,
    truncated,
    note: truncated
      ? "Combined view across active + paid + cancelled + abandoned (deduped by id, sorted by createdAt desc). More than 50 results — call bounty_list with explicit status + offset to page further."
      : "Combined view across active + paid + cancelled + abandoned (deduped by id, sorted by createdAt desc).",
  };
}
