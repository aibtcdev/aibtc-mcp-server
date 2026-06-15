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
  const schema =
    (tool.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} };
  if (!schema.type) schema.type = "object";
  if (!schema.properties) schema.properties = {};
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
    switch (a) {
      case "--read-only": opts.readOnly = true; break;
      case "--list-tools": opts.listTools = true; break;
      case "--model": opts.model = argv[++i]; break;
      case "--network": opts.network = argv[++i]; break;
      case "--allow": csv(argv[++i] ?? "").forEach((t) => opts.allow.add(t)); break;
      case "--block": csv(argv[++i] ?? "").forEach((t) => opts.block.add(t)); break;
      case "--max-spend-ustx": opts.maxSpendUstx = argv[++i]; break;
      case "--max-spend-sats": opts.maxSpendSats = argv[++i]; break;
      case "--max-turns": opts.maxTurns = parseInt(argv[++i], 10) || 10; break;
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
): Promise<{ content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }> {
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
  const data = (await res.json()) as { choices: { message: any }[] };
  return data.choices[0].message;
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

  for (let turn = 0; turn < opts.maxTurns; turn++) {
    const reply = await callOpenRouter(apiKey, opts.model, messages, openaiTools);
    messages.push(reply);

    const toolCalls = reply.tool_calls ?? [];
    if (toolCalls.length === 0) {
      console.log("\n" + (reply.content ?? ""));
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

  await client.close();
}
