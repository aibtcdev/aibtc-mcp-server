import { readFileSync, statSync } from "fs";

export const WALLET_PASSWORD_ENV = "AIBTC_WALLET_PASSWORD";
export const WALLET_PASSWORD_FILE_ENV = "AIBTC_WALLET_PASSWORD_FILE";

export type WalletPasswordSource = "argument" | typeof WALLET_PASSWORD_FILE_ENV | typeof WALLET_PASSWORD_ENV;

export interface ResolvedWalletPassword {
  password: string;
  source: WalletPasswordSource;
}

/** AIBTC_WALLET_PASSWORD moved out of process.env by scrubWalletPasswordEnv(). */
let capturedEnvPassword: string | undefined;

/**
 * Move AIBTC_WALLET_PASSWORD out of process.env so child processes the server
 * spawns (browser openers, helpers) don't inherit the plaintext password.
 * Called once at server startup; resolveWalletPassword still sees the value.
 */
export function scrubWalletPasswordEnv(): void {
  const value = process.env[WALLET_PASSWORD_ENV];
  if (value) capturedEnvPassword = value;
  delete process.env[WALLET_PASSWORD_ENV];
}

/**
 * The wallet the configured password may unlock: the one active when the server
 * started. wallet_switch needs no password, so pinning to whatever is active at
 * unlock time would let the agent unlock any wallet sharing the password.
 */
let pinnedWalletId: string | null = null;

/** Record the wallet the configured password unlocks. Called once at startup. */
export function pinEnvPasswordWallet(walletId: string | null): void {
  pinnedWalletId = walletId;
}

export function envPasswordWalletId(): string | null {
  return pinnedWalletId;
}

/**
 * Read AIBTC_WALLET_PASSWORD_FILE. It must be a regular file owned by this user
 * and not readable or writable by group or others (chmod 600), like ssh keys.
 * One trailing newline is stripped, nothing else, so passwords with spaces survive.
 */
function readPasswordFile(file: string): string {
  const st = statSync(file);
  if (!st.isFile()) throw new Error(`${WALLET_PASSWORD_FILE_ENV} (${file}) is not a regular file`);
  if (process.platform !== "win32") {
    if (typeof process.getuid === "function" && st.uid !== process.getuid()) {
      throw new Error(`${WALLET_PASSWORD_FILE_ENV} (${file}) is not owned by the user running the server`);
    }
    if (st.mode & 0o077) {
      throw new Error(
        `${WALLET_PASSWORD_FILE_ENV} (${file}) is accessible by group or others (mode ${(st.mode & 0o777).toString(8)}); run chmod 600 on it`
      );
    }
  }
  const password = readFileSync(file, "utf8").replace(/\r?\n$/, "");
  if (!password) throw new Error(`${WALLET_PASSWORD_FILE_ENV} (${file}) is empty`);
  return password;
}

/**
 * Resolve the password for wallet_unlock without requiring it as a tool argument.
 *
 * A tool argument is part of the model's turn, so it lands in the agent's transcript.
 * Order: explicit non-empty argument, then AIBTC_WALLET_PASSWORD_FILE (a path the
 * server reads), then AIBTC_WALLET_PASSWORD. An empty argument counts as omitted,
 * since models often fill optional fields with "". A configured file that can't be
 * read is an error, not a reason to fall through to the next source.
 */
export async function resolveWalletPassword(argument: string | undefined): Promise<ResolvedWalletPassword> {
  if (argument) return { password: argument, source: "argument" };

  const file = process.env[WALLET_PASSWORD_FILE_ENV];
  if (file) return { password: readPasswordFile(file), source: WALLET_PASSWORD_FILE_ENV };

  const env = process.env[WALLET_PASSWORD_ENV] || capturedEnvPassword;
  if (env) return { password: env, source: WALLET_PASSWORD_ENV };

  throw new Error(
    `Password required: pass password, or set ${WALLET_PASSWORD_FILE_ENV} (or ${WALLET_PASSWORD_ENV}) in the MCP server's environment`
  );
}

/** True when a password source is configured, whether or not it works. */
export function hasConfiguredWalletPassword(): boolean {
  return Boolean(
    process.env[WALLET_PASSWORD_FILE_ENV] || process.env[WALLET_PASSWORD_ENV] || capturedEnvPassword
  );
}

/**
 * Why the configured password can't unlock `walletId` without an argument, or
 * null when it can. Checks the file is readable, private and non-empty, and that
 * the wallet is the pinned one; it does not try to decrypt.
 */
export function envPasswordUnusableReason(walletId: string | null): string | null {
  if (!hasConfiguredWalletPassword()) return "no password is configured in the server's environment";
  const file = process.env[WALLET_PASSWORD_FILE_ENV];
  if (file) {
    try {
      readPasswordFile(file);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
  if (!pinnedWalletId || walletId !== pinnedWalletId) {
    return `the server's configured password only unlocks the wallet that was active when the server started (${pinnedWalletId ?? "none"})`;
  }
  return null;
}

/** Hint for a locked wallet that matches how this server is configured. */
export function walletUnlockHint(walletId: string | null): string {
  if (!hasConfiguredWalletPassword()) return "Use wallet_unlock with the wallet password to unlock.";
  const reason = envPasswordUnusableReason(walletId);
  return reason
    ? `wallet_unlock without a password won't work here: ${reason}. Ask the user to fix the server configuration or to unlock the wallet.`
    : "Call wallet_unlock without a password: the server reads it from its environment. Do not ask the user for it.";
}
