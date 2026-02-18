/**
 * x402 Protocol Helpers
 * Native implementations of x402 protocol types and helpers.
 * No external x402 SDK dependency — all logic is self-contained.
 */

// ===== Types =====

/**
 * CAIP-2 Network identifier for Stacks
 */
export type NetworkV2 = `stacks:${string}`;

/**
 * Information about the protected resource
 */
export interface ResourceInfo {
  /** URL of the protected resource */
  url: string;
  /** Human-readable description of the resource */
  description?: string;
  /** MIME type of the expected response */
  mimeType?: string;
}

/**
 * Payment requirements for x402 v2 protocol
 */
export interface PaymentRequirementsV2 {
  /** Payment scheme identifier (e.g., "exact") */
  scheme: string;
  /** Network identifier in CAIP-2 format (e.g., "stacks:1") */
  network: NetworkV2;
  /** Required payment amount in atomic units (microSTX, satoshis, etc.) */
  amount: string;
  /** Asset identifier ("STX" or contract identifier like "SP...address.contract-name") */
  asset: string;
  /** Recipient address */
  payTo: string;
  /** Maximum time allowed for payment completion */
  maxTimeoutSeconds: number;
  /** Scheme-specific additional information */
  extra?: Record<string, unknown>;
}

/**
 * Payment required response for x402 v2 protocol
 */
export interface PaymentRequiredV2 {
  /** Protocol version (must be 2) */
  x402Version: 2;
  /** Human-readable error message */
  error?: string;
  /** Information about the protected resource */
  resource: ResourceInfo;
  /** Array of acceptable payment methods */
  accepts: PaymentRequirementsV2[];
  /** Protocol extensions data */
  extensions?: Record<string, unknown>;
}

/**
 * Stacks-specific payment payload (transaction data)
 */
export interface StacksPayloadV2 {
  /** Signed transaction hex */
  transaction: string;
}

/**
 * Payment payload for x402 v2 protocol
 */
export interface PaymentPayloadV2 {
  /** Protocol version (must be 2) */
  x402Version: 2;
  /** Information about the resource being accessed */
  resource?: ResourceInfo;
  /** The payment method chosen by the client */
  accepted: PaymentRequirementsV2;
  /** Scheme-specific payment data (signed transaction for Stacks) */
  payload: StacksPayloadV2;
  /** Protocol extensions data */
  extensions?: Record<string, unknown>;
}

/**
 * Settlement response for x402 v2 protocol
 */
export interface SettlementResponseV2 {
  /** Whether the payment settlement was successful */
  success: boolean;
  /** Error reason if settlement failed */
  errorReason?: string;
  /** Address of the payer's wallet */
  payer?: string;
  /** Blockchain transaction hash */
  transaction: string;
  /** Network identifier in CAIP-2 format */
  network: NetworkV2;
}

// ===== Constants =====

/**
 * x402 HTTP header names (V2 protocol)
 */
export const X402_HEADERS = {
  /** Header containing payment required info (base64 encoded) */
  PAYMENT_REQUIRED: "payment-required",
  /** Header containing payment signature/payload (base64 encoded) */
  PAYMENT_SIGNATURE: "payment-signature",
  /** Header containing settlement response (base64 encoded) */
  PAYMENT_RESPONSE: "payment-response",
} as const;

// ===== Functions =====

/**
 * Decode the payment-required header from base64 JSON.
 * Returns null if the header is missing or cannot be decoded.
 */
export function decodePaymentRequired(
  header: string | null | undefined
): PaymentRequiredV2 | null {
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(decoded) as PaymentRequiredV2;
  } catch {
    return null;
  }
}

/**
 * Encode a payment payload to base64 JSON.
 */
export function encodePaymentPayload(payload: PaymentPayloadV2): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Decode the payment-response header from base64 JSON.
 * Returns null if the header is missing or cannot be decoded.
 */
export function decodePaymentResponse(
  header: string | null | undefined
): SettlementResponseV2 | null {
  if (!header) return null;
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    return JSON.parse(decoded) as SettlementResponseV2;
  } catch {
    return null;
  }
}
