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
  cvToJSON,
} from "@stacks/transactions";
import { NETWORK, getWalletAddress } from "../services/x402.service.js";
import { getHiroApi } from "../services/hiro-api.js";
import { ZEST_ASSETS, ZEST_V2_DEPLOYER } from "../config/contracts.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// ============================================================================
// Constants
// ============================================================================

// Zest V2 contracts
const ZEST_DATA_CONTRACT = `${ZEST_V2_DEPLOYER}.v0-1-data`;
const ZEST_SBTC_VAULT = ZEST_ASSETS.sBTC.vault;

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
    const [vaultAddr] = ZEST_SBTC_VAULT.split(".");

    // Fetch APY from vault get-interest-rate (V2)
    try {
      const rateRes = await hiro.callReadOnlyFunction(
        ZEST_SBTC_VAULT,
        "get-interest-rate",
        [],
        vaultAddr
      );
      if (rateRes.okay && rateRes.result) {
        const decoded = cvToJSON(hexToCV(rateRes.result));
        const rateValue = decoded?.value?.value ?? decoded?.value;
        if (rateValue) {
          // V2 vault returns rate in 1e8 scale; convert to percentage
          const rateBigInt = BigInt(rateValue);
          pos.apyPct = Number(rateBigInt) / 1e8 * 100;
        }
      }
    } catch {
      // APY fetch failed — continue with 0
    }

    // Fetch user zToken balance from vault get-balance (V2)
    try {
      const balRes = await hiro.callReadOnlyFunction(
        ZEST_SBTC_VAULT,
        "get-balance",
        [standardPrincipalCV(walletAddress)],
        vaultAddr
      );
      if (balRes.okay && balRes.result) {
        const decoded = cvToJSON(hexToCV(balRes.result));
        const balValue = decoded?.value?.value ?? decoded?.value;
        if (balValue) {
          const zTokenShares = BigInt(balValue);
          // Convert zToken shares to underlying sBTC amount
          if (zTokenShares > 0n) {
            const convertRes = await hiro.callReadOnlyFunction(
              ZEST_SBTC_VAULT,
              "convert-to-assets",
              [uintCV(zTokenShares)],
              vaultAddr
            );
            if (convertRes.okay && convertRes.result) {
              const convDecoded = cvToJSON(hexToCV(convertRes.result));
              const underlyingValue = convDecoded?.value?.value ?? convDecoded?.value;
              if (underlyingValue) {
                pos.valueSats = Number(BigInt(underlyingValue));
              }
            }
            pos.details.zTokenShares = zTokenShares.toString();
          }
        }
      }
    } catch {
      // Position read failed — APY still valid
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
    const hiro = getHiroApi("mainnet");
    const data = await hiro.getAccountBalances(walletAddress);
    const stxMicroStx = parseInt((data as any).stx?.balance ?? "0", 10);
    const fungibleTokens = (data as any).fungible_tokens as Record<string, { balance?: string }> | undefined;
    const sbtcKey = Object.keys(fungibleTokens ?? {}).find((k) =>
      k.toLowerCase().includes("sbtc")
    );
    const sbtcSats = sbtcKey
      ? parseInt(fungibleTokens?.[sbtcKey]?.balance ?? "0", 10)
      : 0;
    return { stxMicroStx, sbtcSats };
  } catch {
    return { stxMicroStx: 0, sbtcSats: 0 };
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

        const [zest, alex, bitflow, stacking, balances] = await Promise.all([
          readZestPosition(walletAddress),
          readAlexPosition(walletAddress),
          readBitflowPosition(walletAddress),
          readStackingPosition(walletAddress),
          getWalletBalances(walletAddress),
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
- Zest Protocol: on-chain V2 vault interest rate (v0-vault-sbtc get-interest-rate)
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

        const [zest, alex, bitflow] = await Promise.all([
          readZestPosition(dummyAddress),
          readAlexPosition(dummyAddress),
          readBitflowPosition(dummyAddress),
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

        // Separate sats (Zest, ALEX, Bitflow) from microSTX (Stacking) — different units
        const satsPositions = positions.filter((p) => p.valueUnit === "sats");
        const stxPositions = positions.filter((p) => p.valueUnit === "microSTX");
        const totalValueSats = satsPositions.reduce((s, p) => s + p.valueSats, 0);
        const totalValueMicroStx = stxPositions.reduce((s, p) => s + p.valueSats, 0);

        const keys = ["zest", "alex", "bitflow"];
        const currentAllocation: Record<string, number> = {};
        satsPositions.forEach((p, i) => {
          currentAllocation[keys[i]] =
            totalValueSats > 0 ? Math.round((p.valueSats / totalValueSats) * 100) : 0;
        });
        // STX stacking is a different unit — not directly comparable to sats positions
        currentAllocation["stacking"] = 0;

        const targets: Record<string, Record<string, number>> = {
          low: { zest: 40, alex: 10, bitflow: 10, stacking: 40 },
          medium: { zest: 45, alex: 20, bitflow: 15, stacking: 20 },
          high: { zest: 50, alex: 30, bitflow: 20, stacking: 0 },
        };
        const riskLevel = riskTolerance;
        const suggested = targets[riskLevel];

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
          totalValueSats,
          totalValueBtc: formatBtc(totalValueSats),
          totalValueMicroStx,
          totalValueStx: totalValueMicroStx / 1_000_000,
          note: "Allocation percentages are based on sats-denominated positions only. STX stacking is shown separately (different unit).",
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
