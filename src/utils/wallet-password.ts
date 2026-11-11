import { readFile } from "fs/promises";

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

/** True when the server can unlock without a password argument. */
export function hasConfiguredWalletPassword(): boolean {
  return Boolean(
    process.env[WALLET_PASSWORD_FILE_ENV] || process.env[WALLET_PASSWORD_ENV] || capturedEnvPassword
  );
}

/**
 * Resolve the password for wallet_unlock without requiring it as a tool argument.
 *
 * A tool argument is part of the model's turn, so it lands in the agent's transcript.
 * Order: explicit non-empty argument, then AIBTC_WALLET_PASSWORD_FILE (a path the
 * server reads), then AIBTC_WALLET_PASSWORD. An empty argument counts as omitted,
 * since models often fill optional fields with "". A configured file that can't be
 * read is an error, not a reason to fall through to the next source. One trailing
 * newline is stripped from the file, nothing else, so passwords with spaces survive.
 */
export async function resolveWalletPassword(argument: string | undefined): Promise<ResolvedWalletPassword> {
  if (argument) return { password: argument, source: "argument" };

  const file = process.env[WALLET_PASSWORD_FILE_ENV];
  if (file) {
    const password = (await readFile(file, "utf8")).replace(/\r?\n$/, "");
    if (!password) throw new Error(`${WALLET_PASSWORD_FILE_ENV} (${file}) is empty`);
    return { password, source: WALLET_PASSWORD_FILE_ENV };
  }

  const env = process.env[WALLET_PASSWORD_ENV] || capturedEnvPassword;
  if (env) return { password: env, source: WALLET_PASSWORD_ENV };

  throw new Error(
    `Password required: pass password, or set ${WALLET_PASSWORD_FILE_ENV} (or ${WALLET_PASSWORD_ENV}) in the MCP server's environment`
  );
}

/** Hint for a locked wallet that matches how this server is configured. */
export function walletUnlockHint(): string {
  return hasConfiguredWalletPassword()
    ? "Call wallet_unlock without a password: the server reads it from its environment. Do not ask the user for it."
    : "Use wallet_unlock with the wallet password to unlock.";
}
