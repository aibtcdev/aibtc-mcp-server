/**
 * Test script for yield-dashboard Zest V2 read-only calls
 *
 * Verifies the three on-chain calls used by readZestPosition():
 * 1. v0-vault-sbtc get-interest-rate  — APY
 * 2. v0-vault-sbtc get-balance        — user zToken shares
 * 3. v0-vault-sbtc convert-to-assets  — shares → underlying sBTC
 *
 * Run: npx tsx tests/scripts/test-yield-dashboard-zest.ts
 */

import {
  standardPrincipalCV,
  uintCV,
  hexToCV,
  cvToJSON,
  cvToHex,
} from "@stacks/transactions";
import { ZEST_ASSETS, ZEST_V2_DEPLOYER } from "../../src/config/contracts.js";

const API = process.env.API_URL || "https://api.mainnet.hiro.so";
const TEST_ADDRESS =
  process.env.TEST_ADDRESS || "SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE";

const SBTC_VAULT = ZEST_ASSETS.sBTC.vault;
const [VAULT_ADDR, VAULT_NAME] = SBTC_VAULT.split(".");

async function callReadOnly(
  contractId: string,
  functionName: string,
  args: string[],
  sender: string
): Promise<any> {
  const [addr, name] = contractId.split(".");
  const url = `${API}/v2/contracts/call-read/${addr}/${name}/${functionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender, arguments: args }),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json();
}

function decode(result: any): any {
  if (!result.okay || !result.result) return null;
  return cvToJSON(hexToCV(result.result));
}

async function main() {
  console.log("=== Yield Dashboard Zest V2 Test ===\n");
  console.log(`Vault: ${SBTC_VAULT}`);
  console.log(`Test address: ${TEST_ADDRESS}`);
  console.log(`API: ${API}\n`);

  let allPassed = true;

  // Test 1: get-interest-rate
  console.log("--- Test 1: get-interest-rate ---");
  try {
    const res = await callReadOnly(SBTC_VAULT, "get-interest-rate", [], VAULT_ADDR);
    const decoded = decode(res);
    const rateValue = decoded?.value?.value ?? decoded?.value;
    console.log("  Raw result:", JSON.stringify(decoded));
    if (rateValue) {
      const rateBigInt = BigInt(rateValue);
      const apyPct = Number(rateBigInt) / 1e8 * 100;
      console.log(`  Rate (raw): ${rateBigInt}`);
      console.log(`  APY: ${apyPct.toFixed(4)}%`);
      console.log("  PASS ✓\n");
    } else {
      console.log("  FAIL ✗ — no rate value returned\n");
      allPassed = false;
    }
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Test 2: get-balance
  console.log("--- Test 2: get-balance ---");
  let zTokenShares = 0n;
  try {
    const senderArg = cvToHex(standardPrincipalCV(TEST_ADDRESS));
    const res = await callReadOnly(SBTC_VAULT, "get-balance", [senderArg], VAULT_ADDR);
    const decoded = decode(res);
    const balValue = decoded?.value?.value ?? decoded?.value;
    console.log("  Raw result:", JSON.stringify(decoded));
    if (balValue !== undefined && balValue !== null) {
      zTokenShares = BigInt(balValue);
      console.log(`  zToken shares: ${zTokenShares}`);
      console.log("  PASS ✓\n");
    } else {
      console.log("  FAIL ✗ — no balance value returned\n");
      allPassed = false;
    }
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Test 3: convert-to-assets
  console.log("--- Test 3: convert-to-assets ---");
  // Use a known amount if the test address has no balance
  const sharesToConvert = zTokenShares > 0n ? zTokenShares : 100_000n;
  try {
    const sharesArg = cvToHex(uintCV(sharesToConvert));
    const res = await callReadOnly(
      SBTC_VAULT,
      "convert-to-assets",
      [sharesArg],
      VAULT_ADDR
    );
    const decoded = decode(res);
    const underlyingValue = decoded?.value?.value ?? decoded?.value;
    console.log("  Raw result:", JSON.stringify(decoded));
    if (underlyingValue !== undefined && underlyingValue !== null) {
      const underlying = BigInt(underlyingValue);
      console.log(`  Input shares: ${sharesToConvert}`);
      console.log(`  Underlying sBTC (sats): ${underlying}`);
      if (underlying >= sharesToConvert) {
        console.log(`  Ratio: ${Number(underlying) / Number(sharesToConvert)}x (shares accrue value over time)`);
      }
      console.log("  PASS ✓\n");
    } else {
      console.log("  FAIL ✗ — no underlying value returned\n");
      allPassed = false;
    }
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Bonus: Test v0-1-data get-protocol-summary (used by data helper)
  console.log("--- Bonus: v0-1-data get-protocol-summary ---");
  try {
    const dataContract = `${ZEST_V2_DEPLOYER}.v0-1-data`;
    const res = await callReadOnly(dataContract, "get-protocol-summary", [], ZEST_V2_DEPLOYER);
    const decoded = decode(res);
    console.log("  Raw result (truncated):", JSON.stringify(decoded)?.slice(0, 500));
    console.log("  PASS ✓\n");
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Summary
  console.log("=== Summary ===");
  if (allPassed) {
    console.log("All tests passed. V2 calls are working correctly.");
  } else {
    console.log("Some tests failed. Check output above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
