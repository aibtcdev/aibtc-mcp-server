import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const { InvalidPasswordError } = await import("../../src/utils/errors.js");

const unlock = vi.fn(async (_id: string, _pw: string): Promise<Record<string, string>> => ({
  address: "SP000000000000000000002Q6VF78",
  btcAddress: "bc1qtest",
  taprootAddress: "bc1ptest",
  network: "mainnet",
}));

vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({ getActiveWalletId: async () => "w1", unlock }),
}));

const { resolveWalletPassword, walletUnlockHint } = await import("../../src/utils/wallet-password.js");
const { registerWalletManagementTools } = await import("../../src/tools/wallet-management.tools.js");

type Handler = (args: Record<string, unknown>) => Promise<{ isError?: boolean; content: Array<{ text: string }> }>;

function unlockTool() {
  let tool: { schema: { safeParse: (v: unknown) => { success: boolean } }; handler: Handler } | undefined;
  const server = {
    registerTool(name: string, config: { inputSchema: { safeParse: (v: unknown) => { success: boolean } } }, handler: Handler) {
      if (name === "wallet_unlock") tool = { schema: config.inputSchema, handler };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerWalletManagementTools(server as any);
  return tool!;
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "wallet-pw-"));
  vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", "");
  vi.stubEnv("AIBTC_WALLET_PASSWORD", "");
  unlock.mockClear();
  unlock.mockImplementation(async () => ({
    address: "SP000000000000000000002Q6VF78",
    btcAddress: "bc1qtest",
    taprootAddress: "bc1ptest",
    network: "mainnet",
  }));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe("resolveWalletPassword", () => {
  it("uses the argument when given, ignoring the environment", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    expect(await resolveWalletPassword("from-arg")).toEqual({ password: "from-arg", source: "argument" });
  });

  it("reads the file and strips one trailing newline only", async () => {
    const file = join(dir, "pw");
    await writeFile(file, " pass word \n");
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", file);
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    expect((await resolveWalletPassword(undefined)).password).toBe(" pass word ");
  });

  it("strips a CRLF ending", async () => {
    const file = join(dir, "pw");
    await writeFile(file, "secret\r\n");
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", file);
    expect((await resolveWalletPassword(undefined)).password).toBe("secret");
  });

  it("fails on an unreadable file instead of falling back to the env var", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", join(dir, "missing"));
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    await expect(resolveWalletPassword(undefined)).rejects.toThrow(/ENOENT/);
  });

  it("fails on an empty file", async () => {
    const file = join(dir, "pw");
    await writeFile(file, "\n");
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", file);
    await expect(resolveWalletPassword(undefined)).rejects.toThrow(/is empty/);
  });

  it("uses AIBTC_WALLET_PASSWORD when no file is set", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    expect(await resolveWalletPassword(undefined)).toEqual({ password: "from-env", source: "AIBTC_WALLET_PASSWORD" });
  });

  it("treats an empty argument as omitted", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    expect((await resolveWalletPassword("")).password).toBe("from-env");
  });

  it("still resolves AIBTC_WALLET_PASSWORD after it is scrubbed from process.env", async () => {
    // Fresh module copy so the captured value doesn't leak into other tests.
    vi.resetModules();
    const fresh = await import("../../src/utils/wallet-password.js");
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "scrubbed");
    fresh.scrubWalletPasswordEnv();
    expect(process.env.AIBTC_WALLET_PASSWORD).toBeUndefined();
    expect((await fresh.resolveWalletPassword(undefined)).password).toBe("scrubbed");
  });

  it("asks for a password when nothing is configured", async () => {
    await expect(resolveWalletPassword(undefined)).rejects.toThrow(/Password required/);
  });
});

describe("wallet_unlock", () => {
  it("accepts a call without a password", () => {
    expect(unlockTool().schema.safeParse({}).success).toBe(true);
  });

  it("unlocks with the password file when password is omitted", async () => {
    const file = join(dir, "pw");
    await writeFile(file, "file-secret\n");
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", file);
    const result = await unlockTool().handler({});
    expect(result.isError).toBeFalsy();
    expect(unlock).toHaveBeenCalledWith("w1", "file-secret");
  });

  it("names the configured source when its password is wrong", async () => {
    const file = join(dir, "pw");
    await writeFile(file, "wrong\n");
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", file);
    unlock.mockRejectedValueOnce(new InvalidPasswordError());
    const result = await unlockTool().handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/AIBTC_WALLET_PASSWORD_FILE/);
  });

  it("returns an error and does not unlock when no password source exists", async () => {
    const result = await unlockTool().handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Password required/);
    expect(unlock).not.toHaveBeenCalled();
  });
});

describe("walletUnlockHint", () => {
  it("tells the agent not to ask for the password when one is configured", () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", "/some/path");
    expect(walletUnlockHint()).toMatch(/without a password/);
  });
});
