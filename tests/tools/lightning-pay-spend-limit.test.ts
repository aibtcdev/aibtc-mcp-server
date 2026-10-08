import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A real BOLT-11 invoice for 2500 sats (2,500,000 msat) on mainnet. Decoded by
// light-bolt11-decoder to exercise the amount-extraction path the way the tool
// does at runtime.
const INVOICE_2500_SATS =
  "lnbc25u1p3xnhl2pp5jptserfk3zk4qy42tlucycrq7m7flkm6ex4nx4jhxxq6h8u0m0qsdqqcqzpgxqyz5vqsp5v3xnhl2pp5jptserfk3zk4qy42tlucycrq7m7flkm6ex4nx4jhx9qyyssqy";

// Amountless invoice (no amount section) — must be refused.
const INVOICE_AMOUNTLESS =
  "lnbc1p3xnhl2pp5jptserfk3zk4qy42tlucycrq7m7flkm6ex4nx4jhxxq6h8u0m0qsdqqcqzpgxqyz5vqsp5v3xnhl2pp5jptserfk3zk4qy42tlucycrq7m7flkm6ex4nx4jhx9qyyssqy";

// Mock the BOLT-11 decoder so the test does not depend on a specific real
// invoice checksum; we only care that the tool reads the amount section,
// refuses amountless, and meters correctly.
const mockDecode = vi.fn();
vi.mock("light-bolt11-decoder", () => ({
  decode: (b: string) => mockDecode(b),
}));

const mockPayInvoice = vi.fn();
let providerLocked = false;
vi.mock("../../src/services/lightning-manager.js", () => ({
  getLightningManager: () => ({
    getProvider: () => (providerLocked ? null : { payInvoice: mockPayInvoice }),
  }),
}));

let activeAddress: string | null = "SP000000000000000000002Q6VF78";
vi.mock("../../src/services/wallet-manager.js", () => ({
  getWalletManager: () => ({
    getActiveAccount: () =>
      activeAddress ? { address: activeAddress } : undefined,
  }),
}));

const mockReserve = vi.fn();
const mockRelease = vi.fn();
vi.mock("../../src/services/spend-limiter.js", () => ({
  getSpendLimiter: () => ({ reserve: mockReserve, release: mockRelease }),
}));

vi.mock("../../src/config/networks.js", () => ({ NETWORK: "mainnet" }));

const { registerLightningTools } = await import(
  "../../src/tools/lightning.tools.js"
);

interface RegisteredTool {
  handler: (args: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

function createTrackingServer() {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    registerTool: vi.fn(
      (name: string, _config: unknown, handler: RegisteredTool["handler"]) => {
        tools.set(name, { handler });
      }
    ),
  };
  return { server, tools };
}

function amountSections(msat: string) {
  return { sections: [{ name: "amount", letters: `${msat}m`, value: msat }] };
}

describe("lightning_pay_invoice spending limit (#572)", () => {
  let payTool: RegisteredTool;

  beforeEach(() => {
    vi.clearAllMocks();
    providerLocked = false;
    activeAddress = "SP000000000000000000002Q6VF78";
    mockPayInvoice.mockResolvedValue({ preimage: "0xdead", feesPaid: 1 });
    const { server, tools } = createTrackingServer();
    registerLightningTools(server as never);
    payTool = tools.get("lightning_pay_invoice")!;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Success responses are JSON; createErrorResponse returns a plain "Error: ..."
  // string with isError:true. Normalize both to an object with a `message`.
  function parse(res: {
    content: Array<{ text: string }>;
    isError?: boolean;
  }) {
    const text = res.content[0].text;
    if (res.isError) return { error: text, message: text };
    return JSON.parse(text);
  }

  it("books the invoice amount on the sats ledger BEFORE paying, and keeps it", async () => {
    mockDecode.mockReturnValue(amountSections("2500000")); // 2500 sats
    const res = await payTool.handler({ bolt11: INVOICE_2500_SATS });
    const body = parse(res);

    expect(body.success).toBe(true);
    expect(body.amountSats).toBe(2500);
    // reserve() ran with the decoded amount and the active Stacks address.
    expect(mockReserve).toHaveBeenCalledWith(
      [{ unit: "sats", amount: 2500n }],
      "SP000000000000000000002Q6VF78"
    );
    // It ran before payInvoice, and the paid spend is not given back.
    expect(mockReserve.mock.invocationCallOrder[0]).toBeLessThan(
      mockPayInvoice.mock.invocationCallOrder[0]
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("keeps the booking when the payment throws", async () => {
    // A failed payInvoice does not prove the payment did not route: Spark can
    // settle it and still report no preimage.
    mockDecode.mockReturnValue(amountSections("2500000"));
    mockPayInvoice.mockRejectedValueOnce(new Error("did not return a preimage"));

    const res = await payTool.handler({ bolt11: INVOICE_2500_SATS });
    expect(res.isError).toBe(true);
    expect(mockReserve).toHaveBeenCalledOnce();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("blocks an over-budget pay and never calls payInvoice", async () => {
    mockDecode.mockReturnValue(amountSections("2500000"));
    mockReserve.mockRejectedValueOnce(
      new Error("Spending limit reached: over cap")
    );

    const res = await payTool.handler({ bolt11: INVOICE_2500_SATS });
    const body = parse(res);

    expect(body.error ?? body.message ?? "").toMatch(/Spending limit reached/);
    expect(mockPayInvoice).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("refuses an amountless invoice before touching the limiter or provider", async () => {
    mockDecode.mockReturnValue({ sections: [{ name: "payment_hash", value: "x" }] });

    const res = await payTool.handler({ bolt11: INVOICE_AMOUNTLESS });
    const body = parse(res);

    expect(body.error ?? body.message ?? "").toMatch(/amountless/i);
    expect(mockReserve).not.toHaveBeenCalled();
    expect(mockPayInvoice).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("falls back to the __lightning__ ledger key when the STX wallet is locked", async () => {
    activeAddress = null; // main wallet locked
    mockDecode.mockReturnValue(amountSections("1000000")); // 1000 sats

    const res = await payTool.handler({ bolt11: INVOICE_2500_SATS });
    const body = parse(res);

    expect(body.success).toBe(true);
    expect(mockReserve).toHaveBeenCalledWith([{ unit: "sats", amount: 1000n }], "__lightning__");
  });

  it("errors clearly when the Lightning wallet is locked", async () => {
    providerLocked = true;
    const res = await payTool.handler({ bolt11: INVOICE_2500_SATS });
    const body = parse(res);

    expect(body.error ?? body.message ?? "").toMatch(/locked/i);
    expect(mockDecode).not.toHaveBeenCalled();
    expect(mockReserve).not.toHaveBeenCalled();
  });
});
