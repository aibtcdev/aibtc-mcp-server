import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as btc from "@scure/btc-signer";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getSbtcService } from "../services/sbtc.service.js";
import { getSbtcDepositService } from "../services/sbtc-deposit.service.js";
import { getExplorerTxUrl } from "../config/networks.js";
import { getContracts, parseContractId } from "../config/contracts.js";
import { createJsonResponse, createErrorResponse, resolveFee } from "../utils/index.js";
import { getWalletManager } from "../services/wallet-manager.js";
import { MempoolApi, getMempoolTxUrl } from "../services/mempool-api.js";
import { getBtcNetwork } from "../transactions/bitcoin-builder.js";
import { sponsoredSchema } from "./schemas.js";

function parseBtcRecipientTuple(btcRecipientAddress: string): {
  version: number;
  hashbytesHex: string;
} {
  const decoded = btc.Address(getBtcNetwork(NETWORK)).decode(btcRecipientAddress);

  if (decoded.type === "tr" && decoded.pubkey) {
    return { version: 0x06, hashbytesHex: Buffer.from(decoded.pubkey).toString("hex") };
  }

  switch (decoded.type) {
    case "pkh":
      return { version: 0x00, hashbytesHex: Buffer.from(decoded.hash).toString("hex") };
    case "sh":
      return { version: 0x01, hashbytesHex: Buffer.from(decoded.hash).toString("hex") };
    case "wpkh":
      return { version: 0x04, hashbytesHex: Buffer.from(decoded.hash).toString("hex") };
    case "wsh":
      return { version: 0x05, hashbytesHex: Buffer.from(decoded.hash).toString("hex") };
    default:
      throw new Error(
        "Unsupported BTC recipient address type. Supported: P2PKH, P2SH, P2WPKH, P2WSH, P2TR."
      );
  }
}

function getReadonlySenderAddress(): string {
  const contracts = getContracts(NETWORK);
  return parseContractId(contracts.SBTC_REGISTRY).address;
}

export function registerSbtcTools(server: McpServer): void {
  // Get sBTC balance
  server.registerTool(
    "sbtc_get_balance",
    {
      description: "Get the sBTC balance for a wallet address.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Wallet address to check. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        const sbtcService = getSbtcService(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const balance = await sbtcService.getBalance(walletAddress);

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          balance: {
            sats: balance.balanceSats,
            btc: balance.balanceBtc + " sBTC",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Transfer sBTC
  server.registerTool(
    "sbtc_transfer",
    {
      description: `Transfer sBTC tokens to a recipient address.

sBTC uses 8 decimals (same as Bitcoin).
Example: To send 0.001 sBTC, use amount "100000" (satoshis).`,
      inputSchema: {
        recipient: z.string().describe("The recipient's Stacks address"),
        amount: z.string().describe("Amount in satoshis (0.00000001 sBTC). Example: '100000' for 0.001 sBTC"),
        memo: z.string().optional().describe("Optional memo message"),
        fee: z
          .string()
          .optional()
          .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount. If omitted, auto-estimated."),
        sponsored: sponsoredSchema,
      },
    },
    async ({ recipient, amount, memo, fee, sponsored }) => {
      try {
        const sbtcService = getSbtcService(NETWORK);
        const account = await getAccount();
        const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
        const result = await sbtcService.transfer(account, recipient, BigInt(amount), memo, resolvedFee, sponsored);

        const btcAmount = (BigInt(amount) / BigInt(100_000_000)).toString();

        return createJsonResponse({
          success: true,
          txid: result.txid,
          from: account.address,
          recipient,
          amount: btcAmount + " sBTC",
          amountSats: amount,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Shared withdrawal logic used by both sbtc_initiate_withdrawal and sbtc_withdraw
  async function executeWithdrawal(params: {
    amount: number;
    btcRecipientAddress: string;
    maxFee: number;
    fee?: string;
    sponsored: boolean;
  }) {
    const { amount, btcRecipientAddress, maxFee, fee, sponsored } = params;

    if (amount <= maxFee) {
      throw new Error(
        `Withdrawal amount must exceed maxFee. amount=${amount}, maxFee=${maxFee}`
      );
    }

    const sbtcService = getSbtcService(NETWORK);
    const account = await getAccount();
    const resolvedFee = await resolveFee(fee, NETWORK, "contract_call");
    const recipientTuple = parseBtcRecipientTuple(btcRecipientAddress);

    const result = await sbtcService.initiateWithdrawal(
      account,
      BigInt(amount),
      BigInt(maxFee),
      recipientTuple,
      resolvedFee,
      sponsored
    );

    let requestId: number | null = null;
    try {
      requestId = await sbtcService.getWithdrawalRequestIdFromTx(result.txid);
    } catch {
      requestId = null;
    }

    return { result, recipientTuple, requestId };
  }

  const withdrawalInputSchema = {
    amount: z
      .number()
      .int()
      .positive()
      .describe("Amount to withdraw in satoshis"),
    btcRecipientAddress: z
      .string()
      .describe("Bitcoin recipient address (P2PKH/P2SH/P2WPKH/P2WSH/P2TR)"),
    maxFee: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .default(2000)
      .describe("Maximum signer fee in satoshis"),
    fee: z
      .string()
      .optional()
      .describe("Optional fee: 'low' | 'medium' | 'high' preset or micro-STX amount."),
    sponsored: sponsoredSchema,
  };

  // Initiate sBTC withdrawal (peg-out to BTC L1)
  server.registerTool(
    "sbtc_initiate_withdrawal",
    {
      description: `Initiate an sBTC peg-out to a Bitcoin L1 address.

Locks (amount + maxFee) of sBTC in the sBTC protocol and creates a withdrawal request.
Signers later process the request and send BTC on L1.`,
      inputSchema: withdrawalInputSchema,
    },
    async ({ amount, btcRecipientAddress, maxFee, fee, sponsored }) => {
      try {
        const { result, recipientTuple, requestId } = await executeWithdrawal({
          amount, btcRecipientAddress, maxFee, fee, sponsored,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          requestId,
          network: NETWORK,
          recipient: {
            address: btcRecipientAddress,
            version: recipientTuple.version,
            hashbytesHex: recipientTuple.hashbytesHex,
          },
          withdrawal: {
            amountSats: amount,
            maxFeeSats: maxFee,
            lockedSats: amount + maxFee,
          },
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
          nextStep:
            requestId !== null
              ? `Track with sbtc_withdrawal_status using requestId=${requestId}`
              : "Track with sbtc_withdrawal_status using this txid once it confirms.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Compatibility alias for sbtc_initiate_withdrawal
  server.registerTool(
    "sbtc_withdraw",
    {
      description:
        "Alias for sbtc_initiate_withdrawal. Initiates an sBTC peg-out request to BTC L1.",
      inputSchema: withdrawalInputSchema,
    },
    async ({ amount, btcRecipientAddress, maxFee, fee, sponsored }) => {
      try {
        const { result } = await executeWithdrawal({
          amount, btcRecipientAddress, maxFee, fee, sponsored,
        });

        return createJsonResponse({
          success: true,
          txid: result.txid,
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(result.txid, NETWORK),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Shared withdrawal status logic used by sbtc_withdrawal_status and sbtc_withdraw_status
  async function fetchWithdrawalStatus(params: {
    requestId?: number;
    txid?: string;
  }) {
    const { requestId, txid } = params;

    if (requestId === undefined && !txid) {
      throw new Error("Provide either requestId or txid.");
    }

    const sbtcService = getSbtcService(NETWORK);
    let resolvedRequestId: number | null | undefined = requestId;

    if (resolvedRequestId === undefined && txid) {
      resolvedRequestId = await sbtcService.getWithdrawalRequestIdFromTx(txid);
      if (resolvedRequestId === null) {
        return createJsonResponse({
          txid,
          requestId: null,
          status: "pending_tx",
          message:
            "Could not resolve requestId from tx yet. The transaction may still be pending or unindexed.",
          network: NETWORK,
          explorerUrl: getExplorerTxUrl(txid, NETWORK),
        });
      }
    }

    if (resolvedRequestId == null) {
      throw new Error("Unable to resolve withdrawal request ID.");
    }

    const request = await sbtcService.getWithdrawalRequest(
      resolvedRequestId,
      getReadonlySenderAddress()
    );

    if (!request) {
      return createJsonResponse({
        requestId: resolvedRequestId,
        status: "not_found",
        network: NETWORK,
      });
    }

    return createJsonResponse({
      requestId: request.id,
      status: request.status,
      network: NETWORK,
      amountSats: request.amountSats,
      maxFeeSats: request.maxFeeSats,
      sender: request.sender,
      blockHeight: request.blockHeight,
      recipient: request.recipient,
      txid,
      ...(txid ? { explorerUrl: getExplorerTxUrl(txid, NETWORK) } : {}),
    });
  }

  const withdrawalStatusInputSchema = {
    requestId: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Withdrawal request ID"),
    txid: z
      .string()
      .optional()
      .describe("Initiate-withdrawal transaction ID (used to resolve requestId)"),
  };

  // Check withdrawal request status
  server.registerTool(
    "sbtc_withdrawal_status",
    {
      description:
        "Check status of an sBTC withdrawal request by requestId or initiating txid.",
      inputSchema: withdrawalStatusInputSchema,
    },
    async ({ requestId, txid }) => {
      try {
        return await fetchWithdrawalStatus({ requestId, txid });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Compatibility alias for sbtc_withdrawal_status
  server.registerTool(
    "sbtc_withdraw_status",
    {
      description:
        "Alias for sbtc_withdrawal_status. Check the status of an sBTC peg-out (withdrawal) request.",
      inputSchema: withdrawalStatusInputSchema,
    },
    async ({ requestId, txid }) => {
      try {
        return await fetchWithdrawalStatus({ requestId, txid });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get sBTC deposit info
  server.registerTool(
    "sbtc_get_deposit_info",
    {
      description: "Get information about how to deposit BTC to receive sBTC.",
    },
    async () => {
      try {
        // Try to get wallet account (don't throw if not unlocked)
        const walletManager = getWalletManager();
        let account;
        try {
          account = walletManager.getActiveAccount();
        } catch {
          // Wallet not unlocked - return generic instructions
          account = null;
        }

        // If wallet is unlocked and has Taproot keys, generate real deposit address
        if (account?.taprootPublicKey) {
          const depositService = getSbtcDepositService(NETWORK);
          const reclaimPublicKey = Buffer.from(account.taprootPublicKey).toString("hex");

          const depositAddressInfo = await depositService.buildDepositAddress(
            account.address,
            reclaimPublicKey,
            80000, // Default max signer fee
            950 // Default reclaim lock time (blocks)
          );

          return createJsonResponse({
            network: NETWORK,
            depositAddress: depositAddressInfo.depositAddress,
            maxSignerFee: `${depositAddressInfo.maxFee} satoshis`,
            reclaimLockTime: `${depositAddressInfo.lockTime} blocks`,
            stacksAddress: account.address,
            instructions: [
              "1. Send BTC to the deposit address above",
              "2. Wait for Bitcoin block confirmations",
              "3. sBTC tokens will be minted to your Stacks address",
              "4. If the deposit fails, you can reclaim your BTC after the lock time expires",
              "Alternatively, use the sbtc_deposit tool to build and broadcast the transaction automatically."
            ],
          });
        }

        // Wallet not unlocked - return generic instructions
        const sbtcService = getSbtcService(NETWORK);
        const depositInfo = await sbtcService.getDepositInfo();

        return createJsonResponse({
          network: NETWORK,
          ...depositInfo,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get sBTC peg info
  server.registerTool(
    "sbtc_get_peg_info",
    {
      description: "Get sBTC peg information including total supply and peg ratio.",
    },
    async () => {
      try {
        const sbtcService = getSbtcService(NETWORK);
        const pegInfo = await sbtcService.getPegInfo();

        return createJsonResponse({
          network: NETWORK,
          totalSupply: {
            sats: pegInfo.totalSupplySats,
            btc: pegInfo.totalSupplyBtc + " sBTC",
          },
          pegRatio: pegInfo.pegRatio,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Deposit BTC → sBTC
  server.registerTool(
    "sbtc_deposit",
    {
      description: `Deposit BTC to receive sBTC on Stacks L2.

This builds, signs, and broadcasts a Bitcoin transaction to the sBTC deposit address.
After confirmation, sBTC tokens are minted to your Stacks address.

The transaction uses your wallet's Taproot address for the reclaim path.
If the deposit fails, you can reclaim your BTC after the lock time expires.

By default, only uses cardinal UTXOs (safe to spend - no inscriptions).
Set includeOrdinals=true to allow spending ordinal UTXOs (advanced users only).`,
      inputSchema: {
        amount: z
          .number()
          .int()
          .positive()
          .describe("Amount to deposit in satoshis (1 BTC = 100,000,000 satoshis)"),
        feeRate: z
          .union([
            z.enum(["fast", "medium", "slow"]),
            z.number().int().positive(),
          ])
          .optional()
          .default("medium")
          .describe(
            "Fee rate: 'fast' (~10 min), 'medium' (~30 min), 'slow' (~1 hr), or number in sat/vB"
          ),
        maxSignerFee: z
          .number()
          .int()
          .positive()
          .optional()
          .default(80000)
          .describe(
            "Max fee the sBTC system can charge in satoshis (default: 80000 sats)"
          ),
        reclaimLockTime: z
          .number()
          .int()
          .positive()
          .optional()
          .default(950)
          .describe(
            "Block height when reclaim becomes available if deposit fails (default: 950 blocks)"
          ),
        includeOrdinals: z
          .boolean()
          .optional()
          .default(false)
          .describe(
            "Include ordinal UTXOs (contains inscriptions). Default: false (cardinal only). " +
            "WARNING: Setting this to true may destroy valuable inscriptions!"
          ),
      },
    },
    async ({ amount, feeRate, maxSignerFee, reclaimLockTime, includeOrdinals }) => {
      try {
        // Get wallet account (requires unlocked wallet)
        const walletManager = getWalletManager();
        const account = walletManager.getActiveAccount();

        if (!account) {
          throw new Error(
            "Wallet is not unlocked. Use wallet_unlock first to enable transactions."
          );
        }

        if (!account.btcAddress || !account.taprootAddress || !account.taprootPublicKey) {
          throw new Error(
            "Bitcoin or Taproot keys not available. Please unlock your wallet again."
          );
        }

        // Resolve fee rate
        let resolvedFeeRate: number;
        if (typeof feeRate === "number") {
          resolvedFeeRate = feeRate;
        } else {
          const api = new MempoolApi(NETWORK);
          const feeTiers = await api.getFeeTiers();
          switch (feeRate) {
            case "fast":
              resolvedFeeRate = feeTiers.fast;
              break;
            case "slow":
              resolvedFeeRate = feeTiers.slow;
              break;
            case "medium":
            default:
              resolvedFeeRate = feeTiers.medium;
              break;
          }
        }

        // Get deposit service
        const depositService = getSbtcDepositService(NETWORK);

        // Reclaim public key is the Taproot internal public key (x-only, 32 bytes)
        // Convert Uint8Array to hex string
        const reclaimPublicKey = Buffer.from(account.taprootPublicKey).toString("hex");

        // Step 1: Build and sign the deposit transaction
        // Passing btcPrivateKey allows the service to sign internally using
        // the sbtc package's @scure/btc-signer (avoids version mismatch)
        const depositResult = await depositService.buildDepositTransaction(
          amount,
          account.address, // Stacks address to receive sBTC
          account.btcAddress, // Bitcoin address for UTXOs and change
          reclaimPublicKey,
          resolvedFeeRate,
          maxSignerFee,
          reclaimLockTime,
          account.btcPrivateKey, // Sign with P2WPKH key (inputs are from user's address)
          includeOrdinals
        );

        // Step 2: Broadcast signed transaction and notify Emily API
        const result = await depositService.broadcastAndNotify(
          depositResult.txHex,
          depositResult.depositScript,
          depositResult.reclaimScript,
          depositResult.vout
        );

        const btcAmount = (amount / 100_000_000).toFixed(8);

        return createJsonResponse({
          success: true,
          txid: result.txid,
          explorerUrl: getMempoolTxUrl(result.txid, NETWORK),
          deposit: {
            amount: btcAmount + " BTC",
            amountSats: amount,
            recipient: account.address,
            bitcoinAddress: account.btcAddress,
            taprootAddress: account.taprootAddress,
            maxSignerFee: maxSignerFee + " sats",
            reclaimLockTime: reclaimLockTime + " blocks",
            feeRate: `${resolvedFeeRate} sat/vB`,
          },
          network: NETWORK,
          note: "sBTC tokens will be minted to your Stacks address after Bitcoin transaction confirms.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Check sBTC deposit status
  server.registerTool(
    "sbtc_deposit_status",
    {
      description: "Check the status of an sBTC deposit transaction from Emily API.",
      inputSchema: {
        txid: z.string().describe("Bitcoin transaction ID of the deposit"),
        vout: z
          .number()
          .int()
          .nonnegative()
          .optional()
          .default(0)
          .describe("Output index of the deposit (default: 0)"),
      },
    },
    async ({ txid, vout }) => {
      try {
        const depositService = getSbtcDepositService(NETWORK);
        const status = await depositService.getDepositStatus(txid, vout);

        return createJsonResponse({
          txid,
          vout,
          status,
          explorerUrl: getMempoolTxUrl(txid, NETWORK),
          network: NETWORK,
        });
      } catch (error) {
        // Handle 404 (deposit not found) gracefully
        if (error instanceof Error && error.message.includes("404")) {
          return createJsonResponse({
            txid,
            vout,
            status: "not_found",
            message: "Deposit not found in Emily API. It may not be indexed yet, or the transaction may not be a valid sBTC deposit.",
            explorerUrl: getMempoolTxUrl(txid, NETWORK),
            network: NETWORK,
          });
        }
        return createErrorResponse(error);
      }
    }
  );

}
