import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import {
  scaffoldProject,
  scaffoldAIProject,
  type EndpointConfig,
  type AIEndpointConfig,
} from "../services/scaffold.service.js";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import { getWalletAddress } from "../services/x402.service.js";

/**
 * Check if a directory contains an existing x402 project
 */
async function isExistingX402Project(dir: string): Promise<boolean> {
  try {
    const indexPath = path.join(dir, "src", "index.ts");
    const middlewarePath = path.join(dir, "src", "x402-middleware.ts");
    const packagePath = path.join(dir, "package.json");

    const [hasIndex, hasMiddleware, hasPackage] = await Promise.all([
      fs.access(indexPath).then(() => true).catch(() => false),
      fs.access(middlewarePath).then(() => true).catch(() => false),
      fs.access(packagePath).then(() => true).catch(() => false),
    ]);

    return hasIndex && hasMiddleware && hasPackage;
  } catch {
    return false;
  }
}

/**
 * Validate that a project directory does not already exist.
 * Returns an error response if it does, or null if the path is clear.
 */
async function checkProjectConflict(
  projectPath: string
): Promise<ReturnType<typeof createJsonResponse> | null> {
  const exists = await fs.access(projectPath).then(() => true).catch(() => false);
  if (!exists) return null;

  const isX402 = await isExistingX402Project(projectPath);
  if (isX402) {
    return createJsonResponse({
      success: false,
      error: "Project already exists",
      message: `A project already exists at ${projectPath}. Adding endpoints to existing projects is not yet supported. Please choose a different project name or delete the existing project.`,
      projectPath,
    });
  }
  return createJsonResponse({
    success: false,
    error: "Directory already exists",
    message: `A directory already exists at ${projectPath}. Please choose a different project name.`,
    projectPath,
  });
}

/**
 * Resolve the recipient address: use the provided value, or fall back
 * to the active wallet address, or return undefined.
 */
async function resolveRecipientAddress(
  provided?: string
): Promise<string | undefined> {
  if (provided) return provided;
  try {
    return await getWalletAddress();
  } catch {
    return undefined;
  }
}

export function registerScaffoldTools(server: McpServer): void {
  server.registerTool(
    "scaffold_x402_endpoint",
    {
      description: `Create a complete x402 paid API project as a Cloudflare Worker.

This creates a NEW PROJECT FOLDER with everything needed to deploy a pay-per-use API:
- Full Hono.js application with x402 payment middleware
- Ready for deployment to Cloudflare Workers
- Based on production patterns from x402-api and stx402

## What Gets Created

A folder named \`{projectName}\` containing:
- src/index.ts - Hono app with your x402-protected endpoints
- src/x402-middleware.ts - Payment verification (uses native relay fetch)
- wrangler.jsonc - Cloudflare Worker config with staging/production envs
- package.json - Dependencies including hono (no x402-stacks dependency)
- .dev.vars - Local dev variables (pre-filled if you have a wallet)
- README.md - Documentation

## Pricing Tiers

Use tiers for consistent pricing:
- **simple/standard**: 0.001 STX
- **ai**: 0.003 STX
- **heavy_ai**: 0.01 STX
- **storage_read**: 0.0005 STX
- **storage_write**: 0.001 STX

## Quick Start After Generation

\`\`\`
cd {projectName}
npm install
npm run dev
\`\`\``,
      inputSchema: {
        outputDir: z
          .string()
          .describe("Directory where the project folder will be created (e.g., '/Users/me/projects' or '.')"),
        projectName: z
          .string()
          .regex(/^[a-z][a-z0-9-]*$/, "Project name must be lowercase with hyphens only")
          .describe("Project name - a folder with this name will be created (e.g., 'my-x402-api')"),
        endpoints: z
          .array(
            z.object({
              path: z
                .string()
                .startsWith("/")
                .describe("Endpoint path (e.g., '/api/premium')"),
              method: z.enum(["GET", "POST"]).describe("HTTP method"),
              description: z.string().describe("Endpoint description for documentation"),
              amount: z
                .string()
                .regex(/^\d+(\.\d+)?$/, "Amount must be a positive number")
                .optional()
                .describe("Payment amount (e.g., '0.001' STX). Optional if tier is specified."),
              tokenType: z.enum(["STX", "sBTC", "USDCx"]).describe("Payment token type"),
              tier: z
                .enum(["simple", "standard", "ai", "heavy_ai", "storage_read", "storage_write"])
                .optional()
                .describe("Pricing tier (overrides amount if specified)"),
            })
          )
          .min(1)
          .describe("Array of endpoint configurations"),
        recipientAddress: z
          .string()
          .regex(/^S[PT][A-Z0-9]+$/, "Must be a valid Stacks address")
          .optional()
          .describe("Stacks address to receive payments. If not provided, uses your configured wallet address or must be set in .dev.vars"),
        network: z
          .enum(["mainnet", "testnet"])
          .optional()
          .default("mainnet")
          .describe("Network for payments (default: mainnet)"),
        relayUrl: z
          .string()
          .url()
          .optional()
          .describe(
            "Custom relay URL (default: https://x402-relay.aibtc.com)"
          ),
      },
    },
    async ({ outputDir, projectName, endpoints, recipientAddress, network, relayUrl }) => {
      try {
        const projectPath = path.join(outputDir, projectName);

        const conflict = await checkProjectConflict(projectPath);
        if (conflict) return conflict;

        const finalRecipientAddress = await resolveRecipientAddress(recipientAddress);

        const result = await scaffoldProject({
          outputDir,
          projectName,
          endpoints: endpoints as EndpointConfig[],
          recipientAddress: finalRecipientAddress,
          network: network || "mainnet",
          relayUrl: relayUrl || "https://x402-relay.aibtc.com",
        });

        const responseEndpoints = endpoints.map((ep) => {
          const cost = ep.tier
            ? `tier: ${ep.tier}`
            : `${ep.amount || "0.001"} ${ep.tokenType}`;
          return {
            path: ep.path,
            method: ep.method,
            cost,
          };
        });

        return createJsonResponse({
          success: true,
          message: `Project created at ${result.projectPath}`,
          projectPath: result.projectPath,
          filesCreated: result.filesCreated,
          nextSteps: result.nextSteps,
          recipientAddress: finalRecipientAddress || "(set in .dev.vars)",
          endpoints: responseEndpoints,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // AI-powered x402 endpoint scaffolding with OpenRouter
  server.registerTool(
    "scaffold_x402_ai_endpoint",
    {
      description: `Create a complete x402 paid AI API project with OpenRouter integration.

This creates a NEW PROJECT FOLDER with everything needed to deploy a pay-per-use AI API:
- Full Hono.js application with x402 payment middleware
- OpenRouter integration for Claude, GPT-4, Llama, etc.
- Ready for deployment to Cloudflare Workers

## What Gets Created

A folder named \`{projectName}\` containing:
- src/index.ts - Hono app with your x402-protected AI endpoints
- src/x402-middleware.ts - Payment verification (uses native relay fetch)
- src/openrouter.ts - OpenRouter API client
- wrangler.jsonc - Cloudflare Worker config
- .dev.vars - Local dev variables (needs OPENROUTER_API_KEY)
- README.md - Documentation

## AI Types

- **chat**: General chat/Q&A
- **completion**: Text completion
- **summarize**: Summarize text
- **translate**: Translate text
- **custom**: Custom system prompt

## Quick Start After Generation

\`\`\`
cd {projectName}
npm install
# Edit .dev.vars with RECIPIENT_ADDRESS and OPENROUTER_API_KEY
npm run dev
\`\`\``,
      inputSchema: {
        outputDir: z
          .string()
          .describe("Directory where the project folder will be created (e.g., '/Users/me/projects' or '.')"),
        projectName: z
          .string()
          .regex(/^[a-z][a-z0-9-]*$/, "Project name must be lowercase with hyphens only")
          .describe("Project name - a folder with this name will be created (e.g., 'my-ai-api')"),
        endpoints: z
          .array(
            z.object({
              path: z
                .string()
                .startsWith("/")
                .describe("Endpoint path (e.g., '/api/chat')"),
              description: z.string().describe("Endpoint description for documentation"),
              amount: z
                .string()
                .regex(/^\d+(\.\d+)?$/, "Amount must be a positive number")
                .describe("Payment amount (e.g., '0.01' STX)"),
              tokenType: z.enum(["STX", "sBTC", "USDCx"]).describe("Payment token type"),
              aiType: z
                .enum(["chat", "completion", "summarize", "translate", "custom"])
                .describe("Type of AI operation"),
              model: z
                .string()
                .optional()
                .describe("OpenRouter model (e.g., 'anthropic/claude-3-haiku')"),
              systemPrompt: z
                .string()
                .optional()
                .describe("Custom system prompt (for 'custom' aiType or to override default)"),
            })
          )
          .min(1)
          .describe("Array of AI endpoint configurations"),
        recipientAddress: z
          .string()
          .regex(/^S[PT][A-Z0-9]+$/, "Must be a valid Stacks address")
          .optional()
          .describe("Stacks address to receive payments. If not provided, uses your configured wallet address or must be set in .dev.vars"),
        network: z
          .enum(["mainnet", "testnet"])
          .optional()
          .default("mainnet")
          .describe("Network for payments (default: mainnet)"),
        relayUrl: z
          .string()
          .url()
          .optional()
          .describe("Custom relay URL (default: https://x402-relay.aibtc.com)"),
        defaultModel: z
          .string()
          .optional()
          .default("anthropic/claude-3-haiku")
          .describe("Default OpenRouter model for all endpoints (default: anthropic/claude-3-haiku)"),
      },
    },
    async ({
      outputDir,
      projectName,
      endpoints,
      recipientAddress,
      network,
      relayUrl,
      defaultModel,
    }) => {
      try {
        const projectPath = path.join(outputDir, projectName);

        const conflict = await checkProjectConflict(projectPath);
        if (conflict) return conflict;

        const finalRecipientAddress = await resolveRecipientAddress(recipientAddress);

        const result = await scaffoldAIProject({
          outputDir,
          projectName,
          endpoints: endpoints as AIEndpointConfig[],
          recipientAddress: finalRecipientAddress,
          network: network || "mainnet",
          relayUrl: relayUrl || "https://x402-relay.aibtc.com",
          defaultModel: defaultModel || "anthropic/claude-3-haiku",
        });

        return createJsonResponse({
          success: true,
          message: `AI project scaffolded successfully at ${result.projectPath}`,
          projectPath: result.projectPath,
          filesCreated: result.filesCreated,
          nextSteps: result.nextSteps,
          recipientAddress: finalRecipientAddress || "(set in .dev.vars)",
          endpoints: endpoints.map((ep) => ({
            path: ep.path,
            aiType: ep.aiType,
            model: ep.model || defaultModel || "anthropic/claude-3-haiku",
            cost: `${ep.amount} ${ep.tokenType}`,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
