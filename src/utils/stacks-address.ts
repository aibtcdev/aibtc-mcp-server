import { z } from "zod";

/**
 * Stacks standard principal: "S" + c32 version char + c32 hash/checksum.
 * Version chars per @stacks/network AddressVersion, mapped through the c32 alphabet
 * (0123456789ABCDEFGHJKMNPQRSTVWXYZ):
 *   22 MainnetSingleSig -> P, 20 MainnetMultiSig -> M,
 *   26 TestnetSingleSig -> T, 21 TestnetMultiSig -> N.
 * This is a shape check only (no checksum), which is all a URL path needs.
 */
const STANDARD = "S[PMTN][0-9A-HJKMNP-TV-Z]{38,40}";

/**
 * Contract name suffix. Narrower than @stacks/transactions isClarityName, which also
 * allows characters like "/", "?", "<" and "*": deployed contract names are letters,
 * digits, "-" and "_", starting with a letter, under 128 chars (MAX_STRING_LENGTH_BYTES).
 * Keeping to that set means the principal is always a single URL path segment.
 */
const CONTRACT_NAME = "[a-zA-Z][a-zA-Z0-9_-]{0,127}";

export const STACKS_ADDRESS_RE = new RegExp(`^${STANDARD}$`);
export const STACKS_PRINCIPAL_RE = new RegExp(`^${STANDARD}(?:\\.${CONTRACT_NAME})?$`);

const ADDRESS_HINT = "SP…/SM… mainnet, ST…/SN… testnet";

/** A standard Stacks address (single-sig or multisig, mainnet or testnet). */
export const stacksAddressSchema = z
  .string()
  .regex(STACKS_ADDRESS_RE, `Expected a Stacks address (${ADDRESS_HINT})`);

/** A standard address or a contract principal (`<address>.<contract-name>`). */
export const stacksPrincipalSchema = z
  .string()
  .regex(
    STACKS_PRINCIPAL_RE,
    `Expected a Stacks address (${ADDRESS_HINT}) or contract principal (<address>.<contract-name>)`
  );

/**
 * Encode a principal for use as ONE URL path segment. Validates again so a caller
 * that skips the input schema still cannot reach another route ("..", "/", "?", "#").
 */
export function principalPathSegment(principal: string): string {
  if (!STACKS_PRINCIPAL_RE.test(principal)) {
    throw new Error(`Invalid Stacks principal: ${JSON.stringify(principal.slice(0, 80))}`);
  }
  return encodeURIComponent(principal);
}
