import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chmod, mkdtemp, rm, writeFile as rawWriteFile } from "fs/promises";
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

const { resolveWalletPassword, walletUnlockHint, pinEnvPasswordWallet } = await import("../../src/utils/wallet-password.js");

/** Password files must be chmod 600; write them that way unless a test says otherwise. */
async function writeFile(file: string, data: string, mode = 0o600) {
  await rawWriteFile(file, data);
  await chmod(file, mode);
}
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
  pinEnvPasswordWallet("w1");
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

  it.skipIf(process.platform === "win32")("refuses a file readable by group or others", async () => {
    const file = join(dir, "pw");
    await writeFile(file, "secret\n", 0o644);
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", file);
    await expect(resolveWalletPassword(undefined)).rejects.toThrow(/chmod 600/);
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
    expect(unlock).toHaveBeenCalledWith("w1", "file-secret", { resetSpendSession: false });
  });

  it("refills the session spend budget only when the password is passed as an argument", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    await unlockTool().handler({ password: "from-arg" });
    expect(unlock).toHaveBeenCalledWith("w1", "from-arg", { resetSpendSession: true });
  });

  it("refuses to unlock a wallet other than the pinned one with the configured password", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    const result = await unlockTool().handler({ walletId: "w2" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/active when the server started \(w1\)/);
    expect(unlock).not.toHaveBeenCalled();
  });

  it("still unlocks another wallet when the password is passed as an argument", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    const result = await unlockTool().handler({ walletId: "w2", password: "w2-pass" });
    expect(result.isError).toBeFalsy();
    expect(unlock).toHaveBeenCalledWith("w2", "w2-pass", { resetSpendSession: true });
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

  it("reports a wrong configured password as a wallet error, not a generic one", async () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "wrong");
    unlock.mockRejectedValueOnce(new InvalidPasswordError());
    const result = await unlockTool().handler({});
    expect(result.content[0].text).toMatch(/AIBTC_WALLET_PASSWORD did not decrypt it.*\(WALLET_ERROR\)$/);
  });

  it("returns an error and does not unlock when no password source exists", async () => {
    const result = await unlockTool().handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Password required/);
    expect(unlock).not.toHaveBeenCalled();
  });
});

describe("InvalidPasswordError", () => {
  it("keeps its type and the original error when given a message", () => {
    const original = new InvalidPasswordError();
    const wrapped = new InvalidPasswordError("from env", { cause: original });
    expect(wrapped).toBeInstanceOf(InvalidPasswordError);
    expect(wrapped.message).toBe("from env");
    expect(wrapped.cause).toBe(original);
    expect(new InvalidPasswordError().message).toBe("Invalid password");
  });
});

describe("walletUnlockHint", () => {
  it("tells the agent not to ask for the password when one is configured", () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    expect(walletUnlockHint("w1")).toMatch(/Do not ask the user/);
  });

  it("does not steer the agent to a password-less unlock when the file is missing", () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD_FILE", join(dir, "missing"));
    const hint = walletUnlockHint("w1");
    expect(hint).toMatch(/won't work/);
    expect(hint).not.toMatch(/Do not ask the user/);
  });

  it("does not steer the agent to a password-less unlock for a wallet that isn't pinned", () => {
    vi.stubEnv("AIBTC_WALLET_PASSWORD", "from-env");
    expect(walletUnlockHint("w2")).toMatch(/won't work/);
  });

  it("asks for the password when nothing is configured", () => {
    expect(walletUnlockHint("w1")).toMatch(/with the wallet password/);
  });
});
