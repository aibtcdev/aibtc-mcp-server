/**
 * Test script for Zest V2 collateral-add function
 *
 * Verifies the contract interface and simulates the flow:
 * 1. Check v0-4-market has collateral-add function
 * 2. Check vault get-balance for user's zToken holdings
 * 3. Check user's current position (collateral mask)
 * 4. Dry-run: show what collateral-add would do
 *
 * Run: npx tsx tests/scripts/test-zest-collateral-add.ts
 * Run with wallet: npx tsx tests/scripts/test-zest-collateral-add.ts --execute <amount>
 */

import {
  standardPrincipalCV,
  contractPrincipalCV,
  principalCV,
  uintCV,
  noneCV,
  hexToCV,
  cvToJSON,
  cvToHex,
} from "@stacks/transactions";
import {
  ZEST_ASSETS,
  ZEST_V2_DEPLOYER,
  ZEST_V2_MARKET,
} from "../../src/config/contracts.js";

const API = process.env.API_URL || "https://api.mainnet.hiro.so";
const TEST_ADDRESS =
  process.env.TEST_ADDRESS || "SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE";

const SBTC_VAULT = ZEST_ASSETS.sBTC.vault;
const [VAULT_ADDR, VAULT_NAME] = SBTC_VAULT.split(".");
const DATA_CONTRACT = `${ZEST_V2_DEPLOYER}.v0-1-data`;
const [MARKET_ADDR, MARKET_NAME] = ZEST_V2_MARKET.split(".");

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
  console.log("=== Zest V2 collateral-add Test ===\n");
  console.log(`Market: ${ZEST_V2_MARKET}`);
  console.log(`sBTC Vault: ${SBTC_VAULT}`);
  console.log(`Data: ${DATA_CONTRACT}`);
  console.log(`Test address: ${TEST_ADDRESS}`);
  console.log(`API: ${API}\n`);

  let allPassed = true;

  // Fetch market contract interface once (used by tests 1, 4, 5)
  console.log("Fetching v0-4-market contract interface...");
  const ifaceRes = await fetch(
    `${API}/v2/contracts/interface/${MARKET_ADDR}/${MARKET_NAME}`
  );
  if (!ifaceRes.ok) {
    console.error(`Failed to fetch interface: ${ifaceRes.status}`);
    process.exit(1);
  }
  const iface = await ifaceRes.json();
  console.log("  Done.\n");

  // Test 1: Verify collateral-add exists on v0-4-market
  console.log("--- Test 1: v0-4-market contract interface ---");
  try {
    const functions = iface.functions.map((f: any) => f.name);

    const collateralFns = functions.filter((n: string) =>
      n.includes("collateral")
    );
    console.log("  Collateral-related functions:", collateralFns);

    const hasCollateralAdd = functions.includes("collateral-add");
    console.log(`  collateral-add exists: ${hasCollateralAdd}`);

    if (hasCollateralAdd) {
      const fn = iface.functions.find((f: any) => f.name === "collateral-add");
      console.log(
        "  collateral-add args:",
        fn.args.map((a: any) => `${a.name}: ${JSON.stringify(a.type)}`)
      );
      console.log("  PASS ✓\n");
    } else {
      console.log("  FAIL ✗ — collateral-add not found\n");
      allPassed = false;
    }
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Test 2: Check user zToken balance on vault
  console.log("--- Test 2: vault get-balance (zToken holdings) ---");
  let zTokenBalance = 0n;
  try {
    const senderArg = cvToHex(standardPrincipalCV(TEST_ADDRESS));
    const res = await callReadOnly(
      SBTC_VAULT,
      "get-balance",
      [senderArg],
      VAULT_ADDR
    );
    const decoded = decode(res);
    const balValue = decoded?.value?.value ?? decoded?.value;
    zTokenBalance = balValue ? BigInt(balValue) : 0n;
    console.log(`  zToken balance: ${zTokenBalance}`);
    console.log("  PASS ✓\n");
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Test 3: Check user position via v0-1-data
  console.log("--- Test 3: v0-1-data get-user-position ---");
  try {
    const principalArg = cvToHex(principalCV(TEST_ADDRESS));
    const res = await callReadOnly(
      DATA_CONTRACT,
      "get-user-position",
      [principalArg],
      ZEST_V2_DEPLOYER
    );
    const decoded = decode(res);
    if (decoded) {
      const position = decoded.value ?? decoded;
      // Extract collateral entries
      const collateralList = position?.collateral?.value ?? [];
      const debtList = position?.debt?.value ?? [];
      const healthFactor = position?.["health-factor"]?.value ?? "N/A";
      const mask = position?.mask?.value ?? "N/A";

      console.log(`  Collateral entries: ${collateralList.length}`);
      for (const c of collateralList) {
        const aid = c.value?.aid?.value ?? "?";
        const amount = c.value?.amount?.value ?? "0";
        console.log(`    asset-id: ${aid}, amount: ${amount}`);
      }
      console.log(`  Debt entries: ${debtList.length}`);
      for (const d of debtList) {
        const aid = d.value?.["asset-id"]?.value ?? "?";
        const debt = d.value?.["actual-debt"]?.value ?? "0";
        console.log(`    asset-id: ${aid}, debt: ${debt}`);
      }
      console.log(`  Health factor: ${healthFactor}`);
      console.log(`  Mask: ${mask}`);
      console.log("  PASS ✓\n");
    } else {
      console.log("  No position data (user may have no positions)");
      console.log("  PASS ✓ (empty is valid)\n");
    }
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Test 4: Verify supply-collateral-add also exists (our normal supply flow)
  console.log("--- Test 4: supply-collateral-add exists ---");
  try {
    const fn = iface.functions.find(
      (f: any) => f.name === "supply-collateral-add"
    );
    if (fn) {
      console.log(
        "  Args:",
        fn.args.map((a: any) => `${a.name}: ${JSON.stringify(a.type)}`)
      );
      console.log("  PASS ✓\n");
    } else {
      console.log("  FAIL ✗ — not found\n");
      allPassed = false;
    }
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Test 5: Verify borrow exists and check args
  console.log("--- Test 5: borrow function args ---");
  try {
    const fn = iface.functions.find((f: any) => f.name === "borrow");
    if (fn) {
      console.log(
        "  Args:",
        fn.args.map((a: any) => `${a.name}: ${JSON.stringify(a.type)}`)
      );
      console.log("  PASS ✓\n");
    } else {
      console.log("  FAIL ✗ — not found\n");
      allPassed = false;
    }
  } catch (e) {
    console.log(`  FAIL ✗ — ${e}\n`);
    allPassed = false;
  }

  // Summary
  console.log("=== Summary ===");
  if (allPassed) {
    console.log("All tests passed.");
    console.log(
      "\nV2 collateral-add flow: deposit to vault → collateral-add → borrow"
    );
    console.log(
      "Normal flow (already works): supply-collateral-add → borrow"
    );
    if (zTokenBalance > 0n) {
      console.log(
        `\nUser has ${zTokenBalance} zTokens — could call collateral-add with these.`
      );
    } else {
      console.log(
        "\nUser has 0 zTokens — would need to deposit to vault first."
      );
    }
  } else {
    console.log("Some tests failed. Check output above.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
