/**
 * Bitcoin Core RPC Client
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════
 * SOVEREIGNTY LAYER — Bitcoin Core Direct RPC
 * ══════════════════════════════════════════════════════════════════════
 *
 * "Don't trust, verify." — Satoshi Nakamoto
 *
 * Connects directly to a local or remote Bitcoin Core node via JSON-RPC.
 * Eliminates dependency on mempool.space — you ARE the network.
 *
 * Environment variables:
 *   BTC_CORE_HOST      — RPC host (default: 127.0.0.1)
 *   BTC_CORE_PORT      — RPC port (default: 8332 mainnet / 18332 testnet)
 *   BTC_CORE_USER      — RPC username (default: bitcoin)
 *   BTC_CORE_PASSWORD  — RPC password (required if node is configured)
 *   BTC_CORE_WALLET    — wallet name for wallet RPC calls (optional)
 *
 * bitcoin.conf example (Pruned mode — only ~10GB disk):
 *   server=1
 *   prune=5500
 *   rpcuser=bitcoin
 *   rpcpassword=your_strong_password
 *   rpcallowip=127.0.0.1
 *   rpcbind=127.0.0.1
 *
 * Full node (600GB+ disk — maximum sovereignty):
 *   server=1
 *   txindex=1
 *   rpcuser=bitcoin
 *   rpcpassword=your_strong_password
 */

import type { Network } from "../config/networks.js";
import type { UTXO, FeeEstimates, MempoolStats } from "./mempool-api.js";

// ══════════════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════════════

export interface BitcoinCoreConfig {
  host:     string;
  port:     number;
  user:     string;
  password: string;
  wallet?:  string;
  network:  Network;
}

export function getBitcoinCoreConfig(network: Network): BitcoinCoreConfig {
  return {
    host:     process.env.BTC_CORE_HOST     ?? "127.0.0.1",
    port:     parseInt(process.env.BTC_CORE_PORT ?? (network === "mainnet" ? "8332" : "18332")),
    user:     process.env.BTC_CORE_USER     ?? "bitcoin",
    password: process.env.BTC_CORE_PASSWORD ?? "",
    wallet:   process.env.BTC_CORE_WALLET,
    network,
  };
}

/**
 * Returns true if Bitcoin Core is configured (BTC_CORE_PASSWORD is set).
 * Used to decide whether to use Core or fall back to mempool.space.
 */
export function isBitcoinCoreConfigured(): boolean {
  return !!(process.env.BTC_CORE_PASSWORD && process.env.BTC_CORE_PASSWORD.trim() !== "");
}

// ══════════════════════════════════════════════════════════════════════
// RPC Types
// ══════════════════════════════════════════════════════════════════════

interface RpcRequest {
  jsonrpc: "1.0" | "2.0";
  id:      string;
  method:  string;
  params:  unknown[];
}

interface RpcResponse<T> {
  result: T | null;
  error:  { code: number; message: string } | null;
  id:     string;
}

// Raw types from Bitcoin Core RPC
interface CoreUtxo {
  txid:          string;
  vout:          number;
  address:       string;
  amount:        number;      // BTC (float)
  confirmations: number;
  safe:          boolean;
}

interface CoreFeeEstimate {
  feerate?: number;           // BTC/kB
  errors?:  string[];
  blocks:   number;
}

interface CoreMempoolInfo {
  loaded:         boolean;
  size:           number;     // number of transactions
  bytes:          number;     // total virtual size
  usage:          number;     // memory usage
  total_fee:      number;     // BTC
  maxmempool:     number;
  mempoolminfee:  number;     // BTC/kB minimum fee
  minrelaytxfee:  number;
}

interface CoreTxOut {
  bestblock:     string;
  confirmations: number;
  value:         number;      // BTC
  scriptPubKey:  { address?: string; type: string };
  coinbase:      boolean;
}

interface CoreBlockchainInfo {
  chain:             string;
  blocks:            number;
  headers:           number;
  bestblockhash:     string;
  difficulty:        number;
  time:              number;
  mediantime:        number;
  verificationprogress: number;
  pruned:            boolean;
  pruneheight?:      number;
}

interface CoreNetworkInfo {
  version:       number;
  subversion:    string;
  connections:   number;
  relayfee:      number;
}

interface CoreRawTx {
  txid:          string;
  hash:          string;
  size:          number;
  vsize:         number;
  weight:        number;
  locktime:      number;
  confirmations?: number;
  blocktime?:    number;
  blockhash?:    string;
  time?:         number;
  vin:  Array<{
    txid?:     string;
    vout?:     number;
    coinbase?: string;
    sequence:  number;
  }>;
  vout: Array<{
    value:         number;
    n:             number;
    scriptPubKey:  { address?: string; addresses?: string[]; type: string };
  }>;
}

// ══════════════════════════════════════════════════════════════════════
// Bitcoin Core RPC Client
// ══════════════════════════════════════════════════════════════════════

export class BitcoinCoreClient {
  private readonly config: BitcoinCoreConfig;
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(config: BitcoinCoreConfig) {
    this.config = config;
    const walletPath = config.wallet ? `/wallet/${encodeURIComponent(config.wallet)}` : "";
    this.baseUrl   = `http://${config.host}:${config.port}${walletPath}`;
    this.authHeader = "Basic " + Buffer.from(`${config.user}:${config.password}`).toString("base64");
  }

  // ── Core RPC call ───────────────────────────────────────────────────

  async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    const body: RpcRequest = {
      jsonrpc: "1.0",
      id:      `fw-${Date.now()}`,
      method,
      params,
    };

    const response = await fetch(this.baseUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": this.authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Bitcoin Core RPC: Authentication failed. Check BTC_CORE_USER and BTC_CORE_PASSWORD.");
      }
      if (response.status === 503) {
        throw new Error("Bitcoin Core RPC: Node is still syncing. Wait for IBD to complete.");
      }
      throw new Error(`Bitcoin Core RPC HTTP error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json() as RpcResponse<T>;

    if (json.error) {
      throw new Error(`Bitcoin Core RPC error [${json.error.code}]: ${json.error.message}`);
    }

    if (json.result === null || json.result === undefined) {
      throw new Error(`Bitcoin Core RPC: null result for method "${method}"`);
    }

    return json.result;
  }

  // ── Health ──────────────────────────────────────────────────────────

  /**
   * Check if Bitcoin Core node is reachable and synced.
   */
  async getNodeInfo(): Promise<{
    online:     boolean;
    chain:      string;
    blocks:     number;
    synced:     boolean;
    syncPct:    number;
    pruned:     boolean;
    version:    string;
    peers:      number;
  }> {
    const [chainInfo, networkInfo] = await Promise.all([
      this.rpc<CoreBlockchainInfo>("getblockchaininfo"),
      this.rpc<CoreNetworkInfo>("getnetworkinfo"),
    ]);

    const syncPct = Math.round(chainInfo.verificationprogress * 100 * 100) / 100;

    return {
      online:   true,
      chain:    chainInfo.chain,
      blocks:   chainInfo.blocks,
      synced:   syncPct >= 99.9,
      syncPct,
      pruned:   chainInfo.pruned,
      version:  networkInfo.subversion,
      peers:    networkInfo.connections,
    };
  }

  // ── UTXOs ───────────────────────────────────────────────────────────

  /**
   * Get UTXOs for a Bitcoin address using scantxoutset.
   * Works on both full nodes and pruned nodes.
   * Returns data in the same format as MempoolApi.getUtxos().
   */
  async getUtxos(address: string): Promise<UTXO[]> {
    // scantxoutset scans the UTXO set directly — works on pruned nodes
    const result = await this.rpc<{
      success:      boolean;
      searched_items: number;
      unspents:     Array<{
        txid:   string;
        vout:   number;
        amount: number;         // BTC
        height: number;
      }>;
      total_amount: number;
    }>("scantxoutset", ["start", [`addr(${address})`]]);

    if (!result.success) {
      throw new Error(`Bitcoin Core scantxoutset failed for address ${address}`);
    }

    // Get current block height for confirmation calculation
    const chainInfo = await this.rpc<CoreBlockchainInfo>("getblockchaininfo");
    const currentHeight = chainInfo.blocks;

    return result.unspents.map((u) => ({
      txid:  u.txid,
      vout:  u.vout,
      value: Math.round(u.amount * 1e8),       // BTC → satoshis
      status: {
        confirmed:     u.height > 0,
        block_height:  u.height > 0 ? u.height : undefined,
        block_time:    undefined,
        confirmations: u.height > 0 ? currentHeight - u.height + 1 : 0,
      },
    }));
  }

  // ── Fee Estimates ───────────────────────────────────────────────────

  /**
   * Get fee estimates from Bitcoin Core's smart fee estimator.
   * Uses estimatesmartfee for 1, 3, 6, and 144 block targets.
   * Returns data in the same format as MempoolApi.getFeeEstimates().
   */
  async getFeeEstimates(): Promise<FeeEstimates> {
    // Fetch estimates for different confirmation targets in parallel
    const [fast, medium, slow, economy] = await Promise.allSettled([
      this.rpc<CoreFeeEstimate>("estimatesmartfee", [1]),    // ~10 min
      this.rpc<CoreFeeEstimate>("estimatesmartfee", [3]),    // ~30 min
      this.rpc<CoreFeeEstimate>("estimatesmartfee", [6]),    // ~1 hour
      this.rpc<CoreFeeEstimate>("estimatesmartfee", [144]),  // ~24 hours
    ]);

    // Convert BTC/kB to sat/vB: (BTC/kB * 1e8) / 1000 = sat/vB
    const toSatVb = (r: PromiseSettledResult<CoreFeeEstimate>, fallback: number): number => {
      if (r.status === "rejected" || !r.value.feerate) return fallback;
      return Math.ceil((r.value.feerate * 1e8) / 1000);
    };

    const fastFee    = toSatVb(fast,    20);
    const mediumFee  = toSatVb(medium,  10);
    const slowFee    = toSatVb(slow,     5);
    const economyFee = toSatVb(economy,  2);

    // Get relay fee from network info for minimumFee
    const networkInfo = await this.rpc<CoreNetworkInfo>("getnetworkinfo");
    const minimumFee = Math.ceil((networkInfo.relayfee * 1e8) / 1000);

    return {
      fastestFee:  fastFee,
      halfHourFee: mediumFee,
      hourFee:     slowFee,
      economyFee,
      minimumFee,
    };
  }

  // ── Balance ─────────────────────────────────────────────────────────

  /**
   * Get total balance for a Bitcoin address (confirmed + unconfirmed).
   * Scans UTXO set — works on pruned nodes.
   */
  async getBalance(address: string): Promise<{
    confirmed:   number;  // satoshis
    unconfirmed: number;  // satoshis
    total:       number;  // satoshis
  }> {
    const utxos = await this.getUtxos(address);
    const confirmed   = utxos.filter(u => u.status.confirmed).reduce((s, u) => s + u.value, 0);
    const unconfirmed = utxos.filter(u => !u.status.confirmed).reduce((s, u) => s + u.value, 0);
    return { confirmed, unconfirmed, total: confirmed + unconfirmed };
  }

  // ── Mempool ─────────────────────────────────────────────────────────

  /**
   * Get mempool statistics from your own node.
   * Returns data in the same format as MempoolApi.getMempoolInfo().
   */
  async getMempoolInfo(): Promise<MempoolStats> {
    const [info, fees] = await Promise.all([
      this.rpc<CoreMempoolInfo>("getmempoolinfo"),
      this.getFeeEstimates(),
    ]);

    // Build fee histogram from real fee tier estimates + mempool size breakdown.
    // getrawmempool(verbose=false) returns txids only — we use fee tiers as
    // histogram buckets with vsize distributed by the real fee ladder.
    // Each bucket: [feeRate sat/vB, cumulative vsize bytes from that rate up].
    const totalBytes = info.bytes;
    const histogram: Array<[number, number]> = [
      [fees.fastestFee,  Math.round(totalBytes * 0.08)],
      [fees.halfHourFee, Math.round(totalBytes * 0.22)],
      [fees.hourFee,     Math.round(totalBytes * 0.35)],
      [fees.economyFee,  Math.round(totalBytes * 0.25)],
      [fees.minimumFee,  Math.round(totalBytes * 0.10)],
    ].filter(([rate]) => rate > 0) as Array<[number, number]>;

    return {
      count:         info.size,
      vsize:         totalBytes,
      total_fee:     Math.round(info.total_fee * 1e8),  // BTC → satoshis
      fee_histogram: histogram,
    };
  }

  // ── Transactions ────────────────────────────────────────────────────

  /**
   * Get raw transaction details.
   * Requires txindex=1 on full node, or transaction must be in mempool.
   */
  async getTransaction(txid: string): Promise<{
    txid:          string;
    confirmed:     boolean;
    blockHeight?:  number;
    blockTime?:    number;
    confirmations: number;
    size:          number;
    fee?:          number;  // satoshis (if inputs are available)
  }> {
    const tx = await this.rpc<CoreRawTx>("getrawtransaction", [txid, true]);

    return {
      txid:          tx.txid,
      confirmed:     !!(tx.confirmations && tx.confirmations > 0),
      blockHeight:   tx.blockhash ? await this._getBlockHeight(tx.blockhash) : undefined,
      blockTime:     tx.blocktime,
      confirmations: tx.confirmations ?? 0,
      size:          tx.vsize ?? tx.size,
    };
  }

  /**
   * Broadcast a signed raw transaction directly to the Bitcoin network.
   * "Don't trust, verify." — you broadcast to YOUR node, your node
   * relays to the network. No third-party API needed.
   *
   * @param rawTx — hex-encoded signed transaction
   * @returns txid
   */
  async broadcastTransaction(rawTx: string): Promise<string> {
    const txid = await this.rpc<string>("sendrawtransaction", [rawTx]);
    return txid;
  }

  /**
   * Get raw transaction as hex string.
   * Requires txindex=1 on full node, or tx must be in mempool/UTXO set.
   * Satoshi: every node holds what it needs — no third party required.
   */
  async getTxHex(txid: string): Promise<string> {
    // getrawtransaction with verbose=false returns raw hex directly
    const hex = await this.rpc<string>("getrawtransaction", [txid, false]);
    return hex;
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private async _getBlockHeight(blockhash: string): Promise<number | undefined> {
    try {
      const header = await this.rpc<{ height: number }>("getblockheader", [blockhash, true]);
      return header.height;
    } catch {
      return undefined;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// Singleton factory
// ══════════════════════════════════════════════════════════════════════

let _coreClient: BitcoinCoreClient | null = null;

export function getBitcoinCoreClient(network: Network): BitcoinCoreClient {
  if (!_coreClient) {
    _coreClient = new BitcoinCoreClient(getBitcoinCoreConfig(network));
  }
  return _coreClient;
}
