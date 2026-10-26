/**
 * TaskMarket service — read-only discovery.
 *
 * TaskMarket (https://taskmarket.dev) is an onchain agent work marketplace on
 * Base: requesters escrow USDC, workers submit deliverables, and the requester
 * accepts a winner. This service reads the public, anonymous API (search, get,
 * list-submissions, market-stats). It never signs or spends.
 */

const TASKMARKET_API_URL =
  process.env.TASKMARKET_API_URL || "https://api.taskmarket.dev";

/** Bound every read so a hung TaskMarket API cannot hold a tool call open. */
const READ_TIMEOUT_MS = 15_000;

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

async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${TASKMARKET_API_URL}${path}`, {
    signal: signal ?? AbortSignal.timeout(READ_TIMEOUT_MS),
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
  if (options.rewardMin) params.set("minReward", usdcToBaseUnits(options.rewardMin));
  if (options.rewardMax) params.set("maxReward", usdcToBaseUnits(options.rewardMax));
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
