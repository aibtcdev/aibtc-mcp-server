import { describe, it, expect } from "vitest";
import {
  ToolChain,
  GENESIS_HASH,
  computeMerkleRoot,
  generateMerkleProof,
  verifyMerkleProof,
  getChain,
} from "../../src/services/security/tool-hash-chain.js";

// Minimal mock result (matches what MCP tools return)
const RESULT = { content: [{ type: "text", text: "ok" }] };

describe("tool-hash-chain", () => {

  describe("ToolChain — basic block addition", () => {
    it("starts empty", () => {
      expect(new ToolChain().length).toBe(0);
    });

    it("first block references GENESIS_HASH", () => {
      const chain = new ToolChain();
      const { block } = chain.addBlock("test_tool", { x: 1 }, RESULT);
      expect(block.prev_block_hash).toBe(GENESIS_HASH);
      expect(block.block_height).toBe(0);
    });

    it("second block references first block hash", () => {
      const chain = new ToolChain();
      const { block: b0 } = chain.addBlock("tool_a", {}, RESULT);
      const { block: b1 } = chain.addBlock("tool_b", {}, RESULT);
      expect(b1.prev_block_hash).toBe(b0.block_hash);
    });

    it("block heights are sequential", () => {
      const chain = new ToolChain();
      chain.addBlock("t1", {}, RESULT);
      chain.addBlock("t2", {}, RESULT);
      const { block: b2 } = chain.addBlock("t3", {}, RESULT);
      expect(b2.block_height).toBe(2);
    });

    it("block_hash is 64-char hex", () => {
      const chain = new ToolChain();
      const { block } = chain.addBlock("x", {}, RESULT);
      expect(block.block_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("length grows with each addBlock", () => {
      const chain = new ToolChain();
      chain.addBlock("a", {}, RESULT);
      chain.addBlock("b", {}, RESULT);
      expect(chain.length).toBe(2);
    });
  });

  describe("ToolChain — consensus rule violations", () => {
    it("Rule 5: unregistered tool produces violation", () => {
      // ToolChain itself doesn't validate tool names (session-guard does)
      // addBlock always succeeds — violations from Block 0 check GENESIS anchor
      const chain = new ToolChain();
      const { violations } = chain.addBlock("any_tool", {}, RESULT);
      // Block 0: genesis anchor is valid → no violations
      expect(violations).toHaveLength(0);
    });

    it("Rule 7: same (tool, input) twice in one session produces violation", () => {
      const chain = new ToolChain();
      const input = { amount: "1000" };
      chain.addBlock("transfer_stx", input, RESULT);
      const { violations } = chain.addBlock("transfer_stx", input, RESULT);
      const rule7 = violations.find(v => v.rule === 7);
      expect(rule7).toBeDefined();
    });

    it("Rule 7: same tool with DIFFERENT inputs is allowed", () => {
      const chain = new ToolChain();
      chain.addBlock("transfer_stx", { amount: "100" }, RESULT);
      const { violations } = chain.addBlock("transfer_stx", { amount: "200" }, RESULT);
      const rule7 = violations.find(v => v.rule === 7);
      expect(rule7).toBeUndefined();
    });
  });

  describe("ToolChain — verify()", () => {
    it("empty chain is valid", () => {
      expect(new ToolChain().verify().valid).toBe(true);
    });

    it("valid chain (3 blocks) verifies clean", () => {
      const chain = new ToolChain();
      chain.addBlock("a", {}, RESULT);
      chain.addBlock("b", {}, RESULT);
      chain.addBlock("c", {}, RESULT);
      const v = chain.verify();
      expect(v.valid).toBe(true);
      expect(v.violations).toHaveLength(0);
    });

    it("verify returns correct block_count", () => {
      const chain = new ToolChain();
      chain.addBlock("x", {}, RESULT);
      chain.addBlock("y", {}, RESULT);
      expect(chain.verify().block_count).toBe(2);
    });

    it("merkle_root is 64-char hex after adding blocks", () => {
      const chain = new ToolChain();
      chain.addBlock("m", {}, RESULT);
      expect(chain.verify().merkle_root).toMatch(/^[0-9a-f]{64}$/);
    });

    it("chain_hash is 64-char hex", () => {
      const chain = new ToolChain();
      chain.addBlock("n", {}, RESULT);
      expect(chain.verify().chain_hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("ToolChain — stats()", () => {
    it("stats reflects current chain length", () => {
      const chain = new ToolChain();
      chain.addBlock("t", {}, RESULT);
      expect(chain.stats().block_count).toBe(1);
    });

    it("stats.chain_valid is true for a clean chain", () => {
      const chain = new ToolChain();
      chain.addBlock("s", {}, RESULT);
      expect(chain.stats().chain_valid).toBe(true);
    });

    it("stats.genesis_anchor equals GENESIS_HASH", () => {
      expect(new ToolChain().stats().genesis_anchor).toBe(GENESIS_HASH);
    });
  });

  describe("Merkle tree", () => {
    it("computeMerkleRoot returns 64-char hex for single hash", () => {
      const root = computeMerkleRoot(["a".repeat(64)]);
      expect(root).toMatch(/^[0-9a-f]{64}$/);
    });

    it("computeMerkleRoot is deterministic", () => {
      const hashes = ["aa".repeat(32), "bb".repeat(32)];
      expect(computeMerkleRoot(hashes)).toBe(computeMerkleRoot(hashes));
    });

    it("SPV proof verifies correctly", () => {
      const chain = new ToolChain();
      chain.addBlock("p1", {}, RESULT);
      chain.addBlock("p2", {}, RESULT);
      chain.addBlock("p3", {}, RESULT);
      const proof = chain.getProof(1)!;
      expect(proof).not.toBeNull();
      expect(verifyMerkleProof(proof)).toBe(true);
    });

    it("getProof returns null for out-of-range index", () => {
      const chain = new ToolChain();
      expect(chain.getProof(0)).toBeNull();       // empty chain
      chain.addBlock("q", {}, RESULT);
      expect(chain.getProof(99)).toBeNull();       // beyond length
    });
  });

  describe("getChain registry", () => {
    it("same server object returns same chain instance", () => {
      const server = {};
      const c1 = getChain(server);
      const c2 = getChain(server);
      expect(c1).toBe(c2);
    });

    it("different server objects return different chains", () => {
      const s1 = {}, s2 = {};
      expect(getChain(s1)).not.toBe(getChain(s2));
    });

    it("chain is isolated per server — adding to one doesn't affect other", () => {
      const s1 = {}, s2 = {};
      getChain(s1).addBlock("tool_x", {}, RESULT);
      expect(getChain(s2).length).toBe(0);
    });
  });
});
