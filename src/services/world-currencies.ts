/**
 * World Currency Intelligence — Ψ Equation Applied to ALL Currencies
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel
 * Applied to every currency on Earth — fiat, crypto, CBDC, commodity, special
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DIMENSION 1 — Landauer (Physics of Computation / Energy Cost)
 *   PoW coins: SHA-256 / Scrypt / Ethash costs real joules → high score
 *   Fiat: printing or digital entry costs near-zero energy → low score
 *   Physical commodities: mining has real energy cost → medium score
 *
 * DIMENSION 2 — Nash (Game Theory Equilibrium)
 *   Does the currency system reach a self-enforcing equilibrium?
 *   Bitcoin: miners + nodes in stable Nash equilibrium → 1.0
 *   Hyperinflation: governments break the equilibrium → near 0
 *
 * DIMENSION 3 — Cantillon⁻¹ (Inverse Monetary Distance)
 *   How close is an average participant to money creation?
 *   Bitcoin: any miner is equally close → 1.0
 *   Central bank → primary dealers → banks → public: 4 hops → low score
 *
 * DIMENSION 4 — Gödel (External Axiom Independence)
 *   Does the system require trust in a human institution to function?
 *   Bitcoin: SHA-256 is a physical axiom, not a human institution → 1.0
 *   Fiat: requires trust in state sovereignty → 0.05–0.40
 *   CBDCs: 100% state-dependent → near 0
 *
 * FORMULA:
 *   Ψ = (L × N × C × G)^(1/4) × 100   [geometric mean × 100]
 *   Score 0–100:  100 = perfect physical alignment, 0 = fully arbitrary
 *
 * CATEGORIES:
 *   sovereign  — cryptographically sovereign (BTC, sBTC)
 *   defi       — decentralized finance tokens
 *   crypto     — cryptocurrencies (non-sovereign)
 *   cbdc       — central bank digital currencies
 *   commodity  — physically-backed (gold, silver)
 *   special    — SDR, reserve instruments
 *   g7fiat     — G7 major fiat currencies
 *   g20fiat    — G20 emerging market currencies
 *   mena       — Middle East & North Africa
 *   africa     — Sub-Saharan Africa
 *   asia       — Asian currencies (non-G20)
 *   latam      — Latin America (non-G20)
 *   europe     — European (non-G7)
 *   distressed — currencies in hyperinflation or crisis
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type CurrencyCategory =
  | "sovereign"   // Bitcoin-native, cryptographically sovereign
  | "defi"        // Stacks/FW ecosystem DeFi
  | "crypto"      // Cryptocurrencies
  | "cbdc"        // Central Bank Digital Currencies
  | "commodity"   // Physically-backed instruments
  | "special"     // SDR, reserve instruments
  | "g7fiat"      // G7 major fiat
  | "g20fiat"     // G20 emerging market fiat
  | "mena"        // Middle East & North Africa
  | "africa"      // Sub-Saharan Africa
  | "asia"        // Asian (non-G20)
  | "latam"       // Latin America (non-G20)
  | "europe"      // European (non-G7)
  | "distressed"; // Hyperinflation / crisis currencies

export interface CurrencyRecord {
  code:       string;           // ISO 4217 or ticker
  name:       string;
  category:   CurrencyCategory;
  country?:   string;           // ISO 3166-1 alpha-2 or region
  // Ψ dimensions (0–1)
  landauer:   number;           // energy cost of creation
  nash:       number;           // equilibrium stability
  cantillon:  number;           // inverse monetary distance
  godel:      number;           // external axiom independence
  // Derived
  psi:        number;           // 0–100 composite
  rank:       number;           // global rank (set after all computed)
  // Metadata
  iso4217:    boolean;          // official ISO 4217 code
  notes:      string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Ψ Computation
// ══════════════════════════════════════════════════════════════════════════════

function computePsi(L: number, N: number, C: number, G: number): number {
  // Geometric mean of 4 dimensions × 100
  // If any dimension is 0, the entire score collapses (multiplicative penalty)
  const product = L * N * C * G;
  if (product <= 0) return 0;
  return Math.round((Math.pow(product, 0.25) * 100) * 10) / 10;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPLETE WORLD CURRENCY DATABASE
// ══════════════════════════════════════════════════════════════════════════════

const RAW_CURRENCIES: Omit<CurrencyRecord, "psi" | "rank">[] = [

  // ── SOVEREIGN (Bitcoin-native) ─────────────────────────────────────────────
  {
    code: "BTC",  name: "Bitcoin",
    category: "sovereign", country: "global",
    landauer: 1.00, nash: 1.00, cantillon: 1.00, godel: 1.00,
    iso4217: false,
    notes: "SHA-256 PoW: maximum Landauer energy cost. Perfect Nash equilibrium " +
           "(miners + nodes). Any miner equally close to creation (Cantillon=1). " +
           "SHA-256 is a physical axiom, not a human institution (Gödel=1).",
  },
  {
    code: "sBTC", name: "sBTC (Bitcoin on Stacks)",
    category: "sovereign", country: "global",
    landauer: 0.97, nash: 0.97, cantillon: 0.97, godel: 0.97,
    iso4217: false,
    notes: "1:1 peg to Bitcoin, redeemable on-chain. Inherits Bitcoin's Ψ " +
           "with minimal discount for peg mechanism trust.",
  },
  {
    code: "XBT",  name: "Bitcoin (ISO code)",
    category: "sovereign", country: "global",
    landauer: 1.00, nash: 1.00, cantillon: 1.00, godel: 1.00,
    iso4217: true,
    notes: "Same as BTC — ISO 4217 unofficial ticker used by Bloomberg/Reuters.",
  },

  // ── FLYING WHALE DEFI ECOSYSTEM ───────────────────────────────────────────
  {
    code: "STX",  name: "Stacks",
    category: "defi", country: "global",
    landauer: 0.78, nash: 0.72, cantillon: 0.82, godel: 0.75,
    iso4217: false,
    notes: "Proof-of-Transfer (PoX): anchored to Bitcoin's PoW — inherits " +
           "Landauer energy cost indirectly. Any STX holder can Stack " +
           "(high Cantillon inverse). Bitcoin is the external axiom (Gödel).",
  },
  {
    code: "WHALE", name: "Flying Whale Token",
    category: "defi", country: "global",
    landauer: 0.72, nash: 0.78, cantillon: 0.85, godel: 0.80,
    iso4217: false,
    notes: "FW gate-gated sovereign intelligence token. Nash equilibrium " +
           "enforced by whale-gate-v1 contract. On-chain IP registered. " +
           "Genesis agent: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.",
  },
  {
    code: "wSTX", name: "Wrapped STX",
    category: "defi", country: "global",
    landauer: 0.75, nash: 0.70, cantillon: 0.80, godel: 0.73,
    iso4217: false,
    notes: "Wrapped STX for DeFi protocols. Inherits STX Ψ with small discount " +
           "for wrapping mechanism.",
  },
  {
    code: "stSTX", name: "Stacked STX",
    category: "defi", country: "global",
    landauer: 0.76, nash: 0.73, cantillon: 0.79, godel: 0.74,
    iso4217: false,
    notes: "Liquid stacking derivative. BTC yield-bearing STX token.",
  },
  {
    code: "ALEX",  name: "ALEX DeFi Token",
    category: "defi", country: "global",
    landauer: 0.60, nash: 0.65, cantillon: 0.70, godel: 0.65,
    iso4217: false,
    notes: "ALEX DEX governance + liquidity token on Stacks.",
  },

  // ── CRYPTOCURRENCIES ──────────────────────────────────────────────────────
  {
    code: "ETH",  name: "Ethereum",
    category: "crypto", country: "global",
    landauer: 0.42, nash: 0.68, cantillon: 0.55, godel: 0.65,
    iso4217: false,
    notes: "Post-Merge PoS: Landauer reduced vs PoW. Nash equilibrium via " +
           "validator staking. 32 ETH minimum stake raises Cantillon barrier. " +
           "Ethereum Foundation is a quasi-external axiom (Gödel partial).",
  },
  {
    code: "SOL",  name: "Solana",
    category: "crypto", country: "global",
    landauer: 0.30, nash: 0.55, cantillon: 0.45, godel: 0.50,
    iso4217: false,
    notes: "PoH + PoS: high throughput reduces energy cost (Landauer low). " +
           "Validator concentration reduces Nash stability and Cantillon score. " +
           "Multiple network outages indicate equilibrium fragility.",
  },
  {
    code: "BNB",  name: "BNB Chain",
    category: "crypto", country: "global",
    landauer: 0.25, nash: 0.50, cantillon: 0.35, godel: 0.40,
    iso4217: false,
    notes: "Delegated PoS, 21 validators. High centralization. Binance is " +
           "effectively the Gödel axiom (single entity trust).",
  },
  {
    code: "XRP",  name: "XRP / Ripple",
    category: "crypto", country: "global",
    landauer: 0.15, nash: 0.50, cantillon: 0.30, godel: 0.35,
    iso4217: false,
    notes: "Federated Byzantine Agreement: no mining (Landauer ~0). " +
           "Ripple Labs controls validator list (low Gödel independence).",
  },
  {
    code: "ADA",  name: "Cardano",
    category: "crypto", country: "global",
    landauer: 0.35, nash: 0.60, cantillon: 0.55, godel: 0.58,
    iso4217: false,
    notes: "Ouroboros PoS: peer-reviewed design improves Nash. Input-Output " +
           "Holdings is external authority (Gödel partial).",
  },
  {
    code: "DOT",  name: "Polkadot",
    category: "crypto", country: "global",
    landauer: 0.32, nash: 0.58, cantillon: 0.50, godel: 0.55,
    iso4217: false,
    notes: "NPoS consensus. Parachain model adds Nash complexity. " +
           "Web3 Foundation governance (Gödel partial).",
  },
  {
    code: "AVAX", name: "Avalanche",
    category: "crypto", country: "global",
    landauer: 0.33, nash: 0.60, cantillon: 0.52, godel: 0.55,
    iso4217: false,
    notes: "Snowball consensus. Sub-second finality. Ava Labs governance.",
  },
  {
    code: "LINK", name: "Chainlink",
    category: "crypto", country: "global",
    landauer: 0.20, nash: 0.55, cantillon: 0.45, godel: 0.45,
    iso4217: false,
    notes: "Oracle network token. Not a base layer — value derived from " +
           "oracle service. Chainlink Labs is central authority.",
  },
  {
    code: "UNI",  name: "Uniswap",
    category: "crypto", country: "global",
    landauer: 0.18, nash: 0.55, cantillon: 0.50, godel: 0.50,
    iso4217: false,
    notes: "DEX governance token. Ethereum-based. Uniswap Labs controls " +
           "protocol upgrades.",
  },
  {
    code: "MATIC", name: "Polygon",
    category: "crypto", country: "global",
    landauer: 0.28, nash: 0.55, cantillon: 0.48, godel: 0.50,
    iso4217: false,
    notes: "Ethereum L2 scaling. Polygon Labs governance.",
  },
  {
    code: "LTC",  name: "Litecoin",
    category: "crypto", country: "global",
    landauer: 0.75, nash: 0.72, cantillon: 0.80, godel: 0.78,
    iso4217: false,
    notes: "Scrypt PoW: real energy cost (Landauer high). Oldest PoW alt-chain. " +
           "No controlling entity — decentralized (Gödel near Bitcoin).",
  },
  {
    code: "XMR",  name: "Monero",
    category: "crypto", country: "global",
    landauer: 0.80, nash: 0.78, cantillon: 0.88, godel: 0.82,
    iso4217: false,
    notes: "RandomX PoW: ASIC-resistant, CPU mining accessible to all " +
           "(high Cantillon inverse). No premine, no foundation control. " +
           "Privacy-preserving. High Gödel independence.",
  },
  {
    code: "BCH",  name: "Bitcoin Cash",
    category: "crypto", country: "global",
    landauer: 0.85, nash: 0.70, cantillon: 0.82, godel: 0.78,
    iso4217: false,
    notes: "SHA-256 PoW Bitcoin fork. Real energy cost. Smaller network than " +
           "BTC reduces Nash stability.",
  },
  {
    code: "DOGE", name: "Dogecoin",
    category: "crypto", country: "global",
    landauer: 0.60, nash: 0.58, cantillon: 0.72, godel: 0.60,
    iso4217: false,
    notes: "Scrypt PoW merge-mined with LTC. No supply cap (Cantillon " +
           "partial). Community-driven with no central authority.",
  },
  {
    code: "TRX",  name: "TRON",
    category: "crypto", country: "global",
    landauer: 0.20, nash: 0.45, cantillon: 0.30, godel: 0.35,
    iso4217: false,
    notes: "DPoS: 27 super-representatives. Justin Sun controls foundation. " +
           "High centralization (low Cantillon, low Gödel).",
  },
  {
    code: "ATOM", name: "Cosmos",
    category: "crypto", country: "global",
    landauer: 0.32, nash: 0.60, cantillon: 0.52, godel: 0.55,
    iso4217: false,
    notes: "Tendermint BFT. Inter-blockchain communication (IBC). " +
           "Interchain Foundation governance.",
  },
  {
    code: "NEAR", name: "NEAR Protocol",
    category: "crypto", country: "global",
    landauer: 0.28, nash: 0.55, cantillon: 0.48, godel: 0.50,
    iso4217: false,
    notes: "Nightshade sharding. NEAR Foundation governance.",
  },
  {
    code: "ICP",  name: "Internet Computer",
    category: "crypto", country: "global",
    landauer: 0.25, nash: 0.50, cantillon: 0.35, godel: 0.40,
    iso4217: false,
    notes: "DFINITY Foundation controls NNS governance. High centralization.",
  },
  {
    code: "FIL",  name: "Filecoin",
    category: "crypto", country: "global",
    landauer: 0.55, nash: 0.58, cantillon: 0.55, godel: 0.55,
    iso4217: false,
    notes: "Proof-of-Storage: real energy cost for data storage. " +
           "Protocol Labs governance.",
  },
  {
    code: "APT",  name: "Aptos",
    category: "crypto", country: "global",
    landauer: 0.28, nash: 0.52, cantillon: 0.42, godel: 0.45,
    iso4217: false,
    notes: "BFT consensus. Aptos Labs (ex-Meta Libra team). High centralization.",
  },
  {
    code: "SUI",  name: "Sui",
    category: "crypto", country: "global",
    landauer: 0.27, nash: 0.52, cantillon: 0.42, godel: 0.45,
    iso4217: false,
    notes: "Mysticeti consensus. Mysten Labs (ex-Meta). High centralization.",
  },

  // ── CBDCs ─────────────────────────────────────────────────────────────────
  {
    code: "eCNY", name: "Digital Yuan (e-CNY)",
    category: "cbdc", country: "CN",
    landauer: 0.02, nash: 0.40, cantillon: 0.02, godel: 0.03,
    iso4217: false,
    notes: "People's Bank of China CBDC. Zero energy cost (centralized DB). " +
           "Maximum Cantillon concentration (PBoC creates directly). " +
           "Total state dependency (Gödel ~0). Built-in programmable expiry.",
  },
  {
    code: "eNGN", name: "eNaira (Nigeria)",
    category: "cbdc", country: "NG",
    landauer: 0.02, nash: 0.30, cantillon: 0.03, godel: 0.04,
    iso4217: false,
    notes: "Central Bank of Nigeria CBDC. 98% failure rate adoption. " +
           "Currency crisis parallel (NGN hyperinflation risk).",
  },
  {
    code: "DCASH", name: "DCash (Eastern Caribbean)",
    category: "cbdc", country: "LC",
    landauer: 0.02, nash: 0.35, cantillon: 0.04, godel: 0.05,
    iso4217: false,
    notes: "Eastern Caribbean Central Bank CBDC. 8 Caribbean nations. " +
           "Multi-state model improves Nash slightly vs single-nation.",
  },
  {
    code: "BAKONG", name: "Bakong (Cambodia)",
    category: "cbdc", country: "KH",
    landauer: 0.02, nash: 0.38, cantillon: 0.03, godel: 0.04,
    iso4217: false,
    notes: "National Bank of Cambodia CBDC. Blockchain-based but centralized.",
  },
  {
    code: "JAMDEX", name: "Jam-Dex (Jamaica)",
    category: "cbdc", country: "JM",
    landauer: 0.02, nash: 0.32, cantillon: 0.03, godel: 0.04,
    iso4217: false,
    notes: "Bank of Jamaica CBDC. First legal tender CBDC in Americas.",
  },
  {
    code: "SAND", name: "Digital Sand Dollar (Bahamas)",
    category: "cbdc", country: "BS",
    landauer: 0.02, nash: 0.35, cantillon: 0.04, godel: 0.05,
    iso4217: false,
    notes: "Central Bank of Bahamas CBDC. First launched CBDC globally (2020).",
  },
  {
    code: "eEUR", name: "Digital Euro (planned)",
    category: "cbdc", country: "EU",
    landauer: 0.02, nash: 0.42, cantillon: 0.03, godel: 0.04,
    iso4217: false,
    notes: "ECB digital euro. Still in development phase. Privacy concerns " +
           "from programmability (Gödel near 0). EU political stability " +
           "slightly improves Nash vs single-nation CBDCs.",
  },
  {
    code: "eFED", name: "Digital Dollar (proposed)",
    category: "cbdc", country: "US",
    landauer: 0.02, nash: 0.42, cantillon: 0.03, godel: 0.04,
    iso4217: false,
    notes: "US Federal Reserve digital dollar. Not yet launched. " +
           "Political opposition from Congress. Would eliminate banking privacy.",
  },

  // ── COMMODITY MONEY ───────────────────────────────────────────────────────
  {
    code: "XAU", name: "Gold",
    category: "commodity", country: "global",
    landauer: 0.62, nash: 0.75, cantillon: 0.45, godel: 0.68,
    iso4217: true,
    notes: "Physical mining requires significant energy (Landauer medium-high). " +
           "9,000+ year monetary history = strong Nash equilibrium. " +
           "Mining dominated by corporations (Cantillon medium). " +
           "Physical rarity is a chemical/physical axiom (Gödel high).",
  },
  {
    code: "XAG", name: "Silver",
    category: "commodity", country: "global",
    landauer: 0.55, nash: 0.68, cantillon: 0.55, godel: 0.65,
    iso4217: true,
    notes: "Similar to Gold but more accessible mining (higher Cantillon). " +
           "Significant industrial use stabilizes price (Nash medium-high).",
  },
  {
    code: "XPT", name: "Platinum",
    category: "commodity", country: "global",
    landauer: 0.65, nash: 0.60, cantillon: 0.40, godel: 0.62,
    iso4217: true,
    notes: "Rarer than gold, high energy mining. Less monetary history " +
           "than gold (Nash medium). South Africa dominates supply.",
  },
  {
    code: "XPD", name: "Palladium",
    category: "commodity", country: "global",
    landauer: 0.68, nash: 0.58, cantillon: 0.38, godel: 0.60,
    iso4217: true,
    notes: "Russia dominates supply (40%). High energy mining. Volatile price.",
  },

  // ── SPECIAL INSTRUMENTS ───────────────────────────────────────────────────
  {
    code: "XDR", name: "Special Drawing Rights (SDR)",
    category: "special", country: "global",
    landauer: 0.03, nash: 0.45, cantillon: 0.05, godel: 0.08,
    iso4217: true,
    notes: "IMF reserve asset basket (USD 43.4%, EUR 29.3%, CNY 12.3%, JPY 7.6%, " +
           "GBP 7.4%). No physical backing (Landauer ~0). IMF is the Gödel axiom. " +
           "Global institution stability improves Nash slightly.",
  },
  {
    code: "XTS", name: "Test Currency Code",
    category: "special", country: "global",
    landauer: 0.01, nash: 0.01, cantillon: 0.01, godel: 0.01,
    iso4217: true,
    notes: "ISO 4217 reserved for testing — no monetary properties.",
  },

  // ── G7 FIAT CURRENCIES ────────────────────────────────────────────────────
  {
    code: "USD", name: "US Dollar",
    category: "g7fiat", country: "US",
    landauer: 0.05, nash: 0.72, cantillon: 0.08, godel: 0.38,
    iso4217: true,
    notes: "World reserve currency: highest Nash stability among fiat " +
           "(global equilibrium). Fed → primary dealers → banks → public " +
           "(4-hop Cantillon chain). Petrodollar system requires US " +
           "military/state trust (Gödel = US government is the axiom).",
  },
  {
    code: "EUR", name: "Euro",
    category: "g7fiat", country: "EU",
    landauer: 0.05, nash: 0.65, cantillon: 0.07, godel: 0.32,
    iso4217: true,
    notes: "19 → 20 nation monetary union: Nash reduced by political fragility " +
           "(see: Greek/Italian debt crises). ECB → banks → public. " +
           "EU political stability = Gödel axiom (lower than USD).",
  },
  {
    code: "GBP", name: "British Pound Sterling",
    category: "g7fiat", country: "GB",
    landauer: 0.05, nash: 0.68, cantillon: 0.08, godel: 0.35,
    iso4217: true,
    notes: "Oldest fiat currency still in use (1694 Bank of England). " +
           "Post-Brexit uncertainty reduced Nash slightly.",
  },
  {
    code: "JPY", name: "Japanese Yen",
    category: "g7fiat", country: "JP",
    landauer: 0.05, nash: 0.65, cantillon: 0.07, godel: 0.33,
    iso4217: true,
    notes: "Yield curve control (YCC) by BoJ creates Nash instability. " +
           "World's most-indebted developed country (debt/GDP ~260%). " +
           "Safe haven status despite fundamentals (Nash paradox).",
  },
  {
    code: "CAD", name: "Canadian Dollar",
    category: "g7fiat", country: "CA",
    landauer: 0.05, nash: 0.67, cantillon: 0.08, godel: 0.34,
    iso4217: true,
    notes: "Petrocurrency (oil-correlated). Bank of Canada independence " +
           "improves Gödel slightly vs political currencies.",
  },
  {
    code: "AUD", name: "Australian Dollar",
    category: "g7fiat", country: "AU",
    landauer: 0.05, nash: 0.66, cantillon: 0.08, godel: 0.33,
    iso4217: true,
    notes: "Commodity-correlated (iron ore, coal). Reserve Bank of Australia " +
           "independent mandate.",
  },
  {
    code: "CHF", name: "Swiss Franc",
    category: "g7fiat", country: "CH",
    landauer: 0.05, nash: 0.75, cantillon: 0.10, godel: 0.42,
    iso4217: true,
    notes: "Highest Gödel among fiat: 700+ year Swiss institutional stability. " +
           "SNB independence, gold-correlated, neutral sovereignty. " +
           "Best-performing G7 fiat in Ψ framework.",
  },

  // ── G20 EMERGING MARKET FIAT ──────────────────────────────────────────────
  {
    code: "CNY", name: "Chinese Yuan / Renminbi",
    category: "g20fiat", country: "CN",
    landauer: 0.05, nash: 0.58, cantillon: 0.05, godel: 0.22,
    iso4217: true,
    notes: "Capital controls restrict Nash equilibrium (market cannot clear). " +
           "PBoC directly controlled by CCP (Gödel = CCP axiom). " +
           "Cantillon extremely low: SOEs first in line for credit.",
  },
  {
    code: "INR", name: "Indian Rupee",
    category: "g20fiat", country: "IN",
    landauer: 0.05, nash: 0.58, cantillon: 0.07, godel: 0.28,
    iso4217: true,
    notes: "Growing economy with strong central bank independence (RBI). " +
           "Demonetization history reduces trust (Nash penalty). UPI digital " +
           "payments revolution partially improves Cantillon access.",
  },
  {
    code: "BRL", name: "Brazilian Real",
    category: "g20fiat", country: "BR",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.25,
    iso4217: true,
    notes: "History of hyperinflation (Plano Real 1994 stabilized). " +
           "High interest rates required for Nash stability. " +
           "Bolsonaro-era central bank independence concerns.",
  },
  {
    code: "RUB", name: "Russian Ruble",
    category: "g20fiat", country: "RU",
    landauer: 0.05, nash: 0.38, cantillon: 0.05, godel: 0.18,
    iso4217: true,
    notes: "SWIFT sanctions (2022) broke global Nash equilibrium for RUB. " +
           "Capital controls imposed. Currency weaponized by state. " +
           "Petrocurrency but sanctions-constrained.",
  },
  {
    code: "MXN", name: "Mexican Peso",
    category: "g20fiat", country: "MX",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.25,
    iso4217: true,
    notes: "USD-correlated (NAFTA/USMCA). Remittance-driven economy. " +
           "Drug cartel economic distortions reduce Nash.",
  },
  {
    code: "KRW", name: "South Korean Won",
    category: "g20fiat", country: "KR",
    landauer: 0.05, nash: 0.63, cantillon: 0.08, godel: 0.30,
    iso4217: true,
    notes: "Strong industrial economy. Bank of Korea independence moderate. " +
           "Chaebols have preferred credit access (Cantillon medium-low).",
  },
  {
    code: "IDR", name: "Indonesian Rupiah",
    category: "g20fiat", country: "ID",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.24,
    iso4217: true,
    notes: "1997 Asian crisis history. Commodity-correlated (palm oil, coal). " +
           "Bank Indonesia maintains managed float.",
  },
  {
    code: "TRY", name: "Turkish Lira",
    category: "g20fiat", country: "TR",
    landauer: 0.05, nash: 0.28, cantillon: 0.05, godel: 0.12,
    iso4217: true,
    notes: "Presidential interference with central bank = broken Nash. " +
           "80%+ inflation (2022). Multiple currency crises. " +
           "Erdogan-era rate cuts during inflation (anti-equilibrium).",
  },
  {
    code: "SAR", name: "Saudi Riyal",
    category: "g20fiat", country: "SA",
    landauer: 0.05, nash: 0.62, cantillon: 0.05, godel: 0.25,
    iso4217: true,
    notes: "USD peg maintained since 1986 = borrowed Nash stability. " +
           "Oil-backed but concentrated in Saudi royal family (Cantillon low). " +
           "SAMA independent but royally influenced.",
  },
  {
    code: "ZAR", name: "South African Rand",
    category: "g20fiat", country: "ZA",
    landauer: 0.05, nash: 0.50, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "High unemployment, load-shedding energy crisis. SARB independence " +
           "credible but political pressure mounting.",
  },
  {
    code: "ARS", name: "Argentine Peso",
    category: "distressed", country: "AR",
    landauer: 0.05, nash: 0.12, cantillon: 0.04, godel: 0.08,
    iso4217: true,
    notes: "9 sovereign defaults. Currency caps. Blue-dollar parallel market. " +
           "Peronist money printing = Nash collapse. 200%+ inflation (2023). " +
           "IMF dependency reduces Gödel independence.",
  },

  // ── MIDDLE EAST & NORTH AFRICA ────────────────────────────────────────────
  {
    code: "AED", name: "UAE Dirham",
    category: "mena", country: "AE",
    landauer: 0.05, nash: 0.65, cantillon: 0.06, godel: 0.28,
    iso4217: true,
    notes: "USD peg: borrowed Nash stability. Dubai/Abu Dhabi financial hub " +
           "status. Oil-backed sovereign wealth. CBUAE credibility high.",
  },
  {
    code: "KWD", name: "Kuwaiti Dinar",
    category: "mena", country: "KW",
    landauer: 0.05, nash: 0.65, cantillon: 0.06, godel: 0.28,
    iso4217: true,
    notes: "World's highest-valued currency unit (~3.27 USD). " +
           "Oil-backed sovereign wealth fund. Currency basket peg.",
  },
  {
    code: "BHD", name: "Bahraini Dinar",
    category: "mena", country: "BH",
    landauer: 0.05, nash: 0.62, cantillon: 0.06, godel: 0.25,
    iso4217: true,
    notes: "USD peg. Smaller oil reserves than Kuwait/Saudi. Saudi Arabia " +
           "bailout dependency reduces Gödel independence.",
  },
  {
    code: "QAR", name: "Qatari Riyal",
    category: "mena", country: "QA",
    landauer: 0.05, nash: 0.63, cantillon: 0.06, godel: 0.26,
    iso4217: true,
    notes: "World's largest LNG exporter per capita. USD peg. " +
           "Qatar Investment Authority = sovereign wealth buffer.",
  },
  {
    code: "OMR", name: "Omani Rial",
    category: "mena", country: "OM",
    landauer: 0.05, nash: 0.60, cantillon: 0.06, godel: 0.24,
    iso4217: true,
    notes: "USD peg. Diversification away from oil underway. " +
           "Oman Vision 2040 structural reform.",
  },
  {
    code: "JOD", name: "Jordanian Dinar",
    category: "mena", country: "JO",
    landauer: 0.05, nash: 0.58, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "USD peg. Non-oil economy — stability through USD borrowing. " +
           "US aid-dependent. Jordan key US ally in MENA.",
  },
  {
    code: "ILS", name: "Israeli New Shekel",
    category: "mena", country: "IL",
    landauer: 0.05, nash: 0.63, cantillon: 0.08, godel: 0.30,
    iso4217: true,
    notes: "Tech-driven economy. Bank of Israel independent and credible. " +
           "2023 judicial reform threatened institutional Gödel axiom.",
  },
  {
    code: "EGP", name: "Egyptian Pound",
    category: "mena", country: "EG",
    landauer: 0.05, nash: 0.40, cantillon: 0.05, godel: 0.18,
    iso4217: true,
    notes: "Multiple devaluations (2022-2023). IMF program. " +
           "Tourism and Suez Canal revenues. High political control of CBE.",
  },
  {
    code: "MAD", name: "Moroccan Dirham",
    category: "mena", country: "MA",
    landauer: 0.05, nash: 0.52, cantillon: 0.06, godel: 0.22,
    iso4217: true,
    notes: "Currency basket peg (EUR 60%, USD 40%). Stable monarchy. " +
           "Bank Al-Maghrib credibility moderate.",
  },
  {
    code: "TND", name: "Tunisian Dinar",
    category: "mena", country: "TN",
    landauer: 0.05, nash: 0.42, cantillon: 0.06, godel: 0.18,
    iso4217: true,
    notes: "Post-revolution political instability. IMF program. " +
           "Saied presidential consolidation of power reduces Gödel.",
  },
  {
    code: "DZD", name: "Algerian Dinar",
    category: "mena", country: "DZ",
    landauer: 0.05, nash: 0.45, cantillon: 0.05, godel: 0.18,
    iso4217: true,
    notes: "Hydrocarbon-dependent economy. State controls all major sectors. " +
           "Parallel dollar market. Parallel exchange rate 2× official.",
  },
  {
    code: "IQD", name: "Iraqi Dinar",
    category: "mena", country: "IQ",
    landauer: 0.05, nash: 0.42, cantillon: 0.05, godel: 0.15,
    iso4217: true,
    notes: "Post-war reconstruction currency. Oil revenue-backed. " +
           "Political fragmentation and corruption reduce Nash/Gödel.",
  },
  {
    code: "LBP", name: "Lebanese Pound",
    category: "distressed", country: "LB",
    landauer: 0.05, nash: 0.03, cantillon: 0.02, godel: 0.02,
    iso4217: true,
    notes: "TOTAL COLLAPSE: 98% depreciation (2019-2023). Banque du Liban " +
           "Ponzi scheme exposed. Political deadlock (3+ years no president). " +
           "Multiple parallel exchange rates. Banking system insolvent. " +
           "Lowest Ψ score of any currency with remaining institutional form.",
  },
  {
    code: "SYP", name: "Syrian Pound",
    category: "distressed", country: "SY",
    landauer: 0.05, nash: 0.04, cantillon: 0.02, godel: 0.02,
    iso4217: true,
    notes: "Civil war (2011-present) destroyed monetary system. " +
           "Multiple currencies in circulation by different factions. " +
           "97%+ depreciation. No functioning central bank.",
  },
  {
    code: "YER", name: "Yemeni Rial",
    category: "distressed", country: "YE",
    landauer: 0.05, nash: 0.04, cantillon: 0.02, godel: 0.02,
    iso4217: true,
    notes: "Two central banks (Houthi north vs government south). " +
           "Ongoing civil war. Severe humanitarian crisis. Currency fragmented.",
  },
  {
    code: "SDG", name: "Sudanese Pound",
    category: "distressed", country: "SD",
    landauer: 0.05, nash: 0.08, cantillon: 0.03, godel: 0.05,
    iso4217: true,
    notes: "2023 coup destroyed remaining institutional order. " +
           "Hyperinflation. Parallel market rate 3-5× official.",
  },
  {
    code: "LYD", name: "Libyan Dinar",
    category: "mena", country: "LY",
    landauer: 0.05, nash: 0.30, cantillon: 0.05, godel: 0.12,
    iso4217: true,
    notes: "Two governments, two central banks (Tripoli/Benghazi). " +
           "Oil-backed but politically split. UN-recognized vs Haftar CBL.",
  },

  // ── AFRICAN CURRENCIES ────────────────────────────────────────────────────
  {
    code: "NGN", name: "Nigerian Naira",
    category: "africa", country: "NG",
    landauer: 0.05, nash: 0.35, cantillon: 0.05, godel: 0.15,
    iso4217: true,
    notes: "Multiple devaluations. FX restrictions. Oil-dependent. " +
           "2023 devaluation: 40%+ in one day. CBN credibility damaged.",
  },
  {
    code: "KES", name: "Kenyan Shilling",
    category: "africa", country: "KE",
    landauer: 0.05, nash: 0.50, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "East African financial hub. M-Pesa mobile money leader. " +
           "CBK credibility moderate. USD debt burden rising.",
  },
  {
    code: "GHS", name: "Ghanaian Cedi",
    category: "africa", country: "GH",
    landauer: 0.05, nash: 0.38, cantillon: 0.06, godel: 0.18,
    iso4217: true,
    notes: "2022 debt default. 50%+ depreciation. IMF bailout. " +
           "Strong democratic institutions provide some Nash stability.",
  },
  {
    code: "ETB", name: "Ethiopian Birr",
    category: "africa", country: "ET",
    landauer: 0.05, nash: 0.38, cantillon: 0.05, godel: 0.15,
    iso4217: true,
    notes: "Africa's fastest growing economy (pre-Tigray war). " +
           "Tigray conflict 2020-2022 disrupted Nash equilibrium. " +
           "Capital controls. Birr devalued 30% (2020).",
  },
  {
    code: "TZS", name: "Tanzanian Shilling",
    category: "africa", country: "TZ",
    landauer: 0.05, nash: 0.48, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "Stable single-party governance provides Nash floor. " +
           "Resource-backed economy (gold, tanzanite).",
  },
  {
    code: "UGX", name: "Ugandan Shilling",
    category: "africa", country: "UG",
    landauer: 0.05, nash: 0.42, cantillon: 0.06, godel: 0.18,
    iso4217: true,
    notes: "Long Museveni reign provides political Nash stability " +
           "at cost of Gödel independence (executive controls BOU).",
  },
  {
    code: "ZMW", name: "Zambian Kwacha",
    category: "africa", country: "ZM",
    landauer: 0.05, nash: 0.38, cantillon: 0.06, godel: 0.17,
    iso4217: true,
    notes: "2020 debt default (first sub-Saharan during COVID). " +
           "Copper-dependent. Chinese debt restructuring ongoing.",
  },
  {
    code: "RWF", name: "Rwandan Franc",
    category: "africa", country: "RW",
    landauer: 0.05, nash: 0.52, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "Rwanda: best governance scores in Africa (WB). " +
           "Kagame's centralized development model is Nash-stable but " +
           "authoritarian (Gödel = Kagame is the axiom).",
  },
  {
    code: "XOF", name: "West African CFA Franc",
    category: "africa", country: "XO",
    landauer: 0.05, nash: 0.55, cantillon: 0.05, godel: 0.20,
    iso4217: true,
    notes: "8 WAEMU nations. EUR-pegged (French Treasury guaranteed). " +
           "Stability borrowed from EUR (Nash medium). " +
           "French colonial monetary structure (Cantillon: Paris-first). " +
           "Sovereignty debate ongoing (Guinea, Mali, Burkina anti-CFA).",
  },
  {
    code: "XAF", name: "Central African CFA Franc",
    category: "africa", country: "XA",
    landauer: 0.05, nash: 0.52, cantillon: 0.05, godel: 0.20,
    iso4217: true,
    notes: "6 CEMAC nations. Same EUR-peg mechanism as XOF. " +
           "Oil-dependent (Cameroon, Chad, Gabon, Congo, Equatorial Guinea). " +
           "French Treasury as Gödel backstop.",
  },
  {
    code: "ZWL", name: "Zimbabwean Dollar",
    category: "distressed", country: "ZW",
    landauer: 0.05, nash: 0.05, cantillon: 0.02, godel: 0.03,
    iso4217: true,
    notes: "World record hyperinflation: 89.7 sextillion % (Nov 2008). " +
           "Abandoned 2009, re-issued 2019, still collapsing. " +
           "USD circulates in parallel. RBZ credibility = near 0.",
  },

  // ── ASIAN CURRENCIES ─────────────────────────────────────────────────────
  {
    code: "HKD", name: "Hong Kong Dollar",
    category: "asia", country: "HK",
    landauer: 0.05, nash: 0.68, cantillon: 0.09, godel: 0.30,
    iso4217: true,
    notes: "USD peg since 1983 (linked exchange rate). High Nash through peg. " +
           "2019 National Security Law reduced Gödel independence. " +
           "HKMA currency board mechanism provides Nash stability.",
  },
  {
    code: "SGD", name: "Singapore Dollar",
    category: "asia", country: "SG",
    landauer: 0.05, nash: 0.72, cantillon: 0.09, godel: 0.38,
    iso4217: true,
    notes: "MAS (Monetary Authority of Singapore): most credible Asian CB. " +
           "Currency basket management. Rule of law strongest in Asia. " +
           "Best Gödel score among Asian fiat (institutional independence).",
  },
  {
    code: "MYR", name: "Malaysian Ringgit",
    category: "asia", country: "MY",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.25,
    iso4217: true,
    notes: "Oil/gas and palm oil export economy. BNM manages float. " +
           "1998 capital controls memory. 1MDB scandal reduced trust.",
  },
  {
    code: "THB", name: "Thai Baht",
    category: "asia", country: "TH",
    landauer: 0.05, nash: 0.58, cantillon: 0.07, godel: 0.26,
    iso4217: true,
    notes: "1997 Asian crisis epicenter. BOT rebuilt credibility. " +
           "Tourism-dependent. Military coup history reduces Gödel.",
  },
  {
    code: "PHP", name: "Philippine Peso",
    category: "asia", country: "PH",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.24,
    iso4217: true,
    notes: "Remittance-dependent (10% of GDP from OFWs). BSP credibility good. " +
           "Dollar-dollarized economy (high USD use domestically).",
  },
  {
    code: "VND", name: "Vietnamese Dong",
    category: "asia", country: "VN",
    landauer: 0.05, nash: 0.52, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "Managed float against USD. Communist party controls SBV. " +
           "Manufacturing boom improving economic fundamentals.",
  },
  {
    code: "PKR", name: "Pakistani Rupee",
    category: "asia", country: "PK",
    landauer: 0.05, nash: 0.30, cantillon: 0.05, godel: 0.12,
    iso4217: true,
    notes: "IMF-dependent. Political chaos (Imran Khan arrest). " +
           "50%+ depreciation (2022-2023). SBP independence compromised.",
  },
  {
    code: "BDT", name: "Bangladeshi Taka",
    category: "asia", country: "BD",
    landauer: 0.05, nash: 0.50, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "Garment export driven. Bangladesh Bank credibility moderate. " +
           "FX reserves fell sharply (2022-2023). IMF program.",
  },
  {
    code: "LKR", name: "Sri Lankan Rupee",
    category: "distressed", country: "LK",
    landauer: 0.05, nash: 0.20, cantillon: 0.04, godel: 0.08,
    iso4217: true,
    notes: "2022 COMPLETE ECONOMIC COLLAPSE: first IMF default in Asia in decades. " +
           "Tax cuts + COVID = fiscal ruin. 80%+ depreciation. " +
           "President fled country. CBSL credibility destroyed.",
  },
  {
    code: "NPR", name: "Nepalese Rupee",
    category: "asia", country: "NP",
    landauer: 0.05, nash: 0.45, cantillon: 0.06, godel: 0.18,
    iso4217: true,
    notes: "INR-pegged. Remittance-dependent. Political instability.",
  },
  {
    code: "MMK", name: "Myanmar Kyat",
    category: "distressed", country: "MM",
    landauer: 0.05, nash: 0.12, cantillon: 0.03, godel: 0.05,
    iso4217: true,
    notes: "Military coup (Feb 2021) destroyed institutional order. " +
           "Civil war ongoing. Parallel exchange rate. SWIFT cut off.",
  },
  {
    code: "KZT", name: "Kazakhstani Tenge",
    category: "asia", country: "KZ",
    landauer: 0.05, nash: 0.50, cantillon: 0.05, godel: 0.20,
    iso4217: true,
    notes: "Oil-dependent. January 2022 political unrest. " +
           "NBK maintains managed float. Russian orbit proximity.",
  },
  {
    code: "UZS", name: "Uzbekistani Som",
    category: "asia", country: "UZ",
    landauer: 0.05, nash: 0.45, cantillon: 0.05, godel: 0.18,
    iso4217: true,
    notes: "Post-Karimov reforms. Growing economy. CBU credibility building.",
  },

  // ── LATIN AMERICAN CURRENCIES ────────────────────────────────────────────
  {
    code: "CLP", name: "Chilean Peso",
    category: "latam", country: "CL",
    landauer: 0.05, nash: 0.58, cantillon: 0.08, godel: 0.26,
    iso4217: true,
    notes: "Copper-correlated. BCCh independence strong. " +
           "2019 social unrest, 2022 constitution rejection provided Nash floor.",
  },
  {
    code: "COP", name: "Colombian Peso",
    category: "latam", country: "CO",
    landauer: 0.05, nash: 0.52, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "Oil and coffee. BanRep credibility good. Petro government " +
           "2022 increased Gödel uncertainty.",
  },
  {
    code: "PEN", name: "Peruvian Sol",
    category: "latam", country: "PE",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.24,
    iso4217: true,
    notes: "BCRP one of Latin America's most credible central banks. " +
           "Political instability (5 presidents in 5 years) but CB held firm.",
  },
  {
    code: "UYU", name: "Uruguayan Peso",
    category: "latam", country: "UY",
    landauer: 0.05, nash: 0.55, cantillon: 0.08, godel: 0.26,
    iso4217: true,
    notes: "Best governance in South America. BCP credibility high. " +
           "High USD-ization but institutional quality above peers.",
  },
  {
    code: "VES", name: "Venezuelan Bolívar Soberano",
    category: "distressed", country: "VE",
    landauer: 0.05, nash: 0.04, cantillon: 0.01, godel: 0.02,
    iso4217: true,
    notes: "HYPERINFLATION: 1,000,000%+ (2018). Currency redenominated 3× " +
           "(1,000,000,000,000 old bolivars = 1 new). BCV has zero independence. " +
           "Maduro directly controls money supply. Oil revenues collapsed.",
  },
  {
    code: "BOB", name: "Bolivian Boliviano",
    category: "latam", country: "BO",
    landauer: 0.05, nash: 0.50, cantillon: 0.07, godel: 0.20,
    iso4217: true,
    notes: "Managed float. Coca/gas economy. BCB credibility moderate. " +
           "FX reserves fell sharply (2022-2023) due to subsidies.",
  },

  // ── EUROPEAN (non-G7) ─────────────────────────────────────────────────────
  {
    code: "NOK", name: "Norwegian Krone",
    category: "europe", country: "NO",
    landauer: 0.05, nash: 0.70, cantillon: 0.09, godel: 0.36,
    iso4217: true,
    notes: "Oil Fund sovereign wealth: world's largest (>$1.7 trillion). " +
           "Norges Bank independent. Petrocurrency with strong institutional " +
           "buffer (highest Gödel among non-G7 European fiat).",
  },
  {
    code: "SEK", name: "Swedish Krona",
    category: "europe", country: "SE",
    landauer: 0.05, nash: 0.68, cantillon: 0.09, godel: 0.34,
    iso4217: true,
    notes: "Riksbank (oldest central bank in world, 1668). " +
           "Strong institutions. Cashless society pioneer.",
  },
  {
    code: "DKK", name: "Danish Krone",
    category: "europe", country: "DK",
    landauer: 0.05, nash: 0.70, cantillon: 0.09, godel: 0.34,
    iso4217: true,
    notes: "EUR peg (ERM II) since 1999. Danmarks Nationalbank credible. " +
           "High institutional quality. Greenland/Faroe administrative note.",
  },
  {
    code: "PLN", name: "Polish Zloty",
    category: "europe", country: "PL",
    landauer: 0.05, nash: 0.60, cantillon: 0.08, godel: 0.27,
    iso4217: true,
    notes: "EU member, not eurozone. NBP faced political pressure (2020-2023). " +
           "Strong economy but central bank politicization reduces Gödel.",
  },
  {
    code: "CZK", name: "Czech Koruna",
    category: "europe", country: "CZ",
    landauer: 0.05, nash: 0.62, cantillon: 0.08, godel: 0.29,
    iso4217: true,
    notes: "EU member. ČNB known for bold rate decisions. " +
           "Export-oriented industrial economy.",
  },
  {
    code: "HUF", name: "Hungarian Forint",
    category: "europe", country: "HU",
    landauer: 0.05, nash: 0.52, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "Orbán government reduced MNB independence. " +
           "30%+ inflation peak (2023). EU rule-of-law sanctions.",
  },
  {
    code: "RON", name: "Romanian Leu",
    category: "europe", country: "RO",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.24,
    iso4217: true,
    notes: "EU member. BNR credibility moderate. " +
           "High wage growth post-COVID caused inflation.",
  },
  {
    code: "HRK", name: "Croatian Kuna",
    category: "europe", country: "HR",
    landauer: 0.05, nash: 0.60, cantillon: 0.08, godel: 0.26,
    iso4217: true,
    notes: "REPLACED by EUR on Jan 1 2023. Croatia joined eurozone. " +
           "HRK no longer issued — historical record.",
  },
  {
    code: "RSD", name: "Serbian Dinar",
    category: "europe", country: "RS",
    landauer: 0.05, nash: 0.52, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "EU candidate country. NBS manages EUR-correlated float. " +
           "Strong Serbian dinar stability despite regional tensions.",
  },
  {
    code: "UAH", name: "Ukrainian Hryvnia",
    category: "distressed", country: "UA",
    landauer: 0.05, nash: 0.22, cantillon: 0.05, godel: 0.12,
    iso4217: true,
    notes: "Russian invasion (2022): wartime currency. Capital controls imposed. " +
           "NBU pegged to USD (emergency stability measure). " +
           "IMF + EU support maintains minimum Nash floor. War-distressed.",
  },
  {
    code: "GEL", name: "Georgian Lari",
    category: "europe", country: "GE",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.24,
    iso4217: true,
    notes: "NBG independent. Rose Revolution legacy of institutional reform. " +
           "Crypto-friendly jurisdiction (significant BTC mining).",
  },
  {
    code: "AMD", name: "Armenian Dram",
    category: "europe", country: "AM",
    landauer: 0.05, nash: 0.50, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "CBA credibility growing. Nagorno-Karabakh conflict resolved (2023). " +
           "Crypto friendly — significant Russian capital inflow (2022).",
  },
  {
    code: "AZN", name: "Azerbaijani Manat",
    category: "europe", country: "AZ",
    landauer: 0.05, nash: 0.52, cantillon: 0.05, godel: 0.20,
    iso4217: true,
    notes: "Oil-backed. State oil company SOCAR dominant. CBA managed by Aliyev.",
  },
  {
    code: "ISK", name: "Icelandic Króna",
    category: "europe", country: "IS",
    landauer: 0.05, nash: 0.62, cantillon: 0.10, godel: 0.30,
    iso4217: true,
    notes: "2008 banking crisis: 3 major banks failed (9× GDP). " +
           "Recovery via capital controls + IMF. CBI credibility rebuilt. " +
           "Geothermal + hydroelectric = potential for sovereign Bitcoin mining.",
  },
  {
    code: "MKD", name: "Macedonian Denar",
    category: "europe", country: "MK",
    landauer: 0.05, nash: 0.52, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "EUR-pegged. NBRM credible. EU candidate (joined NATO 2020).",
  },
  {
    code: "ALL", name: "Albanian Lek",
    category: "europe", country: "AL",
    landauer: 0.05, nash: 0.50, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "Bank of Albania credibility moderate. EU candidate. " +
           "Remittance-dependent. Dollarization partially via EUR.",
  },
  {
    code: "BAM", name: "Bosnia-Herzegovina Convertible Mark",
    category: "europe", country: "BA",
    landauer: 0.05, nash: 0.55, cantillon: 0.06, godel: 0.22,
    iso4217: true,
    notes: "EUR-pegged currency board. Dayton Agreement monetary institution. " +
           "CBBH (currency board) provides Nash stability via EUR anchor.",
  },
  {
    code: "MDL", name: "Moldovan Leu",
    category: "europe", country: "MD",
    landauer: 0.05, nash: 0.42, cantillon: 0.06, godel: 0.18,
    iso4217: true,
    notes: "War spillover effects from Ukraine. BNM credibility improving " +
           "under pro-EU leadership.",
  },
  {
    code: "BYR", name: "Belarusian Ruble",
    category: "distressed", country: "BY",
    landauer: 0.05, nash: 0.25, cantillon: 0.04, godel: 0.10,
    iso4217: true,
    notes: "Lukashenko economic control. SWIFT sanctions (partial). " +
           "Russian orbit — monetary sovereignty limited.",
  },

  // ── MORE G20 / MAJOR ─────────────────────────────────────────────────────
  {
    code: "NZD", name: "New Zealand Dollar",
    category: "g7fiat", country: "NZ",
    landauer: 0.05, nash: 0.67, cantillon: 0.08, godel: 0.34,
    iso4217: true,
    notes: "RBNZ first central bank to target inflation explicitly (1990). " +
           "Strong rule of law. Agricultural commodity correlated.",
  },

  // ── PACIFIC / OCEANIA ────────────────────────────────────────────────────
  {
    code: "FJD", name: "Fijian Dollar",
    category: "asia", country: "FJ",
    landauer: 0.05, nash: 0.48, cantillon: 0.07, godel: 0.20,
    iso4217: true,
    notes: "Tourism-dependent island economy. RBF credibility moderate.",
  },
  {
    code: "PGK", name: "Papua New Guinea Kina",
    category: "asia", country: "PG",
    landauer: 0.05, nash: 0.42, cantillon: 0.06, godel: 0.17,
    iso4217: true,
    notes: "Resource-rich but governance challenges. BPNG managed float.",
  },
  {
    code: "WST", name: "Samoan Tālā",
    category: "asia", country: "WS",
    landauer: 0.05, nash: 0.48, cantillon: 0.07, godel: 0.20,
    iso4217: true,
    notes: "Island economy. CBS managed float. Remittance-dependent.",
  },

  // ── STABLECOINS (reference only) ─────────────────────────────────────────
  {
    code: "USDC", name: "USD Coin",
    category: "crypto", country: "global",
    landauer: 0.02, nash: 0.50, cantillon: 0.04, godel: 0.08,
    iso4217: false,
    notes: "Circle-issued stablecoin. Reserve-backed (USD + US Treasuries). " +
           "No PoW energy cost (Landauer low). Nash via USD peg + Circle audit. " +
           "Cantillon low (Circle creates on demand). Gödel = Circle/USDC trust.",
  },
  {
    code: "USDT", name: "Tether",
    category: "crypto", country: "global",
    landauer: 0.02, nash: 0.45, cantillon: 0.03, godel: 0.06,
    iso4217: false,
    notes: "Tether Limited issuer. Reserve audit opacity reduces Gödel. " +
           "Largest stablecoin by volume. Nash via USD peg. " +
           "Lower than USDC due to audit transparency concerns.",
  },
  {
    code: "DAI",  name: "Dai (MakerDAO)",
    category: "crypto", country: "global",
    landauer: 0.25, nash: 0.58, cantillon: 0.42, godel: 0.50,
    iso4217: false,
    notes: "Overcollateralized decentralized stablecoin. ETH/BTC backed. " +
           "Smart contract as Gödel axiom (higher than Tether). " +
           "MakerDAO governance token (MKR) creates centralization risk.",
  },
  {
    code: "aeUSDC", name: "Wrapped USDC (Stacks)",
    category: "defi", country: "global",
    landauer: 0.02, nash: 0.50, cantillon: 0.04, godel: 0.10,
    iso4217: false,
    notes: "USDC bridged to Stacks. Inherits USDC Ψ with Stacks Bitcoin " +
           "anchoring providing marginal Gödel improvement.",
  },

  // ── ADDITIONAL SIGNIFICANT CURRENCIES ────────────────────────────────────
  {
    code: "IRR", name: "Iranian Rial",
    category: "distressed", country: "IR",
    landauer: 0.05, nash: 0.15, cantillon: 0.03, godel: 0.05,
    iso4217: true,
    notes: "SWIFT sanctions since 2012. 500%+ cumulative depreciation. " +
           "Multiple exchange rates. Revolutionary Guard economic control.",
  },
  {
    code: "AFN", name: "Afghan Afghani",
    category: "distressed", country: "AF",
    landauer: 0.05, nash: 0.15, cantillon: 0.03, godel: 0.05,
    iso4217: true,
    notes: "Taliban takeover (Aug 2021). USD reserves frozen. " +
           "Banking system near collapse. DAB under Taliban control.",
  },
  {
    code: "CUP", name: "Cuban Peso",
    category: "distressed", country: "CU",
    landauer: 0.05, nash: 0.18, cantillon: 0.03, godel: 0.05,
    iso4217: true,
    notes: "US embargo since 1962. Dual currency system ended 2021. " +
           "BCC under Communist Party control. Severe shortages.",
  },
  {
    code: "KPW", name: "North Korean Won",
    category: "distressed", country: "KP",
    landauer: 0.05, nash: 0.05, cantillon: 0.01, godel: 0.02,
    iso4217: true,
    notes: "Kim regime currency. No external market. " +
           "Sanctions-isolated. USD/CNY used domestically. Pure political money.",
  },
  {
    code: "MNT", name: "Mongolian Tögrög",
    category: "asia", country: "MN",
    landauer: 0.05, nash: 0.48, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "Mining economy (coal, copper). BOM managed float. " +
           "Chinese economic orbit. Mongolian Bitcoin mining growing.",
  },
  {
    code: "TWD", name: "Taiwan Dollar",
    category: "asia", country: "TW",
    landauer: 0.05, nash: 0.65, cantillon: 0.09, godel: 0.30,
    iso4217: true,
    notes: "CBC credibility high. Tech export powerhouse (TSMC). " +
           "Geopolitical risk (China claims) reduces Gödel ceiling.",
  },
  {
    code: "CRC", name: "Costa Rican Colón",
    category: "latam", country: "CR",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.24,
    iso4217: true,
    notes: "Best governance in Central America. BCCR credible. " +
           "Environmental sustainability leader.",
  },
  {
    code: "GTQ", name: "Guatemalan Quetzal",
    category: "latam", country: "GT",
    landauer: 0.05, nash: 0.50, cantillon: 0.07, godel: 0.20,
    iso4217: true,
    notes: "Most stable Central American currency. Banguat credibility moderate.",
  },
  {
    code: "HNL", name: "Honduran Lempira",
    category: "latam", country: "HN",
    landauer: 0.05, nash: 0.45, cantillon: 0.06, godel: 0.18,
    iso4217: true,
    notes: "Remittance-heavy economy. BCH managed devaluation.",
  },
  {
    code: "NIO", name: "Nicaraguan Córdoba",
    category: "latam", country: "NI",
    landauer: 0.05, nash: 0.38, cantillon: 0.05, godel: 0.15,
    iso4217: true,
    notes: "Ortega regime. Sanctions. BCN controlled by government.",
  },
  {
    code: "DOP", name: "Dominican Peso",
    category: "latam", country: "DO",
    landauer: 0.05, nash: 0.52, cantillon: 0.07, godel: 0.22,
    iso4217: true,
    notes: "Tourism and services. BCRD credibility moderate. " +
           "Caribbean financial hub aspirations.",
  },
  {
    code: "TTD", name: "Trinidad and Tobago Dollar",
    category: "latam", country: "TT",
    landauer: 0.05, nash: 0.55, cantillon: 0.07, godel: 0.24,
    iso4217: true,
    notes: "Oil and gas dependent. CBTT managed float. " +
           "USD-pegged de facto.",
  },
  {
    code: "JMD", name: "Jamaican Dollar",
    category: "latam", country: "JM",
    landauer: 0.05, nash: 0.48, cantillon: 0.06, godel: 0.20,
    iso4217: true,
    notes: "Tourism and remittances. BOJ credibility improving. " +
           "First legal tender CBDC (Jam-Dex) launched.",
  },
  {
    code: "BWP", name: "Botswana Pula",
    category: "africa", country: "BW",
    landauer: 0.05, nash: 0.58, cantillon: 0.08, godel: 0.26,
    iso4217: true,
    notes: "Best governance in Africa (WB). Diamond-backed wealth. " +
           "BoBW credibility high. Peer of SGD for institutional quality.",
  },
  {
    code: "MUR", name: "Mauritian Rupee",
    category: "africa", country: "MU",
    landauer: 0.05, nash: 0.55, cantillon: 0.08, godel: 0.24,
    iso4217: true,
    notes: "Diversified service economy. BOM credibility moderate. " +
           "Financial hub aspirations.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Build final database with computed Ψ scores and ranks
// ══════════════════════════════════════════════════════════════════════════════

function buildDatabase(): CurrencyRecord[] {
  const records: CurrencyRecord[] = RAW_CURRENCIES.map((r) => ({
    ...r,
    psi:  computePsi(r.landauer, r.nash, r.cantillon, r.godel),
    rank: 0,  // set below
  }));

  // Sort by Ψ score descending — rank 1 = highest Ψ
  records.sort((a, b) => b.psi - a.psi);
  records.forEach((r, i) => { r.rank = i + 1; });

  return records;
}

// Singleton — computed once at module load
export const WORLD_CURRENCIES: CurrencyRecord[] = buildDatabase();

// ══════════════════════════════════════════════════════════════════════════════
// Query helpers
// ══════════════════════════════════════════════════════════════════════════════

/** Look up a single currency by code (case-insensitive). */
export function getCurrency(code: string): CurrencyRecord | undefined {
  const upper = code.toUpperCase();
  return WORLD_CURRENCIES.find((c) => c.code.toUpperCase() === upper);
}

/** Get all currencies in a category, sorted by Ψ descending. */
export function getCurrenciesByCategory(category: CurrencyCategory): CurrencyRecord[] {
  return WORLD_CURRENCIES.filter((c) => c.category === category);
}

/** Get top N currencies by Ψ score. */
export function getTopCurrencies(n: number): CurrencyRecord[] {
  return WORLD_CURRENCIES.slice(0, n);
}

/** Get currencies in distress (Ψ < threshold). */
export function getDistressedCurrencies(threshold = 10): CurrencyRecord[] {
  return WORLD_CURRENCIES
    .filter((c) => c.psi < threshold)
    .sort((a, b) => a.psi - b.psi);
}

/** Search currencies by code, name, or country. */
export function searchCurrencies(query: string): CurrencyRecord[] {
  const q = query.toLowerCase();
  return WORLD_CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (c.country?.toLowerCase().includes(q) ?? false)
  );
}

/** Summary statistics for the entire database. */
export function getDatabaseStats() {
  const total    = WORLD_CURRENCIES.length;
  const avgPsi   = Math.round(WORLD_CURRENCIES.reduce((s, c) => s + c.psi, 0) / total * 10) / 10;
  const byCategory: Record<string, number> = {};

  for (const c of WORLD_CURRENCIES) {
    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
  }

  return {
    total,
    avgPsi,
    byCategory,
    highest: WORLD_CURRENCIES[0],
    lowest:  WORLD_CURRENCIES[WORLD_CURRENCIES.length - 1],
  };
}
