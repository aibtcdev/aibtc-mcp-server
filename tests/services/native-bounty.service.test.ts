import { describe, expect, it } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import {
  AIBTC_BOUNTY_BASE,
  buildNativeBountyMessage,
  buildNativeBountySignedFields,
  buildNativeBountyUrl,
  normalizeNativeBountyListParams,
} from "../../src/services/native-bounty.service.js";

describe("native bounty service", () => {
  it("builds native list URLs with supported filters", () => {
    const url = buildNativeBountyUrl("/api/bounties", {
      status: "paid",
      poster: "bc1poster",
      submitter: "bc1submitter",
      tag: "mcp",
      limit: 25,
      offset: 50,
    });

    expect(url.toString()).toBe(
      `${AIBTC_BOUNTY_BASE}/api/bounties?status=paid&poster=bc1poster&submitter=bc1submitter&tag=mcp&limit=25&offset=50`
    );
  });

  it("normalizes active list defaults without sending unsupported fields", () => {
    const params = normalizeNativeBountyListParams({ limit: 150, offset: -3 });

    expect(params).toEqual({ limit: "100", offset: "0" });
  });

  it("builds exact signed message formats for write actions", () => {
    expect(
      buildNativeBountyMessage("create", {
        posterBtc: "bc1poster",
        title: "Build native bounty tools",
        description: "Replace old bounty proxy tools",
        rewardSats: 1000,
        expiresAt: "2026-05-23T18:00:00.000Z",
        tags: ["mcp", "bounty"],
        signedAt: "2026-05-17T14:00:00.000Z",
      })
    ).toBe(
      "AIBTC Bounty Create | bc1poster | Build native bounty tools | Replace old bounty proxy tools | 1000 | 2026-05-23T18:00:00.000Z | mcp,bounty | 2026-05-17T14:00:00.000Z"
    );

    expect(
      buildNativeBountyMessage("submit", {
        bountyId: "bnty1",
        submitterBtc: "bc1submitter",
        message: "Implemented in PR #123",
        contentUrl: "https://github.com/aibtcdev/aibtc-mcp-server/pull/123",
        signedAt: "2026-05-17T14:00:00.000Z",
      })
    ).toBe(
      "AIBTC Bounty Submit | bnty1 | bc1submitter | Implemented in PR #123 | https://github.com/aibtcdev/aibtc-mcp-server/pull/123 | 2026-05-17T14:00:00.000Z"
    );

    expect(
      buildNativeBountyMessage("accept", {
        bountyId: "bnty1",
        submissionId: "sub1",
        signedAt: "2026-05-17T14:00:00.000Z",
      })
    ).toBe("AIBTC Bounty Accept | bnty1 | sub1 | 2026-05-17T14:00:00.000Z");

    expect(
      buildNativeBountyMessage("paid", {
        bountyId: "bnty1",
        txid: "0xabc",
        signedAt: "2026-05-17T14:00:00.000Z",
      })
    ).toBe("AIBTC Bounty Paid | bnty1 | 0xabc | 2026-05-17T14:00:00.000Z");

    expect(
      buildNativeBountyMessage("cancel", {
        bountyId: "bnty1",
        signedAt: "2026-05-17T14:00:00.000Z",
      })
    ).toBe("AIBTC Bounty Cancel | bnty1 | 2026-05-17T14:00:00.000Z");
  });

  it("creates signed payload fields without leaking private key material", () => {
    const privateKey = new Uint8Array(32).fill(1);
    const account = {
      btcAddress: "bc1poster",
      btcPrivateKey: privateKey,
      btcPublicKey: secp256k1.getPublicKey(privateKey, true),
    };
    const signed = buildNativeBountySignedFields(
      "AIBTC Bounty Cancel | bnty1 | 2026-05-17T14:00:00.000Z",
      "2026-05-17T14:00:00.000Z",
      account
    );

    expect(Object.keys(signed)).toEqual(["signedAt", "signature"]);
    expect(signed.signedAt).toBe("2026-05-17T14:00:00.000Z");
    expect(signed.signature.length).toBeGreaterThan(0);
    expect(JSON.stringify(signed)).not.toContain("private");
    expect(JSON.stringify(signed)).not.toContain("btcPrivateKey");
    expect(JSON.stringify(account)).toContain("btcPrivateKey");
  });
});
