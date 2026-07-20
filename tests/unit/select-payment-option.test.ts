import { describe, it, expect } from "vitest";
import { detectTokenType, formatPaymentAmount, selectPaymentOption } from "../../src/services/x402.service.js";

const arcAccepts = [
  {
    network: "stacks:1",
    asset: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx",
    amount: "29000000",
    payTo: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
  },
  {
    network: "stacks:1",
    asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
    amount: "45385",
    payTo: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
  },
  {
    network: "stacks:1",
    asset: "stx",
    amount: "159911365",
    payTo: "SP2GHQRCRMYY4S8PMBR49BEKX144VR437YT42SF3B",
  },
];

describe("selectPaymentOption (#613)", () => {
  it("selects sBTC when asset=sBTC", () => {
    const opt = selectPaymentOption(arcAccepts, "sBTC");
    expect(opt?.asset).toBe("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token");
  });

  it("selects USDCx when asset=USDCx", () => {
    const opt = selectPaymentOption(arcAccepts, "USDCx");
    expect(opt?.asset).toContain("usdcx");
  });

  it("defaults to sBTC when available and asset omitted", () => {
    const opt = selectPaymentOption(arcAccepts);
    expect(opt?.asset).toContain("sbtc-token");
  });
});

describe("formatPaymentAmount (#613 display)", () => {
  it("does not call USDCx amount STX", () => {
    const msg = formatPaymentAmount("29000000", "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx");
    expect(msg.toLowerCase()).not.toContain("stx");
    expect(msg).toContain("USDCx");
  });

  it("formats sBTC", () => {
    const msg = formatPaymentAmount("45385", "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token");
    expect(msg.toLowerCase()).toContain("sbtc");
  });
});

describe("detectTokenType", () => {
  it("detects usdcx", () => {
    expect(detectTokenType("SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx")).toBe("USDCx");
  });
});

describe("payment route selection helpers (#613 review)", () => {
  it("routes only native STX to STX token type", () => {
    expect(detectTokenType("stx")).toBe("STX");
    expect(detectTokenType("STX")).toBe("STX");
    expect(detectTokenType("native")).toBe("STX");
  });

  it("routes USDCx contract id to USDCx not STX", () => {
    expect(detectTokenType("SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx")).toBe("USDCx");
    expect(detectTokenType("SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx")).not.toBe("STX");
  });

  it("routes sBTC contract id to sBTC", () => {
    expect(detectTokenType("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token")).toBe("sBTC");
  });

  it("prefers explicit asset over default when both sBTC and USDCx present", () => {
    const accepts = [
      { network: "stacks:1", asset: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx" },
      { network: "stacks:1", asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token" },
      { network: "stacks:1", asset: "stx" },
    ];
    expect(selectPaymentOption(accepts, "USDCx")?.asset).toContain("usdcx");
    expect(selectPaymentOption(accepts, "sBTC")?.asset).toContain("sbtc-token");
    expect(selectPaymentOption(accepts, "STX")?.asset?.toLowerCase()).toBe("stx");
  });
});
