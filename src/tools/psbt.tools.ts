/**
 * PSBT tools for trustless ordinals trading
 *
 * Implements BIP-174 Partially Signed Bitcoin Transaction workflows for
 * agent-to-agent atomic ordinals trades. Tools:
 *
 * - psbt_decode: Inspect a PSBT before signing (safety check)
 * - psbt_sign: Sign inputs in a PSBT with the agent's wallet key
 * - psbt_broadcast: Finalize and broadcast a fully-signed PSBT
 * - psbt_create_ordinal_listing: Create a half-signed listing PSBT (seller)
 * - psbt_create_ordinal_buy: Create a full trade PSBT for an ordinal purchase (buyer)
 *
 * Trade flow:
 *   1. Seller: psbt_create_ordinal_listing → half-signed PSBT (shares via inbox)
 *   2. Buyer: psbt_create_ordinal_buy → unsigned trade PSBT
 *   3. Buyer: psbt_sign → signs buyer inputs
 *   4. Seller: psbt_sign → signs seller input (ordinal)
 *   5. Either: psbt_broadcast → atomic swap, trustless
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as btc from "@scure/btc-signer";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import { OrdinalIndexer } from "../services/ordinal-indexer.js";
import { getBtcNetwork } from "../transactions/bitcoin-builder.js";
import {
  DUST_THRESHOLD,
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  TX_OVERHEAD_VBYTES,
} from "../config/bitcoin-constants.js";

/**
 * Decode a base64 PSBT string into a Transaction object
 */
function decodePsbt(psbtBase64: string): btc.Transaction {
  const psbtBytes = Buffer.from(psbtBase64, "base64");
  return btc.Transaction.fromPSBT(psbtBytes);
}

/**
 * Encode a Transaction object as a base64 PSBT string
 */
function encodePsbt(tx: btc.Transaction): string {
  const psbtBytes = tx.toPSBT();
  return Buffer.from(psbtBytes).toString("base64");
}

/**
 * Try to decode an address from an output script
 */
function decodeOutputAddress(
  output: { script?: Uint8Array },
  network: typeof btc.NETWORK
): string | undefined {
  if (!output.script) return undefined;
  try {
    const decoded = btc.OutScript.decode(output.script);
    return btc.Address(network).encode(decoded);
  } catch {
    return undefined;
  }
}

/**
 * Get signing status description for an input
 */
function getInputSigningStatus(
  tx: btc.Transaction,
  idx: number
): { signed: boolean; finalized: boolean; sighash: string } {
  try {
    const input = tx.getInput(idx);
    const hasSig =
      (input.partialSig && input.partialSig.length > 0) ||
      !!input.finalScriptSig ||
      !!input.finalScriptWitness;
    const finalized = !!input.finalScriptSig || !!input.finalScriptWitness;
    const sighashType = input.sighashType;
    return {
      signed: hasSig,
      finalized,
      sighash:
        sighashType !== undefined ? `0x${sighashType.toString(16)}` : "default",
    };
  } catch {
    return { signed: false, finalized: false, sighash: "unknown" };
  }
}

export function registerPsbtTools(server: McpServer): void {
  // =========================================================================
  // psbt_decode — Inspect a PSBT before signing
  // =========================================================================
  server.registerTool(
    "psbt_decode",
    {
      description:
        "Decode and inspect a PSBT (Partially Signed Bitcoin Transaction) " +
        "before signing. Returns human-readable details about inputs, outputs, " +
        "amounts, addresses, and signing status. Use this as a safety check " +
        "before signing any PSBT.",
      inputSchema: {
        psbtBase64: z
          .string()
          .describe("Base64-encoded PSBT to decode and inspect"),
      },
    },
    async ({ psbtBase64 }) => {
      try {
        const tx = decodePsbt(psbtBase64);
        const btcNetwork = getBtcNetwork(NETWORK);

        // Decode inputs
        const inputs = [];
        for (let i = 0; i < tx.inputsLength; i++) {
          const input = tx.getInput(i);
          const status = getInputSigningStatus(tx, i);
          inputs.push({
            index: i,
            txid: input.txid
              ? Buffer.from(input.txid).toString("hex")
              : "unknown",
            vout: input.index ?? 0,
            value: input.witnessUtxo
              ? Number(input.witnessUtxo.amount)
              : undefined,
            ...status,
          });
        }

        // Decode outputs
        const outputs = [];
        for (let i = 0; i < tx.outputsLength; i++) {
          const output = tx.getOutput(i);
          const address = decodeOutputAddress(output, btcNetwork);
          outputs.push({
            index: i,
            address: address ?? "unknown",
            value: output.amount ? Number(output.amount) : undefined,
          });
        }

        // Compute totals
        const totalInputValue = inputs.reduce(
          (sum, inp) => sum + (inp.value ?? 0),
          0
        );
        const totalOutputValue = outputs.reduce(
          (sum, out) => sum + (out.value ?? 0),
          0
        );
        const fee =
          totalInputValue > 0 ? totalInputValue - totalOutputValue : undefined;

        return createJsonResponse({
          inputCount: tx.inputsLength,
          outputCount: tx.outputsLength,
          inputs,
          outputs,
          totalInputValue: totalInputValue || "unknown (missing witnessUtxo)",
          totalOutputValue,
          fee: fee ?? "unknown",
          isFinal: tx.isFinal,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // =========================================================================
  // psbt_sign — Sign specific inputs in a PSBT
  // =========================================================================
  server.registerTool(
    "psbt_sign",
    {
      description:
        "Sign inputs in a PSBT with the agent's wallet key. By default signs " +
        "all inputs that match the wallet's key. Optionally specify which input " +
        "indices to sign. Returns the updated PSBT with signatures added. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        psbtBase64: z.string().describe("Base64-encoded PSBT to sign"),
        signInputs: z
          .array(z.number().int().min(0))
          .optional()
          .describe(
            "Array of input indices to sign. If omitted, signs all inputs " +
              "that match the wallet key."
          ),
        sighashType: z
          .number()
          .int()
          .optional()
          .describe(
            "Sighash type for signing (e.g., 1=ALL, 3=SINGLE, 131=SINGLE|ANYONECANPAY). " +
              "If omitted, uses the sighash specified in the PSBT input or defaults to ALL."
          ),
      },
    },
    async ({ psbtBase64, signInputs, sighashType }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error(
            "Wallet is not unlocked. Use wallet_unlock first."
          );
        }
        if (!account.btcPrivateKey) {
          throw new Error("Bitcoin private key not available in wallet.");
        }

        const tx = decodePsbt(psbtBase64);
        const signedIndices: number[] = [];

        if (signInputs && signInputs.length > 0) {
          // Sign specific inputs
          for (const idx of signInputs) {
            if (idx >= tx.inputsLength) {
              throw new Error(
                `Input index ${idx} out of range (${tx.inputsLength} inputs)`
              );
            }
            const sighashArr = sighashType !== undefined ? [sighashType] : undefined;
            tx.signIdx(account.btcPrivateKey, idx, sighashArr);
            signedIndices.push(idx);
          }
        } else {
          // Sign all matching inputs
          tx.sign(account.btcPrivateKey);
          for (let i = 0; i < tx.inputsLength; i++) {
            const input = tx.getInput(i);
            const hasSig =
              (input.partialSig && input.partialSig.length > 0) ||
              !!input.finalScriptSig ||
              !!input.finalScriptWitness;
            if (hasSig) {
              signedIndices.push(i);
            }
          }
        }

        return createJsonResponse({
          psbtBase64: encodePsbt(tx),
          signedInputs: signedIndices,
          totalInputs: tx.inputsLength,
          isFinal: tx.isFinal,
          note:
            signedIndices.length === 0
              ? "No inputs were signed. The wallet key may not match any input."
              : `Signed ${signedIndices.length} input(s).`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // =========================================================================
  // psbt_broadcast — Finalize and broadcast a fully-signed PSBT
  // =========================================================================
  server.registerTool(
    "psbt_broadcast",
    {
      description:
        "Finalize and broadcast a fully-signed PSBT to the Bitcoin network. " +
        "All inputs must be signed before calling this. Returns the transaction ID " +
        "and explorer URL.",
      inputSchema: {
        psbtBase64: z
          .string()
          .describe("Base64-encoded fully-signed PSBT to broadcast"),
      },
    },
    async ({ psbtBase64 }) => {
      try {
        const tx = decodePsbt(psbtBase64);

        // Finalize all inputs
        tx.finalize();

        // Extract signed transaction hex
        const txHex = tx.hex;
        const txid = tx.id;

        // Broadcast via mempool.space
        const mempoolApi = new MempoolApi(NETWORK);
        const broadcastTxid = await mempoolApi.broadcastTransaction(txHex);

        return createJsonResponse({
          txid: broadcastTxid,
          vsize: tx.vsize,
          explorerUrl: getMempoolTxUrl(broadcastTxid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // =========================================================================
  // psbt_create_ordinal_listing — Create a half-signed listing PSBT (seller)
  // =========================================================================
  server.registerTool(
    "psbt_create_ordinal_listing",
    {
      description:
        "Create a half-signed PSBT to list an ordinal inscription for sale. " +
        "The seller's ordinal UTXO is added as input 0 and signed with " +
        "SIGHASH_SINGLE|ANYONECANPAY (the seller commits only to their payment output). " +
        "Share this PSBT with a buyer who can complete the trade with psbt_create_ordinal_buy. " +
        "Requires an unlocked wallet.",
      inputSchema: {
        inscriptionUtxo: z
          .string()
          .describe(
            "The UTXO containing the inscription, as txid:vout (e.g., 'abc123...def:0')"
          ),
        priceSats: z
          .number()
          .int()
          .positive()
          .describe("Sale price in satoshis that the seller wants to receive"),
        sellerReceiveAddress: z
          .string()
          .optional()
          .describe(
            "Bitcoin address to receive payment. Defaults to wallet's BTC address."
          ),
      },
    },
    async ({ inscriptionUtxo, priceSats, sellerReceiveAddress }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error(
            "Wallet is not unlocked. Use wallet_unlock first."
          );
        }
        if (!account.btcPrivateKey || !account.btcPublicKey) {
          throw new Error("Bitcoin keys not available in wallet.");
        }

        // Parse inscription UTXO
        const parts = inscriptionUtxo.split(":");
        if (parts.length !== 2) {
          throw new Error(
            "Invalid inscriptionUtxo format. Expected 'txid:vout'."
          );
        }
        const [txid, voutStr] = parts;
        const vout = parseInt(voutStr, 10);
        if (isNaN(vout) || vout < 0) {
          throw new Error("Invalid vout in inscriptionUtxo.");
        }

        // Get seller's receive address
        const sessionInfo = walletManager.getSessionInfo();
        const receiveAddress =
          sellerReceiveAddress ?? sessionInfo?.btcAddress;
        if (!receiveAddress) {
          throw new Error(
            "No receive address provided and wallet address not available."
          );
        }

        // Fetch the UTXO value from mempool
        const mempoolApi = new MempoolApi(NETWORK);
        const utxos = await mempoolApi.getUtxos(
          sessionInfo?.btcAddress ?? receiveAddress
        );
        const ordinalUtxo = utxos.find(
          (u) => u.txid === txid && u.vout === vout
        );

        if (!ordinalUtxo) {
          throw new Error(
            `UTXO ${inscriptionUtxo} not found. Ensure the inscription is in your wallet.`
          );
        }

        // Build the listing PSBT
        const btcNetwork = getBtcNetwork(NETWORK);
        const tx = new btc.Transaction();

        // Input 0: Seller's ordinal UTXO
        const senderP2wpkh = btc.p2wpkh(account.btcPublicKey, btcNetwork);
        tx.addInput({
          txid,
          index: vout,
          witnessUtxo: {
            script: senderP2wpkh.script,
            amount: BigInt(ordinalUtxo.value),
          },
          sighashType: btc.SigHash.SINGLE_ANYONECANPAY,
        });

        // Output 0: Seller's payment (the price)
        tx.addOutputAddress(
          receiveAddress,
          BigInt(priceSats),
          btcNetwork
        );

        // Sign input 0 with SIGHASH_SINGLE|ANYONECANPAY
        tx.signIdx(account.btcPrivateKey, 0, [
          btc.SigHash.SINGLE_ANYONECANPAY,
        ]);

        return createJsonResponse({
          psbtBase64: encodePsbt(tx),
          listing: {
            inscriptionUtxo,
            inscriptionValue: ordinalUtxo.value,
            priceSats,
            sellerReceiveAddress: receiveAddress,
            sighash: "SINGLE|ANYONECANPAY (0x83)",
          },
          note:
            "Share this PSBT with a buyer. They should use psbt_create_ordinal_buy " +
            "to construct the full trade transaction, then both parties sign with psbt_sign.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // =========================================================================
  // psbt_create_ordinal_buy — Create a full trade PSBT (buyer)
  // =========================================================================
  server.registerTool(
    "psbt_create_ordinal_buy",
    {
      description:
        "Create a PSBT to buy an ordinal inscription at a given price. " +
        "Constructs a full trade transaction with the seller's ordinal UTXO " +
        "as input and the buyer's cardinal UTXOs for payment. The inscription " +
        "is routed to the buyer's receive address via correct output ordering. " +
        "Both parties must sign their respective inputs with psbt_sign before " +
        "broadcasting with psbt_broadcast. Requires an unlocked wallet.",
      inputSchema: {
        inscriptionUtxo: z
          .string()
          .describe(
            "The seller's inscription UTXO as txid:vout (e.g., 'abc123...def:0')"
          ),
        inscriptionValue: z
          .number()
          .int()
          .positive()
          .describe("Value of the inscription UTXO in satoshis (typically 546)"),
        sellerAddress: z
          .string()
          .describe(
            "Seller's Bitcoin address (for payment output and to build their input witness)"
          ),
        priceSats: z
          .number()
          .int()
          .positive()
          .describe("Agreed price in satoshis to pay the seller"),
        buyerReceiveAddress: z
          .string()
          .optional()
          .describe(
            "Buyer's Bitcoin address to receive the inscription. Defaults to wallet's BTC address."
          ),
        feeRate: z
          .enum(["fast", "medium", "slow"])
          .optional()
          .default("medium")
          .describe("Fee rate tier (default: medium)"),
      },
    },
    async ({
      inscriptionUtxo,
      inscriptionValue,
      sellerAddress,
      priceSats,
      buyerReceiveAddress,
      feeRate,
    }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();
        if (!account) {
          throw new Error(
            "Wallet is not unlocked. Use wallet_unlock first."
          );
        }
        if (!account.btcPublicKey) {
          throw new Error("Bitcoin public key not available in wallet.");
        }

        const sessionInfo = walletManager.getSessionInfo();
        const buyerAddr =
          buyerReceiveAddress ?? sessionInfo?.btcAddress;
        if (!buyerAddr) {
          throw new Error(
            "No buyer receive address provided and wallet address not available."
          );
        }

        // Parse inscription UTXO
        const parts = inscriptionUtxo.split(":");
        if (parts.length !== 2) {
          throw new Error(
            "Invalid inscriptionUtxo format. Expected 'txid:vout'."
          );
        }
        const [insTxid, insVoutStr] = parts;
        const insVout = parseInt(insVoutStr, 10);

        // Get fee rate
        const mempoolApi = new MempoolApi(NETWORK);
        const feeTiers = await mempoolApi.getFeeTiers();
        const selectedFeeRate =
          feeRate === "fast"
            ? feeTiers.fast
            : feeRate === "slow"
              ? feeTiers.slow
              : feeTiers.medium;

        // Get buyer's cardinal UTXOs (safe to spend, no inscriptions)
        const ordinalIndexer = new OrdinalIndexer(NETWORK);
        const cardinalUtxos = await ordinalIndexer.getCardinalUtxos(
          buyerAddr
        );
        const confirmedUtxos = cardinalUtxos
          .filter((u) => u.status.confirmed)
          .sort((a, b) => b.value - a.value);

        if (confirmedUtxos.length === 0) {
          throw new Error(
            "No confirmed cardinal UTXOs available for payment."
          );
        }

        // Estimate tx size: 1 seller input + N buyer inputs, 3 outputs
        // (buyer ordinal receive, seller payment, buyer change)
        const estimateSize = (buyerInputCount: number) =>
          TX_OVERHEAD_VBYTES +
          (1 + buyerInputCount) * P2WPKH_INPUT_VBYTES +
          3 * P2WPKH_OUTPUT_VBYTES;

        // Select buyer UTXOs to cover: price + fees
        let selectedTotal = 0;
        const selectedUtxos = [];
        for (const utxo of confirmedUtxos) {
          selectedUtxos.push(utxo);
          selectedTotal += utxo.value;
          const estFee = Math.ceil(
            estimateSize(selectedUtxos.length) * selectedFeeRate
          );
          if (selectedTotal >= priceSats + estFee + DUST_THRESHOLD) {
            break;
          }
        }

        const estimatedFee = Math.ceil(
          estimateSize(selectedUtxos.length) * selectedFeeRate
        );
        const totalNeeded = priceSats + estimatedFee;

        if (selectedTotal < totalNeeded) {
          throw new Error(
            `Insufficient funds: have ${selectedTotal} sats in cardinal UTXOs, ` +
              `need ${totalNeeded} sats (${priceSats} price + ${estimatedFee} fee).`
          );
        }

        const changeAmount = selectedTotal - priceSats - estimatedFee;

        // Build the trade PSBT
        // Output ordering ensures correct ordinal sat routing:
        //   Input 0: Seller's ordinal UTXO (inscription at offset 0)
        //   Input 1+: Buyer's cardinal UTXOs
        //   Output 0: Buyer receives inscription (inscription value sats)
        //   Output 1: Seller payment (priceSats)
        //   Output 2: Buyer change
        //
        // Ordinal sat tracking: first sat of input 0 flows to output 0,
        // so the inscription lands in the buyer's receive output.
        const btcNetwork = getBtcNetwork(NETWORK);
        const tx = new btc.Transaction();

        // Input 0: Seller's ordinal UTXO
        // We build the witnessUtxo script from the seller's address
        const sellerScript = btc.Address(btcNetwork).decode(sellerAddress);
        const sellerOutputScript =
          btc.OutScript.encode(sellerScript);
        tx.addInput({
          txid: insTxid,
          index: insVout,
          witnessUtxo: {
            script: sellerOutputScript,
            amount: BigInt(inscriptionValue),
          },
        });

        // Inputs 1+: Buyer's cardinal UTXOs
        const buyerP2wpkh = btc.p2wpkh(account.btcPublicKey, btcNetwork);
        for (const utxo of selectedUtxos) {
          tx.addInput({
            txid: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              script: buyerP2wpkh.script,
              amount: BigInt(utxo.value),
            },
          });
        }

        // Output 0: Buyer receives inscription
        // Value = inscription UTXO value (preserves the inscription sat)
        tx.addOutputAddress(
          buyerAddr,
          BigInt(inscriptionValue),
          btcNetwork
        );

        // Output 1: Seller payment
        tx.addOutputAddress(
          sellerAddress,
          BigInt(priceSats),
          btcNetwork
        );

        // Output 2: Buyer change (if above dust)
        if (changeAmount >= DUST_THRESHOLD) {
          tx.addOutputAddress(
            buyerAddr,
            BigInt(changeAmount),
            btcNetwork
          );
        }

        return createJsonResponse({
          psbtBase64: encodePsbt(tx),
          trade: {
            inscriptionUtxo,
            inscriptionValue,
            priceSats,
            sellerAddress,
            buyerReceiveAddress: buyerAddr,
            estimatedFee,
            changeAmount: changeAmount >= DUST_THRESHOLD ? changeAmount : 0,
            feeRate: `${selectedFeeRate} sat/vB (${feeRate ?? "medium"})`,
          },
          inputs: {
            0: `Seller ordinal: ${inscriptionUtxo} (${inscriptionValue} sats)`,
            "1+": `Buyer payment: ${selectedUtxos.length} UTXOs (${selectedTotal} sats)`,
          },
          outputs: {
            0: `Buyer inscription receive: ${buyerAddr} (${inscriptionValue} sats)`,
            1: `Seller payment: ${sellerAddress} (${priceSats} sats)`,
            2:
              changeAmount >= DUST_THRESHOLD
                ? `Buyer change: ${buyerAddr} (${changeAmount} sats)`
                : "No change (below dust)",
          },
          nextSteps: [
            "Buyer signs inputs 1+ with: psbt_sign(psbt, signInputs: [1, 2, ...])",
            "Send PSBT to seller (via inbox or direct)",
            "Seller signs input 0 with: psbt_sign(psbt, signInputs: [0])",
            "Broadcast with: psbt_broadcast(psbt)",
          ],
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
