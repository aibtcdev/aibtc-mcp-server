/**
 * Relay Health Monitoring & Nonce Gap Detection
 *
 * Operator-facing diagnostics for sponsor nonce health. This is intentionally
 * separate from the caller-facing x402 payment state machine.
 */

import { getSponsorRelayUrl, getSponsorApiKey } from "../config/sponsor.js";
import type { Network } from "../config/networks.js";
import { getHiroApi } from "../services/hiro-api.js";

export interface StuckTransaction {
  txid: string;
  nonce: number;
  pendingSeconds: number;
  sponsor_nonce?: number;
}

export interface RelayHealthStatus {
  healthy: boolean;
  network: Network;
  version?: string;
  sponsorAddress?: string;
  nonceStatus?: {
    lastExecuted: number;
    lastMempool: number | null;
    possibleNext: number;
    missingNonces: number[];
    mempoolNonces: number[];
    hasGaps: boolean;
    gapCount: number;
    mempoolDesync: boolean;
    desyncGap: number;
  };
  stuckTransactions?: StuckTransaction[];
  issues?: string[];
}

/**
 * Known sponsor addresses for each network.
 * Only mainnet has a known relay sponsor address.
 */
export const SPONSOR_ADDRESSES: Partial<Record<Network, string>> = {
  mainnet: "SP1PMPPVCMVW96FSWFV30KJQ4MNBMZ8MRWR3JWQ7",
};

/**
 * Lightweight relay health probe — returns true only if the relay /health
 * endpoint responds within 5 seconds with HTTP 200 and status "ok".
 *
 * Use this on the hot path (e.g., before deciding to fall back to direct
 * submission) where the full checkRelayHealth() diagnostics are unnecessary.
 */
export async function isRelayHealthy(network: Network): Promise<boolean> {
  const relayUrl = getSponsorRelayUrl(network);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${relayUrl}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) return false;

    const data = await res.json() as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check relay health and sponsor nonce status
 */
export async function checkRelayHealth(network: Network): Promise<RelayHealthStatus> {
  const relayUrl = getSponsorRelayUrl(network);
  const issues: string[] = [];

  try {
    // Check basic relay health
    const healthRes = await fetch(`${relayUrl}/health`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!healthRes.ok) {
      issues.push(`Relay health check failed: HTTP ${healthRes.status}`);
      return {
        healthy: false,
        network,
        issues,
      };
    }

    const healthData = await healthRes.json() as { status?: string; version?: string; network?: string };
    const version = healthData.version;

    if (healthData.status !== "ok") {
      issues.push(`Relay status: ${healthData.status || "unknown"}`);
    }

    // Check sponsor address nonce status
    const sponsorAddress = SPONSOR_ADDRESSES[network];
    if (!sponsorAddress) {
      issues.push("Unknown sponsor address for network");
      return {
        healthy: issues.length === 0,
        network,
        version,
        issues: issues.length > 0 ? issues : undefined,
      };
    }

    const hiroApi = getHiroApi(network);
    const nonceInfo = await hiroApi.getNonceInfo(sponsorAddress);

    const hasGaps = nonceInfo.detected_missing_nonces.length > 0;
    const gapCount = nonceInfo.detected_missing_nonces.length;

    // Mempool desync: sponsor has far more queued/broadcast transactions than confirmed ones
    const lastExecuted = nonceInfo.last_executed_tx_nonce || 0;
    const lastMempool = nonceInfo.last_mempool_tx_nonce;
    const desyncGap = lastMempool !== null ? lastMempool - lastExecuted : 0;
    const mempoolDesync = desyncGap > 5;

    if (hasGaps) {
      issues.push(
        `Sponsor has ${gapCount} missing nonce(s): ${nonceInfo.detected_missing_nonces.slice(0, 5).join(", ")}${gapCount > 5 ? "..." : ""}`
      );
    }

    if (mempoolDesync) {
      issues.push(
        `Mempool desync detected: sponsor nonce ${lastExecuted} (executed) vs ${lastMempool} (mempool), gap of ${desyncGap}`
      );
    } else if (nonceInfo.detected_mempool_nonces.length > 10) {
      issues.push(
        `Sponsor has ${nonceInfo.detected_mempool_nonces.length} relay-owned transactions stuck in mempool`
      );
    }

    const nonceStatus = {
      lastExecuted,
      lastMempool,
      possibleNext: nonceInfo.possible_next_nonce,
      missingNonces: nonceInfo.detected_missing_nonces,
      mempoolNonces: nonceInfo.detected_mempool_nonces,
      hasGaps,
      gapCount,
      mempoolDesync,
      desyncGap,
    };

    // Fetch stuck transactions from mempool for actionable diagnostics
    let stuckTransactions: StuckTransaction[] | undefined;
    try {
      const mempoolRes = await hiroApi.getMempoolTransactions({
        sender_address: sponsorAddress,
        limit: 50,
      });
      const nowSeconds = Math.floor(Date.now() / 1000);
      const stuck = mempoolRes.results
        .filter((tx) => {
          const pendingSeconds = nowSeconds - tx.receipt_time;
          return pendingSeconds > 60;
        })
        .map((tx) => ({
          txid: tx.tx_id,
          nonce: tx.nonce,
          pendingSeconds: nowSeconds - tx.receipt_time,
          ...(tx.sponsor_nonce !== undefined ? { sponsor_nonce: tx.sponsor_nonce } : {}),
        }))
        .sort((a, b) => b.pendingSeconds - a.pendingSeconds)
        .slice(0, 10);

      if (stuck.length > 0) {
        stuckTransactions = stuck;
      }
    } catch {
      // Non-fatal: stuck-tx fetch is best-effort
    }

    return {
      healthy: issues.length === 0,
      network,
      version,
      sponsorAddress,
      nonceStatus,
      stuckTransactions,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    issues.push(`Relay health check error: ${error instanceof Error ? error.message : String(error)}`);
    return {
      healthy: false,
      network,
      issues,
    };
  }
}

/**
 * Format relay health status as a human-readable string
 */
export function formatRelayHealthStatus(status: RelayHealthStatus): string {
  const lines: string[] = [];
  
  lines.push(`Relay Health Check (${status.network})`);
  lines.push(`Status: ${status.healthy ? "✅ HEALTHY" : "❌ UNHEALTHY"}`);
  
  if (status.version) {
    lines.push(`Version: ${status.version}`);
  }
  
  if (status.sponsorAddress) {
    lines.push(`Sponsor: ${status.sponsorAddress}`);
  }
  
  if (status.nonceStatus) {
    const ns = status.nonceStatus;
    lines.push("");
    lines.push("Nonce Status:");
    lines.push(`  Last executed: ${ns.lastExecuted}`);
    lines.push(`  Last mempool: ${ns.lastMempool ?? "none"}`);
    lines.push(`  Next nonce: ${ns.possibleNext}`);
    
    if (ns.hasGaps) {
      lines.push(`  GAPS Missing nonces (${ns.gapCount}): ${ns.missingNonces.slice(0, 10).join(", ")}${ns.gapCount > 10 ? "..." : ""}`);
    } else {
      lines.push("  OK No nonce gaps");
    }

    if (ns.mempoolDesync) {
      lines.push(`  DESYNC Mempool desync: executed=${ns.lastExecuted}, mempool=${ns.lastMempool ?? "none"}, gap=${ns.desyncGap}`);
    }

    if (ns.mempoolNonces.length > 0) {
      lines.push(`  WARN Mempool nonces (${ns.mempoolNonces.length}): ${ns.mempoolNonces.slice(0, 10).join(", ")}${ns.mempoolNonces.length > 10 ? "..." : ""}`);
    }
  }

  if (status.stuckTransactions && status.stuckTransactions.length > 0) {
    lines.push("");
    lines.push("Stuck Transactions:");
    status.stuckTransactions.forEach((tx) => {
      const minutes = Math.floor(tx.pendingSeconds / 60);
      const seconds = tx.pendingSeconds % 60;
      const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      lines.push(`  nonce=${tx.nonce}${tx.sponsor_nonce !== undefined ? ` sponsor_nonce=${tx.sponsor_nonce}` : ""} pending=${duration} txid=${tx.txid}`);
    });
  }

  if (status.issues && status.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    status.issues.forEach(issue => lines.push(`  - ${issue}`));
  }
  
  return lines.join("\n");
}

export interface RelayRecoveryResult {
  supported: boolean;
  message?: string;
  result?: unknown;
}

/**
 * Send a recovery request to the relay API.
 *
 * Shared implementation for RBF and gap-fill operations which differ only in
 * path, request body, and the "unsupported" message shown when the relay
 * returns 404 or 501.
 */
async function relayRecoveryRequest(
  network: Network,
  relayPath: string,
  body: Record<string, unknown>,
  unsupportedMessage: string,
  apiKey?: string,
): Promise<RelayRecoveryResult> {
  const relayUrl = getSponsorRelayUrl(network);
  const resolvedKey = apiKey || getSponsorApiKey();

  if (!resolvedKey) {
    return {
      supported: true,
      message: "No sponsor API key available. Set SPONSOR_API_KEY env var or use a wallet with sponsorApiKey configured.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${relayUrl}${relayPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resolvedKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.status === 404 || res.status === 501) {
      return { supported: false, message: unsupportedMessage };
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Relay ${relayPath} failed: HTTP ${res.status} — ${text}`);
    }

    const result = await res.json();
    return { supported: true, result };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Attempt RBF (replace-by-fee) on stuck transactions via the relay API.
 * If txids is provided, only those transactions are bumped; otherwise the relay
 * bumps all stuck transactions it knows about.
 *
 * Gracefully returns { supported: false } if the relay returns 404 or 501.
 */
export function attemptRbf(network: Network, txids?: string[], apiKey?: string): Promise<RelayRecoveryResult> {
  const body: Record<string, unknown> = {};
  if (txids && txids.length > 0) body.txids = txids;

  return relayRecoveryRequest(
    network,
    "/recovery/rbf",
    body,
    "Relay does not support RBF recovery yet. Share stuck txids with the AIBTC team for manual recovery.",
    apiKey,
  );
}

/**
 * Attempt to fill nonce gaps on the relay by having it submit placeholder transactions.
 * If nonces is provided, only those gaps are filled; otherwise the relay fills all detected gaps.
 *
 * Gracefully returns { supported: false } if the relay returns 404 or 501.
 */
export function attemptFillGaps(network: Network, nonces?: number[], apiKey?: string): Promise<RelayRecoveryResult> {
  const body: Record<string, unknown> = {};
  if (nonces && nonces.length > 0) body.nonces = nonces;

  return relayRecoveryRequest(
    network,
    "/recovery/fill-gaps",
    body,
    "Relay does not support nonce gap-fill recovery yet. Share missing nonces with the AIBTC team for manual recovery.",
    apiKey,
  );
}
