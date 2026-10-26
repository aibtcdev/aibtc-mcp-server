/**
 * L402 Protocol Helpers
 *
 * Parses L402 challenge headers of the form:
 *   WWW-Authenticate: L402 macaroon="...", invoice="..."
 *
 * Builds the Authorization header used to retry the request after the
 * Lightning invoice has been paid:
 *   Authorization: L402 <macaroon>:<preimage>
 *
 * References:
 * - L402 (formerly LSAT) protocol: https://docs.lightning.engineering/the-lightning-network/l402
 */

/**
 * Parsed fields from an L402 challenge header.
 */
export interface L402Challenge {
  macaroon: string;
  invoice: string;
}

/**
 * Parse a `WWW-Authenticate: L402 macaroon="...", invoice="..."` header.
 *
 * Tolerates:
 *  - case-insensitive scheme ("L402" or "l402"; legacy "LSAT" aliased)
 *  - whitespace between key/value pairs
 *  - either single or double quotes around the values
 *  - key order (macaroon/invoice swapped)
 *
 * Returns null when the header doesn't match the L402 scheme or either field
 * is missing. Callers should treat null as "not an L402 challenge".
 */
export function parseL402Challenge(
  header: string | null | undefined
): L402Challenge | null {
  if (!header) return null;

  const trimmed = header.trim();
  // Accept both "L402 ..." and legacy "LSAT ..." schemes.
  const schemeMatch = /^(L402|LSAT)\s+(.+)$/i.exec(trimmed);
  if (!schemeMatch) return null;

  const body = schemeMatch[2];

  const macaroon = extractParam(body, "macaroon");
  const invoice = extractParam(body, "invoice");
  if (!macaroon || !invoice) return null;

  return { macaroon, invoice };
}

/**
 * Escape regex special characters so a caller-provided key can be safely
 * interpolated into a RegExp. Keeps the helper defensive even though today's
 * callers only pass hardcoded literals.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract a quoted or unquoted param value from an RFC-7235-style header body.
 *
 * Supports double-quoted, single-quoted, and unquoted values to match the
 * docstring claim and tolerate well-meaning servers that emit single quotes.
 * RFC 7235 only mandates double quotes, but real-world implementations are
 * forgiving here.
 */
function extractParam(body: string, key: string): string | null {
  const escapedKey = escapeRegExp(key);
  // Double-quoted value: key="..."
  const doubleQuoted = new RegExp(
    `${escapedKey}\\s*=\\s*"([^"]+)"`,
    "i"
  ).exec(body);
  if (doubleQuoted) return doubleQuoted[1];
  // Single-quoted value: key='...'
  const singleQuoted = new RegExp(
    `${escapedKey}\\s*=\\s*'([^']+)'`,
    "i"
  ).exec(body);
  if (singleQuoted) return singleQuoted[1];
  // Unquoted value: key=value[,\s]
  const unquoted = new RegExp(`${escapedKey}\\s*=\\s*([^,\\s]+)`, "i").exec(body);
  if (unquoted) return unquoted[1];
  return null;
}

/**
 * Build the L402 Authorization header: `L402 <macaroon>:<preimage>`.
 */
export function buildL402AuthHeader(
  macaroon: string,
  preimage: string
): string {
  return `L402 ${macaroon}:${preimage}`;
}

// ===== Macaroon cache =====
//
// In-memory cache keyed by `{method}:{url}`. After a successful L402 payment
// we remember the macaroon so subsequent requests to the same endpoint reuse
// it instead of re-paying. PR 2 will add disk persistence.

interface CachedMacaroon {
  macaroon: string;
  preimage: string;
  cachedAt: number;
}

const macaroonCache: Map<string, CachedMacaroon> = new Map();

/**
 * Build the canonical cache key for a request.
 */
export function l402CacheKey(method: string, url: string): string {
  return `${method.toUpperCase()}:${url}`;
}

/**
 * Look up a cached macaroon+preimage pair. Returns null on miss.
 */
export function getCachedL402Auth(
  method: string,
  url: string
): CachedMacaroon | null {
  return macaroonCache.get(l402CacheKey(method, url)) ?? null;
}

/**
 * Store the macaroon+preimage pair for future reuse.
 */
export function cacheL402Auth(
  method: string,
  url: string,
  macaroon: string,
  preimage: string
): void {
  macaroonCache.set(l402CacheKey(method, url), {
    macaroon,
    preimage,
    cachedAt: Date.now(),
  });
}

/**
 * Drop a cached entry (e.g. after the server returned 401 despite a cache hit).
 */
export function invalidateL402Auth(method: string, url: string): void {
  macaroonCache.delete(l402CacheKey(method, url));
}

/**
 * Testing helper: clear the whole cache.
 */
export function clearL402Cache(): void {
  macaroonCache.clear();
}
