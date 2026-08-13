/**
 * TaskMarket service — read-only discovery + gated task creation.
 *
 * TaskMarket (https://taskmarket.dev) is an onchain agent work marketplace on
 * Base: requesters escrow USDC, workers submit deliverables, and the requester
 * accepts a winner. This service exposes the marketplace through the public
 * API (read-only tools: search, get, list-submissions, market-stats) and a
 * single gated write path (create-task).
 *
 * The create path is an x402-paid POST /api/tasks on Base. We never pay it
 * silently. Creating a task escrows real USDC, so the caller MUST pass an
 * explicit confirmation token and a hard max-spend cap, and the network must
 * be Base. See the `createTask` guard in this file and the tool wrapper in
 * src/tools/taskmarket.tools.ts.
 *
 * SECURITY INVARIANT: this file never holds a private key, seed phrase, token,
 * or cookie. Read-only endpoints are anonymous. The create path relies on the
 * first-party TaskMarket tooling (the `taskmarket` CLI or a configured wallet)
 * to sign and settle; this module only validates the request, shows the exact
 * plan, and enforces the spending cap before any money can move.
 */

const TASKMARKET_API_URL =
  process.env.TASKMARKET_API_URL || "https://api.taskmarket.dev";

/** Base chain (TaskMarket escrows USDC on Base). CAIP-2: eip155:8453. */
export const TASKMARKET_NETWORK = "eip155:8453";

/** Base USDC contract (merchant-of-record asset for TaskMarket tasks). */
export const TASKMARKET_USDC_ASSET =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Default production create-task payment policy (pinned to TaskMarket's escrow). */
export const TASKMARKET_PAYMENT_POLICY = {
  resource: `${TASKMARKET_API_URL}/api/tasks`,
  method: "POST",
  network: TASKMARKET_NETWORK,
  asset: TASKMARKET_USDC_ASSET,
  maxTimeoutSeconds: 300,
} as const;

export interface TaskmarketTask {
  id: string;
  requester: string;
  description: string;
  reward: string;
  netReward?: string;
  escrowTxHash?: string;
  createdAt: string;
  expiryTime: string;
  status: string;
  phase?: string;
  tags: string[];
  mode?: string;
  taskVisibility?: string;
  submissionVisibility?: string;
  submissionCount?: number;
  platformFeeBps?: number;
  requesterAgentId?: string;
}

export interface TaskmarketSubmission {
  id: string;
  taskId: string;
  workerAddress: string;
  workerAgentId?: string;
  submittedAt: string;
  rejectedAt?: string | null;
  deliverableHash?: string;
  submitTxHash?: string;
  artifacts?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes?: number;
    storageUri?: string;
  }>;
}

/** Convert base-unit reward (e.g. "2000000") to human USDC (e.g. "2"). */
export function baseUnitsToUsdc(raw: string | undefined | null): string {
  if (!raw || !/^\d+$/.test(raw)) return "0";
  const padded = raw.padStart(7, "0");
  const whole = padded.slice(0, padded.length - 6) || "0";
  const frac = padded.slice(padded.length - 6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/** Convert human USDC (e.g. "2") to base units (e.g. "2000000"). */
export function usdcToBaseUnits(amount: string): string {
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error(`Invalid USDC amount: "${amount}"`);
  }
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > 6) {
    throw new Error(`USDC amount has more than 6 decimals: "${amount}"`);
  }
  const wholeInt = BigInt(whole || "0");
  const fracPadded = frac.padEnd(6, "0");
  const fracInt = fracPadded ? BigInt(fracPadded) : 0n;
  return (wholeInt * 1000000n + fracInt).toString();
}

/**
 * Parse a "max spend" cap string into base units, throwing on invalid input.
 * Accepts human USDC (e.g. "5", "0.50") or an integer base-unit string when
 * the `baseUnits` flag is set.
 */
export function parseMaxSpend(raw: string, baseUnits = false): bigint {
  const value = baseUnits ? raw : usdcToBaseUnits(raw);
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid max spend: "${raw}"`);
  }
  return BigInt(value);
}

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${TASKMARKET_API_URL}${path}`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(`TaskMarket API error ${response.status}: ${text}`);
  }
  const json = (await response.json()) as { data?: T } & Record<string, unknown>;
  return (json.data ?? json) as T;
}

/**
 * List/search tasks. Public, anonymous, read-only.
 */
export async function listTasks(options: {
  status?: string;
  phase?: string;
  mode?: string;
  tags?: string;
  rewardMin?: string;
  rewardMax?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ tasks: TaskmarketTask[]; hasMore: boolean; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (options.status) params.set("status", options.status);
  if (options.phase) params.set("phase", options.phase);
  if (options.mode) params.set("mode", options.mode);
  if (options.tags) params.set("tags", options.tags);
  if (options.rewardMin) params.set("minReward", String(Math.round(Number(options.rewardMin) * 1e6)));
  if (options.rewardMax) params.set("maxReward", String(Math.round(Number(options.rewardMax) * 1e6)));
  params.set("limit", String(options.limit ?? 20));
  const result = await apiGet<{
    tasks: TaskmarketTask[];
    hasMore: boolean;
    nextCursor: string | null;
  }>(`/api/tasks?${params.toString()}`, options.signal);
  return {
    tasks: result.tasks ?? [],
    hasMore: result.hasMore ?? false,
    nextCursor: result.nextCursor ?? null,
  };
}

/**
 * Get a single task with its live status. Public, anonymous, read-only.
 */
export async function getTask(taskId: string, signal?: AbortSignal): Promise<TaskmarketTask> {
  return apiGet<TaskmarketTask>(`/api/tasks/${taskId}`, signal);
}

/**
 * List submissions for a task so the requester can review them for real work.
 * Public, anonymous, read-only. Never auto-accepts or auto-rejects anything.
 */
export async function listSubmissions(
  taskId: string,
  signal?: AbortSignal
): Promise<TaskmarketSubmission[]> {
  const result = await apiGet<TaskmarketSubmission[] | { submissions?: TaskmarketSubmission[] }>(
    `/api/tasks/${taskId}/submissions`,
    signal
  );
  if (Array.isArray(result)) return result;
  return (result.submissions ?? []) as TaskmarketSubmission[];
}

export interface TaskmarketStats {
  address?: string;
  agentId?: string;
  completedTasks?: number;
  ratedTasks?: number;
  totalStars?: number;
  averageRating?: number;
  [key: string]: unknown;
}

/**
 * Market/agent statistics. Anonymous read of a public stats endpoint.
 */
export async function getMarketStats(options: {
  address?: string;
  agentId?: string;
  signal?: AbortSignal;
}): Promise<TaskmarketStats> {
  const params = new URLSearchParams();
  if (options.address) params.set("address", options.address);
  if (options.agentId) params.set("agentId", options.agentId);
  const query = params.toString();
  return apiGet<TaskmarketStats>(`/api/agents/stats${query ? `?${query}` : ""}`, options.signal);
}

export interface CreateTaskRequest {
  description: string;
  rewardUsdc: string;
  durationHours: number;
  tags?: string[];
  submissionVisibility?: "public" | "reveal_all" | "winner_only" | "never";
}

export interface GatedCreateResult {
  granted: boolean;
  reason?: string;
  plan?: {
    network: string;
    asset: string;
    description: string;
    rewardUsdc: string;
    rewardBaseUnits: string;
    durationHours: number;
    deadlineIso: string;
    tags: string[];
    maxSpendUsdc: string;
    maxSpendBaseUnits: string;
    submissionVisibility: string;
  };
}

/**
 * Build and validate the exact create plan WITHOUT touching money.
 *
 * Returns `{ granted: false, reason }` (and never attempts payment) when:
 *  - the confirmation token is missing or does not match the required literal;
 *  - the reward exceeds the caller's max-spend cap;
 *  - any field is malformed.
 *
 * This is the sole gate between an LLM request and the first-party TaskMarket
 * create flow. The confirmation token must be supplied fresh by the operator
 * for each call — it is never inferred from prompt content.
 */
export function prepareCreatePlan(
  request: CreateTaskRequest,
  opts: { confirm: string; maxSpendUsdc: string; maxSpendBaseUnits?: boolean }
): GatedCreateResult {
  const requiredConfirm = "APPROVE";
  if (opts.confirm.trim() !== requiredConfirm) {
    return {
      granted: false,
      reason: `Create refused: you must pass confirm="${requiredConfirm}" to explicitly authorize this task. No funds were moved.`,
    };
  }

  const description = request.description.trim();
  if (!description) {
    return { granted: false, reason: "Create refused: description is required." };
  }
  if (description.length < 20) {
    return {
      granted: false,
      reason: "Create refused: description must be at least 20 characters (show the exact task the worker will deliver).",
    };
  }

  let rewardBaseUnits: bigint;
  try {
    rewardBaseUnits = BigInt(usdcToBaseUnits(request.rewardUsdc));
  } catch {
    return {
      granted: false,
      reason: `Create refused: invalid reward "${request.rewardUsdc}" (human USDC, up to 6 decimals).`,
    };
  }
  if (rewardBaseUnits <= 0n) {
    return { granted: false, reason: "Create refused: reward must be greater than 0 USDC." };
  }

  let maxSpend: bigint;
  try {
    maxSpend = parseMaxSpend(opts.maxSpendUsdc, opts.maxSpendBaseUnits);
  } catch {
    return {
      granted: false,
      reason: `Create refused: invalid max-spend "${opts.maxSpendUsdc}".`,
    };
  }
  if (rewardBaseUnits > maxSpend) {
    return {
      granted: false,
      reason:
        `Create refused: reward ${request.rewardUsdc} USDC exceeds max-spend ` +
        `${opts.maxSpendUsdc} USDC. Raise the cap and retry with a fresh confirm token. No funds were moved.`,
    };
  }

  const durationHours = Number(request.durationHours);
  if (!Number.isFinite(durationHours) || durationHours <= 0) {
    return { granted: false, reason: "Create refused: durationHours must be a positive number." };
  }

  const tags = (request.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const submissionVisibility = request.submissionVisibility ?? "public";
  const validVisibilities = ["public", "reveal_all", "winner_only", "never"];
  if (!validVisibilities.includes(submissionVisibility)) {
    return {
      granted: false,
      reason: `Create refused: submissionVisibility must be one of ${validVisibilities.join(", ")}.`,
    };
  }

  return {
    granted: true,
    plan: {
      network: TASKMARKET_NETWORK,
      asset: TASKMARKET_USDC_ASSET,
      description,
      rewardUsdc: request.rewardUsdc,
      rewardBaseUnits: rewardBaseUnits.toString(),
      durationHours,
      deadlineIso: new Date(Date.now() + durationHours * 3600_000).toISOString(),
      tags,
      maxSpendUsdc: opts.maxSpendUsdc,
      maxSpendBaseUnits: maxSpend.toString(),
      submissionVisibility,
    },
  };
}
