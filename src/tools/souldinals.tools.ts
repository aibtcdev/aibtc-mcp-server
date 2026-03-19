/**
 * Souldinals tools
 *
 * MCP tools for managing Souldinals — soul.md files inscribed as child ordinal
 * inscriptions on Bitcoin L1. Provides:
 *
 * - souldinals_inscribe_soul: Step 1 — Broadcast commit tx for a soul child inscription
 * - souldinals_reveal_soul: Step 2 — Broadcast reveal tx after commit confirms
 * - souldinals_list_souls: List soul inscriptions (text/markdown) owned by a Taproot address
 * - souldinals_load_soul: Load the oldest soul inscription content from a Taproot address
 * - souldinals_display_soul: Fetch and parse soul traits from a specific inscription
 *
 * Uses child inscription builders for on-chain provenance (parent-child relationship)
 * and Unisat Ordinals API for listing/loading inscriptions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import { getWalletManager } from "../services/wallet-manager.js";
import type { InscriptionData } from "../transactions/inscription-builder.js";
import { signBtcTransaction } from "../transactions/bitcoin-builder.js";
import {
  buildChildCommitTransaction,
  buildChildRevealTransaction,
  deriveChildRevealScript,
  lookupParentInscription,
} from "../transactions/child-inscription-builder.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOUL_CONTENT_TYPE = "text/markdown";
const UNISAT_API_BASE = "https://open-api.unisat.io";

// ---------------------------------------------------------------------------
// Unisat API helpers
// ---------------------------------------------------------------------------

function unisatHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.UNISAT_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.UNISAT_API_KEY}`;
  }
  return headers;
}

interface UnisatInscription {
  inscriptionId: string;
  inscriptionNumber: number;
  contentType: string;
  contentLength: number;
  timestamp: number;
  genesisBlockHeight: number;
}

/**
 * Fetch soul inscriptions (text/markdown) for a Taproot address from Unisat.
 */
async function fetchSoulInscriptions(
  address: string
): Promise<
  Array<{
    id: string;
    number: number;
    contentType: string;
    contentLength: number;
    timestamp: string;
    genesisBlockHeight: number;
  }>
> {
  const url = `${UNISAT_API_BASE}/v1/indexer/address/${address}/inscription-data?cursor=0&size=60`;
  const response = await fetch(url, { headers: unisatHeaders() });

  if (!response.ok) {
    throw new Error(
      `Unisat API error ${response.status}: ${await response.text()}`
    );
  }

  const data = (await response.json()) as {
    code: number;
    data: { inscription: UnisatInscription[] };
  };
  const items = data.data?.inscription ?? [];

  return items
    .filter((item) => item.contentType === SOUL_CONTENT_TYPE)
    .map((item) => ({
      id: item.inscriptionId,
      number: item.inscriptionNumber,
      contentType: item.contentType,
      contentLength: item.contentLength,
      timestamp: new Date(item.timestamp * 1000).toISOString(),
      genesisBlockHeight: item.genesisBlockHeight,
    }));
}

/**
 * Fetch raw inscription content from Unisat.
 */
async function fetchInscriptionContent(
  inscriptionId: string
): Promise<string> {
  const url = `${UNISAT_API_BASE}/v1/indexer/inscription/content/${encodeURIComponent(inscriptionId)}`;
  const response = await fetch(url, { headers: unisatHeaders() });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch inscription content (${response.status}): ${await response.text()}`
    );
  }

  return await response.text();
}

/**
 * Fetch inscription metadata from Unisat.
 */
async function fetchInscriptionMetadata(
  inscriptionId: string
): Promise<{
  contentType: string;
  contentLength: number;
  timestamp: string;
  genesisBlockHeight: number;
}> {
  const url = `${UNISAT_API_BASE}/v1/indexer/inscription/info/${encodeURIComponent(inscriptionId)}`;
  const response = await fetch(url, { headers: unisatHeaders() });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch inscription metadata (${response.status}): ${await response.text()}`
    );
  }

  const data = (await response.json()) as {
    code: number;
    data: UnisatInscription;
  };
  const item = data.data;

  return {
    contentType: item.contentType,
    contentLength: item.contentLength,
    timestamp: new Date(item.timestamp * 1000).toISOString(),
    genesisBlockHeight: item.genesisBlockHeight,
  };
}

// ---------------------------------------------------------------------------
// Soul trait parser
// ---------------------------------------------------------------------------

interface SoulTraits {
  name?: string;
  description?: string;
  values: string[];
  focusAreas: string[];
  sections: Record<string, string>;
}

/**
 * Parse soul traits from Markdown content.
 * Extracts name (first H1), description (first paragraph after H1),
 * values (list items under "Values" or "Core Values" heading),
 * focus areas (list items under "Focus" or "Focus Areas" heading),
 * and all named sections.
 */
function parseSoulTraits(markdown: string): SoulTraits {
  const lines = markdown.split("\n");

  let name: string | undefined;
  let description: string | undefined;
  const sections: Record<string, string> = {};
  const values: string[] = [];
  const focusAreas: string[] = [];

  let currentSection: string | null = null;
  let sectionLines: string[] = [];
  let afterFirstH1 = false;
  const descriptionLines: string[] = [];
  let inDescriptionBlock = false;

  for (const line of lines) {
    // H1 heading — treat as name
    if (line.startsWith("# ")) {
      if (currentSection !== null) {
        sections[currentSection] = sectionLines.join("\n").trim();
        sectionLines = [];
      }
      if (!name) {
        name = line.replace(/^# /, "").trim();
        afterFirstH1 = true;
        inDescriptionBlock = true;
      } else {
        currentSection = line.replace(/^# /, "").trim();
      }
      continue;
    }

    // H2/H3 headings — section boundaries
    if (line.startsWith("## ") || line.startsWith("### ")) {
      if (currentSection !== null) {
        sections[currentSection] = sectionLines.join("\n").trim();
      }
      currentSection = line.replace(/^#{2,3} /, "").trim();
      sectionLines = [];
      inDescriptionBlock = false;
      continue;
    }

    // Capture description (non-empty lines immediately after H1, before any heading)
    if (afterFirstH1 && inDescriptionBlock && line.trim()) {
      descriptionLines.push(line.trim());
    } else if (
      afterFirstH1 &&
      inDescriptionBlock &&
      !line.trim() &&
      descriptionLines.length > 0
    ) {
      inDescriptionBlock = false;
    }

    // Accumulate section content
    if (currentSection !== null) {
      sectionLines.push(line);

      const listMatch = line.match(/^[-*]\s+(.+)/);
      if (listMatch) {
        const item = listMatch[1].trim();
        const sectionLower = currentSection.toLowerCase();
        if (sectionLower.includes("value")) {
          values.push(item);
        } else if (sectionLower.includes("focus")) {
          focusAreas.push(item);
        }
      }
    }
  }

  // Flush last section
  if (currentSection !== null) {
    sections[currentSection] = sectionLines.join("\n").trim();
  }

  if (descriptionLines.length > 0) {
    description = descriptionLines.join(" ");
  }

  return { name, description, values, focusAreas, sections };
}

// ---------------------------------------------------------------------------
// Fee rate resolver
// ---------------------------------------------------------------------------

async function resolveFeeRate(
  feeRate: string | number | undefined,
  mempoolApi: MempoolApi
): Promise<number> {
  if (typeof feeRate === "number") return feeRate;

  const fees = await mempoolApi.getFeeEstimates();
  switch (feeRate) {
    case "fast":
      return fees.fastestFee;
    case "slow":
      return fees.hourFee;
    default:
      return fees.halfHourFee;
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerSouldinalsTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // souldinals_inscribe_soul — Step 1: Broadcast commit tx
  // --------------------------------------------------------------------------
  server.registerTool(
    "souldinals_inscribe_soul",
    {
      description:
        "Inscribe a soul.md as a child inscription - STEP 1: Broadcast commit transaction.\n\n" +
        "Creates a child inscription linked to a parent genesis inscription, establishing " +
        "on-chain provenance per the Ordinals provenance spec. Content type is always text/markdown.\n\n" +
        "You must own the parent inscription (it must be at your wallet's Taproot address).\n\n" +
        "This broadcasts the commit tx and returns immediately. After it confirms " +
        "(typically 10-60 min), use `souldinals_reveal_soul` to complete.\n\n" +
        "Returns: commitTxid, revealAmount, contentBase64 (save all for souldinals_reveal_soul)",
      inputSchema: {
        parentInscriptionId: z
          .string()
          .describe(
            "Genesis parent inscription ID (format: {txid}i{index}). You must own this inscription."
          ),
        soulContent: z
          .string()
          .describe(
            "The soul.md content as a string (Markdown text). Will be inscribed as text/markdown."
          ),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe(
            "Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or number in sat/vB (default: medium)"
          ),
      },
    },
    async ({ parentInscriptionId, soulContent, feeRate }) => {
      try {
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();

        if (!sessionInfo) {
          return createErrorResponse(
            new Error("Wallet not unlocked. Use wallet_unlock first.")
          );
        }

        if (!sessionInfo.btcAddress || !sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              "Wallet doesn't have Bitcoin addresses. Use a managed wallet."
            )
          );
        }

        const account = walletManager.getAccount();
        if (
          !account ||
          !account.btcPrivateKey ||
          !account.btcPublicKey ||
          !account.taprootPrivateKey ||
          !account.taprootPublicKey
        ) {
          return createErrorResponse(
            new Error(
              "Bitcoin and Taproot keys not available. Wallet may not be unlocked."
            )
          );
        }

        if (!soulContent.trim()) {
          return createErrorResponse(new Error("Soul content cannot be empty."));
        }

        // Look up parent inscription and validate ownership
        const parentInfo = await lookupParentInscription(parentInscriptionId);

        if (parentInfo.address !== sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              `Parent inscription is owned by ${parentInfo.address}, but your Taproot address is ${sessionInfo.taprootAddress}. You must own the parent inscription.`
            )
          );
        }

        // Encode soul content
        const body = Buffer.from(soulContent, "utf-8");
        const contentBase64 = body.toString("base64");
        const inscription: InscriptionData = {
          contentType: SOUL_CONTENT_TYPE,
          body,
        };

        const mempoolApi = new MempoolApi(NETWORK);
        const actualFeeRate = await resolveFeeRate(feeRate, mempoolApi);

        // Get UTXOs for funding
        const utxos = await mempoolApi.getUtxos(sessionInfo.btcAddress);
        if (utxos.length === 0) {
          return createErrorResponse(
            new Error(
              `No UTXOs available for address ${sessionInfo.btcAddress}. Send some BTC first.`
            )
          );
        }

        // Build and broadcast commit transaction
        const commitResult = buildChildCommitTransaction({
          utxos,
          inscription,
          parentInscriptionId,
          feeRate: actualFeeRate,
          senderPubKey: account.btcPublicKey,
          senderAddress: sessionInfo.btcAddress,
          network: NETWORK,
        });

        const commitSigned = signBtcTransaction(
          commitResult.tx,
          account.btcPrivateKey
        );
        const commitTxid = await mempoolApi.broadcastTransaction(
          commitSigned.txHex
        );
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        return createJsonResponse({
          status: "commit_broadcast",
          message:
            "Soul commit transaction broadcast successfully. " +
            "Wait for confirmation (typically 10-60 min), then call souldinals_reveal_soul to complete.",
          commitTxid,
          commitExplorerUrl,
          revealAddress: commitResult.revealAddress,
          revealAmount: commitResult.revealAmount,
          commitFee: commitResult.fee,
          feeRate: actualFeeRate,
          parentInscriptionId,
          parentUtxo: {
            txid: parentInfo.txid,
            vout: parentInfo.vout,
            value: parentInfo.value,
          },
          contentType: SOUL_CONTENT_TYPE,
          contentSize: body.length,
          contentBase64,
          nextStep:
            "After commit confirms, call souldinals_reveal_soul with commitTxid, revealAmount, " +
            "contentBase64, and parentInscriptionId from this response.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // souldinals_reveal_soul — Step 2: Broadcast reveal tx
  // --------------------------------------------------------------------------
  server.registerTool(
    "souldinals_reveal_soul",
    {
      description:
        "Complete a soul inscription - STEP 2: Broadcast reveal transaction.\n\n" +
        "Call this AFTER the commit transaction from `souldinals_inscribe_soul` has confirmed.\n" +
        "Provide the commitTxid, revealAmount, contentBase64, and parentInscriptionId " +
        "from the commit step response.\n\n" +
        "The reveal tx spends both the commit output and the parent inscription UTXO, " +
        "returning the parent to your address and creating the child soul inscription.\n\n" +
        "Returns: inscriptionId ({revealTxid}i0) on success",
      inputSchema: {
        commitTxid: z
          .string()
          .length(64)
          .describe(
            "Transaction ID of the confirmed commit transaction (from souldinals_inscribe_soul)"
          ),
        revealAmount: z
          .number()
          .positive()
          .describe(
            "Amount in the commit output (from souldinals_inscribe_soul response)"
          ),
        contentBase64: z
          .string()
          .describe(
            "Base64-encoded soul.md content (from souldinals_inscribe_soul response)"
          ),
        parentInscriptionId: z
          .string()
          .describe(
            "Parent inscription ID (must match the commit step)"
          ),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .describe("Fee rate for reveal tx (default: medium)"),
      },
    },
    async ({
      commitTxid,
      revealAmount,
      contentBase64,
      parentInscriptionId,
      feeRate,
    }) => {
      try {
        const walletManager = getWalletManager();
        const sessionInfo = walletManager.getSessionInfo();

        if (!sessionInfo) {
          return createErrorResponse(
            new Error("Wallet not unlocked. Use wallet_unlock first.")
          );
        }

        if (!sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              "Wallet doesn't have Taproot address. Use a managed wallet."
            )
          );
        }

        const account = walletManager.getAccount();
        if (
          !account ||
          !account.btcPrivateKey ||
          !account.btcPublicKey ||
          !account.taprootPrivateKey ||
          !account.taprootPublicKey
        ) {
          return createErrorResponse(
            new Error(
              "Bitcoin and Taproot keys not available. Wallet may not be unlocked."
            )
          );
        }

        // Verify parent ownership
        const parentInfo = await lookupParentInscription(parentInscriptionId);

        if (parentInfo.address !== sessionInfo.taprootAddress) {
          return createErrorResponse(
            new Error(
              `Parent inscription is no longer owned by your wallet. Current owner: ${parentInfo.address}`
            )
          );
        }

        // Reconstruct the inscription
        const body = Buffer.from(contentBase64, "base64");
        const inscription: InscriptionData = {
          contentType: SOUL_CONTENT_TYPE,
          body,
        };

        const mempoolApi = new MempoolApi(NETWORK);
        const actualFeeRate = await resolveFeeRate(feeRate, mempoolApi);

        // Derive the child reveal script deterministically
        const p2trReveal = deriveChildRevealScript({
          inscription,
          parentInscriptionId,
          senderPubKey: account.btcPublicKey,
          network: NETWORK,
        });

        // Build child reveal transaction
        const revealResult = buildChildRevealTransaction({
          commitTxid,
          commitVout: 0,
          commitAmount: revealAmount,
          revealScript: p2trReveal,
          parentUtxo: {
            txid: parentInfo.txid,
            vout: parentInfo.vout,
            value: parentInfo.value,
          },
          parentOwnerTaprootInternalPubKey: account.taprootPublicKey,
          recipientAddress: sessionInfo.taprootAddress,
          feeRate: actualFeeRate,
          network: NETWORK,
        });

        // Sign both inputs
        revealResult.tx.sign(account.btcPrivateKey);
        revealResult.tx.sign(account.taprootPrivateKey);
        revealResult.tx.finalize();

        const revealTxHex = revealResult.tx.hex;
        const revealTxid = await mempoolApi.broadcastTransaction(revealTxHex);

        const inscriptionId = `${revealTxid}i0`;
        const revealExplorerUrl = getMempoolTxUrl(revealTxid, NETWORK);
        const commitExplorerUrl = getMempoolTxUrl(commitTxid, NETWORK);

        return createJsonResponse({
          status: "success",
          message: "Soul inscription created successfully!",
          inscriptionId,
          parentInscriptionId,
          contentType: SOUL_CONTENT_TYPE,
          contentSize: body.length,
          commit: {
            txid: commitTxid,
            explorerUrl: commitExplorerUrl,
          },
          reveal: {
            txid: revealTxid,
            fee: revealResult.fee,
            explorerUrl: revealExplorerUrl,
          },
          recipientAddress: sessionInfo.taprootAddress,
          note: "Soul inscription will appear at the recipient address once the reveal transaction confirms. The parent inscription has been returned to your address.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // souldinals_list_souls — List soul inscriptions for an address
  // --------------------------------------------------------------------------
  server.registerTool(
    "souldinals_list_souls",
    {
      description:
        "List all soul inscriptions (text/markdown) owned by a Taproot address.\n\n" +
        "Queries the Unisat Ordinals API for inscriptions with content type text/markdown.\n" +
        "If no address is provided, uses the current wallet's Taproot address.\n\n" +
        "Returns: array of soul inscriptions with id, number, content type, size, and timestamp.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "Taproot (bc1p...) address to query. Omit to use the current wallet's Taproot address."
          ),
      },
    },
    async ({ address }) => {
      try {
        let taprootAddress = address;

        if (!taprootAddress) {
          const walletManager = getWalletManager();
          const sessionInfo = walletManager.getSessionInfo();

          if (!sessionInfo?.taprootAddress) {
            return createErrorResponse(
              new Error(
                "Wallet not unlocked or doesn't have a Taproot address. " +
                  "Provide an address parameter or use wallet_unlock first."
              )
            );
          }
          taprootAddress = sessionInfo.taprootAddress;
        }

        const inscriptions = await fetchSoulInscriptions(taprootAddress);

        const souls = inscriptions.map((ins) => ({
          id: ins.id,
          number: ins.number,
          contentType: ins.contentType,
          contentLength: ins.contentLength,
          timestamp: ins.timestamp,
          genesisBlockHeight: ins.genesisBlockHeight,
        }));

        return createJsonResponse({
          address: taprootAddress,
          count: souls.length,
          souls,
          message:
            souls.length === 0
              ? "No soul inscriptions found. Use souldinals_inscribe_soul to create one."
              : `Found ${souls.length} soul inscription(s).`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // souldinals_load_soul — Load oldest soul inscription content
  // --------------------------------------------------------------------------
  server.registerTool(
    "souldinals_load_soul",
    {
      description:
        "Load and display the full content of the oldest soul inscription from a Taproot address.\n\n" +
        "Fetches the list of soul inscriptions (text/markdown) and returns the content of the " +
        "oldest one. If no address is provided, uses the current wallet's Taproot address.\n\n" +
        "Returns: inscription metadata and full Markdown content.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe(
            "Taproot (bc1p...) address to query. Omit to use the current wallet's Taproot address."
          ),
      },
    },
    async ({ address }) => {
      try {
        let taprootAddress = address;

        if (!taprootAddress) {
          const walletManager = getWalletManager();
          const sessionInfo = walletManager.getSessionInfo();

          if (!sessionInfo?.taprootAddress) {
            return createErrorResponse(
              new Error(
                "Wallet not unlocked or doesn't have a Taproot address. " +
                  "Provide an address parameter or use wallet_unlock first."
              )
            );
          }
          taprootAddress = sessionInfo.taprootAddress;
        }

        const inscriptions = await fetchSoulInscriptions(taprootAddress);

        if (inscriptions.length === 0) {
          return createJsonResponse({
            address: taprootAddress,
            found: false,
            message:
              "No soul inscriptions found. Use souldinals_inscribe_soul to create one.",
          });
        }

        // Oldest is first (sorted by genesis_block_height asc)
        const oldest = inscriptions[0];
        const content = await fetchInscriptionContent(oldest.id);

        return createJsonResponse({
          inscriptionId: oldest.id,
          contentType: oldest.contentType,
          contentSize: oldest.contentLength,
          timestamp: oldest.timestamp,
          genesisBlockHeight: oldest.genesisBlockHeight,
          content,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // souldinals_display_soul — Parse and display soul traits
  // --------------------------------------------------------------------------
  server.registerTool(
    "souldinals_display_soul",
    {
      description:
        "Parse and display soul traits from a specific inscription.\n\n" +
        "Fetches the inscription content from Unisat and extracts structured soul traits:\n" +
        "- name: first H1 heading\n" +
        "- description: first paragraph after H1\n" +
        "- values: list items under 'Values' or 'Core Values' sections\n" +
        "- focusAreas: list items under 'Focus' or 'Focus Areas' sections\n" +
        "- sections: all named H2/H3 sections\n\n" +
        "Also returns raw Markdown content.",
      inputSchema: {
        inscriptionId: z
          .string()
          .describe("Inscription ID (format: {txid}i{index})"),
      },
    },
    async ({ inscriptionId }) => {
      try {
        // Fetch metadata and content in parallel
        const [metadata, content] = await Promise.all([
          fetchInscriptionMetadata(inscriptionId),
          fetchInscriptionContent(inscriptionId),
        ]);

        const traits = parseSoulTraits(content);

        return createJsonResponse({
          inscriptionId,
          contentType: metadata.contentType,
          contentLength: metadata.contentLength,
          timestamp: metadata.timestamp,
          genesisBlockHeight: metadata.genesisBlockHeight,
          traits,
          rawContent: content,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
