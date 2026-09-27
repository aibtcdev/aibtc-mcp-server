/**
 * MCP tool registration smoke test.
 *
 * Verifies that every tool file registers tools without throwing, and that
 * each registered tool has the required MCP fields: name, description, and
 * inputSchema. Catches wiring bugs (wrong export, undefined server method,
 * malformed schema) at CI time before deployment.
 */
import { describe, it, expect, vi } from "vitest";
import { registerAllTools } from "../../src/tools/index.js";
import { ALL_TOOLS } from "../../src/tools/profiles.js";

interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: unknown;
}

function createTrackingServer() {
  const tools = new Map<string, ToolRegistration>();

  // Minimal McpServer stand-in: only `registerTool` is needed for registration smoke tests.
  const server = {
    registerTool: vi.fn(
      (name: string, config: { description: string; inputSchema: unknown }, _handler: unknown) => {
        tools.set(name, { name, description: config.description, inputSchema: config.inputSchema });
      }
    ),
  };

  return { server, tools };
}

describe("tool registration smoke test", () => {
  it("registerAllTools does not throw", () => {
    const { server } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => registerAllTools(server as any, ALL_TOOLS)).not.toThrow();
  });

  it("registers at least 30 tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any, ALL_TOOLS);
    expect(tools.size).toBeGreaterThanOrEqual(30);
  });

  it("every registered tool has a non-empty description", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any, ALL_TOOLS);

    for (const [name, tool] of tools) {
      expect(tool.description, `tool '${name}' missing description`).toBeTruthy();
      expect(
        typeof tool.description,
        `tool '${name}' description should be a string`
      ).toBe("string");
    }
  });

  it("every tool with an inputSchema has it as an object", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any, ALL_TOOLS);

    for (const [name, tool] of tools) {
      if (tool.inputSchema !== undefined) {
        expect(
          typeof tool.inputSchema,
          `tool '${name}' inputSchema should be an object`
        ).toBe("object");
      }
    }
  });

  it("registers core wallet tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any, ALL_TOOLS);

    const coreTools = ["get_wallet_info", "get_stx_balance"];
    for (const name of coreTools) {
      expect(tools.has(name), `expected core tool '${name}' to be registered`).toBe(true);
    }
  });

  it("registers core wallet management tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any, ALL_TOOLS);

    const mgmtTools = [
      "wallet_create",
      "wallet_import",
      "wallet_unlock",
      "wallet_lock",
      "wallet_list",
    ];
    for (const name of mgmtTools) {
      expect(tools.has(name), `expected wallet management tool '${name}' to be registered`).toBe(
        true
      );
    }
  });

  it("registers sBTC tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any, ALL_TOOLS);

    const sbtcTools = ["sbtc_get_balance"];
    for (const name of sbtcTools) {
      expect(tools.has(name), `expected sBTC tool '${name}' to be registered`).toBe(true);
    }
  });

  it("no two tools share the same name", () => {
    const names: string[] = [];

    const server = {
      registerTool: vi.fn((name: string) => {
        names.push(name);
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any, ALL_TOOLS);

    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});
