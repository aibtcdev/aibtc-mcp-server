/**
 * nonce_heal's RBF fee multiplier is bounded (#746). Without a max, one call
 * could sign a fee many times SPEND_LIMIT_DAILY_USTX (e.g. 3,000 uSTX x 100000
 * = 300 STX). The live bump is also booked on the spend limiter before signing;
 * this file pins the schema bound, which runs before any network or wallet use.
 */

import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { registerNonceTools, MAX_RBF_FEE_MULTIPLIER } from "../../src/tools/nonce.tools.js";

type ToolConfig = { inputSchema?: Record<string, z.ZodTypeAny> | z.ZodTypeAny };

function nonceHealSchema(): z.ZodTypeAny {
  let config: ToolConfig | undefined;
  const server = new McpServer({ name: "test-server", version: "0.0.0" });
  server.registerTool = ((name: string, cfg: ToolConfig) => {
    if (name === "nonce_heal") config = cfg;
  }) as unknown as typeof server.registerTool;
  registerNonceTools(server);
  const schema = config?.inputSchema;
  if (!schema) throw new Error("nonce_heal not registered");
  return schema instanceof z.ZodType ? schema : z.object(schema);
}

describe("nonce_heal feeMultiplier bound (#746)", () => {
  const schema = nonceHealSchema();

  it("caps the multiplier at a small value", () => {
    expect(MAX_RBF_FEE_MULTIPLIER).toBe(5);
  });

  it("rejects a multiplier above the cap", () => {
    expect(schema.safeParse({ feeMultiplier: 100000 }).success).toBe(false);
    expect(schema.safeParse({ feeMultiplier: MAX_RBF_FEE_MULTIPLIER + 0.01 }).success).toBe(false);
  });

  it("accepts the default, the minimum and the cap", () => {
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ feeMultiplier: 1.1 }).success).toBe(true);
    expect(schema.safeParse({ feeMultiplier: MAX_RBF_FEE_MULTIPLIER }).success).toBe(true);
  });
});
