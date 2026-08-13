/**
 * TaskMarket Tools (https://taskmarket.dev) — onchain agent work marketplace on Base.
 *
 * Read tools (public, anonymous, no wallet, no spend):
 * - taskmarket_search        — list/search open tasks (filters: status, phase, mode, tags, reward)
 * - taskmarket_get           — full task detail + live status by task ID
 * - taskmarket_submissions   — list submissions for a task for human review (never auto-accepts)
 * - taskmarket_stats         — public market/agent statistics
 *
 * Gated write tool:
 * - taskmarket_preview_create — show the EXACT task plan (description, reward, deadline,
 *                               deliverables, Base network, max spend) and REQUIRE an explicit
 *                               confirmation token + max-spend cap. Refuses (moves no money) if
 *                               either is missing. Returns the exact first-party CLI command.
 * - taskmarket_create         — after an explicit `confirm="APPROVE"` + a max-spend cap that
 *                               covers the reward, run the first-party TaskMarket CLI to create
 *                               and fund the task, then return the task ID, link, and live status.
 *
 * SECURITY:
 * - Create NEVER runs without an explicit confirmation token supplied fresh by the operator.
 * - The reward must be <= the caller's max-spend cap; otherwise the create refuses.
 * - The network is pinned to Base (eip155:8453). No blind retry of unknown-settlement payments:
 *   if the CLI reports a task ID it is re-fetched for live status; if the create fails, the error
 *   is surfaced and the caller is told to check `taskmarket inbox` — never silently re-submitted.
 * - No private keys, seeds, tokens, or cookies are ever requested, stored, or logged here.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  baseUnitsToUsdc,
  getTask,
  getMarketStats,
  listSubmissions,
  listTasks,
  prepareCreatePlan,
  type CreateTaskRequest,
} from "../services/taskmarket.service.js";

const execFileAsync = promisify(execFile);

/** TaskMarket CLI binary. Overridable for local dev / tests. */
const TASKMARKET_CLI = process.env.TASKMARKET_CLI || "taskmarket";

/** Bound the CLI create so a hung call cannot block the tool forever. */
const CLI_TIMEOUT_MS = 120_000;

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
      inputSchema: {
        status: z.string().default("open").describe("Filter by status (default: open)"),
        phase: z.string().optional().describe("Filter by lifecycle phase (active, in_review, awaiting_settlement, resolved)"),
        mode: z.string().optional().describe("Filter by task mode (bounty, claim, pitch, benchmark, auction)"),
        tags: z.string().optional().describe("Comma-separated tags to filter by (e.g. 'mcp,research')"),
        rewardMin: z.string().optional().describe("Minimum reward in human USDC (e.g. 0.5)"),
        rewardMax: z.string().optional().describe("Maximum reward in human USDC (e.g. 50)"),
        limit: z.number().int().min(1).max(50).default(20).describe("Max results (1-50)"),
      },
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
      inputSchema: {
        taskId: TASK_ID_SCHEMA,
      },
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
      inputSchema: {
        taskId: TASK_ID_SCHEMA,
      },
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
        "Public TaskMarket statistics for an agent address or agent ID: completed tasks, rating, " +
        "total stars. Anonymous read. Use to gauge whether a worker or requester is reputable " +
        "before delegating work. Never spends anything.",
      inputSchema: {
        address: z.string().optional().describe("Wallet address to look up stats for"),
        agentId: z.string().optional().describe("Agent ID to look up stats for (alternative to address)"),
      },
    },
    async (args) => {
      try {
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

  // ==========================================================================
  // Gated write tool — create a task. Requires explicit confirmation + cap.
  // ==========================================================================

  server.registerTool(
    "taskmarket_preview_create",
    {
      description:
        "Show the EXACT plan for creating a TaskMarket task (description, reward, deadline, " +
        "deliverables, Base network, max spend) and prove the confirmation gate works BEFORE any " +
        "money can move. Pass the task details plus confirm='APPROVE' and maxSpendUsdc. " +
        "If the confirmation token is missing/wrong or the reward exceeds max-spend, this REFUSES " +
        "and returns the reason — no funds are ever moved. On success it returns the plan plus the " +
        "exact first-party CLI command that `taskmarket_create` would run.",
      inputSchema: {
        description: z.string().min(20).describe("Exact task description / deliverables the worker must produce (>=20 chars)"),
        rewardUsdc: z.string().describe("Reward in human USDC (e.g. '5' or '0.50')"),
        durationHours: z.number().positive().describe("Task duration / deadline in hours from now"),
        tags: z.array(z.string()).optional().describe("Optional tags (e.g. ['research', 'mcp'])"),
        submissionVisibility: z.enum(["public", "reveal_all", "winner_only", "never"]).default("public").describe("Who can see submissions"),
        confirm: z.string().describe("Explicit operator authorization. Must equal APPROVE exactly."),
        maxSpendUsdc: z.string().describe("Hard maximum spend in human USDC (reward must be <= this)"),
      },
    },
    async (args) => {
      try {
        const request: CreateTaskRequest = {
          description: args.description as string,
          rewardUsdc: args.rewardUsdc as string,
          durationHours: args.durationHours as number,
          tags: (args.tags as string[] | undefined) ?? [],
          submissionVisibility: (args.submissionVisibility as CreateTaskRequest["submissionVisibility"]) ?? "public",
        };
        const plan = prepareCreatePlan(request, {
          confirm: args.confirm as string,
          maxSpendUsdc: args.maxSpendUsdc as string,
        });
        if (!plan.granted) {
          return createJsonResponse({ success: false, granted: false, reason: plan.reason });
        }
        const cliArgs = [
          "task",
          "create",
          "--description",
          plan.plan!.description,
          "--reward",
          plan.plan!.rewardUsdc,
          "--duration",
          String(plan.plan!.durationHours),
        ];
        if (plan.plan!.tags.length > 0) cliArgs.push("--tags", plan.plan!.tags.join(","));
        cliArgs.push("--submission-visibility", plan.plan!.submissionVisibility);
        return createJsonResponse({
          success: true,
          granted: true,
          plan: plan.plan,
          nextStep: "Run taskmarket_create with the same details + confirm='APPROVE' to execute.",
          cliCommand: [TASKMARKET_CLI, ...cliArgs.map((a) => (a.includes(" ") ? `"${a}"` : a))].join(" "),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "taskmarket_create",
    {
      description:
        "Create and FUND a TaskMarket task on Base after explicit operator authorization. " +
        "Show the user the plan first with taskmarket_preview_create, then run this tool with the " +
        "SAME details plus confirm='APPROVE' and a maxSpendUsdc cap >= reward. The task is created " +
        "through the first-party TaskMarket CLI (which escrows the reward in USDC on Base via x402). " +
        "Returns the task ID, link, and live status. Refuses without the exact confirmation token, " +
        "if the reward exceeds maxSpend, or if any field is invalid — no money moves in those cases. " +
        "If the create fails mid-flight, it is NOT retried blindly; the error is returned and you " +
        "should check `taskmarket inbox` before attempting anything again.",
      inputSchema: {
        description: z.string().min(20).describe("Exact task description / deliverables (>=20 chars)"),
        rewardUsdc: z.string().describe("Reward in human USDC (escrowed from your wallet)"),
        durationHours: z.number().positive().describe("Task duration / deadline in hours from now"),
        tags: z.array(z.string()).optional().describe("Optional tags"),
        submissionVisibility: z.enum(["public", "reveal_all", "winner_only", "never"]).default("public").describe("Who can see submissions"),
        confirm: z.string().describe("Explicit operator authorization. Must equal APPROVE exactly."),
        maxSpendUsdc: z.string().describe("Hard maximum spend cap in human USDC (reward must be <= this)"),
      },
    },
    async (args) => {
      try {
        const request: CreateTaskRequest = {
          description: args.description as string,
          rewardUsdc: args.rewardUsdc as string,
          durationHours: args.durationHours as number,
          tags: (args.tags as string[] | undefined) ?? [],
          submissionVisibility: (args.submissionVisibility as CreateTaskRequest["submissionVisibility"]) ?? "public",
        };
        const plan = prepareCreatePlan(request, {
          confirm: args.confirm as string,
          maxSpendUsdc: args.maxSpendUsdc as string,
        });
        if (!plan.granted) {
          return createJsonResponse({ success: false, granted: false, reason: plan.reason });
        }
        const p = plan.plan!;

        const cliArgs = [
          "task",
          "create",
          "--description",
          p.description,
          "--reward",
          p.rewardUsdc,
          "--duration",
          String(p.durationHours),
        ];
        if (p.tags.length > 0) cliArgs.push("--tags", p.tags.join(","));
        cliArgs.push("--submission-visibility", p.submissionVisibility);

        let stdout: string;
        try {
          const result = await execFileAsync(TASKMARKET_CLI, cliArgs, {
            timeout: CLI_TIMEOUT_MS,
            maxBuffer: 1024 * 1024,
            env: { ...process.env },
          });
          stdout = result.stdout;
        } catch (err) {
          const e = err as { stdout?: string; stderr?: string; message?: string };
          const detail = (e.stdout || e.stderr || e.message || "unknown").toString().slice(0, 800);
          return createJsonResponse({
            success: false,
            granted: true,
            note: "Create command failed. The settlement status is UNKNOWN — this was NOT blindly retried. Check `taskmarket inbox` / the CLI output below before deciding whether to retry.",
            cliOutput: detail,
          });
        }

        let taskId: string | null = null;
        try {
          const parsed = JSON.parse(stdout);
          taskId = (parsed.data?.taskId ?? parsed.taskId) as string | null;
        } catch {
          taskId = null;
        }
        if (!taskId) {
          return createJsonResponse({
            success: false,
            granted: true,
            note: "Create did not return a task ID. Settlement status is UNKNOWN and was NOT retried. Inspect the CLI output and check `taskmarket inbox`.",
            cliOutput: stdout.slice(0, 800),
          });
        }

        // Fetch live status for the freshly created task (read-only).
        let live: { status?: string; phase?: string; deadline?: string } | null = null;
        try {
          const task = await getTask(taskId);
          live = {
            status: task.status,
            phase: task.phase,
            deadline: task.expiryTime,
          };
        } catch {
          live = null;
        }

        return createJsonResponse({
          success: true,
          granted: true,
          taskId,
          link: `https://taskmarket.dev/task/${taskId}`,
          network: p.network,
          asset: p.asset,
          rewardUsdc: p.rewardUsdc,
          deadlineIso: p.deadlineIso,
          liveStatus: live ?? "pending confirmation — re-run taskmarket_get to poll",
          note: "Submissions must be reviewed by a human. Use taskmarket_submissions to list them; this tool never auto-accepts work.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
