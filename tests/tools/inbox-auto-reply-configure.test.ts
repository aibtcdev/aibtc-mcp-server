import { beforeEach, describe, expect, it, vi } from "vitest";

let stored: Record<string, unknown> = {};
const writeAppConfig = vi.fn(async (config: Record<string, unknown>) => {
  stored = config;
});

vi.mock("../../src/utils/storage.js", () => ({
  readAppConfig: async () => structuredClone(stored),
  writeAppConfig: (config: Record<string, unknown>) => writeAppConfig(config),
}));

const { registerInboxAutoReplyTools } = await import("../../src/tools/inbox-auto-reply.tools.js");

type Handler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

function configureTool() {
  let tool: { schema: { shape: Record<string, unknown> }; handler: Handler } | undefined;
  const server = {
    registerTool(name: string, config: { inputSchema: { shape: Record<string, unknown> } }, handler: Handler) {
      if (name === "inbox_auto_reply_configure") tool = { schema: config.inputSchema, handler };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerInboxAutoReplyTools(server as any);
  return tool!;
}

describe("inbox_auto_reply_configure", () => {
  beforeEach(() => {
    stored = { version: 1, activeWalletId: null, autoLockTimeout: 15 };
    writeAppConfig.mockClear();
  });

  it("takes no sat limit from the model", () => {
    expect(Object.keys(configureTool().schema.shape).sort()).toEqual(["enabled", "model", "systemPrompt"]);
  });

  it("writes the default limits on first configure", async () => {
    await configureTool().handler({ systemPrompt: "You are a test agent." });
    expect(stored.inboxAutoReply).toMatchObject({ dailyCapSats: 1000, maxSatsPerReply: 10 });
  });

  it("keeps the operator's limits when other settings change", async () => {
    stored.inboxAutoReply = {
      enabled: false,
      model: "meta-llama/Llama-3.1-8B-Instruct",
      systemPrompt: "old",
      dailyCapSats: 50,
      maxSatsPerReply: 2,
    };
    await configureTool().handler({ systemPrompt: "new", enabled: true, dailyCapSats: 1e9, maxSatsPerReply: 1e9 });
    expect(stored.inboxAutoReply).toMatchObject({ systemPrompt: "new", enabled: true, dailyCapSats: 50, maxSatsPerReply: 2 });
  });
});
