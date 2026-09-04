// Jingswap V2 Limit-Price Auction MCP Tools
// Markets: sbtc-stx-market (0% premium, oracle price)
//          sbtc-stx-20bp-stx-premium (0.20% STX bonus)
//
// V2 differences from V1:
// - Deposits require a limit price (mandatory, non-zero)
// - No buffer phase: deposit → settle directly
// - Settlement uses bundled close-and-settle-with-refresh (single tx)
// - close-deposits is NOT exposed separately (can cause stuck cycles)
// - Limit prices can be updated mid-cycle via set-stx-limit / set-sbtc-limit
// - Deposit phase: 10 blocks (~20s), Cancel: 42 blocks (~84s)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { uintCV, bufferCV, contractPrincipalCV, PostConditionMode, Pc } from "@stacks/transactions";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { callContract } from "../transactions/builder.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

const JINGSWAP_API =
  process.env.JINGSWAP_API_URL || "https://faktory-dao-backend.vercel.app";
const JINGSWAP_API_KEY =
  process.env.JINGSWAP_API_KEY || "jc_b058d7f2e0976bd4ee34be3e5c7ba7ebe45289c55d3f5e45f666ebc14b7ebfd0";

// ── V2 Market Configuration ──────────────────────────────────────

const JINGSWAP_CONTRACT_ADDRESS = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22";
const SBTC_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const PRICE_PRECISION = 100_000_000; // 1e8

interface MarketConfigV2 {
  contractName: string;
  slug: string;           // backend slug for API queries
  tokenBSymbol: string;
  tokenBDecimals: number;
  depositFn: string;
  cancelFn: string;
  premiumBps: number;
  premiumLabel: string;
}

const MARKETS_V2: Record<string, MarketConfigV2> = {
  "sbtc-stx-market": {
    contractName: "sbtc-stx-0-jing-v2",
    slug: "sbtc-stx-market",
    tokenBSymbol: "STX",
    tokenBDecimals: 6,
    depositFn: "deposit-stx",
    cancelFn: "cancel-stx-deposit",
    premiumBps: 0,
    premiumLabel: "Market Price (0% premium)",
  },
  "sbtc-stx-20bp-stx-premium": {
    contractName: "sbtc-stx-20-jing-v2",
    slug: "sbtc-stx-20bp-stx-premium",
    tokenBSymbol: "STX",
    tokenBDecimals: 6,
    depositFn: "deposit-stx",
    cancelFn: "cancel-stx-deposit",
    premiumBps: 20,
    premiumLabel: "0.20% STX Bonus",
  },
};

const DEFAULT_V2_MARKET = "sbtc-stx-market";

function getV2Market(market?: string): MarketConfigV2 {
  const key = market || DEFAULT_V2_MARKET;
  const config = MARKETS_V2[key];
  if (!config) throw new Error(`Unknown v2 market "${key}". Available: ${Object.keys(MARKETS_V2).join(", ")}`);
  return config;
}

function apiContractParam(m: MarketConfigV2): string {
  return `?contract=${m.contractName}`;
}

async function jingswapGet(path: string): Promise<any> {
  const res = await fetch(`${JINGSWAP_API}${path}`, {
    headers: { "x-api-key": JINGSWAP_API_KEY },
  });
  if (!res.ok) throw new Error(`Jingswap API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || "API returned failure");
  return json.data;
}

const PYTH_CONTRACTS = {
  storage: { address: "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y", name: "pyth-storage-v4" },
  decoder: { address: "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y", name: "pyth-pnau-decoder-v3" },
  wormhole: { address: "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y", name: "wormhole-core-v4" },
};

// ── Helpers ──────────────────────────────────────────────────────

/** Convert sats/STX to raw contract limit price (STX-per-BTC * PRICE_PRECISION) */
function satsPerStxToRaw(satsPerStx: number): bigint {
  if (satsPerStx <= 0) throw new Error("Limit price must be positive");
  // raw = 1e16 / satsPerStx
  return BigInt(Math.floor(1e16 / satsPerStx));
}

/** Convert raw contract limit price to sats/STX */
function rawToSatsPerStx(raw: number): number {
  return raw > 0 ? Math.round(1e16 / raw) : 0;
}

/** Compute a default 20% in-the-money limit price from oracle */
function defaultLimitSatsPerStx(oracleSatsPerStx: number, side: "stx" | "sbtc"): number {
  if (side === "stx") return Math.floor(oracleSatsPerStx * 0.8); // floor: accept lower
  return Math.ceil(oracleSatsPerStx * 1.2); // ceiling: accept higher
}

async function assertV2DepositPhase(m: MarketConfigV2): Promise<any> {
  const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
  if (data.phase !== 0) {
    throw new Error(`Cannot deposit/cancel — auction is in phase ${data.phase} (must be deposit phase 0)`);
  }
  return data;
}

async function getOracleSatsPerStx(m: MarketConfigV2): Promise<number> {
  const pyth = await jingswapGet(`/api/auction/pyth-prices${apiContractParam(m)}`);
  const stxUsd = pyth.stxUsd.price;
  const btcUsd = pyth.btcUsd.price;
  if (!stxUsd || !btcUsd || stxUsd <= 0) throw new Error("Oracle prices unavailable");
  const stxPerBtc = btcUsd / stxUsd;
  return Math.round(1e8 / stxPerBtc); // sats/STX
}

// ── Tool Registration ────────────────────────────────────────────

export function registerJingswapV2Tools(server: McpServer): void {

  // ── Cycle State ──────────────────────────────────────────────

  server.registerTool(
    "jingswap_v2_get_cycle_state",
    {
      description:
        "Get the current Jingswap V2 auction cycle state. V2 has only 2 phases: " +
        "deposit (10 blocks ~20s) and settle (no buffer). " +
        "Returns phase, blocks elapsed, cycle totals, and minimum deposits.",
      inputSchema: {
        market: z.string().optional().describe(
          `V2 market: "sbtc-stx-market" (0% premium, default) or "sbtc-stx-20bp-stx-premium" (0.20% STX bonus)`
        ),
      },
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
        return createJsonResponse({
          ...data,
          market: market || DEFAULT_V2_MARKET,
          premium: m.premiumLabel,
          _hint: {
            phases: "0=deposit (10 blocks ~20s), 2=settle (no buffer in v2)",
            depositMinBlocks: "10 blocks (~20 seconds)",
            cancelThreshold: "42 blocks (~84 seconds) after close",
            limitPrices: "All deposits require a limit price in sats/STX",
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
        "Returns stxDeposit, sbtcDeposit, stxLimit, sbtcLimit (raw contract values).",
      inputSchema: {
        cycle: z.number().describe("Cycle number"),
        address: z.string().describe("Stacks address of the depositor"),
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ cycle, address, market }) => {
      try {
        const m = getV2Market(market);
        const data = await jingswapGet(`/api/auction/deposit/${cycle}/${address}${apiContractParam(m)}`);
        return createJsonResponse({
          ...data,
          stxLimitSatsPerStx: data.stxLimit ? rawToSatsPerStx(data.stxLimit) : null,
          sbtcLimitSatsPerStx: data.sbtcLimit ? rawToSatsPerStx(data.sbtcLimit) : null,
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
        "Simulate settlement at current oracle price — shows projected clearing amounts " +
        "after limit filtering. Use this to check if settlement would succeed or fail " +
        "before calling close-and-settle. Returns willSettle boolean and reason.",
      inputSchema: {
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        // Get oracle price in raw contract format
        const pyth = await jingswapGet(`/api/auction/pyth-prices${apiContractParam(m)}`);
        const stxUsd = pyth.stxUsd.price;
        const btcUsd = pyth.btcUsd.price;
        if (!stxUsd || !btcUsd || stxUsd <= 0) throw new Error("Oracle prices unavailable");
        const oracleRaw = Math.floor((btcUsd / stxUsd) * PRICE_PRECISION);

        const data = await jingswapGet(`/api/auction/clearing-preview${apiContractParam(m)}&oraclePrice=${oracleRaw}`);
        return createJsonResponse({
          ...data,
          market: market || DEFAULT_V2_MARKET,
          oracleSatsPerStx: rawToSatsPerStx(oracleRaw),
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
        "Deposit STX into a V2 auction cycle with a limit price. " +
        "The limit price is in sats/STX — this is the minimum sats per STX you'll accept. " +
        "If omitted, defaults to 20% below current oracle (virtually guarantees fill). " +
        "Only works during deposit phase.",
      inputSchema: {
        amount: z.number().positive().describe("Amount of STX to deposit (human units, e.g. 10 for 10 STX)"),
        limitSatsPerStx: z.number().int().positive().optional().describe(
          "Limit price in sats/STX (your floor — minimum sats per STX you'll accept). " +
          "Omit to auto-set 20% below oracle for guaranteed fill."
        ),
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ amount, limitSatsPerStx, market }) => {
      try {
        const m = getV2Market(market);
        await assertV2DepositPhase(m);

        // Resolve limit price
        let limitSats: number;
        if (limitSatsPerStx) {
          limitSats = limitSatsPerStx;
        } else {
          const oracleSats = await getOracleSatsPerStx(m);
          limitSats = defaultLimitSatsPerStx(oracleSats, "stx");
        }
        const limitRaw = satsPerStxToRaw(limitSats);

        const account = await getAccount();
        const micro = BigInt(Math.floor(amount * 10 ** m.tokenBDecimals));

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: m.depositFn,
          functionArgs: [uintCV(micro), uintCV(limitRaw)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [Pc.principal(account.address).willSendEq(micro).ustx()],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: m.depositFn,
          amount: `${amount} STX`,
          limitSatsPerStx: limitSats,
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
        "Deposit sBTC into a V2 auction cycle with a limit price. " +
        "The limit price is in sats/STX — this is the maximum sats per STX you'll pay out. " +
        "If omitted, defaults to 20% above current oracle (virtually guarantees fill). " +
        "Amount is in satoshis. Only works during deposit phase.",
      inputSchema: {
        amount: z.number().int().positive().describe("Amount of sBTC in satoshis (e.g. 1000 for 1000 sats)"),
        limitSatsPerStx: z.number().int().positive().optional().describe(
          "Limit price in sats/STX (your ceiling — maximum sats per STX you'll pay). " +
          "Omit to auto-set 20% above oracle for guaranteed fill."
        ),
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ amount, limitSatsPerStx, market }) => {
      try {
        const m = getV2Market(market);
        await assertV2DepositPhase(m);

        let limitSats: number;
        if (limitSatsPerStx) {
          limitSats = limitSatsPerStx;
        } else {
          const oracleSats = await getOracleSatsPerStx(m);
          limitSats = defaultLimitSatsPerStx(oracleSats, "sbtc");
        }
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
          ],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "deposit-sbtc",
          amount: `${amount} sats`,
          limitSatsPerStx: limitSats,
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

  // ── Set STX Limit ────────────────────────────────────────────

  server.registerTool(
    "jingswap_v2_set_stx_limit",
    {
      description:
        "Update your STX-side limit price without re-depositing. " +
        "Only works during deposit phase when you have an active STX deposit.",
      inputSchema: {
        limitSatsPerStx: z.number().int().positive().describe("New limit price in sats/STX (your floor)"),
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
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
          functionName: "set-stx-limit",
          functionArgs: [uintCV(limitRaw)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "set-stx-limit",
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

  // ── Set sBTC Limit ───────────────────────────────────────────

  server.registerTool(
    "jingswap_v2_set_sbtc_limit",
    {
      description:
        "Update your sBTC-side limit price without re-depositing. " +
        "Only works during deposit phase when you have an active sBTC deposit.",
      inputSchema: {
        limitSatsPerStx: z.number().int().positive().describe("New limit price in sats/STX (your ceiling)"),
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
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
          functionName: "set-sbtc-limit",
          functionArgs: [uintCV(limitRaw)],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "set-sbtc-limit",
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

  // ── Cancel STX Deposit ───────────────────────────────────────

  server.registerTool(
    "jingswap_v2_cancel_stx",
    {
      description:
        "Cancel your STX deposit from the current V2 auction cycle and get a full refund. " +
        "Only works during deposit phase, within 42 blocks of deposit.",
      inputSchema: {
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        await assertV2DepositPhase(m);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: m.cancelFn,
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: m.cancelFn,
          market: market || DEFAULT_V2_MARKET,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Cancel sBTC Deposit ──────────────────────────────────────

  server.registerTool(
    "jingswap_v2_cancel_sbtc",
    {
      description:
        "Cancel your sBTC deposit from the current V2 auction cycle and get a full refund. " +
        "Only works during deposit phase, within 42 blocks of deposit.",
      inputSchema: {
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        await assertV2DepositPhase(m);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "cancel-sbtc-deposit",
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "cancel-sbtc-deposit",
          market: market || DEFAULT_V2_MARKET,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Close and Settle with Refresh (bundled) ──────────────────

  server.registerTool(
    "jingswap_v2_close_and_settle_with_refresh",
    {
      description:
        "Close deposits and settle the V2 auction cycle in a single atomic transaction. " +
        "Fetches fresh Pyth oracle prices, closes deposits, applies limit filtering, and distributes fills. " +
        "If settlement would fail (e.g. limits wipe a side), the entire transaction reverts — no stuck cycles. " +
        "Before calling, use jingswap_v2_get_clearing_preview to check if settlement will succeed. " +
        "Only callable when deposit phase has elapsed 10+ blocks and both sides have deposits.",
      inputSchema: {
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);

        if (data.phase === 0 && data.blocksElapsed < 10) {
          throw new Error(`Cannot settle — deposit phase needs 10 blocks minimum, currently at ${data.blocksElapsed}`);
        }

        // Fetch fresh Pyth VAAs
        const vaas = await jingswapGet(`/api/auction/pyth-vaas${apiContractParam(m)}`);
        const btcVaaBuffer = bufferCV(Buffer.from(vaas.btcVaaHex, "hex"));
        const stxVaaBuffer = bufferCV(Buffer.from(vaas.stxVaaHex, "hex"));

        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "close-and-settle-with-refresh",
          functionArgs: [
            btcVaaBuffer,
            stxVaaBuffer,
            contractPrincipalCV(PYTH_CONTRACTS.storage.address, PYTH_CONTRACTS.storage.name),
            contractPrincipalCV(PYTH_CONTRACTS.decoder.address, PYTH_CONTRACTS.decoder.name),
            contractPrincipalCV(PYTH_CONTRACTS.wormhole.address, PYTH_CONTRACTS.wormhole.name),
          ],
          postConditionMode: PostConditionMode.Allow,
          postConditions: [],
          fee: BigInt(50000), // 0.05 STX — heavy tx
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "close-and-settle-with-refresh",
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
        "Cancel the current V2 auction cycle if settlement has failed. " +
        "Can only be called 42 blocks (~84 seconds) after deposits were closed. " +
        "Rolls all deposits to the next cycle with limits intact. " +
        "This is the safety valve — no funds are lost.",
      inputSchema: {
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
        if (data.phase === 0) {
          throw new Error("Cannot cancel cycle — auction is still in deposit phase");
        }
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "cancel-cycle",
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
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

  // ── Prices (reuse same backend, different contract param) ────

  server.registerTool(
    "jingswap_v2_get_prices",
    {
      description:
        "Get current oracle and DEX prices for a V2 market. " +
        "Returns Pyth oracle prices (BTC/USD, STX/USD), on-chain DEX prices, " +
        "and the derived sats/STX rate.",
      inputSchema: {
        market: z.string().optional().describe(`V2 market (default: "sbtc-stx-market")`),
      },
    },
    async ({ market }) => {
      try {
        const m = getV2Market(market);
        const pyth = await jingswapGet(`/api/auction/pyth-prices${apiContractParam(m)}`);
        const stxUsd = pyth.stxUsd.price;
        const btcUsd = pyth.btcUsd.price;
        const stxPerBtc = stxUsd > 0 ? btcUsd / stxUsd : 0;
        const satsPerStx = stxPerBtc > 0 ? Math.round(1e8 / stxPerBtc) : 0;

        return createJsonResponse({
          market: market || DEFAULT_V2_MARKET,
          premium: m.premiumLabel,
          oracleSatsPerStx: satsPerStx,
          oracleStxPerBtc: Math.round(stxPerBtc * 100) / 100,
          btcUsd,
          stxUsd,
          _hint: {
            satsPerStx: "How many sats of sBTC you get per 1 STX (higher = better for STX depositors)",
            stxPerBtc: "How many STX per 1 BTC (contract uses this * 1e8 as raw price)",
            defaultStxFloor: `${defaultLimitSatsPerStx(satsPerStx, "stx")} sats/STX (20% below oracle)`,
            defaultSbtcCeiling: `${defaultLimitSatsPerStx(satsPerStx, "sbtc")} sats/STX (20% above oracle)`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
