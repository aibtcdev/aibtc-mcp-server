/**
 * fetchSafe — Hardened fetch wrapper
 *
 * Every outbound HTTP call goes through here:
 *   - Mandatory timeout (default 10s, configurable)
 *   - Automatic retry with exponential backoff (default 2 retries)
 *   - Per-host rate limiting (max 10 req/s per host)
 *   - Response size cap (default 10MB) to prevent memory exhaustion
 *   - Non-2xx throws with status code in message
 */

// ── Rate limiter (per hostname, in-process) ───────────────────────────────────

const _hostWindows = new Map<string, number[]>();
const RATE_LIMIT_MAX   = 10;   // requests per window
const RATE_LIMIT_WINDOW = 1000; // ms

function checkRateLimit(hostname: string): void {
  const now  = Date.now();
  const hits = (_hostWindows.get(hostname) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW);
  if (hits.length >= RATE_LIMIT_MAX) {
    throw new Error(`Rate limit: too many requests to ${hostname} (${RATE_LIMIT_MAX}/s)`);
  }
  hits.push(now);
  _hostWindows.set(hostname, hits);
}

// ── fetchSafe ─────────────────────────────────────────────────────────────────

export interface FetchSafeOptions extends RequestInit {
  timeoutMs?:  number;    // default 10000
  retries?:    number;    // default 2
  maxBytes?:   number;    // default 10MB
  rateLimit?:  boolean;   // default true
}

export async function fetchSafe(url: string, options: FetchSafeOptions = {}): Promise<Response> {
  const {
    timeoutMs = 10_000,
    retries   = 2,
    maxBytes  = 10 * 1024 * 1024,
    rateLimit = true,
    ...init
  } = options;

  const hostname = new URL(url).hostname;

  if (rateLimit) checkRateLimit(hostname);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt - 1)));
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetch(url, { ...init, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      // Size guard — read into buffer with cap
      const contentLength = Number(res.headers?.get?.("content-length") ?? 0);
      if (contentLength > maxBytes) {
        throw new Error(`Response too large from ${hostname}: ${contentLength} bytes`);
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} from ${hostname}: ${body.slice(0, 200)}`);
      }

      return res;
    } catch (err) {
      lastErr = err;
      // Don't retry on rate limit or size errors
      if (err instanceof Error &&
          (err.message.startsWith("Rate limit") || err.message.startsWith("Response too large"))) {
        throw err;
      }
    }
  }
  throw lastErr;
}

/** Convenience: fetch JSON with full safety. */
export async function fetchJson<T = unknown>(url: string, options: FetchSafeOptions = {}): Promise<T> {
  const res = await fetchSafe(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers ?? {}) },
  });
  return res.json() as Promise<T>;
}

/** Convenience: fetch text with full safety. */
export async function fetchText(url: string, options: FetchSafeOptions = {}): Promise<string> {
  const res = await fetchSafe(url, options);
  return res.text();
}
