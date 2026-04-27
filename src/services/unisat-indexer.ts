/**
 * Unisat Indexer Service
 *
 * Provides rune and inscription indexing via Unisat Open API:
 * - Mainnet: https://open-api.unisat.io
 * - Testnet: https://open-api-testnet.unisat.io
 *
 * Auth: Authorization: Bearer ${UNISAT_API_KEY}
 */

import type { Network } from "../config/networks.js";
import type { UTXO } from "./mempool-api.js";
import { MempoolApi } from "./mempool-api.js";

// ---------------------------------------------------------------------------
// Unisat API types
// ---------------------------------------------------------------------------

export interface UnisatInscription {
  inscriptionId: string;
  inscriptionNumber: number;
  address: string;
  outputValue: number;
  contentType: string;
  contentLength: number;
  timestamp: number;
  genesisTransaction: string;
  location: string;
  output: string;
  offset: number;
}

interface UnisatInscriptionDataResponse {
  code: number;
  msg: string;
  data: {
    cursor: number;
    total: number;
    totalConfirmed: number;
    totalUnconfirmed: number;
    totalUnconfirmedSpend: number;
    inscription: UnisatInscription[];
  };
}

export interface UnisatRuneBalance {
  rune: string;
  runeid: string;
  spacedRune: string;
  amount: string;
  symbol: string;
  divisibility: number;
}

interface UnisatRuneBalanceResponse {
  code: number;
  msg: string;
  data: {
    start: number;
    total: number;
    detail: UnisatRuneBalance[];
  };
}

export interface UnisatRuneUtxo {
  txid: string;
  vout: number;
  satoshi: number;
  scriptType: string;
  scriptPk: string;
  codeType: number;
  address: string;
  height: number;
  idx: number;
  isOpInRBF: boolean;
  isSpent: boolean;
  runes: {
    rune: string;
    runeid: string;
    spacedRune: string;
    amount: string;
    symbol: string;
    divisibility: number;
  }[];
}

interface UnisatRuneUtxoResponse {
  code: number;
  msg: string;
  data: {
    start: number;
    total: number;
    utxo: UnisatRuneUtxo[];
  };
}

export interface ClassifiedUtxos {
  /** Cardinal UTXOs — safe to spend (no inscriptions or runes) */
  cardinal: UTXO[];
  /** Inscription UTXOs — contain ordinal inscriptions */
  inscription: UTXO[];
  /** Rune UTXOs — contain rune balances */
  rune: UTXO[];
}

export class UnisatApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "UnisatApiError";
  }
}

// ---------------------------------------------------------------------------
// UnisatIndexer
// ---------------------------------------------------------------------------

export class UnisatIndexer {
  private readonly network: Network;
  private readonly mempoolApi: MempoolApi;
  private readonly apiBase: string;

  constructor(network: Network) {
    this.network = network;
    this.mempoolApi = new MempoolApi(network);
    this.apiBase =
      network === "mainnet"
        ? "https://open-api.unisat.io"
        : "https://open-api-testnet.unisat.io";
  }

  private headers(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.UNISAT_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.UNISAT_API_KEY}`;
    }
    return headers;
  }

  // -------------------------------------------------------------------------
  // Runes
  // -------------------------------------------------------------------------

  /**
   * Get rune balances for a Bitcoin address.
   */
  async getRuneBalances(address: string): Promise<UnisatRuneBalance[]> {
    const all: UnisatRuneBalance[] = [];
    let start = 0;
    const limit = 100;

    while (true) {
      const url = `${this.apiBase}/v1/indexer/address/${address}/runes/balance-list?start=${start}&limit=${limit}`;
      const response = await fetch(url, { headers: this.headers() });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new UnisatApiError(
          `Unisat API error: ${response.status} ${response.statusText} - ${errorText}`,
          response.status
        );
      }

      const json = (await response.json()) as UnisatRuneBalanceResponse;

      if (json.code !== 0) {
        throw new UnisatApiError(`Unisat API error: ${json.msg}`, json.code);
      }

      all.push(...json.data.detail);

      if (all.length >= json.data.total) {
        break;
      }

      start += limit;
    }

    return all;
  }

  /**
   * Get rune-bearing UTXOs for a specific rune on a Bitcoin address.
   */
  async getRuneUtxos(address: string, runeid: string): Promise<UnisatRuneUtxo[]> {
    const all: UnisatRuneUtxo[] = [];
    let start = 0;
    const limit = 100;

    while (true) {
      const url = `${this.apiBase}/v1/indexer/address/${address}/runes/${runeid}/utxo?start=${start}&limit=${limit}`;
      const response = await fetch(url, { headers: this.headers() });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new UnisatApiError(
          `Unisat API error: ${response.status} ${response.statusText} - ${errorText}`,
          response.status
        );
      }

      const json = (await response.json()) as UnisatRuneUtxoResponse;

      if (json.code !== 0) {
        throw new UnisatApiError(`Unisat API error: ${json.msg}`, json.code);
      }

      all.push(...json.data.utxo);

      if (all.length >= json.data.total) {
        break;
      }

      start += limit;
    }

    return all;
  }

  /**
   * Get all rune-bearing UTXOs for all runes on a Bitcoin address.
   */
  async getAllRuneUtxos(address: string): Promise<UnisatRuneUtxo[]> {
    const balances = await this.getRuneBalances(address);
    const allUtxos: UnisatRuneUtxo[] = [];

    for (const balance of balances) {
      const utxos = await this.getRuneUtxos(address, balance.runeid);
      allUtxos.push(...utxos);
    }

    return allUtxos;
  }

  // -------------------------------------------------------------------------
  // Inscriptions
  // -------------------------------------------------------------------------

  /**
   * Get all inscriptions for a Bitcoin address via Unisat API.
   */
  async getInscriptionsForAddress(address: string): Promise<UnisatInscription[]> {
    const all: UnisatInscription[] = [];
    let cursor = 0;
    const size = 100;

    while (true) {
      const url = `${this.apiBase}/v1/indexer/address/${address}/inscription-data?cursor=${cursor}&size=${size}`;
      const response = await fetch(url, { headers: this.headers() });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new UnisatApiError(
          `Unisat API error: ${response.status} ${response.statusText} - ${errorText}`,
          response.status
        );
      }

      const json = (await response.json()) as UnisatInscriptionDataResponse;

      if (json.code !== 0) {
        throw new UnisatApiError(`Unisat API error: ${json.msg}`, json.code);
      }

      all.push(...json.data.inscription);

      if (all.length >= json.data.total) {
        break;
      }

      cursor += size;
    }

    return all;
  }

  // -------------------------------------------------------------------------
  // UTXO Classification
  // -------------------------------------------------------------------------

  /**
   * Classify UTXOs into cardinal, inscription, and rune categories.
   */
  async classifyUtxos(address: string): Promise<ClassifiedUtxos> {
    const [utxos, inscriptions, runeUtxos] = await Promise.all([
      this.mempoolApi.getUtxos(address),
      this.getInscriptionsForAddress(address),
      this.getAllRuneUtxos(address),
    ]);

    const inscriptionOutputs = new Set<string>(
      inscriptions.map((ins) => ins.output)
    );
    const runeOutputs = new Set<string>(
      runeUtxos.map((u) => `${u.txid}:${u.vout}`)
    );

    const cardinal: UTXO[] = [];
    const inscription: UTXO[] = [];
    const rune: UTXO[] = [];

    for (const utxo of utxos) {
      const outputRef = `${utxo.txid}:${utxo.vout}`;
      if (inscriptionOutputs.has(outputRef)) {
        inscription.push(utxo);
      } else if (runeOutputs.has(outputRef)) {
        rune.push(utxo);
      } else {
        cardinal.push(utxo);
      }
    }

    return { cardinal, inscription, rune };
  }

  /**
   * Get cardinal UTXOs (safe to spend — no inscriptions or runes).
   */
  async getCardinalUtxos(address: string): Promise<UTXO[]> {
    const classified = await this.classifyUtxos(address);
    return classified.cardinal;
  }

  /**
   * Get UTXOs that contain inscriptions or runes (do not spend).
   * Returned in a stable order: inscription UTXOs first, then rune UTXOs.
   */
  async getOrdinalUtxos(address: string): Promise<UTXO[]> {
    const classified = await this.classifyUtxos(address);
    return [...classified.inscription, ...classified.rune];
  }
}
