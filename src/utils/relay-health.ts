/**
 * Relay Health Monitoring & Nonce Gap Detection
 * 
 * Proactively checks the sponsor relay for nonce gaps and provides
 * diagnostic information when send failures occur.
 */

import { getSponsorRelayUrl } from "../config/sponsor.js";
import type { Network } from "../config/networks.js";
import { getHiroApi } from "../services/hiro-api.js";

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
  };
  issues?: string[];
}

/**
 * Known sponsor addresses for each network.
 * Only mainnet has a known relay sponsor address.
 */
const SPONSOR_ADDRESSES: Partial<Record<Network, string>> = {
  mainnet: "SP1PMPPVCMVW96FSWFV30KJQ4MNBMZ8MRWR3JWQ7",
};

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

    if (hasGaps) {
      issues.push(
        `Sponsor has ${gapCount} missing nonce(s): ${nonceInfo.detected_missing_nonces.slice(0, 5).join(", ")}${gapCount > 5 ? "..." : ""}`
      );
    }

    if (nonceInfo.detected_mempool_nonces.length > 10) {
      issues.push(
        `Sponsor has ${nonceInfo.detected_mempool_nonces.length} transactions stuck in mempool`
      );
    }

    const nonceStatus = {
      lastExecuted: nonceInfo.last_executed_tx_nonce || 0,
      lastMempool: nonceInfo.last_mempool_tx_nonce,
      possibleNext: nonceInfo.possible_next_nonce,
      missingNonces: nonceInfo.detected_missing_nonces,
      mempoolNonces: nonceInfo.detected_mempool_nonces,
      hasGaps,
      gapCount,
    };

    return {
      healthy: issues.length === 0,
      network,
      version,
      sponsorAddress,
      nonceStatus,
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
      lines.push(`  ❌ Missing nonces (${ns.gapCount}): ${ns.missingNonces.slice(0, 10).join(", ")}${ns.gapCount > 10 ? "..." : ""}`);
    } else {
      lines.push("  ✅ No nonce gaps");
    }
    
    if (ns.mempoolNonces.length > 0) {
      lines.push(`  ⚠️  Mempool nonces (${ns.mempoolNonces.length}): ${ns.mempoolNonces.slice(0, 10).join(", ")}${ns.mempoolNonces.length > 10 ? "..." : ""}`);
    }
  }
  
  if (status.issues && status.issues.length > 0) {
    lines.push("");
    lines.push("Issues:");
    status.issues.forEach(issue => lines.push(`  - ${issue}`));
  }
  
  return lines.join("\n");
}

/**
 * Wait with exponential backoff when relay nonce issues are detected
 * Returns recommended wait time in milliseconds
 */
export function getRelayBackoffDelay(attempt: number, hasNonceGaps: boolean): number {
  if (hasNonceGaps) {
    // With nonce gaps, use longer delays: 30s, 60s, 120s
    const delays = [30000, 60000, 120000];
    return delays[Math.min(attempt, delays.length - 1)];
  }
  // Normal backoff: 2s, 5s, 10s
  const delays = [2000, 5000, 10000];
  return delays[Math.min(attempt, delays.length - 1)];
}
