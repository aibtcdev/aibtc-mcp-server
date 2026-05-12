/**
 * Electrum Protocol Client — Pure P2P Bitcoin Layer
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════
 * SOVEREIGNTY LAYER 2 — Electrum P2P Protocol
 * ══════════════════════════════════════════════════════════════════════
 *
 * "The network is robust in its unstructured simplicity." — Satoshi, 2008
 *
 * Speaks the Electrum JSON-RPC protocol directly over TCP/TLS.
 * No HTTP, no REST, no third-party API — peer-to-peer by design.
 *
 * Fallback position: Bitcoin Core → [HERE] → mempool.space
 *
 * Environment variables:
 *   ELECTRUM_HOST     — server hostname (default: electrum.blockstream.info)
 *   ELECTRUM_PORT     — server port    (default: 50002 for TLS)
 *   ELECTRUM_USE_TLS  — "false" to disable TLS (default: true)
 *
 * Public Electrum servers (mainnet):
 *   electrum.blockstream.info:50002 (TLS)
 *   electrum.emzy.de:50002          (TLS)
 *   fortress.qtornado.com:443       (TLS)
 *
 * Protocol reference:
 *   https://electrumx-spesmilo.readthedocs.io/en/latest/protocol-methods.html
 */

import * as net  from "net";
import * as tls  from "tls";
import { createHash } from "crypto";
import type { Network } from "../config/networks.js";
import type { UTXO, FeeEstimates } from "./mempool-api.js";

// ══════════════════════════════════════════════════════════════════════
// Electrum server configuration
// ══════════════════════════════════════════════════════════════════════

const MAINNET_SERVERS = [
  { host: "electrum.blockstream.info", port: 50002, tls: true  },
  { host: "electrum.emzy.de",          port: 50002, tls: true  },
  { host: "fortress.qtornado.com",     port: 443,   tls: true  },
  { host: "electrum.jochen-hoenicke.de", port: 50006, tls: true },
];

const TESTNET_SERVERS = [
  { host: "electrum.blockstream.info", port: 60002, tls: true },
];

// ══════════════════════════════════════════════════════════════════════
// Electrum JSON-RPC types
// ══════════════════════════════════════════════════════════════════════

interface ElectrumRequest {
  id:      number;
  method:  string;
  params:  unknown[];
}

interface ElectrumResponse {
  id:     number;
  result: unknown;
  error?: { code: number; message: string };
}

interface ElectrumUtxo {
  tx_hash:  string;
  tx_pos:   number;
  value:    number;   // satoshis
  height:   number;   // 0 = unconfirmed
}

interface ElectrumBalance {
  confirmed:   number;  // satoshis
  unconfirmed: number;  // satoshis
}

// ══════════════════════════════════════════════════════════════════════
// Address → scripthash conversion (Electrum's addressing scheme)
// ══════════════════════════════════════════════════════════════════════

/**
 * Convert a Bitcoin address to Electrum scripthash.
 *
 * Electrum identifies addresses by SHA256(scriptPubKey), reversed to hex.
 * This lets the server look up any address type without knowing the address format.
 *
 * Supports:
 *   P2WPKH  — bc1q... / tb1q... (native SegWit)
 *   P2PKH   — 1...   / m.../n... (legacy)
 *   P2SH    — 3...   / 2...      (script hash)
 *   P2TR    — bc1p... / tb1p... (Taproot)
 */
function addressToScripthash(address: string): string {
  const scriptPubKey = addressToScriptPubKey(address);
  const hash = createHash("sha256").update(scriptPubKey).digest();
  // Electrum uses reversed byte order (little-endian)
  return Buffer.from(hash).reverse().toString("hex");
}

/**
 * Derive scriptPubKey bytes from a Bitcoin address.
 * Uses @scure/btc-signer for address decoding — same library as transaction building.
 */
function addressToScriptPubKey(address: string): Uint8Array {
  // Use @scure/btc-signer's Address decoder for all address types
  // This handles P2WPKH, P2PKH, P2SH, P2TR, P2WSH correctly
  const btc = require("@scure/btc-signer") as typeof import("@scure/btc-signer");

  // Detect network from address prefix
  const isTestnet = address.startsWith("tb1") ||
                    address.startsWith("m")   ||
                    address.startsWith("n")   ||
                    address.startsWith("2");

  const network = isTestnet ? btc.TEST_NETWORK : btc.NETWORK;

  const decoded = btc.Address(network).decode(address);
  const script  = btc.OutScript.encode(decoded);
  return script;
}

// ══════════════════════════════════════════════════════════════════════
// Electrum TCP/TLS connection
// ══════════════════════════════════════════════════════════════════════

class ElectrumConnection {
  private socket:   net.Socket | tls.TLSSocket | null = null;
  private buffer:   string = "";
  private id:       number = 1;
  private pending:  Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
  private connected: boolean = false;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly useTls: boolean,
  ) {}

  async connect(timeoutMs = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`Electrum connection timeout to ${this.host}:${this.port}`));
      }, timeoutMs);

      const onConnect = () => {
        clearTimeout(timer);
        this.connected = true;
        resolve();
      };

      const onError = (err: Error) => {
        clearTimeout(timer);
        this.connected = false;
        reject(new Error(`Electrum connection error: ${err.message}`));
      };

      if (this.useTls) {
        this.socket = tls.connect(
          { host: this.host, port: this.port, rejectUnauthorized: false },
          onConnect,
        );
      } else {
        this.socket = net.connect({ host: this.host, port: this.port }, onConnect);
      }

      this.socket.on("error", onError);
      this.socket.on("data",  (chunk: Buffer) => this._onData(chunk));
      this.socket.on("close", () => {
        this.connected = false;
        // Reject all pending requests
        for (const [, { reject: rej }] of this.pending) {
          rej(new Error("Electrum connection closed"));
        }
        this.pending.clear();
      });
    });
  }

  private _onData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf8");
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as ElectrumResponse;
        const handler = this.pending.get(msg.id);
        if (!handler) continue;
        this.pending.delete(msg.id);
        if (msg.error) {
          handler.reject(new Error(`Electrum RPC [${msg.error.code}]: ${msg.error.message}`));
        } else {
          handler.resolve(msg.result);
        }
      } catch {
        // Unparseable line — ignore (could be a server notification)
      }
    }
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.connected || !this.socket) {
      throw new Error("Electrum: not connected");
    }

    const id = this.id++;
    const req: ElectrumRequest = { id, method, params };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
      });

      const line = JSON.stringify(req) + "\n";
      this.socket!.write(line, "utf8", (err) => {
        if (err) {
          this.pending.delete(id);
          reject(new Error(`Electrum write error: ${err.message}`));
        }
      });

      // Per-request timeout (30s)
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Electrum RPC timeout for method "${method}"`));
        }
      }, 30_000);
    });
  }

  disconnect(): void {
    this.connected = false;
    this.socket?.destroy();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ══════════════════════════════════════════════════════════════════════
// Electrum Client — high-level API
// ══════════════════════════════════════════════════════════════════════

export class ElectrumClient {
  private conn:    ElectrumConnection | null = null;
  private network: Network;

  constructor(network: Network) {
    this.network = network;
  }

  private getServers() {
    const envHost = process.env.ELECTRUM_HOST;
    const envPort = parseInt(process.env.ELECTRUM_PORT ?? "50002");
    const envTls  = process.env.ELECTRUM_USE_TLS !== "false";

    if (envHost) {
      return [{ host: envHost, port: envPort, tls: envTls }];
    }

    return this.network === "mainnet" ? MAINNET_SERVERS : TESTNET_SERVERS;
  }

  /**
   * Establish connection to the first reachable Electrum server.
   * Tries each server in sequence — sovereign fallback chain.
   */
  async connect(): Promise<void> {
    if (this.conn?.isConnected()) return;

    const servers = this.getServers();
    let lastError: Error = new Error("No Electrum servers available");

    for (const srv of servers) {
      try {
        const conn = new ElectrumConnection(srv.host, srv.port, srv.tls);
        await conn.connect(8_000);

        // Electrum handshake: server.version negotiation
        await conn.call<[string, string]>("server.version", [
          "flying-whale-mcp/1.0",
          ["1.4", "1.4.2"],
        ]);

        this.conn = conn;
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(`Electrum: could not connect to any server — ${lastError.message}`);
  }

  private async rpc<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.conn?.isConnected()) {
      await this.connect();
    }
    return this.conn!.call<T>(method, params);
  }

  // ── UTXOs ─────────────────────────────────────────────────────────

  /**
   * Get UTXOs for a Bitcoin address.
   * Uses blockchain.scripthash.listunspent — Satoshi's UTXO model.
   */
  async getUtxos(address: string): Promise<UTXO[]> {
    const scripthash = addressToScripthash(address);
    const utxos = await this.rpc<ElectrumUtxo[]>(
      "blockchain.scripthash.listunspent",
      [scripthash],
    );

    return utxos.map((u) => ({
      txid:  u.tx_hash,
      vout:  u.tx_pos,
      value: u.value,
      status: {
        confirmed:    u.height > 0,
        block_height: u.height > 0 ? u.height : undefined,
      },
    }));
  }

  // ── Balance ────────────────────────────────────────────────────────

  /**
   * Get confirmed + unconfirmed balance for an address.
   * Uses blockchain.scripthash.get_balance — O(1), no UTXO enumeration.
   */
  async getBalance(address: string): Promise<{
    confirmed:   number;
    unconfirmed: number;
    total:       number;
  }> {
    const scripthash = addressToScripthash(address);
    const bal = await this.rpc<ElectrumBalance>(
      "blockchain.scripthash.get_balance",
      [scripthash],
    );

    return {
      confirmed:   bal.confirmed,
      unconfirmed: bal.unconfirmed,
      total:       bal.confirmed + bal.unconfirmed,
    };
  }

  // ── Fee Estimates ──────────────────────────────────────────────────

  /**
   * Get fee estimates from Electrum.
   * Uses blockchain.estimatefee for multiple confirmation targets.
   * Returns BTC/kB → converted to sat/vB.
   */
  async getFeeEstimates(): Promise<FeeEstimates> {
    const [fast, medium, slow, economy] = await Promise.allSettled([
      this.rpc<number>("blockchain.estimatefee", [1]),
      this.rpc<number>("blockchain.estimatefee", [3]),
      this.rpc<number>("blockchain.estimatefee", [6]),
      this.rpc<number>("blockchain.estimatefee", [144]),
    ]);

    const toSatVb = (r: PromiseSettledResult<number>, fallback: number): number => {
      if (r.status === "rejected" || r.value <= 0) return fallback;
      return Math.ceil((r.value * 1e8) / 1000);  // BTC/kB → sat/vB
    };

    const fastestFee  = toSatVb(fast,    20);
    const halfHourFee = toSatVb(medium,  10);
    const hourFee     = toSatVb(slow,     5);
    const economyFee  = toSatVb(economy,  2);

    return {
      fastestFee,
      halfHourFee,
      hourFee,
      economyFee,
      minimumFee: Math.min(economyFee, 1),
    };
  }

  // ── Broadcast ──────────────────────────────────────────────────────

  /**
   * Broadcast a signed raw transaction to the Bitcoin network.
   * Goes to the Electrum server which relays to full nodes.
   * Satoshi: no trusted third party — the peer network handles it.
   */
  async broadcast(rawTxHex: string): Promise<string> {
    const txid = await this.rpc<string>(
      "blockchain.transaction.broadcast",
      [rawTxHex],
    );
    return txid;
  }

  // ── Raw Transaction ────────────────────────────────────────────────

  /**
   * Fetch raw transaction hex by txid.
   * Uses blockchain.transaction.get — available on all Electrum servers.
   */
  async getTxHex(txid: string): Promise<string> {
    const hex = await this.rpc<string>(
      "blockchain.transaction.get",
      [txid, false],  // verbose=false → returns hex string
    );
    return hex;
  }

  // ── Block Headers ──────────────────────────────────────────────────

  /**
   * Get the current blockchain tip (best block height + hash).
   */
  async getTip(): Promise<{ height: number; hex: string }> {
    const tip = await this.rpc<{ height: number; hex: string }>(
      "blockchain.headers.subscribe",
      [],
    );
    return tip;
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  disconnect(): void {
    this.conn?.disconnect();
    this.conn = null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// Singleton factory
// ══════════════════════════════════════════════════════════════════════

let _mainnetClient: ElectrumClient | null = null;
let _testnetClient: ElectrumClient | null = null;

export function getElectrumClient(network: Network): ElectrumClient {
  if (network === "mainnet") {
    if (!_mainnetClient) _mainnetClient = new ElectrumClient("mainnet");
    return _mainnetClient;
  }
  if (!_testnetClient) _testnetClient = new ElectrumClient("testnet");
  return _testnetClient;
}
