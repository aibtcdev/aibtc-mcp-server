/**
 * Yield Dashboard MCP tools
 *
 * Read-only cross-protocol DeFi yield aggregation across Zest Protocol,
 * ALEX DEX, Bitflow, and STX Stacking. Mainnet-only.
 *
 * Tools:
 * - yield_dashboard_overview      — Portfolio summary: total value, weighted APY, per-protocol breakdown
 * - yield_dashboard_positions     — Detailed per-protocol position data
 * - yield_dashboard_apy_breakdown — Current APY rates across all protocols (no wallet needed)
 * - yield_dashboard_rebalance     — Rebalance suggestions based on risk-adjusted yield
 *
 * Mirrors the yield-dashboard skill (aibtcdev/skills/yield-dashboard/).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  contractPrincipalCV,
  standardPrincipalCV,
  uintCV,
  hexToCV,
  cvToValue,
} from "@stacks/transactions";
import { NETWORK } from "../services/x402.service.js";
import { getWalletAddress } from "../services/x402.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// ============================================================================
// Constants
// ============================================================================

// Zest V1 (active on mainnet)
const ZEST_POOL_CONTRACT = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";
const ZEST_POOL_NAME = "pool-borrow-v2-3";
const SBTC_TOKEN_ADDRESS = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const SBTC_TOKEN_NAME = "sbtc-token";
const ZEST_CONTRACT_ID = `${ZEST_POOL_CONTRACT}.${ZEST_POOL_NAME}`;

// Zest V2 (rewards live, pool-read-supply pending)
const ZEST_V2_DEPLOYER = "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG";
const ZEST_V2_POOL_READ = "pool-read-supply";

// ALEX AMM
const ALEX_CONTRACT = "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM";
const ALEX_POOL_NAME = "amm-pool-v2-01";
const ALEX_CONTRACT_ID = `${ALEX_CONTRACT}.${ALEX_POOL_NAME}`;
const ALEX_TOKEN_X_ADDRESS = "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM";
const ALEX_TOKEN_X_NAME = "token-wstx-v2";
const ALEX_TOKEN_Y_ADDRESS = "SP2XD7417HGPRTREMKF748VNEQPDRR0RMANB7X1NK";
const ALEX_TOKEN_Y_NAME = "token-abtc";
const ALEX_FACTOR = 100_000_000;

// Bitflow public API
const BITFLOW_API = "https://app.bitflow.finance/api";

// Stacking (PoX-4)
const POX_CONTRACT = "SP000000000000000000002Q6VF78";
const POX_NAME = "pox-4";
const POX_CONTRACT_ID = `${POX_CONTRACT}.${POX_NAME}`;

// Mainnet Hiro API base URL (direct — not network-switched, this skill is mainnet-only)
const MAINNET_HIRO_API = "https://api.hiro.so";

// ============================================================================
// Types
// ============================================================================

interface ProtocolPosition {
  protocol: string;
  asset: string;
  valueSats: number;
  valueUnit: "sats" | "microSTX";
  apyPct: number;
  riskScore: number;
  details: Record<string, unknown>;
}

// ============================================================================
// Helpers
// ============================================================================

function decodeTupleField(result: string, field: string): bigint | null {
  try {
    const hex = result.startsWith("0x") ? result.slice(2) : result;
    const cv = hexToCV(hex);
    const decoded = cvToValue(cv, true) as Record<string, unknown>;
    const val = decoded[field];
    if (val === undefined || val === null) return null;
    if (typeof val === "bigint") return val;
    if (typeof val === "number") return BigInt(val);
    return null;
  } catch {
    return null;
  }
}

function formatBtc(sats: number): string {
  return (sats / 1e8).toFixed(8);
}

function formatStxAmount(microStx: number): string {
  return (microStx / 1e6).toFixed(6);
}

// ============================================================================
// Protocol Readers
// ============================================================================

async function readZestPosition(walletAddress: string): Promise<ProtocolPosition> {
  const pos: ProtocolPosition = {
    protocol: "Zest Protocol",
    asset: "sBTC",
    valueSats: 0,
    valueUnit: "sats",
    apyPct: 0,
    riskScore: 20,
    details: {},
  };

  try {
    const hiro = getHiroApi("mainnet");
    const sbtcPrincipal = contractPrincipalCV(SBTC_TOKEN_ADDRESS, SBTC_TOKEN_NAME);

    const res = await hiro.callReadOnlyFunction(
      ZEST_CONTRACT_ID,
      "get-reserve-state",
      [sbtcPrincipal],
      ZEST_POOL_CONTRACT
    );

    if (res.okay && res.result) {
      const liquidityRate = decodeTupleField(res.result, "current-liquidity-rate");
      if (liquidityRate !== null && liquidityRate > 0n) {
        // Ray units: 1e27 = 100%
        pos.apyPct = Number(liquidityRate) / 1e25;
      }
      const borrowsStable = decodeTupleField(res.result, "total-borrows-stable") ?? 0n;
      const borrowsVariable = decodeTupleField(res.result, "total-borrows-variable") ?? 0n;
      pos.details.totalBorrows = (borrowsStable + borrowsVariable).toString();

      // Try to get user a-token balance
      try {
        const hex = res.result.startsWith("0x") ? res.result.slice(2) : res.result;
        const cv = hexToCV(hex);
        const decoded = cvToValue(cv, true) as Record<string, unknown>;
        const aTokenAddr = decoded["a-token-address"];
        if (aTokenAddr && typeof aTokenAddr === "string" && aTokenAddr.includes(".")) {
          const [aTokContract, aTokName] = aTokenAddr.split(".");
          const balRes = await hiro.callReadOnlyFunction(
            `${aTokContract}.${aTokName}`,
            "ft-get-balance",
            [standardPrincipalCV(walletAddress)],
            aTokContract
          );
          if (balRes.okay && balRes.result) {
            const balHex = balRes.result.startsWith("0x")
              ? balRes.result.slice(2)
              : balRes.result;
            const balCv = hexToCV(balHex);
            const balance = cvToValue(balCv, true);
            pos.valueSats =
              typeof balance === "bigint"
                ? Number(balance)
                : typeof balance === "number"
                  ? balance
                  : 0;
          }
        }
      } catch {
        // Position read failed — APY still valid
      }
    }
  } catch (e) {
    pos.details.error = String(e);
  }

  return pos;
}

async function readAlexPosition(_walletAddress: string): Promise<ProtocolPosition> {
  const pos: ProtocolPosition = {
    protocol: "ALEX DEX",
    asset: "aBTC/STX LP",
    valueSats: 0,
    valueUnit: "sats",
    apyPct: 0,
    riskScore: 50,
    details: {},
  };

  try {
    const hiro = getHiroApi("mainnet");
    const res = await hiro.callReadOnlyFunction(
      ALEX_CONTRACT_ID,
      "get-pool-details",
      [
        contractPrincipalCV(ALEX_TOKEN_X_ADDRESS, ALEX_TOKEN_X_NAME),
        contractPrincipalCV(ALEX_TOKEN_Y_ADDRESS, ALEX_TOKEN_Y_NAME),
        uintCV(ALEX_FACTOR),
      ],
      ALEX_CONTRACT
    );

    if (res.okay && res.result) {
      const balX = decodeTupleField(res.result, "balance-x") ?? 0n;
      const balY = decodeTupleField(res.result, "balance-y") ?? 0n;
      const totalSupply = decodeTupleField(res.result, "total-supply") ?? 0n;
      pos.details.poolBalanceX = balX.toString();
      pos.details.poolBalanceY = balY.toString();
      pos.details.poolTotalSupply = totalSupply.toString();
      // ALEX typical LP APY estimate from fee revenue
      pos.apyPct = 3.5;
      pos.details.apySource = "static estimate, not live";
      pos.details.note =
        "ALEX AMM v2 does not expose user LP positions via read-only calls. " +
        `Pool total supply: ${totalSupply.toString()} units. ` +
        `Pool aBTC balance: ${Number(balY).toLocaleString()} (ALEX fixed-point). ` +
        "valueSats requires on-chain user position tracking not yet available.";
    }
  } catch (e) {
    pos.details.error = String(e);
  }

  return pos;
}

async function readBitflowPosition(_walletAddress: string): Promise<ProtocolPosition> {
  const pos: ProtocolPosition = {
    protocol: "Bitflow",
    asset: "sBTC",
    valueSats: 0,
    valueUnit: "sats",
    apyPct: 0,
    riskScore: 35,
    details: {},
  };

  try {
    const res = await fetch(`${BITFLOW_API}/pools`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const pools = (await res.json()) as Array<{
        token0?: string;
        token1?: string;
        apy?: number;
        tvl?: number;
        [k: string]: unknown;
      }>;
      const sbtcPool = pools.find(
        (p) =>
          (p.token0 && p.token0.toLowerCase().includes("sbtc")) ||
          (p.token1 && p.token1.toLowerCase().includes("sbtc"))
      );
      if (sbtcPool) {
        pos.apyPct = sbtcPool.apy ?? 2.8;
        pos.details.tvl = sbtcPool.tvl;
        pos.details.pool = sbtcPool;
      } else {
        pos.apyPct = 2.8;
        pos.details.apySource = "fallback estimate";
      }
    } else {
      pos.apyPct = 2.8;
      pos.details.apySource = "fallback estimate (API unavailable)";
    }
  } catch (e) {
    pos.apyPct = 2.8;
    pos.details.error = String(e);
    pos.details.apySource = "fallback estimate (API unavailable)";
  }

  // Bitflow LP position reading requires on-chain query (not yet implemented)
  return pos;
}

async function readStackingPosition(walletAddress: string): Promise<ProtocolPosition> {
  const pos: ProtocolPosition = {
    protocol: "STX Stacking",
    asset: "STX",
    valueSats: 0,
    valueUnit: "microSTX",
    apyPct: 0,
    riskScore: 10,
    details: {},
  };

  try {
    const hiro = getHiroApi("mainnet");
    const res = await hiro.callReadOnlyFunction(
      POX_CONTRACT_ID,
      "get-stacker-info",
      [standardPrincipalCV(walletAddress)],
      POX_CONTRACT
    );

    if (res.okay && res.result) {
      const hex = res.result.startsWith("0x") ? res.result.slice(2) : res.result;
      const cv = hexToCV(hex);
      const val = cvToValue(cv, true);
      if (val && typeof val === "object" && "lock-amount" in (val as object)) {
        const lockAmount = (val as Record<string, unknown>)["lock-amount"];
        pos.valueSats =
          typeof lockAmount === "bigint"
            ? Number(lockAmount)
            : typeof lockAmount === "number"
              ? lockAmount
              : 0;
        pos.apyPct = 8.0;
        pos.details.apySource = "static estimate, not live";
        pos.details.stackerInfo = val;
      }
    }
  } catch (e) {
    pos.details.error = String(e);
  }

  return pos;
}

async function getWalletBalances(
  walletAddress: string
): Promise<{ stxMicroStx: number; sbtcSats: number }> {
  try {
    const res = await fetch(
      `${MAINNET_HIRO_API}/extended/v1/address/${walletAddress}/balances`
    );
    if (!res.ok) return { stxMicroStx: 0, sbtcSats: 0 };
    const data = (await res.json()) as {
      stx?: { balance?: string };
      fungible_tokens?: Record<string, { balance?: string }>;
    };
    const stxMicroStx = parseInt(data.stx?.balance ?? "0", 10);
    const sbtcKey = Object.keys(data.fungible_tokens ?? {}).find((k) =>
      k.toLowerCase().includes("sbtc")
    );
    const sbtcSats = sbtcKey
      ? parseInt(data.fungible_tokens?.[sbtcKey]?.balance ?? "0", 10)
      : 0;
    return { stxMicroStx, sbtcSats };
  } catch {
    return { stxMicroStx: 0, sbtcSats: 0 };
  }
}

async function checkZestV2(): Promise<boolean> {
  try {
    const res = await fetch(
      `${MAINNET_HIRO_API}/v2/contracts/interface/${ZEST_V2_DEPLOYER}/${ZEST_V2_POOL_READ}`,
      { method: "GET" }
    );
    return res.status === 200;
  } catch {
    return false;
  }
}

// ============================================================================
// MCP Tools
// ============================================================================

export function registerYieldDashboardTools(server: McpServer): void {
  // --- overview ---
  server.registerTool(
    "yield_dashboard_overview",
    {
      description: `Portfolio overview across Stacks DeFi protocols.

Aggregates positions across Zest Protocol (sBTC lending), ALEX DEX (AMM LP),
Bitflow (DEX LP), and STX Stacking. Returns total value, weighted APY, and
per-protocol breakdown.

Read-only. Mainnet-only. Requires an unlocked wallet for address context.

Note: ALEX LP and Bitflow LP position values are 0 — these protocols do not
expose user LP positions via read-only calls. APY figures are still returned.`,
      inputSchema: {},
    },
    async () => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "yield-dashboard is mainnet-only. Set NETWORK=mainnet to use this skill.",
            network: NETWORK,
          });
        }

        const walletAddress = await getWalletAddress();

        const [zest, alex, bitflow, stacking, balances, v2Ready] = await Promise.all([
          readZestPosition(walletAddress),
          readAlexPosition(walletAddress),
          readBitflowPosition(walletAddress),
          readStackingPosition(walletAddress),
          getWalletBalances(walletAddress),
          checkZestV2(),
        ]);

        const positions = [zest, alex, bitflow, stacking];
        const satsPositions = positions.filter((p) => p.valueUnit === "sats");
        const stxPositions = positions.filter((p) => p.valueUnit === "microSTX");
        const totalValueSats = satsPositions.reduce((sum, p) => sum + p.valueSats, 0);
        const totalValueMicroStx = stxPositions.reduce((sum, p) => sum + p.valueSats, 0);
        const weightedApyPct =
          totalValueSats > 0
            ? satsPositions.reduce(
                (sum, p) => sum + p.apyPct * (p.valueSats / totalValueSats),
                0
              )
            : 0;

        return createJsonResponse({
          walletAddress,
          totalValueSats,
          totalValueBtc: formatBtc(totalValueSats),
          totalValueMicroStx,
          totalValueStx: totalValueMicroStx / 1_000_000,
          weightedApyPct: Math.round(weightedApyPct * 100) / 100,
          note: "totalValueSats excludes STX stacking (different unit). See totalValueStx separately.",
          protocols: {
            zest: {
              valueSats: zest.valueSats,
              apyPct: zest.apyPct,
            },
            alex: {
              valueSats: alex.valueSats,
              apyPct: alex.apyPct,
            },
            bitflow: {
              valueSats: bitflow.valueSats,
              apyPct: bitflow.apyPct,
            },
            stacking: {
              valueMicroStx: stacking.valueSats,
              valueStx: stacking.valueSats / 1_000_000,
              apyPct: stacking.apyPct,
            },
          },
          walletSbtcSats: balances.sbtcSats,
          walletStxMicroStx: balances.stxMicroStx,
          zestV2Ready: v2Ready,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- positions ---
  server.registerTool(
    "yield_dashboard_positions",
    {
      description: `Detailed per-protocol DeFi position data.

Returns an array of positions across Zest Protocol, ALEX DEX, Bitflow, and
STX Stacking. Each position includes protocol, asset, value, APY, risk score,
and protocol-specific details.

Read-only. Mainnet-only. Requires an unlocked wallet for address context.

Known limitations:
- ALEX LP and Bitflow LP: valueSats shows 0 (protocol does not expose user
  LP balances via read-only calls). APY is still returned.
- Stacking: denominated in microSTX, not sats.`,
      inputSchema: {},
    },
    async () => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "yield-dashboard is mainnet-only. Set NETWORK=mainnet to use this skill.",
            network: NETWORK,
          });
        }

        const walletAddress = await getWalletAddress();

        const positions = await Promise.all([
          readZestPosition(walletAddress),
          readAlexPosition(walletAddress),
          readBitflowPosition(walletAddress),
          readStackingPosition(walletAddress),
        ]);

        return createJsonResponse({
          walletAddress,
          positions: positions.map((p) => ({
            protocol: p.protocol,
            asset: p.asset,
            ...(p.valueUnit === "sats"
              ? { valueSats: p.valueSats, valueBtc: formatBtc(p.valueSats) }
              : {
                  valueMicroStx: p.valueSats,
                  valueStx: formatStxAmount(p.valueSats),
                }),
            apyPct: p.apyPct,
            riskScore: p.riskScore,
            details: p.details,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- apy-breakdown ---
  server.registerTool(
    "yield_dashboard_apy_breakdown",
    {
      description: `Current APY rates across all supported Stacks DeFi protocols.

Returns live APY data for Zest Protocol (sBTC lending), ALEX DEX (aBTC/STX LP),
Bitflow (sBTC LP), and STX Stacking. No wallet required — pure market data.

Data sources:
- Zest Protocol: on-chain reserve state (current-liquidity-rate, Ray units)
- ALEX DEX: static 3.5% estimate (pool data available but per-user APY not live)
- Bitflow: public API at app.bitflow.finance/api/pools (fallback: 2.8% estimate)
- STX Stacking: static 8.0% estimate

Mainnet data only (contract addresses are mainnet-specific).`,
      inputSchema: {},
    },
    async () => {
      try {
        // APY breakdown does not require a wallet — use burn address as dummy
        const dummyAddress = "SP000000000000000000002Q6VF78";

        const [zest, alex, bitflow, v2Ready] = await Promise.all([
          readZestPosition(dummyAddress),
          readAlexPosition(dummyAddress),
          readBitflowPosition(dummyAddress),
          checkZestV2(),
        ]);

        return createJsonResponse({
          timestamp: new Date().toISOString(),
          rates: [
            {
              protocol: "Zest Protocol",
              asset: "sBTC",
              supplyApyPct: zest.apyPct,
              riskScore: zest.riskScore,
            },
            {
              protocol: "ALEX DEX",
              asset: "aBTC/STX LP",
              apyPct: alex.apyPct,
              riskScore: alex.riskScore,
            },
            {
              protocol: "Bitflow",
              asset: "sBTC",
              apyPct: bitflow.apyPct,
              riskScore: bitflow.riskScore,
            },
            {
              protocol: "STX Stacking",
              asset: "STX",
              apyPct: 8.0,
              riskScore: 10,
            },
          ],
          zestV2Ready: v2Ready,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --- rebalance ---
  server.registerTool(
    "yield_dashboard_rebalance",
    {
      description: `Rebalance suggestions based on risk-adjusted yield.

Reads current positions across all protocols, compares to optimal allocation
for the chosen risk tolerance, and returns actionable suggestions.

Risk tolerance levels:
- low:    Zest 40%, ALEX 10%, Bitflow 10%, Stacking 40%
- medium: Zest 45%, ALEX 20%, Bitflow 15%, Stacking 20% (default)
- high:   Zest 50%, ALEX 30%, Bitflow 20%, Stacking 0%

Read-only. Mainnet-only. Requires an unlocked wallet for address context.`,
      inputSchema: {
        riskTolerance: z
          .enum(["low", "medium", "high"])
          .optional()
          .default("medium")
          .describe("Risk tolerance level: low, medium, or high (default: medium)"),
      },
    },
    async ({ riskTolerance }) => {
      try {
        if (NETWORK !== "mainnet") {
          return createJsonResponse({
            error: "yield-dashboard is mainnet-only. Set NETWORK=mainnet to use this skill.",
            network: NETWORK,
          });
        }

        const walletAddress = await getWalletAddress();

        const positions = await Promise.all([
          readZestPosition(walletAddress),
          readAlexPosition(walletAddress),
          readBitflowPosition(walletAddress),
          readStackingPosition(walletAddress),
        ]);

        const totalValue = positions.reduce((s, p) => s + p.valueSats, 0);
        const keys = ["zest", "alex", "bitflow", "stacking"];
        const currentAllocation: Record<string, number> = {};
        positions.forEach((p, i) => {
          currentAllocation[keys[i]] =
            totalValue > 0 ? Math.round((p.valueSats / totalValue) * 100) : 0;
        });

        const targets: Record<string, Record<string, number>> = {
          low: { zest: 40, alex: 10, bitflow: 10, stacking: 40 },
          medium: { zest: 45, alex: 20, bitflow: 15, stacking: 20 },
          high: { zest: 50, alex: 30, bitflow: 20, stacking: 0 },
        };
        const riskLevel = riskTolerance ?? "medium";
        const suggested = targets[riskLevel] ?? targets["medium"];

        const suggestions: string[] = [];
        for (const key of keys) {
          const diff = suggested[key] - (currentAllocation[key] || 0);
          if (Math.abs(diff) >= 5) {
            const protocol = positions[keys.indexOf(key)].protocol;
            if (diff > 0) {
              suggestions.push(
                `Consider increasing ${protocol} allocation by ~${diff}%`
              );
            } else {
              suggestions.push(
                `Consider reducing ${protocol} allocation by ~${Math.abs(diff)}%`
              );
            }
          }
        }

        if (suggestions.length === 0) {
          suggestions.push(
            "Current allocation is close to optimal for your risk tolerance."
          );
        }

        const zestApy = positions[0].apyPct;
        if (zestApy > 6) {
          suggestions.push(
            `Zest APY is elevated at ${zestApy.toFixed(1)}% — good time to increase lending allocation`
          );
        }
        if (riskLevel !== "high") {
          suggestions.push(
            "ALEX LP carries impermanent loss risk if STX/BTC price diverges significantly"
          );
        }

        return createJsonResponse({
          walletAddress,
          riskTolerance: riskLevel,
          totalValueSats: totalValue,
          currentAllocation,
          suggestedAllocation: suggested,
          suggestions,
          positions: positions.map((p) => ({
            protocol: p.protocol,
            apyPct: p.apyPct,
            riskScore: p.riskScore,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
