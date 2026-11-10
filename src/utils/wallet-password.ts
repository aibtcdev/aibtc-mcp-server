import { readFile } from "fs/promises";

/**
 * Resolve the password for wallet_unlock without requiring it as a tool argument.
 *
 * A tool argument is part of the model's turn, so it lands in the agent's transcript.
 * Order: explicit argument, then AIBTC_WALLET_PASSWORD_FILE (a path the server reads),
 * then AIBTC_WALLET_PASSWORD. A configured file that can't be read is an error, not a
 * reason to fall through to the next source. One trailing newline is stripped from the
 * file, nothing else, so passwords with spaces survive.
 */
export async function resolveWalletPassword(argument: string | undefined): Promise<string> {
  if (argument !== undefined) return argument;

  const file = process.env.AIBTC_WALLET_PASSWORD_FILE;
  if (file) {
    const password = (await readFile(file, "utf8")).replace(/\r?\n$/, "");
    if (!password) throw new Error(`AIBTC_WALLET_PASSWORD_FILE (${file}) is empty`);
    return password;
  }

  const env = process.env.AIBTC_WALLET_PASSWORD;
  if (env) return env;

  throw new Error(
    "Password required: pass password, or set AIBTC_WALLET_PASSWORD_FILE (or AIBTC_WALLET_PASSWORD) in the MCP server's environment"
  );
}
