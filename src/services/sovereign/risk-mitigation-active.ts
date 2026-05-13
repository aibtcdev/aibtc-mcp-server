/**
 * Active Risk Mitigation — نظام تخفيف المخاطر الفعّال
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * SOLVES: All 13 global risks from master-evaluation.ts
 *         Cascade prevention (risk A → risk B → risk C)
 *         Cross-system isolation (no system affects another negatively)
 *
 * Architecture:
 *   Each risk has:
 *     - Real-time indicator signals (what to monitor)
 *     - Trigger thresholds (when to act)
 *     - Graduated responses (warn → limit → halt → restore)
 *     - Cascade dependencies (which risks this risk feeds into)
 *     - Isolation rules (what systems are protected from this risk)
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type RiskLevel = "clear" | "watch" | "warning" | "alert" | "critical";
export type MitigationResponse = "monitor" | "warn" | "limit" | "halt" | "restore";

export interface RiskSignal {
  signal_id:     string;
  name:          string;
  description:   string;
  data_source:   string;
  check_interval: string;
  threshold_watch:   string;
  threshold_warning: string;
  threshold_alert:   string;
  threshold_critical: string;
}

export interface CascadeLink {
  from_risk:  string;   // GR-XX
  to_risk:    string;   // GR-XX
  mechanism:  string;   // how one risk triggers the other
  delay:      string;   // typical time from trigger to cascade
  prevention: string;   // how to break the cascade chain
}

export interface IsolationRule {
  protected_system:  string;
  from_risk:         string;
  isolation_method:  string;
  fallback:          string;
}

export interface ActiveMitigation {
  risk_id:           string;
  risk_name:         string;
  arabic:            string;
  current_level:     RiskLevel;
  signals:           RiskSignal[];
  graduated_response: {
    watch:    string;
    warning:  string;
    alert:    string;
    critical: string;
    restore:  string;
  };
  cascade_outputs:   string[];  // which risks this feeds into
  cascade_inputs:    string[];  // which risks feed into this
  isolation_rules:   IsolationRule[];
  last_review:       string;
  owner:             string;
}

// ══════════════════════════════════════════════════════════════════════════════
// 13 ACTIVE MITIGATIONS — one per global risk
// ══════════════════════════════════════════════════════════════════════════════

export const ACTIVE_MITIGATIONS: ActiveMitigation[] = [
  {
    risk_id: "GR-01",
    risk_name: "BTC Price Collapse",
    arabic: "انهيار سعر البيتكوين",
    current_level: "watch",
    signals: [
      { signal_id: "S01-A", name: "BTC 30-day drawdown",
        description: "Maximum drawdown from 30-day high",
        data_source: "CoinGecko API / mempool.space",
        check_interval: "1 hour",
        threshold_watch: ">20% drawdown",
        threshold_warning: ">40% drawdown",
        threshold_alert: ">60% drawdown",
        threshold_critical: ">80% drawdown" },
      { signal_id: "S01-B", name: "BTC/Gold ratio",
        description: "BTC price relative to gold oz — monitors real asset value",
        data_source: "CoinGecko + metals API",
        check_interval: "4 hours",
        threshold_watch: "ratio drops below 6-month moving average",
        threshold_warning: "ratio drops 30% below 12-month MA",
        threshold_alert: "ratio drops 50% below 12-month MA",
        threshold_critical: "ratio drops 70% below 12-month MA" },
    ],
    graduated_response: {
      watch:    "Log alert. No action. Continue normal operations.",
      warning:  "Pause new BTC reserve accumulation recommendations. Existing holdings: no forced sale.",
      alert:    "Halt all BTC reserve recommendations. Add 'high volatility' disclaimer to all BTC tools.",
      critical: "Activate CB-02 (Savings Protection Freeze). All BTC-reserve plans flagged as CONDITIONAL. Nations with >3% BTC reserve notified to review.",
      restore:  "Resume normal operations when drawdown <30% and sustained 60 days.",
    },
    cascade_outputs: ["GR-05", "GR-12"],
    cascade_inputs:  [],
    isolation_rules: [
      { protected_system: "x402 payment processing",
        from_risk: "BTC price volatility",
        isolation_method: "x402 uses real-time rate at moment of payment. Price risk is isolated to that instant — not carried.",
        fallback: "If BTC spreads >5%, route payment via STX or stablecoin automatically." },
      { protected_system: "Citizen savings advice",
        from_risk: "BTC price collapse",
        isolation_method: "System never recommends BTC >10% of savings. Diversification enforced at tool level.",
        fallback: "BTC tools display current drawdown prominently before any recommendation." },
    ],
    last_review: "2026-05-13",
    owner: "Ψ oracle + central bank of each BTC-reserve nation",
  },

  {
    risk_id: "GR-02",
    risk_name: "Protocol Capture — Hostile State Actor",
    arabic: "استيلاء دولة معادية على البروتوكول",
    current_level: "clear",
    signals: [
      { signal_id: "S02-A", name: "Hashrate concentration",
        description: "Single nation's share of BTC hashrate",
        data_source: "blockchain.info hashrate distribution",
        check_interval: "24 hours",
        threshold_watch: "any nation >30%",
        threshold_warning: "any nation >40%",
        threshold_alert: "any nation >48%",
        threshold_critical: "any nation >51%" },
      { signal_id: "S02-B", name: "Code repository control",
        description: "Percentage of core protocol commits from single national entity",
        data_source: "GitHub commit analysis",
        check_interval: "weekly",
        threshold_watch: "single entity >20% of commits",
        threshold_warning: "single entity >30% of commits",
        threshold_alert: "single entity >40% of commits",
        threshold_critical: "single entity attempting to change GENESIS_HASH" },
    ],
    graduated_response: {
      watch:    "Log. Report to protocol governance multi-sig. No user action.",
      warning:  "Public transparency report. Governance discussion initiated.",
      alert:    "Governance emergency vote. Alternative implementations highlighted. Migration path prepared.",
      critical: "Protocol forks to preserve GENESIS_HASH integrity. All users notified. Full transparency.",
      restore:  "Resume when hashrate or code concentration drops below watch threshold for 90 days.",
    },
    cascade_outputs: ["GR-07", "GR-10"],
    cascade_inputs:  ["GR-10"],
    isolation_rules: [
      { protected_system: "GENESIS_HASH identity",
        from_risk: "Protocol capture",
        isolation_method: "SHA-256('Ψ=Landauer·Nash·Cantillon⁻¹·Gödel') is mathematically immutable. Any fork that changes it is a different protocol.",
        fallback: "Users verify GENESIS_HASH independently. Immutable cryptographic anchor." },
      { protected_system: "Civilian access",
        from_risk: "Protocol capture",
        isolation_method: "Multiple independent implementations. No single binary. Open source means anyone can run their own.",
        fallback: "Community fork maintained by independent developers." },
    ],
    last_review: "2026-05-13",
    owner: "Protocol governance multi-sig (15-of-25 global signers)",
  },

  {
    risk_id: "GR-03",
    risk_name: "Mass Unemployment — Automation Wave",
    arabic: "بطالة جماعية من موجة الأتمتة",
    current_level: "watch",
    signals: [
      { signal_id: "S03-A", name: "Automation displacement index",
        description: "IMF/ILO estimated jobs at risk from AI+robotics per sector",
        data_source: "ILO World Employment and Social Outlook",
        check_interval: "quarterly",
        threshold_watch: "10% of jobs at high automation risk in any major sector",
        threshold_warning: "20% displacement in any sector within 3 years",
        threshold_alert: "30% displacement AND no retraining programs funded",
        threshold_critical: "GDP growth not compensating for employment losses" },
    ],
    graduated_response: {
      watch:    "Monitor sector-by-sector. Highlight retraining opportunity in x402 economy for displaced workers.",
      warning:  "Cantillon⁻¹ automation dividend recommendation: productivity gains must flow to workers first.",
      alert:    "Activate CB-04 (Mass Unemployment Alert) for any specific reform causing >2% sector displacement.",
      critical: "Protocol-level recommendation: automation tax + universal basic dividend. Flag to governments via Ψ oracle.",
      restore:  "Resume when employment rate returns to pre-automation baseline or UBI program covers displaced.",
    },
    cascade_outputs: ["GR-09", "GR-12"],
    cascade_inputs:  [],
    isolation_rules: [
      { protected_system: "x402 gig economy workers",
        from_risk: "Automation displacement",
        isolation_method: "x402 protocol creates new employment categories (API builders, AI trainers, quality verifiers) that automation creates, not eliminates.",
        fallback: "Skill transition guides built into protocol documentation." },
    ],
    last_review: "2026-05-13",
    owner: "National governments + ILO + Ψ monitoring",
  },

  {
    risk_id: "GR-04",
    risk_name: "CBDC Surveillance Creep",
    arabic: "تمدد مراقبة العملات الرقمية الحكومية",
    current_level: "watch",
    signals: [
      { signal_id: "S04-A", name: "CBDC design surveillance score",
        description: "Assessment of CBDC designs for surveillance capability",
        data_source: "Atlantic Council CBDC tracker + BIS CBDC survey",
        check_interval: "monthly",
        threshold_watch: "any G20 CBDC includes transaction monitoring without ZK",
        threshold_warning: "CBDC with programmable spending restrictions launched in >5 nations",
        threshold_alert: "CBDC with political access freezing capability confirmed in >10 nations",
        threshold_critical: "CBDC used to suppress political opposition in any nation" },
    ],
    graduated_response: {
      watch:    "Publish ZK-KYC alternative design. Advocate in CBDC working groups.",
      warning:  "Activate CB-05 (Surveillance Creep Block) globally. All CBDC tools display privacy risk score.",
      alert:    "Protocol refuses to integrate with surveillance-capable CBDCs. Users notified of risk.",
      critical: "Emergency civil society alert. Protocol publishes evidence. Legal action support via constitutional registry.",
      restore:  "Resume CBDC integration when ZK-KYC architecture confirmed by independent audit.",
    },
    cascade_outputs: ["GR-10"],
    cascade_inputs:  ["GR-02"],
    isolation_rules: [
      { protected_system: "User transaction privacy",
        from_risk: "CBDC surveillance",
        isolation_method: "Protocol layer is ZK-only. Even if CBDC is surveillance-capable, Ψ protocol adds ZK layer on top.",
        fallback: "Users can route payments via BTC/STX if local CBDC is surveillance-capable." },
    ],
    last_review: "2026-05-13",
    owner: "Civil society + constitutional registry + BIS",
  },

  {
    risk_id: "GR-05",
    risk_name: "Debt Trap Colonialism 2.0",
    arabic: "استعمار فخ الديون 2.0",
    current_level: "clear",
    signals: [
      { signal_id: "S05-A", name: "BTC reserve debt financing",
        description: "Nations borrowing to buy BTC reserves",
        data_source: "IMF Article IV consultations + bond issuances",
        check_interval: "quarterly",
        threshold_watch: "any nation issues bonds to fund BTC accumulation",
        threshold_warning: "BTC reserve position >3% of GDP funded by external debt",
        threshold_alert: "BTC price falls >40% AND nation has debt-funded BTC position",
        threshold_critical: "Creditor demands BTC liquidation as debt service" },
    ],
    graduated_response: {
      watch:    "Flag bond issuance in Ψ nation tool. Add 'debt-funded reserves not recommended' warning.",
      warning:  "Block sovereign_debt_plan recommendations that include BTC accumulation via debt.",
      alert:    "Activate CB-02. All BTC reserve guidance changed to 'surplus funds only, no leverage'.",
      critical: "Emergency debt restructuring guidance. Ψ oracle provides alternative path without BTC liquidation.",
      restore:  "Resume when nation's BTC position <3% GDP AND fully funded by surplus (no debt).",
    },
    cascade_outputs: ["GR-12"],
    cascade_inputs:  ["GR-01"],
    isolation_rules: [
      { protected_system: "Nation debt plan recommendations",
        from_risk: "Debt trap",
        isolation_method: "Phase 1 of 7-phase plan is ALWAYS 'Audit' — no BTC accumulation until fiscal position assessed.",
        fallback: "BTC accumulation tools require positive primary balance check before activation." },
    ],
    last_review: "2026-05-13",
    owner: "Ψ debt oracle + IMF + national finance ministries",
  },

  {
    risk_id: "GR-06",
    risk_name: "Quantum Computer Cryptographic Break",
    arabic: "كسر التشفير بالحواسيب الكمومية",
    current_level: "watch",
    signals: [
      { signal_id: "S06-A", name: "Quantum computing progress",
        description: "Logical qubit count at error-correction threshold for Shor's algorithm",
        data_source: "IBM/Google quantum roadmaps + NIST PQC updates",
        check_interval: "monthly",
        threshold_watch: "any quantum computer demonstrates 1000+ error-corrected logical qubits",
        threshold_warning: "2000+ logical qubits demonstrated",
        threshold_alert: "credible estimate of 4000+ qubits within 3 years",
        threshold_critical: "any organization claims ECDSA break (requires ~4000 logical qubits)" },
    ],
    graduated_response: {
      watch:    "Recommend post-quantum keys for all new high-value wallets. Document migration path.",
      warning:  "Activate 5-year migration program. All tools display PQ migration status.",
      alert:    "Mandatory migration for wallets >$1M. Emergency governance vote on timeline.",
      critical: "Protocol switches default to post-quantum. ECDSA wallets displayed as 'at risk'. Emergency migration.",
      restore:  "N/A — once quantum threat materializes, migration is permanent.",
    },
    cascade_outputs: ["GR-02"],
    cascade_inputs:  [],
    isolation_rules: [
      { protected_system: "GENESIS_HASH integrity",
        from_risk: "Quantum break",
        isolation_method: "GENESIS_HASH is SHA-256 — quantum-resistant (Grover's algorithm only gives 2× speedup, not exponential).",
        fallback: "SHA-256 remains secure with 256-bit keys even against quantum computers." },
      { protected_system: "New wallet generation",
        from_risk: "Quantum break",
        isolation_method: "All new wallets generated with Lamport OTS + XMSS option. Backward compatible.",
        fallback: "NIST-standardized CRYSTALS-Dilithium as fallback PQ signature scheme." },
    ],
    last_review: "2026-05-13",
    owner: "Protocol cryptography team + NIST PQC standards",
  },

  {
    risk_id: "GR-07",
    risk_name: "Regulatory Balkanization",
    arabic: "تشرذم التنظيم العالمي",
    current_level: "watch",
    signals: [
      { signal_id: "S07-A", name: "Jurisdiction fragmentation index",
        description: "Number of conflicting crypto regulations in force globally",
        data_source: "Constitutional registry + Law Library of Congress",
        check_interval: "monthly",
        threshold_watch: ">30 contradictory regulations in force",
        threshold_warning: ">50 contradictory regulations blocking cross-border transactions",
        threshold_alert: "G20 fails to agree on any crypto standard for 2 consecutive years",
        threshold_critical: "Major corridor (US-EU or US-Asia) completely closed by incompatible regulation" },
    ],
    graduated_response: {
      watch:    "Constitutional registry tracks all changes. Multi-jurisdiction routing prioritized.",
      warning:  "Publish jurisdiction compatibility matrix. Flag conflicts for each tool call.",
      alert:    "Protocol routes around blocked corridors automatically. Alternative paths computed.",
      critical: "Emergency FATF engagement. Ψ white paper submitted to regulatory bodies.",
      restore:  "Resume when major corridor opens or alternative route achieves equivalent coverage.",
    },
    cascade_outputs: [],
    cascade_inputs:  ["GR-02", "GR-04"],
    isolation_rules: [
      { protected_system: "Cross-border remittances",
        from_risk: "Regulatory balkanization",
        isolation_method: "Multi-path routing: if Corridor A is blocked, route via Corridor B. System automatically finds compliant path.",
        fallback: "At minimum one compliant path always exists via FATF-whitelisted corridors." },
    ],
    last_review: "2026-05-13",
    owner: "Constitutional registry maintainers + FATF",
  },

  {
    risk_id: "GR-08",
    risk_name: "Mining Power Concentration",
    arabic: "تركز قوة التعدين",
    current_level: "clear",
    signals: [
      { signal_id: "S08-A", name: "Nation hashrate share",
        description: "Single nation's percentage of global BTC hashrate",
        data_source: "Cambridge Centre for Alternative Finance (CCAF) hashrate map",
        check_interval: "weekly",
        threshold_watch: "any single nation >35%",
        threshold_warning: "any single nation >43%",
        threshold_alert: "any single nation >48%",
        threshold_critical: "any single nation >51%" },
    ],
    graduated_response: {
      watch:    "Log. Publish hashrate distribution report. No user action.",
      warning:  "Activate CB-07 (Wealth Concentration Limit). Recommend geographic mining diversification.",
      alert:    "Protocol flags BTC recommendations with 'hashrate concentration risk'. Governance emergency.",
      critical: "Full protocol alert. Users notified. Governance explores alternative security models.",
      restore:  "Resume normal when no single nation exceeds 35% for 90 days.",
    },
    cascade_outputs: ["GR-02"],
    cascade_inputs:  ["GR-13"],
    isolation_rules: [
      { protected_system: "Ψ sovereign blockchain (PSI)",
        from_risk: "BTC mining concentration",
        isolation_method: "PSI chain uses Proof of Physics — not hashrate-based. Immune to mining concentration risk.",
        fallback: "PSI chain operates independently of BTC hashrate distribution." },
    ],
    last_review: "2026-05-13",
    owner: "Bitcoin mining community + national energy policies",
  },

  {
    risk_id: "GR-09",
    risk_name: "Digital Divide Deepening",
    arabic: "تعمق الفجوة الرقمية",
    current_level: "watch",
    signals: [
      { signal_id: "S09-A", name: "Protocol access by income quartile",
        description: "Percentage of bottom income quartile using protocol tools",
        data_source: "World Bank digital inclusion survey",
        check_interval: "quarterly",
        threshold_watch: "bottom quartile <30% access rate",
        threshold_warning: "bottom quartile <15% access rate",
        threshold_alert: "bottom quartile falling while top quartile rising (divergence)",
        threshold_critical: "protocol actively making bottom quartile worse off" },
    ],
    graduated_response: {
      watch:    "Document SMS/USSD gap (GA-06). Prioritize low-bandwidth alternatives.",
      warning:  "Activate CR-03 (Economic Participation Right). Add free-tier access for basic services.",
      alert:    "Halt fee increases until access gap closes. Partner with telecom providers for USSD.",
      critical: "Emergency inclusion protocol. Simplified interfaces. Agent network for in-person access.",
      restore:  "Resume normal when bottom quartile access >50% of top quartile rate.",
    },
    cascade_outputs: [],
    cascade_inputs:  ["GR-03"],
    isolation_rules: [
      { protected_system: "Basic financial services",
        from_risk: "Digital divide",
        isolation_method: "Core services (balance check, small transfer, identity verification) must have SMS fallback.",
        fallback: "USSD menu system for feature phones. Works on any GSM network without internet." },
    ],
    last_review: "2026-05-13",
    owner: "Protocol UX team + national telecom regulators + civil society",
  },

  {
    risk_id: "GR-10",
    risk_name: "Protocol Capture — Financial Incumbents",
    arabic: "استيلاء المؤسسات المالية الكبرى",
    current_level: "clear",
    signals: [
      { signal_id: "S10-A", name: "Financial sector governance share",
        description: "Banks/asset managers' share of protocol governance votes",
        data_source: "Governance token distribution analysis",
        check_interval: "monthly",
        threshold_watch: "financial sector >15% of governance",
        threshold_warning: "financial sector >20% of governance",
        threshold_alert: "financial sector >25% of governance AND Cantillon⁻¹ reform reversed",
        threshold_critical: "any governance vote to route monetary expansion through banks first" },
    ],
    graduated_response: {
      watch:    "Monitor governance token distribution. Publish transparency report.",
      warning:  "Activate CB-07. Cap financial sector governance votes at 20%.",
      alert:    "Cantillon⁻¹ rule marked as protocol invariant — not governable parameter.",
      critical: "Emergency governance fork. Cantillon⁻¹ hardcoded in immutable contract layer.",
      restore:  "Resume when financial sector <15% governance and no Cantillon⁻¹ reversal attempts in 180 days.",
    },
    cascade_outputs: ["GR-04"],
    cascade_inputs:  ["GR-02"],
    isolation_rules: [
      { protected_system: "Cantillon⁻¹ routing",
        from_risk: "Financial capture",
        isolation_method: "Citizen-first routing is encoded in the protocol, not in governance parameters. Cannot be voted away.",
        fallback: "If governance attempts reversal: automatic fork preserving Cantillon⁻¹ invariant." },
    ],
    last_review: "2026-05-13",
    owner: "Protocol governance structure + civil society watchdog",
  },

  {
    risk_id: "GR-11",
    risk_name: "Energy-Backed Currency Manipulation",
    arabic: "التلاعب بالعملات المدعومة بالطاقة",
    current_level: "clear",
    signals: [
      { signal_id: "S11-A", name: "Energy verification discrepancy",
        description: "Difference between claimed and satellite-verified energy production",
        data_source: "IEA + NASA VIIRS night-light data + smart grid data",
        check_interval: "quarterly",
        threshold_watch: "any nation's claimed energy >10% above satellite estimate",
        threshold_warning: "discrepancy >25%",
        threshold_alert: "discrepancy >50% AND nation has energy-backed currency",
        threshold_critical: "confirmed fraud: government falsified energy data for currency backing" },
    ],
    graduated_response: {
      watch:    "Flag energy-backed currency with 'unverified' tag in Ψ tools.",
      warning:  "Reduce Landauer score by discrepancy percentage. Display verification status prominently.",
      alert:    "Suspend energy-backed Landauer bonus. Require independent audit.",
      critical: "Revoke energy Landauer score entirely. Notify trading partners. Publish evidence.",
      restore:  "Resume when independent audit confirms accurate energy reporting for 4 consecutive quarters.",
    },
    cascade_outputs: ["GR-12"],
    cascade_inputs:  [],
    isolation_rules: [
      { protected_system: "Nations using energy Landauer legitimately",
        from_risk: "Manipulation by others",
        isolation_method: "Each nation's energy Landauer score is independently verified. Manipulation by Nation A does not affect Nation B's score.",
        fallback: "Verified nations get 'Energy Verified ✓' badge. Unverified get 'Pending Verification'." },
    ],
    last_review: "2026-05-13",
    owner: "IEA + satellite monitoring providers + Ψ oracle",
  },

  {
    risk_id: "GR-12",
    risk_name: "Sovereign Default Cascade",
    arabic: "سلسلة تعثر سيادي",
    current_level: "watch",
    signals: [
      { signal_id: "S12-A", name: "Sovereign CDS spreads",
        description: "Credit default swap spreads on sovereign debt",
        data_source: "Bloomberg / Reuters sovereign CDS data",
        check_interval: "daily",
        threshold_watch: "any G20 nation CDS spread >300bps",
        threshold_warning: "any G20 nation CDS >500bps OR 3+ developing nations >1000bps simultaneously",
        threshold_alert: "contagion: 2+ nations' CDS spreads rising by >50% in same week",
        threshold_critical: "declared default AND contagion spreading to 5+ nations" },
    ],
    graduated_response: {
      watch:    "Monitor sovereign debt positions. Alert early via Ψ debt oracle.",
      warning:  "Activate 7-phase liberation plan for distressed nation. IMF coordination recommended.",
      alert:    "Emergency debt restructuring guidance. Ψ cooperation model CM-05 activated.",
      critical: "Full international alert. Protocol provides cascade prevention analysis to all affected nations.",
      restore:  "Resume when CDS spreads below warning threshold for 90 days.",
    },
    cascade_outputs: ["GR-09"],
    cascade_inputs:  ["GR-01", "GR-05", "GR-11", "GR-03"],
    isolation_rules: [
      { protected_system: "x402 payment processing",
        from_risk: "Sovereign default",
        isolation_method: "x402 routes around defaulted nation's currency automatically. Alternative currencies used.",
        fallback: "BTC/STX fallback always available for cross-border settlement." },
      { protected_system: "Citizen savings",
        from_risk: "Sovereign default",
        isolation_method: "CR-01 (Savings Protection) + CB-02 (Savings Freeze) activate simultaneously.",
        fallback: "Self-custody BTC/sBTC as savings hedge — not affected by sovereign default." },
    ],
    last_review: "2026-05-13",
    owner: "IMF + G20 + Ψ debt oracle",
  },

  {
    risk_id: "GR-13",
    risk_name: "Environmental Cost of Mining",
    arabic: "التكلفة البيئية للتعدين",
    current_level: "watch",
    signals: [
      { signal_id: "S13-A", name: "BTC mining renewable fraction",
        description: "Percentage of BTC mining powered by renewable energy",
        data_source: "CCAF Bitcoin Electricity Consumption Index",
        check_interval: "monthly",
        threshold_watch: "renewable fraction <50%",
        threshold_warning: "renewable fraction <40%",
        threshold_alert: "renewable fraction <30% AND hashrate growing",
        threshold_critical: "renewable fraction <20% AND significant CO₂ increase documented" },
    ],
    graduated_response: {
      watch:    "Apply renewable multiplier to Landauer score. Fossil-powered mining gets discount.",
      warning:  "Flag all BTC mining opportunity recommendations with 'environmental review required'.",
      alert:    "Mining recommendations: renewable only. Fossil-fuel mining sites removed from recommendations.",
      critical: "Protocol issues environmental emergency guidance. Mining opportunity tools suspended pending review.",
      restore:  "Resume when renewable fraction >50% for 6 consecutive months.",
    },
    cascade_outputs: ["GR-08"],
    cascade_inputs:  [],
    isolation_rules: [
      { protected_system: "Nation mining recommendations",
        from_risk: "Environmental cost",
        isolation_method: "Mining recommendations only issued when energy source is renewable OR stranded gas (flaring reduction).",
        fallback: "All mining recommendations include renewable energy requirement as hard condition." },
    ],
    last_review: "2026-05-13",
    owner: "Protocol energy committee + CCAF + IEA",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// CASCADE DEPENDENCY MAP — prevents chain reactions
// ══════════════════════════════════════════════════════════════════════════════

export const CASCADE_LINKS: CascadeLink[] = [
  { from_risk: "GR-01", to_risk: "GR-05",
    mechanism: "BTC price falls → nations with debt-funded BTC reserves face insolvency",
    delay: "Days to weeks",
    prevention: "No debt-funded BTC reserves (phase gate: surplus funds only)" },
  { from_risk: "GR-01", to_risk: "GR-12",
    mechanism: "BTC price falls → nations using BTC as reserve face balance sheet crisis",
    delay: "Weeks to months",
    prevention: "BTC reserves capped at 3% — insufficient to cause sovereign distress alone" },
  { from_risk: "GR-03", to_risk: "GR-09",
    mechanism: "Mass unemployment → more people priced out of digital economy",
    delay: "Months to years",
    prevention: "Cantillon⁻¹ automation dividend: productivity gains fund UBI and digital access" },
  { from_risk: "GR-03", to_risk: "GR-12",
    mechanism: "Mass unemployment → tax revenue collapse → sovereign debt unsustainable",
    delay: "Years",
    prevention: "Automation tax provides replacement revenue. Productivity gains taxed before distribution." },
  { from_risk: "GR-05", to_risk: "GR-12",
    mechanism: "Debt trap → forced BTC liquidation → BTC price crash → sovereign distress",
    delay: "Weeks",
    prevention: "No debt-funded reserves — cascade chain broken at origin" },
  { from_risk: "GR-02", to_risk: "GR-07",
    mechanism: "Protocol captured by one state → other states ban protocol → balkanization",
    delay: "Months",
    prevention: "GENESIS_HASH immutability — captured protocol is different protocol, original survives" },
  { from_risk: "GR-02", to_risk: "GR-10",
    mechanism: "State capture enables financial sector to take control via regulatory mandate",
    delay: "Months",
    prevention: "Cantillon⁻¹ hardcoded as invariant — no governance route to financial capture" },
  { from_risk: "GR-10", to_risk: "GR-04",
    mechanism: "Financial capture → push for CBDC surveillance to protect incumbent revenue",
    delay: "Months to years",
    prevention: "ZK-KYC architecture makes surveillance-capable CBDC economically inferior" },
  { from_risk: "GR-08", to_risk: "GR-02",
    mechanism: "Mining concentration → state with dominant hashrate attempts protocol control",
    delay: "Years",
    prevention: "Protocol security is independent of single hashrate actor below 51%" },
  { from_risk: "GR-11", to_risk: "GR-12",
    mechanism: "Energy currency manipulation → loss of credibility → currency crisis",
    delay: "Months",
    prevention: "Satellite verification catches manipulation early. Score revoked before crisis." },
  { from_risk: "GR-13", to_risk: "GR-08",
    mechanism: "Environmental pressure → regulations force mining to low-regulation zones → concentration",
    delay: "Years",
    prevention: "Protocol recommends renewable-powered mining globally, distributing hashrate" },
];

// ══════════════════════════════════════════════════════════════════════════════
// CROSS-SYSTEM ISOLATION MATRIX — nothing affects anything negatively
// ══════════════════════════════════════════════════════════════════════════════

export const SYSTEM_ISOLATION_MATRIX = {
  psi_oracle: {
    isolated_from: ["BTC price volatility", "regulatory changes", "governance disputes"],
    method: "Oracle runs on historical + current data independently of price. Scoring is algorithmic.",
    dependencies: ["Constitutional registry (read-only)", "Ψ hash chain (append-only)"],
  },
  x402_payments: {
    isolated_from: ["Sovereign default", "BTC price collapse", "mining concentration"],
    method: "Multi-currency routing. Real-time rate at moment of payment. No price risk carried.",
    dependencies: ["DEX liquidity (falls back to next DEX if one fails)"],
  },
  zero_harm_protocol: {
    isolated_from: ["Governance changes", "Protocol capture", "Regulatory changes"],
    method: "Hard-coded civilian rights. Cannot be changed by governance. Constitutional.",
    dependencies: ["None — operates independently"],
  },
  citizen_savings: {
    isolated_from: ["Sovereign default", "Bank failures", "Protocol governance"],
    method: "Self-custody. Private keys belong to citizen. No custodial risk.",
    dependencies: ["Blockchain availability (multi-chain fallback)"],
  },
  constitutional_registry: {
    isolated_from: ["Protocol disputes", "Price volatility", "Mining changes"],
    method: "Legal data only. Updated by legal team. Not affected by protocol changes.",
    dependencies: ["Legal data sources (manually curated)"],
  },
  cantillon_routing: {
    isolated_from: ["Financial sector lobbying", "Governance votes", "Regulatory pressure"],
    method: "Hardcoded invariant in protocol. Not a governance parameter. Cannot be voted away.",
    dependencies: ["Central bank cooperation (recommended, not required)"],
  },
  genesis_hash: {
    isolated_from: ["Everything"],
    method: "SHA-256 of fixed string. Mathematically immutable. Quantum-resistant (Grover's 2× speedup only).",
    dependencies: ["None"],
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// Query functions
// ══════════════════════════════════════════════════════════════════════════════

export function getActiveMitigations(): ActiveMitigation[] {
  return ACTIVE_MITIGATIONS;
}

export function getMitigation(riskId: string): ActiveMitigation | null {
  return ACTIVE_MITIGATIONS.find(m => m.risk_id === riskId.toUpperCase()) ?? null;
}

export function getCascadeLinks(riskId?: string): CascadeLink[] {
  if (!riskId) return CASCADE_LINKS;
  const id = riskId.toUpperCase();
  return CASCADE_LINKS.filter(l => l.from_risk === id || l.to_risk === id);
}

export function getSystemIsolation(system?: string) {
  if (!system) return SYSTEM_ISOLATION_MATRIX;
  const key = system.toLowerCase().replace(/-/g, "_");
  return (SYSTEM_ISOLATION_MATRIX as Record<string, unknown>)[key] ?? null;
}

export function getRiskSystemStatus() {
  const levels = ACTIVE_MITIGATIONS.map(m => m.current_level);
  const counts = { clear: 0, watch: 0, warning: 0, alert: 0, critical: 0 };
  for (const l of levels) counts[l]++;
  const highest = levels.includes("critical") ? "critical"
    : levels.includes("alert")   ? "alert"
    : levels.includes("warning") ? "warning"
    : levels.includes("watch")   ? "watch"
    : "clear";
  return {
    total_risks: ACTIVE_MITIGATIONS.length,
    current_levels: counts,
    highest_active_level: highest,
    cascade_links: CASCADE_LINKS.length,
    isolated_systems: Object.keys(SYSTEM_ISOLATION_MATRIX).length,
    overall_status: highest === "clear" || highest === "watch" ? "STABLE" : "ELEVATED",
  };
}
