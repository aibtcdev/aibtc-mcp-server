import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAccount, getWalletAddress, NETWORK } from "../services/x402.service.js";
import { getBnsService } from "../services/bns.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import crypto from "crypto";

export function registerBnsTools(server: McpServer): void {
  // Lookup BNS name
  server.registerTool(
    "lookup_bns_name",
    {
      description: "Resolve a .btc domain name to its Stacks address.",
      inputSchema: {
        name: z.string().describe("BNS name to lookup (e.g., 'alice.btc' or 'alice')"),
      },
    },
    async ({ name }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const result = await bnsService.lookupName(name);

        if (!result) {
          return createJsonResponse({
            name,
            found: false,
            message: "Name not found or not registered",
          });
        }

        return createJsonResponse({
          name: result.name,
          found: true,
          address: result.address,
          namespace: result.namespace,
          expireBlock: result.expireBlock,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Reverse BNS lookup
  server.registerTool(
    "reverse_bns_lookup",
    {
      description: "Get the BNS domain names owned by an address.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Stacks address to lookup. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const names = await bnsService.reverseLookup(walletAddress);

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          namesCount: names.length,
          names,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get BNS name info
  server.registerTool(
    "get_bns_info",
    {
      description: "Get detailed information about a BNS domain name.",
      inputSchema: {
        name: z.string().describe("BNS name to lookup (e.g., 'alice.btc')"),
      },
    },
    async ({ name }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const info = await bnsService.getNameInfo(name);

        if (!info) {
          return createJsonResponse({
            name,
            found: false,
            message: "Name not found",
          });
        }

        return createJsonResponse({
          network: NETWORK,
          found: true,
          ...info,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Check BNS availability
  server.registerTool(
    "check_bns_availability",
    {
      description: "Check if a BNS domain name is available for registration.",
      inputSchema: {
        name: z.string().describe("BNS name to check (e.g., 'alice')"),
      },
    },
    async ({ name }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const available = await bnsService.checkAvailability(name);

        return createJsonResponse({
          name: name.endsWith(".btc") ? name : `${name}.btc`,
          available,
          network: NETWORK,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Get BNS price
  server.registerTool(
    "get_bns_price",
    {
      description: "Get the registration price for a BNS domain name.",
      inputSchema: {
        name: z.string().describe("BNS name to check (e.g., 'alice')"),
      },
    },
    async ({ name }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const price = await bnsService.getPrice(name);

        return createJsonResponse({
          name: name.endsWith(".btc") ? name : `${name}.btc`,
          network: NETWORK,
          price: {
            units: price.units,
            microStx: price.amount,
            stx: price.amountStx + " STX",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // List user domains
  server.registerTool(
    "list_user_domains",
    {
      description: "List all BNS domains owned by an address.",
      inputSchema: {
        address: z
          .string()
          .optional()
          .describe("Stacks address to check. Uses configured wallet if not provided."),
      },
    },
    async ({ address }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const walletAddress = address || (await getWalletAddress());
        const domains = await bnsService.getUserDomains(walletAddress);

        return createJsonResponse({
          address: walletAddress,
          network: NETWORK,
          domainsCount: domains.length,
          domains,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Claim BNS name fast (single transaction, recommended for .btc)
  server.registerTool(
    "claim_bns_name_fast",
    {
      description:
        "Register a BNS domain name in a single transaction using name-claim-fast. " +
        "This is the RECOMMENDED method — no preorder/register wait needed. " +
        "Burns the name price in STX and mints the BNS NFT atomically. " +
        "Works for all open namespaces (BNS V2).",
      inputSchema: {
        name: z
          .string()
          .describe("BNS name to claim (e.g., 'myname' or 'myname.btc')"),
        sendTo: z
          .string()
          .optional()
          .describe("Optional recipient address. Defaults to the wallet's own address."),
      },
    },
    async ({ name, sendTo }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const account = await getAccount();

        // Check if name is available first
        const available = await bnsService.checkAvailability(name);
        if (!available) {
          return createErrorResponse(
            new Error(`Name "${name}" is not available for registration`)
          );
        }

        // Get the price for reference
        const price = await bnsService.getPrice(name);

        // Perform the claim
        const result = await bnsService.claimNameFast(account, name, sendTo);

        const fullName = name.endsWith(".btc") ? name : `${name}.btc`;

        return createJsonResponse({
          success: true,
          method: "name-claim-fast (single transaction)",
          name: fullName,
          sendTo: sendTo || account.address,
          txid: result.txid,
          network: NETWORK,
          price: price
            ? {
                microStx: price.amount,
                stx: price.amountStx + " STX",
              }
            : null,
          message: `Name "${fullName}" claimed! Once confirmed (~10 min), it will be registered to ${sendTo || account.address}.`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Preorder BNS name (Step 1 of 2 for registration)
  server.registerTool(
    "preorder_bns_name",
    {
      description:
        "Preorder a BNS domain name (step 1 of 2-step registration). " +
        "NOTE: For .btc names, prefer claim_bns_name_fast instead — it registers in one transaction. " +
        "Use this 2-step flow only for non-.btc namespaces or if claim-fast is unavailable. " +
        "After preorder is confirmed (~10 minutes), call register_bns_name with the same salt. " +
        "IMPORTANT: Save the returned salt - you'll need it for the register step!",
      inputSchema: {
        name: z
          .string()
          .describe("BNS name to preorder (e.g., 'myname' or 'myname.btc')"),
        salt: z
          .string()
          .optional()
          .describe("Optional salt for the preorder hash. If not provided, a random salt will be generated."),
      },
    },
    async ({ name, salt }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const account = await getAccount();

        // Check if name is available first
        const available = await bnsService.checkAvailability(name);
        if (!available) {
          return createErrorResponse(
            new Error(`Name "${name}" is not available for registration`)
          );
        }

        // Get the price for reference
        const price = await bnsService.getPrice(name);

        // Generate salt if not provided
        const usedSalt = salt || crypto.randomBytes(16).toString("hex");

        // Perform the preorder
        const result = await bnsService.preorderName(account, name, usedSalt);

        const fullName = name.endsWith(".btc") ? name : `${name}.btc`;

        return createJsonResponse({
          success: true,
          step: "1 of 2 (preorder)",
          name: fullName,
          salt: usedSalt,
          txid: result.txid,
          network: NETWORK,
          price: price
            ? {
                microStx: price.amount,
                stx: price.amountStx + " STX",
              }
            : null,
          nextStep:
            "Wait for this transaction to be confirmed (~10 minutes), then call register_bns_name with the same name and salt.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // Register BNS name (Step 2 of 2 for registration)
  server.registerTool(
    "register_bns_name",
    {
      description:
        "Register a BNS domain name after preorder is confirmed. This is step 2 of a 2-step process. " +
        "You MUST use the same salt from the preorder step. " +
        "Only call this after the preorder transaction has been confirmed on-chain (~10 minutes). " +
        "Auto-detects contract version: V2 for .btc names, V1 for other namespaces.",
      inputSchema: {
        name: z
          .string()
          .describe("BNS name to register (must match the preordered name)"),
        salt: z
          .string()
          .describe("The hex salt used in the preorder step (REQUIRED - must match exactly)"),
      },
    },
    async ({ name, salt }) => {
      try {
        const bnsService = getBnsService(NETWORK);
        const account = await getAccount();

        // Perform the registration
        const result = await bnsService.registerName(account, name, salt);

        const fullName = name.endsWith(".btc") ? name : `${name}.btc`;

        return createJsonResponse({
          success: true,
          step: "2 of 2 (register)",
          name: fullName,
          txid: result.txid,
          network: NETWORK,
          message: `Registration submitted! Once confirmed, "${fullName}" will be registered to your address.`,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
