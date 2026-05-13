/**
 * AIBTC Protocol — Dashboard Server
 *
 * HTTP server on port 4200 serving a full-screen real-time monitor.
 * WebSocket on port 4201 pushes state updates to the browser.
 *
 * Open http://localhost:4200 to see the dashboard.
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { getState, onStateChange, updateBitcoin } from "./state.js";
import { getBitcoinStatus as fetchBitcoin } from "../services/bitcoin-core-rpc.js";

// ── HTML Dashboard ────────────────────────────────────────────────────────────

function dashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AIBTC Protocol — SHA256 Monitor</title>
<style>
  :root {
    --btc:    #f7931a;
    --btc2:   #e8830e;
    --bg:     #060606;
    --panel:  #0c0c0c;
    --panel2: #111;
    --border: #1c1c1c;
    --text:   #d4d4d4;
    --dim:    #555;
    --green:  #22c55e;
    --red:    #ef4444;
    --blue:   #3b82f6;
    --mono:   'Courier New', 'Lucida Console', monospace;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--mono);
    font-size: 12px;
    height: 100vh;
    display: grid;
    grid-template-rows: 44px 1fr 36px;
    overflow: hidden;
    user-select: none;
  }

  /* ── TOP BAR ── */
  #topbar {
    background: var(--panel);
    border-bottom: 1px solid var(--btc);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 24px;
    flex-shrink: 0;
  }

  .logo {
    color: var(--btc);
    font-size: 15px;
    font-weight: bold;
    letter-spacing: 2px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-icon { font-size: 18px; }

  .topbar-sep { color: var(--border); }

  .topbar-item { color: var(--dim); font-size: 11px; }
  .topbar-item span { color: var(--text); }
  .topbar-item.btc-block span { color: var(--btc); font-weight: bold; }

  .live-badge {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--green);
  }

  .live-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--green);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.8); }
  }

  /* ── MAIN GRID ── */
  #main {
    display: grid;
    grid-template-columns: 240px 1fr 280px;
    gap: 1px;
    background: var(--border);
    overflow: hidden;
    min-height: 0;
  }

  .panel {
    background: var(--panel);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .panel-header {
    background: var(--panel2);
    border-bottom: 1px solid var(--border);
    padding: 8px 14px;
    color: var(--btc);
    font-size: 10px;
    letter-spacing: 3px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-header .ph-badge {
    margin-left: auto;
    color: var(--dim);
    font-size: 10px;
    letter-spacing: 0;
  }

  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    min-height: 0;
  }

  .panel-body::-webkit-scrollbar { width: 4px; }
  .panel-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  /* ── LEFT: BITCOIN L1 ── */
  .btc-stat {
    margin-bottom: 14px;
  }

  .btc-stat-label {
    color: var(--dim);
    font-size: 10px;
    letter-spacing: 1px;
    margin-bottom: 3px;
  }

  .btc-stat-value {
    color: var(--text);
    font-size: 13px;
  }

  .btc-stat-value.big {
    color: var(--btc);
    font-size: 18px;
    font-weight: bold;
  }

  .btc-hash {
    color: var(--dim);
    font-size: 9px;
    word-break: break-all;
    margin-top: 3px;
    line-height: 1.4;
  }

  .fee-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 4px;
    margin-bottom: 14px;
  }

  .fee-box {
    background: var(--panel2);
    border: 1px solid var(--border);
    padding: 6px 8px;
    text-align: center;
  }

  .fee-box-label { color: var(--dim); font-size: 9px; letter-spacing: 1px; }
  .fee-box-value { color: var(--text); font-size: 12px; margin-top: 2px; }
  .fee-box-value.fast   { color: var(--red); }
  .fee-box-value.medium { color: var(--btc); }
  .fee-box-value.slow   { color: var(--green); }

  .source-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 3px;
    margin-bottom: 14px;
  }

  .source-badge.core     { background: rgba(34,197,94,0.1);  color: var(--green); border: 1px solid rgba(34,197,94,0.3); }
  .source-badge.mempool  { background: rgba(59,130,246,0.1); color: var(--blue);  border: 1px solid rgba(59,130,246,0.3); }
  .source-badge.offline  { background: rgba(239,68,68,0.1);  color: var(--red);   border: 1px solid rgba(239,68,68,0.3); }

  .divider {
    border: none;
    border-top: 1px solid var(--border);
    margin: 12px 0;
  }

  /* ── CENTER: SHA256 CHAIN ── */
  #chain-container {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .chain-genesis {
    border: 1px solid var(--border);
    padding: 10px 14px;
    margin-bottom: 8px;
    background: rgba(247,147,26,0.04);
    text-align: center;
  }

  .chain-genesis-label {
    color: var(--btc);
    font-size: 9px;
    letter-spacing: 3px;
    margin-bottom: 4px;
  }

  .chain-genesis-hash {
    color: var(--dim);
    font-size: 8px;
    word-break: break-all;
  }

  .chain-block {
    border-left: 2px solid var(--btc);
    padding: 8px 12px;
    margin-bottom: 6px;
    background: rgba(247,147,26,0.02);
    position: relative;
    animation: blockSlide 0.35s ease;
    cursor: default;
    transition: background 0.15s;
  }

  .chain-block:hover { background: rgba(247,147,26,0.06); }

  @keyframes blockSlide {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .cb-height {
    color: var(--btc);
    font-size: 10px;
    font-weight: bold;
    margin-bottom: 3px;
  }

  .cb-hash {
    color: var(--dim);
    font-size: 9px;
    word-break: break-all;
    line-height: 1.5;
    margin-bottom: 3px;
  }

  .cb-meta {
    display: flex;
    gap: 10px;
    color: var(--dim);
    font-size: 9px;
  }

  .cb-tool { color: var(--text); }
  .cb-time { color: var(--dim); }

  .chain-empty {
    color: var(--dim);
    text-align: center;
    padding: 40px 20px;
    font-size: 11px;
    line-height: 2;
  }

  /* ── RIGHT: TOOL STREAM ── */
  #tool-stream {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .tool-call {
    border-bottom: 1px solid var(--border);
    padding: 7px 10px;
    animation: toolFade 0.25s ease;
    transition: background 0.1s;
  }

  .tool-call:hover { background: var(--panel2); }

  @keyframes toolFade {
    from { opacity: 0; background: rgba(247,147,26,0.08); }
    to   { opacity: 1; background: transparent; }
  }

  .tc-name {
    color: var(--text);
    font-size: 11px;
    margin-bottom: 2px;
  }

  .tc-name.blocked { color: var(--red); }

  .tc-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--dim);
    font-size: 9px;
  }

  .tc-badge {
    padding: 1px 5px;
    border-radius: 2px;
    font-size: 8px;
  }

  .tc-badge.ok      { background: rgba(34,197,94,0.12);  color: var(--green); }
  .tc-badge.blocked { background: rgba(239,68,68,0.12);   color: var(--red); }

  .tc-dur { color: var(--dim); }

  .tool-empty {
    color: var(--dim);
    text-align: center;
    padding: 40px 16px;
    font-size: 11px;
    line-height: 2;
  }

  /* ── BOTTOM BAR ── */
  #bottombar {
    background: var(--panel2);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 0;
    flex-shrink: 0;
    font-size: 10px;
  }

  .bb-item {
    padding: 0 16px;
    border-right: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    color: var(--dim);
  }

  .bb-item:first-child { padding-left: 0; }

  .bb-item span { color: var(--text); }

  .bb-item .green { color: var(--green); }
  .bb-item .red   { color: var(--red); }
  .bb-item .btc   { color: var(--btc); }

  .bb-genesis {
    margin-left: auto;
    color: var(--border);
    font-size: 9px;
    letter-spacing: 0.5px;
    padding-right: 0;
    border: none;
  }

  /* ── SCROLLBAR ── */
  * { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }

  /* ── WS STATUS ── */
  #ws-status {
    font-size: 9px;
    color: var(--dim);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  #ws-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--dim);
  }

  #ws-dot.connected   { background: var(--green); }
  #ws-dot.connecting  { background: var(--btc); animation: pulse 1s infinite; }
  #ws-dot.disconnected { background: var(--red); }
</style>
</head>
<body>

<!-- ── TOP BAR ── -->
<div id="topbar">
  <div class="logo">
    <span class="logo-icon">⛓</span>
    AIBTC PROTOCOL
  </div>
  <span class="topbar-sep">│</span>
  <div class="topbar-item btc-block">BLOCK <span id="t-block">—</span></div>
  <span class="topbar-sep">│</span>
  <div class="topbar-item">CHAIN <span id="t-chain-len">0</span> blocks</div>
  <span class="topbar-sep">│</span>
  <div class="topbar-item">CALLS <span id="t-calls">0</span></div>
  <span class="topbar-sep">│</span>
  <div class="topbar-item">UPTIME <span id="t-uptime">0s</span></div>

  <div class="live-badge">
    <div id="ws-dot" class="connecting"></div>
    <span id="ws-status-text">connecting</span>
  </div>
</div>

<!-- ── MAIN ── -->
<div id="main">

  <!-- LEFT: Bitcoin L1 -->
  <div class="panel">
    <div class="panel-header">
      ₿ BITCOIN L1
      <span class="ph-badge" id="btc-source-label">—</span>
    </div>
    <div class="panel-body">
      <div class="btc-stat">
        <div class="btc-stat-label">BLOCK HEIGHT</div>
        <div class="btc-stat-value big" id="btc-height">—</div>
      </div>

      <div class="btc-stat">
        <div class="btc-stat-label">BEST BLOCK HASH</div>
        <div class="btc-hash" id="btc-hash">—</div>
      </div>

      <div class="btc-stat">
        <div class="btc-stat-label">BLOCK TIME</div>
        <div class="btc-stat-value" id="btc-time">—</div>
      </div>

      <hr class="divider">

      <div class="btc-stat-label" style="margin-bottom:6px">FEES (sat/vB)</div>
      <div class="fee-row">
        <div class="fee-box">
          <div class="fee-box-label">FAST</div>
          <div class="fee-box-value fast" id="fee-fast">—</div>
        </div>
        <div class="fee-box">
          <div class="fee-box-label">MED</div>
          <div class="fee-box-value medium" id="fee-med">—</div>
        </div>
        <div class="fee-box">
          <div class="fee-box-label">SLOW</div>
          <div class="fee-box-value slow" id="fee-slow">—</div>
        </div>
      </div>

      <hr class="divider">

      <div class="btc-stat">
        <div class="btc-stat-label">MEMPOOL</div>
        <div class="btc-stat-value" id="mempool-txs">—</div>
        <div style="color:var(--dim);font-size:10px;margin-top:2px" id="mempool-size">—</div>
      </div>

      <hr class="divider">

      <div class="btc-stat">
        <div class="btc-stat-label">SHA256 GENESIS</div>
        <div class="btc-hash" id="genesis-hash">—</div>
      </div>
    </div>
  </div>

  <!-- CENTER: SHA256 Chain -->
  <div class="panel">
    <div class="panel-header">
      # SHA256 CHAIN
      <span class="ph-badge" id="chain-valid-badge">VALID ✓</span>
    </div>
    <div class="panel-body">
      <div class="chain-genesis" id="genesis-block">
        <div class="chain-genesis-label">GENESIS BLOCK</div>
        <div class="chain-genesis-hash" id="genesis-display">computing...</div>
      </div>
      <div id="chain-container">
        <div class="chain-empty">
          Waiting for first tool call...<br>
          Every call adds a SHA256 block.<br>
          <span style="color:var(--btc)">The chain is the truth.</span>
        </div>
      </div>
    </div>
  </div>

  <!-- RIGHT: Tool Stream -->
  <div class="panel">
    <div class="panel-header">
      ▶ TOOL STREAM
      <span class="ph-badge" id="blocked-count">0 blocked</span>
    </div>
    <div class="panel-body">
      <div id="tool-stream">
        <div class="tool-empty">
          No tool calls yet.<br>
          Use Claude to call any tool.<br>
          <span style="color:var(--btc)">All calls appear here live.</span>
        </div>
      </div>
    </div>
  </div>

</div>

<!-- ── BOTTOM BAR ── -->
<div id="bottombar">
  <div class="bb-item">
    SECURITY <span id="bb-sec" class="green">100%</span>
  </div>
  <div class="bb-item">
    CHAIN <span id="bb-chain" class="green">VALID ✓</span>
  </div>
  <div class="bb-item">
    SESSIONS <span id="bb-sessions">0</span>
  </div>
  <div class="bb-item">
    BLOCKED <span id="bb-blocked">0</span>
  </div>
  <div class="bb-item">
    TOTAL EVENTS <span id="bb-total" class="btc">0</span>
  </div>
  <div class="bb-item bb-genesis" id="bb-genesis">
    SHA256("aibtc-protocol:genesis:bitcoin:2026")
  </div>
</div>

<script>
// ── State ────────────────────────────────────────────────────────────────────
let state = null;
let ws    = null;
let wsConnected = false;

// ── WebSocket ────────────────────────────────────────────────────────────────
function connect() {
  ws = new WebSocket('ws://localhost:4201');

  ws.onopen = () => {
    wsConnected = true;
    setWsStatus('connected', 'live');
  };

  ws.onmessage = (e) => {
    try {
      state = JSON.parse(e.data);
      render(state);
    } catch {}
  };

  ws.onclose = () => {
    wsConnected = false;
    setWsStatus('disconnected', 'reconnecting...');
    setTimeout(connect, 2000);
  };

  ws.onerror = () => {
    setWsStatus('disconnected', 'error');
  };
}

function setWsStatus(cls, label) {
  const dot  = document.getElementById('ws-dot');
  const text = document.getElementById('ws-status-text');
  dot.className  = cls;
  text.textContent = label;
}

// ── Render ───────────────────────────────────────────────────────────────────
function render(s) {
  if (!s) return;

  // Top bar
  set('t-block',     s.bitcoin?.block?.height ?? '—');
  set('t-chain-len', s.chain?.length ?? 0);
  set('t-calls',     s.tools?.total_calls ?? 0);
  set('t-uptime',    fmtUptime(s.protocol?.uptime_ms ?? 0));

  // Genesis
  const g = s.protocol?.genesis_hash ?? '';
  set('genesis-display', g);
  set('genesis-hash',    g.slice(0, 16) + '...' + g.slice(-16));

  // Bitcoin L1
  const btc = s.bitcoin;
  if (btc?.connected) {
    set('btc-height',       btc.block?.height ?? '—');
    set('btc-hash',         btc.block?.hash   ?? '—');
    set('btc-time',         btc.block?.time ? fmtTime(btc.block.time * 1000) : '—');
    set('fee-fast',         (btc.fees?.fast   ?? '—') + (btc.fees ? ' s/vB' : ''));
    set('fee-med',          (btc.fees?.medium ?? '—') + (btc.fees ? ' s/vB' : ''));
    set('fee-slow',         (btc.fees?.slow   ?? '—') + (btc.fees ? ' s/vB' : ''));
    set('mempool-txs',      (btc.mempool?.tx_count ?? '—') + ' txs');
    set('mempool-size',     (btc.mempool?.vsize_mb ?? '—') + ' MB');
    set('btc-source-label', btc.source === 'bitcoin-core' ? '● CORE' : '● MEMPOOL.SPACE');

    const src = document.getElementById('btc-source-label');
    if (src) src.style.color = btc.source === 'bitcoin-core' ? 'var(--green)' : 'var(--blue)';
  } else {
    set('btc-height',  'OFFLINE');
    set('btc-hash',    btc?.error ?? 'Not connected');
    set('btc-source-label', '● OFFLINE');
    const src = document.getElementById('btc-source-label');
    if (src) src.style.color = 'var(--red)';
  }

  // Chain
  renderChain(s.chain);

  // Tools
  renderTools(s.tools);

  // Security
  const sec = s.security ?? {};
  const secPct = sec.score ?? 100;
  const secEl = document.getElementById('bb-sec');
  if (secEl) {
    secEl.textContent = secPct + '%';
    secEl.className   = secPct >= 80 ? 'green' : secPct >= 60 ? 'btc' : 'red';
  }

  const chainOk = sec.chain_valid !== false;
  const chainEl = document.getElementById('bb-chain');
  if (chainEl) {
    chainEl.textContent = chainOk ? 'VALID ✓' : 'INVALID ✗';
    chainEl.className   = chainOk ? 'green' : 'red';
  }

  const cvBadge = document.getElementById('chain-valid-badge');
  if (cvBadge) {
    cvBadge.textContent = chainOk ? 'VALID ✓' : 'INVALID ✗';
    cvBadge.style.color = chainOk ? 'var(--green)' : 'var(--red)';
  }

  set('bb-sessions', s.tools?.active_sessions ?? 0);
  set('bb-blocked',  s.tools?.blocked_calls   ?? 0);
  set('bb-total',    s.tools?.total_calls      ?? 0);

  set('blocked-count', (s.tools?.blocked_calls ?? 0) + ' blocked');
}

// ── Chain render ──────────────────────────────────────────────────────────────
let _lastChainLen = 0;

function renderChain(chain) {
  if (!chain || chain.recent.length === 0) return;
  if (chain.length === _lastChainLen) return;
  _lastChainLen = chain.length;

  const container = document.getElementById('chain-container');
  container.innerHTML = '';

  chain.recent.forEach((block, i) => {
    const el = document.createElement('div');
    el.className = 'chain-block';
    if (i === 0) el.style.borderLeftColor = 'var(--green)';

    el.innerHTML =
      '<div class="cb-height">' +
        'BLOCK #' + block.height +
      '</div>' +
      '<div class="cb-hash">' +
        block.hash.slice(0, 32) + '<br>' + block.hash.slice(32) +
      '</div>' +
      '<div class="cb-meta">' +
        '<span class="cb-tool">' + escHtml(block.tool) + '</span>' +
        '<span class="cb-time">' + fmtAgo(block.ts) + '</span>' +
        '<span class="cb-dur">' + block.duration_ms + 'ms</span>' +
      '</div>';

    container.appendChild(el);
  });
}

// ── Tool stream render ────────────────────────────────────────────────────────
let _lastToolCount = 0;

function renderTools(tools) {
  if (!tools || tools.recent.length === 0) return;
  if (tools.total_calls === _lastToolCount) return;
  _lastToolCount = tools.total_calls;

  const container = document.getElementById('tool-stream');
  container.innerHTML = '';

  tools.recent.slice(0, 60).forEach((tc, i) => {
    const el = document.createElement('div');
    el.className = 'tool-call';

    const badge = tc.blocked
      ? '<span class="tc-badge blocked">BLOCKED</span>'
      : '<span class="tc-badge ok">OK</span>';

    el.innerHTML =
      '<div class="tc-name' + (tc.blocked ? ' blocked' : '') + '">' +
        escHtml(tc.name) +
      '</div>' +
      '<div class="tc-meta">' +
        badge +
        '<span class="tc-dur">' + tc.duration_ms + 'ms</span>' +
        '<span class="tc-time">' + fmtAgo(tc.ts) + '</span>' +
      '</div>';

    container.appendChild(el);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(val);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  if (m > 0) return m + 'm ' + (s % 60) + 's';
  return s + 's';
}

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString();
}

function fmtAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  return Math.floor(s/3600) + 'h ago';
}

// ── Uptime ticker ─────────────────────────────────────────────────────────────
setInterval(() => {
  if (state) {
    state.protocol.uptime_ms += 1000;
    set('t-uptime', fmtUptime(state.protocol.uptime_ms));
  }
}, 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
connect();
</script>
</body>
</html>`;
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const HTTP_PORT = 4200;
const WS_PORT   = 4201;

export function startDashboard(): void {
  // HTTP server
  const html = dashboardHtml();
  const httpServer = createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    if (req.url === "/api/state") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(getState()));
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  httpServer.listen(HTTP_PORT, "127.0.0.1", () => {
    process.stderr.write(
      `\n⛓ AIBTC Dashboard: http://localhost:${HTTP_PORT}\n\n`
    );
  });

  // WebSocket server
  const wss = new WebSocketServer({ port: WS_PORT, host: "127.0.0.1" });

  // Push state to all connected clients
  function broadcast(): void {
    const payload = JSON.stringify(getState());
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // Send on state change
  onStateChange(broadcast);

  // Send current state on new connection
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify(getState()));
  });

  // Bitcoin poll every 30s
  async function pollBitcoin(): Promise<void> {
    try {
      const data = await fetchBitcoin();
      updateBitcoin(data);
      broadcast();
    } catch { /* non-fatal */ }
  }

  pollBitcoin();
  setInterval(pollBitcoin, 30_000);
}
