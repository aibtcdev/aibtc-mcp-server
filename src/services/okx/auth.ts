/**
 * OKX private API auth: HMAC signing and lazy credential loading.
 *
 * Signing algorithm (per OKX v5 docs, Authentication > Signature):
 *   pre-sign string = timestamp + METHOD + requestPath + body
 *   signature       = base64(HMAC-SHA256(pre-sign, secret))
 *
 * Where:
 *   - timestamp     ISO 8601 UTC with milliseconds (e.g. "2026-05-02T00:00:00.000Z")
 *                   The same string goes in OK-ACCESS-TIMESTAMP and the pre-sign.
 *   - METHOD        UPPERCASE (GET / POST)
 *   - requestPath   absolute path including the query string for GET
 *                   (e.g. "/api/v5/dex/aggregator/quote?chainId=1&amount=...")
 *   - body          empty string for GET; stringified JSON for POST
 *
 * Credentials live in the existing aibtc credential store (encrypted at
 * ~/.aibtc/credentials.enc, password from ARC_CREDS_PASSWORD env var) under
 * service="okx" with keys: api_key, secret, passphrase, project_id.
 *
 * project_id is required for WaaS endpoints (web3.okx.com — DEX + Wallet),
 * sent as the OK-ACCESS-PROJECT header. It is not used by CEX private endpoints.
 */

import crypto from "crypto";
import credentials from "../credentials.js";

export interface OkxCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
  /**
   * WaaS-only (DEX + Wallet API). Optional so future CEX-private
   * callers can omit it — for those flows pass requireProjectId=false
   * to getOkxCredentials.
   */
  projectId?: string;
}

export class OkxCredentialsMissingError extends Error {
  constructor(public readonly missing: readonly string[]) {
    super(
      `OKX credentials missing: ${missing.join(", ")}. ` +
        "Get them at https://web3.okx.com/onchainos/dev-docs/home/developer-portal then run " +
        "credentials_set for each: " +
        missing.map((k) => `service='okx' key='${k}'`).join(", ")
    );
    this.name = "OkxCredentialsMissingError";
  }
}

/**
 * Build the OKX HMAC-SHA256 signature, base64-encoded.
 *
 * @param secret      OKX API secret (raw string — NOT base64)
 * @param timestamp   ISO 8601 UTC ms string, must match OK-ACCESS-TIMESTAMP header
 * @param method      HTTP method (will be uppercased)
 * @param requestPath Absolute path; for GET include the query string verbatim
 * @param body        Empty string for GET; stringified JSON for POST
 */
export function signOkxRequest(
  secret: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body = ""
): string {
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
  return crypto.createHmac("sha256", secret).update(prehash).digest("base64");
}

/**
 * Generate the timestamp string OKX expects (ISO 8601 UTC with ms precision).
 * Exposed so tests can inject a fixed time.
 */
export function okxTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}

/**
 * Load OKX credentials, throwing OkxCredentialsMissingError listing every
 * key that's not set. Unlocks the credential store first if needed.
 *
 * @param requireProjectId  When true (default), project_id is required and
 *                          included in the returned credentials. WaaS
 *                          endpoints (DEX + Wallet) need this. Pass false
 *                          for CEX-private endpoints which don't use the
 *                          OK-ACCESS-PROJECT header.
 */
export async function getOkxCredentials(
  requireProjectId = true
): Promise<OkxCredentials> {
  if (!credentials.isUnlocked()) {
    await credentials.unlock();
  }
  const apiKey = credentials.get("okx", "api_key");
  const secret = credentials.get("okx", "secret");
  const passphrase = credentials.get("okx", "passphrase");
  const projectId = credentials.get("okx", "project_id");

  const missing: string[] = [];
  if (!apiKey) missing.push("api_key");
  if (!secret) missing.push("secret");
  if (!passphrase) missing.push("passphrase");
  if (requireProjectId && !projectId) missing.push("project_id");

  if (missing.length > 0) throw new OkxCredentialsMissingError(missing);

  return {
    apiKey: apiKey as string,
    secret: secret as string,
    passphrase: passphrase as string,
    projectId: projectId ?? undefined,
  };
}

/**
 * Build the OKX auth headers for a signed request. OK-ACCESS-PROJECT is
 * only included when the credentials have a projectId — WaaS endpoints
 * require it, CEX-private endpoints reject it (or simply ignore it).
 */
export function buildOkxAuthHeaders(
  creds: OkxCredentials,
  timestamp: string,
  method: string,
  requestPath: string,
  body = ""
): Record<string, string> {
  const headers: Record<string, string> = {
    "OK-ACCESS-KEY": creds.apiKey,
    "OK-ACCESS-SIGN": signOkxRequest(creds.secret, timestamp, method, requestPath, body),
    "OK-ACCESS-PASSPHRASE": creds.passphrase,
    "OK-ACCESS-TIMESTAMP": timestamp,
  };
  if (creds.projectId) {
    headers["OK-ACCESS-PROJECT"] = creds.projectId;
  }
  return headers;
}
