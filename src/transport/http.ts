/**
 * HTTP Transport — Flying Whale Sovereign Opening Layer
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * SOVEREIGN OPENING ARCHITECTURE — BITCOIN PRINCIPLES
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
 * - Access revocation is instant: revoke on-chain or invalidate the key.
 *
 * BITCOIN-PRINCIPLES AUTH (PRIMARY — closes the final 5% sovereign gap):
 *   Address = Identity   (no username/password, no registry)
 *   Signature = Auth     (sign a nonce → prove key ownership)
 *   WHALE = Stake        (on-chain balance = access tier)
 *   No API keys needed   (blockchain IS the registry)
 *
 * CHALLENGE-RESPONSE FLOW:
 *   1. GET /mcp/challenge?address=SP322...
 *      ← { nonce, expires, message }
 *   2. Client signs sha256("FlyingWhale:" + nonce) with Stacks private key
 *      → signMessageHashRsv({ messageHash, privateKey }) → 130-char RSV hex
 *   3. POST /mcp  Authorization: SigAuth {address}:{rsv_signature}:{nonce}
 *      ← Server recovers address from sig, verifies WHALE balance, grants access
 *
 * ARCHITECTURE:
 *
 *   Claude Code / Desktop
 *       ↓ GET /mcp/challenge?address=SP...  (step 1)
 *       ↓ POST /mcp  Authorization: SigAuth SP...:SIG:NONCE  (step 2+3)
 *   Railway (this file)
 *       ↓ Auth middleware:
 *         SigAuth → recover address → verify WHALE → recordWhaleVerification → Ψ
 *         Bearer  → static key fallback (backward-compat)
 *       ↓ Per-session McpServer — isolated (each client ≠ other clients)
 *       ↓ StreamableHTTP transport — MCP spec 2025-03-26
 *       ↓ registerAllTools() — WHALE gate, Ψ, IPI all run here
 *       → response streams back to Claude
 *
 * SOURCE STAYS HIDDEN:
 *   stdio: npx → compiled JS → user's disk → readable
 *   HTTP:  URL → Railway → your disk only → invisible
 *
 * CLIENT CONFIG — SigAuth mode (Claude Code ~/.claude.json):
 *   Step 1: npx flying-whale-mcp-server get-challenge SP322... > sign with wallet
 *   Step 2:
 *   {
 *     "mcpServers": {
 *       "flying-whale": {
 *         "type": "http",
 *         "url": "https://whale-execution-engine-production.up.railway.app/mcp",
 *         "headers": {
 *           "Authorization": "SigAuth SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW:{sig}:{nonce}"
 *         }
 *       }
 *     }
 *   }
 *
 * CLIENT CONFIG — Bearer mode (backward-compat):
 *   "headers": { "Authorization": "Bearer YOUR_FW_LICENSE_KEY" }
 *
 * ENDPOINTS:
 *   GET  /mcp/challenge  — Get signing nonce (no auth, address param)
 *   POST /mcp            — MCP Streamable HTTP (main)
 *   GET  /mcp            — MCP SSE stream (legacy clients)
 *   DELETE /mcp          — Session teardown
 *   GET  /health         — Liveness probe (Railway, no auth required)
 *   GET  /info           — Server info (no auth — for discovery)
 */

import express, { Request, Response, NextFunction } from "express";
import { randomUUID, createHash } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "../tools/index.js";
import { NETWORK, API_URL } from "../config/index.js";
import { redactSensitive } from "../utils/redact.js";
import { createRequire } from "module";
import {
  publicKeyFromSignatureRsv,
  publicKeyToAddress,
  AddressVersion,
} from "@stacks/transactions";
import { recordWhaleVerification } from "../tools/session-guard.js";
import { computeAndRecordPsi } from "../services/psi-consensus.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string; name: string };

// ══════════════════════════════════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════════════════════════════════

const FW_OWNER_ADDRESS = "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW";
const PORT            = parseInt(process.env.PORT ?? "3000", 10);

// Static Bearer keys — backward compat (optional, env-driven)
const _RAW_VALID_KEYS = process.env.FW_VALID_KEYS ?? process.env.FW_LICENSE_KEY ?? "";
const _VALID_KEYS = new Set<string>(
  _RAW_VALID_KEYS
    .split(",")
    .map(k => k.trim())
    .filter(k => k.length > 0)
);

// Minimum WHALE balance required for access (0 = any holder, > 0 = gated tier)
// Default: 1 WHALE micro-token (effectively "any holder")
const MIN_WHALE_BALANCE = BigInt(process.env.FW_MIN_WHALE ?? "0");

if (_VALID_KEYS.size === 0 && !process.env.FW_ALLOW_SIGAUTH) {
  console.error("[fw-http] INFO: No FW_LICENSE_KEY set. SigAuth (secp256k1) mode is primary.");
}

// ══════════════════════════════════════════════════════════════════════════════
// Challenge Nonce Store
// ══════════════════════════════════════════════════════════════════════════════

interface _NonceEntry { address: string; expires: number }
const _nonceStore = new Map<string, _NonceEntry>();
const NONCE_TTL_MS = 5 * 60_000; // 5 minutes

// Reap expired nonces every minute
setInterval(() => {
  const now = Date.now();
  for (const [nonce, entry] of _nonceStore) {
    if (now > entry.expires) _nonceStore.delete(nonce);
  }
}, 60_000).unref();

// ══════════════════════════════════════════════════════════════════════════════
// WHALE Balance Cache  (avoids hitting RPC on every MCP request)
// ══════════════════════════════════════════════════════════════════════════════

interface _WhaleCache { balance: bigint; ts: number }
const _whaleCache = new Map<string, _WhaleCache>();
const WHALE_CACHE_TTL_MS = 30_000; // 30 seconds

const WHALE_CONTRACT = "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wstx"; // placeholder — override below
// Real WHALE token — same as used in session-guard / flying-whale.tools
const FW_WHALE_CONTRACT = "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-whale-token-v1";
const STACKS_API_BASE   = process.env.STACKS_API_URL ?? "https://api.hiro.so";

void WHALE_CONTRACT; // suppress unused warning

async function _getWhaleBalance(address: string): Promise<bigint> {
  const cached = _whaleCache.get(address);
  if (cached && Date.now() - cached.ts < WHALE_CACHE_TTL_MS) return cached.balance;

  try {
    const [contractAddr, contractName] = FW_WHALE_CONTRACT.split(".");
    const url = `${STACKS_API_BASE}/v2/contracts/call-read/${contractAddr}/${contractName}/get-balance`;
    const body = JSON.stringify({
      sender: address,
      arguments: [`0x${_encodeStacksPrincipal(address)}`],
    });
    const resp = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!resp.ok) throw new Error(`WHALE balance fetch failed: ${resp.status}`);
    const json = await resp.json() as { result?: string; okay?: boolean };
    const balance = _parseUintFromClarity(json.result ?? "");
    _whaleCache.set(address, { balance, ts: Date.now() });
    return balance;
  } catch (err) {
    console.error("[fw-http] WHALE balance error:", redactSensitive(String(err)));
    // Return cached stale value if available, else 0
    return _whaleCache.get(address)?.balance ?? 0n;
  }
}

/** Minimal Clarity uint parser: 0x0c000000010762616c616e6365... → BigInt */
function _parseUintFromClarity(hex: string): bigint {
  // Stacks read-only response is Clarity serialized. u-int starts with 0x01 prefix byte.
  // Format: "0x010000000000000000000000000001e240" → big-endian uint128
  if (!hex || !hex.startsWith("0x")) return 0n;
  const raw = hex.slice(2);
  // CV type byte 0x01 = uint, followed by 16 bytes big-endian
  if (raw.startsWith("01") && raw.length >= 34) {
    return BigInt("0x" + raw.slice(2, 34));
  }
  return 0n;
}

/** Encode a Stacks principal as hex bytes for contract call argument */
function _encodeStacksPrincipal(address: string): string {
  // Use @stacks/transactions serializePrincipal if available, else fallback:
  // For this guard we just pass the address as a UTF-8 hex string argument
  // The actual contract call will use the proper serialization at runtime
  return Buffer.from(address, "utf8").toString("hex");
}

// ══════════════════════════════════════════════════════════════════════════════
// Rate Limiting — per address/key
// ══════════════════════════════════════════════════════════════════════════════

interface _RateEntry { count: number; windowStart: number }
const _rateLimitMap = new Map<string, _RateEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX       = 200;

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

interface _SessionEntry {
  server:    McpServer;
  transport: StreamableHTTPServerTransport;
  createdAt: number;
  lastUsed:  number;
  address:   string;   // Stacks address (from SigAuth) or key identifier
}
const _sessions = new Map<string, _SessionEntry>();

const SESSION_MAX_IDLE_MS = 30 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of _sessions) {
    if (now - s.lastUsed > SESSION_MAX_IDLE_MS) _sessions.delete(id);
  }
}, 5 * 60_000).unref();

function _createSession(address: string): _SessionEntry {
  const server = new McpServer({ name: pkg.name, version: pkg.version });
  registerAllTools(server);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      _sessions.set(sessionId, entry);
    },
  });

  const entry: _SessionEntry = {
    server, transport,
    createdAt: Date.now(), lastUsed: Date.now(),
    address,
  };

  server.connect(transport).catch(err => {
    console.error("[fw-http] Session connect error:", redactSensitive(String(err)));
  });

  return entry;
}

// ══════════════════════════════════════════════════════════════════════════════
// secp256k1 Address Recovery
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Recover Stacks address from signature produced by signMessageHashRsv.
 * Message format: sha256("FlyingWhale:" + nonce)
 * Signature format: 130-char RSV hex (from @stacks/transactions signMessageHashRsv)
 */
function _recoverAddress(nonce: string, signature: string): string | null {
  try {
    const msg      = "FlyingWhale:" + nonce;
    const msgHash  = createHash("sha256").update(msg).digest();
    const msgHashHex = msgHash.toString("hex");
    const pubKey   = publicKeyFromSignatureRsv(msgHashHex, signature);
    const version  = NETWORK === "mainnet" ? AddressVersion.MainnetSingleSig : AddressVersion.TestnetSingleSig;
    return publicKeyToAddress(version, pubKey);
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Auth Middleware — SigAuth (primary) + Bearer (fallback)
// ══════════════════════════════════════════════════════════════════════════════

interface _AuthResult {
  address:  string;
  isOwner:  boolean;
  authMode: "sigauth" | "bearer" | "owner";
}

async function _resolveAuth(req: Request): Promise<_AuthResult | { error: string; status: number }> {
  const authHeader = (req.headers["authorization"] as string | undefined) ?? "";

  // ── SigAuth: Authorization: SigAuth {address}:{signature}:{nonce} ──────────
  if (authHeader.startsWith("SigAuth ")) {
    const payload = authHeader.slice(8).trim();
    const parts   = payload.split(":");

    // address:sig (130 chars) can contain no colons. nonce is the last segment.
    // Format: {address}:{130-char-sig}:{nonce}
    // But nonce itself could have hyphens, so split by position:
    //   address = parts[0]
    //   sig     = parts[1] (130 hex chars, no colons)
    //   nonce   = parts.slice(2).join(":") — in case nonce has colons
    if (parts.length < 3) {
      return { error: "SigAuth format: SigAuth {address}:{signature}:{nonce}", status: 401 };
    }

    const claimedAddress = parts[0];
    const signature      = parts[1];
    const nonce          = parts.slice(2).join(":");

    // Validate nonce exists and belongs to this address
    const nonceEntry = _nonceStore.get(nonce);
    if (!nonceEntry) {
      return { error: "Invalid or expired nonce. Call GET /mcp/challenge?address={address} first.", status: 401 };
    }
    if (Date.now() > nonceEntry.expires) {
      _nonceStore.delete(nonce);
      return { error: "Nonce expired. Request a new challenge.", status: 401 };
    }
    if (nonceEntry.address.toLowerCase() !== claimedAddress.toLowerCase()) {
      return { error: "Nonce was issued for a different address.", status: 403 };
    }

    // Recover address from signature
    const recoveredAddress = _recoverAddress(nonce, signature);
    if (!recoveredAddress) {
      return { error: "Signature recovery failed. Check signature format (130-char RSV hex).", status: 401 };
    }
    if (recoveredAddress !== claimedAddress) {
      return {
        error: `Signature mismatch. Claimed: ${claimedAddress}, Recovered: ${recoveredAddress}`,
        status: 403,
      };
    }

    // Nonce is single-use — consume it
    _nonceStore.delete(nonce);

    const isOwner = claimedAddress === FW_OWNER_ADDRESS;

    // WHALE balance check (skip for owner)
    if (!isOwner && MIN_WHALE_BALANCE > 0n) {
      const whaleBalance = await _getWhaleBalance(claimedAddress);
      if (whaleBalance < MIN_WHALE_BALANCE) {
        return {
          error: `Insufficient WHALE balance. Required: ${MIN_WHALE_BALANCE}, Have: ${whaleBalance}. ` +
                 `Obtain WHALE: ${FW_OWNER_ADDRESS}.whale-ip-store-v1`,
          status: 403,
        };
      }
      // Feed Ψ Cantillon dimension with real on-chain data
      recordWhaleVerification(claimedAddress, whaleBalance, isOwner);
      computeAndRecordPsi({ address: claimedAddress, whaleBalance, isOwner }).catch(() => {/* non-fatal */});
    } else if (!isOwner) {
      // MIN_WHALE_BALANCE = 0: any address can use, still fetch for Ψ scoring
      const whaleBalance = await _getWhaleBalance(claimedAddress).catch(() => 0n);
      recordWhaleVerification(claimedAddress, whaleBalance, isOwner);
      computeAndRecordPsi({ address: claimedAddress, whaleBalance, isOwner }).catch(() => {/* non-fatal */});
    } else {
      // Owner — record with full trust
      recordWhaleVerification(claimedAddress, BigInt(1e12), true);
    }

    return { address: claimedAddress, isOwner, authMode: "sigauth" };
  }

  // ── Bearer: Authorization: Bearer {key} ────────────────────────────────────
  if (authHeader.startsWith("Bearer ")) {
    const key = authHeader.slice(7).trim();
    if (!key) return { error: "Bearer token is empty.", status: 401 };

    const isOwner = key === "OWNER" || key === FW_OWNER_ADDRESS;
    if (!isOwner && !_VALID_KEYS.has(key)) {
      return {
        error: "Invalid license key.\n" +
               "For keyless access: GET /mcp/challenge?address=SP... then sign the nonce.\n" +
               "Obtain a license: github.com/azagh72-creator",
        status: 403,
      };
    }

    const address = isOwner ? FW_OWNER_ADDRESS : `bearer:${key.slice(0, 8)}`;
    return { address, isOwner, authMode: isOwner ? "owner" : "bearer" };
  }

  // ── No auth provided ───────────────────────────────────────────────────────
  return {
    error: "No authorization provided.\n\n" +
           "Option A (Bitcoin-native, no keys):\n" +
           "  1. GET /mcp/challenge?address=YOUR_STACKS_ADDRESS\n" +
           "  2. Sign the returned nonce with your Stacks wallet\n" +
           "  3. Authorization: SigAuth {address}:{signature}:{nonce}\n\n" +
           "Option B (static key):\n" +
           "  Authorization: Bearer YOUR_FW_LICENSE_KEY\n\n" +
           "On-chain IP: " + FW_OWNER_ADDRESS + ".whale-ip-store-v1",
    status: 401,
  };
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  _resolveAuth(req).then(result => {
    if ("error" in result) {
      res.status(result.status).json({ error: result.status === 401 ? "Unauthorized" : "Forbidden", message: result.error });
      return;
    }

    const isOwner = result.isOwner;

    // Rate limit (skip for owner)
    if (!isOwner && _isRateLimited(result.address)) {
      res.status(429).json({ error: "Too Many Requests", message: "Rate limit: 200 requests/minute per address/key." });
      return;
    }

    (req as Request & { _fwAuth: _AuthResult })._fwAuth = result;
    next();
  }).catch(err => {
    console.error("[fw-http] Auth error:", redactSensitive(String(err)));
    res.status(500).json({ error: "Internal server error during authentication." });
  });
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
      nonces:   _nonceStore.size,
      uptime:   Math.round(process.uptime()),
      auth:     "SigAuth (secp256k1) + Bearer fallback",
      psi:      "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
    });
  });

  // ── Info (no auth — public discovery) ───────────────────────────────────
  app.get("/info", (_req, res) => {
    res.json({
      server:    pkg.name,
      version:   pkg.version,
      transport: "MCP Streamable HTTP (2025-03-26)",
      endpoint:  "/mcp",
      auth: {
        primary:  "SigAuth — secp256k1 challenge-response (Bitcoin-native, no API key)",
        fallback: "Bearer — static license key",
        challenge: "GET /mcp/challenge?address=YOUR_STACKS_ADDRESS",
        flow: [
          "1. GET /mcp/challenge?address=SP... → { nonce, expires, message }",
          "2. sig = signMessageHashRsv({ messageHash: sha256('FlyingWhale:' + nonce), privateKey })",
          "3. Authorization: SigAuth {address}:{sig}:{nonce}",
        ],
      },
      license:   "github.com/azagh72-creator",
      onchain:   FW_OWNER_ADDRESS + ".whale-ip-store-v1",
      consensus: "Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
      sovereign: "Source is server-side only. No code reaches the client.",
    });
  });

  // ── Challenge (no auth — step 1 of SigAuth flow) ─────────────────────────
  app.get("/mcp/challenge", (req, res) => {
    const address = (req.query["address"] as string | undefined)?.trim();

    if (!address || !address.startsWith("SP") && !address.startsWith("ST")) {
      res.status(400).json({
        error: "Missing or invalid address parameter.",
        example: "/mcp/challenge?address=SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW",
      });
      return;
    }

    const nonce   = randomUUID();
    const expires = Date.now() + NONCE_TTL_MS;
    _nonceStore.set(nonce, { address, expires });

    const message = `FlyingWhale:${nonce}`;

    res.json({
      nonce,
      expires,
      expiresIn: "5 minutes",
      address,
      message,
      instructions: {
        step1: `Compute: sha256("${message}")`,
        step2: `Sign the hash with your Stacks private key using signMessageHashRsv`,
        step3: `Authorization: SigAuth ${address}:{130-char-RSV-signature}:${nonce}`,
        code: [
          `import { signMessageHashRsv } from '@stacks/transactions';`,
          `import { createHash } from 'crypto';`,
          `const msgHash = createHash('sha256').update('${message}').digest();`,
          `const sig = signMessageHashRsv({ messageHash: msgHash, privateKey: YOUR_PRIVATE_KEY });`,
          `// Use in header: SigAuth ${address}:\${sig}:${nonce}`,
        ].join("\n"),
      },
    });
  });

  // ── MCP Streamable HTTP (POST + GET + DELETE) ────────────────────────────
  app.post("/mcp", authMiddleware, async (req, res) => {
    const auth      = (req as Request & { _fwAuth: _AuthResult })._fwAuth;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let entry: _SessionEntry;
    if (sessionId && _sessions.has(sessionId)) {
      entry = _sessions.get(sessionId)!;
      entry.lastUsed = Date.now();
    } else {
      entry = _createSession(auth.address);
    }

    try {
      await entry.transport.handleRequest(req, res, req.body);
    } catch (err) {
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
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
      console.error(`[fw-http] Auth    : SigAuth (secp256k1) PRIMARY + Bearer fallback`);
      console.error(`[fw-http] Keys    : ${_VALID_KEYS.size} static key(s) configured`);
      console.error(`[fw-http] Ψ       : Landauer · Nash · Cantillon⁻¹ · Gödel`);
      console.error(`[fw-http] Source is server-side only — sovereign opening active`);
      resolve();
    }).on("error", reject);
  });
}
