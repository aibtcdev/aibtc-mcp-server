/**
 * Ordinals tools
 *
 * These tools provide Bitcoin ordinals operations:
 * - get_inscription: Fetch and parse inscription content from a reveal transaction
 *
 * Uses micro-ordinals library to parse inscription data from witness elements.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  InscriptionParser,
  type ParsedInscription,
} from "../services/inscription-parser.js";
import { getMempoolTxUrl } from "../services/mempool-api.js";

/**
 * Format inscription data for display
 */
function formatInscription(inscription: ParsedInscription, index: number) {
  return {
    index,
    contentType: inscription.contentType || "unknown",
    size: inscription.body.length,
    bodyBase64: inscription.bodyBase64,
    bodyText:
      inscription.bodyText && inscription.bodyText.length <= 1000
        ? inscription.bodyText
        : inscription.bodyText
          ? `${inscription.bodyText.slice(0, 1000)}... (truncated)`
          : undefined,
    cursed: inscription.cursed || false,
    metadata: {
      pointer: inscription.pointer?.toString(),
      metaprotocol: inscription.metaprotocol,
      contentEncoding: inscription.contentEncoding,
      rune: inscription.rune?.toString(),
      note: inscription.note,
      hasMetadata: !!inscription.metadata,
    },
  };
}

export function registerOrdinalsTools(server: McpServer): void {
  // Get inscription from transaction
  server.registerTool(
    "get_inscription",
    {
      description:
        "Get inscription content from a Bitcoin reveal transaction. " +
        "Fetches the transaction from mempool.space and parses inscription data from the witness. " +
        "Returns content type, body (as base64 and text if applicable), and metadata tags.",
      inputSchema: {
        txid: z
          .string()
          .length(64)
          .describe(
            "Transaction ID of the reveal transaction containing the inscription"
          ),
      },
    },
    async ({ txid }) => {
      try {
        const parser = new InscriptionParser(NETWORK);
        const inscriptions = await parser.getInscriptionsFromTx(txid);

        if (!inscriptions || inscriptions.length === 0) {
          return createJsonResponse({
            txid,
            network: NETWORK,
            explorerUrl: getMempoolTxUrl(txid, NETWORK),
            found: false,
            message: "No inscriptions found in this transaction",
          });
        }

        return createJsonResponse({
          txid,
          network: NETWORK,
          explorerUrl: getMempoolTxUrl(txid, NETWORK),
          found: true,
          count: inscriptions.length,
          inscriptions: inscriptions.map((ins, idx) =>
            formatInscription(ins, idx)
          ),
        });
      } catch (error) {
        if (error instanceof Error) {
          return createErrorResponse(
            `Failed to get inscription: ${error.message}`
          );
        }
        return createErrorResponse(
          `Failed to get inscription: ${String(error)}`
        );
      }
    }
  );
}
