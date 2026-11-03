import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  let tool: { schema: { shape: Record<string, unknown>; safeParse: (v: unknown) => { success: boolean } }; handler: Handler } | undefined;
  const server = {
    registerTool(name: string, config: { inputSchema: { shape: Record<string, unknown>; safeParse: (v: unknown) => { success: boolean } } }, handler: Handler) {
      if (name === "inbox_auto_reply_configure") tool = { schema: config.inputSchema, handler };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerInboxAutoReplyTools(server as any);
  return tool!;
}

function json(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe("inbox_auto_reply_configure", () => {
  beforeEach(() => {
    stored = { version: 1, activeWalletId: null, autoLockTimeout: 15 };
    writeAppConfig.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("takes no sat limit from the model", () => {
    const { schema } = configureTool();
    expect(Object.keys(schema.shape).sort()).toEqual(["enabled", "model", "systemPrompt"]);
    expect(schema.safeParse({ dailyCapSats: 50 }).success).toBe(false);
    expect(schema.safeParse({ maxSatsPerReply: 1e9 }).success).toBe(false);
  });

  it("reports the default limits and stores none", async () => {
    const result = json(await configureTool().handler({ systemPrompt: "You are a test agent." }));
    expect(result.limits).toEqual({ dailyCapSats: 1000, maxSatsPerReply: 10 });
    expect(stored.inboxAutoReply).not.toHaveProperty("dailyCapSats");
  });

  it("takes the limits from the env, not the config file", async () => {
    vi.stubEnv("INBOX_AUTO_REPLY_DAILY_CAP_SATS", "50");
    vi.stubEnv("INBOX_AUTO_REPLY_MAX_SATS_PER_REPLY", "2");
    stored.inboxAutoReply = { enabled: false, model: "m", systemPrompt: "old", dailyCapSats: 1e9, maxSatsPerReply: 1e9 };
    expect(json(await configureTool().handler({})).limits).toEqual({ dailyCapSats: 50, maxSatsPerReply: 2 });
  });

  it("rejects a bad env value", async () => {
    vi.stubEnv("INBOX_AUTO_REPLY_DAILY_CAP_SATS", "-1");
    const result = await configureTool().handler({});
    expect(result.content[0].text).toMatch(/INBOX_AUTO_REPLY_DAILY_CAP_SATS must be a non-negative integer/);
  });
});
