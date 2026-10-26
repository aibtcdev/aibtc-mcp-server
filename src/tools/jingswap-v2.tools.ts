// Jingswap V2 Limit-Price Auction MCP Tools
// Markets: sbtc-stx-market (SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.sbtc-stx-0-jing-v2, 0% premium)
//          sbtc-stx-20bp-stx-premium (SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.sbtc-stx-20-jing-v2, 0.20% STX bonus)
//
// V2 differences from V1:
// - Deposits carry a limit price (non-zero, required by the contract)
// - No buffer phase: deposit (0) → settle (2)
// - Settlement is bundled: close-and-settle-with-refresh closes and settles in one tx
// - Limit prices can be updated mid-cycle via set-stx-limit / set-sbtc-limit
// - close-deposits needs >= 10 blocks elapsed; cancel-cycle needs 42 blocks after close
//
// Price units: the contract stores prices as STX-per-BTC * 1e8. The tools take and
// return sats/STX (raw = 1e16 / satsPerStx).

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { uintCV, bufferCV, contractPrincipalCV, PostConditionMode, Pc } from "@stacks/transactions";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { callContract } from "../transactions/builder.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  jingswapGet,
  JINGSWAP_CONTRACT_ADDRESS,
  SBTC_CONTRACT,
  PYTH_CONTRACTS,
} from "./jingswap.tools.js";

// ── V2 Market Configuration ──────────────────────────────────────

const PRICE_PRECISION = 100_000_000; // contract PRICE_PRECISION (1e8)
const DEPOSIT_MIN_BLOCKS = 10;
const CANCEL_THRESHOLD = 42;
const STX_DECIMALS = 6;
// The Pyth verify-and-update fee is a few uSTX; 0.001 STX bounds it (same cap as V1).
const PYTH_UPDATE_FEE_CAP_USTX = 1_000n;

interface MarketConfigV2 {
  contractName: string;
  premiumLabel: string;
}

const MARKETS_V2: Record<string, MarketConfigV2> = {
  "sbtc-stx-market": {
    contractName: "sbtc-stx-0-jing-v2",
    premiumLabel: "Market Price (0% premium)",
  },
  "sbtc-stx-20bp-stx-premium": {
    contractName: "sbtc-stx-20-jing-v2",
    premiumLabel: "0.20% STX Bonus",
  },
};

const DEFAULT_V2_MARKET = "sbtc-stx-market";

const marketArg = z
  .string()
  .optional()
  .describe(
    `V2 market: "sbtc-stx-market" (0% premium, default) or "sbtc-stx-20bp-stx-premium" (0.20% STX bonus)`
  );

function getV2Market(market?: string): MarketConfigV2 {
  const key = market || DEFAULT_V2_MARKET;
  const config = MARKETS_V2[key];
  if (!config) throw new Error(`Unknown v2 market "${key}". Available: ${Object.keys(MARKETS_V2).join(", ")}`);
  return config;
}

function apiContractParam(m: MarketConfigV2): string {
  return `?contract=${m.contractName}`;
}

function contractId(m: MarketConfigV2): `${string}.${string}` {
  return `${JINGSWAP_CONTRACT_ADDRESS}.${m.contractName}`;
}

// ── Helpers ──────────────────────────────────────────────────────

/** Convert sats/STX to the raw contract limit price (STX-per-BTC * 1e8). */
export function satsPerStxToRaw(satsPerStx: number): bigint {
  if (!(satsPerStx > 0)) throw new Error("Limit price must be positive");
  const raw = BigInt(Math.floor(1e16 / satsPerStx));
  if (raw <= 0n) throw new Error(`Limit price ${satsPerStx} sats/STX is out of range`);
  return raw;
}

/** Convert a raw contract price (STX-per-BTC * 1e8) to sats/STX. */
export function rawToSatsPerStx(raw: number): number {
  if (!(raw > 0)) throw new Error("Raw price must be positive");
  return 1e16 / raw;
}

/** A limit 20% through the oracle: below it for the STX side, above it for the sBTC side. */
export function defaultLimitSatsPerStx(oracleSatsPerStx: number, side: "stx" | "sbtc"): number {
  return side === "stx" ? oracleSatsPerStx * 0.8 : oracleSatsPerStx * 1.2;
}

async function getCycleState(m: MarketConfigV2): Promise<any> {
  return jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
}

async function assertV2DepositPhase(m: MarketConfigV2): Promise<any> {
  const data = await getCycleState(m);
  if (data.phase !== 0) {
    throw new Error(`Auction is in phase ${data.phase} (settle); deposits, limits and cancels need deposit phase 0`);
  }
  return data;
}

interface OraclePrice {
  btcUsd: number;
  stxUsd: number;
  stxPerBtc: number;
  satsPerStx: number;
  raw: number; // STX-per-BTC * 1e8, the contract's price unit
}

async function getOraclePrice(m: MarketConfigV2): Promise<OraclePrice> {
  const pyth = await jingswapGet(`/api/auction/pyth-prices${apiContractParam(m)}`);
  const btcUsd = Number(pyth?.btcUsd?.price);
  const stxUsd = Number(pyth?.stxUsd?.price);
  if (!(btcUsd > 0) || !(stxUsd > 0)) {
    throw new Error(`Oracle prices unavailable (btcUsd=${pyth?.btcUsd?.price}, stxUsd=${pyth?.stxUsd?.price})`);
  }
  const stxPerBtc = btcUsd / stxUsd;
  return {
    btcUsd,
    stxUsd,
    stxPerBtc,
    satsPerStx: 1e8 / stxPerBtc,
    raw: Math.floor(stxPerBtc * PRICE_PRECISION),
  };
}

async function resolveLimit(
  m: MarketConfigV2,
  explicit: number | undefined,
  side: "stx" | "sbtc"
): Promise<{ limitSats: number; defaulted: boolean }> {
  if (explicit !== undefined) return { limitSats: explicit, defaulted: false };
  const oracle = await getOraclePrice(m);
  return { limitSats: defaultLimitSatsPerStx(oracle.satsPerStx, side), defaulted: true };
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

// ── Tool Registration ────────────────────────────────────────────

export function registerJingswapV2Tools(server: McpServer): void {

  // ── Cycle State ──────────────────────────────────────────────

  server.registerTool(
    "jingswap_v2_get_cycle_state",
    {
      description:
        "Get the current Jingswap V2 (limit-price) auction cycle state: phase (0=deposit, 2=settle; " +
        "no buffer phase), blocks elapsed, cycle totals and minimum deposits. " +
        "The deposit phase stays open until someone closes it, which needs 10+ blocks elapsed.",
      inputSchema: z.object({ market: marketArg }),
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const data = await getCycleState(m);
        return createJsonResponse({
          ...data,
          market: market || DEFAULT_V2_MARKET,
          contract: contractId(m),
          premium: m.premiumLabel,
          _hint: {
            phases: "0=deposit (open until closed; closing needs 10+ blocks elapsed), 2=settle (no buffer in v2)",
            cancelCycle: `${CANCEL_THRESHOLD} blocks after deposits close, if the cycle is still unsettled`,
            limitPrices: "Every deposit carries a limit price; tools take it in sats/STX",
            stxUnits: "micro-STX (÷1e6 for STX)",
            sbtcUnits: "satoshis (÷1e8 for sBTC)",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── User Deposit + Limits ────────────────────────────────────

  server.registerTool(
    "jingswap_v2_get_user_deposit",
    {
      description:
        "Get a user's deposit amounts and limit prices for a V2 auction cycle. " +
        "Returns stxDeposit (micro-STX), sbtcDeposit (sats), stxLimit/sbtcLimit (raw STX-per-BTC * 1e8) " +
        "and the same limits in sats/STX.",
      inputSchema: z.object({
        cycle: z.number().int().nonnegative().describe("Cycle number"),
        address: z.string().describe("Stacks address of the depositor"),
        market: marketArg,
      }),
    },
    async ({ cycle, address, market }) => {
      try {
        const m = getV2Market(market);
        const data = await jingswapGet(`/api/auction/deposit/${cycle}/${address}${apiContractParam(m)}`);
        return createJsonResponse({
          ...data,
          stxLimitSatsPerStx: data.stxLimit > 0 ? round4(rawToSatsPerStx(data.stxLimit)) : null,
          sbtcLimitSatsPerStx: data.sbtcLimit > 0 ? round4(rawToSatsPerStx(data.sbtcLimit)) : null,
          market: market || DEFAULT_V2_MARKET,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Clearing Preview ─────────────────────────────────────────

  server.registerTool(
    "jingswap_v2_get_clearing_preview",
    {
      description:
        "Simulate settlement at the current Pyth oracle price: projected clearing amounts after limit " +
        "filtering, which depositors would fill or roll, and willSettle with a reason. " +
        "Check this before jingswap_v2_close_and_settle_with_refresh.",
      inputSchema: z.object({ market: marketArg }),
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const oracle = await getOraclePrice(m);
        const data = await jingswapGet(
          `/api/auction/clearing-preview${apiContractParam(m)}&oraclePrice=${oracle.raw}`
        );
        return createJsonResponse({
          ...data,
          market: market || DEFAULT_V2_MARKET,
          oracleRaw: oracle.raw,
          oracleSatsPerStx: round4(oracle.satsPerStx),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Deposit STX (with limit price) ───────────────────────────

  server.registerTool(
    "jingswap_v2_deposit_stx",
    {
      description:
        "Deposit STX into the current V2 auction cycle with a limit price in sats/STX: the fewest sats per STX " +
        "you accept. If the clearing price is below it, your deposit rolls to the next cycle instead of filling. " +
        "If omitted, the limit is set 20% below the current oracle, which in practice is no price protection. " +
        "Only works during the deposit phase.",
      inputSchema: z.object({
        amount: z.number().positive().describe("Amount of STX to deposit (human units, e.g. 10 for 10 STX)"),
        limitSatsPerStx: z.number().positive().optional().describe(
          "Limit price in sats/STX (your floor). Omit to set it 20% below the oracle."
        ),
        market: marketArg,
      }),
    },
    async ({ amount, limitSatsPerStx, market }) => {
      try {
        const m = getV2Market(market);
        await assertV2DepositPhase(m);
        const { limitSats, defaulted } = await resolveLimit(m, limitSatsPerStx, "stx");
        const limitRaw = satsPerStxToRaw(limitSats);

        const account = await getAccount();
        const micro = BigInt(Math.round(amount * 10 ** STX_DECIMALS));

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "deposit-stx",
          functionArgs: [uintCV(micro), uintCV(limitRaw)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [
            Pc.principal(account.address).willSendEq(micro).ustx(),
            // With 50 depositors queued the contract refunds the smallest one, which is
            // always less than this deposit. lte passes when nothing is sent.
            Pc.principal(contractId(m)).willSendLte(micro).ustx(),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "deposit-stx",
          amount: `${amount} STX`,
          limitSatsPerStx: round4(limitSats),
          limitDefaulted: defaulted,
          limitRaw: limitRaw.toString(),
          market: market || DEFAULT_V2_MARKET,
          premium: m.premiumLabel,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Deposit sBTC (with limit price) ──────────────────────────

  server.registerTool(
    "jingswap_v2_deposit_sbtc",
    {
      description:
        "Deposit sBTC (in sats) into the current V2 auction cycle with a limit price in sats/STX: the most sats " +
        "per STX you pay. If the clearing price is above it, your deposit rolls to the next cycle instead of filling. " +
        "If omitted, the limit is set 20% above the current oracle, which in practice is no price protection. " +
        "Only works during the deposit phase.",
      inputSchema: z.object({
        amount: z.number().int().positive().describe("Amount of sBTC in satoshis (e.g. 1000 for 1000 sats)"),
        limitSatsPerStx: z.number().positive().optional().describe(
          "Limit price in sats/STX (your ceiling). Omit to set it 20% above the oracle."
        ),
        market: marketArg,
      }),
    },
    async ({ amount, limitSatsPerStx, market }) => {
      try {
        const m = getV2Market(market);
        await assertV2DepositPhase(m);
        const { limitSats, defaulted } = await resolveLimit(m, limitSatsPerStx, "sbtc");
        const limitRaw = satsPerStxToRaw(limitSats);

        const account = await getAccount();
        const sats = BigInt(amount);

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "deposit-sbtc",
          functionArgs: [uintCV(sats), uintCV(limitRaw)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [
            Pc.principal(account.address)
              .willSendEq(sats)
              .ft(SBTC_CONTRACT as `${string}.${string}`, "sbtc-token"),
            // Refund of a bumped smallest depositor when the queue is full (always < this deposit).
            Pc.principal(contractId(m))
              .willSendLte(sats)
              .ft(SBTC_CONTRACT as `${string}.${string}`, "sbtc-token"),
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "deposit-sbtc",
          amount: `${amount} sats`,
          limitSatsPerStx: round4(limitSats),
          limitDefaulted: defaulted,
          limitRaw: limitRaw.toString(),
          market: market || DEFAULT_V2_MARKET,
          premium: m.premiumLabel,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Set Limits ───────────────────────────────────────────────

  for (const side of ["stx", "sbtc"] as const) {
    const fn = side === "stx" ? "set-stx-limit" : "set-sbtc-limit";
    server.registerTool(
      `jingswap_v2_set_${side}_limit`,
      {
        description:
          `Update the limit price of your ${side === "stx" ? "STX" : "sBTC"} deposit without re-depositing. ` +
          "Only works during the deposit phase while you have a deposit on that side in the current cycle.",
        inputSchema: z.object({
          limitSatsPerStx: z.number().positive().describe(
            `New limit price in sats/STX (your ${side === "stx" ? "floor" : "ceiling"})`
          ),
          market: marketArg,
        }),
      },
      async ({ limitSatsPerStx, market }) => {
        try {
          const m = getV2Market(market);
          await assertV2DepositPhase(m);
          const limitRaw = satsPerStxToRaw(limitSatsPerStx);
          const account = await getAccount();

          const result = await callContract(account, {
            contractAddress: JINGSWAP_CONTRACT_ADDRESS,
            contractName: m.contractName,
            functionName: fn,
            functionArgs: [uintCV(limitRaw)],
            postConditionMode: PostConditionMode.Deny,
            postConditions: [],
          });

          return createJsonResponse({
            success: true,
            txid: result.txid,
            action: fn,
            limitSatsPerStx,
            limitRaw: limitRaw.toString(),
            market: market || DEFAULT_V2_MARKET,
            network: NETWORK,
            explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          });
        } catch (error) {
          return createErrorResponse(error);
        }
      }
    );
  }

  // ── Cancel Deposits ──────────────────────────────────────────

  for (const side of ["stx", "sbtc"] as const) {
    const fn = side === "stx" ? "cancel-stx-deposit" : "cancel-sbtc-deposit";
    server.registerTool(
      `jingswap_v2_cancel_${side}`,
      {
        description:
          `Cancel your ${side === "stx" ? "STX" : "sBTC"} deposit from the current V2 auction cycle and get a full ` +
          "refund. Works at any point of the deposit phase; not after deposits are closed.",
        inputSchema: z.object({ market: marketArg }),
      },
      async ({ market }) => {
        try {
          const m = getV2Market(market);
          await assertV2DepositPhase(m);
          const account = await getAccount();

          const result = await callContract(account, {
            contractAddress: JINGSWAP_CONTRACT_ADDRESS,
            contractName: m.contractName,
            functionName: fn,
            functionArgs: [],
            postConditionMode: PostConditionMode.Allow,
            // Refund to the caller: this wallet sends nothing.
            callerSpendCaps: { ustx: 0n, sats: 0n },
            postConditions: [],
          });

          return createJsonResponse({
            success: true,
            txid: result.txid,
            action: fn,
            market: market || DEFAULT_V2_MARKET,
            network: NETWORK,
            explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          });
        } catch (error) {
          return createErrorResponse(error);
        }
      }
    );
  }

  // ── Close and Settle with Refresh (bundled) ──────────────────

  server.registerTool(
    "jingswap_v2_close_and_settle_with_refresh",
    {
      description:
        "Settle the V2 auction cycle with fresh Pyth prices. In the deposit phase this calls " +
        "close-and-settle-with-refresh (close deposits, refresh Pyth, apply limit filtering and distribute " +
        "fills in one tx; it reverts as a whole if settlement fails). If deposits were already closed " +
        "(phase 2), it calls settle-with-refresh. Needs 10+ blocks elapsed and both sides at their minimum. " +
        "Check jingswap_v2_get_clearing_preview first. Anyone can call it; the caller pays the tx fee and " +
        "the Pyth update fee (a few uSTX).",
      inputSchema: z.object({ market: marketArg }),
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const data = await getCycleState(m);

        let functionName: "close-and-settle-with-refresh" | "settle-with-refresh";
        if (data.phase === 0) {
          if (data.blocksElapsed < DEPOSIT_MIN_BLOCKS) {
            throw new Error(
              `Cannot settle: the deposit phase needs ${DEPOSIT_MIN_BLOCKS} blocks, currently at ${data.blocksElapsed}`
            );
          }
          const totals = data.cycleTotals ?? {};
          const mins = data.minDeposits ?? {};
          if (!(totals.totalStx >= mins.minStx) || !(totals.totalSbtc >= mins.minSbtc)) {
            throw new Error(
              `Cannot settle: both sides need their minimum (STX ${totals.totalStx}/${mins.minStx} uSTX, ` +
                `sBTC ${totals.totalSbtc}/${mins.minSbtc} sats)`
            );
          }
          functionName = "close-and-settle-with-refresh";
        } else if (data.phase === 2) {
          functionName = "settle-with-refresh";
        } else {
          throw new Error(`Unexpected V2 phase ${data.phase}`);
        }

        const vaas = await jingswapGet(`/api/auction/pyth-vaas${apiContractParam(m)}`);
        if (typeof vaas?.btcVaaHex !== "string" || typeof vaas?.stxVaaHex !== "string") {
          throw new Error("Jingswap API returned no Pyth VAAs (btcVaaHex/stxVaaHex)");
        }
        const btcVaaBuffer = bufferCV(Buffer.from(vaas.btcVaaHex, "hex"));
        const stxVaaBuffer = bufferCV(Buffer.from(vaas.stxVaaHex, "hex"));

        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName,
          functionArgs: [
            btcVaaBuffer,
            stxVaaBuffer,
            contractPrincipalCV(PYTH_CONTRACTS.storage.address, PYTH_CONTRACTS.storage.name),
            contractPrincipalCV(PYTH_CONTRACTS.decoder.address, PYTH_CONTRACTS.decoder.name),
            contractPrincipalCV(PYTH_CONTRACTS.wormhole.address, PYTH_CONTRACTS.wormhole.name),
          ],
          // Settlement pays out to every depositor, so the contract's transfers can't be listed.
          postConditionMode: PostConditionMode.Allow,
          callerSpendCaps: { ustx: PYTH_UPDATE_FEE_CAP_USTX, sats: 0n },
          postConditions: [],
          fee: 50_000n, // 0.05 STX: up to 50 depositors per side are paid in this tx
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: functionName,
          market: market || DEFAULT_V2_MARKET,
          premium: m.premiumLabel,
          cycle: data.currentCycle,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Cancel Cycle ─────────────────────────────────────────────

  server.registerTool(
    "jingswap_v2_cancel_cycle",
    {
      description:
        "Cancel the current V2 auction cycle when deposits were closed but settlement did not happen. " +
        `Callable ${CANCEL_THRESHOLD} blocks after deposits were closed. ` +
        "Rolls all deposits to the next cycle with their limits intact; no funds move.",
      inputSchema: z.object({ market: marketArg }),
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const data = await getCycleState(m);
        if (data.phase === 0) {
          throw new Error("Cannot cancel cycle: auction is still in the deposit phase");
        }
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "cancel-cycle",
          functionArgs: [],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "cancel-cycle",
          market: market || DEFAULT_V2_MARKET,
          cycle: data.currentCycle,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Prices ───────────────────────────────────────────────────

  server.registerTool(
    "jingswap_v2_get_prices",
    {
      description:
        "Get the Pyth oracle prices (BTC/USD, STX/USD) for a V2 market and the derived sats/STX rate, " +
        "raw contract price, and the default 20%-through-oracle limits.",
      inputSchema: z.object({ market: marketArg }),
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const oracle = await getOraclePrice(m);

        return createJsonResponse({
          market: market || DEFAULT_V2_MARKET,
          premium: m.premiumLabel,
          oracleSatsPerStx: round4(oracle.satsPerStx),
          oracleStxPerBtc: Math.round(oracle.stxPerBtc * 100) / 100,
          oracleRaw: oracle.raw,
          btcUsd: oracle.btcUsd,
          stxUsd: oracle.stxUsd,
          _hint: {
            satsPerStx: "Sats of sBTC per 1 STX (higher = better for STX depositors)",
            oracleRaw: "STX per BTC * 1e8, the unit the contract stores prices and limits in",
            defaultStxFloor: `${round4(defaultLimitSatsPerStx(oracle.satsPerStx, "stx"))} sats/STX (20% below oracle)`,
            defaultSbtcCeiling: `${round4(defaultLimitSatsPerStx(oracle.satsPerStx, "sbtc"))} sats/STX (20% above oracle)`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
