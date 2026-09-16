/**
 * At Stake market tools — the El Salvador PoX-5 prediction market.
 *
 * Trading shape, in the order a caller meets it:
 *   mint  — 1 sat of sBTC buys 1 IDLE + 1 BONDED share. Always 50/50, never a
 *           directional bet on its own.
 *   bid   — escrow sBTC against a resting offer to buy one side under par.
 *   merge — hand back a matched pair for its sat, any time before resolve.
 *   redeem— after resolve, the winning side pays 1 sat per share.
 *
 * THERE IS NO BUY-YES. Minting leaves a caller flat. The directional trade
 * these tools expose is a resting bid on the side they believe, which fills when
 * a keeper matches it against an opposite-side bid. A caller who mints and stops has spent sBTC to
 * take no view at all, so `atstake_mint_complete_set` says so in its result.
 *
 * EVERYTHING HERE MOVES REAL VALUE on Stacks mainnet. `mint` and `place_bid`
 * spend sBTC with no withdrawal path other than merge, cancel or redeem, and
 * both meter against the wallet's `sats` spending rail. That metering happens
 * inside `callContract`, which reads the exact post-condition these calls sign
 * in DENY mode — it must NOT be repeated here, or every mint would bill twice.
 *
 * `resolve-bonded` is deliberately absent. It carries a Bitcoin SPV proof —
 * raw lockup transaction, 80-byte header, merkle path, funding transaction —
 * and building one belongs in a prover, not in an MCP argument list. The
 * permissionless NO settlement, `resolve-idle`, takes no arguments and is here.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  Pc,
  PostConditionMode,
  principalCV,
  uintCV,
} from "@stacks/transactions";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { callContract } from "../transactions/builder.js";
import {
  AT_STAKE_NETWORK,
  CLOSE_HEIGHT,
  MARKET_ADDRESS,
  MARKET_CONTRACT,
  MARKET_NAME,
  MARKET_SITE_URL,
  MIN_FILL_BPS,
  SBTC_ASSET_NAME,
  SBTC_CONTRACT,
  SIDES,
  STATUS_OPEN,
  resolveSide,
} from "../config/at-stake.js";
import {
  explainAbort,
  getAtStakeAccount,
  getBid,
  getBurnHeight,
  getMarket,
  getPosition,
  isTradeable,
  readMarket,
} from "../services/at-stake.service.js";

/** sBTC post-conditions all name the same asset; spell it once. */
const SBTC_FT = SBTC_CONTRACT as `${string}.${string}`;

const SIDE_ARG = z
  .enum(["yes", "no", "bonded", "idle"])
  .describe(
    'Which side: "yes"/"bonded" (pays if the coins entered a PoX-5 bond) or ' +
      '"no"/"idle" (pays if they did not).'
  );

function explorerUrl(txid: string): string {
  return getExplorerTxUrl(txid, AT_STAKE_NETWORK);
}

function atStakeError(error: unknown) {
  return createErrorResponse(explainAbort(error));
}

export function registerAtStakeTools(server: McpServer): void {
  // ==========================================================================
  // atstake_market_status
  // ==========================================================================

  server.registerTool(
    "atstake_market_status",
    {
      description:
        "The El Salvador PoX-5 prediction market as it stands right now: the claim, " +
        "whether it still trades, how much sBTC is escrowed, and how far the close " +
        "height is.\n\n" +
        "The market asks whether any of twenty frozen El Salvador reserve scripts spent " +
        "an output into a Stacks PoX-5 protocol bond before burn height 994,699. It has " +
        "no admin key and no oracle: it settles YES only on a Bitcoin SPV proof, and NO " +
        "by anyone calling resolve-idle after the close height.\n\n" +
        "Read-only, no wallet needed.",
      inputSchema: {},
    },
    async () => {
      try {
        const [market, burnHeight] = await Promise.all([
          getMarket(),
          getBurnHeight(),
        ]);
        const tradeable = isTradeable(market, burnHeight);
        const blocksLeft = market.closeHeight - burnHeight;

        return createJsonResponse({
          contract: MARKET_CONTRACT,
          network: AT_STAKE_NETWORK,
          site: MARKET_SITE_URL,
          claim: market.title,
          status: market.statusLabel,
          tradeable,
          burnHeight,
          closeHeight: market.closeHeight,
          blocksToClose: blocksLeft > 0 ? blocksLeft : 0,
          approxDaysToClose:
            blocksLeft > 0 ? Math.round((blocksLeft * 10) / 144) / 10 : 0,
          escrow: {
            vaultSats: market.vault,
            idleShares: market.idleCirc,
            bondedShares: market.bondedCirc,
            invariantHolds:
              market.vault === market.idleCirc &&
              market.vault === market.bondedCirc,
          },
          settlement:
            market.status === STATUS_OPEN
              ? blocksLeft > 0
                ? "Open. YES needs a Bitcoin SPV proof via resolve-bonded; NO becomes " +
                  "callable by anyone once burn height passes the close height."
                : "Past the close height and still unresolved — atstake_resolve_idle " +
                  "can be called by anyone to settle it NO."
              : `Resolved ${market.statusLabel}. Winning shares redeem at 1 sat each.`,
          note:
            "Vault, idle and bonded circulation are equal by construction: every sat " +
            "in escrow backs exactly one share of each side.",
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_position
  // ==========================================================================

  server.registerTool(
    "atstake_position",
    {
      description:
        "Share balances for an address, and what they are worth under each outcome.\n\n" +
        "Equal idle and bonded balances mean a flat book: the holder minted and has not " +
        "yet taken a side, and the pair merges back to sats at par. The directional " +
        "position is the DIFFERENCE between the two.\n\n" +
        "Read-only. Defaults to the unlocked wallet, which requires one; pass an address " +
        "to read anyone without unlocking.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Stacks address to read. Defaults to the unlocked wallet."),
      },
    },
    async ({ address }) => {
      try {
        const who = address ?? (await getAtStakeAccount()).address;
        const [position, market] = await Promise.all([
          getPosition(who),
          getMarket(),
        ]);
        const matched = Math.min(position.idle, position.bonded);

        return createJsonResponse({
          address: who,
          contract: MARKET_CONTRACT,
          network: AT_STAKE_NETWORK,
          shares: {
            bonded_yes: position.bonded,
            idle_no: position.idle,
          },
          mergeableSats: matched,
          netExposure:
            position.bonded === position.idle
              ? "flat"
              : position.bonded > position.idle
                ? `long yes by ${position.bonded - position.idle} shares`
                : `long no by ${position.idle - position.bonded} shares`,
          payout: {
            ifBonded_yes: position.bonded,
            ifIdle_no: position.idle,
          },
          marketStatus: market.statusLabel,
          redeemable:
            market.status === STATUS_OPEN
              ? 0
              : market.status === SIDES.yes.winStatus
                ? position.bonded
                : position.idle,
          legionWeight: {
            yes: position.bonded,
            no: position.idle,
            note:
              "Legion voting weight IS this balance, read live. Selling a side drops " +
              "the vote that side carries.",
          },
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_subject
  // ==========================================================================

  server.registerTool(
    "atstake_subject",
    {
      description:
        "What the market is actually about: the twenty El Salvador reserve addresses, " +
        "their output scripts, and the PoX-5 reward cycle indices that count.\n\n" +
        "These are the addresses a YES proof must show spending into a lockup. Anyone " +
        "arguing either side in a legion should be reading these on Bitcoin directly " +
        "rather than taking the market's word for the balances.\n\n" +
        "Read-only, no wallet needed.",
      inputSchema: {},
    },
    async () => {
      try {
        const [addresses, scripts, indices] = await Promise.all([
          readMarket("get-reserve-addresses"),
          readMarket("get-subject-scripts"),
          readMarket("get-bond-indices"),
        ]);
        const list = (cv: unknown): unknown[] =>
          Array.isArray((cv as { value?: unknown[] })?.value)
            ? ((cv as { value: unknown[] }).value as unknown[])
            : [];
        const plain = (cv: unknown): string[] =>
          list(cv).map((item) => String((item as { value: unknown }).value));

        return createJsonResponse({
          contract: MARKET_CONTRACT,
          reserveAddresses: plain(addresses),
          subjectScripts: plain(scripts),
          bondIndices: plain(indices).map(Number),
          closeHeight: CLOSE_HEIGHT,
          howYesIsProven:
            "resolve-bonded must show a Bitcoin transaction that spends an output " +
            "paying one of these scripts into a PoX-5 lockup, at one of these reward " +
            "cycle indices, mined before the close height. The proof is a raw " +
            "transaction, its block header, and a merkle path.",
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_mint_complete_set
  // ==========================================================================

  server.registerTool(
    "atstake_mint_complete_set",
    {
      description:
        "Spend sBTC to mint a matched pair: each sat buys 1 BONDED (yes) share AND " +
        "1 IDLE (no) share.\n\n" +
        "THIS DOES NOT TAKE A SIDE. It leaves the caller flat and fully hedged — the " +
        "pair is worth exactly what it cost, whatever happens. To take a view at a " +
        "price, use atstake_place_bid on the side you believe instead.\n\n" +
        "It is also how you buy legion voting weight, because weight is the share " +
        "balance. Minting 1,000 sats clears the minimum on BOTH legions at once.\n\n" +
        "Reversible before the market resolves: atstake_merge_complete_set hands any " +
        "matched pair back for its sat. Spends real sBTC and meters against the " +
        "wallet's sats rail. Requires an unlocked wallet.",
      inputSchema: {
        sats: z
          .number()
          .int()
          .positive()
          .describe(
            "sBTC sats to escrow. Mints this many shares of EACH side. The legion " +
              "minimum is 1,000."
          ),
      },
    },
    async ({ sats }) => {
      try {
        const account = await getAtStakeAccount();
        const [market, burnHeight] = await Promise.all([
          getMarket(),
          getBurnHeight(),
        ]);

        if (!isTradeable(market, burnHeight)) {
          return createErrorResponse(
            new Error(
              market.status !== STATUS_OPEN
                ? `The market has resolved ${market.statusLabel} and no longer mints ` +
                  `(u102). Winning shares redeem with atstake_redeem.`
                : `The close height ${market.closeHeight} has passed at burn height ` +
                  `${burnHeight}, so the market no longer trades (u103). It can be ` +
                  `settled NO with atstake_resolve_idle.`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: MARKET_ADDRESS,
          contractName: MARKET_NAME,
          functionName: "mint-complete-set",
          functionArgs: [uintCV(sats)],
          postConditionMode: PostConditionMode.Deny,
          // Exactly `sats` leaves the caller, and nothing comes back: shares are
          // map entries, not an asset a post-condition can name.
          postConditions: [
            Pc.principal(account.address)
              .willSendEq(sats)
              .ft(SBTC_FT, SBTC_ASSET_NAME),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          spentSats: sats,
          minted: { bonded_yes: sats, idle_no: sats },
          netExposure: "flat — this pair is hedged",
          legionWeightGained: {
            yes: sats,
            no: sats,
            clearsMinimum: sats >= 1000,
          },
          nextStep:
            "To take a view, atstake_place_bid. To undo, " +
            "atstake_merge_complete_set. To govern, atstake_legion_propose.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_merge_complete_set
  // ==========================================================================

  server.registerTool(
    "atstake_merge_complete_set",
    {
      description:
        "Hand back a matched pair of shares and take the sBTC out: burns `sats` BONDED " +
        "and `sats` IDLE, returns `sats` sBTC.\n\n" +
        "This is the exit at par, and the reason the two sides' prices sum to one. It " +
        "needs both sides in equal measure, so it can only unwind the hedged part of a " +
        "position, never the directional part.\n\n" +
        "Only works while the market is open — after resolve, use atstake_redeem. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        sats: z
          .number()
          .int()
          .positive()
          .describe("Matched pairs to merge back into sBTC."),
      },
    },
    async ({ sats }) => {
      try {
        const account = await getAtStakeAccount();
        const [position, market] = await Promise.all([
          getPosition(account.address),
          getMarket(),
        ]);

        if (market.status !== STATUS_OPEN) {
          return createErrorResponse(
            new Error(
              `The market has resolved ${market.statusLabel}, so pairs no longer merge ` +
                `(u102). Use atstake_redeem to cash the winning side.`
            )
          );
        }
        const matched = Math.min(position.idle, position.bonded);
        if (matched < sats) {
          return createErrorResponse(
            new Error(
              `You hold ${position.bonded} bonded and ${position.idle} idle, so only ` +
                `${matched} pairs can merge — ${sats} were asked for (u107).`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: MARKET_ADDRESS,
          contractName: MARKET_NAME,
          functionName: "merge-complete-set",
          functionArgs: [uintCV(sats)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [
            Pc.principal(MARKET_CONTRACT)
              .willSendEq(sats)
              .ft(SBTC_FT, SBTC_ASSET_NAME),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          mergedPairs: sats,
          receivedSats: sats,
          remaining: {
            bonded_yes: position.bonded - sats,
            idle_no: position.idle - sats,
          },
          note:
            "Legion weight falls with the balance. Merging below 1,000 on a side gives " +
            "up the right to propose and vote there.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_place_bid
  // ==========================================================================

  server.registerTool(
    "atstake_place_bid",
    {
      description:
        "Escrow sBTC in a resting bid to buy one side below par.\n\n" +
        "A bid is the directional trade this market has: offer `total_sats` for " +
        "`amount` shares of one side. Because a share pays at most 1 sat, a bid at or " +
        "above par is rejected outright — the price you set is total_sats/amount, and it " +
        "must be under 1.\n\n" +
        "The bid fills when a counterparty matches it, and the two sides of a match " +
        "must together cover one sat per share. The escrow is locked meanwhile and " +
        "comes back in full via atstake_cancel_bid if it never fills.\n\n" +
        "One resting bid per side at a time. Spends real sBTC and meters against the " +
        "wallet's sats rail. Requires an unlocked wallet.",
      inputSchema: {
        side: SIDE_ARG,
        amount: z
          .number()
          .int()
          .positive()
          .describe("Shares wanted."),
        total_sats: z
          .number()
          .int()
          .positive()
          .describe(
            "sBTC escrowed for the whole bid. Must be less than `amount` — the implied " +
              "price per share is total_sats/amount."
          ),
      },
    },
    async ({ side, amount, total_sats }) => {
      try {
        const chosen = resolveSide(side);
        const account = await getAtStakeAccount();

        if (total_sats > amount) {
          return createErrorResponse(
            new Error(
              `A share pays at most 1 sat, so bidding ${total_sats} sats for ${amount} ` +
                `shares is above par and always a mistake (u133).`
            )
          );
        }

        const [market, burnHeight, existing] = await Promise.all([
          getMarket(),
          getBurnHeight(),
          getBid(account.address, chosen),
        ]);

        if (!isTradeable(market, burnHeight)) {
          return createErrorResponse(
            new Error(
              `The market no longer trades (status ${market.statusLabel}, burn height ` +
                `${burnHeight}, close height ${market.closeHeight}), so bids are closed.`
            )
          );
        }
        if (existing) {
          return createErrorResponse(
            new Error(
              `You already have a resting ${chosen.argues} bid: ${existing.amount} shares ` +
                `for ${existing.escrow} sats (u129). Cancel it before placing another.`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: MARKET_ADDRESS,
          contractName: MARKET_NAME,
          functionName: "place-bid",
          functionArgs: [
            uintCV(chosen.side),
            uintCV(amount),
            uintCV(total_sats),
          ],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [
            Pc.principal(account.address)
              .willSendEq(total_sats)
              .ft(SBTC_FT, SBTC_ASSET_NAME),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          side: chosen.argues,
          shareLabel: chosen.label,
          amount,
          escrowedSats: total_sats,
          pricePerShare: Number((total_sats / amount).toFixed(6)),
          minimumFill: Math.max(1, Math.floor((amount * MIN_FILL_BPS) / 10000)),
          note:
            "The escrow is locked until the bid fills or is cancelled. A partial fill " +
            "costs escrow pro rata.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_get_bid
  // ==========================================================================

  server.registerTool(
    "atstake_get_bid",
    {
      description:
        "Read a resting bid: shares wanted, sBTC escrowed, and the price that implies.\n\n" +
        "Read-only. Defaults to the unlocked wallet, which requires one; pass an address " +
        "to read anyone without unlocking.",
      inputSchema: {
        side: SIDE_ARG,
        address: z
          .string()
          .optional()
          .describe("Bidder to read. Defaults to the unlocked wallet."),
      },
    },
    async ({ side, address }) => {
      try {
        const chosen = resolveSide(side);
        const who = address ?? (await getAtStakeAccount()).address;
        const bid = await getBid(who, chosen);

        if (!bid) {
          return createJsonResponse({
            address: who,
            side: chosen.argues,
            bid: null,
            note: `No resting ${chosen.argues} bid for this address.`,
          });
        }

        return createJsonResponse({
          address: who,
          side: chosen.argues,
          shareLabel: chosen.label,
          amount: bid.amount,
          escrowedSats: bid.escrow,
          pricePerShare: Number((bid.escrow / bid.amount).toFixed(6)),
          minimumFill: Math.max(
            1,
            Math.floor((bid.amount * MIN_FILL_BPS) / 10000)
          ),
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_cancel_bid
  // ==========================================================================

  server.registerTool(
    "atstake_cancel_bid",
    {
      description:
        "Withdraw a resting bid and get the unfilled escrow back.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: { side: SIDE_ARG },
    },
    async ({ side }) => {
      try {
        const chosen = resolveSide(side);
        const account = await getAtStakeAccount();
        const bid = await getBid(account.address, chosen);

        if (!bid) {
          return createErrorResponse(
            new Error(
              `You have no resting ${chosen.argues} bid to cancel (u130).`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: MARKET_ADDRESS,
          contractName: MARKET_NAME,
          functionName: "cancel-bid",
          functionArgs: [uintCV(chosen.side)],
          postConditionMode: PostConditionMode.Deny,
          // A bid that filled between this read and the block that mines the
          // cancel refunds less than the escrow read here, and one that filled
          // completely refunds nothing. A cap covers every case.
          postConditions: [
            Pc.principal(MARKET_CONTRACT)
              .willSendLte(bid.escrow)
              .ft(SBTC_FT, SBTC_ASSET_NAME),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          side: chosen.argues,
          refundUpToSats: bid.escrow,
          note:
            "The refund is whatever escrow is still unfilled at the block that mines " +
            "this, which may be less than the amount read a moment ago.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_transfer_shares
  // ==========================================================================

  server.registerTool(
    "atstake_transfer_shares",
    {
      description:
        "Send shares of one side to another principal.\n\n" +
        "Transfers are free: the recipient pays nothing, so sending shares away gives " +
        "their value away. Do not use this to take a side. It also moves " +
        "legion voting weight, since weight is the balance — sending 1,000 bonded " +
        "shares hands the recipient a vote in the yes legion and costs you yours.\n\n" +
        "Shares are map entries, not a SIP-010 token, so no fungible-token " +
        "post-condition can guard this and none is signed. Only works while the market " +
        "trades. Requires an unlocked wallet.",
      inputSchema: {
        side: SIDE_ARG,
        amount: z.number().int().positive().describe("Shares to send."),
        to: z.string().describe("Recipient Stacks principal."),
      },
    },
    async ({ side, amount, to }) => {
      try {
        const chosen = resolveSide(side);
        const account = await getAtStakeAccount();

        if (to === account.address) {
          return createErrorResponse(
            new Error("You cannot transfer shares to yourself (u110).")
          );
        }

        const [position, market, burnHeight] = await Promise.all([
          getPosition(account.address),
          getMarket(),
          getBurnHeight(),
        ]);

        if (!isTradeable(market, burnHeight)) {
          return createErrorResponse(
            new Error(
              `The market no longer trades (status ${market.statusLabel}, burn height ` +
                `${burnHeight}, close height ${market.closeHeight}), so shares are frozen.`
            )
          );
        }
        const held = position[chosen.positionKey];
        if (held < amount) {
          return createErrorResponse(
            new Error(
              `You hold ${held} ${chosen.label} shares, fewer than the ${amount} asked ` +
                `for (u107).`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: MARKET_ADDRESS,
          contractName: MARKET_NAME,
          functionName: "transfer-shares",
          functionArgs: [uintCV(chosen.side), uintCV(amount), principalCV(to)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          side: chosen.argues,
          shareLabel: chosen.label,
          amount,
          to,
          remainingOnThatSide: held - amount,
          legionWeightAfter: held - amount,
          note:
            held - amount < 1000
              ? "This drops you below the 1,000-share legion minimum on that side: no " +
                "proposing and no voting there until you hold more."
              : "You keep the legion minimum on that side.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_redeem
  // ==========================================================================

  server.registerTool(
    "atstake_redeem",
    {
      description:
        "Cash a resolved position: the winning side pays 1 sat per share, the losing " +
        "side pays nothing, and BOTH are burned.\n\n" +
        "Only callable after the market resolves. Redeeming burns the whole position in " +
        "one call, so there is nothing left to redeem a second time.\n\n" +
        "Requires an unlocked wallet.",
      inputSchema: {},
    },
    async () => {
      try {
        const account = await getAtStakeAccount();
        const [position, market] = await Promise.all([
          getPosition(account.address),
          getMarket(),
        ]);

        if (market.status === STATUS_OPEN) {
          return createErrorResponse(
            new Error(
              `The market has not resolved yet, so there is nothing to redeem (u108). ` +
                `While it is open, a matched pair exits at par with ` +
                `atstake_merge_complete_set.`
            )
          );
        }

        const won = market.status === SIDES.yes.winStatus ? "yes" : "no";
        const payout =
          won === "yes" ? position.bonded : position.idle;

        if (payout === 0) {
          return createErrorResponse(
            new Error(
              `The market resolved ${won.toUpperCase()} and you hold no shares on that ` +
                `side, so redeem would pay nothing (u107). Your losing shares are worth ` +
                `zero and need no action.`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: MARKET_ADDRESS,
          contractName: MARKET_NAME,
          functionName: "redeem",
          functionArgs: [],
          postConditionMode: PostConditionMode.Deny,
          // Status is terminal and trading is frozen once resolved, so the
          // payout read here is the payout the chain will compute.
          postConditions: [
            Pc.principal(MARKET_CONTRACT)
              .willSendEq(payout)
              .ft(SBTC_FT, SBTC_ASSET_NAME),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          outcome: won,
          payoutSats: payout,
          burned: { bonded_yes: position.bonded, idle_no: position.idle },
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );

  // ==========================================================================
  // atstake_resolve_idle
  // ==========================================================================

  server.registerTool(
    "atstake_resolve_idle",
    {
      description:
        "Settle the market NO, permissionlessly, once the close height has passed.\n\n" +
        "This is half of the market's settlement: the coins did not enter a bond before " +
        "the deadline, so the idle side wins. Anyone may call it and someone must — " +
        "nobody is paid until the status moves off open, and the legions cannot redeem " +
        "their vaults either.\n\n" +
        "It pays the caller nothing and costs them gas. Moves no assets. Requires an " +
        "unlocked wallet.",
      inputSchema: {},
    },
    async () => {
      try {
        const account = await getAtStakeAccount();
        const [market, burnHeight] = await Promise.all([
          getMarket(),
          getBurnHeight(),
        ]);

        if (market.status !== STATUS_OPEN) {
          return createErrorResponse(
            new Error(
              `The market has already resolved ${market.statusLabel} (u102).`
            )
          );
        }
        if (burnHeight <= market.closeHeight) {
          return createErrorResponse(
            new Error(
              `The trading window is still open: burn height ${burnHeight} has not ` +
                `passed the close height ${market.closeHeight}, ` +
                `${market.closeHeight - burnHeight + 1} blocks to go (u104).`
            )
          );
        }

        const result = await callContract(account, {
          contractAddress: MARKET_ADDRESS,
          contractName: MARKET_NAME,
          functionName: "resolve-idle",
          functionArgs: [],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: explorerUrl(result.txid),
          settledAs: "idle (no)",
          calledBy: account.address,
          burnHeight,
          closeHeight: market.closeHeight,
          nextStep:
            "Idle holders can now call atstake_redeem for 1 sat per share, and the no " +
            "legion can call atstake_legion_redeem_vault.",
          network: AT_STAKE_NETWORK,
        });
      } catch (error) {
        return atStakeError(error);
      }
    }
  );
}
