/**
 * Zest borrow-helper version verification test
 *
 * Tests on-chain state to confirm which borrow-helper version
 * is approved by the incentives contract, and that the function
 * signatures match.
 *
 * Run: npx tsx tests/zest-helper-version.check.ts
 */

import { contractPrincipalCV, cvToHex } from "@stacks/transactions";

const API = "https://api.mainnet.hiro.so";
const ZEST = "SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N";
const SENDER = "SP4DXVEC16FS6QR7RBKGWZYJKTXPC81W49W0ATJE";

interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: TestResult[] = [];

function log(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}: ${detail}`);
}

async function getInterface(contract: string): Promise<any> {
  const [addr, name] = contract.split(".");
  const res = await fetch(`${API}/v2/contracts/interface/${addr}/${name}`);
  if (!res.ok) return null;
  return res.json();
}

async function checkApproval(helper: string): Promise<boolean> {
  const [addr, name] = helper.split(".");
  const cv = contractPrincipalCV(addr, name);
  const serialized = cvToHex(cv);

  const res = await fetch(
    `${API}/v2/contracts/call-read/${ZEST}/incentives-v2-2/is-approved-contract`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: SENDER,
        arguments: [serialized],
      }),
    }
  );
  const data = await res.json();
  // (ok true) = 0x0703, (err u8000001) = 0x0801...
  return data.result === "0x0703";
}

async function main() {
  console.log("=== Zest Borrow Helper Version Test ===\n");

  // 1. Check which helper versions exist on-chain
  console.log("--- 1. Contract discovery ---");
  const versions = [
    "borrow-helper-v2-1-5",
    "borrow-helper-v2-1-6",
    "borrow-helper-v2-1-7",
    "borrow-helper-v2-1-8",
    "borrow-helper-v2-2",
    "borrow-helper-v2-2-1",
    "borrow-helper-v3",
  ];

  const existingVersions: string[] = [];
  for (const v of versions) {
    const iface = await getInterface(`${ZEST}.${v}`);
    if (iface && iface.functions) {
      existingVersions.push(v);
      log(`Contract exists: ${v}`, true, `${iface.functions.length} functions`);
    }
  }

  // 2. Check which versions are approved by incentives-v2-2
  console.log("\n--- 2. Incentives approval check ---");
  const approvedVersions: string[] = [];
  for (const v of existingVersions) {
    try {
      const approved = await checkApproval(`${ZEST}.${v}`);
      if (approved) approvedVersions.push(v);
      log(
        `incentives-v2-2 approves ${v}`,
        approved,
        approved ? "APPROVED" : "NOT APPROVED"
      );
    } catch (e: any) {
      log(`incentives-v2-2 approves ${v}`, false, `Error: ${e.message}`);
    }
  }

  // 3. Verify the current MCP config value is broken
  console.log("\n--- 3. MCP config verification ---");
  const currentHelper = "borrow-helper-v2-1-5";
  const currentApproved = approvedVersions.includes(currentHelper);
  log(
    `Current MCP helper (${currentHelper}) is approved`,
    false, // We EXPECT this to be false — that's the bug
    currentApproved ? "UNEXPECTED: still valid!" : "Confirmed broken — not approved"
  );

  // 4. Find and validate the recommended fix
  if (approvedVersions.length === 0) {
    log("No approved versions found", false, "Cannot determine fix");
    process.exit(1);
  }

  const recommended = approvedVersions[approvedVersions.length - 1];
  log(`Recommended helper`, true, `${recommended} (newest approved)`);

  // 5. Verify function signature compatibility (drop-in replacement check)
  console.log("\n--- 4. Function signature compatibility ---");
  const oldIface = await getInterface(`${ZEST}.${currentHelper}`);
  const newIface = await getInterface(`${ZEST}.${recommended}`);

  if (!oldIface || !newIface) {
    log("Interface fetch", false, "Could not fetch contract interfaces");
    process.exit(1);
  }

  // Functions the MCP server actually calls
  const mcpFunctions = ["supply", "withdraw", "borrow", "repay", "claim-rewards-to-vault"];
  let allMatch = true;

  for (const fn of mcpFunctions) {
    const oldFn = oldIface.functions.find((f: any) => f.name === fn);
    const newFn = newIface.functions.find((f: any) => f.name === fn);

    if (!oldFn) {
      // Function didn't exist in old version either, skip
      continue;
    }

    if (!newFn) {
      log(`${fn}() in ${recommended}`, false, "MISSING — not a drop-in replacement");
      allMatch = false;
      continue;
    }

    const oldArgs = JSON.stringify(oldFn.args);
    const newArgs = JSON.stringify(newFn.args);
    const match = oldArgs === newArgs;
    if (!match) allMatch = false;
    log(
      `${fn}() signature`,
      match,
      match ? "Identical — compatible" : `MISMATCH\n  Old: ${oldArgs}\n  New: ${newArgs}`
    );
  }

  // 6. Final verdict
  console.log("\n--- 5. Verdict ---");
  if (allMatch && approvedVersions.includes(recommended)) {
    log(
      "Fix verified",
      true,
      `Change ZEST_BORROW_HELPER to ${recommended} — drop-in replacement, approved by incentives`
    );
  } else {
    log(
      "Fix needs review",
      false,
      "Function signatures differ — manual code changes may be needed"
    );
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  const criticalFailures = results.filter(
    (r) => !r.pass && !r.name.includes("Current MCP") && !r.name.startsWith("incentives-v2-2 approves")
  );
  if (criticalFailures.length === 0) {
    console.log(
      `\nAll checks passed. Safe to update:\n` +
      `  ZEST_BORROW_HELPER: "${ZEST}.${currentHelper}"\n` +
      `                   -> "${ZEST}.${recommended}"\n`
    );
    process.exit(0);
  } else {
    console.log(`\n${criticalFailures.length} critical failure(s):`);
    criticalFailures.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Test script failed:", e);
  process.exit(1);
});
