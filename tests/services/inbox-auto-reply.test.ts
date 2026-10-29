import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import os from "os";
import path from "path";
import { mkdtempSync, rmSync } from "fs";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { p2wpkh, NETWORK as BTC_MAINNET } from "@scure/btc-signer";

const mockPostWithX402Payment = vi.fn();

vi.mock("../../src/services/x402-post.js", () => ({
  postWithX402Payment: (...args: unknown[]) => mockPostWithX402Payment(...args),
  paymentWasSent: (error: unknown) =>
    Boolean((error as { config?: { headers?: Record<string, unknown> } })?.config?.headers?.["payment-signature"]),
}));

const {
  cleanReply,
  marketplaceReplyGenerator,
  PaidInferenceError,
  resolveDailyCapSats,
  runAutoReply,
  setAutoReplyLedgerFile,
  skipReason,
  signReply,
  replySigningMessage,
  readAddressLedger,
  MAX_REPLY_CHARS,
  DEFAULT_DAILY_CAP_SATS,
} = await import("../../src/services/inbox-auto-reply.service.js");
type ReplyGenerator = import("../../src/services/inbox-auto-reply.service.js").ReplyGenerator;
type InboxMessage = import("../../src/services/inbox-auto-reply.service.js").InboxMessage;

const BTC = "bc1qzh2z92dlvccxq5w756qppzz8fymhgrt2dv8cf5";
const STX = "SP219TWC8G12CSX5AB093127NC82KYQWEH8ADD1AY";
const privateKey = new Uint8Array(32).fill(7);
const account = {
  address: STX,
  btcAddress: BTC,
  privateKey: "0".repeat(64),
  btcPrivateKey: privateKey,
  btcPublicKey: secp256k1.getPublicKey(privateKey, true),
} as never;

function msg(id: string, overrides: Partial<InboxMessage> = {}): InboxMessage {
  return {
    messageId: id,
    fromAddress: "SP1DN6DYY59HCW3CZHNN9GCRS07EBZVJ2EV72DBCD",
    toBtcAddress: BTC,
    content: `question ${id}`,
    paymentTxid: "ab".repeat(32),
    paymentSatoshis: 100,
    paymentStatus: "confirmed",
    sentAt: "2026-10-20T00:00:00.000Z",
    direction: "received",
    peerBtcAddress: "bc1q44m7v06r9y32mks247hlufmnm50vuemwn0y57c",
    peerDisplayName: "Light Leopard",
    ...overrides,
  };
}

/** Stub fetch: GET inbox returns `messages` (newest first); POST outbox answers with `outbox`. */
function stubFetch(messages: InboxMessage[], outbox: () => Response = () => new Response(JSON.stringify({ reply: { repliedAt: "2026-10-27T00:00:00.000Z" } }), { status: 201 })) {
  const posts: Array<{ url: string; body: Record<string, string> }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/inbox/")) {
        return new Response(JSON.stringify({ inbox: { messages } }), { status: 200 });
      }
      if (url.includes("/api/outbox/")) {
        posts.push({ url, body: JSON.parse(String(init?.body)) });
        return outbox();
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );
  return posts;
}

/** A generator that charges `price` sats through beforePay, like the marketplace does. */
function fakeGenerator(price = 1): ReplyGenerator & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async generate({ message, beforePay }) {
      await beforePay(price);
      calls.push(message.messageId);
      return { text: `answer to ${message.messageId}`, inferenceCostSats: price, txid: `tx-${message.messageId}` };
    },
  };
}

const base = { account, systemPrompt: "You are a test agent.", dailyCapSats: 1000, maxRepliesPerRun: 5, dryRun: false };

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "auto-reply-"));
  setAutoReplyLedgerFile(path.join(dir, "inbox-auto-reply.json"));
  mockPostWithX402Payment.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

describe("skipReason", () => {
  const self = { btcAddress: BTC, stxAddress: STX };
  const empty = { handled: {}, pending: {}, spentSats: {} };

  it("accepts a paid, confirmed, unanswered message", () => {
    expect(skipReason(msg("a"), self, empty)).toBeNull();
  });

  it("accepts a message recovered from a confirmed txid", () => {
    expect(skipReason(msg("a", { paymentStatus: undefined, recoveredViaTxid: true }), self, empty)).toBeNull();
  });

  it("accepts a message from before paymentStatus existed", () => {
    expect(skipReason(msg("a", { paymentStatus: undefined }), self, empty)).toBeNull();
  });

  it("skips answered, handled, unpaid, unsettled and self-sent messages", () => {
    expect(skipReason(msg("a", { repliedAt: "x" }), self, empty)).toBe("already_replied");
    expect(skipReason(msg("a"), self, { ...empty, handled: { a: "x" } })).toBe("already_handled");
    expect(skipReason(msg("a", { paymentTxid: undefined }), self, empty)).toBe("unpaid");
    expect(skipReason(msg("a", { paymentSatoshis: 0 }), self, empty)).toBe("unpaid");
    expect(skipReason(msg("a", { paymentStatus: "pending" }), self, empty)).toBe("payment_not_settled");
    expect(skipReason(msg("a", { paymentStatus: "pending", paymentTxid: undefined }), self, empty)).toBe(
      "payment_not_settled"
    );
    expect(skipReason(msg("a", { fromAddress: STX }), self, empty)).toBe("from_self");
  });
});

describe("resolveDailyCapSats", () => {
  it("keeps a valid stored cap, including 0", () => {
    expect(resolveDailyCapSats(250)).toBe(250);
    expect(resolveDailyCapSats(0)).toBe(0);
  });

  it("falls back to the default for a missing or malformed stored cap", () => {
    for (const value of [undefined, null, "500", -1, 1.5, Number.NaN]) {
      expect(resolveDailyCapSats(value)).toBe(DEFAULT_DAILY_CAP_SATS);
    }
  });
});

describe("cleanReply", () => {
  it("drops reasoning blocks and collapses whitespace", () => {
    expect(cleanReply("<think>plan</think>\n Hello   there \n")).toBe("Hello there");
  });

  it("fits the outbox limit", () => {
    expect(cleanReply("x".repeat(900)).length).toBe(MAX_REPLY_CHARS);
  });
});

describe("runAutoReply", () => {
  it("answers eligible messages oldest first, signs the outbox post and records them", async () => {
    const posts = stubFetch([msg("new"), msg("done", { repliedAt: "2026-10-21" }), msg("old")]);
    const generator = fakeGenerator();

    const summary = await runAutoReply({ ...base, generator });

    expect(generator.calls).toEqual(["old", "new"]);
    expect(summary.replied.map((r) => r.messageId)).toEqual(["old", "new"]);
    expect(summary.skipped).toEqual([{ messageId: "done", reason: "already_replied" }]);
    expect(summary.inferenceSatsSpent).toBe(2);
    expect(summary.inferenceCapRemainingSats).toBe(998);
    expect(posts[0].url).toBe(`https://aibtc.com/api/outbox/${BTC}`);
    expect(posts[0].body.messageId).toBe("old");
    expect(posts[0].body.reply).toBe("answer to old");
    expect(posts[0].body.signature.length).toBeGreaterThan(100);

    // A second run must not answer them again, even before the inbox shows repliedAt.
    const again = await runAutoReply({ ...base, generator });
    expect(again.replied).toEqual([]);
    expect(again.skipped.filter((s) => s.reason === "already_handled")).toHaveLength(2);
  });

  it("stops at the daily cap without paying past it", async () => {
    stubFetch([msg("c"), msg("b"), msg("a")]);
    const generator = fakeGenerator(1);

    const summary = await runAutoReply({ ...base, dailyCapSats: 2, generator });

    expect(generator.calls).toEqual(["a", "b"]);
    expect(summary.stoppedEarly).toBe("daily_cap");
    expect(summary.skipped).toContainEqual({ messageId: "c", reason: "daily_cap" });
    expect(summary.inferenceSatsSpentToday).toBe(2);
    expect(summary.inferenceCapRemainingSats).toBe(0);
  });

  it("honours maxRepliesPerRun", async () => {
    stubFetch([msg("c"), msg("b"), msg("a")]);
    const summary = await runAutoReply({ ...base, maxRepliesPerRun: 1, generator: fakeGenerator() });
    expect(summary.replied.map((r) => r.messageId)).toEqual(["a"]);
    expect(summary.skipped.filter((s) => s.reason === "run_limit")).toHaveLength(2);
  });

  it("dry run drafts replies without posting or marking them handled", async () => {
    const posts = stubFetch([msg("a")]);
    const summary = await runAutoReply({ ...base, dryRun: true, generator: fakeGenerator() });

    expect(posts).toHaveLength(0);
    expect(summary.drafted.map((d) => d.messageId)).toEqual(["a"]);
    expect((await readAddressLedger(BTC)).handled).toEqual({});
  });

  it("keeps a paid reply whose post failed and posts it next run without paying again", async () => {
    let fail = true;
    stubFetch([msg("a")], () =>
      fail ? new Response("boom", { status: 500 }) : new Response("{}", { status: 201 })
    );
    const generator = fakeGenerator();

    const first = await runAutoReply({ ...base, generator });
    expect(first.failed).toEqual([{ messageId: "a", error: "Outbox reply failed (500): boom", replySaved: true }]);

    fail = false;
    const second = await runAutoReply({ ...base, generator });
    expect(generator.calls).toEqual(["a"]);
    expect(second.replied).toEqual([expect.objectContaining({ messageId: "a", inferenceCostSats: 0, reusedPending: true })]);
    expect((await readAddressLedger(BTC)).pending).toEqual({});
  });

  it("treats an outbox 409 as already answered", async () => {
    stubFetch([msg("a")], () => new Response("exists", { status: 409 }));
    const summary = await runAutoReply({ ...base, generator: fakeGenerator() });
    expect(summary.skipped).toEqual([{ messageId: "a", reason: "already_replied" }]);
    expect((await readAddressLedger(BTC)).handled.a).toBe("already_replied");
  });

  it("gives back the cap booking when inference fails before the payment was sent", async () => {
    stubFetch([msg("a")]);
    const generator: ReplyGenerator = {
      async generate({ beforePay }) {
        await beforePay(1);
        throw new Error("provider down");
      },
    };
    const summary = await runAutoReply({ ...base, generator });
    expect(summary.failed).toEqual([{ messageId: "a", error: "provider down", replySaved: false }]);
    expect(summary.inferenceSatsSpentToday).toBe(0);
  });

  it("keeps the cap booking when a paid inference returns an unusable reply", async () => {
    stubFetch([msg("a")]);
    const generator: ReplyGenerator = {
      async generate({ beforePay }) {
        await beforePay(1);
        throw new PaidInferenceError("Model returned an empty reply");
      },
    };
    const summary = await runAutoReply({ ...base, generator });
    expect(summary.failed).toEqual([{ messageId: "a", error: "Model returned an empty reply", replySaved: false }]);
    expect(summary.inferenceSatsSpentToday).toBe(1);
  });

  it("refuses a wallet without a bc1q address", async () => {
    await expect(
      runAutoReply({ ...base, account: { ...(account as object), btcAddress: "bc1pxyz" } as never, generator: fakeGenerator() })
    ).rejects.toThrow(/native SegWit/);
  });
});

describe("marketplaceReplyGenerator", () => {
  it("surfaces the gateway's error body and keeps the payment evidence on the cause", async () => {
    const httpError = Object.assign(new Error("Request failed with status code 503"), {
      response: { status: 503, data: { error: "Provider unavailable" } },
      config: { headers: { "payment-signature": "signed" } },
    });
    mockPostWithX402Payment.mockRejectedValueOnce(httpError);

    const failure = await marketplaceReplyGenerator("m")
      .generate({ systemPrompt: "s", message: msg("a"), beforePay: async () => {} })
      .catch((e: Error) => e);

    expect((failure as Error).message).toBe('Inference request failed (503): {"error":"Provider unavailable"}');
    expect((failure as Error).cause).toBe(httpError);
  });

  it("a paid response without a usable reply fails as a paid inference", async () => {
    for (const data of [null, "not json", { choices: [] }, { choices: [{ message: { content: "  " } }] }]) {
      mockPostWithX402Payment.mockResolvedValueOnce({ paid: true, response: { data }, accept: { amount: "1" }, sponsored: true });
      const failure = await marketplaceReplyGenerator("m")
        .generate({ systemPrompt: "s", message: msg("a"), beforePay: async () => {} })
        .catch((e: Error) => e);
      expect(failure).toBeInstanceOf(PaidInferenceError);
    }
  });

  it("sends the system prompt and the message to the gateway and reports the x402 cost", async () => {
    mockPostWithX402Payment.mockImplementation(async (opts: { beforePay: (a: unknown) => Promise<void> }) => {
      await opts.beforePay({ amount: "1", extra: { pricing: { provider: "node-1" } } });
      return {
        paid: true,
        response: { data: { choices: [{ message: { content: "<think>x</think>Sure, happy to help." } }] } },
        accept: { amount: "1", extra: { pricing: { provider: "node-1" } } },
        sponsored: true,
        txid: "0xabc",
      };
    });
    const beforePay = vi.fn(async () => {});

    const reply = await marketplaceReplyGenerator("meta-llama/Llama-3.1-8B-Instruct").generate({
      systemPrompt: "You are K9.",
      message: msg("a", { content: "Can you audit my contract?" }),
      beforePay,
    });

    expect(reply).toEqual({ text: "Sure, happy to help.", inferenceCostSats: 1, txid: "0xabc", provider: "node-1" });
    expect(beforePay).toHaveBeenCalledWith(1);
    const call = mockPostWithX402Payment.mock.calls[0][0] as { url: string; body: { model: string; messages: Array<{ role: string; content: string }> } };
    expect(call.url).toBe("https://inference.aibtc.com/v1/chat/completions");
    expect(call.body.model).toBe("meta-llama/Llama-3.1-8B-Instruct");
    expect(call.body.messages[0]).toEqual({ role: "system", content: "You are K9." });
    expect(call.body.messages[1].content).toContain("Can you audit my contract?");
    expect(call.body.messages[1].content).toContain("Light Leopard");
  });
});

describe("signReply", () => {
  it("produces a BIP-322 signature btc_verify_message accepts for the wallet's bc1q address", async () => {
    const { registerSigningTools } = await import("../../src/tools/signing.tools.js");
    const handlers: Record<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>> = {};
    registerSigningTools({
      registerTool: (name: string, _c: unknown, h: (typeof handlers)[string]) => {
        handlers[name] = h;
      },
    } as never);

    const address = p2wpkh(secp256k1.getPublicKey(privateKey, true), BTC_MAINNET).address!;
    const signature = signReply(account, "msg_1", "Thanks, will do.");
    const result = await handlers.btc_verify_message({
      message: replySigningMessage("msg_1", "Thanks, will do."),
      signature,
      address,
    });
    const body = JSON.parse(result.content[0].text);
    expect(body.signatureValid).toBe(true);
  });
});
