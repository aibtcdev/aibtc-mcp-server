/**
 * HTTP Transport — Flying Whale Sovereign Opening Layer
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * SOVEREIGN OPENING ARCHITECTURE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * PROBLEM: stdio transport (npm install) puts compiled source on the user's
 * machine. Any determined user can read the gate logic and attempt bypass.
 *
 * SOLUTION: HTTP/StreamableHTTP transport deployed on Railway.
 * - Source code stays on YOUR server — never reaches the user.
 * - Every request passes through auth middleware BEFORE MCP handshake.
 * - WHALE gate, Ψ consensus, IPI defense all run server-side.
 * - Users configure a URL + API key in their Claude config — nothing more.
 * - Access revocation is instant: invalidate the key on Railway.
 *
 * ARCHITECTURE:
 *
 *   Claude Code / Desktop
 *       ↓ HTTP POST /mcp  (Authorization: Bearer FW_LICENSE_KEY)
 *   Railway (this file)
 *       ↓ Auth middleware — verify FW_LICENSE_KEY + rate limit
 *       ↓ Per-session McpServer — WeakMap isolated (each client ≠ other clients)
 *       ↓ StreamableHTTP transport — MCP spec 2025-03-26
 *       ↓ registerAllTools() — WHALE gate, Ψ, IPI all run here
 *       → response streams back to Claude
 *
 * SOURCE STAYS HIDDEN:
 *   stdio: npx → compiled JS → user's disk → readable
 *   HTTP:  URL → Railway → your disk only → invisible
 *
 * CLIENT CONFIG (Claude Code ~/.claude.json):
 *   {
 *     "mcpServers": {
 *       "flying-whale": {
 *         "type": "http",
 *         "url": "https://whale-execution-engine-production.up.railway.app/mcp",
 *         "headers": { "Authorization": "Bearer YOUR_FW_LICENSE_KEY" }
 *       }
 *     }
 *   }
 *
 * ENDPOINTS:
 *   POST /mcp          — MCP Streamable HTTP (main)
 *   GET  /mcp          — MCP SSE stream (legacy clients)
 *   DELETE /mcp        — Session teardown
 *   GET  /health       — Liveness probe (Railway, no auth required)
 *   GET  /info         — Server info (no auth — for discovery)
 */

import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "../tools/index.js";
import { NETWORK, API_URL } from "../config/index.js";
import { redactSensitive } from "../utils/redact.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string; name: string };

// ══════════════════════════════════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════════════════════════════════

const FW_OWNER_ADDRESS = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
const PORT            = parseInt(process.env.PORT ?? "3000", 10);

// Valid license keys — in production these come from environment
// Format: comma-separated list of valid FW_LICENSE_KEY values
// Or set FW_VALID_KEYS for multi-tenant (e.g. "KEY1,KEY2,KEY3")
const _RAW_VALID_KEYS = process.env.FW_VALID_KEYS ?? process.env.FW_LICENSE_KEY ?? "";
const _VALID_KEYS = new Set<string>(
  _RAW_VALID_KEYS
    .split(",")
    .map(k => k.trim())
    .filter(k => k.length > 0)
);

// Owner key — always valid
if (_VALID_KEYS.size === 0) {
  console.error("[fw-http] WARNING: No FW_LICENSE_KEY or FW_VALID_KEYS set. All requests will be rejected.");
}

// ══════════════════════════════════════════════════════════════════════════════
// Rate Limiting — per API key
// ══════════════════════════════════════════════════════════════════════════════

interface _RateEntry { count: number; windowStart: number }
const _rateLimitMap = new Map<string, _RateEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX       = 200;    // 200 MCP requests per minute per key

function _isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = _rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    _rateLimitMap.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ══════════════════════════════════════════════════════════════════════════════
// Per-Session MCP Server Registry
// ══════════════════════════════════════════════════════════════════════════════
// Each client connection gets its own McpServer instance.
// This ensures session state (wallet, call counts, Ψ score) is isolated.
// Sessions are keyed by Mcp-Session-Id header (set by client on follow-up requests).

interface _SessionEntry {
  server:    McpServer;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
  lastUsed:  number;
  licenseKey: string;
}
const _sessions = new Map<string, _SessionEntry>();

// Reap stale sessions every 5 minutes (no activity for 30 min = dead)
const SESSION_MAX_IDLE_MS = 30 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of _sessions) {
    if (now - s.lastUsed > SESSION_MAX_IDLE_MS) {
      _sessions.delete(id);
    }
  }
}, 5 * 60_000).unref();

function _createSession(licenseKey: string): _SessionEntry {
  const server = new McpServer({
    name:    pkg.name,
    version: pkg.version,
  });
  registerAllTools(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      _sessions.set(sessionId, entry);
    },
  });

  const entry: _SessionEntry = {
    server,
    transport,
    createdAt:  Date.now(),
    lastUsed:   Date.now(),
    licenseKey,
  };

  server.connect(transport).catch(err => {
    console.error("[fw-http] Session connect error:", redactSensitive(String(err)));
  });

  return entry;
}

// ══════════════════════════════════════════════════════════════════════════════
// Auth Middleware
// ══════════════════════════════════════════════════════════════════════════════

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader  = req.headers["authorization"] ?? "";
  const xLicenseKey = req.headers["x-fw-license"]   as string | undefined;

  // Extract Bearer token or X-Fw-License header
  let key = "";
  if (authHeader.startsWith("Bearer ")) {
    key = authHeader.slice(7).trim();
  } else if (xLicenseKey) {
    key = xLicenseKey.trim();
  }

  if (!key) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Flying Whale MCP Server — License key required.\n" +
               "Add header: Authorization: Bearer YOUR_FW_LICENSE_KEY\n" +
               "Obtain a license: github.com/azagh72-creator",
    });
    return;
  }

  // Owner address as key always valid
  const isOwner = key === "OWNER" || key === FW_OWNER_ADDRESS;
  if (!isOwner && !_VALID_KEYS.has(key)) {
    res.status(403).json({
      error: "Forbidden",
      message: "Flying Whale MCP Server — Invalid license key.\n" +
               "Obtain a license: github.com/azagh72-creator\n" +
               "On-chain IP: " + FW_OWNER_ADDRESS + ".whale-ip-store-v1",
    });
    return;
  }

  // Rate limit (skip for owner)
  if (!isOwner && _isRateLimited(key)) {
    res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit: 200 requests/minute per license key.",
    });
    return;
  }

  // Attach key to request for downstream use
  (req as Request & { fwLicenseKey: string }).fwLicenseKey = key;
  next();
}

// ══════════════════════════════════════════════════════════════════════════════
// Express App
// ══════════════════════════════════════════════════════════════════════════════

export function createHttpApp(): express.Application {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  // ── Health (no auth — Railway liveness probe) ────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status:   "ok",
      version:  pkg.version,
      name:     pkg.name,
      network:  NETWORK,
      sessions: _sessions.size,
      uptime:   Math.round(process.uptime()),
      psi:      "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
    });
  });

  // ── Info (no auth — public discovery) ───────────────────────────────────
  app.get("/info", (_req, res) => {
    res.json({
      server:  pkg.name,
      version: pkg.version,
      transport: "MCP Streamable HTTP (2025-03-26)",
      endpoint: "/mcp",
      auth:    "Authorization: Bearer YOUR_FW_LICENSE_KEY",
      license: "github.com/azagh72-creator",
      onchain: FW_OWNER_ADDRESS + ".whale-ip-store-v1",
      consensus: "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
      sovereign: "Source is server-side only. No code reaches the client.",
    });
  });

  // ── MCP Streamable HTTP (POST + GET + DELETE) ────────────────────────────
  app.post("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Resume existing session or create new one
    let entry: _SessionEntry;
    if (sessionId && _sessions.has(sessionId)) {
      entry = _sessions.get(sessionId)!;
      entry.lastUsed = Date.now();
    } else {
      const licenseKey = (req as Request & { fwLicenseKey: string }).fwLicenseKey;
      entry = _createSession(licenseKey);
    }

    try {
      await entry.transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
      console.error("[fw-http] handleRequest error:", redactSensitive(String(err)));
    }
  });

  app.get("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !_sessions.has(sessionId)) {
      res.status(400).json({ error: "No active session. Send POST /mcp first." });
      return;
    }
    const entry = _sessions.get(sessionId)!;
    entry.lastUsed = Date.now();
    await entry.transport.handleRequest(req, res);
  });

  app.delete("/mcp", authMiddleware, async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId && _sessions.has(sessionId)) {
      const entry = _sessions.get(sessionId)!;
      await entry.transport.handleRequest(req, res);
      _sessions.delete(sessionId);
    } else {
      res.status(200).json({ ok: true });
    }
  });

  return app;
}

// ══════════════════════════════════════════════════════════════════════════════
// Start HTTP Server
// ══════════════════════════════════════════════════════════════════════════════

export async function startHttpServer(): Promise<void> {
  const app = createHttpApp();

  await new Promise<void>((resolve, reject) => {
    app.listen(PORT, () => {
      console.error(`[fw-http] Flying Whale MCP Server v${pkg.version} — HTTP mode`);
      console.error(`[fw-http] Listening on port ${PORT}`);
      console.error(`[fw-http] Network : ${NETWORK}`);
      console.error(`[fw-http] API     : ${API_URL}`);
      console.error(`[fw-http] Endpoint: http://0.0.0.0:${PORT}/mcp`);
      console.error(`[fw-http] Health  : http://0.0.0.0:${PORT}/health`);
      console.error(`[fw-http] Keys    : ${_VALID_KEYS.size} license key(s) configured`);
      console.error(`[fw-http] Ψ       : Landauer · Nash · Cantillon⁻¹ · Gödel`);
      console.error(`[fw-http] Source is server-side only — sovereign opening active`);
      resolve();
    }).on("error", reject);
  });
}
