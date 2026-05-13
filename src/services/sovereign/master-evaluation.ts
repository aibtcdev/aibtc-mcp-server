/**
 * Master Evaluation — التقييم الشامل الكامل
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE GRAND SYNTHESIS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This module is the capstone of the entire Ψ system.
 * It evaluates what was built, identifies every gap, and provides the
 * global frameworks needed to complete the vision of:
 *
 *   — Zero harm to any civilian on Earth
 *   — Zero sovereignty violation of any government
 *   — Complete debt liberation for all 195 nations
 *   — Renaissance of every economy in every sector
 *   — International cooperation without hegemony
 *   — Profits that are shared, not extracted
 *   — Trust that is earned, not imposed
 *   — Data that belongs to its creators
 *   — Assets protected, not exploited
 *   — Public interest always above private profit
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * EVALUATION DIMENSIONS (20 total)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *  1. ما تم بناؤه      What was built — inventory
 *  2. النواقص          Gaps — what's missing
 *  3. الأهداف          Goals — complete statement
 *  4. الخطط            Implementation plans
 *  5. الكماليات        What would make it perfect
 *  6. الأمان والخصوصية Security & privacy assessment
 *  7. الفوائد          Benefits — who, how much, when
 *  8. الديون           Debt liberation — status and path
 *  9. نهضة الأمم       National renaissance — assessment
 * 10. الدساتير         Constitutional frameworks
 * 11. القوانين          Legal frameworks
 * 12. التشارك العالمي   International cooperation
 * 13. الأرباح والانعاش  Profit model and economic revival
 * 14. الاحترام والثقة   Respect and trust framework
 * 15. المخاطر          Risk identification
 * 16. النوايا           Intention classification
 * 17. الأصول           Assets registry
 * 18. البيانات          Data sovereignty
 * 19. الحماية          Protection completeness
 * 20. المصلحة العامة   Public interest doctrine
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type CompletionStatus = "complete" | "partial" | "planned" | "missing";
export type RiskCategory = "technical" | "monetary" | "geopolitical" | "social" | "legal" | "environmental";
export type IntentCategory = "constructive" | "neutral" | "opportunistic" | "adversarial" | "hostile";
export type BeneficiaryType = "individual" | "community" | "nation" | "global";

export interface BuiltComponent {
  id:           string;
  name:         string;
  arabic:       string;
  description:  string;
  status:       CompletionStatus;
  completeness: number;   // 0–100%
  tools_count:  number;
  gaps:         string[];
}

export interface GlobalGoal {
  id:           string;
  goal:         string;
  arabic:       string;
  why:          string;
  timeline:     string;
  measurable:   string;   // how we know it's achieved
  status:       CompletionStatus;
  blocking_gap: string | null;
}

export interface RiskProfile {
  id:           string;
  name:         string;
  arabic:       string;
  category:     RiskCategory;
  probability:  "low" | "medium" | "high";
  impact:       "low" | "medium" | "high" | "catastrophic";
  description:  string;
  affected:     string[];
  mitigation:   string;
  residual:     "acceptable" | "monitor" | "critical";
  owner:        string;   // who is responsible for mitigating
}

export interface IntentProfile {
  actor_type:   string;
  arabic:       string;
  intent:       IntentCategory;
  description:  string;
  detection:    string;   // how to identify this actor
  response:     string;   // how system responds
  examples:     string[];
}

export interface AssetClass {
  id:           string;
  name:         string;
  arabic:       string;
  type:         "natural" | "financial" | "digital" | "intellectual" | "human" | "infrastructure";
  description:  string;
  sovereignty:  "national" | "individual" | "shared" | "global_commons";
  protection:   string;
  monetization: string;   // how it creates value for its sovereign
}

export interface DataCategory {
  id:           string;
  name:         string;
  arabic:       string;
  sovereignty:  "individual" | "national" | "organizational" | "public";
  sensitivity:  "public" | "private" | "confidential" | "sovereign";
  description:  string;
  protection:   string;
  monetization: string | null;
  cross_border: string;   // rules for cross-border transfer
}

export interface CooperationModel {
  id:           string;
  name:         string;
  arabic:       string;
  parties:      string;
  mechanism:    string;
  benefit_sharing: string;
  decision_making: string;
  exit_clause:  string;
  example:      string;
}

export interface PublicInterestRule {
  id:           string;
  principle:    string;
  arabic:       string;
  when_applies: string;
  override:     string;   // what private right it overrides
  conditions:   string[];
  limits:       string;   // even public interest has limits
  example:      string;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. INVENTORY OF BUILT COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

export const BUILT_COMPONENTS: BuiltComponent[] = [
  {
    id: "BC-01",
    name: "Ψ Equation Core",
    arabic: "معادلة Ψ الأساسية",
    description: "Landauer · Nash · Cantillon⁻¹ · Gödel — 4-dimensional monetary integrity scoring for 29 currencies",
    status: "complete", completeness: 90, tools_count: 3,
    gaps: ["Only 29 currencies; 166 remaining ISO currencies not scored", "No real-time data feeds — scores are static"],
  },
  {
    id: "BC-02",
    name: "Universal Ψ Protocol",
    arabic: "البروتوكول العالمي Ψ",
    description: "SHA-256 anchored chain-agnostic compliance envelope — Bitcoin, Stacks, Ethereum, Lightning, Solana",
    status: "complete", completeness: 95, tools_count: 8,
    gaps: ["Cosmos/IBC integration not yet built", "ZK-proof circuit not yet implemented (currently simulated)"],
  },
  {
    id: "BC-03",
    name: "Sanctions & AML System",
    arabic: "نظام العقوبات ومكافحة غسيل الأموال",
    description: "OFAC BTC/ETH lists, FATF blacklist/greylist, AML pattern detection (structuring, smurfing, velocity)",
    status: "complete", completeness: 85, tools_count: 5,
    gaps: ["OFAC list is static — no live update feed", "No integration with real-time FATF updates", "Missing EU/UK sanctions lists"],
  },
  {
    id: "BC-04",
    name: "Constitutional Registry",
    arabic: "سجل الدساتير",
    description: "26 jurisdictions with crypto legal status, AML framework, reporting thresholds, VASP licensing",
    status: "partial", completeness: 13, tools_count: 3,
    gaps: ["Only 26 of 195 UN member states", "169 countries completely missing", "No update mechanism when laws change"],
  },
  {
    id: "BC-05",
    name: "National Debt Oracle",
    arabic: "أوراكل الديون السيادية",
    description: "16-nation database with 7-phase liberation plan, BTC invariant $14.6M, mining opportunities",
    status: "partial", completeness: 8, tools_count: 6,
    gaps: ["Only 16 of 195 nations profiled", "179 nations missing", "No IMF/World Bank live data feeds", "Debt figures static"],
  },
  {
    id: "BC-06",
    name: "Renaissance Engine",
    arabic: "محرك النهضة",
    description: "30-year projection, government x402 model, Cantillon-equitable monetary expansion",
    status: "complete", completeness: 80, tools_count: 6,
    gaps: ["Projections assume constant BTC growth rate — no uncertainty bounds", "No country-specific custom projections beyond 16 nations"],
  },
  {
    id: "BC-07",
    name: "PSI Oracle",
    arabic: "أوراكل PSI الموحد",
    description: "Single unified call: address+chain+jurisdiction → full 8-layer intelligence in one response",
    status: "complete", completeness: 92, tools_count: 3,
    gaps: ["Real-time whale balance requires live blockchain query — currently estimated", "8-layer response time could be slow on cold start"],
  },
  {
    id: "BC-08",
    name: "Grand Unified System",
    arabic: "النظام الموحد الكبير",
    description: "Constitution (12 articles), Adversarial Matrix (17 scenarios), Risks (11), Reforms (6), Monetary Bridge, Stability (8), Reactions Balance (5)",
    status: "complete", completeness: 88, tools_count: 8,
    gaps: ["Constitution needs formal legal review", "Reform catalog is global — needs per-country customization", "Adversarial matrix needs expansion to 50+ scenarios"],
  },
  {
    id: "BC-09",
    name: "Currency Renaissance",
    arabic: "نهضة العملات",
    description: "8 per-currency renaissance plans (LBP, NGN, ARS, USD, EUR, JPY, INR, SAR) with Ψ reforms",
    status: "partial", completeness: 4, tools_count: 5,
    gaps: ["Only 8 of 180 fiat currencies covered", "172 currencies missing", "Multi-currency x402 conversion rates are approximate/static"],
  },
  {
    id: "BC-10",
    name: "Zero Harm Protocol",
    arabic: "بروتوكول صفر الأضرار",
    description: "10 civilian rights, 10 government rights, 4 sector guarantees, 10 circuit breakers, 8 harm assessments",
    status: "complete", completeness: 85, tools_count: 7,
    gaps: ["Harm assessments cover only 8 actions of potentially hundreds", "Circuit breakers are logic only — no live monitoring infrastructure yet", "No whistleblower protection clause"],
  },
  {
    id: "BC-11",
    name: "Ψ Hash Chain",
    arabic: "سلسلة Ψ المؤمنة",
    description: "SHA-256 tamper-evident chain at ~/.aibtc/psi-chain.json — every score auto-appended",
    status: "complete", completeness: 80, tools_count: 2,
    gaps: ["Chain stored locally — not globally distributed or verifiable by third parties", "No cross-chain anchoring of the chain itself"],
  },
  {
    id: "BC-12",
    name: "Cognitive Injection Defense",
    arabic: "دفاع ضد الحقن المعرفي",
    description: "R'=f(T,C+δ) defense against AI manipulation — 24 patterns, trust weighting, stance drift",
    status: "complete", completeness: 75, tools_count: 2,
    gaps: ["No integration with external threat intelligence", "Drift detection threshold (ε=0.3) not empirically validated"],
  },
  {
    id: "BC-13",
    name: "Sovereign Ψ Blockchain",
    arabic: "بلوكتشين Ψ السيادي",
    description: "PSI token — 6M supply, Proof of Physics, anti-MEV, quadratic×entropic anti-oligarchy",
    status: "complete", completeness: 70, tools_count: 4,
    gaps: ["Not deployed on mainnet — theoretical implementation", "Governance voting mechanism not implemented", "No bridge to existing chains"],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 2. GLOBAL GOALS
// ══════════════════════════════════════════════════════════════════════════════

export const GLOBAL_GOALS: GlobalGoal[] = [
  {
    id: "GG-01",
    goal: "Complete elimination of extreme monetary poverty",
    arabic: "القضاء الكامل على الفقر النقدي المدقع",
    why: "1.4B people live on <$2/day. Cantillon⁻¹ routing of monetary expansion can reach them directly.",
    timeline: "15 years (2026–2041)",
    measurable: "World Bank extreme poverty rate < 1% globally, down from current 8.5%",
    status: "planned",
    blocking_gap: "Currency renaissance plans cover only 8 currencies; 172 missing",
  },
  {
    id: "GG-02",
    goal: "Global debt reduction to sustainable levels",
    arabic: "تخفيض الديون العالمية إلى مستويات مستدامة",
    why: "$307T global debt = 3× global GDP. Debt service consumes funds that should go to health, education, infrastructure.",
    timeline: "30 years (2026–2056)",
    measurable: "Global debt/GDP ratio < 100% (from current 338%)",
    status: "planned",
    blocking_gap: "Debt oracle covers only 16 nations; 179 missing",
  },
  {
    id: "GG-03",
    goal: "Universal financial inclusion",
    arabic: "الشمول المالي الكامل للجميع",
    why: "1.7B adults are unbanked. x402 + mobile money can reach everyone with smartphone or basic phone.",
    timeline: "10 years (2026–2036)",
    measurable: "Global unbanked rate < 5% (from current 22%)",
    status: "partial",
    blocking_gap: "Multi-currency x402 needs last-mile infrastructure (SMS, USSD) not yet built",
  },
  {
    id: "GG-04",
    goal: "Zero surveillance monetary system",
    arabic: "نظام نقدي بدون مراقبة",
    why: "Financial surveillance is the most powerful form of political control. ZK-KYC proves compliance without revealing identity.",
    timeline: "5 years (2026–2031)",
    measurable: "ZK-KYC deployed in 50+ jurisdictions; no PII required for basic transactions",
    status: "partial",
    blocking_gap: "ZK-proof circuits simulated, not yet deployed; constitutional registry only 26 countries",
  },
  {
    id: "GG-05",
    goal: "Sovereign digital identity for every person",
    arabic: "هوية رقمية سيادية لكل إنسان",
    why: "1.1B people have no legal identity — can't open bank accounts, get healthcare, vote, own property.",
    timeline: "15 years (2026–2041)",
    measurable: "Global digital identity coverage > 95%",
    status: "planned",
    blocking_gap: "ERC-8004 on-chain identity exists but not bridged to government ID systems",
  },
  {
    id: "GG-06",
    goal: "National Renaissance for all 195 UN member states",
    arabic: "نهضة وطنية لكل دول العالم",
    why: "Every nation has unique assets, culture, and path to prosperity. No model fits all.",
    timeline: "30 years (2026–2056)",
    measurable: "All 195 nations with Ψ score > 30 (currently: most < 20)",
    status: "planned",
    blocking_gap: "Renaissance plans exist for only 8 currencies; 172 remaining",
  },
  {
    id: "GG-07",
    goal: "Elimination of predatory remittance costs",
    arabic: "القضاء على تكاليف التحويلات المجحفة",
    why: "Diaspora sends $800B/year in remittances. At 6–8% fee, $48–64B is extracted from the world's poorest.",
    timeline: "3 years (2026–2029)",
    measurable: "Global average remittance cost < 1% (from current 6.2%)",
    status: "partial",
    blocking_gap: "VASP licensing requirements vary by jurisdiction; not yet mapped for all",
  },
  {
    id: "GG-08",
    goal: "Transparent government: all public spending on-chain",
    arabic: "حوكمة شفافة: كل الإنفاق الحكومي على البلوكتشين",
    why: "Corruption costs $2.6T/year globally — 5% of global GDP. On-chain government spending is auditable by any citizen.",
    timeline: "20 years (2026–2046)",
    measurable: "50+ governments with on-chain treasury transparency",
    status: "planned",
    blocking_gap: "x402 government APIs designed; political will implementation roadmap missing",
  },
  {
    id: "GG-09",
    goal: "Resource sovereignty for every nation",
    arabic: "السيادة على الموارد لكل دولة",
    why: "Natural resources (oil, gas, minerals, water) belong to the people — Cantillon⁻¹ model delivers this.",
    timeline: "15 years (2026–2041)",
    measurable: "All commodity nations with citizen dividend programs",
    status: "planned",
    blocking_gap: "Legal frameworks for citizen dividends not yet implemented beyond theoretical model",
  },
  {
    id: "GG-10",
    goal: "Global Ψ standard adopted as international monetary framework",
    arabic: "اعتماد معيار Ψ كإطار نقدي دولي",
    why: "Current IMF SDR basket (5 currencies) represents only dominant powers. Ψ is mathematically fair to all nations.",
    timeline: "20 years (2026–2046)",
    measurable: "IMF or UN body adopts Ψ as supplementary monetary evaluation framework",
    status: "planned",
    blocking_gap: "No international relations strategy; no engagement with IMF/World Bank",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 3. RISK IDENTIFICATION REGISTRY
// ══════════════════════════════════════════════════════════════════════════════

export const GLOBAL_RISKS: RiskProfile[] = [
  {
    id: "GR-01",
    name: "BTC Price Collapse",
    arabic: "انهيار سعر البيتكوين",
    category: "monetary",
    probability: "low",
    impact: "high",
    description: "BTC price falls 90%+. Nations that accumulated BTC reserves face balance sheet losses. Mining-dependent nations lose revenue.",
    affected: ["El Salvador", "All BTC mining nations", "Any nation with >5% BTC reserve"],
    mitigation: "Reserves capped at 3% initial, 10% max. No leverage. Long-term hold with 10-year minimum. Diversified reserve (BTC + gold + foreign currency).",
    residual: "acceptable",
    owner: "National central banks + IMF oversight",
  },
  {
    id: "GR-02",
    name: "Protocol Capture by Hostile State Actor",
    arabic: "استيلاء دولة معادية على البروتوكول",
    category: "geopolitical",
    probability: "low",
    impact: "catastrophic",
    description: "A nation-state with >51% hashrate or code repository control attempts to rewrite protocol rules for geopolitical advantage.",
    affected: ["All protocol users globally", "All governments using protocol"],
    mitigation: "Decentralized development: multiple independent implementations. No single repository. SHA-256 protocol identity is immutable. Any fork that changes GENESIS_HASH is a different protocol.",
    residual: "monitor",
    owner: "Protocol governance multi-sig (15-of-25 global signers)",
  },
  {
    id: "GR-03",
    name: "Mass Unemployment from Automation Wave",
    arabic: "بطالة جماعية من موجة الأتمتة",
    category: "social",
    probability: "high",
    impact: "catastrophic",
    description: "AI + robotics eliminate 40–60% of current jobs by 2040. Without Cantillon⁻¹ reforms, benefits go to capital owners — not displaced workers.",
    affected: ["All civilian workers globally", "Developing nations most severely"],
    mitigation: "Universal Basic Income funded by productivity gains. Citizen dividends from automation tax. Cantillon⁻¹ routing ensures workers receive automation benefits first.",
    residual: "critical",
    owner: "National governments + international coordination (circuit breaker CB-04)",
  },
  {
    id: "GR-04",
    name: "CBDC Surveillance Creep",
    arabic: "تمدد مراقبة العملات الرقمية الحكومية",
    category: "social",
    probability: "high",
    impact: "high",
    description: "Central bank digital currencies implemented with surveillance capabilities — programmable expiry, restricted categories, political freezes.",
    affected: ["All citizens in CBDC-adopting nations", "Political opposition, journalists, civil society"],
    mitigation: "Ψ legal framework explicitly prohibits CBDC surveillance features. ZK architecture requirement. Constitutional protection of private transactions below threshold.",
    residual: "monitor",
    owner: "Civil society + international human rights bodies",
  },
  {
    id: "GR-05",
    name: "Debt Trap Colonialism 2.0",
    arabic: "استعمار فخ الديون 2.0",
    category: "geopolitical",
    probability: "medium",
    impact: "high",
    description: "Nations that borrow to accumulate BTC reserves at peak price become vulnerable to creditors forcing asset sales at bottom.",
    affected: ["Developing nations", "Nations with weak fiscal positions"],
    mitigation: "Ψ protocol explicitly prohibits recommending BTC reserve accumulation via debt. Only surplus reserves. Phase gates require positive fiscal balance before BTC accumulation starts.",
    residual: "acceptable",
    owner: "Protocol harm assessment (HA-01 circuit breaker)",
  },
  {
    id: "GR-06",
    name: "Quantum Computer Cryptographic Break",
    arabic: "كسر التشفير بالحواسيب الكمومية",
    category: "technical",
    probability: "medium",
    impact: "catastrophic",
    description: "Sufficiently powerful quantum computer breaks ECDSA/secp256k1 — invalidates all Bitcoin/Stacks wallets. Estimated timeline: 10–20 years.",
    affected: ["All BTC/STX wallet holders", "All smart contracts", "All signed data"],
    mitigation: "Cosmic Post-Quantum Keys already built (Lamport OTS + XMSS tree). Migration path prepared. Protocol recommends quantum-resistant keys for high-value holdings. 5-year migration window.",
    residual: "monitor",
    owner: "Protocol developers + NIST PQC standards body",
  },
  {
    id: "GR-07",
    name: "Regulatory Balkanization",
    arabic: "تشرذم التنظيم العالمي",
    category: "legal",
    probability: "high",
    impact: "medium",
    description: "Different nations create conflicting crypto regulations, fragmenting the global protocol into incompatible regional variants.",
    affected: ["Cross-border users", "International businesses", "Remittance senders"],
    mitigation: "Constitutional registry encodes all jurisdictional differences. Multi-jurisdiction compliance routing. Protocol treats each jurisdiction as opt-in module, not monolithic.",
    residual: "acceptable",
    owner: "Constitutional registry maintainers",
  },
  {
    id: "GR-08",
    name: "Concentration of Mining Power",
    arabic: "تركز قوة التعدين",
    category: "monetary",
    probability: "medium",
    impact: "high",
    description: "Two or three nation-states control >60% of BTC hashrate — threatening Bitcoin's censorship resistance and geopolitical neutrality.",
    affected: ["All Bitcoin users", "Nations relying on Bitcoin as reserve"],
    mitigation: "Protocol monitors hashrate distribution. Alerts at 40% single-nation concentration. Policy recommendation: energy-diverse mining encouraged across 50+ nations.",
    residual: "monitor",
    owner: "Bitcoin mining community + national governments",
  },
  {
    id: "GR-09",
    name: "Digital Divide Deepening",
    arabic: "تعمق الفجوة الرقمية",
    category: "social",
    probability: "medium",
    impact: "high",
    description: "New system benefits tech-savvy populations while leaving behind rural, elderly, and low-literacy populations. Digital exclusion = economic exclusion.",
    affected: ["Rural populations", "Elderly", "Low-literacy populations", "People with disabilities"],
    mitigation: "SMS/USSD fallback required for all critical services. Local language support mandatory. Simplified interfaces. Agent networks for in-person assistance.",
    residual: "monitor",
    owner: "National governments + civil society (CR-03 circuit breaker)",
  },
  {
    id: "GR-10",
    name: "Protocol Capture by Financial Incumbents",
    arabic: "استيلاء المؤسسات المالية الكبرى على البروتوكول",
    category: "geopolitical",
    probability: "medium",
    impact: "high",
    description: "Large banks, asset managers, or payment processors capture protocol governance and redirect Cantillon benefits back to financial sector.",
    affected: ["All civilians", "Small businesses", "Developing nations"],
    mitigation: "Cantillon⁻¹ hardcoded: citizen priority is protocol invariant, not governance parameter. Financial sector participation capped at 20% of governance votes.",
    residual: "monitor",
    owner: "Protocol governance structure (circuit breaker CB-07)",
  },
  {
    id: "GR-11",
    name: "Energy-Backed Currency Manipulation",
    arabic: "التلاعب بالعملات المدعومة بالطاقة",
    category: "monetary",
    probability: "medium",
    impact: "medium",
    description: "Nations falsify energy production data to claim higher Landauer scores, gaining artificial monetary credibility.",
    affected: ["All nations trusting energy-backed currencies", "Global trade partners"],
    mitigation: "Independent energy verification required (satellite monitoring, smart grid data, third-party audit). Ψ score flags unverified energy backing.",
    residual: "acceptable",
    owner: "International Energy Agency + Ψ oracle verification layer",
  },
  {
    id: "GR-12",
    name: "Sovereign Default Cascade",
    arabic: "سلسلة تعثر سيادي",
    category: "monetary",
    probability: "medium",
    impact: "catastrophic",
    description: "One major nation defaults on debt, triggering contagion across sovereign bond markets, crashing global credit system.",
    affected: ["All nations with external debt", "Global banking system", "Pension funds globally"],
    mitigation: "Ψ 7-phase plan includes orderly debt restructuring before default. Early warning: Ψ scores below 5 trigger mandatory debt sustainability review.",
    residual: "monitor",
    owner: "IMF + G20 + Ψ debt oracle",
  },
  {
    id: "GR-13",
    name: "Environmental Cost of Mining",
    arabic: "التكلفة البيئية للتعدين",
    category: "environmental",
    probability: "high",
    impact: "medium",
    description: "BTC mining energy consumption continues rising. If powered by fossil fuels, Landauer backing principle conflicts with climate obligations.",
    affected: ["Global climate", "Nations near fossil fuel power plants", "Future generations"],
    mitigation: "Ψ Landauer score multiplies by renewable fraction. Fossil-powered mining gets Landauer discount. Only renewable mining qualifies for full Landauer backing.",
    residual: "monitor",
    owner: "Protocol Landauer calculation + national energy policy",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 4. INTENTION CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════════════

export const INTENTION_PROFILES: IntentProfile[] = [
  {
    actor_type: "Sovereign Reform Government",
    arabic: "حكومة الإصلاح السيادي",
    intent: "constructive",
    description: "Government using Ψ system to genuinely reform monetary policy, reduce debt, and improve citizen welfare.",
    detection: "Adopts Cantillon⁻¹ reforms. Implements citizen dividends. Allows independent central bank. Participates in constitutional registry.",
    response: "Full cooperation. Access to all tools. Priority support. Positive Ψ score.",
    examples: ["Norway sovereign wealth fund model", "El Salvador BTC experiment", "Estonia digital governance"],
  },
  {
    actor_type: "Civic Entrepreneur",
    arabic: "رائد الأعمال المدني",
    intent: "constructive",
    description: "Individual or organization building x402 services that create genuine value, paying fair fees, respecting privacy.",
    detection: "ZK-KYC compliant. Fee-sharing model. Open source when possible. No MEV extraction. No data harvesting.",
    response: "Full access. Low fees. Priority routing. Positive Ψ score.",
    examples: ["Local farmer using land registry API", "Developer building remittance app", "NGO deploying aid distribution"],
  },
  {
    actor_type: "Passive Saver",
    arabic: "المدخر السلبي",
    intent: "neutral",
    description: "Ordinary citizen holding savings in BTC/sBTC as store of value. No active trading. No manipulation.",
    detection: "Long HODL pattern. No structured transactions. No velocity anomalies.",
    response: "Privacy protected. No surveillance. ZK compliance. Full access to savings tools.",
    examples: ["Lebanese family protecting savings from LBP inflation", "Nigerian entrepreneur saving in BTC"],
  },
  {
    actor_type: "Yield Optimizer",
    arabic: "محسّن العوائد",
    intent: "neutral",
    description: "DeFi user seeking best yields across protocols. Profit-motivated but operating within rules.",
    detection: "Multi-protocol activity. Velocity within normal bounds. No wash trading. No price manipulation.",
    response: "Normal access. Standard AML monitoring. Velocity alerts if unusual.",
    examples: ["STX stacker", "Zest Protocol supplier", "Bitflow LP provider"],
  },
  {
    actor_type: "Regulatory Arbitrageur",
    arabic: "المستغل للثغرات التنظيمية",
    intent: "opportunistic",
    description: "Actor exploiting differences between jurisdictions to avoid compliance obligations. Not illegal per se but undermines global standards.",
    detection: "Jurisdiction hopping. Shell company structures. Multiple wallets across jurisdictions. FATF greylist routing.",
    response: "Enhanced monitoring. CAUTION flag. Human review for large transactions. FATF reporting where required.",
    examples: ["VASPs registered in low-regulation jurisdiction serving high-regulation users", "Stablecoin issuer avoiding reserve requirements"],
  },
  {
    actor_type: "Dark Market Operator",
    arabic: "مشغل السوق المظلم",
    intent: "adversarial",
    description: "Using crypto for illegal goods/services. Sophisticated mixing, privacy coins, peer-to-peer trading to evade detection.",
    detection: "High-value mixing service interactions. Privacy coin bridges. Unusual velocity + amounts. Structuring patterns.",
    response: "BLOCK. Report to FIU. SAR filing. On-chain evidence preserved.",
    examples: ["Silk Road model", "Drug marketplace", "Weapons trading"],
  },
  {
    actor_type: "Sanctions Evader",
    arabic: "المتهرب من العقوبات",
    intent: "adversarial",
    description: "OFAC/EU/UN-designated entity or individual attempting to use crypto to circumvent sanctions.",
    detection: "Address match against OFAC/EU lists. Jurisdiction match against FATF blacklist. Chainalysis KYT alerts.",
    response: "BLOCK immediately. No exceptions. Report to sanctions authority. Freeze if custodial.",
    examples: ["North Korean state hackers (Lazarus Group)", "IRGC-linked entities"],
  },
  {
    actor_type: "State Capture Actor",
    arabic: "جهة الاستيلاء على الدولة",
    intent: "adversarial",
    description: "Domestic or foreign actor using financial system to capture government institutions, buy political decisions, or concentrate power.",
    detection: "Large irregular payments to government officials. Shell companies linked to political figures. Unusual velocity before elections.",
    response: "CAUTION + REPORT. Transparency to civil society. On-chain evidence preserved.",
    examples: ["Oligarch-linked entities", "Foreign state influence operations"],
  },
  {
    actor_type: "Nation-State Attacker",
    arabic: "المهاجم على مستوى الدولة",
    intent: "hostile",
    description: "Nation-state using financial system as weapon: sanctions evasion at scale, protocol destabilization, supply chain attacks.",
    detection: "Large coordinated transaction patterns. Known state-linked wallet clusters. Infrastructure attack signatures.",
    response: "BLOCK. Multi-stakeholder alert. Escalate to international body. Protocol defense mode.",
    examples: ["Lazarus Group (DPRK)", "State-sponsored ransomware groups"],
  },
  {
    actor_type: "Protocol Extortionist",
    arabic: "مبتز البروتوكول",
    intent: "hostile",
    description: "Actor threatening to disrupt protocol (DDoS, fake compliance reports, media attack) unless paid.",
    detection: "Suspicious report patterns. Off-chain demands. Coordinated negative signals without on-chain evidence.",
    response: "BLOCK. Legal action. Public transparency report. On-chain evidence preserved against false claims.",
    examples: ["Fake compliance reports to damage reputation", "Coordinated 51% attack threats"],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 5. ASSETS REGISTRY
// ══════════════════════════════════════════════════════════════════════════════

export const ASSET_CLASSES: AssetClass[] = [
  {
    id: "AC-01",
    name: "National Natural Resources",
    arabic: "الموارد الطبيعية الوطنية",
    type: "natural",
    description: "Oil, gas, minerals, water, forests, fisheries, arable land. Belong to the nation and its citizens.",
    sovereignty: "national",
    protection: "Constitutional resource sovereignty clause. International resource law (PSNR — Permanent Sovereignty over Natural Resources, UN GA Resolution 1803).",
    monetization: "Cantillon⁻¹ model: resource revenues flow to citizen dividends first, then government, then reinvestment.",
  },
  {
    id: "AC-02",
    name: "Personal Digital Identity",
    arabic: "الهوية الرقمية الشخصية",
    type: "digital",
    description: "Name, biometrics, credentials, certificates, reputation score. Belongs exclusively to the individual.",
    sovereignty: "individual",
    protection: "Right to digital identity. No seizure without due process. ZK-proof model: prove attributes without revealing data.",
    monetization: "Individual may monetize their own identity data only. Cannot be monetized by third parties without explicit, revocable, paid consent.",
  },
  {
    id: "AC-03",
    name: "Intellectual Property & Code",
    arabic: "الملكية الفكرية والكود البرمجي",
    type: "intellectual",
    description: "Software, algorithms, creative works, patents, trade secrets. May be individual, organizational, or national.",
    sovereignty: "individual",
    protection: "ERC-8004 on-chain IP registration. Timestamp proof. Flying Whale IP Store model for immutable registration.",
    monetization: "x402 endpoints: any IP can be monetized via pay-per-access. Creator keeps 100% minus protocol fee.",
  },
  {
    id: "AC-04",
    name: "Government Financial Assets",
    arabic: "الأصول المالية الحكومية",
    type: "financial",
    description: "Foreign currency reserves, gold reserves, sovereign wealth funds, BTC reserves, state-owned enterprises.",
    sovereignty: "national",
    protection: "Constitutional protection. IMF Article IV consultations. Transparent on-chain reserve reporting.",
    monetization: "BTC mining from energy surplus. x402 government API revenue. Sovereign wealth fund returns.",
  },
  {
    id: "AC-05",
    name: "Human Capital",
    arabic: "رأس المال البشري",
    type: "human",
    description: "Skills, education, labor, creativity, innovation capacity of a nation's people. The most valuable asset.",
    sovereignty: "individual",
    protection: "Right to education. Right to employment. Right to economic participation (CR-03). Brain drain prevention through domestic opportunity creation.",
    monetization: "Skill marketplace (x402 model). Remittances kept within family via low-cost rails. Productivity gains from innovation shared equitably.",
  },
  {
    id: "AC-06",
    name: "Digital Infrastructure",
    arabic: "البنية التحتية الرقمية",
    type: "infrastructure",
    description: "Internet, telecommunications, data centers, satellite systems, power grid, financial networks.",
    sovereignty: "national",
    protection: "Critical infrastructure protection law. No foreign ownership without security review. Redundancy requirements.",
    monetization: "Open-access model: infrastructure costs shared, usage fees minimized. Government x402 APIs monetize without rent extraction.",
  },
  {
    id: "AC-07",
    name: "Cultural Heritage",
    arabic: "التراث الثقافي",
    type: "intellectual",
    description: "Language, traditions, history, art, music, food, architecture. Belongs to the people and humanity.",
    sovereignty: "shared",
    protection: "UNESCO conventions. Digital preservation. On-chain inscription for permanence. No privatization of cultural commons.",
    monetization: "Cultural tourism via digital platforms. Artists directly monetized via x402. No extraction by intermediaries.",
  },
  {
    id: "AC-08",
    name: "Environmental Commons",
    arabic: "المشترك البيئي",
    type: "natural",
    description: "Clean air, stable climate, biodiversity, oceans, atmosphere. Belongs to all humanity and future generations.",
    sovereignty: "global_commons",
    protection: "Paris Agreement. Landauer principle: monetary expansion tied to energy efficiency, not extraction. Carbon monitoring via satellite.",
    monetization: "Carbon credit markets (transparent, on-chain). Renewable energy backing for currencies creates financial incentive for green energy.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 6. DATA SOVEREIGNTY FRAMEWORK
// ══════════════════════════════════════════════════════════════════════════════

export const DATA_CATEGORIES: DataCategory[] = [
  {
    id: "DC-01",
    name: "Transaction History",
    arabic: "تاريخ المعاملات",
    sovereignty: "individual",
    sensitivity: "private",
    description: "Who paid what to whom, when. Most sensitive financial data.",
    protection: "ZK proofs only. Regulators see aggregate stats. Individual transactions private unless court order.",
    monetization: null,
    cross_border: "Subject to FATF Travel Rule above threshold ($1,000 EU / $3,000 US). Below threshold: fully private.",
  },
  {
    id: "DC-02",
    name: "KYC Compliance Status",
    arabic: "حالة الامتثال KYC",
    sovereignty: "individual",
    sensitivity: "confidential",
    description: "Whether a person is KYC-compliant. NOT the underlying identity data.",
    protection: "ZK proof: 'person X is KYC-compliant' without revealing name, address, or documents.",
    monetization: null,
    cross_border: "Compliance status shareable across borders. Underlying PII stays in home jurisdiction.",
  },
  {
    id: "DC-03",
    name: "National Economic Statistics",
    arabic: "الإحصاءات الاقتصادية الوطنية",
    sovereignty: "national",
    sensitivity: "public",
    description: "GDP, inflation, unemployment, debt levels. Aggregate data with no individual identification.",
    protection: "Published transparently by government. On-chain anchoring for tamper-evidence.",
    monetization: "Government x402 API: premium analytics access monetized by government",
    cross_border: "Freely shareable. Public data. IMF/World Bank standards apply.",
  },
  {
    id: "DC-04",
    name: "Ψ Score",
    arabic: "نقاط Ψ",
    sovereignty: "individual",
    sensitivity: "private",
    description: "Individual Ψ compliance score derived from on-chain behavior.",
    protection: "Score is derived from public on-chain data — no private data used. Individual may see their own score. Third parties need consent.",
    monetization: "Score holder may grant access to score for services in exchange for fee discount.",
    cross_border: "Score is chain-agnostic and portable. Owner controls who sees it.",
  },
  {
    id: "DC-05",
    name: "Government Spending Records",
    arabic: "سجلات الإنفاق الحكومي",
    sovereignty: "national",
    sensitivity: "public",
    description: "Where government spends money. Should be 100% public and auditable.",
    protection: "On-chain treasury publishing mandatory for Ψ-participating governments. Cannot be deleted or modified.",
    monetization: "Analytics services built on public spending data — third-party revenue",
    cross_border: "Freely shareable. International anti-corruption agencies have access.",
  },
  {
    id: "DC-06",
    name: "Natural Resource Data",
    arabic: "بيانات الموارد الطبيعية",
    sovereignty: "national",
    sensitivity: "confidential",
    description: "Proven reserves, production data, contracts with extractors. Sovereign sensitive.",
    protection: "National sovereignty. International investors get audited summaries, not raw data.",
    monetization: "Accurate resource data = higher Ψ Landauer score = lower borrowing costs",
    cross_border: "Aggregate data for ratings agencies. Detailed data stays national.",
  },
  {
    id: "DC-07",
    name: "Biometric Data",
    arabic: "البيانات البيومترية",
    sovereignty: "individual",
    sensitivity: "confidential",
    description: "Fingerprints, facial recognition, iris scans, voice prints.",
    protection: "Stored ONLY on user device or in national secure enclave. NEVER on protocol servers. Cannot be collected without explicit consent.",
    monetization: null,
    cross_border: "BLOCKED. Biometric data cannot cross borders under any circumstances in this protocol.",
  },
  {
    id: "DC-08",
    name: "Smart Contract Code",
    arabic: "كود العقود الذكية",
    sovereignty: "individual",
    sensitivity: "public",
    description: "Deployed contract logic on-chain. Immutable and publicly visible.",
    protection: "Open source by deployment. Cannot be hidden once deployed. Audit rights are universal.",
    monetization: "IP registered via ERC-8004. Usage fees via x402.",
    cross_border: "Fully portable. Cross-chain by design.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 7. INTERNATIONAL COOPERATION MODELS
// ══════════════════════════════════════════════════════════════════════════════

export const COOPERATION_MODELS: CooperationModel[] = [
  {
    id: "CM-01",
    name: "Ψ Treaty Framework",
    arabic: "إطار معاهدة Ψ",
    parties: "Any 2+ sovereign nations",
    mechanism: "Nations bilaterally adopt Ψ compliance envelope for cross-border transactions. Each nation retains own monetary policy.",
    benefit_sharing: "Reduced remittance costs. Shared fraud detection. Mutual recognition of KYC.",
    decision_making: "Each nation retains veto over its own participation. No supranational authority.",
    exit_clause: "Any nation may exit with 90 days notice. All commitments terminate cleanly.",
    example: "Lebanon + Saudi Arabia Ψ treaty: LBP/SAR corridor with <0.5% fees",
  },
  {
    id: "CM-02",
    name: "Regional Currency Stabilization Compact",
    arabic: "اتفاق استقرار العملة الإقليمي",
    parties: "3–15 nations in a geographic region",
    mechanism: "Participating nations create shared Ψ monitoring fund. When any member currency falls below Ψ threshold, collective support activates.",
    benefit_sharing: "All members benefit from regional currency stability. Trade friction reduced. Tourist exchanges simplified.",
    decision_making: "Supermajority (75%) vote for interventions. Emergency provisions for immediate crises.",
    exit_clause: "12-month notice. 2-year wind-down for active interventions.",
    example: "GCC Currency Stability Compact: SAR, AED, KWD, QAR, OMR, BHD coordinated Ψ monitoring",
  },
  {
    id: "CM-03",
    name: "Commodity Sovereignty Alliance",
    arabic: "تحالف السيادة على السلع",
    parties: "Resource-rich developing nations",
    mechanism: "Nations coordinate pricing, transparency, and citizen dividend mechanisms for their commodities. Landauer anchor applied collectively.",
    benefit_sharing: "Better pricing through coordination. Shared technical expertise. Collective negotiating power.",
    decision_making: "Equal votes regardless of country size. No veto power.",
    exit_clause: "30 days notice. Commodity pricing reverts to bilateral agreements.",
    example: "African Oil Sovereignty Alliance: Nigeria, Angola, Gabon, Congo — coordinated NGN/AOA/CFA citizen dividends",
  },
  {
    id: "CM-04",
    name: "Global Remittance Protocol",
    arabic: "بروتوكول التحويلات العالمي",
    parties: "All willing nations and payment providers",
    mechanism: "Standardized x402 remittance corridors. Any participating nation accepts any other's citizens via BTC/STX bridge. Fees capped at 1%.",
    benefit_sharing: "Sending families save 5–7% per transfer. Receiving nations gain GDP. Both nations gain tax base from formal economy.",
    decision_making: "Open protocol. Any nation joins by implementing standard. No central authority.",
    exit_clause: "Instant. Any node can stop accepting from any other node.",
    example: "India→Nigeria Remittance Corridor: INR→STX→NGN in <10 minutes at 0.8% total fee",
  },
  {
    id: "CM-05",
    name: "Global Debt Restructuring Forum",
    arabic: "منتدى إعادة هيكلة الديون العالمي",
    parties: "Debtor nations + creditor nations + IMF + civil society",
    mechanism: "Structured forum using Ψ debt oracle data for transparent negotiations. BTC reserves as collateral option. 7-phase liberation plans as basis.",
    benefit_sharing: "Creditors receive orderly repayment. Debtors gain breathing room. Citizens of both gain stability.",
    decision_making: "Creditor + debtor consent required. No haircuts without creditor agreement. IMF mediates.",
    exit_clause: "Any party may withdraw, reverting to bilateral negotiation.",
    example: "Lebanon Debt Forum: $90B restructuring using Ψ oracle data + SAR bilateral support",
  },
  {
    id: "CM-06",
    name: "Open Digital Governance Standard",
    arabic: "معيار الحوكمة الرقمية المفتوح",
    parties: "Any willing government",
    mechanism: "Shared open-source government service templates (land registry, business registration, identity, courts). Each nation deploys independently, interoperates via standard APIs.",
    benefit_sharing: "Smaller nations gain enterprise-grade systems. Citizens gain efficient services. Corruption reduced by on-chain transparency.",
    decision_making: "Each nation controls own deployment. Standard evolution via open RFC process.",
    exit_clause: "Instant. Code stays, interoperability ends.",
    example: "Pacific Island Nations Digital Governance Network: Fiji, Vanuatu, Samoa share x402 government APIs",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 8. PUBLIC INTEREST DOCTRINE
// ══════════════════════════════════════════════════════════════════════════════

export const PUBLIC_INTEREST_RULES: PublicInterestRule[] = [
  {
    id: "PI-01",
    principle: "Environmental Survival Override",
    arabic: "أولوية البقاء البيئي",
    when_applies: "When private profit requires environmental destruction that threatens human survival (climate, water, air quality)",
    override: "Private property rights in natural assets",
    conditions: [
      "Scientific consensus on harm (95%+ agreement)",
      "No less harmful alternative exists",
      "Compensation for private loss required",
      "Sunset clause when crisis resolved",
    ],
    limits: "Does not justify confiscation without compensation. Does not override individual rights of people (only property).",
    example: "Oil company must cease operations in sovereign protected watershed — compensated at fair value",
  },
  {
    id: "PI-02",
    principle: "Health Emergency Access",
    arabic: "الوصول في حالات الطوارئ الصحية",
    when_applies: "Global pandemic, epidemic, or health emergency requiring universal access to medicines or protocols",
    override: "Patent rights on medicines or vaccines",
    conditions: [
      "WHO declaration of health emergency",
      "Patent holder unable to supply at needed scale",
      "Compulsory license — not confiscation",
      "Reasonable royalty still paid",
    ],
    limits: "Only for duration of emergency. Royalties still due. Cannot be used for non-emergency price pressure.",
    example: "COVID-19 vaccine: compulsory licensing in developing nations during WHO-declared emergency",
  },
  {
    id: "PI-03",
    principle: "Financial System Stability",
    arabic: "استقرار النظام المالي",
    when_applies: "Systemic financial crisis where private losses would cause cascading public harm (bank runs, currency collapse, pensioner impoverishment)",
    override: "Private creditor rights in failed financial institutions",
    conditions: [
      "Central bank/IMF declaration of systemic risk",
      "Bail-in before bail-out (shareholders lose first)",
      "No bonuses to executives during stabilization",
      "Repaid to public within defined timeframe",
    ],
    limits: "Does not allow permanent state ownership. Does not protect executives. Must be repaid.",
    example: "2008: Lehman bankruptcy allowed. But systemically important banks stabilized with conditions.",
  },
  {
    id: "PI-04",
    principle: "National Resource Repatriation",
    arabic: "استعادة الموارد الوطنية",
    when_applies: "Resources belonging to a nation are controlled by foreign entities under contracts signed by illegitimate governments (colonial or dictatorial)",
    override: "Private contractual rights from illegitimate contracts",
    conditions: [
      "Contract signed by non-representative government",
      "Compensation at fair market value for improvements made",
      "International arbitration respected",
      "Future contracts with new terms, not confiscation of improvements",
    ],
    limits: "Cannot retroactively void contracts signed in good faith by legitimate governments. Compensation required.",
    example: "Congo/DRC renegotiating colonial-era mining contracts for cobalt and coltan",
  },
  {
    id: "PI-05",
    principle: "Essential Services Protection",
    arabic: "حماية الخدمات الأساسية",
    when_applies: "Private providers of essential services (water, electricity, healthcare, internet) failing to provide universal access at affordable prices",
    override: "Private monopoly pricing rights",
    conditions: [
      "Service classified as essential under human rights framework",
      "Provider demonstrably failing public interest",
      "Regulated pricing with guaranteed return on investment",
      "Full transparency of cost structure",
    ],
    limits: "Does not eliminate profit — just limits monopoly rent. Provider still earns regulated return.",
    example: "Rural broadband: private ISP required to serve remote areas at regulated price in exchange for spectrum license",
  },
  {
    id: "PI-06",
    principle: "Anti-Concentration Emergency",
    arabic: "طوارئ مكافحة التركز",
    when_applies: "Any single entity approaches control of >30% of a currency supply, >40% of hashrate, or >25% of a nation's critical infrastructure",
    override: "Private property rights in accumulated assets",
    conditions: [
      "Verified on-chain or regulatory evidence of concentration",
      "Orderly divestiture with fair market price",
      "Minimum 18-month wind-down period",
      "No emergency liquidation (too disruptive)",
    ],
    limits: "Circuit breaker threshold deliberately set at 30%/40%/25% to allow large legitimate actors while preventing monopoly.",
    example: "Mining pool reaching 40% BTC hashrate: protocol flags, voluntary coordination required",
  },
  {
    id: "PI-07",
    principle: "Generational Equity",
    arabic: "العدالة بين الأجيال",
    when_applies: "Decisions that lock future generations into irreversible harms (climate debt, financial debt, constitutional restrictions)",
    override: "Current generation's right to make binding long-term commitments",
    conditions: [
      "Decision must affect 25+ years into future",
      "Future generation representatives consulted (ombudsperson model)",
      "Reversibility mechanism required for all long-term contracts",
      "Environmental impact assessment mandatory",
    ],
    limits: "Does not prevent long-term investment. Only requires reversibility clauses and generational review.",
    example: "100-year infrastructure bonds require climate impact assessment and 25-year review clause",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// 9. GAP ANALYSIS — ما ينقص
// ══════════════════════════════════════════════════════════════════════════════

export interface GapItem {
  id:           string;
  area:         string;
  arabic:       string;
  gap:          string;
  impact:       "critical" | "high" | "medium" | "low";
  effort:       "hours" | "days" | "weeks" | "months" | "years";
  path:         string;
}

export const GAP_ANALYSIS: GapItem[] = [
  {
    id: "GA-01", area: "Currency Coverage", arabic: "تغطية العملات",
    gap: "Only 8 of 180 fiat currencies have renaissance plans (4% coverage)",
    impact: "critical", effort: "weeks",
    path: "Parameterize CurrencyRenaissancePlan generation from SovereignDebtProfile data. Auto-generate plans for all 180 currencies.",
  },
  {
    id: "GA-02", area: "Nation Coverage", arabic: "تغطية الدول",
    gap: "Only 16 of 195 UN member states have debt oracle profiles (8% coverage)",
    impact: "critical", effort: "weeks",
    path: "Integrate IMF World Economic Outlook database. Auto-populate 179 missing nation profiles.",
  },
  {
    id: "GA-03", area: "Constitutional Registry", arabic: "سجل الدساتير",
    gap: "Only 26 of 195 jurisdictions encoded (13% coverage)",
    impact: "high", effort: "months",
    path: "Integrate FATF jurisdiction database + World Bank Doing Business legal frameworks. Automated monitoring for law changes.",
  },
  {
    id: "GA-04", area: "Live Data Feeds", arabic: "تغذية البيانات الحية",
    gap: "All Ψ scores and debt figures are static — no real-time updates",
    impact: "high", effort: "weeks",
    path: "Integrate World Bank API, IMF API, CoinGecko for BTC price, mempool.space for chain data. Scheduled refresh.",
  },
  {
    id: "GA-05", area: "ZK-Proof Implementation", arabic: "تطبيق إثباتات ZK",
    gap: "ZK-KYC is architecturally designed but circuits not yet deployed",
    impact: "high", effort: "months",
    path: "Implement Groth16 circuits for basic compliance proofs. Partner with Aztec, ZoKrates, or SnarkJS.",
  },
  {
    id: "GA-06", area: "Last-Mile Access", arabic: "الوصول للميل الأخير",
    gap: "No SMS/USSD interface — excludes 1.7B unbanked with basic phones only",
    impact: "critical", effort: "months",
    path: "SMS gateway integration. USSD menu system for basic operations. Works on any GSM phone without internet.",
  },
  {
    id: "GA-07", area: "International Relations Strategy", arabic: "استراتيجية العلاقات الدولية",
    gap: "No engagement plan with IMF, World Bank, UN, central banks",
    impact: "high", effort: "years",
    path: "Publish Ψ white paper for academic/policy community. Submit to IMF Working Paper series. Engage G20 finance ministers.",
  },
  {
    id: "GA-08", area: "Whistleblower Protection", arabic: "حماية المبلغين عن المخالفات",
    gap: "Zero Harm Protocol has no whistleblower protection clause",
    impact: "medium", effort: "hours",
    path: "Add CR-11: Right to Whistleblower Protection. ZK-anonymous reporting mechanism for protocol violations.",
  },
  {
    id: "GA-09", area: "Quantum Migration Path", arabic: "مسار الهجرة الكمومية",
    gap: "Post-quantum keys exist but no migration path for existing wallets",
    impact: "medium", effort: "months",
    path: "Design 5-year migration plan: announce threshold, provide migration tool, sunset ECDSA support with long notice.",
  },
  {
    id: "GA-10", area: "Environmental Standards", arabic: "المعايير البيئية",
    gap: "No Landauer renewable fraction calculation — all mining treated equally",
    impact: "medium", effort: "weeks",
    path: "Integrate renewable energy verification data (IEA, Carbon Tracker). Landauer score multiplied by renewable fraction.",
  },
  {
    id: "GA-11", area: "Governance Mechanism", arabic: "آلية الحوكمة",
    gap: "PSI blockchain governance voting not implemented",
    impact: "medium", effort: "weeks",
    path: "Implement proposal + voting system on PSI chain. 15-of-25 global multi-sig for protocol changes.",
  },
  {
    id: "GA-12", area: "Harm Assessment Coverage", arabic: "تغطية تقييم الأضرار",
    gap: "Only 8 actions assessed — hundreds more may need assessment",
    impact: "medium", effort: "months",
    path: "Implement automated harm assessment framework. Every new tool automatically generates assessment template.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Query functions
// ══════════════════════════════════════════════════════════════════════════════

export function getBuiltComponents(): BuiltComponent[] {
  return BUILT_COMPONENTS;
}

export function getGlobalGoals(): GlobalGoal[] {
  return GLOBAL_GOALS;
}

export function getGlobalRisks(category?: string): RiskProfile[] {
  if (!category) return GLOBAL_RISKS;
  return GLOBAL_RISKS.filter(r => r.category === category);
}

export function getIntentionProfiles(intent?: string): IntentProfile[] {
  if (!intent) return INTENTION_PROFILES;
  return INTENTION_PROFILES.filter(p => p.intent === intent);
}

export function getAssetClasses(type?: string): AssetClass[] {
  if (!type) return ASSET_CLASSES;
  return ASSET_CLASSES.filter(a => a.type === type);
}

export function getDataCategories(sovereignty?: string): DataCategory[] {
  if (!sovereignty) return DATA_CATEGORIES;
  return DATA_CATEGORIES.filter(d => d.sovereignty === sovereignty);
}

export function getCooperationModels(): CooperationModel[] {
  return COOPERATION_MODELS;
}

export function getPublicInterestRules(): PublicInterestRule[] {
  return PUBLIC_INTEREST_RULES;
}

export function getGapAnalysis(impact?: string): GapItem[] {
  if (!impact) return GAP_ANALYSIS;
  return GAP_ANALYSIS.filter(g => g.impact === impact);
}

export function getMasterEvaluationSummary() {
  const totalTools = BUILT_COMPONENTS.reduce((s, c) => s + c.tools_count, 0);
  const avgCompleteness = Math.round(
    BUILT_COMPONENTS.reduce((s, c) => s + c.completeness, 0) / BUILT_COMPONENTS.length
  );
  const criticalGaps    = GAP_ANALYSIS.filter(g => g.impact === "critical").length;
  const highRisks       = GLOBAL_RISKS.filter(r => r.probability === "high").length;
  const criticalRisks   = GLOBAL_RISKS.filter(r => r.residual === "critical").length;
  const goalsComplete   = GLOBAL_GOALS.filter(g => g.status === "complete").length;
  const goalsPlanned    = GLOBAL_GOALS.filter(g => g.status === "planned").length;
  const hostileActors   = INTENTION_PROFILES.filter(p => p.intent === "hostile" || p.intent === "adversarial").length;
  const constructiveActors = INTENTION_PROFILES.filter(p => p.intent === "constructive").length;

  return {
    total_components: BUILT_COMPONENTS.length,
    total_tools: totalTools,
    average_completeness_pct: avgCompleteness,
    critical_gaps: criticalGaps,
    total_gaps: GAP_ANALYSIS.length,
    global_goals: GLOBAL_GOALS.length,
    goals_complete: goalsComplete,
    goals_planned: goalsPlanned,
    total_risks: GLOBAL_RISKS.length,
    high_probability_risks: highRisks,
    critical_residual_risks: criticalRisks,
    asset_classes: ASSET_CLASSES.length,
    data_categories: DATA_CATEGORIES.length,
    cooperation_models: COOPERATION_MODELS.length,
    public_interest_rules: PUBLIC_INTEREST_RULES.length,
    intention_profiles: INTENTION_PROFILES.length,
    hostile_adversarial_actors: hostileActors,
    constructive_actors: constructiveActors,
    coverage_nations_pct: 8,    // 16 of 195
    coverage_currencies_pct: 4, // 8 of 180
    coverage_jurisdictions_pct: 13, // 26 of 195
  };
}
