import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// The key service resolves ~/.aibtc from the home directory when it is
// imported, so point HOME at a scratch dir and import the modules afterwards.
// Every test first checks the home really is that dir: never touch a real ~/.aibtc.
let home = "";
const savedHome = process.env.HOME;
let mod: typeof import("../../src/services/pillar-key-password.js");
let keys: ReturnType<typeof import("../../src/services/signing-key.service.js").getSigningKeyService>;

beforeAll(async () => {
  home = await realpath(await mkdtemp(path.join(os.tmpdir(), "pillar-key-")));
  process.env.HOME = home;
  if (os.homedir() !== home) throw new Error(`refusing to run: home is ${os.homedir()}, expected ${home}`);
  vi.resetModules();
  mod = await import("../../src/services/pillar-key-password.js");
  keys = (await import("../../src/services/signing-key.service.js")).getSigningKeyService();
});

afterAll(async () => {
  process.env.HOME = savedHome;
  await rm(home, { recursive: true, force: true });
});

const legacy = () => mod.derivePillarKeyPassword("pillar-direct-default");

describe("Pillar signing-key password", () => {
  it("without PILLAR_API_KEY uses a stable, owner-only per-machine secret, not the public default", async () => {
    expect(os.homedir()).toBe(home);
    const a = await mod.currentPillarKeyPassword("");
    expect(await mod.currentPillarKeyPassword("")).toBe(a);
    expect(a).not.toBe(legacy());
    const file = path.join(home, ".aibtc", "pillar-signing-secret");
    expect((await readFile(file, "utf8")).trim()).toMatch(/^[0-9a-f]{64}$/);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("with PILLAR_API_KEY derives the password from it", async () => {
    expect(await mod.currentPillarKeyPassword("api-key-1")).toBe(mod.derivePillarKeyPassword("api-key-1"));
  });

  it("re-encrypts a key under the legacy default the first time it unlocks", async () => {
    expect(os.homedir()).toBe(home);
    const { keyId } = await keys.generateKey(legacy(), "pending");
    keys.lock();
    expect(await mod.unlockPillarKey(keyId, "")).toEqual({ migrated: true });
    expect(keys.getActiveKey()?.keyId).toBe(keyId);
    keys.lock();
    await expect(keys.exportKey(keyId, legacy())).rejects.toThrow(/Invalid password/);
    await keys.exportKey(keyId, await mod.currentPillarKeyPassword(""));
    expect(await mod.unlockPillarKey(keyId, "")).toEqual({ migrated: false });
    keys.lock();
  });

  it("still unlocks a key created before PILLAR_API_KEY was set", async () => {
    const { keyId } = await keys.generateKey(await mod.currentPillarKeyPassword(""), "pending");
    keys.lock();
    expect(await mod.unlockPillarKey(keyId, "api-key-2")).toEqual({ migrated: false });
    keys.lock();
  });

  it("refuses a key under an unrelated password", async () => {
    const { keyId } = await keys.generateKey("something-else", "pending");
    keys.lock();
    await expect(mod.unlockPillarKey(keyId, "")).rejects.toThrow(/Invalid password/);
  });
});
