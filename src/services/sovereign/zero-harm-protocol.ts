/**
 * Zero Harm Protocol — صفر أضرار على المدنيين والحكومات
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE ABSOLUTE GUARANTEE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Every action in the Ψ Renaissance system must pass:
 *
 *   ∀ action ∈ SYSTEM:
 *     civilian_harm(action)    = 0
 *     government_harm(action)  = 0
 *     net_sector_harm(action)  ≤ 0  (zero or net positive)
 *
 * This is not aspirational. It is a hard constraint.
 * Any action that cannot prove zero harm is BLOCKED until mitigated.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE 4-SECTOR FRAMEWORK
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   TECHNICAL  (تقنية)  — No service disruption, backward compatibility, open standards
 *   MONETARY   (نقدية)  — No savings destruction, no coercion, phased transitions
 *   SECURITY   (أمنية)  — No surveillance creep, ZK privacy, no military exploitation
 *   LEGAL      (قانونية) — Constitutional compliance, sovereignty respect, opt-in only
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * WHO IS PROTECTED
 * ══════════════════════════════════════════════════════════════════════════════
 *
 *   CIVILIANS:    Individuals, families, workers, savers, entrepreneurs, students
 *   GOVERNMENTS:  Central banks, ministries, regulatory bodies, sovereign institutions
 *   ECONOMY:      All sectors — agriculture, industry, services, finance, digital
 *   SOCIETY:      Civil society, NGOs, cultural institutions, religious institutions
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type HarmSector = "technical" | "monetary" | "security" | "legal";
export type HarmLevel  = "zero" | "low" | "medium" | "high" | "critical";
export type HarmVerdict = "SAFE" | "CONDITIONAL" | "BLOCKED";
export type ProtectedParty = "civilians" | "governments" | "economy" | "society";

export interface SectorRisk {
  sector:           HarmSector;
  inherent_risk:    HarmLevel;
  description:      string;
  mitigation:       string;
  residual_risk:    HarmLevel;
  circuit_breaker:  string | null;  // what stops harm if mitigation fails
}

export interface HarmAssessment {
  action_id:           string;
  action_name:         string;
  category:            string;
  affected_parties:    ProtectedParty[];
  technical_risk:      SectorRisk;
  monetary_risk:       SectorRisk;
  security_risk:       SectorRisk;
  legal_risk:          SectorRisk;
  net_civilian_score:  number;  // positive = benefit. Must be ≥ 0
  net_government_score: number; // positive = benefit. Must be ≥ 0
  verdict:             HarmVerdict;
  condition:           string | null;   // if CONDITIONAL, what must be true
  blocking_reason:     string | null;   // if BLOCKED, why
}

export interface CivilianRight {
  id:          string;
  title:       string;
  arabic:      string;
  description: string;
  enforcement: string;
  technical_guarantee:  string;
  monetary_guarantee:   string;
  security_guarantee:   string;
  legal_guarantee:      string;
}

export interface GovernmentRight {
  id:          string;
  title:       string;
  arabic:      string;
  description: string;
  enforcement: string;
  scope:       "national" | "regional" | "local" | "supranational";
}

export interface CircuitBreaker {
  id:          string;
  name:        string;
  trigger:     string;
  action:      string;
  reset_condition: string;
  protects:    ProtectedParty[];
}

export interface SectorGuarantee {
  sector:       HarmSector;
  arabic_name:  string;
  core_promise: string;
  positive_commitments: string[];  // what the system WILL do
  negative_commitments: string[];  // what the system will NEVER do
  verification:         string;    // how compliance is verified
}

// ══════════════════════════════════════════════════════════════════════════════
// CIVILIAN BILL OF RIGHTS — ميثاق حقوق المدنيين
// ══════════════════════════════════════════════════════════════════════════════

export const CIVILIAN_RIGHTS: CivilianRight[] = [
  {
    id: "CR-01",
    title: "Right to Savings Protection",
    arabic: "حق حماية المدخرات",
    description: "No civilian's existing savings may be destroyed, confiscated, or devalued by system actions. Any monetary transition must preserve the purchasing power of held savings through the transition period.",
    enforcement: "Phased transition with parallel systems. Citizens hold local currency throughout. No forced conversion.",
    technical_guarantee:  "Savings balances read from existing systems remain valid. No data migration that zeroes balances.",
    monetary_guarantee:   "Ψ reforms that reduce inflation INCREASE purchasing power. No reform that destroys savings is permitted.",
    security_guarantee:   "Savings data is not exposed to third parties. ZK-KYC means compliance without data leakage.",
    legal_guarantee:      "Constitutional property rights apply. Any confiscation requires due process and compensation.",
  },
  {
    id: "CR-02",
    title: "Right to Currency Freedom",
    arabic: "حق حرية اختيار العملة",
    description: "No civilian is forced to adopt Bitcoin, sBTC, or any specific currency. Every person chooses their own store of value. The system offers tools — it does not mandate transitions.",
    enforcement: "Multi-currency x402: users pay in their own currency. No interface forces BTC ownership. Opt-in at every step.",
    technical_guarantee:  "All x402 endpoints accept local currency. DEX conversion is transparent and optional.",
    monetary_guarantee:   "Ψ reforms strengthen local currencies. The goal is that citizens PREFER their own currency.",
    security_guarantee:   "Currency choice is private. No tracking of who holds what currency.",
    legal_guarantee:      "Legal tender laws remain. No protocol overrides national currency legislation.",
  },
  {
    id: "CR-03",
    title: "Right to Economic Participation",
    arabic: "حق المشاركة الاقتصادية",
    description: "All citizens — regardless of income, location, or technical literacy — must be able to participate in the new economy. No digital divide created by the system.",
    enforcement: "Progressive UX: SMS fallback, mobile-first, local language support. No mandatory smartphone or internet required for basic services.",
    technical_guarantee:  "APIs provide low-bandwidth alternatives. Offline modes for basic transactions.",
    monetary_guarantee:   "Low-denomination support (NGN, LBP, INR users are not priced out of digital services).",
    security_guarantee:   "Basic participation requires no biometrics or surveillance. Aadhaar-style programs are opt-in.",
    legal_guarantee:      "Anti-discrimination: participation cannot be gated by political affiliation, religion, or ethnicity.",
  },
  {
    id: "CR-04",
    title: "Right to Privacy",
    arabic: "حق الخصوصية المالية",
    description: "Citizens' financial activity is private. Government sees aggregate statistics, not individual transactions. ZK-KYC proves compliance without revealing identity or amounts.",
    enforcement: "ZK-proof compliance: the system proves 'this person is compliant' without storing personal data.",
    technical_guarantee:  "ZK-KYC implementation: Groth16 proofs. No plaintext PII stored on-chain.",
    monetary_guarantee:   "Transaction amounts are private. Only compliance status (pass/fail) is shared with regulators.",
    security_guarantee:   "End-to-end encryption. No backdoors. Key custody belongs to the user.",
    legal_guarantee:      "GDPR Article 22, India Puttaswamy judgment, Brazil LGPD — all preserved. Privacy by design.",
  },
  {
    id: "CR-05",
    title: "Right to Cantillon Equity",
    arabic: "حق عدالة كانتيون",
    description: "New money creation must benefit citizens FIRST, not financial intermediaries first. Central bank QE that enriches banks before citizens is a Cantillon violation.",
    enforcement: "Ψ Cantillon⁻¹ reforms route new money directly to citizen accounts (Jan Dhan model, citizen dividends) before bank transmission.",
    technical_guarantee:  "Smart contract direct transfers: no intermediary can intercept or delay citizen payments.",
    monetary_guarantee:   "Citizen dividend programs: oil, gas, and national resource revenues shared directly.",
    security_guarantee:   "Direct transfer contracts are auditable on-chain. No corruption rent possible.",
    legal_guarantee:      "Constitutional resource ownership clauses enforced via smart contract.",
  },
  {
    id: "CR-06",
    title: "Right to Inflation Protection",
    arabic: "حق الحماية من التضخم",
    description: "No action in the system may trigger hyperinflation or sustained inflation above target. Citizens must be protected from monetary debasement.",
    enforcement: "Circuit breakers: if inflation exceeds 2× target, monetary expansion is automatically paused. Independent Ψ monitoring.",
    technical_guarantee:  "On-chain inflation oracle: monitors CPI data feeds. Automatic alerts and safeguards.",
    monetary_guarantee:   "Ψ Landauer reforms require energy-backed money creation. Cannot print indefinitely.",
    security_guarantee:   "Inflation data is public and tamper-evident. Manipulating CPI oracle is cryptographically blocked.",
    legal_guarantee:      "Constitutional price stability mandates (like Bundesbank heritage in ECB treaty).",
  },
  {
    id: "CR-07",
    title: "Right to Employment Continuity",
    arabic: "حق استمرارية العمل",
    description: "Monetary transitions must not cause mass unemployment. Any sector disruption must be accompanied by transition support, retraining, and gradual migration.",
    enforcement: "No hard cutoffs. Parallel system operation for minimum 5 years. Government retraining programs funded by efficiency gains from transition.",
    technical_guarantee:  "Legacy system support maintained. No forced migrations that make current skills obsolete overnight.",
    monetary_guarantee:   "Transition revenues (from efficiency gains) explicitly earmarked for workforce support.",
    security_guarantee:   "Employment data not used for surveillance. No 'social credit' linking employment to financial behavior.",
    legal_guarantee:      "Labor law primacy: no protocol overrides employment protections, collective agreements, or minimum wage laws.",
  },
  {
    id: "CR-08",
    title: "Right to Information Transparency",
    arabic: "حق الشفافية والمعلومات",
    description: "Citizens have the right to understand how the monetary system works, why decisions are made, and what their options are. No hidden fees, opaque algorithms, or black-box decisions.",
    enforcement: "Open-source protocol. All algorithms published. All decisions on-chain and auditable. Plain-language explanations required.",
    technical_guarantee:  "Complete open-source codebase. Independent audit rights. No proprietary black boxes.",
    monetary_guarantee:   "Fee transparency: x402 endpoints must display exactly what is charged and why.",
    security_guarantee:   "Algorithmic decisions (risk scoring, compliance) must be explainable. No 'AI decides and we cannot explain' blocking.",
    legal_guarantee:      "Right to explanation (GDPR Article 22). No automated decision-making without appeal process.",
  },
  {
    id: "CR-09",
    title: "Right to Cross-Border Access",
    arabic: "حق الوصول العابر للحدود",
    description: "Remittances, international trade, and diaspora banking must remain affordable. Citizens sending money home must not be priced out of cross-border finance.",
    enforcement: "x402 cross-border protocols: STX/BTC routing reduces remittance cost from 6–8% to <1%. No country-level blocking.",
    technical_guarantee:  "Multi-chain routing: if one chain is congested, routes over another. Reliability guaranteed.",
    monetary_guarantee:   "Sub-1% cross-border fees vs current 6–8% SWIFT/Western Union fees.",
    security_guarantee:   "Cross-border transactions are private from surveillance. Only compliance status shared with FATF.",
    legal_guarantee:      "FATF Travel Rule compliance maintained. No sanctions violations. But remittances are a human right.",
  },
  {
    id: "CR-10",
    title: "Right to Exit",
    arabic: "حق الخروج",
    description: "Any citizen may exit the system at any time, for any reason, without penalty. No lock-in. No exit fees. Full portability of identity and financial records.",
    enforcement: "Export function: users can export all their data, history, and credentials in standard formats at any time.",
    technical_guarantee:  "Open data formats. No proprietary lock-in. Self-custody is always possible.",
    monetary_guarantee:   "No exit taxes or fees from the protocol layer (national tax law applies separately).",
    security_guarantee:   "Exit does not trigger surveillance or flagging. Leaving the system is not a suspicious act.",
    legal_guarantee:      "Right to data portability (GDPR Article 20). Right to be forgotten where applicable.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// GOVERNMENT SOVEREIGNTY CHARTER — ميثاق سيادة الحكومات
// ══════════════════════════════════════════════════════════════════════════════

export const GOVERNMENT_RIGHTS: GovernmentRight[] = [
  {
    id: "GR-01",
    title: "Monetary Sovereignty",
    arabic: "السيادة النقدية",
    description: "Every government retains full sovereign authority over its own currency. No protocol can force a currency change, mandate BTC adoption, or override central bank independence.",
    enforcement: "Opt-in architecture: every Ψ reform is a recommendation, not a mandate. Each government adopts what it chooses.",
    scope: "national",
  },
  {
    id: "GR-02",
    title: "Regulatory Jurisdiction",
    arabic: "الولاية التنظيمية",
    description: "Governments retain full authority to regulate crypto assets, DeFi, and blockchain services within their jurisdiction. The protocol operates within, not above, national law.",
    enforcement: "Constitutional registry: every jurisdiction's legal framework is encoded. Protocol refuses to operate in violation of local law.",
    scope: "national",
  },
  {
    id: "GR-03",
    title: "Revenue Continuity",
    arabic: "استمرارية الإيرادات",
    description: "Government tax revenue, seigniorage, and fiscal capacity must not be disrupted by system adoption. The transition must maintain or improve government fiscal position.",
    enforcement: "x402 government APIs: governments earn from digital services. Tax reporting built into protocol. Revenue increases from efficiency.",
    scope: "national",
  },
  {
    id: "GR-04",
    title: "Audit and Inspection Rights",
    arabic: "حق التدقيق والتفتيش",
    description: "Governments may audit any transaction, entity, or service operating within their jurisdiction, using standard legal processes. Warrants and court orders are honored.",
    enforcement: "ZK-KYC with government key: law enforcement with valid court order can unmask. No absolute anonymity — privacy + accountability balanced.",
    scope: "national",
  },
  {
    id: "GR-05",
    title: "Opt-Out Sovereignty",
    arabic: "حق الانسحاب السيادي",
    description: "Any government may opt out of any protocol, service, or system at any time. No global protocol can override a sovereign nation's decision to withdraw.",
    enforcement: "Jurisdiction blacklist: if a country opts out, the protocol does not operate there. No bypass. No covert operation.",
    scope: "national",
  },
  {
    id: "GR-06",
    title: "Constitutional Primacy",
    arabic: "سمو الدستور",
    description: "Each nation's constitution takes precedence over any protocol rule. If a Ψ reform recommendation conflicts with a country's constitution, the constitution wins.",
    enforcement: "Constitutional registry (compliance.tools): 26 jurisdiction rules encoded. Automatic conflict detection.",
    scope: "national",
  },
  {
    id: "GR-07",
    title: "Gradual Transition Rights",
    arabic: "حق التحول التدريجي",
    description: "No government is forced to transition rapidly. Governments choose their own pace: experiment → pilot → partial adoption → full adoption. Any stage can be paused.",
    enforcement: "Phase gates: each 7-phase liberation plan has explicit go/no-go decision points. Government controls each gate.",
    scope: "national",
  },
  {
    id: "GR-08",
    title: "National Security Exception",
    arabic: "استثناء الأمن القومي",
    description: "Governments may restrict or modify protocol operation for genuine national security reasons. Security agencies operate under their own legal frameworks.",
    enforcement: "National security carve-out in every tool: defense data, military infrastructure, and security operations are explicitly excluded from protocol scope.",
    scope: "national",
  },
  {
    id: "GR-09",
    title: "Social Welfare Protection",
    arabic: "حماية الرعاية الاجتماعية",
    description: "Government social welfare programs (pensions, healthcare, unemployment, education) must not be disrupted. Any monetary transition must maintain or improve social welfare delivery.",
    enforcement: "Welfare continuity protocol: smart contract templates for government direct payment programs. More efficient, not less welfare.",
    scope: "national",
  },
  {
    id: "GR-10",
    title: "International Law Compliance",
    arabic: "الامتثال للقانون الدولي",
    description: "The system operates in compliance with: UN Charter, WTO rules, FATF standards, Basel III, BIS guidelines. No sovereign action facilitated that violates international law.",
    enforcement: "Sanctions oracle (compliance.tools): OFAC, EU sanctions, UN Security Council resolutions enforced at protocol level.",
    scope: "supranational",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTOR GUARANTEES — ضمانات القطاعات الأربعة
// ══════════════════════════════════════════════════════════════════════════════

export const SECTOR_GUARANTEES: SectorGuarantee[] = [
  {
    sector: "technical",
    arabic_name: "القطاع التقني",
    core_promise: "No technical failure can cause irreversible harm to users. Every system has fallback, every action has reversal, every failure is bounded.",
    positive_commitments: [
      "All code is open source and independently auditable",
      "Every tool has graceful degradation — failure returns error, never silent data corruption",
      "Backward compatibility maintained for minimum 3 years on all APIs",
      "Offline modes available for basic operations (payments, identity)",
      "Full data portability: users export their complete history at any time",
      "Independent security audits required before any major release",
      "Bug bounty program: vulnerabilities disclosed responsibly, fixed before exploitation",
      "Testnet equivalents for every mainnet function — test before you spend",
      "Rate limiting and circuit breakers on all API endpoints",
      "Cryptographic proofs for all sensitive operations — verify, don't trust",
    ],
    negative_commitments: [
      "NEVER deploy without security review on tools that move funds",
      "NEVER store private keys in any server-side system",
      "NEVER use proprietary black-box algorithms for compliance decisions",
      "NEVER create single points of failure for critical infrastructure",
      "NEVER require users to upgrade without giving minimum 12-month notice",
      "NEVER collect biometric data without explicit consent and local storage only",
      "NEVER use AI/ML models for financial gatekeeping without human appeal path",
      "NEVER deploy surveillance backdoors, even for law enforcement",
      "NEVER create protocol-level censorship of transactions (judicial orders handled separately)",
      "NEVER build MEV extraction mechanisms that harm ordinary users",
    ],
    verification: "Open-source code review + automated static analysis (Semgrep) + quarterly external audit + public bug bounty + on-chain audit trail of all deployments",
  },
  {
    sector: "monetary",
    arabic_name: "القطاع النقدي",
    core_promise: "No monetary action in the system can destroy savings, trigger hyperinflation, or concentrate wealth. Every reform makes the monetary distribution more equal.",
    positive_commitments: [
      "Ψ equation applied to every monetary policy: Landauer × Nash × Cantillon⁻¹ × Gödel",
      "Cantillon⁻¹ routing: new money reaches citizens FIRST, intermediaries last",
      "Citizen dividend mechanisms built into all commodity-backed currencies",
      "Inflation circuit breakers: if CPI exceeds 2× target, expansion automatically pauses",
      "Savings protection during transitions: parallel systems for minimum 5 years",
      "Multi-currency x402: users pay in their own currency — no forced conversion",
      "Fee transparency: exact costs displayed before every transaction",
      "Purchasing power audits: quarterly reports showing real-world impact per currency",
      "Cross-border remittance optimization: target <1% vs current 6–8%",
      "Debt reduction roadmaps: specific per-nation phased plans",
    ],
    negative_commitments: [
      "NEVER recommend or facilitate printing money without real asset backing",
      "NEVER allow a single currency (including sBTC) to become mandatory",
      "NEVER structure transitions that destroy existing savings",
      "NEVER route new money through financial intermediaries before citizens",
      "NEVER create deflationary spirals by withdrawing money faster than economies adjust",
      "NEVER facilitate tax evasion that reduces government social spending capacity",
      "NEVER build wash trading, market manipulation, or pump-dump mechanisms",
      "NEVER provide tools that help concentrate wealth above Nash equilibrium thresholds",
      "NEVER facilitate economic sanctions that harm civilian populations for political goals",
      "NEVER allow protocol fees to price out low-income users",
    ],
    verification: "Real-time Ψ scoring dashboard + independent economist review + CPI oracle monitoring + quarterly purchasing power reports + Gini coefficient tracking per reform",
  },
  {
    sector: "security",
    arabic_name: "القطاع الأمني",
    core_promise: "The system provides cryptographic privacy for individuals while maintaining accountability for criminal actors. Zero surveillance creep. ZK-KYC not mass surveillance.",
    positive_commitments: [
      "ZK-KYC: compliance proven without identity revealed. Court order required to unmask.",
      "End-to-end encryption on all sensitive communications",
      "Self-custody: users hold their own keys. No custodial risk from server compromise",
      "Quantum-resistant key options: Lamport OTS + XMSS available for high-value assets",
      "Transparent threat models: all attack vectors published and mitigated",
      "Responsible disclosure: security researchers protected, not prosecuted",
      "No mass data collection: only what is cryptographically necessary is retained",
      "AML detection that catches criminals without surveilling innocents",
      "FATF Travel Rule compliance with privacy preservation — only counterparty data shared",
      "Incident response: 24h disclosure of any breach affecting user funds",
    ],
    negative_commitments: [
      "NEVER build backdoors, even for law enforcement (court orders use ZK-unmask)",
      "NEVER store transaction history linked to identity without explicit consent",
      "NEVER share user data with governments without valid court order",
      "NEVER deploy facial recognition or biometric tracking",
      "NEVER build social credit or behavior scoring that affects financial access",
      "NEVER use financial data for political surveillance, targeting, or persecution",
      "NEVER share military or defense data through protocol channels",
      "NEVER build tracking that follows users across services without consent",
      "NEVER sell user data to third parties, advertisers, or data brokers",
      "NEVER retain data beyond the minimum legally required period",
    ],
    verification: "ZK-proof verification logs + no PII on-chain guarantee + quarterly privacy audit + penetration testing + responsible disclosure program + independent privacy board review",
  },
  {
    sector: "legal",
    arabic_name: "القطاع القانوني",
    core_promise: "The system operates within every jurisdiction's legal framework. Constitutional rights are preserved and enhanced, not eroded. Sovereignty is respected, not undermined.",
    positive_commitments: [
      "Constitutional registry: 26 jurisdictions encoded, legal conflicts auto-detected",
      "Opt-in architecture: no mandate at any level — individual, institutional, or national",
      "Due process: no automated blocking without human review and appeal mechanism",
      "International law: UN Charter, FATF, WTO, BIS guidelines encoded as hard constraints",
      "Property rights: private key = property right. Confiscation requires court order.",
      "Right to appeal: every automated decision has a human review pathway",
      "GDPR, CCPA, PDPA compliance built in — privacy as legal right not just feature",
      "Anti-money laundering: FATF-compliant without enabling political persecution",
      "Securities law compliance: tools identify if operations require VASP licensing",
      "Jurisdiction-specific guidance: each tool shows applicable local law",
    ],
    negative_commitments: [
      "NEVER override national law with protocol rules",
      "NEVER facilitate sanctions violations, even for ideological reasons",
      "NEVER create legal structures that deprive governments of tax jurisdiction",
      "NEVER build tools for tax evasion (tax optimization within law is different)",
      "NEVER facilitate capital controls evasion without explicit legal authorization",
      "NEVER help actors avoid legitimate AML/CFT requirements",
      "NEVER create smart contracts that override court orders",
      "NEVER operate in jurisdictions without legal authorization",
      "NEVER structure transactions to conceal beneficial ownership",
      "NEVER facilitate insider trading, front-running, or market manipulation",
    ],
    verification: "Constitutional compliance checker on every tool invocation + legal review by qualified attorneys per jurisdiction + regulatory relationship management + quarterly compliance reports",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKERS — قواطع الأمان
// ══════════════════════════════════════════════════════════════════════════════

export const CIRCUIT_BREAKERS: CircuitBreaker[] = [
  {
    id: "CB-01",
    name: "Hyperinflation Guard",
    trigger: "CPI growth > 2× central bank target for 3 consecutive months",
    action: "All monetary expansion recommendations paused. Alert issued. Human review required.",
    reset_condition: "CPI returns to within 1.5× target for 2 consecutive months",
    protects: ["civilians", "economy"],
  },
  {
    id: "CB-02",
    name: "Savings Protection Freeze",
    trigger: "Any reform action detected that would reduce real purchasing power of existing savings > 5%",
    action: "Reform blocked at protocol level. Alternative path required.",
    reset_condition: "Reform redesigned with savings protection mechanism approved by independent review",
    protects: ["civilians"],
  },
  {
    id: "CB-03",
    name: "Sovereignty Override Detector",
    trigger: "Any action that would require a government to adopt a specific monetary standard without consent",
    action: "Action blocked. All communications changed to 'optional recommendation' framing.",
    reset_condition: "Government issues explicit written opt-in authorization",
    protects: ["governments"],
  },
  {
    id: "CB-04",
    name: "Mass Unemployment Alert",
    trigger: "Projected employment impact > 2% unemployment increase in any sector",
    action: "Action flagged as conditional. Transition support plan required before proceeding.",
    reset_condition: "Transition support plan approved and funded",
    protects: ["civilians", "society"],
  },
  {
    id: "CB-05",
    name: "Surveillance Creep Block",
    trigger: "Any tool or system requests PII (personally identifiable information) when ZK alternative exists",
    action: "Tool blocked. ZK alternative auto-suggested.",
    reset_condition: "Redesigned with ZK-KYC instead of PII collection",
    protects: ["civilians", "society"],
  },
  {
    id: "CB-06",
    name: "Constitutional Conflict Halt",
    trigger: "Reform recommendation conflicts with jurisdiction's constitutional provisions",
    action: "Reform flagged as BLOCKED for that jurisdiction. Alternative approach generated.",
    reset_condition: "Constitutional amendment completed (if desired) or alternative reform found",
    protects: ["governments", "civilians"],
  },
  {
    id: "CB-07",
    name: "Wealth Concentration Limit",
    trigger: "Any mechanism that would allow a single entity to control > 5% of a currency's total supply",
    action: "Mechanism blocked. Quadratic decay or entropic anti-concentration applied.",
    reset_condition: "Mechanism redesigned with anti-concentration safeguards",
    protects: ["civilians", "economy"],
  },
  {
    id: "CB-08",
    name: "Sanctions Firewall",
    trigger: "Transaction or interaction involving OFAC-listed address or FATF-blacklisted jurisdiction",
    action: "Transaction blocked immediately. Compliance report generated. No exceptions.",
    reset_condition: "Sanctions removed by relevant authority (OFAC, EU, UN Security Council)",
    protects: ["governments", "economy"],
  },
  {
    id: "CB-09",
    name: "Protocol Fee Cap",
    trigger: "Effective fee rate for any operation exceeds 2% of transaction value",
    action: "Fee capped. Excess returned to user. Low-cost routing found.",
    reset_condition: "Network conditions normalize (during congestion, fee cap maintained via routing)",
    protects: ["civilians"],
  },
  {
    id: "CB-10",
    name: "Revenue Continuity Guard",
    trigger: "Government tax revenue projected to fall > 10% in any year due to protocol adoption",
    action: "Adoption paused. Revenue bridging mechanism designed before proceeding.",
    reset_condition: "New x402 government revenue stream shown to offset projected loss",
    protects: ["governments", "society"],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// HARM ASSESSMENT MATRIX — مصفوفة تقييم الأضرار
// ══════════════════════════════════════════════════════════════════════════════

export const HARM_ASSESSMENTS: HarmAssessment[] = [
  {
    action_id:          "HA-01",
    action_name:        "BTC Reserve Accumulation (Government)",
    category:           "monetary",
    affected_parties:   ["governments", "civilians", "economy"],
    technical_risk: {
      sector: "technical", inherent_risk: "low",
      description: "Custody risk — government must secure BTC private keys",
      mitigation: "Multi-sig custody (3-of-5), hardware security modules, regular drills",
      residual_risk: "low", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "medium",
      description: "BTC price volatility could create unrealized losses on government balance sheet",
      mitigation: "Start with 1–3% of reserves. Long-term hold. No leverage. Mark-to-market without forced liquidation.",
      residual_risk: "low", circuit_breaker: "CB-02",
    },
    security_risk: {
      sector: "security", inherent_risk: "medium",
      description: "State-level custody is a target for sophisticated hackers",
      mitigation: "Air-gapped cold storage. Geographically distributed. No online exposure.",
      residual_risk: "low", circuit_breaker: null,
    },
    legal_risk: {
      sector: "legal", inherent_risk: "low",
      description: "Regulatory classification of BTC varies by jurisdiction",
      mitigation: "Legal opinion per jurisdiction. Classify as foreign reserve asset per IMF guidance.",
      residual_risk: "low", circuit_breaker: "CB-06",
    },
    net_civilian_score:   5,  // positive: inflation hedge benefits all citizens
    net_government_score: 7,  // positive: diversification, long-term appreciation
    verdict: "SAFE",
    condition: null,
    blocking_reason: null,
  },
  {
    action_id:          "HA-02",
    action_name:        "Currency Reform (Cantillon Redistribution)",
    category:           "monetary",
    affected_parties:   ["civilians", "governments", "economy"],
    technical_risk: {
      sector: "technical", inherent_risk: "low",
      description: "Smart contract direct transfers must be technically correct",
      mitigation: "Audited contracts. Testnet verification. Phased rollout with limits.",
      residual_risk: "zero", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "medium",
      description: "Redirecting QE from banks to citizens could cause bank liquidity issues",
      mitigation: "Gradual transition: start with 10% direct, increase 10%/year. Banks given time to adjust funding models.",
      residual_risk: "low", circuit_breaker: "CB-01",
    },
    security_risk: {
      sector: "security", inherent_risk: "low",
      description: "Direct transfer system could be exploited for fraudulent claims",
      mitigation: "Identity verification (ZK-KYC). Periodic re-verification. Anomaly detection.",
      residual_risk: "low", circuit_breaker: "CB-05",
    },
    legal_risk: {
      sector: "legal", inherent_risk: "low",
      description: "Central bank mandates vary — some restrict direct-to-citizen transfers",
      mitigation: "Central bank law amendment. Parliamentary approval. Constitutional review.",
      residual_risk: "low", circuit_breaker: "CB-06",
    },
    net_civilian_score:   15, // very positive: direct benefit to lower-income citizens
    net_government_score: 3,  // positive: political legitimacy, reduced inequality
    verdict: "SAFE",
    condition: null,
    blocking_reason: null,
  },
  {
    action_id:          "HA-03",
    action_name:        "x402 Government API Deployment",
    category:           "technical",
    affected_parties:   ["governments", "civilians"],
    technical_risk: {
      sector: "technical", inherent_risk: "low",
      description: "Government APIs must remain available. Downtime affects public services.",
      mitigation: "SLA requirements. Redundant infrastructure. Manual fallback procedures.",
      residual_risk: "zero", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "zero",
      description: "Fee collection through APIs is transparent. No hidden monetization.",
      mitigation: "Fee schedule published. All revenues to government treasury. Auditable.",
      residual_risk: "zero", circuit_breaker: "CB-09",
    },
    security_risk: {
      sector: "security", inherent_risk: "medium",
      description: "Government APIs hold sensitive data (land registry, IDs, permits)",
      mitigation: "Zero-trust architecture. API keys per service. No cross-service data leakage. Audit logs.",
      residual_risk: "low", circuit_breaker: null,
    },
    legal_risk: {
      sector: "legal", inherent_risk: "low",
      description: "Data protection laws apply to government data APIs",
      mitigation: "Privacy impact assessment. GDPR/local equivalents. Minimum data principle.",
      residual_risk: "zero", circuit_breaker: "CB-06",
    },
    net_civilian_score:   8,  // positive: faster, cheaper government services
    net_government_score: 10, // positive: new revenue + service efficiency
    verdict: "SAFE",
    condition: null,
    blocking_reason: null,
  },
  {
    action_id:          "HA-04",
    action_name:        "Citizen Commodity Dividend (Oil/Gas/Mining)",
    category:           "monetary",
    affected_parties:   ["civilians", "governments"],
    technical_risk: {
      sector: "technical", inherent_risk: "low",
      description: "Distribution requires reliable identity and payment rails",
      mitigation: "Mobile money integration (M-Pesa model). SMS fallback. Bank transfer option.",
      residual_risk: "zero", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "low",
      description: "Direct transfers could be mildly inflationary if too large",
      mitigation: "Calibrated to inflation target. CPI monitoring. Sterilization if needed.",
      residual_risk: "low", circuit_breaker: "CB-01",
    },
    security_risk: {
      sector: "security", inherent_risk: "low",
      description: "Fraudulent registration to receive dividends",
      mitigation: "ZK identity proofs. Biometric optional. Periodic re-verification.",
      residual_risk: "low", circuit_breaker: "CB-05",
    },
    legal_risk: {
      sector: "legal", inherent_risk: "zero",
      description: "Citizen dividends from natural resources have legal precedents (Alaska PFD, Kuwait Fund)",
      mitigation: "Constitutional resource ownership amendment where needed. Strong precedents globally.",
      residual_risk: "zero", circuit_breaker: null,
    },
    net_civilian_score:   20, // very positive: direct poverty reduction
    net_government_score: 5,  // positive: political stability, reduced corruption
    verdict: "SAFE",
    condition: null,
    blocking_reason: null,
  },
  {
    action_id:          "HA-05",
    action_name:        "ZK-KYC Compliance System",
    category:           "security",
    affected_parties:   ["civilians", "governments"],
    technical_risk: {
      sector: "technical", inherent_risk: "medium",
      description: "ZK-proof generation is computationally intensive",
      mitigation: "Client-side proving (no server knows plaintext). Efficient Groth16 circuits. Hardware acceleration option.",
      residual_risk: "low", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "zero",
      description: "ZK-KYC does not affect monetary flows",
      mitigation: "N/A",
      residual_risk: "zero", circuit_breaker: null,
    },
    security_risk: {
      sector: "security", inherent_risk: "low",
      description: "ZK circuit vulnerabilities could undermine privacy guarantees",
      mitigation: "Trusted setup ceremonies. Multiple audits. Conservative parameter choices. Bug bounty.",
      residual_risk: "low", circuit_breaker: null,
    },
    legal_risk: {
      sector: "legal", inherent_risk: "low",
      description: "Regulators may require fallback to traditional KYC in some jurisdictions",
      mitigation: "ZK-KYC implemented alongside traditional. Jurisdiction-by-jurisdiction rollout.",
      residual_risk: "low", circuit_breaker: "CB-06",
    },
    net_civilian_score:   12, // positive: privacy preserved while compliant
    net_government_score: 8,  // positive: compliance maintained, less data liability
    verdict: "SAFE",
    condition: null,
    blocking_reason: null,
  },
  {
    action_id:          "HA-06",
    action_name:        "National Debt Restructuring (Maturity Extension)",
    category:           "legal",
    affected_parties:   ["governments", "civilians", "economy"],
    technical_risk: {
      sector: "technical", inherent_risk: "zero",
      description: "Debt restructuring is a financial/legal process, not a technical system",
      mitigation: "N/A",
      residual_risk: "zero", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "medium",
      description: "Restructuring could trigger credit rating downgrade, raising future borrowing costs",
      mitigation: "Voluntary exchange with full consent of bondholders. No haircuts. Only maturity extension. Rating agencies briefed.",
      residual_risk: "low", circuit_breaker: "CB-10",
    },
    security_risk: {
      sector: "security", inherent_risk: "zero",
      description: "No security implications for citizens",
      mitigation: "N/A",
      residual_risk: "zero", circuit_breaker: null,
    },
    legal_risk: {
      sector: "legal", inherent_risk: "medium",
      description: "Debt restructuring requires creditor consent. Some creditors may litigate.",
      mitigation: "Voluntary exchange offers only. Legal opinion in all creditor jurisdictions. IMF coordination.",
      residual_risk: "low", circuit_breaker: "CB-06",
    },
    net_civilian_score:   8,  // positive: less debt service → more social spending
    net_government_score: 10, // very positive: removes rollover risk
    verdict: "CONDITIONAL",
    condition: "Voluntary creditor participation only. No forced haircuts. Full legal review required.",
    blocking_reason: null,
  },
  {
    action_id:          "HA-07",
    action_name:        "Cross-Border Remittance via BTC/STX",
    category:           "monetary",
    affected_parties:   ["civilians"],
    technical_risk: {
      sector: "technical", inherent_risk: "low",
      description: "Transaction finality risk — BTC/STX confirmation times",
      mitigation: "Lightning Network for BTC (instant finality). STX for USD-value amounts. User shown expected confirmation time.",
      residual_risk: "zero", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "low",
      description: "Exchange rate volatility between send and receipt",
      mitigation: "Stablecoin intermediate if needed. Lock rate at time of send. Display rate prominently.",
      residual_risk: "low", circuit_breaker: "CB-09",
    },
    security_risk: {
      sector: "security", inherent_risk: "low",
      description: "Cross-border transactions subject to FATF Travel Rule",
      mitigation: "Travel Rule compliance built in. Counterparty data shared with FIUs where required.",
      residual_risk: "zero", circuit_breaker: "CB-08",
    },
    legal_risk: {
      sector: "legal", inherent_risk: "medium",
      description: "Remittance services require licensing in most jurisdictions",
      mitigation: "VASP licensing guidance per jurisdiction. Partner with licensed remittance providers.",
      residual_risk: "low", circuit_breaker: "CB-06",
    },
    net_civilian_score:   15, // very positive: cost reduction from 6–8% to <1%
    net_government_score: 3,  // positive: compliance maintained, tax on conversion
    verdict: "CONDITIONAL",
    condition: "VASP licensing in each jurisdiction required before offering to retail customers.",
    blocking_reason: null,
  },
  {
    action_id:          "HA-08",
    action_name:        "Ψ Oracle Score (Automated Compliance Scoring)",
    category:           "security",
    affected_parties:   ["civilians", "governments"],
    technical_risk: {
      sector: "technical", inherent_risk: "low",
      description: "Scoring algorithm could have bugs producing incorrect verdicts",
      mitigation: "Open source. Independently audited. Every score comes with explanation. Human appeal.",
      residual_risk: "low", circuit_breaker: null,
    },
    monetary_risk: {
      sector: "monetary", inherent_risk: "zero",
      description: "Scoring does not directly affect monetary flows",
      mitigation: "N/A",
      residual_risk: "zero", circuit_breaker: null,
    },
    security_risk: {
      sector: "security", inherent_risk: "medium",
      description: "Score could be gamed or used for discrimination",
      mitigation: "Score reflects objective on-chain behavior only. No demographic data. Anti-gaming: random sampling of inputs.",
      residual_risk: "low", circuit_breaker: "CB-05",
    },
    legal_risk: {
      sector: "legal", inherent_risk: "medium",
      description: "Automated scoring for financial access triggers GDPR Article 22 / ECOA / fair lending laws",
      mitigation: "Always CONDITIONAL only — never blocks without human review. Explanation provided. Appeal mandatory.",
      residual_risk: "low", circuit_breaker: "CB-06",
    },
    net_civilian_score:   6,  // positive: crime deterrence benefits law-abiding citizens
    net_government_score: 8,  // positive: compliance detection
    verdict: "CONDITIONAL",
    condition: "Every BLOCK verdict requires human review before execution. Automated CAUTION only.",
    blocking_reason: null,
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Query functions
// ══════════════════════════════════════════════════════════════════════════════

export function getCivilianRights(): CivilianRight[] {
  return CIVILIAN_RIGHTS;
}

export function getGovernmentRights(): GovernmentRight[] {
  return GOVERNMENT_RIGHTS;
}

export function getSectorGuarantees(): SectorGuarantee[] {
  return SECTOR_GUARANTEES;
}

export function getSectorGuarantee(sector: HarmSector): SectorGuarantee | null {
  return SECTOR_GUARANTEES.find(g => g.sector === sector) ?? null;
}

export function getCircuitBreakers(): CircuitBreaker[] {
  return CIRCUIT_BREAKERS;
}

export function getHarmAssessments(): HarmAssessment[] {
  return HARM_ASSESSMENTS;
}

export function assessAction(actionId: string): HarmAssessment | null {
  return HARM_ASSESSMENTS.find(a => a.action_id === actionId) ?? null;
}

export function getBlockedActions(): HarmAssessment[] {
  return HARM_ASSESSMENTS.filter(a => a.verdict === "BLOCKED");
}

export function getSafeActions(): HarmAssessment[] {
  return HARM_ASSESSMENTS.filter(a => a.verdict === "SAFE");
}

export function getConditionalActions(): HarmAssessment[] {
  return HARM_ASSESSMENTS.filter(a => a.verdict === "CONDITIONAL");
}

export function getZeroHarmSummary(): {
  total_actions: number;
  safe: number;
  conditional: number;
  blocked: number;
  civilian_rights_count: number;
  government_rights_count: number;
  circuit_breakers_count: number;
  avg_civilian_benefit: number;
  avg_government_benefit: number;
  worst_residual_risk: HarmLevel;
} {
  const safe        = getSafeActions().length;
  const conditional = getConditionalActions().length;
  const blocked     = getBlockedActions().length;
  const total       = HARM_ASSESSMENTS.length;

  const avgCivilian = HARM_ASSESSMENTS.reduce((s, a) => s + a.net_civilian_score, 0) / total;
  const avgGovt     = HARM_ASSESSMENTS.reduce((s, a) => s + a.net_government_score, 0) / total;

  const riskRank: Record<HarmLevel, number> = { zero: 0, low: 1, medium: 2, high: 3, critical: 4 };
  let worstRisk: HarmLevel = "zero";
  for (const a of HARM_ASSESSMENTS) {
    for (const s of [a.technical_risk, a.monetary_risk, a.security_risk, a.legal_risk]) {
      if (riskRank[s.residual_risk] > riskRank[worstRisk]) worstRisk = s.residual_risk;
    }
  }

  return {
    total_actions: total,
    safe, conditional, blocked,
    civilian_rights_count:     CIVILIAN_RIGHTS.length,
    government_rights_count:   GOVERNMENT_RIGHTS.length,
    circuit_breakers_count:    CIRCUIT_BREAKERS.length,
    avg_civilian_benefit:      Math.round(avgCivilian * 10) / 10,
    avg_government_benefit:    Math.round(avgGovt * 10) / 10,
    worst_residual_risk:       worstRisk,
  };
}
