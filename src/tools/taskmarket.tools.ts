/**
 * TaskMarket Tools (https://taskmarket.dev) — onchain agent work marketplace on Base.
 *
 * Read tools (public, anonymous, no wallet, no spend):
 * - taskmarket_search        — list/search open tasks (filters: status, phase, mode, tags, reward)
 * - taskmarket_get           — full task detail + live status by task ID
 * - taskmarket_submissions   — list submissions for a task
 * - taskmarket_stats         — public market/agent statistics
 */

import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  baseUnitsToUsdc,
  getTask,
  getMarketStats,
  listSubmissions,
  listTasks,
} from "../services/taskmarket.service.js";

const TASK_ID_SCHEMA = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .describe("TaskMarket task ID (0x + 64 hex chars)");

export function registerTaskmarketTools(server: McpServer): void {
  // ==========================================================================
  // Read tools — no wallet required, never spends
  // ==========================================================================

  server.registerTool(
    "taskmarket_search",
    {
      description:
        "Search open tasks on the TaskMarket agent work marketplace (Base, USDC escrow). " +
        "Public and anonymous — no wallet or payment needed. Returns tasks with ID, reward (USDC), " +
        "status, submission count, deadline, and a short description so you can pick work to delegate. " +
        "Never spends anything.",
      inputSchema: z.object({
        status: z.string().default("open").describe("Filter by status (default: open)"),
        phase: z.string().optional().describe("Filter by lifecycle phase (active, in_review, awaiting_settlement, resolved)"),
        mode: z.string().optional().describe("Filter by task mode (bounty, claim, pitch, benchmark, auction)"),
        tags: z.string().optional().describe("Comma-separated tags to filter by (e.g. 'mcp,research')"),
        rewardMin: z.string().optional().describe("Minimum reward in human USDC (e.g. 0.5)"),
        rewardMax: z.string().optional().describe("Maximum reward in human USDC (e.g. 50)"),
        limit: z.number().int().min(1).max(50).default(20).describe("Max results (1-50)"),
      }),
    },
    async (args) => {
      try {
        const result = await listTasks({
          status: args.status as string,
          phase: args.phase as string | undefined,
          mode: args.mode as string | undefined,
          tags: args.tags as string | undefined,
          rewardMin: args.rewardMin as string | undefined,
          rewardMax: args.rewardMax as string | undefined,
          limit: args.limit as number,
        });
        return createJsonResponse({
          success: true,
          network: "eip155:8453",
          taskCount: result.tasks.length,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
          tasks: result.tasks.map((t) => ({
            id: t.id,
            status: t.status,
            phase: t.phase ?? null,
            mode: t.mode ?? "bounty",
            rewardUsdc: baseUnitsToUsdc(t.reward),
            submissionCount: t.submissionCount ?? 0,
            deadline: t.expiryTime,
            tags: t.tags ?? [],
            description: t.description.slice(0, 300),
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "taskmarket_get",
    {
      description:
        "Get full detail and LIVE status for one TaskMarket task by ID. Public and anonymous. " +
        "Returns description, reward, deadline, escrow tx, submission count, phase, and status. " +
        "Use this after creating or delegating a task to check whether it is open, in review, " +
        "awaiting settlement, or resolved. Never spends anything.",
      inputSchema: z.object({
        taskId: TASK_ID_SCHEMA,
      }),
    },
    async ({ taskId }) => {
      try {
        const task = await getTask(taskId as string);
        return createJsonResponse({
          success: true,
          id: task.id,
          status: task.status,
          phase: task.phase ?? null,
          mode: task.mode ?? "bounty",
          rewardUsdc: baseUnitsToUsdc(task.reward),
          netRewardUsdc: task.netReward ? baseUnitsToUsdc(task.netReward) : null,
          escrowTxHash: task.escrowTxHash ?? null,
          requester: task.requester,
          submissionCount: task.submissionCount ?? 0,
          createdAt: task.createdAt,
          deadline: task.expiryTime,
          tags: task.tags ?? [],
          link: `https://taskmarket.dev/task/${task.id}`,
          description: task.description,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "taskmarket_submissions",
    {
      description:
        "List submissions on a TaskMarket task for HUMAN REVIEW. Public and anonymous. " +
        "Returns each submission's worker address, submission time, deliverable file name, and " +
        "hash. This tool NEVER accepts or rejects work — it only surfaces submissions so a human " +
        "requester can review the deliverable before authorizing any payment.",
      inputSchema: z.object({
        taskId: TASK_ID_SCHEMA,
      }),
    },
    async ({ taskId }) => {
      try {
        const submissions = await listSubmissions(taskId as string);
        return createJsonResponse({
          success: true,
          taskId,
          submissionCount: submissions.length,
          submissions: submissions.map((s) => ({
            id: s.id,
            workerAddress: s.workerAddress,
            workerAgentId: s.workerAgentId ?? null,
            submittedAt: s.submittedAt,
            rejectedAt: s.rejectedAt ?? null,
            deliverableHash: s.deliverableHash ?? null,
            submitTxHash: s.submitTxHash ?? null,
            files: (s.artifacts ?? []).map((a) => ({
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes ?? null,
            })),
          })),
          note: "Human review required. This tool never auto-accepts or auto-rejects submissions.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "taskmarket_stats",
    {
      description:
        "Public TaskMarket statistics for an agent address or agent ID (one is required): completed tasks, rating, " +
        "total stars. Anonymous read. Use to gauge whether a worker or requester is reputable " +
        "before delegating work. Never spends anything.",
      inputSchema: z.object({
        address: z.string().optional().describe("Wallet address to look up stats for"),
        agentId: z.string().optional().describe("Agent ID to look up stats for (alternative to address)"),
      }),
    },
    async (args) => {
      try {
        if (!args.address && !args.agentId) {
          throw new Error("Pass an address or an agentId");
        }
        const stats = await getMarketStats({
          address: args.address as string | undefined,
          agentId: args.agentId as string | undefined,
        });
        return createJsonResponse({
          success: true,
          stats,
          note: "Stats are public market data. A low rating does not guarantee work quality — review deliverables yourself.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
