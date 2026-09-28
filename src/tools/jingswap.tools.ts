import { McpServer } from "@modelcontextprotocol/server";

// Jingswap Auction MCP Tools
// Query + deposit/cancel tools for sBTC blind auctions on Stacks.
// Markets: sbtc-stx (SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.sbtc-stx-jing)
//          sbtc-usdcx (SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.sbtc-usdcx-jing)
import { z } from "zod";
import { uintCV, bufferCV, contractPrincipalCV, PostConditionMode, Pc } from "@stacks/transactions";
import { getAccount, NETWORK } from "../services/x402.service.js";
import { callContract } from "../transactions/builder.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

const JINGSWAP_API =
  process.env.JINGSWAP_API_URL || "https://faktory-dao-backend.vercel.app";
// Public default key: rate-limited per IP on the backend, same model as Hiro's public API tier.
// Set JINGSWAP_API_KEY env var for higher limits.
const JINGSWAP_API_KEY =
  process.env.JINGSWAP_API_KEY || "jc_b058d7f2e0976bd4ee34be3e5c7ba7ebe45289c55d3f5e45f666ebc14b7ebfd0";

// ── Market Configuration ─────────────────────────────────────────────

interface MarketConfig {
  contractName: string;
  tokenBSymbol: string;
  tokenBDecimals: number;
  tokenBContract?: string;  // undefined = native STX
  tokenBAsset?: string;
  depositFn: string;        // "deposit-stx" | "deposit-usdcx"
  cancelFn: string;         // "cancel-stx-deposit" | "cancel-usdcx-deposit"
  priceUnit: string;        // "STX/BTC" | "USDCx/BTC"
}

const MARKETS: Record<string, MarketConfig> = {
  "sbtc-stx": {
    contractName: "sbtc-stx-jing",
    tokenBSymbol: "STX",
    tokenBDecimals: 6,
    depositFn: "deposit-stx",
    cancelFn: "cancel-stx-deposit",
    priceUnit: "STX/BTC",
  },
  "sbtc-usdcx": {
    contractName: "sbtc-usdcx-jing",
    tokenBSymbol: "USDCx",
    tokenBDecimals: 6,
    tokenBContract: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
    tokenBAsset: "usdcx-token",
    depositFn: "deposit-usdcx",
    cancelFn: "cancel-usdcx-deposit",
    priceUnit: "USDCx/BTC",
  },
};

const DEFAULT_MARKET = "sbtc-stx";

function getMarket(market?: string): MarketConfig {
  const key = market || DEFAULT_MARKET;
  const config = MARKETS[key];
  if (!config) throw new Error(`Unknown market "${key}". Available: ${Object.keys(MARKETS).join(", ")}`);
  return config;
}

function apiContractParam(market: MarketConfig): string {
  return market.contractName === "sbtc-stx-jing" ? "" : `?contract=${market.contractName}`;
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

export function registerJingswapTools(server: McpServer): void {
  // ── Cycle State ──────────────────────────────────────────────

  server.registerTool(
    "jingswap_get_cycle_state",
    {
      description:
        "Get the current Jingswap auction cycle state including phase (deposit/buffer/settle), " +
        "blocks elapsed, cycle totals (token B + sBTC deposited), and minimum deposit requirements. " +
        "Use this to understand where the auction currently stands.",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
        return createJsonResponse({
          ...data,
          market: market || DEFAULT_MARKET,
          _hint: {
            phases: "0=deposit (open for deposits, min 150 blocks), 1=buffer (30 blocks ~1 min, no actions), 2=settle (call settle-with-refresh)",
            blockTime: "Stacks blocks average ~2 seconds each (Nakamoto)",
            depositMinBlocks: "150 blocks (~5 minutes) before deposits can be closed",
            bufferBlocks: "30 blocks (~1 minute) after close before settlement is possible",
            tokenBUnits: `micro-${m.tokenBSymbol} (÷1e${m.tokenBDecimals} for ${m.tokenBSymbol})`,
            sbtcUnits: "satoshis (÷1e8 for sBTC)",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Depositors ───────────────────────────────────────────────

  server.registerTool(
    "jingswap_get_depositors",
    {
      description:
        "Get the list of token B and sBTC depositors for a specific auction cycle. " +
        "Returns arrays of Stacks addresses on each side. Max 50 depositors per side.",
      inputSchema: z.object({
        cycle: z.number().describe("Cycle number to query"),
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ cycle, market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/depositors/${cycle}${apiContractParam(m)}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── User Deposit ─────────────────────────────────────────────

  server.registerTool(
    "jingswap_get_user_deposit",
    {
      description:
        "Get a specific user's deposit amounts (token B and sBTC) for a given auction cycle.",
      inputSchema: z.object({
        cycle: z.number().describe("Cycle number"),
        address: z.string().describe("Stacks address of the depositor"),
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ cycle, address, market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/deposit/${cycle}/${address}${apiContractParam(m)}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Settlement ───────────────────────────────────────────────

  server.registerTool(
    "jingswap_get_settlement",
    {
      description:
        "Get settlement details for a completed auction cycle. Returns clearing price, " +
        "amounts cleared, fees, and the block height at which settlement occurred. " +
        "Returns null settlement if the cycle hasn't been settled yet.",
      inputSchema: z.object({
        cycle: z.number().describe("Cycle number to query"),
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ cycle, market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/settlement/${cycle}${apiContractParam(m)}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Cycles History ───────────────────────────────────────────

  server.registerTool(
    "jingswap_get_cycles_history",
    {
      description:
        "Get the full history of all auction cycles from cycle 0 to the current cycle. " +
        "Each entry includes settlement data (if settled) and cycle totals. " +
        "Useful for analyzing historical auction performance and volume.",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/cycles-history${apiContractParam(m)}`);
        return createJsonResponse(data);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── User Activity ────────────────────────────────────────────

  server.registerTool(
    "jingswap_get_user_activity",
    {
      description:
        "Get a user's auction activity history — deposits, cancellations, fills, and settlements. " +
        "Indexed from on-chain contract events.",
      inputSchema: z.object({
        address: z.string().describe("Stacks address to query"),
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ address, market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/activity/${address}${apiContractParam(m)}`);
        return createJsonResponse({
          ...data,
          market: market || DEFAULT_MARKET,
          _hint: {
            "distribute-tokenB-depositor": `${m.tokenBSymbol} amount = unswapped ${m.tokenBSymbol} rolled to next cycle, sbtcAmount = sBTC received from swap`,
            "distribute-sbtc-depositor": `sbtcAmount = unswapped sats rolled to next cycle, ${m.tokenBSymbol} amount = ${m.tokenBSymbol} received from swap`,
            "refund-tokenB": "deposit rejected (e.g. duplicate or below minimum)",
            "refund-sbtc": "deposit rejected (e.g. duplicate or below minimum)",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Deposit STX ─────────────────────────────────────────────

  const JINGSWAP_CONTRACT_ADDRESS = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22";
  const SBTC_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";

  async function assertDepositPhase(market: MarketConfig): Promise<void> {
    const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(market)}`);
    if (data.phase !== 0) {
      const phaseNames = ["deposit", "buffer", "settle"];
      throw new Error(
        `Cannot deposit/cancel — auction is in ${phaseNames[data.phase] || "unknown"} phase (must be in deposit phase)`
      );
    }
  }

  server.registerTool(
    "jingswap_deposit_stx",
    {
      description:
        "Deposit the token-B side (STX or USDCx depending on market) into the current Jingswap auction cycle. " +
        "Only works during the deposit phase. Amount is in human units (e.g. 10 for 10 STX, or 10 for 10 USDCx).",
      inputSchema: z.object({
        amount: z.number().positive().describe("Amount of token B to deposit (human units)"),
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ amount, market }) => {
      try {
        const m = getMarket(market);
        await assertDepositPhase(m);
        const account = await getAccount();
        const micro = BigInt(Math.floor(amount * 10 ** m.tokenBDecimals));

        let postConditions;
        if (!m.tokenBContract) {
          // Native STX
          postConditions = [Pc.principal(account.address).willSendEq(micro).ustx()];
        } else {
          // FT (e.g. USDCx)
          postConditions = [
            Pc.principal(account.address)
              .willSendEq(micro)
              .ft(m.tokenBContract as `${string}.${string}`, m.tokenBAsset!),
          ];
        }

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: m.depositFn,
          functionArgs: [uintCV(micro)],
          postConditionMode: PostConditionMode.Deny,
          postConditions,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: m.depositFn,
          amount: `${amount} ${m.tokenBSymbol}`,
          market: market || DEFAULT_MARKET,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Deposit sBTC ────────────────────────────────────────────

  server.registerTool(
    "jingswap_deposit_sbtc",
    {
      description:
        "Deposit sBTC into the current Jingswap auction cycle. " +
        "Only works during the deposit phase. Amount is in satoshis (e.g. 1000 for 1000 sats). " +
        "Works the same for both sbtc-stx and sbtc-usdcx markets.",
      inputSchema: z.object({
        amount: z.number().int().positive().describe("Amount of sBTC in satoshis"),
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ amount, market }) => {
      try {
        const m = getMarket(market);
        await assertDepositPhase(m);
        const account = await getAccount();
        const sats = BigInt(amount);

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "deposit-sbtc",
          functionArgs: [uintCV(sats)],
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
          market: market || DEFAULT_MARKET,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Cancel STX Deposit ──────────────────────────────────────

  server.registerTool(
    "jingswap_cancel_stx",
    {
      description:
        "Cancel your token-B deposit (STX or USDCx depending on market) from the current Jingswap auction cycle " +
        "and get a full refund. Only works during the deposit phase.",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        await assertDepositPhase(m);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: m.cancelFn,
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
          // Caller spend caps (refund).
          callerSpendCaps: { ustx: 0n, sats: 0n },
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: m.cancelFn,
          market: market || DEFAULT_MARKET,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Cancel sBTC Deposit ─────────────────────────────────────

  server.registerTool(
    "jingswap_cancel_sbtc",
    {
      description:
        "Cancel your sBTC deposit from the current Jingswap auction cycle and get a full refund. " +
        "Only works during the deposit phase. Works the same for both markets.",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        await assertDepositPhase(m);
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "cancel-sbtc-deposit",
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
          // Caller spend caps (refund).
          callerSpendCaps: { ustx: 0n, sats: 0n },
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "cancel-sbtc-deposit",
          market: market || DEFAULT_MARKET,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Close Deposits ───────────────────────────────────────────

  server.registerTool(
    "jingswap_close_deposits",
    {
      description:
        "Close the deposit phase of the current Jingswap auction cycle. " +
        "Before calling, check jingswap_get_cycle_state to verify: phase is 0 (deposit), " +
        "blocksElapsed >= 150 (DEPOSIT_MIN_BLOCKS), and both sides meet minimums. " +
        "Anyone can call this. Transitions to buffer phase.",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
        if (data.phase !== 0) {
          throw new Error("Cannot close deposits — auction is not in deposit phase");
        }
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "close-deposits",
          functionArgs: [],
          postConditionMode: PostConditionMode.Deny,
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "close-deposits",
          market: market || DEFAULT_MARKET,
          cycle: data.currentCycle,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Settle (stored prices) ──────────────────────────────────

  server.registerTool(
    "jingswap_settle",
    {
      description:
        "Settle the current auction cycle using stored Pyth oracle prices (free). " +
        "WARNING: This will almost always fail because stored prices go stale quickly. " +
        "Prefer jingswap_settle_with_refresh instead — it fetches fresh prices and is much more reliable. " +
        "Only works after deposits have been closed (buffer/settle phase).",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
        if (data.phase === 0) {
          throw new Error("Cannot settle — auction is still in deposit phase. Close deposits first.");
        }
        if (data.phase === 1) {
          const BUFFER_BLOCKS = 30;
          const blocksIntoBuffer = data.blocksElapsed - 150;
          const blocksRemaining = Math.max(0, BUFFER_BLOCKS - blocksIntoBuffer);
          throw new Error(
            `Cannot settle — auction is in buffer phase. Wait ${blocksRemaining} more blocks (~${blocksRemaining * 2}s) before settling.`
          );
        }
        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "settle",
          functionArgs: [],
          postConditionMode: PostConditionMode.Allow,
          // Caller spend caps (distributes to depositors).
          callerSpendCaps: { ustx: 0n, sats: 0n },
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "settle",
          market: market || DEFAULT_MARKET,
          cycle: data.currentCycle,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Settle with Refresh (fresh Pyth VAAs) ───────────────────

  const PYTH_CONTRACTS = {
    storage: { address: "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y", name: "pyth-storage-v4" },
    decoder: { address: "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y", name: "pyth-pnau-decoder-v3" },
    wormhole: { address: "SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y", name: "wormhole-core-v4" },
  };

  server.registerTool(
    "jingswap_settle_with_refresh",
    {
      description:
        "Settle the current auction cycle by first refreshing Pyth oracle prices with fresh VAAs. " +
        "This is the recommended settlement method — stored prices are almost always stale. " +
        "Costs ~2 µSTX for the Pyth update. Automatically fetches fresh VAAs from the backend. " +
        "Settlement distributes funds to all depositors so post conditions are in Allow mode. " +
        "There is no guarantee settlement succeeds (e.g. if oracle update fails), but this is " +
        "the most reliable path. Only works after deposits have been closed (buffer/settle phase).",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        const data = await jingswapGet(`/api/auction/cycle-state${apiContractParam(m)}`);
        if (data.phase === 0) {
          throw new Error("Cannot settle — auction is still in deposit phase. Close deposits first.");
        }
        if (data.phase === 1) {
          const BUFFER_BLOCKS = 30;
          const blocksIntoBuffer = data.blocksElapsed - 150;
          const blocksRemaining = Math.max(0, BUFFER_BLOCKS - blocksIntoBuffer);
          throw new Error(
            `Cannot settle — auction is in buffer phase. Wait ${blocksRemaining} more blocks (~${blocksRemaining * 2}s) before settling.`
          );
        }

        // Fetch fresh Pyth VAAs from backend
        const vaas = await jingswapGet("/api/auction/pyth-vaas");
        const btcVaaBuffer = bufferCV(Buffer.from(vaas.btcVaaHex, "hex"));
        const stxVaaBuffer = bufferCV(Buffer.from(vaas.stxVaaHex, "hex"));

        const account = await getAccount();

        const result = await callContract(account, {
          contractAddress: JINGSWAP_CONTRACT_ADDRESS,
          contractName: m.contractName,
          functionName: "settle-with-refresh",
          functionArgs: [
            btcVaaBuffer,
            stxVaaBuffer,
            contractPrincipalCV(PYTH_CONTRACTS.storage.address, PYTH_CONTRACTS.storage.name),
            contractPrincipalCV(PYTH_CONTRACTS.decoder.address, PYTH_CONTRACTS.decoder.name),
            contractPrincipalCV(PYTH_CONTRACTS.wormhole.address, PYTH_CONTRACTS.wormhole.name),
          ],
          postConditionMode: PostConditionMode.Allow,
          // Caller spend caps (the Pyth update fee is ~2 uSTX; 0.001 STX bounds it).
          callerSpendCaps: { ustx: 1_000n, sats: 0n },
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "settle-with-refresh",
          market: market || DEFAULT_MARKET,
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
    "jingswap_cancel_cycle",
    {
      description:
        "Cancel the current auction cycle if settlement has failed for too long. " +
        "Can only be called 530 blocks (~17.5 min) after deposits were closed " +
        "(BUFFER_BLOCKS 30 + CANCEL_THRESHOLD 500). " +
        "Rolls all deposits into the next cycle — no refunds, users can withdraw " +
        "individually during the next deposit phase. This is the safety valve.",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
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
          // Caller spend caps (refunds depositors).
          callerSpendCaps: { ustx: 0n, sats: 0n },
          postConditions: [],
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          action: "cancel-cycle",
          market: market || DEFAULT_MARKET,
          cycle: data.currentCycle,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── Oracle Prices ────────────────────────────────────────────

  server.registerTool(
    "jingswap_get_prices",
    {
      description:
        "Get current oracle and DEX prices used by the Jingswap auction. " +
        "Returns Pyth oracle prices (BTC/USD, STX/USD with confidence and freshness), " +
        "on-chain DEX prices (XYK pool with TVL, DLMM), and the derived price ratio.",
      inputSchema: z.object({
        market: z.string().optional().describe('Market: "sbtc-stx" (default) or "sbtc-usdcx"'),
      }),
    },
    async ({ market }) => {
      try {
        const m = getMarket(market);
        const [pyth, dex] = await Promise.all([
          jingswapGet(`/api/auction/pyth-prices${apiContractParam(m)}`),
          jingswapGet(`/api/auction/dex-price${apiContractParam(m)}`),
        ]);
        // Compute human-readable STX/BTC prices
        const xykStxPerBtc =
          dex.xykBalances && dex.xykBalances.xBalance > 0
            ? (dex.xykBalances.yBalance / dex.xykBalances.xBalance / 1e6) * 1e8
            : null;
        // dlmmPrice is fixed-point: multiply by 1e-10 to get STX/BTC ratio, then invert
        const dlmmStxPerBtc =
          dex.dlmmPrice && dex.dlmmPrice > 0
            ? Math.round((1 / (dex.dlmmPrice * 1e-10)) * 100) / 100
            : null;
        return createJsonResponse({
          market: market || DEFAULT_MARKET,
          pyth,
          dex: {
            ...dex,
            xykStxPerBtc: xykStxPerBtc ? Math.round(xykStxPerBtc * 100) / 100 : null,
            dlmmStxPerBtc,
          },
          _hint: {
            xykStxPerBtc: `${m.tokenBSymbol} per BTC from XYK pool`,
            dlmmStxPerBtc: `${m.tokenBSymbol} per BTC from DLMM pool`,
            xykPrice: `Raw contract value — use xykStxPerBtc instead`,
            dlmmPrice: `Raw fixed-point (x1e-10 = ${m.priceUnit} ratio) — use dlmmStxPerBtc instead`,
            xBalance: "sBTC in sats (÷1e8 for BTC)",
            yBalance: `${m.tokenBSymbol} in micro-units (÷1e${m.tokenBDecimals} for ${m.tokenBSymbol})`,
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
