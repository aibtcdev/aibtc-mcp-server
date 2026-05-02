/**
 * Low-level OKX REST client.
 *
 * Wraps fetch with the OKX v5 response envelope: throws OkxApiError on
 * non-zero `code` or non-2xx HTTP status, returns the unwrapped `data` array
 * on success.
 *
 * Base URL is configurable via OKX_BASE_URL env var so US users can route
 * through https://us.okx.com (US-restricted), defaulting to https://www.okx.com.
 *
 * Phase 1 only uses public market endpoints (no auth). HMAC signing for
 * DEX/Wallet/CEX private endpoints will be added in Phase 2.
 */

import type { OkxEnvelope } from "./types.js";
import { OkxApiError } from "./types.js";

const DEFAULT_BASE_URL = "https://www.okx.com";

export function getOkxBaseUrl(): string {
  const env = process.env.OKX_BASE_URL?.trim();
  return env && env.length > 0 ? env.replace(/\/$/, "") : DEFAULT_BASE_URL;
}

function buildQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (entries.length === 0) return "";
  const search = new URLSearchParams();
  for (const [k, v] of entries) search.append(k, String(v));
  return `?${search.toString()}`;
}

export async function okxGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T[]> {
  const url = `${getOkxBaseUrl()}${path}${buildQuery(params)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  let body: OkxEnvelope<T>;
  try {
    body = (await response.json()) as OkxEnvelope<T>;
  } catch {
    throw new OkxApiError(
      String(response.status),
      `OKX returned non-JSON response (HTTP ${response.status})`,
      response.status
    );
  }

  if (!response.ok) {
    throw new OkxApiError(
      body?.code ?? String(response.status),
      body?.msg || `OKX HTTP ${response.status}`,
      response.status
    );
  }

  if (body.code !== "0") {
    throw new OkxApiError(body.code, body.msg || `OKX error ${body.code}`, response.status);
  }

  return body.data;
}
