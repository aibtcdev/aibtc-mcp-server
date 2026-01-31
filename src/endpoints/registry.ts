/**
 * Known x402 endpoints registry
 * Endpoints from x402.biwas.xyz, x402.aibtc.com, and stx402.com
 */

export interface X402Endpoint {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  cost: string;
  category: string;
  source: "x402.biwas.xyz" | "x402.aibtc.com" | "stx402.com";
  params?: Record<string, string>;
  body?: Record<string, string>;
}

// =============================================================================
// x402.biwas.xyz ENDPOINTS
// =============================================================================

const BIWAS_PAID_ENDPOINTS: X402Endpoint[] = [
  // News & Research
  {
    path: "/api/news",
    method: "GET",
    description: "Get latest Stacks and Bitcoin news with AI analysis",
    cost: "0.001 STX",
    category: "News & Research",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/research/user",
    method: "POST",
    description: "Research user profile from X/Twitter and web sources",
    cost: "0.005 STX",
    category: "News & Research",
    source: "x402.biwas.xyz",
    body: { username: "Twitter/X username to research" },
  },
  {
    path: "/api/sentiment",
    method: "POST",
    description: "Real-time sentiment analysis for crypto tokens on X/Twitter",
    cost: "0.005 STX",
    category: "News & Research",
    source: "x402.biwas.xyz",
    body: { token: "Token symbol to analyze (e.g., STX, BTC)" },
  },

  // Security & Auditing
  {
    path: "/api/audit",
    method: "POST",
    description: "Security audit for Clarity smart contracts",
    cost: "0.02 STX",
    category: "Security",
    source: "x402.biwas.xyz",
    body: { contract: "Clarity contract source code or contract ID" },
  },

  // Wallet Analysis
  {
    path: "/api/wallet/classify",
    method: "POST",
    description: "Classify wallet behavior (trader, whale, bot, dao, bridge)",
    cost: "0.005 STX",
    category: "Wallet Analysis",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/wallet/trading",
    method: "POST",
    description: "AI-enhanced wallet trading behavior analysis",
    cost: "0.005 STX",
    category: "Wallet Analysis",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/wallet/pnl",
    method: "POST",
    description: "AI-enhanced wallet profit/loss analysis",
    cost: "0.005 STX",
    category: "Wallet Analysis",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },

  // ALEX DEX
  {
    path: "/api/alex/swap-optimizer",
    method: "POST",
    description: "AI swap route optimizer - finds optimal routes, calculates slippage",
    cost: "0.005 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
    body: { tokenIn: "Input token", tokenOut: "Output token", amount: "Amount" },
  },
  {
    path: "/api/alex/pool-risk",
    method: "POST",
    description: "LP position risk analyzer - impermanent loss scenarios",
    cost: "0.008 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
    body: { pool: "Pool identifier", amount: "LP amount" },
  },
  {
    path: "/api/alex/arbitrage-scan",
    method: "GET",
    description: "Cross-pool arbitrage scanner - finds price discrepancies",
    cost: "0.01 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/alex/market-regime",
    method: "GET",
    description: "Market regime detector - classifies current market conditions",
    cost: "0.005 STX",
    category: "ALEX DEX",
    source: "x402.biwas.xyz",
  },

  // Zest Protocol (Lending)
  {
    path: "/api/zest/liquidation-risk",
    method: "POST",
    description: "Liquidation risk monitor - health factor analysis",
    cost: "0.008 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/zest/yield-optimizer",
    method: "POST",
    description: "Lending yield optimizer - recommends optimal strategy",
    cost: "0.008 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address", amount: "Amount to optimize" },
  },
  {
    path: "/api/zest/interest-forecast",
    method: "GET",
    description: "Interest rate forecaster - predicts rate movements",
    cost: "0.005 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/zest/position-health",
    method: "POST",
    description: "Position health analyzer - comprehensive check with rebalancing recommendations",
    cost: "0.005 STX",
    category: "Zest Protocol",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },

  // DeFi Portfolio
  {
    path: "/api/defi/portfolio-analyzer",
    method: "POST",
    description: "DeFi portfolio intelligence - combined analysis across protocols",
    cost: "0.015 STX",
    category: "DeFi",
    source: "x402.biwas.xyz",
    body: { address: "Stacks wallet address" },
  },
  {
    path: "/api/defi/strategy-builder",
    method: "POST",
    description: "AI strategy builder - generates complete DeFi strategy",
    cost: "0.02 STX",
    category: "DeFi",
    source: "x402.biwas.xyz",
    body: { address: "Address", riskTolerance: "low|medium|high", goals: "Goals" },
  },
];

const BIWAS_FREE_ENDPOINTS: X402Endpoint[] = [
  // Market Data
  {
    path: "/api/market/stats",
    method: "GET",
    description: "Stacks DeFi market statistics",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/gainers",
    method: "GET",
    description: "Top gaining tokens by price change",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/losers",
    method: "GET",
    description: "Top losing tokens by price change",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/whales",
    method: "GET",
    description: "Recent whale trades",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/market/netflow",
    method: "GET",
    description: "Hourly net flow of funds",
    cost: "FREE",
    category: "Market Data",
    source: "x402.biwas.xyz",
  },

  // Pools
  {
    path: "/api/pools/trending",
    method: "GET",
    description: "Trending liquidity pools",
    cost: "FREE",
    category: "Pools",
    source: "x402.biwas.xyz",
  },
  {
    path: "/api/pools/ohlc",
    method: "POST",
    description: "OHLCV candlestick data for pools",
    cost: "FREE",
    category: "Pools",
    source: "x402.biwas.xyz",
    body: { pool: "Pool identifier", interval: "1h | 4h | 1d" },
  },

  // Tokens
  {
    path: "/api/tokens/summary",
    method: "POST",
    description: "Token market summary",
    cost: "FREE",
    category: "Tokens",
    source: "x402.biwas.xyz",
    body: { token: "Token symbol or contract ID" },
  },
  {
    path: "/api/tokens/details",
    method: "POST",
    description: "Full token details including metadata",
    cost: "FREE",
    category: "Tokens",
    source: "x402.biwas.xyz",
    body: { token: "Token symbol or contract ID" },
  },
];

// =============================================================================
// x402.aibtc.com ENDPOINTS
// =============================================================================

const AIBTC_PAID_ENDPOINTS: X402Endpoint[] = [
  // Inference
  {
    path: "/inference/openrouter/chat",
    method: "POST",
    description: "Chat completion via OpenRouter (Claude, GPT-4, etc.)",
    cost: "Dynamic",
    category: "Inference",
    source: "x402.aibtc.com",
    body: { model: "Model name", messages: "Chat messages array" },
  },
  {
    path: "/inference/cloudflare/chat",
    method: "POST",
    description: "Chat completion via Cloudflare Workers AI",
    cost: "Dynamic",
    category: "Inference",
    source: "x402.aibtc.com",
    body: { model: "Model name", messages: "Chat messages array" },
  },

  // Stacks Utilities
  {
    path: "/stacks/address",
    method: "POST",
    description: "Convert Stacks address between networks",
    cost: "0.001 STX",
    category: "Stacks Utilities",
    source: "x402.aibtc.com",
    body: { address: "Stacks address" },
  },
  {
    path: "/stacks/decode",
    method: "POST",
    description: "Decode raw Stacks transaction",
    cost: "0.001 STX",
    category: "Stacks Utilities",
    source: "x402.aibtc.com",
    body: { tx: "Raw transaction hex" },
  },
  {
    path: "/stacks/profile",
    method: "POST",
    description: "Get aggregated profile data (BNS, balances, NFTs)",
    cost: "0.001 STX",
    category: "Stacks Utilities",
    source: "x402.aibtc.com",
    body: { address: "Stacks address" },
  },

  // Hashing
  {
    path: "/hashing/sha256",
    method: "POST",
    description: "SHA-256 hash",
    cost: "0.0005 STX",
    category: "Hashing",
    source: "x402.aibtc.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/hashing/keccak256",
    method: "POST",
    description: "Keccak-256 hash",
    cost: "0.0005 STX",
    category: "Hashing",
    source: "x402.aibtc.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/hashing/hash160",
    method: "POST",
    description: "RIPEMD160(SHA256) hash",
    cost: "0.0005 STX",
    category: "Hashing",
    source: "x402.aibtc.com",
    body: { data: "Data to hash" },
  },

  // Storage - KV
  {
    path: "/storage/kv/set",
    method: "POST",
    description: "Store key-value pair",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { key: "Key name", value: "Value", ttl: "TTL in seconds (optional)" },
  },
  {
    path: "/storage/kv/get",
    method: "POST",
    description: "Retrieve value by key",
    cost: "0.0005 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { key: "Key name" },
  },
  {
    path: "/storage/kv/delete",
    method: "POST",
    description: "Delete key-value pair",
    cost: "0.0005 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { key: "Key name" },
  },

  // Storage - Paste
  {
    path: "/storage/paste/create",
    method: "POST",
    description: "Create a paste/snippet",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { content: "Content", language: "Language (optional)" },
  },
  {
    path: "/storage/paste/get",
    method: "POST",
    description: "Retrieve paste by ID",
    cost: "0.0005 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { id: "Paste ID" },
  },

  // Storage - DB
  {
    path: "/storage/db/query",
    method: "POST",
    description: "Execute read-only SELECT query",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { sql: "SELECT query" },
  },
  {
    path: "/storage/db/execute",
    method: "POST",
    description: "Execute write operations (INSERT, UPDATE, DELETE)",
    cost: "0.001 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { sql: "SQL statement" },
  },

  // Storage - Memory
  {
    path: "/storage/memory/store",
    method: "POST",
    description: "Store memory with optional embedding",
    cost: "0.002 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { key: "Memory key", content: "Content", embed: "Generate embedding (bool)" },
  },
  {
    path: "/storage/memory/recall",
    method: "POST",
    description: "Retrieve memory by key",
    cost: "0.0005 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { key: "Memory key" },
  },
  {
    path: "/storage/memory/search",
    method: "POST",
    description: "Semantic search across memories",
    cost: "0.002 STX",
    category: "Storage",
    source: "x402.aibtc.com",
    body: { query: "Search query", limit: "Max results" },
  },
];

const AIBTC_FREE_ENDPOINTS: X402Endpoint[] = [
  {
    path: "/health",
    method: "GET",
    description: "Service health status",
    cost: "FREE",
    category: "System",
    source: "x402.aibtc.com",
  },
];

// =============================================================================
// stx402.com ENDPOINTS
// =============================================================================

const STX402_FREE_ENDPOINTS: X402Endpoint[] = [
  {
    path: "/api/health",
    method: "GET",
    description: "Service health status",
    cost: "FREE",
    category: "System",
    source: "stx402.com",
  },
  {
    path: "/api/registry/list",
    method: "GET",
    description: "List all registered x402 endpoints",
    cost: "FREE",
    category: "Registry",
    source: "stx402.com",
  },
  {
    path: "/api/links/expand/{slug}",
    method: "GET",
    description: "Expand short link with click tracking",
    cost: "FREE",
    category: "Links",
    source: "stx402.com",
    params: { slug: "Short link slug" },
  },
  {
    path: "/api/agent/registry",
    method: "GET",
    description: "Agent registry contract info (ERC-8004)",
    cost: "FREE",
    category: "Agent Registry",
    source: "stx402.com",
  },
];

const STX402_PAID_ENDPOINTS: X402Endpoint[] = [
  // Data Operations
  {
    path: "/api/data/json-minify",
    method: "POST",
    description: "Remove JSON whitespace and minify",
    cost: "Paid",
    category: "Data Operations",
    source: "stx402.com",
    body: { json: "JSON string to minify" },
  },
  {
    path: "/api/data/json-validate",
    method: "POST",
    description: "Validate JSON syntax",
    cost: "Paid",
    category: "Data Operations",
    source: "stx402.com",
    body: { json: "JSON string to validate" },
  },

  // Stacks Blockchain
  {
    path: "/api/stacks/convert-address/{address}",
    method: "GET",
    description: "Convert Stacks address between networks",
    cost: "Paid",
    category: "Stacks Blockchain",
    source: "stx402.com",
    params: { address: "Stacks address" },
  },
  {
    path: "/api/stacks/decode-clarity-hex",
    method: "POST",
    description: "Decode Clarity hex values",
    cost: "Paid",
    category: "Stacks Blockchain",
    source: "stx402.com",
    body: { hex: "Clarity hex value" },
  },
  {
    path: "/api/stacks/to-consensus-buff",
    method: "POST",
    description: "Serialize Clarity value to consensus buffer",
    cost: "Paid",
    category: "Stacks Blockchain",
    source: "stx402.com",
    body: { value: "Clarity value" },
  },
  {
    path: "/api/stacks/from-consensus-buff",
    method: "POST",
    description: "Deserialize from consensus buffer",
    cost: "Paid",
    category: "Stacks Blockchain",
    source: "stx402.com",
    body: { buffer: "Consensus buffer hex" },
  },
  {
    path: "/api/stacks/decode-tx",
    method: "POST",
    description: "Decode raw Stacks transaction",
    cost: "Paid",
    category: "Stacks Blockchain",
    source: "stx402.com",
    body: { tx: "Raw transaction hex" },
  },
  {
    path: "/api/stacks/profile/{address}",
    method: "GET",
    description: "Aggregated profile data (BNS, balances, NFT counts)",
    cost: "Paid",
    category: "Stacks Blockchain",
    source: "stx402.com",
    params: { address: "Stacks address" },
  },
  {
    path: "/api/stacks/contract-info/{contract_id}",
    method: "GET",
    description: "Contract source code and ABI",
    cost: "Paid",
    category: "Stacks Blockchain",
    source: "stx402.com",
    params: { contract_id: "Contract ID (address.name)" },
  },

  // AI Services
  {
    path: "/api/ai/dad-joke",
    method: "GET",
    description: "Generate a dad joke",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
  },
  {
    path: "/api/ai/image-describe",
    method: "POST",
    description: "Vision analysis - describe an image",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { image: "Image URL or base64" },
  },
  {
    path: "/api/ai/tts",
    method: "POST",
    description: "Text-to-speech (English/Spanish)",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to speak", language: "en | es" },
  },
  {
    path: "/api/ai/summarize",
    method: "POST",
    description: "Summarize text content",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to summarize" },
  },
  {
    path: "/api/ai/generate-image",
    method: "POST",
    description: "Generate image from text (Flux model)",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { prompt: "Image description" },
  },
  {
    path: "/api/ai/explain-contract/{contract_id}",
    method: "GET",
    description: "AI explanation of smart contract",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    params: { contract_id: "Contract ID (address.name)" },
  },
  {
    path: "/api/ai/translate",
    method: "POST",
    description: "Multi-language translation",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to translate", target: "Target language" },
  },
  {
    path: "/api/ai/sentiment",
    method: "POST",
    description: "Sentiment analysis of text",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to analyze" },
  },
  {
    path: "/api/ai/keywords",
    method: "POST",
    description: "Extract keywords from text",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to extract keywords from" },
  },
  {
    path: "/api/ai/language-detect",
    method: "POST",
    description: "Detect language of text",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to detect" },
  },
  {
    path: "/api/ai/paraphrase",
    method: "POST",
    description: "Paraphrase text in different styles",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to paraphrase", style: "Style" },
  },
  {
    path: "/api/ai/grammar-check",
    method: "POST",
    description: "Check and correct grammar",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { text: "Text to check" },
  },
  {
    path: "/api/ai/question-answer",
    method: "POST",
    description: "Answer questions based on context",
    cost: "Paid",
    category: "AI Services",
    source: "stx402.com",
    body: { context: "Context text", question: "Question" },
  },

  // Cryptography
  {
    path: "/api/hash/sha256",
    method: "POST",
    description: "SHA-256 hash",
    cost: "Paid",
    category: "Cryptography",
    source: "stx402.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/api/hash/sha512",
    method: "POST",
    description: "SHA-512 hash",
    cost: "Paid",
    category: "Cryptography",
    source: "stx402.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/api/hash/keccak256",
    method: "POST",
    description: "Keccak-256 hash",
    cost: "Paid",
    category: "Cryptography",
    source: "stx402.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/api/hash/hash160",
    method: "POST",
    description: "RIPEMD160(SHA256) hash",
    cost: "Paid",
    category: "Cryptography",
    source: "stx402.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/api/hash/ripemd160",
    method: "POST",
    description: "RIPEMD-160 hash",
    cost: "Paid",
    category: "Cryptography",
    source: "stx402.com",
    body: { data: "Data to hash" },
  },
  {
    path: "/api/hash/hmac",
    method: "POST",
    description: "HMAC signature generation",
    cost: "Paid",
    category: "Cryptography",
    source: "stx402.com",
    body: { data: "Data", key: "Secret key", algorithm: "sha256 | sha512" },
  },

  // Utilities
  {
    path: "/api/util/qr-generate",
    method: "POST",
    description: "Generate QR code",
    cost: "Paid",
    category: "Utilities",
    source: "stx402.com",
    body: { data: "Data to encode", size: "Size in pixels" },
  },
  {
    path: "/api/util/verify-signature",
    method: "POST",
    description: "Verify SIP-018 signature",
    cost: "Paid",
    category: "Utilities",
    source: "stx402.com",
    body: { message: "Message", signature: "Signature", publicKey: "Public key" },
  },

  // Registry
  {
    path: "/api/registry/probe",
    method: "POST",
    description: "Discover x402 payment info for an endpoint",
    cost: "Paid",
    category: "Registry",
    source: "stx402.com",
    body: { url: "Endpoint URL to probe" },
  },
  {
    path: "/api/registry/register",
    method: "POST",
    description: "Register a new x402 endpoint",
    cost: "Paid",
    category: "Registry",
    source: "stx402.com",
    body: { url: "Endpoint URL", description: "Description" },
  },
  {
    path: "/api/registry/details",
    method: "POST",
    description: "Get full details of registered endpoint",
    cost: "Paid",
    category: "Registry",
    source: "stx402.com",
    body: { url: "Endpoint URL" },
  },

  // Key-Value Storage
  {
    path: "/api/kv/set",
    method: "POST",
    description: "Store key-value with optional TTL",
    cost: "Paid",
    category: "Storage",
    source: "stx402.com",
    body: { key: "Key name", value: "Value", ttl: "TTL in seconds (optional)" },
  },
  {
    path: "/api/kv/get",
    method: "POST",
    description: "Retrieve value by key",
    cost: "Paid",
    category: "Storage",
    source: "stx402.com",
    body: { key: "Key name" },
  },
  {
    path: "/api/kv/delete",
    method: "POST",
    description: "Delete key-value pair",
    cost: "Paid",
    category: "Storage",
    source: "stx402.com",
    body: { key: "Key name" },
  },
  {
    path: "/api/kv/list",
    method: "POST",
    description: "List keys with pagination",
    cost: "Paid",
    category: "Storage",
    source: "stx402.com",
    body: { prefix: "Key prefix (optional)", limit: "Max results" },
  },

  // Paste Service
  {
    path: "/api/paste/create",
    method: "POST",
    description: "Create a paste/snippet",
    cost: "Paid",
    category: "Paste",
    source: "stx402.com",
    body: { content: "Content to paste", language: "Language (optional)" },
  },
  {
    path: "/api/paste/{code}",
    method: "GET",
    description: "Retrieve paste by code",
    cost: "Paid",
    category: "Paste",
    source: "stx402.com",
    params: { code: "Paste code" },
  },

  // Counters
  {
    path: "/api/counter/increment",
    method: "POST",
    description: "Atomically increment counter",
    cost: "Paid",
    category: "Counters",
    source: "stx402.com",
    body: { name: "Counter name", amount: "Increment amount (default 1)" },
  },
  {
    path: "/api/counter/decrement",
    method: "POST",
    description: "Atomically decrement counter",
    cost: "Paid",
    category: "Counters",
    source: "stx402.com",
    body: { name: "Counter name", amount: "Decrement amount (default 1)" },
  },
  {
    path: "/api/counter/get",
    method: "GET",
    description: "Get counter value",
    cost: "Paid",
    category: "Counters",
    source: "stx402.com",
    params: { name: "Counter name" },
  },

  // SQL Database
  {
    path: "/api/sql/query",
    method: "POST",
    description: "Execute read-only SELECT query",
    cost: "Paid",
    category: "SQL Database",
    source: "stx402.com",
    body: { sql: "SELECT query" },
  },
  {
    path: "/api/sql/execute",
    method: "POST",
    description: "Execute write operations (CREATE, INSERT, UPDATE, DELETE)",
    cost: "Paid",
    category: "SQL Database",
    source: "stx402.com",
    body: { sql: "SQL statement" },
  },
  {
    path: "/api/sql/schema",
    method: "GET",
    description: "Get database schema",
    cost: "Paid",
    category: "SQL Database",
    source: "stx402.com",
  },

  // Links
  {
    path: "/api/links/create",
    method: "POST",
    description: "Create a short link",
    cost: "Paid",
    category: "Links",
    source: "stx402.com",
    body: { url: "URL to shorten", slug: "Custom slug (optional)" },
  },
  {
    path: "/api/links/stats",
    method: "POST",
    description: "Get link analytics",
    cost: "Paid",
    category: "Links",
    source: "stx402.com",
    body: { slug: "Link slug" },
  },
  {
    path: "/api/links/list",
    method: "GET",
    description: "List all your links",
    cost: "Paid",
    category: "Links",
    source: "stx402.com",
  },

  // Synchronization (Locks)
  {
    path: "/api/sync/lock",
    method: "POST",
    description: "Acquire a named lock",
    cost: "Paid",
    category: "Synchronization",
    source: "stx402.com",
    body: { name: "Lock name", ttl: "TTL in seconds" },
  },
  {
    path: "/api/sync/unlock",
    method: "POST",
    description: "Release a lock",
    cost: "Paid",
    category: "Synchronization",
    source: "stx402.com",
    body: { name: "Lock name", token: "Lock token" },
  },
  {
    path: "/api/sync/check",
    method: "POST",
    description: "Check lock status",
    cost: "Paid",
    category: "Synchronization",
    source: "stx402.com",
    body: { name: "Lock name" },
  },

  // Job Queue
  {
    path: "/api/queue/push",
    method: "POST",
    description: "Add job to queue",
    cost: "Paid",
    category: "Job Queue",
    source: "stx402.com",
    body: { queue: "Queue name", payload: "Job payload" },
  },
  {
    path: "/api/queue/pop",
    method: "POST",
    description: "Claim next job from queue",
    cost: "Paid",
    category: "Job Queue",
    source: "stx402.com",
    body: { queue: "Queue name" },
  },
  {
    path: "/api/queue/complete",
    method: "POST",
    description: "Mark job as complete",
    cost: "Paid",
    category: "Job Queue",
    source: "stx402.com",
    body: { jobId: "Job ID" },
  },
  {
    path: "/api/queue/status",
    method: "POST",
    description: "Get queue statistics",
    cost: "Paid",
    category: "Job Queue",
    source: "stx402.com",
    body: { queue: "Queue name" },
  },

  // Memory & Embeddings
  {
    path: "/api/memory/store",
    method: "POST",
    description: "Store memory with optional embedding",
    cost: "Paid",
    category: "Memory",
    source: "stx402.com",
    body: { key: "Memory key", content: "Content", embed: "Generate embedding (bool)" },
  },
  {
    path: "/api/memory/recall",
    method: "POST",
    description: "Retrieve memory by key",
    cost: "Paid",
    category: "Memory",
    source: "stx402.com",
    body: { key: "Memory key" },
  },
  {
    path: "/api/memory/search",
    method: "POST",
    description: "Semantic search across memories",
    cost: "Paid",
    category: "Memory",
    source: "stx402.com",
    body: { query: "Search query", limit: "Max results" },
  },
  {
    path: "/api/memory/list",
    method: "POST",
    description: "List memories with filters",
    cost: "Paid",
    category: "Memory",
    source: "stx402.com",
    body: { prefix: "Key prefix (optional)" },
  },
  {
    path: "/api/memory/forget",
    method: "POST",
    description: "Delete a memory",
    cost: "Paid",
    category: "Memory",
    source: "stx402.com",
    body: { key: "Memory key" },
  },

  // Agent Registry (ERC-8004)
  {
    path: "/api/agent/info",
    method: "POST",
    description: "Get agent info by ID",
    cost: "Paid",
    category: "Agent Registry",
    source: "stx402.com",
    body: { agentId: "Agent ID" },
  },
  {
    path: "/api/agent/lookup",
    method: "POST",
    description: "Lookup agent by owner address",
    cost: "Paid",
    category: "Agent Registry",
    source: "stx402.com",
    body: { owner: "Owner address" },
  },

  // Agent Reputation
  {
    path: "/api/agent/reputation/summary",
    method: "POST",
    description: "Get agent reputation summary",
    cost: "Paid",
    category: "Agent Reputation",
    source: "stx402.com",
    body: { agentId: "Agent ID" },
  },
  {
    path: "/api/agent/reputation/list",
    method: "POST",
    description: "List all feedback for agent",
    cost: "Paid",
    category: "Agent Reputation",
    source: "stx402.com",
    body: { agentId: "Agent ID" },
  },
];

// =============================================================================
// EXPORTS
// =============================================================================

export const PAID_ENDPOINTS = [...BIWAS_PAID_ENDPOINTS, ...AIBTC_PAID_ENDPOINTS, ...STX402_PAID_ENDPOINTS];
export const FREE_ENDPOINTS = [...BIWAS_FREE_ENDPOINTS, ...AIBTC_FREE_ENDPOINTS, ...STX402_FREE_ENDPOINTS];
export const ALL_ENDPOINTS = [...PAID_ENDPOINTS, ...FREE_ENDPOINTS];

/**
 * Search endpoints by keyword
 */
export function searchEndpoints(query: string): X402Endpoint[] {
  const lowerQuery = query.toLowerCase();
  return ALL_ENDPOINTS.filter(
    (endpoint) =>
      endpoint.path.toLowerCase().includes(lowerQuery) ||
      endpoint.description.toLowerCase().includes(lowerQuery) ||
      endpoint.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get endpoints by category
 */
export function getEndpointsByCategory(category: string): X402Endpoint[] {
  return ALL_ENDPOINTS.filter(
    (endpoint) => endpoint.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get endpoints by source
 */
export function getEndpointsBySource(source: "x402.biwas.xyz" | "x402.aibtc.com" | "stx402.com"): X402Endpoint[] {
  return ALL_ENDPOINTS.filter((endpoint) => endpoint.source === source);
}

/**
 * Format endpoints for display
 */
export function formatEndpointsTable(endpoints: X402Endpoint[]): string {
  const grouped = endpoints.reduce(
    (acc, endpoint) => {
      const key = `${endpoint.category} (${endpoint.source})`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(endpoint);
      return acc;
    },
    {} as Record<string, X402Endpoint[]>
  );

  let output = "";
  for (const [category, eps] of Object.entries(grouped)) {
    output += `\n## ${category}\n`;
    for (const ep of eps) {
      output += `- ${ep.method} ${ep.path} (${ep.cost})\n  ${ep.description}\n`;
      if (ep.params) {
        output += `  Params: ${JSON.stringify(ep.params)}\n`;
      }
      if (ep.body) {
        output += `  Body: ${JSON.stringify(ep.body)}\n`;
      }
    }
  }
  return output.trim();
}

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const categories = new Set(ALL_ENDPOINTS.map((ep) => ep.category));
  return Array.from(categories).sort();
}
