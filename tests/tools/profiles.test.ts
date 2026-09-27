import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/server";
import { registerAllTools } from "../../src/tools/index.js";
import {
  ALL_TOOLS,
  CORE_TOOLS,
  TOOL_GROUPS,
  resolveToolSelection,
  type ToolSelection,
} from "../../src/tools/profiles.js";

function registeredNames(selection: ToolSelection): string[] {
  const names: string[] = [];
  const server = new McpServer({ name: "test", version: "0.0.0" });
  server.registerTool = ((name: string) => {
    names.push(name);
  }) as typeof server.registerTool;
  registerAllTools(server, selection);
  return names;
}

describe("tool profiles", () => {
  it("AIBTC_TOOLS=core and --profile lean register exactly the core set", () => {
    for (const selection of [
      resolveToolSelection([], { AIBTC_TOOLS: "core" }),
      resolveToolSelection(["--profile", "lean"], {}),
    ]) {
      expect(new Set(registeredNames(selection))).toEqual(new Set(CORE_TOOLS));
    }
  });

  it("an unset AIBTC_TOOLS (pre-profile configs) loads every tool", () => {
    expect(resolveToolSelection([], {})).toEqual(ALL_TOOLS);
  });

  it("core plus a group loads the same as the group alone", () => {
    expect(registeredNames(resolveToolSelection([], { AIBTC_TOOLS: "core,defi" }))).toEqual(
      registeredNames(resolveToolSelection([], { AIBTC_TOOLS: "defi" }))
    );
  });

  it("every core tool exists in the full surface", () => {
    const all = new Set(registeredNames(ALL_TOOLS));
    expect([...CORE_TOOLS].filter((n) => !all.has(n))).toEqual([]);
  });

  it("every group adds tools beyond the core set", () => {
    for (const group of Object.keys(TOOL_GROUPS)) {
      const names = registeredNames(resolveToolSelection([], { AIBTC_TOOLS: group }));
      expect(names.length, group).toBeGreaterThan(CORE_TOOLS.size);
    }
  });

  it("all groups together equal the full surface", () => {
    const every = Object.keys(TOOL_GROUPS).join(",");
    const grouped = registeredNames(resolveToolSelection([], { AIBTC_TOOLS: every }));
    expect(grouped).toEqual(registeredNames(ALL_TOOLS));
  });

  it("resolves --profile full and AIBTC_TOOLS=all to everything", () => {
    expect(resolveToolSelection(["node", "x", "--profile", "full"], {})).toEqual(ALL_TOOLS);
    expect(resolveToolSelection([], { AIBTC_TOOLS: "ALL" })).toEqual(ALL_TOOLS);
  });

  it("rejects unknown groups and profiles", () => {
    expect(() => resolveToolSelection([], { AIBTC_TOOLS: "defi,nope" })).toThrow(/nope/);
    expect(() => resolveToolSelection(["--profile", "huge"], {})).toThrow(/huge/);
  });
});
