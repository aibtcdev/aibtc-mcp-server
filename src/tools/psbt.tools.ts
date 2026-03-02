import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as btc from "@scure/btc-signer";
import { z } from "zod";
import { NETWORK } from "../config/networks.js";
import {
  DUST_THRESHOLD,
  P2TR_INPUT_BASE_VBYTES,
  P2WPKH_INPUT_VBYTES,
} from "../config/bitcoin-constants.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { getBtcNetwork } from "../transactions/bitcoin-builder.js";
import { createErrorResponse, createJsonResponse } from "../utils/index.js";
import { estimateBuyPsbtFeeSats, parseOutpoint } from "./psbt.helpers.js";

function decodePsbtBase64(psbtBase64: string): btc.Transaction {
  const bytes = Buffer.from(psbtBase64, "base64");
  if (bytes.length === 0) {
    throw new Error("Invalid PSBT: empty base64 payload");
  }
  return btc.Transaction.fromPSBT(bytes, {
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
    disableScriptCheck: true,
  });
}

function encodePsbtBase64(tx: btc.Transaction): string {
  return Buffer.from(tx.toPSBT()).toString("base64");
}

function detectInputScriptType(input: ReturnType<btc.Transaction["getInput"]>): string {
  if (!input.witnessUtxo?.script) {
    return "unknown";
  }

  try {
    return btc.OutScript.decode(input.witnessUtxo.script).type;
  } catch {
    return "unknown";
  }
}

function chooseSellerInputVbytes(scriptType: string): number {
  if (scriptType === "tr" || scriptType === "tr_ms" || scriptType === "tr_ns") {
    return Math.ceil(P2TR_INPUT_BASE_VBYTES + 16);
  }
  if (scriptType === "wpkh") {
    return P2WPKH_INPUT_VBYTES;
  }
  return 90;
}

function resolveFeeRateWithTiers(
  feeRate: "fast" | "medium" | "slow" | number,
  tiers: { fast: number; medium: number; slow: number }
): number {
  if (typeof feeRate === "number") {
    return feeRate;
  }

  switch (feeRate) {
    case "fast":
      return tiers.fast;
    case "slow":
      return tiers.slow;
    case "medium":
    default:
      return tiers.medium;
  }
}

export function registerPsbtTools(server: McpServer): void {
  server.registerTool(
    "psbt_create_ordinal_buy",
    {
      description:
        "Create a PSBT for buying an ordinal: buyer pays seller in BTC, seller's inscription UTXO is transferred to buyer. " +
        "This prepares the PSBT for both parties to sign.",
      inputSchema: {
        inscriptionUtxo: z
          .string()
          .describe("Seller inscription outpoint in txid:vout format"),
        sellerAddress: z.string().describe("Seller BTC address to receive payment"),
        priceSats: z
          .number()
          .int()
          .positive()
          .describe("Purchase price in satoshis paid to seller"),
        buyerReceiveAddress: z
          .string()
          .describe("Buyer BTC address that will receive the inscription UTXO"),
        feeRate: z
          .union([z.enum(["fast", "medium", "slow"]), z.number().positive()])
          .optional()
          .default("medium")
          .describe(
            "Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or explicit sat/vB"
          ),
      },
    },
    async ({ inscriptionUtxo, sellerAddress, priceSats, buyerReceiveAddress, feeRate }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();

        if (!account?.btcAddress || !account.btcPublicKey) {
          throw new Error(
            "Wallet must be unlocked with Bitcoin keys. Use wallet_unlock first."
          );
        }

        const outpoint = parseOutpoint(inscriptionUtxo);
        const mempool = new MempoolApi(NETWORK);
        const btcNetwork = getBtcNetwork(NETWORK);

        const sellerTxHex = await mempool.getTxHex(outpoint.txid);
        const sellerTx = btc.Transaction.fromRaw(Buffer.from(sellerTxHex, "hex"), {
          allowUnknownInputs: true,
          allowUnknownOutputs: true,
          disableScriptCheck: true,
        });

        if (outpoint.vout >= sellerTx.outputsLength) {
          throw new Error(
            `Invalid outpoint: vout ${outpoint.vout} out of range (outputs=${sellerTx.outputsLength})`
          );
        }

        const inscriptionOutput = sellerTx.getOutput(outpoint.vout);
        if (inscriptionOutput.amount === undefined || inscriptionOutput.script === undefined) {
          throw new Error("Inscription outpoint is missing amount/script in source transaction.");
        }

        const inscriptionAmount = inscriptionOutput.amount;
        const inscriptionScript = inscriptionOutput.script;
        const inscriptionValueSats = Number(inscriptionAmount);
        if (!Number.isSafeInteger(inscriptionValueSats) || inscriptionValueSats <= 0) {
          throw new Error("Inscription output amount is invalid or too large.");
        }

        const sellerScriptType = (() => {
          try {
            return btc.OutScript.decode(inscriptionScript).type;
          } catch {
            return "unknown";
          }
        })();

        const sellerInputVbytes = chooseSellerInputVbytes(sellerScriptType);
        const feeTiers = await mempool.getFeeTiers();
        const resolvedFeeRate = resolveFeeRateWithTiers(feeRate, feeTiers);

        const utxos = (await mempool.getUtxos(account.btcAddress))
          .filter((u) => u.status.confirmed)
          .filter((u) => !(u.txid.toLowerCase() === outpoint.txid && u.vout === outpoint.vout))
          .sort((a, b) => b.value - a.value);

        if (utxos.length === 0) {
          throw new Error(
            `No confirmed buyer UTXOs available at ${account.btcAddress}. Fund the wallet first.`
          );
        }

        const selectedUtxos: typeof utxos = [];
        let selectedTotal = 0;
        let estimatedFee = 0;

        for (const utxo of utxos) {
          selectedUtxos.push(utxo);
          selectedTotal += utxo.value;

          estimatedFee = estimateBuyPsbtFeeSats({
            feeRate: resolvedFeeRate,
            buyerInputCount: selectedUtxos.length,
            sellerInputVbytes,
            outputCount: 3,
          });

          if (selectedTotal >= priceSats + estimatedFee) {
            break;
          }
        }

        if (selectedTotal < priceSats + estimatedFee) {
          throw new Error(
            `Insufficient buyer funds: have ${selectedTotal} sats, need at least ${priceSats + estimatedFee} sats.`
          );
        }

        const changeSats = selectedTotal - priceSats - estimatedFee;
        const includeChange = changeSats >= DUST_THRESHOLD;

        const tx = new btc.Transaction({
          allowUnknownInputs: true,
          allowUnknownOutputs: true,
          disableScriptCheck: true,
        });

        tx.addInput({
          txid: outpoint.txid,
          index: outpoint.vout,
          witnessUtxo: {
            amount: inscriptionAmount,
            script: inscriptionScript,
          },
        });

        const buyerP2wpkh = btc.p2wpkh(account.btcPublicKey, btcNetwork);

        for (const utxo of selectedUtxos) {
          tx.addInput({
            txid: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
              amount: BigInt(utxo.value),
              script: buyerP2wpkh.script,
            },
          });
        }

        tx.addOutputAddress(buyerReceiveAddress, inscriptionAmount, btcNetwork);
        tx.addOutputAddress(sellerAddress, BigInt(priceSats), btcNetwork);

        if (includeChange) {
          tx.addOutputAddress(account.btcAddress, BigInt(changeSats), btcNetwork);
        }

        const psbtBase64 = encodePsbtBase64(tx);

        return createJsonResponse({
          success: true,
          network: NETWORK,
          psbtBase64,
          summary: {
            inscriptionUtxo: `${outpoint.txid}:${outpoint.vout}`,
            inscriptionValueSats,
            sellerAddress,
            buyerFundingAddress: account.btcAddress,
            buyerReceiveAddress,
            priceSats,
            feeRate: resolvedFeeRate,
            estimatedFeeSats: estimatedFee,
            buyerInputCount: selectedUtxos.length,
            includesChange: includeChange,
            changeSats: includeChange ? changeSats : 0,
            sellerInputScriptType: sellerScriptType,
            sellerInputIndex: 0,
            buyerInputIndexes: selectedUtxos.map((_, idx) => idx + 1),
          },
          nextSteps: [
            "1. Share PSBT with seller to sign seller input (index 0)",
            "2. Sign buyer inputs with psbt_sign",
            "3. Finalize and broadcast with psbt_broadcast",
          ],
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "psbt_sign",
    {
      description:
        "Sign one or more PSBT inputs with the active wallet. Supports buyer (P2WPKH) and taproot keys.",
      inputSchema: {
        psbtBase64: z.string().describe("PSBT in base64 format"),
        signInputs: z
          .array(z.number().int().nonnegative())
          .optional()
          .describe("Optional input indexes to sign. Signs all signable inputs if omitted."),
        finalizeSignedInputs: z
          .boolean()
          .optional()
          .default(false)
          .describe("Finalize only the inputs signed in this call"),
      },
    },
    async ({ psbtBase64, signInputs, finalizeSignedInputs }) => {
      try {
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();

        if (!account?.btcPrivateKey && !account?.taprootPrivateKey) {
          throw new Error(
            "No BTC signing keys available. Unlock wallet first with wallet_unlock."
          );
        }

        const tx = decodePsbtBase64(psbtBase64);
        const indexes =
          signInputs && signInputs.length > 0
            ? Array.from(new Set(signInputs))
            : Array.from({ length: tx.inputsLength }, (_, i) => i);

        const signedInputs: number[] = [];
        const skippedInputs: Array<{ index: number; reason: string }> = [];
        const finalizedInputs: number[] = [];

        for (const idx of indexes) {
          if (idx < 0 || idx >= tx.inputsLength) {
            skippedInputs.push({ index: idx, reason: "input index out of range" });
            continue;
          }

          let signed = false;
          const errors: string[] = [];

          if (account.btcPrivateKey) {
            try {
              signed = tx.signIdx(account.btcPrivateKey, idx) || signed;
            } catch (e) {
              errors.push(`btc key: ${String(e)}`);
            }
          }

          if (!signed && account.taprootPrivateKey) {
            try {
              signed = tx.signIdx(account.taprootPrivateKey, idx) || signed;
            } catch (e) {
              errors.push(`taproot key: ${String(e)}`);
            }
          }

          if (!signed) {
            skippedInputs.push({
              index: idx,
              reason: errors.length > 0 ? errors.join(" | ") : "no matching key for this input",
            });
            continue;
          }

          signedInputs.push(idx);

          if (finalizeSignedInputs) {
            try {
              tx.finalizeIdx(idx);
              finalizedInputs.push(idx);
            } catch (e) {
              skippedInputs.push({
                index: idx,
                reason: `signed but not finalizable yet: ${String(e)}`,
              });
            }
          }
        }

        return createJsonResponse({
          success: signedInputs.length > 0,
          network: NETWORK,
          signedInputs,
          finalizedInputs,
          skippedInputs,
          psbtBase64: encodePsbtBase64(tx),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "psbt_broadcast",
    {
      description:
        "Finalize a fully signed PSBT and broadcast it to the Bitcoin network via mempool.space.",
      inputSchema: {
        psbtBase64: z.string().describe("Fully signed PSBT in base64 format"),
      },
    },
    async ({ psbtBase64 }) => {
      try {
        const tx = decodePsbtBase64(psbtBase64);
        tx.finalize();

        const rawTx = tx.extract();
        const txHex = Buffer.from(rawTx).toString("hex");

        const mempool = new MempoolApi(NETWORK);
        const txid = await mempool.broadcastTransaction(txHex);

        return createJsonResponse({
          success: true,
          network: NETWORK,
          txid,
          explorerUrl: getMempoolTxUrl(txid, NETWORK),
          txHex,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "psbt_decode",
    {
      description:
        "Decode a PSBT to inspect inputs, outputs, signatures, and signing status before broadcast.",
      inputSchema: {
        psbtBase64: z.string().describe("PSBT in base64 format"),
      },
    },
    async ({ psbtBase64 }) => {
      try {
        const tx = decodePsbtBase64(psbtBase64);
        const btcNetwork = getBtcNetwork(NETWORK);

        const inputs = Array.from({ length: tx.inputsLength }, (_, idx) => {
          const input = tx.getInput(idx);
          const txidHex = input.txid
            ? Buffer.from(input.txid).toString("hex")
            : undefined;

          return {
            index: idx,
            outpoint: txidHex !== undefined ? `${txidHex}:${input.index}` : undefined,
            scriptType: detectInputScriptType(input),
            amountSats: input.witnessUtxo?.amount?.toString(),
            hasWitnessUtxo: !!input.witnessUtxo,
            hasNonWitnessUtxo: !!input.nonWitnessUtxo,
            partialSigCount: input.partialSig?.length ?? 0,
            hasTapKeySig: !!input.tapKeySig,
            status:
              input.finalScriptSig || input.finalScriptWitness
                ? "finalized"
                : input.partialSig?.length || input.tapKeySig
                  ? "partially_signed"
                  : "unsigned",
          };
        });

        const outputs = Array.from({ length: tx.outputsLength }, (_, idx) => {
          const output = tx.getOutput(idx);
          return {
            index: idx,
            amountSats: output.amount?.toString(),
            address: tx.getOutputAddress(idx, btcNetwork),
            scriptHex: output.script ? Buffer.from(output.script).toString("hex") : undefined,
          };
        });

        let feeSats: string | undefined;
        try {
          feeSats = tx.fee.toString();
        } catch {
          feeSats = undefined;
        }

        return createJsonResponse({
          network: NETWORK,
          txidIfFinalized: tx.isFinal ? tx.id : undefined,
          isFinal: tx.isFinal,
          inputsLength: tx.inputsLength,
          outputsLength: tx.outputsLength,
          vsize: tx.vsize,
          feeSats,
          inputs,
          outputs,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
