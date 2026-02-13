import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";
import {
  makeSTXTokenTransfer,
  makeContractCall,
  makeContractDeploy,
  broadcastTransaction,
  PostConditionMode,
  PostCondition,
  ClarityValue,
  stringAsciiCV,
  stringUtf8CV,
  intCV,
  uintCV,
  boolCV,
  principalCV,
  bufferCV,
  listCV,
  tupleCV,
  noneCV,
  someCV,
} from "@stacks/transactions";
import { StacksNetworkName } from "@stacks/network";
import { hexToBytes } from "@stacks/common";

/**
 * @deprecated This module is superseded by modular replacements.
 * - mnemonicToAccount → src/services/x402.service.ts
 * - transferStx, callContract, deployContract, sign*, broadcast* → src/transactions/builder.ts
 * - getAccountInfo, getStxBalance, getTransactionStatus → src/services/hiro-api.ts
 * - parseArgToClarityValue → src/transactions/clarity-values.ts
 * - Network, getStacksNetwork, getApiBaseUrl → src/config/networks.ts
 * This file will be removed in a future version.
 */

/** @deprecated Use Network type from src/config/networks.ts */
export type Network = "mainnet" | "testnet";

/** @deprecated Use Account type from src/services/x402.service.ts */
export interface Account {
  address: string;
  privateKey: string;
  network: Network;
}

/** @deprecated Use TransactionResult from src/transactions/builder.ts */
export interface TransferResult {
  txid: string;
  rawTx: string;
}

/** @deprecated Use ContractCallOptions from src/transactions/builder.ts */
export interface ContractCallOptions {
  contractAddress: string;
  contractName: string;
  functionName: string;
  functionArgs: ClarityValue[];
  postConditionMode?: PostConditionMode;
  postConditions?: PostCondition[];
}

/** @deprecated Use ContractDeployOptions from src/transactions/builder.ts */
export interface ContractDeployOptions {
  contractName: string;
  codeBody: string;
}

/** @deprecated Use mnemonicToAccount from src/services/x402.service.ts */
export async function mnemonicToAccount(
  mnemonic: string,
  network: Network
): Promise<Account> {
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });

  const account = wallet.accounts[0];
  const address = getStxAddress(account, network);

  return {
    address,
    privateKey: account.stxPrivateKey,
    network,
  };
}

/** @deprecated Use getStacksNetwork from src/config/networks.ts */
export function getStacksNetwork(network: Network): StacksNetworkName {
  return network === "mainnet" ? "mainnet" : "testnet";
}

/** @deprecated Use getApiBaseUrl from src/config/networks.ts */
export function getApiBaseUrl(network: Network): string {
  return network === "mainnet"
    ? "https://api.mainnet.hiro.so"
    : "https://api.testnet.hiro.so";
}

/**
 * Get account info including nonce and balance from the Stacks API
 * @deprecated Use HiroApiService.getAccountInfo from src/services/hiro-api.ts
 */
export async function getAccountInfo(
  address: string,
  network: Network
): Promise<{ nonce: number; balance: string }> {
  const baseUrl = getApiBaseUrl(network);

  const response = await fetch(`${baseUrl}/v2/accounts/${address}`);
  if (!response.ok) {
    throw new Error(`Failed to get account info: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    nonce: data.nonce,
    balance: data.balance,
  };
}

/**
 * Get STX balance for an address
 * @deprecated Use HiroApiService.getStxBalance from src/services/hiro-api.ts
 */
export async function getStxBalance(
  address: string,
  network: Network
): Promise<{ stx: string; stxLocked: string }> {
  const baseUrl = getApiBaseUrl(network);

  const response = await fetch(`${baseUrl}/extended/v1/address/${address}/stx`);
  if (!response.ok) {
    throw new Error(`Failed to get STX balance: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    stx: data.balance,
    stxLocked: data.locked,
  };
}

/**
 * Transfer STX tokens to a recipient
 * @deprecated Use TransactionBuilder.transferStx from src/transactions/builder.ts
 */
export async function transferStx(
  account: Account,
  recipient: string,
  amount: bigint,
  memo?: string
): Promise<TransferResult> {
  const networkName = getStacksNetwork(account.network);

  const transaction = await makeSTXTokenTransfer({
    recipient,
    amount,
    senderKey: account.privateKey,
    network: networkName,
    memo: memo || "",
  });

  const broadcastResponse = await broadcastTransaction({
    transaction,
    network: networkName,
  });

  if ("error" in broadcastResponse) {
    throw new Error(
      `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`
    );
  }

  return {
    txid: broadcastResponse.txid,
    rawTx: transaction.serialize(),
  };
}

/**
 * Call a smart contract function
 * @deprecated Use TransactionBuilder.callContract from src/transactions/builder.ts
 */
export async function callContract(
  account: Account,
  options: ContractCallOptions
): Promise<TransferResult> {
  const networkName = getStacksNetwork(account.network);

  const transaction = await makeContractCall({
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    senderKey: account.privateKey,
    network: networkName,
    postConditionMode: options.postConditionMode || PostConditionMode.Deny,
    postConditions: options.postConditions || [],
  });

  const broadcastResponse = await broadcastTransaction({
    transaction,
    network: networkName,
  });

  if ("error" in broadcastResponse) {
    throw new Error(
      `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`
    );
  }

  return {
    txid: broadcastResponse.txid,
    rawTx: transaction.serialize(),
  };
}

/**
 * Deploy a smart contract
 * @deprecated Use TransactionBuilder.deployContract from src/transactions/builder.ts
 */
export async function deployContract(
  account: Account,
  options: ContractDeployOptions
): Promise<TransferResult> {
  const networkName = getStacksNetwork(account.network);

  const transaction = await makeContractDeploy({
    contractName: options.contractName,
    codeBody: options.codeBody,
    senderKey: account.privateKey,
    network: networkName,
  });

  const broadcastResponse = await broadcastTransaction({
    transaction,
    network: networkName,
  });

  if ("error" in broadcastResponse) {
    throw new Error(
      `Broadcast failed: ${broadcastResponse.error} - ${broadcastResponse.reason}`
    );
  }

  return {
    txid: broadcastResponse.txid,
    rawTx: transaction.serialize(),
  };
}

/**
 * Sign a transaction without broadcasting (for offline signing)
 * @deprecated Use TransactionBuilder.signStxTransfer from src/transactions/builder.ts
 */
export async function signStxTransfer(
  account: Account,
  recipient: string,
  amount: bigint,
  memo?: string
): Promise<{ signedTx: string; txid: string }> {
  const networkName = getStacksNetwork(account.network);

  const transaction = await makeSTXTokenTransfer({
    recipient,
    amount,
    senderKey: account.privateKey,
    network: networkName,
    memo: memo || "",
  });

  return {
    signedTx: transaction.serialize(),
    txid: transaction.txid(),
  };
}

/**
 * Sign a contract call without broadcasting
 * @deprecated Use TransactionBuilder.signContractCall from src/transactions/builder.ts
 */
export async function signContractCall(
  account: Account,
  options: ContractCallOptions
): Promise<{ signedTx: string; txid: string }> {
  const networkName = getStacksNetwork(account.network);

  const transaction = await makeContractCall({
    contractAddress: options.contractAddress,
    contractName: options.contractName,
    functionName: options.functionName,
    functionArgs: options.functionArgs,
    senderKey: account.privateKey,
    network: networkName,
    postConditionMode: options.postConditionMode || PostConditionMode.Deny,
    postConditions: options.postConditions || [],
  });

  return {
    signedTx: transaction.serialize(),
    txid: transaction.txid(),
  };
}

/**
 * Broadcast a pre-signed transaction
 * @deprecated Use TransactionBuilder.broadcastSignedTransaction from src/transactions/builder.ts
 */
export async function broadcastSignedTransaction(
  signedTx: string,
  network: Network
): Promise<{ txid: string }> {
  const baseUrl = getApiBaseUrl(network);
  const txBytes = Buffer.from(hexToBytes(signedTx));

  const response = await fetch(`${baseUrl}/v2/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: txBytes,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Broadcast failed: ${response.statusText} - ${errorText}`);
  }

  const txid = await response.text();
  return { txid: txid.replace(/"/g, "") };
}

/**
 * Get transaction status
 * @deprecated Use HiroApiService.getTransactionStatus from src/services/hiro-api.ts
 */
export async function getTransactionStatus(
  txid: string,
  network: Network
): Promise<{
  status: string;
  block_height?: number;
  tx_result?: unknown;
}> {
  const baseUrl = getApiBaseUrl(network);

  const response = await fetch(`${baseUrl}/extended/v1/tx/${txid}`);
  if (!response.ok) {
    if (response.status === 404) {
      return { status: "pending" };
    }
    throw new Error(`Failed to get transaction status: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    status: data.tx_status,
    block_height: data.block_height,
    tx_result: data.tx_result,
  };
}

/**
 * Parse a JSON argument into a ClarityValue
 * Supports: string, number, boolean, principal, buffer, list, tuple, optional
 * @deprecated Use parseArgToClarityValue from src/transactions/clarity-values.ts
 */
export function parseArgToClarityValue(arg: unknown): ClarityValue {
  if (arg === null || arg === undefined) {
    return noneCV();
  }

  if (typeof arg === "boolean") {
    return boolCV(arg);
  }

  if (typeof arg === "number") {
    if (Number.isInteger(arg)) {
      return arg >= 0 ? uintCV(arg) : intCV(arg);
    }
    throw new Error("Floating point numbers not supported in Clarity");
  }

  if (typeof arg === "string") {
    // Check if it's a principal (Stacks address pattern)
    if (arg.match(/^S[A-Z0-9]{38,}(\.[a-zA-Z][a-zA-Z0-9-]*)?$/)) {
      return principalCV(arg);
    }
    // Default to string-utf8
    return stringUtf8CV(arg);
  }

  if (Buffer.isBuffer(arg) || arg instanceof Uint8Array) {
    return bufferCV(arg as Uint8Array);
  }

  if (Array.isArray(arg)) {
    return listCV(arg.map(parseArgToClarityValue));
  }

  if (typeof arg === "object") {
    const obj = arg as Record<string, unknown>;

    // Check for typed values with explicit type field
    if ("type" in obj && "value" in obj) {
      const typedArg = obj as { type: string; value: unknown };
      switch (typedArg.type) {
        case "uint":
          return uintCV(BigInt(typedArg.value as string | number));
        case "int":
          return intCV(BigInt(typedArg.value as string | number));
        case "string-ascii":
          return stringAsciiCV(typedArg.value as string);
        case "string-utf8":
          return stringUtf8CV(typedArg.value as string);
        case "bool":
          return boolCV(typedArg.value as boolean);
        case "principal":
          return principalCV(typedArg.value as string);
        case "buffer":
          return bufferCV(Buffer.from(typedArg.value as string, "hex"));
        case "none":
          return noneCV();
        case "some":
          return someCV(parseArgToClarityValue(typedArg.value));
        case "list":
          return listCV(
            (typedArg.value as unknown[]).map(parseArgToClarityValue)
          );
        case "tuple": {
          const tupleData: Record<string, ClarityValue> = {};
          for (const [key, val] of Object.entries(
            typedArg.value as Record<string, unknown>
          )) {
            tupleData[key] = parseArgToClarityValue(val);
          }
          return tupleCV(tupleData);
        }
        default:
          throw new Error(`Unknown type: ${typedArg.type}`);
      }
    }

    // Treat as tuple
    const tupleData: Record<string, ClarityValue> = {};
    for (const [key, val] of Object.entries(obj)) {
      tupleData[key] = parseArgToClarityValue(val);
    }
    return tupleCV(tupleData);
  }

  throw new Error(
    `Cannot convert argument to ClarityValue: ${JSON.stringify(arg)}`
  );
}
