import {
  ClarityValue,
  uintCV,
  principalCV,
  someCV,
  noneCV,
  bufferCV,
  tupleCV,
  hexToCV,
  cvToJSON,
} from "@stacks/transactions";
import { HiroApiService, getHiroApi } from "./hiro-api.js";
import { getContracts, parseContractId, type Network } from "../config/index.js";
import { callContract, type Account, type TransferResult } from "../transactions/builder.js";
import { sponsoredContractCall } from "../transactions/sponsor-builder.js";
import { createFungiblePostCondition } from "../transactions/post-conditions.js";

// ============================================================================
// Types
// ============================================================================

export interface SbtcBalance {
  balance: string;
  balanceSats: string;
  balanceBtc: string;
}

export interface SbtcPegInfo {
  totalSupply: string;
  totalSupplySats: string;
  totalSupplyBtc: string;
  pegRatio: string;
}

export interface SbtcDepositInfo {
  depositAddress: string;
  minDeposit: string;
  maxDeposit: string;
  instructions: string[];
}

export interface SbtcWithdrawalRecipient {
  version: number;
  hashbytesHex: string;
}

export interface SbtcWithdrawalRequest {
  id: number;
  amountSats: string;
  maxFeeSats: string;
  sender: string;
  blockHeight: string;
  recipient: SbtcWithdrawalRecipient;
  status: "pending" | "accepted" | "rejected";
}

// ============================================================================
// sBTC Service
// ============================================================================

export class SbtcService {
  private hiro: HiroApiService;
  private contracts: ReturnType<typeof getContracts>;

  constructor(private network: Network) {
    this.hiro = getHiroApi(network);
    this.contracts = getContracts(network);
  }

  /**
   * Get sBTC balance for an address
   */
  async getBalance(address: string): Promise<SbtcBalance> {
    const sbtcContract = this.contracts.SBTC_TOKEN;
    const balance = await this.hiro.getTokenBalance(address, sbtcContract);

    // sBTC uses 8 decimals (same as Bitcoin)
    const balanceSats = balance;
    const balanceBtc = (BigInt(balance) / BigInt(100_000_000)).toString();

    return {
      balance,
      balanceSats,
      balanceBtc,
    };
  }

  /**
   * Transfer sBTC to a recipient
   * @param fee Optional fee in micro-STX. If omitted, fee is auto-estimated.
   */
  async transfer(
    account: Account,
    recipient: string,
    amount: bigint,
    memo?: string,
    fee?: bigint,
    sponsored?: boolean
  ): Promise<TransferResult> {
    const sbtcContract = this.contracts.SBTC_TOKEN;
    const { address: contractAddress, name: contractName } = parseContractId(sbtcContract);

    const functionArgs: ClarityValue[] = [
      uintCV(amount),
      principalCV(account.address),
      principalCV(recipient),
      memo ? someCV(bufferCV(Buffer.from(memo).subarray(0, 34))) : noneCV(),
    ];

    // Add post condition: sender must send exactly `amount` of sBTC
    const postCondition = createFungiblePostCondition(
      account.address,
      sbtcContract,
      "sbtc-token",
      "eq",
      amount
    );

    const contractCallOptions = {
      contractAddress,
      contractName,
      functionName: "transfer",
      functionArgs,
      postConditions: [postCondition],
      ...(fee !== undefined && { fee }),
    };

    if (sponsored) {
      return sponsoredContractCall(account, contractCallOptions, this.network);
    }

    return callContract(account, contractCallOptions);
  }

  /**
   * Get sBTC deposit instructions
   * Note: sBTC deposits require interacting with the Bitcoin network directly
   */
  async getDepositInfo(): Promise<SbtcDepositInfo> {
    return {
      depositAddress: "Use sBTC bridge at https://bridge.stx.eco",
      minDeposit: "0.0001 BTC",
      maxDeposit: "No limit",
      instructions: [
        "1. Visit the sBTC bridge at https://bridge.stx.eco",
        "2. Connect your Bitcoin and Stacks wallets",
        "3. Follow the bridge UI to deposit BTC",
        "4. Wait for Bitcoin block confirmations",
        "5. sBTC will be minted to your Stacks address",
      ],
    };
  }

  /**
   * Get sBTC peg information
   */
  async getPegInfo(): Promise<SbtcPegInfo> {
    const sbtcContract = this.contracts.SBTC_TOKEN;
    const metadata = await this.hiro.getTokenMetadata(sbtcContract);

    const totalSupply = metadata?.total_supply || "0";
    const totalSupplySats = totalSupply;
    const totalSupplyBtc = (BigInt(totalSupply) / BigInt(100_000_000)).toString();

    return {
      totalSupply,
      totalSupplySats,
      totalSupplyBtc,
      pegRatio: "1:1",
    };
  }

  /**
   * Initiate an sBTC withdrawal request (peg-out) through sbtc-withdrawal.
   * Locks (amount + maxFee) of sBTC until signer acceptance/rejection.
   */
  async initiateWithdrawal(
    account: Account,
    amount: bigint,
    maxFee: bigint,
    recipient: SbtcWithdrawalRecipient,
    fee?: bigint,
    sponsored?: boolean
  ): Promise<TransferResult> {
    const withdrawalContract = this.contracts.SBTC_WITHDRAWAL;
    const { address: contractAddress, name: contractName } =
      parseContractId(withdrawalContract);

    const recipientHash = Buffer.from(recipient.hashbytesHex, "hex");
    const functionArgs: ClarityValue[] = [
      uintCV(amount),
      tupleCV({
        version: bufferCV(Buffer.from([recipient.version])),
        hashbytes: bufferCV(recipientHash),
      }),
      uintCV(maxFee),
    ];

    // sbtc-withdrawal locks amount + maxFee in sbtc-token.
    const lockAmount = amount + maxFee;
    const postCondition = createFungiblePostCondition(
      account.address,
      this.contracts.SBTC_TOKEN,
      "sbtc-token",
      "eq",
      lockAmount
    );

    const contractCallOptions = {
      contractAddress,
      contractName,
      functionName: "initiate-withdrawal-request",
      functionArgs,
      postConditions: [postCondition],
      ...(fee !== undefined && { fee }),
    };

    if (sponsored) {
      return sponsoredContractCall(account, contractCallOptions, this.network);
    }

    return callContract(account, contractCallOptions);
  }

  /**
   * Extract withdrawal request id from initiate-withdrawal transaction result.
   * Returns null if tx is still pending or result is unavailable.
   */
  async getWithdrawalRequestIdFromTx(txid: string): Promise<number | null> {
    const tx = await this.hiro.getTransaction(txid);
    if (!tx.tx_result?.hex) {
      return null;
    }

    const decoded = cvToJSON(hexToCV(tx.tx_result.hex));
    if (!decoded.success || decoded.value?.type !== "uint") {
      return null;
    }

    const requestId = Number(decoded.value.value);
    return Number.isSafeInteger(requestId) ? requestId : null;
  }

  /**
   * Fetch withdrawal request details from sbtc-registry.
   */
  async getWithdrawalRequest(
    requestId: number,
    senderAddress: string
  ): Promise<SbtcWithdrawalRequest | null> {
    const result = await this.hiro.callReadOnlyFunction(
      this.contracts.SBTC_REGISTRY,
      "get-withdrawal-request",
      [uintCV(requestId)],
      senderAddress
    );

    if (!result.okay || !result.result) {
      throw new Error(result.cause || "Failed to read withdrawal request");
    }

    const decoded = cvToJSON(hexToCV(result.result));
    if (decoded.value === null) {
      return null;
    }

    const value = decoded.value as {
      type: string;
      value: Record<string, { type: string; value: unknown }>;
    };
    const tuple = value.value;

    const recipientTuple = tuple.recipient?.value as
      | Record<string, { type: string; value: unknown }>
      | undefined;

    if (!recipientTuple?.version || !recipientTuple?.hashbytes) {
      throw new Error("Malformed recipient tuple in withdrawal request");
    }

    const versionHex = String(recipientTuple.version.value).replace(/^0x/, "");
    const hashHex = String(recipientTuple.hashbytes.value).replace(/^0x/, "");

    const statusValue = tuple.status?.value as
      | { type: string; value: unknown }
      | null
      | undefined;

    let status: "pending" | "accepted" | "rejected" = "pending";
    if (statusValue?.type === "bool") {
      status = statusValue.value === true ? "accepted" : "rejected";
    }

    return {
      id: requestId,
      amountSats: String(tuple.amount?.value ?? "0"),
      maxFeeSats: String(tuple["max-fee"]?.value ?? "0"),
      sender: String(tuple.sender?.value ?? ""),
      blockHeight: String(tuple["block-height"]?.value ?? "0"),
      recipient: {
        version: Number.parseInt(versionHex, 16),
        hashbytesHex: hashHex.toLowerCase(),
      },
      status,
    };
  }

}

// ============================================================================
// Helper Functions
// ============================================================================

let _sbtcServiceInstance: SbtcService | null = null;

export function getSbtcService(network: Network): SbtcService {
  if (!_sbtcServiceInstance || _sbtcServiceInstance["network"] !== network) {
    _sbtcServiceInstance = new SbtcService(network);
  }
  return _sbtcServiceInstance;
}
