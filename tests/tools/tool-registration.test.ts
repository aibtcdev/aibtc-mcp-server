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
    expect(() => registerAllTools(server as any)).not.toThrow();
  });

  it("registers at least 30 tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any);
    expect(tools.size).toBeGreaterThanOrEqual(30);
  });

  it("every registered tool has a non-empty description", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any);

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
    registerAllTools(server as any);

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
    registerAllTools(server as any);

    const coreTools = ["get_wallet_info", "get_stx_balance"];
    for (const name of coreTools) {
      expect(tools.has(name), `expected core tool '${name}' to be registered`).toBe(true);
    }
  });

  it("registers core wallet management tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any);

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
    registerAllTools(server as any);

    const sbtcTools = ["sbtc_get_balance"];
    for (const name of sbtcTools) {
      expect(tools.has(name), `expected sBTC tool '${name}' to be registered`).toBe(true);
    }
  });

  it("registers native AIBTC bounty tools with pagination inputs", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any);

    const bountyTools = [
      "bounty_list",
      "bounty_get",
      "bounty_submissions",
      "bounty_create",
      "bounty_submit",
      "bounty_accept",
      "bounty_paid",
      "bounty_cancel",
      "bounty_my_posted",
      "bounty_my_submissions",
    ];

    for (const name of bountyTools) {
      expect(tools.has(name), `expected bounty tool '${name}' to be registered`).toBe(true);
    }

    for (const name of ["bounty_my_posted", "bounty_my_submissions"]) {
      expect(Object.keys(tools.get(name)?.inputSchema as Record<string, unknown>)).toEqual([
        "btc_address",
        "status",
        "include_terminal",
        "limit",
        "offset",
      ]);
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
    registerAllTools(server as any);

    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});
