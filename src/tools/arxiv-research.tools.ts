/**
 * arXiv Research MCP tools
 *
 * Fetch and score arXiv papers on LLMs, autonomous agents, and AI infrastructure.
 * Uses the public arXiv Atom API — no API key required.
 *
 * Tools:
 * - arxiv_search          — Fetch recent papers from arXiv, score for LLM/agent relevance
 * - arxiv_compile_digest  — Compile a Markdown digest from recent arXiv papers (in-memory)
 * - arxiv_list_digests    — List recent digest files from ~/.aibtc/arxiv-research/digests/
 *
 * Mirrors the arxiv-research skill (aibtcdev/skills/arxiv-research/).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";

// ============================================================================
// Constants
// ============================================================================

const ARXIV_API = "http://export.arxiv.org/api/query";
const DEFAULT_CATEGORIES = ["cs.AI", "cs.CL", "cs.LG", "cs.MA"];
const DEFAULT_MAX = 50;
const DEFAULT_MIN_SCORE = 3;
const STATE_DIR = join(process.env.HOME ?? "~", ".aibtc", "arxiv-research");
const DIGESTS_DIR = join(STATE_DIR, "digests");

// ============================================================================
// Types
// ============================================================================

interface ArxivPaper {
  arxiv_id: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  primary_category: string;
  published: string;
  updated: string;
  pdf_url: string;
  abs_url: string;
}

interface ScoredPaper extends ArxivPaper {
  relevance_score: number;
  relevance_tags: string[];
}

// ============================================================================
// XML Parsing Helpers
// ============================================================================

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function extractAllTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1].replace(/\s+/g, " ").trim());
  }
  return results;
}

function extractAttr(xml: string, tag: string, attr: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*?${attr}="([^"]*)"`, "g");
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function parseArxivResponse(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];

    const rawId = extractTag(block, "id");
    const arxivId = rawId
      .replace("http://arxiv.org/abs/", "")
      .replace(/v\d+$/, "");
    const title = extractTag(block, "title");
    const abstract = extractTag(block, "summary");
    const published = extractTag(block, "published");
    const updated = extractTag(block, "updated");

    const authorBlocks = extractAllTags(block, "author");
    const authors = authorBlocks
      .map((a) => extractTag(a, "name"))
      .filter(Boolean);

    const categories = extractAttr(block, "category", "term");
    const primaryCat =
      block.match(/arxiv:primary_category[^>]*term="([^"]*)"/)?.[1] ??
      categories[0] ??
      "";

    const pdfMatch = block.match(/<link[^>]*title="pdf"[^>]*href="([^"]*)"/);
    const pdfUrl = pdfMatch
      ? pdfMatch[1]
      : `https://arxiv.org/pdf/${arxivId}`;
    const absUrl = `https://arxiv.org/abs/${arxivId}`;

    if (arxivId && title) {
      papers.push({
        arxiv_id: arxivId,
        title,
        authors,
        abstract,
        categories,
        primary_category: primaryCat,
        published,
        updated,
        pdf_url: pdfUrl,
        abs_url: absUrl,
      });
    }
  }

  return papers;
}

// ============================================================================
// Relevance Scoring
// ============================================================================

const RELEVANCE_SIGNALS: Array<{
  pattern: RegExp;
  weight: number;
  tag: string;
}> = [
  { pattern: /\blarge language model/i, weight: 3, tag: "LLM" },
  { pattern: /\bLLM\b/, weight: 3, tag: "LLM" },
  { pattern: /\bGPT[-\s]?[34o]/i, weight: 2, tag: "LLM" },
  { pattern: /\bClaude\b/i, weight: 2, tag: "LLM" },
  { pattern: /\btransformer/i, weight: 1, tag: "transformer" },
  { pattern: /\bautonomous agent/i, weight: 4, tag: "agent" },
  { pattern: /\bAI agent/i, weight: 4, tag: "agent" },
  { pattern: /\bagent[-\s]?based/i, weight: 3, tag: "agent" },
  { pattern: /\bmulti[-\s]?agent/i, weight: 4, tag: "multi-agent" },
  { pattern: /\btool[-\s]?use\b/i, weight: 3, tag: "tool-use" },
  { pattern: /\bfunction[-\s]?call/i, weight: 3, tag: "tool-use" },
  { pattern: /\bchain[-\s]?of[-\s]?thought/i, weight: 2, tag: "reasoning" },
  { pattern: /\breasoning\b/i, weight: 2, tag: "reasoning" },
  { pattern: /\bplanning\b/i, weight: 2, tag: "planning" },
  { pattern: /\bRL[HF]+\b/, weight: 2, tag: "alignment" },
  { pattern: /\balignment\b/i, weight: 2, tag: "alignment" },
  { pattern: /\bsafety\b/i, weight: 1, tag: "safety" },
  { pattern: /\bfine[-\s]?tun/i, weight: 2, tag: "fine-tuning" },
  { pattern: /\bprompt\b/i, weight: 1, tag: "prompting" },
  { pattern: /\bin[-\s]?context learning/i, weight: 2, tag: "ICL" },
  { pattern: /\bretrieval[-\s]?augmented/i, weight: 2, tag: "RAG" },
  { pattern: /\bRAG\b/, weight: 2, tag: "RAG" },
  { pattern: /\bcode[-\s]?gen/i, weight: 2, tag: "code-gen" },
  { pattern: /\bbenchmark/i, weight: 1, tag: "benchmark" },
  { pattern: /\bscaling\b/i, weight: 1, tag: "scaling" },
  { pattern: /\bmemory\b/i, weight: 1, tag: "memory" },
  { pattern: /\borchestrat/i, weight: 3, tag: "orchestration" },
  { pattern: /\bMCP\b/, weight: 3, tag: "MCP" },
  { pattern: /\bmodel context protocol/i, weight: 3, tag: "MCP" },
];

function scorePaper(paper: ArxivPaper): ScoredPaper {
  const text = `${paper.title} ${paper.abstract}`;
  let score = 0;
  const tags = new Set<string>();

  for (const signal of RELEVANCE_SIGNALS) {
    if (signal.pattern.test(text)) {
      score += signal.weight;
      tags.add(signal.tag);
    }
  }

  if (paper.primary_category === "cs.MA") score += 3;
  if (paper.primary_category === "cs.CL") score += 1;
  if (paper.primary_category === "cs.AI") score += 1;

  return { ...paper, relevance_score: score, relevance_tags: [...tags] };
}

// ============================================================================
// Fetch Helper
// ============================================================================

async function fetchAndScorePapers(
  categories: string[],
  maxResults: number
): Promise<ScoredPaper[]> {
  const catQuery = categories.map((c) => `cat:${c}`).join("+OR+");
  const url = `${ARXIV_API}?search_query=${catQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;

  const response = await fetch(url, {
    headers: { "User-Agent": "aibtcdev/aibtc-mcp-server" },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`arXiv API returned ${response.status}: ${response.statusText}`);
  }

  const xml = await response.text();
  const papers = parseArxivResponse(xml);

  if (papers.length === 0) {
    return [];
  }

  return papers
    .map(scorePaper)
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

// ============================================================================
// MCP Tools
// ============================================================================

export function registerArxivResearchTools(server: McpServer): void {
  // --------------------------------------------------------------------------
  // arxiv_search — Fetch and score arXiv papers
  // --------------------------------------------------------------------------
  server.registerTool(
    "arxiv_search",
    {
      description: `Fetch recent papers from arXiv and score them for LLM/agent relevance.

Queries the public arXiv Atom API (no API key required). Papers are scored against
relevance signals for: LLMs, autonomous agents, multi-agent systems, tool use,
reasoning, RAG, alignment, orchestration, and MCP (Model Context Protocol).

Default categories: cs.AI, cs.CL, cs.LG, cs.MA (configurable).
Category boosts: cs.MA +3, cs.CL +1, cs.AI +1.

Returns total paper count, relevant paper count, and top papers by score.
Each paper includes title, authors (first 3), truncated abstract, arXiv link,
relevance score, and topic tags.

Read-only. No API key required.`,
      inputSchema: {
        categories: z
          .string()
          .optional()
          .describe(
            "Comma-separated arXiv category codes. Default: cs.AI,cs.CL,cs.LG,cs.MA"
          ),
        max_results: z
          .number()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum papers to fetch. Default: 50, max: 200"),
        min_score: z
          .number()
          .min(0)
          .optional()
          .describe(
            "Minimum relevance score for results. Default: 3. Set to 0 to include all fetched papers."
          ),
      },
    },
    async ({ categories, max_results, min_score }) => {
      try {
        const cats = categories
          ? categories.split(",").map((c) => c.trim()).filter(Boolean)
          : DEFAULT_CATEGORIES;
        const maxResults = max_results ?? DEFAULT_MAX;
        const minScore = min_score ?? DEFAULT_MIN_SCORE;

        const scored = await fetchAndScorePapers(cats, maxResults);
        const relevant = scored.filter((p) => p.relevance_score >= minScore);

        return createJsonResponse({
          total: scored.length,
          relevant: relevant.length,
          categories: cats,
          min_score: minScore,
          top_papers: relevant.slice(0, 25).map((p) => ({
            id: p.arxiv_id,
            title: p.title,
            authors: p.authors.slice(0, 3),
            abstract:
              p.abstract.length > 300
                ? p.abstract.slice(0, 297) + "..."
                : p.abstract,
            score: p.relevance_score,
            tags: p.relevance_tags,
            published: p.published,
            abs_url: p.abs_url,
            pdf_url: p.pdf_url,
            primary_category: p.primary_category,
          })),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // arxiv_compile_digest — Compile a Markdown digest from recent arXiv papers
  // --------------------------------------------------------------------------
  server.registerTool(
    "arxiv_compile_digest",
    {
      description: `Compile a Markdown digest from recent arXiv papers on LLMs and autonomous agents.

Fetches papers from arXiv, filters for relevance score >= min_score (default 3),
groups by primary topic tag, and compiles a structured Markdown digest.

Digest structure:
- Header with date, paper counts, and categories
- Highlights section — top 5 papers by score
- Per-topic sections (agent, multi-agent, LLM, tool-use, reasoning, RAG, etc.)
- Stats table at the bottom

The compiled digest is returned inline as a Markdown string. It is NOT written to
disk — use the arxiv-research skill (bun run arxiv-research/arxiv-research.ts compile)
to write timestamped digest files to ~/.aibtc/arxiv-research/digests/.

Read-only. No API key required.`,
      inputSchema: {
        categories: z
          .string()
          .optional()
          .describe(
            "Comma-separated arXiv category codes. Default: cs.AI,cs.CL,cs.LG,cs.MA"
          ),
        max_results: z
          .number()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum papers to fetch. Default: 50"),
        date: z
          .string()
          .optional()
          .describe(
            "Date label for digest header (YYYY-MM-DD). Default: today's date"
          ),
        min_score: z
          .number()
          .min(0)
          .optional()
          .describe(
            "Minimum relevance score for digest inclusion. Default: 3"
          ),
      },
    },
    async ({ categories, max_results, date, min_score }) => {
      try {
        const cats = categories
          ? categories.split(",").map((c) => c.trim()).filter(Boolean)
          : DEFAULT_CATEGORIES;
        const maxResults = max_results ?? DEFAULT_MAX;
        const minScore = min_score ?? DEFAULT_MIN_SCORE;
        const dateStr = date ?? new Date().toISOString().split("T")[0];
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

        const scored = await fetchAndScorePapers(cats, maxResults);
        const relevant = scored.filter((p) => p.relevance_score >= minScore);

        if (relevant.length === 0) {
          return createJsonResponse({
            date: dateStr,
            total_papers: scored.length,
            relevant_papers: 0,
            topics: {},
            digest: `# arXiv Digest — ${dateStr}\n\nNo papers scored >= ${minScore}. Try fetching more or adjusting categories.\n`,
          });
        }

        // Group by primary topic tag
        const groups = new Map<string, ScoredPaper[]>();
        for (const paper of relevant) {
          const primaryTag = paper.relevance_tags[0] ?? "general";
          const group = groups.get(primaryTag) ?? [];
          group.push(paper);
          groups.set(primaryTag, group);
        }

        const lines: string[] = [
          `# arXiv Digest — ${dateStr}`,
          "",
          `**Generated:** ${timestamp}`,
          `**Papers reviewed:** ${scored.length}`,
          `**Relevant papers:** ${relevant.length}`,
          `**Categories:** ${cats.join(", ")}`,
          "",
          "---",
          "",
          "## Highlights",
          "",
        ];

        const topPapers = relevant.slice(0, 5);
        for (const paper of topPapers) {
          lines.push(
            `- **${paper.title}** (${paper.relevance_tags.join(", ")}) — score ${paper.relevance_score}`
          );
        }
        lines.push("", "---", "");

        const tagOrder = [
          "agent",
          "multi-agent",
          "LLM",
          "tool-use",
          "reasoning",
          "RAG",
          "alignment",
          "orchestration",
          "MCP",
        ];
        const sortedTags = [...groups.keys()].sort((a, b) => {
          const aIdx = tagOrder.indexOf(a);
          const bIdx = tagOrder.indexOf(b);
          return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
        });

        for (const tag of sortedTags) {
          const group = groups.get(tag)!;
          const tagLabel = tag.charAt(0).toUpperCase() + tag.slice(1);
          lines.push(`## ${tagLabel}`, "");

          for (const paper of group) {
            lines.push(
              `### ${paper.title}`,
              "",
              `- **arXiv:** [${paper.arxiv_id}](${paper.abs_url})`,
              `- **Authors:** ${paper.authors.slice(0, 5).join(", ")}${paper.authors.length > 5 ? " et al." : ""}`,
              `- **Published:** ${paper.published.split("T")[0]}`,
              `- **Categories:** ${paper.categories.join(", ")}`,
              `- **Relevance:** ${paper.relevance_score} (${paper.relevance_tags.join(", ")})`,
              "",
              `> ${paper.abstract.length > 500 ? paper.abstract.slice(0, 497) + "..." : paper.abstract}`,
              ""
            );
          }

          lines.push("---", "");
        }

        // Stats table
        const tagCounts = [...groups.entries()]
          .map(([tag, ps]) => `${tag}: ${ps.length}`)
          .join(", ");
        lines.push(
          "## Stats",
          "",
          "| Metric | Value |",
          "|--------|-------|",
          `| Total papers | ${scored.length} |`,
          `| Relevant (score >= ${minScore}) | ${relevant.length} |`,
          `| Categories | ${cats.join(", ")} |`,
          `| By topic | ${tagCounts} |`,
          "",
          "*Compiled by aibtcdev/aibtc-mcp-server arxiv_compile_digest*",
          ""
        );

        const topics = Object.fromEntries(
          [...groups.entries()].map(([k, v]) => [k, v.length])
        );

        return createJsonResponse({
          date: dateStr,
          total_papers: scored.length,
          relevant_papers: relevant.length,
          topics,
          digest: lines.join("\n"),
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // --------------------------------------------------------------------------
  // arxiv_list_digests — List recent digest files from ~/.aibtc/arxiv-research/digests/
  // --------------------------------------------------------------------------
  server.registerTool(
    "arxiv_list_digests",
    {
      description: `List recent arXiv digest files from ~/.aibtc/arxiv-research/digests/.

Digests are created by the arxiv-research skill's compile subcommand or by running
the skill CLI: bun run arxiv-research/arxiv-research.ts compile

Each digest is a timestamped Markdown file. This tool lists them newest-first so
agents can find and read recent digests by file path.

Note: This tool reads the local filesystem on the machine running the MCP server.
Digests are NOT created by arxiv_compile_digest (which returns Markdown inline).
Use the skill CLI to persist digests to disk.

Read-only.`,
      inputSchema: {
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum entries to show. Default: 10"),
      },
    },
    async ({ limit }) => {
      try {
        const maxEntries = limit ?? 10;

        if (!existsSync(DIGESTS_DIR)) {
          return createJsonResponse({
            digests: [],
            count: 0,
            digests_dir: DIGESTS_DIR,
            note: "No digests found. Run the arxiv-research skill to create them: bun run arxiv-research/arxiv-research.ts compile",
          });
        }

        const entries = readdirSync(DIGESTS_DIR)
          .filter((e) => e.endsWith("_arxiv_digest.md"))
          .sort()
          .reverse()
          .slice(0, maxEntries);

        const digests = entries.map((filename) => {
          const timestamp = filename.replace("_arxiv_digest.md", "");
          return {
            filename,
            timestamp,
            path: join(DIGESTS_DIR, filename),
          };
        });

        return createJsonResponse({
          digests,
          count: digests.length,
          digests_dir: DIGESTS_DIR,
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
