import { describe, it, expect } from "vitest";
import { deserializeCV, cvToJSON } from "@stacks/transactions";

/** Mirror of dual-stacking.tools.ts tupleFields / fieldValue for #611 */
function tupleFields(raw: unknown): Record<string, { value?: string | number }> | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { value?: unknown };
  if (obj.value && typeof obj.value === "object" && !Array.isArray(obj.value)) {
    return obj.value as Record<string, { value?: string | number }>;
  }
  return obj as Record<string, { value?: string | number }>;
}
function fieldValue(
  fields: Record<string, { value?: string | number }> | null,
  ...keys: string[]
): number | undefined {
  if (!fields) return undefined;
  for (const k of keys) {
    const v = fields[k]?.value;
    if (v !== undefined && v !== null) return Number(v);
  }
  return undefined;
}

const APR_HEX =
  "0c00000003074d41585f41505201000000000000000000000000004c4b40074d494e5f415052010000000000000000000000000007a1200a4d554c5449504c494552010000000000000000000000000000000a";
const OVERVIEW_HEX =
  "0c00000003086379636c652d696401000000000000000000000000000000070e736e617073686f742d696e646578010000000000000000000000000000000d13736e617073686f74732d7065722d6379636c65010000000000000000000000000000000e";

describe("dual stacking tuple decode (#611)", () => {
  it("decodes get-apr-data MIN_APR/MAX_APR from cvToJSON", () => {
    const json = cvToJSON(deserializeCV(Buffer.from(APR_HEX, "hex")));
    // Bug: looking at top-level min-apr yields undefined/0
    expect((json as any)["min-apr"]).toBeUndefined();
    const fields = tupleFields(json);
    expect(fieldValue(fields, "MIN_APR")! / 1_000_000).toBe(0.5);
    expect(fieldValue(fields, "MAX_APR")! / 1_000_000).toBe(5);
    expect(fieldValue(fields, "MULTIPLIER")).toBe(10);
  });

  it("decodes current-overview-data cycle-id fields", () => {
    const json = cvToJSON(deserializeCV(Buffer.from(OVERVIEW_HEX, "hex")));
    const fields = tupleFields(json);
    expect(fieldValue(fields, "cycle-id")).toBe(7);
    expect(fieldValue(fields, "snapshot-index")).toBe(13);
    expect(fieldValue(fields, "snapshots-per-cycle")).toBe(14);
  });
});
