/**
 * cvToJSON tuple helpers for dual-stacking status.
 *
 * Wire shape: { type: "(tuple ...)", value: { KEY: { type, value } } }
 * Clarity keys are often UPPER_SNAKE or kebab (MIN_APR, cycle-id), not camelCase.
 * Fallback keys (min-apr, minApr) are defensive only — Hiro currently returns MIN_APR first.
 */

export type TupleFieldMap = Record<string, { value?: string | number }>;

export function tupleFields(raw: unknown): TupleFieldMap | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { value?: unknown; type?: string };
  if (obj.value && typeof obj.value === "object" && !Array.isArray(obj.value)) {
    return obj.value as TupleFieldMap;
  }
  // Already unwrapped map of fields
  return obj as TupleFieldMap;
}

export function fieldValue(
  fields: TupleFieldMap | null,
  ...keys: string[]
): number | undefined {
  if (!fields) return undefined;
  for (const k of keys) {
    const v = fields[k]?.value;
    if (v !== undefined && v !== null) return Number(v);
  }
  return undefined;
}
