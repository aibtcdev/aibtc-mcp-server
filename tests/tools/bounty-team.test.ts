import { describe, expect, it } from "vitest";
import {
  buildBountySubmit,
  buildTeamConfirmMessage,
  buildTeamRemoveMessage,
  teammatesSchema,
} from "../../src/tools/bounty-scanner.tools.js";

// The server rebuilds these strings byte for byte; a one-character mismatch
// fails every signature. Expected values are copied from
// https://aibtc.com/docs/bounties.txt ("Signed-message formats").
const T = "2026-11-19T10:00:00.000Z";
const LEAD = "bc1qlead000000000000000000000000000000000";
const M1 = "bc1qmember1000000000000000000000000000000";
const M2 = "bc1qmember2000000000000000000000000000000";
const URL = "https://github.com/org/repo/pull/1";

describe("buildBountySubmit", () => {
  it("signs the 6-field message for a solo submit", () => {
    expect(
      buildBountySubmit({ bountyId: "B1", submitterBtc: LEAD, message: "done", contentUrl: URL, signedAt: T })
    ).toEqual({
      message: `AIBTC Bounty Submit | B1 | ${LEAD} | done | ${URL} | ${T}`,
      body: { submitterBtcAddress: LEAD, message: "done", contentUrl: URL, signedAt: T },
    });
  });

  it("signs an empty contentUrl when omitted", () => {
    const { message, body } = buildBountySubmit({ bountyId: "B1", submitterBtc: LEAD, message: "done", signedAt: T });
    expect(message).toBe(`AIBTC Bounty Submit | B1 | ${LEAD} | done |  | ${T}`);
    expect(body).not.toHaveProperty("contentUrl");
  });

  it("signs and sends the message trimmed, as the server verifies it", () => {
    const { message, body } = buildBountySubmit({
      bountyId: "B1", submitterBtc: LEAD, message: "  done \n", signedAt: T,
    });
    expect(message).toBe(`AIBTC Bounty Submit | B1 | ${LEAD} | done |  | ${T}`);
    expect(body.message).toBe("done");
  });

  it("treats an empty teammates list as solo", () => {
    const { message, body } = buildBountySubmit({
      bountyId: "B1", submitterBtc: LEAD, message: "done", signedAt: T, teammates: [],
    });
    expect(message).toBe(`AIBTC Bounty Submit | B1 | ${LEAD} | done |  | ${T}`);
    expect(body).not.toHaveProperty("teammates");
  });

  it("appends teammates comma-joined in the order sent for a team submit", () => {
    expect(
      buildBountySubmit({
        bountyId: "B1", submitterBtc: LEAD, message: "done", contentUrl: URL, signedAt: T, teammates: [M2, M1],
      })
    ).toEqual({
      message: `AIBTC Bounty Submit | B1 | ${LEAD} | done | ${URL} | ${T} | ${M2},${M1}`,
      body: { submitterBtcAddress: LEAD, message: "done", contentUrl: URL, signedAt: T, teammates: [M2, M1] },
    });
  });
});

describe("team confirm / remove messages", () => {
  it("builds the confirm message", () => {
    expect(buildTeamConfirmMessage("B1", "S1", M1, T)).toBe(
      `AIBTC Bounty Team Confirm | B1 | S1 | ${M1} | ${T}`
    );
  });

  it("builds the remove message", () => {
    expect(buildTeamRemoveMessage("B1", "S1", M2, T)).toBe(
      `AIBTC Bounty Team Remove | B1 | S1 | ${M2} | ${T}`
    );
  });
});

describe("teammatesSchema", () => {
  const M3 = "bc1qmember3000000000000000000000000000000";
  const M4 = "bc1qmember4000000000000000000000000000000";

  it("accepts up to 4 addresses and trims them", () => {
    expect(teammatesSchema.parse([` ${M1} `, M2, M3, M4])).toEqual([M1, M2, M3, M4]);
  });

  it("rejects more than 4", () => {
    expect(teammatesSchema.safeParse([M1, M2, M3, M4, LEAD]).success).toBe(false);
  });

  it("rejects the same teammate twice, including after trimming", () => {
    expect(teammatesSchema.safeParse([M1, ` ${M1}`]).success).toBe(false);
  });

  it("rejects separators that would change the signed message", () => {
    expect(teammatesSchema.safeParse([`${M1},${M2}`]).success).toBe(false);
    expect(teammatesSchema.safeParse([`${M1}|x`]).success).toBe(false);
    expect(teammatesSchema.safeParse([""]).success).toBe(false);
  });
});
