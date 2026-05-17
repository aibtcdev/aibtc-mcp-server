import { describe, expect, it, vi } from "vitest";
import { registerAllTools } from "../../src/tools/index.js";

interface ToolRegistration {
  name: string;
  description: string;
  inputSchema: unknown;
}

function createTrackingServer() {
  const tools = new Map<string, ToolRegistration>();
  const server = {
    registerTool: vi.fn(
      (name: string, config: { description: string; inputSchema: unknown }, _handler: unknown) => {
        tools.set(name, { name, description: config.description, inputSchema: config.inputSchema });
      }
    ),
  };

  return { server, tools };
}

describe("native bounty tool registration", () => {
  it("registers native AIBTC bounty read tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any);

    for (const name of [
      "bounty_list_native",
      "bounty_get_native",
      "bounty_submissions_native",
      "bounty_submission_native",
      "bounty_my_posted",
      "bounty_my_submissions",
    ]) {
      expect(tools.has(name), `expected '${name}' to be registered`).toBe(true);
    }
  });

  it("registers native AIBTC bounty signed write tools", () => {
    const { server, tools } = createTrackingServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerAllTools(server as any);

    for (const name of [
      "bounty_create_native",
      "bounty_submit_native",
      "bounty_accept_native",
      "bounty_paid_native",
      "bounty_cancel_native",
    ]) {
      expect(tools.has(name), `expected '${name}' to be registered`).toBe(true);
      expect(tools.get(name)?.description).toContain("AIBTC");
    }
  });
});
