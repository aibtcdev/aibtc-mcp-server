/**
 * Smoke test: verify all MCP tools register without errors.
 *
 * Catches duplicate tool names, missing imports, and registration-time
 * exceptions before they reach production.
 */

import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "../../src/tools/index.js";
import { ALL_TOOLS } from "../../src/tools/profiles.js";

describe("registerAllTools", () => {
  it("registers all tools without throwing", () => {
    const server = new McpServer({
      name: "test-server",
      version: "0.0.0",
    });

    expect(() => registerAllTools(server, ALL_TOOLS)).not.toThrow();
  });

  it("registers no duplicate tool names", () => {
    const registered: string[] = [];
    const server = new McpServer({
      name: "test-server",
      version: "0.0.0",
    });

    // Replace registerTool with a stub that only records names.
    // Calling the real method would throw on the first duplicate,
    // hiding any subsequent collisions.
    server.registerTool = ((name: string) => {
      registered.push(name);
    }) as typeof server.registerTool;

    registerAllTools(server, ALL_TOOLS);

    const duplicates = registered.filter(
      (name, i) => registered.indexOf(name) !== i
    );
    expect(duplicates).toEqual([]);
    // Sanity check: ensure we actually collected tool names
    expect(registered.length).toBeGreaterThanOrEqual(50);
  });
});
