import { describe, it, expect } from "vitest";
import { registerNewsTools } from "../../src/tools/news.tools.js";

type Handler = () => Promise<{ content: Array<{ type: string; text: string }> }>;

function registeredTools() {
  const tools = new Map<string, { description: string; handler: Handler }>();
  const server = {
    registerTool(name: string, config: { description: string }, handler: Handler) {
      tools.set(name, { description: config.description, handler });
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerNewsTools(server as any);
  return tools;
}

describe("deprecated news tools", () => {
  it("keeps all 17 news tool names registered", () => {
    expect(registeredTools().size).toBe(17);
  });

  it("marks every tool deprecated and points at the legion tools", async () => {
    for (const [name, tool] of registeredTools()) {
      expect(tool.description, name).toMatch(/^⛔ DEPRECATED/);
      const body = JSON.parse((await tool.handler()).content[0].text);
      expect(body.success, name).toBe(false);
      expect(body.deprecated, name).toBe(true);
      expect(body.error, name).toContain(name);
      expect(body.useInstead.length, name).toBeGreaterThan(0);
      for (const replacement of body.useInstead) {
        expect(replacement, name).toMatch(/^legion_/);
      }
    }
  });
});
