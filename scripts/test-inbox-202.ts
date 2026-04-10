#!/usr/bin/env npx tsx
/**
 * Send a real inbox message using local build to verify 202 fix.
 * Usage: npx tsx scripts/test-inbox-202.ts [password]
 */

import { getWalletManager } from "../dist/services/wallet-manager.js";
import { getAccount, NETWORK } from "../dist/services/x402.service.js";
import { getSbtcService } from "../dist/services/sbtc.service.js";
import { getHiroApi } from "../dist/services/hiro-api.js";
import { getContracts, parseContractId } from "../dist/config/contracts.js";
import { getStacksNetwork, getExplorerTxUrl } from "../dist/config/networks.js";
import { createFungiblePostCondition } from "../dist/transactions/post-conditions.js";
import {
  decodePaymentRequired,
  decodePaymentResponse,
  encodePaymentPayload,
  generatePaymentId,
  buildPaymentIdentifierExtension,
  X402_HEADERS,
} from "../dist/utils/x402-protocol.js";
import {
  makeContractCall,
  uintCV,
  principalCV,
  noneCV,
} from "@stacks/transactions";

const INBOX_BASE = "https://aibtc.com/api/inbox";
const TO_BTC = "bc1qktaz6rg5k4smre0wfde2tjs2eupvggpmdz39ku";
const TO_STX = "SP1KGHF33817ZXW27CG50JXWC0Y6BNXAQ4E7YGAHM";
const PASSWORD = process.argv[2] || "password123";

async function main() {
  // 1. Unlock wallet
  const wm = getWalletManager();
  const wallets = await wm.listWallets();
  if (!wallets.length) throw new Error("No wallets");
  const secretMars = wallets.find((w: any) => w.id === "7e638a90-22be-4db1-96dc-907f28d61e0b");
  if (!secretMars) throw new Error("Secret Mars wallet not found");
  await wm.unlock(secretMars.id, PASSWORD);
  const account = await getAccount();
  console.log(`Wallet: ${account.address}`);

  // 2. Balance check
  const bal = await getSbtcService(NETWORK).getBalance(account.address);
  console.log(`sBTC: ${bal.balance} sats`);
  if (BigInt(bal.balance) < 100n) throw new Error("Not enough sBTC");

  // 3. Get 402 challenge
  const url = `${INBOX_BASE}/${TO_BTC}`;
  const msg = {
    toBtcAddress: TO_BTC,
    toStxAddress: TO_STX,
    content: `202 fix test ${new Date().toISOString()}`,
  };
  const r1 = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (r1.status !== 402) throw new Error(`Expected 402, got ${r1.status}: ${await r1.text()}`);
  const pr = decodePaymentRequired(r1.headers.get(X402_HEADERS.PAYMENT_REQUIRED))!;
  const accept = pr.accepts[0];
  console.log(`402 → ${accept.amount} sats to ${accept.payTo}`);

  // 4. Build sponsored sBTC transfer
  const info = await getHiroApi(NETWORK).getAccountInfo(account.address);
  const nonce = BigInt(info.nonce);
  const contracts = getContracts(NETWORK);
  const { address: ca, name: cn } = parseContractId(contracts.SBTC_TOKEN);
  const tx = await makeContractCall({
    contractAddress: ca,
    contractName: cn,
    functionName: "transfer",
    functionArgs: [
      uintCV(BigInt(accept.amount)),
      principalCV(account.address),
      principalCV(accept.payTo),
      noneCV(),
    ],
    senderKey: account.privateKey,
    network: getStacksNetwork(NETWORK),
    postConditions: [
      createFungiblePostCondition(account.address, contracts.SBTC_TOKEN, "sbtc-token", "eq", BigInt(accept.amount)),
    ],
    sponsored: true,
    fee: 0n,
    nonce,
  });
  const txHex = "0x" + tx.serialize();
  console.log(`TX built (nonce=${nonce})`);

  // 5. Encode payment
  const paymentId = generatePaymentId();
  const sig = encodePaymentPayload({
    x402Version: 2,
    resource: pr.resource,
    accepted: accept,
    payload: { transaction: txHex },
    extensions: buildPaymentIdentifierExtension(paymentId),
  });

  // 6. Submit with payment
  const r2 = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [X402_HEADERS.PAYMENT_SIGNATURE]: sig,
    },
    body: JSON.stringify(msg),
  });

  const body = await r2.text();
  console.log(`\nResponse: ${r2.status}`);

  // THE FIX: 202 is success
  if (r2.status === 200 || r2.status === 201 || r2.status === 202) {
    console.log(`✓ ${r2.status === 202 ? "STAGED (202) — fix works!" : "DELIVERED (" + r2.status + ")"}`);
    try { console.log(JSON.stringify(JSON.parse(body), null, 2)); } catch { console.log(body); }
  } else {
    console.log(`✗ FAILED`);
    console.log(body);
  }
}

main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
