/**
 * OpenRouter <-> MCP bridge (`aibtc-mcp-server bridge`).
 *
 * Lets any OpenRouter model call this server's tools. This is the canonical
 * integration described in OpenRouter's own cookbook
 * (https://openrouter.ai/docs/cookbook/coding-agents/mcp-servers): the CLIENT
 * connects to the MCP server and routes LLM calls through OpenRouter — there is
 * no OpenRouter-side MCP hosting. This is a Node port of that pattern with two
 * upgrades: it handles every tool_call (not just the first) and loops to
 * completion (not a single round).
 *
 * Flow:
 *   1. Spawn this same binary in server mode over stdio, connect, list tools.
 *   2. Apply safety filters, then convert each MCP tool -> OpenAI function tool.
 *   3. POST conversation + tools to OpenRouter /chat/completions.
 *   4. On tool_calls, execute via MCP and feed results back as role:"tool".
 *   5. Loop until the model answers in plain text (capped by --max-turns).
 *
 * Safety flags:
 *   --read-only            expose only read-only tools (heuristic allowlist)
 *   --allow a,b,c          force-allow these tool names (added to the set)
 *   --block a,b,c          force-remove these tool names (applied last, wins)
 *   --max-spend-ustx <n>   forward to the server's SPEND_LIMIT_SESSION_USTX rail
 *   --max-spend-sats <n>   forward to the server's SPEND_LIMIT_SESSION_SATS rail
 *   --list-tools           print the exposed tool set and exit (no API key needed)
 *   --model <id>           OpenRouter model (default anthropic/claude-3.5-haiku)
 *   --network <net>        mainnet|testnet for the spawned server (default mainnet)
 *   --max-turns <n>        tool-call loop cap (default 10)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-3.5-haiku";

interface BridgeOptions {
  prompt: string;
  model: string;
  network: string;
  readOnly: boolean;
  allow: Set<string>;
  block: Set<string>;
  maxSpendUstx?: string;
  maxSpendSats?: string;
  maxTurns: number;
  listTools: boolean;
}

/**
 * Read-only heuristic. A tool counts as read-only only if it matches a known
 * read pattern AND contains no mutating verb — deliberately conservative so a
 * spend/write tool is never auto-included. Use --allow/--block for precision.
 */
const READ_PATTERNS: RegExp[] = [
  /^get_/, /^list_/, /^check_/, /^lookup_/, /^reverse_/, /^probe_/, /^read_/,
  /_status$/, /_info$/, /_quote$/, /_quote_/, /_models$/, /_guide$/, /_list$/,
  /_balance$/, /_fees$/, /_utxos$/, /_history$/, /_holdings$/, /_overview$/,
  /_summary$/, /_health$/, /_price$/, /_prices$/, /_state$/, /_positions$/,
  /_breakdown$/, /_dashboard_/, /_stats$/, /_metadata$/, /_owner$/, /_holders$/,
  /_search$/, /_feed$/, /_profile$/, /_pubkey$/, /_availability$/, /_count$/,
];
const WRITE_VERB =
  /(transfer|send|swap|deploy|broadcast|buy|sell|pay|supply|withdraw|borrow|repay|create|delete|register|claim|deposit|stack|boost|unwind|invite|set_|sign|submit|enroll|opt_|file_|preorder|mint|inscribe|approve|revoke|connect|disconnect|rotate|export|import|unlock|lock|start|stop|join|settle|redeem|fund|accept|cancel|counter|append|give|add_|deactivate|record|compile|configure|heal|fill_gap|recover|rebalance|hunter|enable)/;

function isReadOnly(name: string): boolean {
  if (WRITE_VERB.test(name)) return false;
  return READ_PATTERNS.some((p) => p.test(name));
}

/** MCP tool -> OpenRouter (OpenAI) function-tool schema (verbatim JSON Schema). */
function toOpenAITool(tool: { name: string; description?: string; inputSchema?: unknown }) {
  // Clone so we never mutate the tool descriptor handed back by the MCP SDK.
  const raw = (tool.inputSchema as Record<string, unknown>) ?? {};
  const schema: Record<string, unknown> = { type: "object", properties: {}, ...raw };
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: schema,
    },
  };
}

function parseArgs(argv: string[]): BridgeOptions {
  const opts: BridgeOptions = {
    prompt: "",
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    network: process.env.NETWORK || "mainnet",
    readOnly: false,
    allow: new Set(),
    block: new Set(),
    maxTurns: 10,
    listTools: false,
  };
  const promptWords: string[] = [];
  const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // Value-taking flags must be followed by a value — otherwise the next loop
    // iteration would silently consume the following flag (or leave the option
    // unset, which for a spend cap means the rail is quietly disabled).
    const value = (flag: string): string => {
      const v = argv[++i];
      if (v === undefined || v.startsWith("--")) {
        console.error(`Missing value for ${flag}`);
        process.exit(1);
      }
      return v;
    };
    switch (a) {
      case "--read-only": opts.readOnly = true; break;
      case "--list-tools": opts.listTools = true; break;
      case "--model": opts.model = value(a); break;
      case "--network": opts.network = value(a); break;
      case "--allow": csv(value(a)).forEach((t) => opts.allow.add(t)); break;
      case "--block": csv(value(a)).forEach((t) => opts.block.add(t)); break;
      case "--max-spend-ustx": opts.maxSpendUstx = value(a); break;
      case "--max-spend-sats": opts.maxSpendSats = value(a); break;
      case "--max-turns": {
        const raw = value(a);
        const n = parseInt(raw, 10);
        if (!Number.isInteger(n) || n < 1) {
          console.error(`--max-turns must be a positive integer (got "${raw}")`);
          process.exit(1);
        }
        opts.maxTurns = n;
        break;
      }
      default:
        if (a.startsWith("--")) {
          console.error(`Unknown flag: ${a}`);
          process.exit(1);
        }
        promptWords.push(a);
    }
  }
  opts.prompt = promptWords.join(" ").trim();
  return opts;
}

/** Apply read-only + allow + block to the raw MCP tool list. */
function selectTools<T extends { name: string }>(tools: T[], opts: BridgeOptions): T[] {
  return tools.filter((t) => {
    if (opts.block.has(t.name)) return false;
    if (opts.allow.has(t.name)) return true;
    if (opts.readOnly) return isReadOnly(t.name);
    return true;
  });
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: unknown[],
  tools: unknown[]
): Promise<{ role: string; content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/aibtcdev/aibtc-mcp",
      "X-Title": "aibtc-mcp bridge",
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
  });
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }
  // OpenRouter can return HTTP 200 with an error payload (rate limit, moderation,
  // provider failure) and no choices — surface it instead of crashing on [0].
  const data = (await res.json()) as { choices?: { message: any }[]; error?: { message?: string } };
  const message = data.choices?.[0]?.message;
  if (!message) {
    const detail = data.error?.message ?? JSON.stringify(data);
    throw new Error(`OpenRouter returned no message: ${detail}`);
  }
  return message;
}

export async function runBridge(argv: string[]): Promise<void> {
  const opts = parseArgs(argv);

  // Spawn this same binary in plain server mode (no extra args -> MCP server).
  const serverEnv: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NETWORK: opts.network,
  };
  if (opts.maxSpendUstx) serverEnv.SPEND_LIMIT_SESSION_USTX = opts.maxSpendUstx;
  if (opts.maxSpendSats) serverEnv.SPEND_LIMIT_SESSION_SATS = opts.maxSpendSats;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [process.argv[1]],
    env: serverEnv,
  });
  const client = new Client({ name: "aibtc-openrouter-bridge", version: "1.0.0" });
  await client.connect(transport);

  const { tools: allTools } = await client.listTools();
  const exposed = selectTools(allTools, opts);

  if (opts.listTools) {
    console.log(`Exposed ${exposed.length}/${allTools.length} tools` +
      (opts.readOnly ? " (read-only)" : "") + ":");
    for (const t of exposed) console.log(`  ${t.name}`);
    await client.close();
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("Set OPENROUTER_API_KEY (or use --list-tools to preview without a model).");
    await client.close();
    process.exit(1);
  }
  if (!opts.prompt) {
    console.error('Provide a prompt, e.g. aibtc-mcp-server bridge "what is the STX balance of SP3..."');
    await client.close();
    process.exit(1);
  }

  const writeCount = exposed.filter((t) => !isReadOnly(t.name)).length;
  console.error(
    `Bridge: ${exposed.length} tools -> ${opts.model}` +
      (opts.readOnly ? " [read-only]" : ` [${writeCount} can write/spend]`) +
      (opts.maxSpendUstx || opts.maxSpendSats
        ? ` (cap ${opts.maxSpendUstx ?? "-"} uSTX / ${opts.maxSpendSats ?? "-"} sats)`
        : "")
  );

  const openaiTools = exposed.map(toOpenAITool);
  const messages: any[] = [
    {
      role: "system",
      content:
        "You are an agent with access to aibtc-mcp tools for Stacks/Bitcoin and " +
        "x402 actions. Use tools when needed. Be concise.",
    },
    { role: "user", content: opts.prompt },
  ];

  try {
    let completed = false;
    for (let turn = 0; turn < opts.maxTurns; turn++) {
      const reply = await callOpenRouter(apiKey, opts.model, messages, openaiTools);
      messages.push(reply);

      const toolCalls = reply.tool_calls ?? [];
      if (toolCalls.length === 0) {
        console.log("\n" + (reply.content ?? ""));
        completed = true;
        break;
      }

      for (const call of toolCalls) {
        const name = call.function.name;
        // Enforce the allowlist at execution time too — never trust the model
        // to stay inside the exposed set.
        if (!exposed.some((t) => t.name === name)) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            name,
            content: `Tool ${name} is not permitted by the bridge.`,
          });
          continue;
        }
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* malformed JSON -> empty args */
        }
        console.error(`-> ${name}(${call.function.arguments || "{}"})`);

        let content: string;
        try {
          const result = await client.callTool({ name, arguments: args });
          content = ((result.content as any[]) ?? [])
            .map((c) => (c?.type === "text" ? c.text : JSON.stringify(c)))
            .join("\n");
        } catch (err) {
          content = `Tool error: ${(err as Error).message}`;
        }
        messages.push({ role: "tool", tool_call_id: call.id, name, content });
      }
    }

    // Don't let the cap swallow the session silently — the model was still
    // calling tools when we ran out of turns.
    if (!completed) {
      console.error(
        `Bridge: reached --max-turns limit (${opts.maxTurns}) without a final response. ` +
          "Re-run with a higher --max-turns to let it finish."
      );
    }
  } finally {
    await client.close();
  }
}
