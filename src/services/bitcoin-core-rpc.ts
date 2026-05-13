/**
 * Bitcoin Core RPC Client
 *
 * Connects to a local Bitcoin Core node via JSON-RPC.
 * Falls back to mempool.space API if Core is not running.
 *
 * Bitcoin Core RPC setup (bitcoin.conf):
 *   server=1
 *   rpcuser=aibtc
 *   rpcpassword=aibtc2026
 *   rpcport=8332
 */

import { createHash } from "crypto";

export interface BitcoinBlockInfo {
  height:         number;
  hash:           string;
  time:           number;
  difficulty:     number;
  tx_count:       number;
  size:           number;
}

export interface BitcoinFees {
  fast:   number;   // sat/vB — 1-2 blocks
  medium: number;   // sat/vB — 3-6 blocks
  slow:   number;   // sat/vB — 7+ blocks
}

export interface BitcoinMempoolInfo {
  tx_count:     number;
  vsize_mb:     number;
  fees_total_btc: number;
  min_fee:      number;
}

export interface BitcoinCoreStatus {
  connected:    boolean;
  source:       "bitcoin-core" | "mempool.space";
  block:        BitcoinBlockInfo | null;
  fees:         BitcoinFees | null;
  mempool:      BitcoinMempoolInfo | null;
  error?:       string;
}

interface RpcConfig {
  host:     string;
  port:     number;
  username: string;
  password: string;
}

if (!process.env.BITCOIN_RPC_PASSWORD) {
  console.warn(
    "[BITCOIN RPC] WARNING: BITCOIN_RPC_PASSWORD not set. " +
    "Using insecure default 'aibtc2026'. " +
    "Set BITCOIN_RPC_PASSWORD in your environment before connecting to Bitcoin Core."
  );
}

const DEFAULT_RPC: RpcConfig = {
  host:     "127.0.0.1",
  port:     8332,
  username: process.env.BITCOIN_RPC_USER     ?? "aibtc",
  password: process.env.BITCOIN_RPC_PASSWORD ?? "aibtc2026",
};

// ── JSON-RPC call ─────────────────────────────────────────────────────────────

async function rpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: "1.0", id: "aibtc", method, params });
  const auth  = Buffer.from(`${DEFAULT_RPC.username}:${DEFAULT_RPC.password}`).toString("base64");

  const res = await fetch(
    `http://${DEFAULT_RPC.host}:${DEFAULT_RPC.port}/`,
    {
      method:  "POST",
      headers: { "Content-Type": "text/plain", "Authorization": `Basic ${auth}` },
      body,
      signal: AbortSignal.timeout(3000),
    }
  );

  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

// ── Bitcoin Core data ─────────────────────────────────────────────────────────

async function getCoreStatus(): Promise<BitcoinCoreStatus> {
  try {
    const [chainInfo, mempoolInfo, feeEst1, feeEst3, feeEst7] = await Promise.all([
      rpcCall("getblockchaininfo") as Promise<{
        blocks: number; bestblockhash: string; difficulty: number;
      }>,
      rpcCall("getmempoolinfo") as Promise<{
        size: number; bytes: number; usage: number; mempoolminfee: number;
        total_fee: number;
      }>,
      rpcCall("estimatesmartfee", [1]) as Promise<{ feerate?: number }>,
      rpcCall("estimatesmartfee", [3]) as Promise<{ feerate?: number }>,
      rpcCall("estimatesmartfee", [7]) as Promise<{ feerate?: number }>,
    ]);

    const blockHash   = chainInfo.bestblockhash;
    const blockHeader = await rpcCall("getblockheader", [blockHash]) as {
      height: number; time: number; nTx?: number; size?: number;
    };

    const satsPerKb = (feerate?: number) =>
      feerate ? Math.round(feerate * 1e8 / 1000) : 0;

    return {
      connected: true,
      source: "bitcoin-core",
      block: {
        height:     chainInfo.blocks,
        hash:       blockHash,
        time:       blockHeader.time,
        difficulty: chainInfo.difficulty,
        tx_count:   blockHeader.nTx ?? 0,
        size:       blockHeader.size ?? 0,
      },
      fees: {
        fast:   satsPerKb(feeEst1.feerate),
        medium: satsPerKb(feeEst3.feerate),
        slow:   satsPerKb(feeEst7.feerate),
      },
      mempool: {
        tx_count:       mempoolInfo.size,
        vsize_mb:       Math.round(mempoolInfo.bytes / 1e6 * 100) / 100,
        fees_total_btc: mempoolInfo.total_fee ?? 0,
        min_fee:        Math.round((mempoolInfo.mempoolminfee ?? 0) * 1e8 / 1000),
      },
    };
  } catch {
    return getMempoolSpaceStatus();
  }
}

// ── Fallback: mempool.space ───────────────────────────────────────────────────

async function getMempoolSpaceStatus(): Promise<BitcoinCoreStatus> {
  try {
    const [blockTip, fees, mempool] = await Promise.all([
      fetch("https://mempool.space/api/blocks/tip/height",
        { signal: AbortSignal.timeout(5000) }).then(r => r.json()) as Promise<number>,
      fetch("https://mempool.space/api/v1/fees/recommended",
        { signal: AbortSignal.timeout(5000) }).then(r => r.json()) as Promise<{
          fastestFee: number; halfHourFee: number; hourFee: number;
        }>,
      fetch("https://mempool.space/api/mempool",
        { signal: AbortSignal.timeout(5000) }).then(r => r.json()) as Promise<{
          count: number; vsize: number; total_fee: number;
        }>,
    ]);

    const blockHash = await fetch(`https://mempool.space/api/block-height/${blockTip}`,
      { signal: AbortSignal.timeout(5000) }).then(r => r.text());

    return {
      connected: true,
      source: "mempool.space",
      block: {
        height:     blockTip,
        hash:       blockHash,
        time:       Date.now() / 1000,
        difficulty: 0,
        tx_count:   0,
        size:       0,
      },
      fees: {
        fast:   fees.fastestFee,
        medium: fees.halfHourFee,
        slow:   fees.hourFee,
      },
      mempool: {
        tx_count:       mempool.count,
        vsize_mb:       Math.round(mempool.vsize / 1e6 * 100) / 100,
        fees_total_btc: mempool.total_fee / 1e8,
        min_fee:        1,
      },
    };
  } catch (e) {
    return {
      connected: false,
      source:    "mempool.space",
      block:     null,
      fees:      null,
      mempool:   null,
      error:     String(e).slice(0, 100),
    };
  }
}

// ── Genesis anchor hash ───────────────────────────────────────────────────────

export const PROTOCOL_GENESIS_HASH = createHash("sha256")
  .update("aibtc-protocol:genesis:bitcoin:2026")
  .digest("hex");

// ── Singleton refresh ─────────────────────────────────────────────────────────

let _cached: BitcoinCoreStatus | null = null;
let _lastFetch = 0;
const CACHE_MS = 30_000;

export async function getBitcoinStatus(): Promise<BitcoinCoreStatus> {
  if (_cached && Date.now() - _lastFetch < CACHE_MS) return _cached;
  _cached    = await getCoreStatus();
  _lastFetch = Date.now();
  return _cached;
}

export function getCachedBitcoinStatus(): BitcoinCoreStatus | null {
  return _cached;
}
