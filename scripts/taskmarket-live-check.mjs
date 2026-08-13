#!/usr/bin/env node
/**
 * Live MCP smoke test for the TaskMarket integration.
 *
 * Boots this repo's MCP server over stdio and calls the TaskMarket tools:
 *   1. taskmarket_search        (read-only, real public API)
 *   2. taskmarket_get           (read-only, real task)
 *   3. taskmarket_submissions   (read-only, human-review surface)
 *   4. taskmarket_stats         (read-only, public stats)
 *   5. taskmarket_preview_create WITHOUT confirm  → MUST refuse, no funds moved
 *   6. taskmarket_preview_create reward > cap     → MUST refuse, no funds moved
 *
 * Run:  node scripts/taskmarket-live-check.mjs   (from repo root)
 * The create tools are never invoked; only the refusal path is proven live.
 */

import { spawn } from "child_process";

const SERVER_CMD = "node";
const SERVER_ARGS = ["dist/index.js"];

const REQUEST_TIMEOUT_MS = 30_000;

class McpClient {
  constructor() {
    this.child = spawn(SERVER_CMD, SERVER_ARGS, {
      stdio: ["pipe", "pipe", "inherit"],
      env: { ...process.env },
    });
    this.buf = "";
    this.nextId = 1;
    this.pending = new Map();
    this.child.stdout.on("data", (chunk) => {
      this.buf += chunk.toString();
      let idx;
      while ((idx = this.buf.indexOf("\n")) !== -1) {
        const line = this.buf.slice(0, idx).trim();
        this.buf = this.buf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        }
      }
    });
  }

  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout waiting for ${method} (${id})`));
        }
      }, REQUEST_TIMEOUT_MS);
    });
  }

  async close() {
    this.child.kill();
    await new Promise((r) => this.child.once("exit", r));
  }
}

function summarize(text) {
  try {
    const obj = JSON.parse(text);
    return JSON.stringify(obj).slice(0, 1200);
  } catch {
    return text.slice(0, 1200);
  }
}

async function main() {
  const client = new McpClient();
  const results = [];
  let failed = 0;

  try {
    // initialize
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "taskmarket-live-check", version: "1.0.0" },
    });

    const list = await client.request("tools/list", {});
    const names = list.tools.map((t) => t.name).filter((n) => n.startsWith("taskmarket"));
    console.log("Registered taskmarket tools:", names.join(", "));
    results.push(["tools/list", `registered: ${names.join(", ")}`, "PASS"]);

    // 1. search (live public API)
    const search = await client.request("tools/call", {
      name: "taskmarket_search",
      arguments: { status: "open", mode: "bounty", limit: 5 },
    });
    const searchText = search.content[0].text;
    const searchParsed = JSON.parse(searchText);
    const ok1 = searchParsed.success === true && searchParsed.taskCount >= 0;
    console.log("\n--- taskmarket_search ---");
    console.log(summarize(searchText));
    results.push(["taskmarket_search", `taskCount=${searchParsed.taskCount}`, ok1 ? "PASS" : "FAIL"]);
    if (!ok1) failed++;

    // 2. get a real task
    let getText = "";
    if (searchParsed.tasks && searchParsed.tasks.length > 0) {
      const taskId = searchParsed.tasks[0].id;
      const get = await client.request("tools/call", {
        name: "taskmarket_get",
        arguments: { taskId },
      });
      getText = get.content[0].text;
      const g = JSON.parse(getText);
      const ok2 = g.success === true && g.id === taskId && typeof g.link === "string";
      console.log("\n--- taskmarket_get ---");
      console.log(summarize(getText));
      results.push(["taskmarket_get", `id=${g.id?.slice(0, 12)} link=${g.link}`, ok2 ? "PASS" : "FAIL"]);
      if (!ok2) failed++;

      // 3. submissions (human-review surface)
      const subs = await client.request("tools/call", {
        name: "taskmarket_submissions",
        arguments: { taskId },
      });
      const subsText = subs.content[0].text;
      const s = JSON.parse(subsText);
      const ok3 = s.success === true && typeof s.submissionCount === "number";
      console.log("\n--- taskmarket_submissions ---");
      console.log(summarize(subsText));
      results.push(["taskmarket_submissions", `count=${s.submissionCount}`, ok3 ? "PASS" : "FAIL"]);
      if (!ok3) failed++;
    }

    // 4. stats
    const stats = await client.request("tools/call", {
      name: "taskmarket_stats",
      arguments: { address: "0xC76a4C9323a7EdE01AcA5A6eB2a37Ae0e1A48b52" },
    });
    const statsText = stats.content[0].text;
    const st = JSON.parse(statsText);
    const ok4 = st.success === true;
    console.log("\n--- taskmarket_stats ---");
    console.log(summarize(statsText));
    results.push(["taskmarket_stats", `success=${st.success}`, ok4 ? "PASS" : "FAIL"]);
    if (!ok4) failed++;

    // 5. REFUSAL without confirmation (must not move funds)
    const refuse = await client.request("tools/call", {
      name: "taskmarket_preview_create",
      arguments: {
        description: "Write a short research brief on Base USDC adoption for AI agents.",
        rewardUsdc: "2",
        durationHours: 24,
        confirm: "",
        maxSpendUsdc: "5",
      },
    });
    const refuseText = refuse.content[0].text;
    const rf = JSON.parse(refuseText);
    const ok5 = rf.success === false && rf.granted === false && /No funds were moved/.test(rf.reason);
    console.log("\n--- taskmarket_preview_create WITHOUT confirm (must refuse) ---");
    console.log(summarize(refuseText));
    results.push(["refusal-no-confirm", `granted=${rf.granted}`, ok5 ? "PASS" : "FAIL"]);
    if (!ok5) failed++;

    // 6. REFUSAL when reward > max-spend
    const cap = await client.request("tools/call", {
      name: "taskmarket_preview_create",
      arguments: {
        description: "Write a short research brief on Base USDC adoption for AI agents.",
        rewardUsdc: "10",
        durationHours: 24,
        confirm: "APPROVE",
        maxSpendUsdc: "5",
      },
    });
    const capText = cap.content[0].text;
    const cf = JSON.parse(capText);
    const ok6 = cf.success === false && cf.granted === false && /exceeds max-spend/.test(cf.reason);
    console.log("\n--- taskmarket_preview_create reward>max-spend (must refuse) ---");
    console.log(summarize(capText));
    results.push(["refusal-over-cap", `granted=${cf.granted}`, ok6 ? "PASS" : "FAIL"]);
    if (!ok6) failed++;
  } catch (err) {
    failed++;
    console.error("Live check error:", err.message);
    results.push(["client-error", err.message, "FAIL"]);
  } finally {
    await client.close();
  }

  console.log("\n==== SUMMARY ====");
  for (const [name, detail, status] of results) {
    console.log(`${status}  ${name}: ${detail}`);
  }
  console.log(failed === 0 ? "\nALL LIVE CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
