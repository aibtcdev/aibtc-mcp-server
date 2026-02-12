/**
 * Shared Zod schemas for tool input parameters.
 */

import { z } from "zod";

/**
 * Shared 'sponsored' input schema for tools that support sponsored transactions.
 */
export const sponsoredSchema = z
  .boolean()
  .optional()
  .default(false)
  .describe(
    "Use sponsored transaction relay so a relay service pays fees instead of your wallet. " +
    "Requires SPONSOR_API_KEY env var or wallet-level sponsorApiKey."
  );
