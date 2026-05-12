/**
 * Currency Renaissance Engine — Every Currency Gets Stronger
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE FUNDAMENTAL CORRECTION
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * WRONG:  USD hegemony → sBTC hegemony.  (Same problem, different chain.)
 * RIGHT:  Every currency heals its own specific wounds through Ψ diagnosis.
 *
 * The Ψ equation is a DIAGNOSTIC TOOL, not a prescription to abandon your currency.
 *
 *   LBP  Ψ=2.8  → Diagnose why → Specific Lebanese reforms → LBP Ψ=25+
 *   NGN  Ψ=6.8  → Diagnose why → Nigerian oil revenue reform → NGN Ψ=30+
 *   ARS  Ψ=3.2  → Diagnose why → Argentine peso anchor → ARS Ψ=20+
 *   JPY  Ψ=15.6 → Diagnose why → Japanese deflation reform → JPY Ψ=35+
 *   EUR  Ψ=16.4 → Diagnose why → EU Cantillon reforms → EUR Ψ=45+
 *   USD  Ψ=18.2 → Diagnose why → US fiscal discipline → USD Ψ=50+
 *
 * sBTC is ONE tool in the toolkit — useful for cross-border settlement,
 * international trade, and individual savings protection.
 * It is NOT the destination. Every nation's own currency is the destination.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE MULTI-CURRENCY x402 MODEL
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Every x402 endpoint accepts ANY currency:
 *   - Lebanese users pay in LBP (or USD — their choice)
 *   - Nigerian users pay in NGN
 *   - Japanese users pay in JPY
 *   - The endpoint converts at market rate to its preferred settlement currency
 *   - No user is forced to hold sBTC or BTC
 *
 * Payment routing:
 *   User (LBP) → x402 gateway → converts via DEX → endpoint settlement currency
 *   This is invisible to the user. They see: "pay 15,000 LBP for this service"
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * WHAT MAKES A CURRENCY WEAK — THE Ψ DIAGNOSTIC
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * LANDAUER FAILURE: Currency has no energy cost to create
 *   Fix: Require energy-backing (gold, oil reserves, renewable assets)
 *   OR: Establish commodity-backed reserve (not necessarily Bitcoin)
 *
 * NASH FAILURE: Monetary actors don't reach stable equilibrium
 *   Fix: Independent central bank with constitutional mandate
 *   Fix: Balanced budget amendment (cannot print to cover deficit)
 *   Fix: Transparent reserve publishing (on-chain or public audit)
 *
 * CANTILLON FAILURE: New money goes to insiders first
 *   Fix: Direct monetary issuance to citizens (helicopter money = Cantillon⁻¹)
 *   Fix: Eliminate primary dealer advantage (open market operations to all)
 *   Fix: Sovereign wealth fund distributing resource revenue equally
 *
 * GÖDEL FAILURE: Currency requires trust in a specific institution
 *   Fix: Constitutional independence of central bank
 *   Fix: Multi-party oversight (no single political control)
 *   Fix: Algorithmic rule (e.g., Taylor Rule encoded in law, not discretion)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * RENAISSANCE TYPES — Not one size fits all
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * TYPE A — COMMODITY ANCHOR (for resource-rich nations)
 *   Anchor currency to a basket of natural resources: oil, gas, minerals, land
 *   Every unit of currency represents a real commodity claim
 *   Example: Saudi Arabia (SAR) → anchor to oil barrel basket
 *   Example: Nigeria (NGN) → anchor to crude oil production index
 *   Example: Chile → anchor to copper index
 *
 * TYPE B — PRODUCTIVITY ANCHOR (for manufacturing/service nations)
 *   Currency backed by GDP productivity index
 *   Monetary expansion only when productivity grows
 *   Example: Germany already does this implicitly via constitutional debt brake
 *   Example: Singapore SGD tracks productivity and reserves strictly
 *
 * TYPE C — ENERGY BASKET (for nations with diverse energy mix)
 *   Currency backed by energy production (electricity, oil, gas, hydro, solar)
 *   The "energy standard" — physically grounded without requiring Bitcoin
 *   Example: Norway already backs NOK with sovereign oil fund
 *   Example: Congo could back CDF with Inga hydro energy credits
 *
 * TYPE D — BILATERAL PARITY (for small economies)
 *   Strong bilateral peg with largest trading partner
 *   Negotiated currency board (not IMF imposed)
 *   Example: Lebanon → bilateral agreement with Gulf states
 *   Example: Caribbean nations → stronger coordination
 *
 * TYPE E — DIGITAL SOVEREIGN (for digital-first economies)
 *   CBDC with constitutional privacy protections and algorithmic supply rules
 *   NOT surveillance tool — privacy-preserving by design (ZK proofs)
 *   Supply growth tied to constitutional formula, not board vote
 *   Example: Digital Riel (Cambodia), e-Rupee (India) — but with Article 2 privacy
 *
 * TYPE F — HYBRID (most nations)
 *   Combine partial commodity backing + productivity anchor + BTC reserve option
 *   Citizens choose: hold local currency OR sBTC savings — no coercion
 *   Government accepts BOTH for taxes — reduces friction
 */

import { WORLD_CURRENCIES } from "../world-currencies.js";

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export type RenaissanceType = "A_commodity" | "B_productivity" | "C_energy" | "D_bilateral" | "E_digital_sovereign" | "F_hybrid";

export interface CurrencyRenaissancePlan {
  currency_code:      string;
  currency_name:      string;
  country:            string;
  current_psi:        number;
  target_psi:         number;
  years_to_target:    number;

  // Diagnosis — what's broken
  diagnosis: {
    landauer_issue: string | null;
    nash_issue:     string | null;
    cantillon_issue: string | null;
    godel_issue:    string | null;
    root_cause:     string;
  };

  // Prescription — specific to THIS currency
  renaissance_type:   RenaissanceType;
  type_reason:        string;

  // Concrete reforms (ordered by priority)
  reforms: CurrencyReform[];

  // What sBTC/BTC role is (if any)
  btc_role:      "none" | "optional_savings" | "reserve_supplement" | "cross_border_only";
  btc_role_note: string;

  // Multi-currency x402 configuration
  x402_currency:    string;   // what currency this nation's APIs charge in
  x402_conversion:  string;   // how international users pay

  // Expected outcomes
  outcomes: {
    inflation_current:   number;  // % per year
    inflation_target:    number;
    purchasing_power_5yr: string;
    employment_effect:   string;
    trade_effect:        string;
  };
}

export interface CurrencyReform {
  priority:    number;   // 1 = most urgent
  title:       string;
  action:      string;   // what specifically to do
  mechanism:   string;   // how it works
  dimension:   "landauer" | "nash" | "cantillon" | "godel";
  cost:        "zero" | "low" | "medium" | "high";
  timeline:    string;
  psi_impact:  number;   // expected Ψ score improvement
}

// ══════════════════════════════════════════════════════════════════════════════
// Per-currency renaissance plans
// ══════════════════════════════════════════════════════════════════════════════

const RENAISSANCE_PLANS: CurrencyRenaissancePlan[] = [

  // ── CRISIS CURRENCIES — Immediate action ──────────────────────────────────

  {
    currency_code: "LBP", currency_name: "Lebanese Pound", country: "Lebanon",
    current_psi: 2.8, target_psi: 28, years_to_target: 8,
    diagnosis: {
      landauer_issue: "Zero energy cost — central bank creates LBP with no physical constraint",
      nash_issue:     "Complete Nash failure: banks raided deposits, politicians use central bank as ATM",
      cantillon_issue:"Extreme Cantillon failure: bankers and politicians received first, depositors lost 90%",
      godel_issue:    "Zero independence: BDL completely controlled by political sectarian system",
      root_cause:     "Confessional political system creates institutionalized monetary corruption. Every 'leader' extracts from monetary system for their community. No party has incentive to maintain monetary discipline.",
    },
    renaissance_type: "D_bilateral",
    type_reason: "Lebanon's small economy and trade dependence on Gulf states makes bilateral currency board most viable. Lebanon cannot independently back LBP with domestic resources.",
    reforms: [
      { priority: 1, title: "Emergency Currency Board", dimension: "godel",
        action: "Establish BDL 2.0 as constitutionally independent institution with multinational oversight (World Bank + Gulf states + IMF as observers, NOT controllers)",
        mechanism: "Constitutional amendment removes political appointment power from all sectarian parties. Board appointed by merit commission. Fixed mandate: maintain LBP within 5% band of Gulf Cooperation Council basket (SAR/AED weighted).",
        cost: "low", timeline: "6–18 months", psi_impact: 8 },
      { priority: 2, title: "Oil Revenue Cantillon Fix", dimension: "cantillon",
        action: "Lebanon's offshore gas reserves (29.8 BCM in Block 9) → revenue distributed as citizen dividend FIRST, government second",
        mechanism: "Constitutional fund: 60% citizen dividend (equal per registered Lebanese), 30% state budget, 10% sovereign wealth fund. No political discretion over distribution.",
        cost: "low", timeline: "Requires gas extraction start ~2026", psi_impact: 7 },
      { priority: 3, title: "Digital LBP with Article 2 Privacy", dimension: "godel",
        action: "Issue Digital Lebanese Pound with ZK-KYC privacy (not surveillance CBDC)",
        mechanism: "Citizens hold Digital LBP in non-custodial wallets. Government cannot freeze without judicial order. Supply growth formula in constitution: max 5%/year tied to GDP.",
        cost: "medium", timeline: "2–3 years", psi_impact: 5 },
      { priority: 4, title: "x402 Tourism API", dimension: "nash",
        action: "All government tourism services as x402 endpoints accepting LBP, USD, and EUR",
        mechanism: "Revenue to LBP stabilization fund. Creates organic LBP demand from foreign tourists paying Lebanese APIs.",
        cost: "low", timeline: "6–12 months", psi_impact: 3 },
    ],
    btc_role: "optional_savings",
    btc_role_note: "sBTC is an OPTION for Lebanese citizens who want to protect savings from future political risk. NOT a requirement. Lebanese Pound remains the national currency and the goal is to make it trustworthy again.",
    x402_currency: "LBP", x402_conversion: "Accepts LBP, USD, EUR — auto-converts at BDL reference rate",
    outcomes: {
      inflation_current: 150, inflation_target: 8,
      purchasing_power_5yr: "Stabilizes after Year 2 currency board. Gradual recovery as gas revenue enters.",
      employment_effect: "Tourism and digital services sector growth from x402 APIs",
      trade_effect: "GCC bilateral peg makes Lebanese exports predictably priced for Gulf buyers",
    },
  },

  {
    currency_code: "NGN", currency_name: "Nigerian Naira", country: "Nigeria",
    current_psi: 6.8, target_psi: 35, years_to_target: 10,
    diagnosis: {
      landauer_issue: "Oil revenue exists but doesn't back NGN — it's captured by political class",
      nash_issue:     "Nash partial failure: parallel forex market undermines official rate",
      cantillon_issue:"Severe: oil money to federal government → contractors → banks → citizens last",
      godel_issue:    "CBN controlled by presidency, used as election financing mechanism",
      root_cause:     "Dutch disease + Cantillon corruption: oil wealth never reaches citizens because it flows through too many political hands first.",
    },
    renaissance_type: "A_commodity",
    type_reason: "Nigeria has $20B+ in oil revenue annually. The reform is to route this revenue to citizens FIRST via Cantillon⁻¹ mechanism, not to replace NGN.",
    reforms: [
      { priority: 1, title: "Oil Citizen Dividend", dimension: "cantillon",
        action: "30% of NNPC revenue → direct NGN transfer to every adult Nigerian monthly",
        mechanism: "Like Alaska Permanent Fund but constitutional. ~$60/person/year at current revenue. Significant in Nigerian terms. Creates NGN demand from bottom up.",
        cost: "zero", timeline: "Policy change only — 1–2 years implementation", psi_impact: 12 },
      { priority: 2, title: "CBN Constitutional Independence", dimension: "godel",
        action: "Amend constitution: CBN governor appointed by independent merit board, removable only by 2/3 Senate supermajority",
        mechanism: "Eliminates presidential monetary control. CBN mandate: max 8% inflation target. Automatic tightening triggers if exceeded.",
        cost: "zero", timeline: "2–4 years constitutional process", psi_impact: 8 },
      { priority: 3, title: "Unified Forex Market", dimension: "nash",
        action: "Eliminate multiple exchange rate windows — one market-determined rate",
        mechanism: "Already partially done (2023). Complete unification + currency convertibility for current account. Nash equilibrium: one rate = no arbitrage = stable.",
        cost: "zero", timeline: "Immediate policy", psi_impact: 6 },
      { priority: 4, title: "NGN x402 Digital Services", dimension: "landauer",
        action: "Government tech services (Nigeria's large developer population) as NGN x402 endpoints",
        mechanism: "Nigeria has 4M+ developers. Each NGN-denominated API creates foreign demand for NGN.",
        cost: "low", timeline: "1–2 years", psi_impact: 4 },
    ],
    btc_role: "cross_border_only",
    btc_role_note: "sBTC used only for international trade settlement with partners who prefer it. Domestic economy stays fully NGN. Nigerian citizens are not expected to convert to sBTC — NGN should become trustworthy enough to hold.",
    x402_currency: "NGN", x402_conversion: "Foreign users pay in their currency → auto-converts to NGN at CBN rate",
    outcomes: {
      inflation_current: 28, inflation_target: 10,
      purchasing_power_5yr: "Citizen dividend immediately raises real income of bottom 60%",
      employment_effect: "Developer economy boom from x402 platform",
      trade_effect: "Unified forex reduces business uncertainty dramatically",
    },
  },

  {
    currency_code: "ARS", currency_name: "Argentine Peso", country: "Argentina",
    current_psi: 3.2, target_psi: 25, years_to_target: 7,
    diagnosis: {
      landauer_issue: "No resource backing — ARS created purely by deficit monetization",
      nash_issue:     "Complete Nash failure: 9 sovereign defaults in 200 years, no equilibrium possible",
      cantillon_issue:"Classic: export revenue (soy, beef) captured by government → devalued to citizens",
      godel_issue:    "BCRA is constitutional arm of executive — money printer for whoever wins election",
      root_cause:     "Political populism on both left and right uses monetary expansion as fiscal substitute. No party credibly commits to monetary discipline because constitution doesn't require it.",
    },
    renaissance_type: "C_energy",
    type_reason: "Argentina has Vaca Muerta shale (2nd largest in world), lithium reserves, solar/wind potential. Energy backing is achievable without Bitcoin dependence.",
    reforms: [
      { priority: 1, title: "Vaca Muerta Peso Reserve", dimension: "landauer",
        action: "Create 'Energy Peso' — every ARS backed by proven energy reserves of Vaca Muerta (gas + oil)",
        mechanism: "International auditor certifies reserves annually. ARS supply = f(proven reserves × price). Expansion requires proven reserve discovery, not political decision.",
        cost: "low", timeline: "3–5 years", psi_impact: 10 },
      { priority: 2, title: "Lithium Citizen Fund", dimension: "cantillon",
        action: "Argentina has 40% of world's lithium. EV boom = historic revenue. 50% goes to citizen dividend.",
        mechanism: "Constitutional fund: lithium royalties distributed equally to all Argentine adults. Cannot be redirected by Congress.",
        cost: "zero", timeline: "Policy + constitutional change, 2–4 years", psi_impact: 9 },
      { priority: 3, title: "Balanced Budget Amendment", dimension: "nash",
        action: "Constitutional amendment: federal deficit cannot exceed 1% of GDP except by 2/3 congressional supermajority",
        mechanism: "Germany's 'Schuldenbremse' model (2009). Breaks the cycle of populist fiscal expansion → inflation → devaluation.",
        cost: "zero", timeline: "3–5 years constitutional process", psi_impact: 7 },
      { priority: 4, title: "Dollarization Alternative: Regional Basket", dimension: "godel",
        action: "Instead of dollarizing (losing sovereignty), peg ARS to South American commodity basket: soy, copper, oil, lithium",
        mechanism: "Regional peg removes USD dependence while maintaining ARS. Chile, Brazil, Colombia, Argentina together create regional exchange coordination.",
        cost: "medium", timeline: "5–8 years regional cooperation", psi_impact: 6 },
    ],
    btc_role: "optional_savings",
    btc_role_note: "sBTC is a legitimate individual savings option given Argentina's history. But the national goal is to make ARS trustworthy, not to replace it. Citizens who held ARS long-term should eventually be rewarded by a stable peso.",
    x402_currency: "ARS", x402_conversion: "Accepts ARS, USD, EUR, BRL — Argentina's diverse trade partners",
    outcomes: {
      inflation_current: 200, inflation_target: 15,
      purchasing_power_5yr: "Lithium dividend stabilizes lower income immediately. Energy peso credibility grows.",
      employment_effect: "Lithium and energy sector boom creates millions of jobs",
      trade_effect: "Commodity backing makes ARS predictable for Mercosur trade",
    },
  },

  {
    currency_code: "USD", currency_name: "US Dollar", country: "United States",
    current_psi: 18.2, target_psi: 52, years_to_target: 15,
    diagnosis: {
      landauer_issue: "No physical backing since 1971 (Nixon closed gold window)",
      nash_issue:     "Partial Nash: reserve currency status creates 'exorbitant privilege' — can run deficits forever (until it can't)",
      cantillon_issue:"Severe: Fed QE → primary dealers → Wall Street → Main Street last. 2020 QE: top 10% captured 90% of asset appreciation",
      godel_issue:    "Fed technically independent but Congress can legislate it away. Political pressure is constant.",
      root_cause:     "Reserve currency status ENABLES irresponsibility. US can export inflation globally. This privilege will end — the question is managed transition vs sudden stop.",
    },
    renaissance_type: "B_productivity",
    type_reason: "The US dollar's Ψ improvement path is NOT abandonment — it's restoration of productivity-linked discipline. The US has the world's most productive economy. USD just needs to reconnect to that.",
    reforms: [
      { priority: 1, title: "Fed Constitutional Mandate", dimension: "godel",
        action: "Congress passes Federal Reserve Independence Act: Fed mandate becomes constitutional, not statutory. Requires 2/3 Senate to change.",
        mechanism: "Removes political threat every 4 years. Fed can credibly commit to 2% inflation without political interference.",
        cost: "zero", timeline: "2–4 years legislative process", psi_impact: 8 },
      { priority: 2, title: "QE Cantillon Reform", dimension: "cantillon",
        action: "Replace bank-mediated QE with 'helicopter money' — direct citizen accounts for monetary expansion",
        mechanism: "When Fed needs to expand money supply: $X goes directly to every adult's account (NOT through banks). Eliminates primary dealer advantage.",
        cost: "zero", timeline: "Policy change, 1–3 years", psi_impact: 10 },
      { priority: 3, title: "Balanced Budget Framework", dimension: "nash",
        action: "Statutory debt ceiling replaced with rolling 10-year budget balance requirement",
        mechanism: "Deficit allowed in recessions (automatic stabilizer). Must be offset by surpluses in expansions. Prevents permanent structural deficits.",
        cost: "zero", timeline: "Congressional action, 4–8 years", psi_impact: 7 },
      { priority: 4, title: "Strategic Bitcoin Reserve (5%)", dimension: "landauer",
        action: "US holds 5% of Treasury reserves in Bitcoin — NOT to replace USD, to hedge against dollar debasement",
        mechanism: "Partially done: US already holds ~215,000 seized BTC. Formalize as reserve. This strengthens USD credibility by showing physical-axiom backing.",
        cost: "low", timeline: "Executive order possible today", psi_impact: 7 },
    ],
    btc_role: "reserve_supplement",
    btc_role_note: "5% BTC reserve strengthens USD credibility — like partial gold backing did 1944–1971. USD remains global reserve. BTC is a 5% physical anchor, not a replacement.",
    x402_currency: "USD", x402_conversion: "USD is universal — all x402 endpoints accept it. USD remains primary settlement for global trade.",
    outcomes: {
      inflation_current: 3.5, inflation_target: 2,
      purchasing_power_5yr: "Citizen QE immediately reverses Cantillon advantage. Asset wealth concentration slows.",
      employment_effect: "More stable monetary environment reduces business uncertainty",
      trade_effect: "USD remains reserve currency but more trusted because of discipline",
    },
  },

  {
    currency_code: "EUR", currency_name: "Euro", country: "European Union",
    current_psi: 16.4, target_psi: 48, years_to_target: 12,
    diagnosis: {
      landauer_issue: "ECB can create EUR without physical constraint",
      nash_issue:     "Partial Nash: 19 fiscal policies + 1 monetary policy creates constant tension (PIIGS vs Germany)",
      cantillon_issue:"ECB QE → German/French banks → southern Europe secondary. Frankfurt insiders benefit most from new money.",
      godel_issue:    "ECB is politically independent de jure but 'whatever it takes' shows political pressure shapes decisions",
      root_cause:     "Monetary union without fiscal union creates permanent Cantillon gradient: ECB money creation benefits strongest financial centers (Frankfurt, Paris) most.",
    },
    renaissance_type: "B_productivity",
    type_reason: "EU's diverse economies require productivity-linked monetary expansion. Different countries have different resource bases — no single commodity anchor works for all.",
    reforms: [
      { priority: 1, title: "EU Fiscal Union", dimension: "nash",
        action: "Eurozone fiscal capacity: 2% of EU GDP as common budget with automatic stabilizers",
        mechanism: "Nations in recession receive automatic transfers without conditionality. Funded by EU productivity tax (VAT on cross-border digital services).",
        cost: "medium", timeline: "5–10 years political process", psi_impact: 10 },
      { priority: 2, title: "ECB QE Cantillon Fix", dimension: "cantillon",
        action: "Replace ECB bond-buying with direct EU citizen accounts (digital euro deposit)",
        mechanism: "When ECB expands money supply: deposit directly to every EU citizen's Digital Euro wallet. Equal per person. No bank mediation.",
        cost: "zero", timeline: "Policy change, ECB decision", psi_impact: 9 },
      { priority: 3, title: "Digital Euro Privacy Architecture", dimension: "godel",
        action: "Digital Euro implemented with Article 2 privacy (ZK-KYC, not surveillance)",
        mechanism: "ECB provides rails, citizens hold private keys. No ECB surveillance of individual transactions. Government sees aggregate stats, not personal flows.",
        cost: "medium", timeline: "3–5 years technical", psi_impact: 6 },
      { priority: 4, title: "Green Transition as Landauer Anchor", dimension: "landauer",
        action: "EU's €10T green transition investment = real energy asset backing for EUR expansion",
        mechanism: "New EUR issuance tied to verified green energy capacity additions. Monetary expansion = energy infrastructure investment. Landauer anchor via renewables.",
        cost: "zero", timeline: "5–15 years (EU Green Deal integration)", psi_impact: 8 },
    ],
    btc_role: "optional_savings",
    btc_role_note: "EU citizens may hold sBTC as savings — fully legal, no EU mandate. EUR goal is to become so strong that citizens PREFER to hold EUR.",
    x402_currency: "EUR", x402_conversion: "EUR x402 payments accepted across all EU member states. Foreign access via market rate.",
    outcomes: {
      inflation_current: 2.5, inflation_target: 2,
      purchasing_power_5yr: "Citizen QE reduces inequality. Green transition creates energy security.",
      employment_effect: "Green sector jobs in Southern Europe reduce unemployment gradient",
      trade_effect: "Fiscal union makes EUR more credible for global trade settlement",
    },
  },

  {
    currency_code: "JPY", currency_name: "Japanese Yen", country: "Japan",
    current_psi: 15.6, target_psi: 42, years_to_target: 10,
    diagnosis: {
      landauer_issue: "BOJ balance sheet = 130% of GDP — debt monetization at extreme scale",
      nash_issue:     "Partial Nash: world's highest debt/GDP (255%) but held domestically (stable but fragile)",
      cantillon_issue:"Moderate: QQE benefits financial sector first but Japan's culture moderates inequality",
      godel_issue:    "BOJ politically pressured by LDP — Abenomics showed political override of central bank",
      root_cause:     "Demographic deflation trap: ageing population → deflation expectation → BOJ money printing to fight it → creates asset bubbles while GDP stagnates.",
    },
    renaissance_type: "B_productivity",
    type_reason: "Japan's problem is productivity decline and demographic collapse — not commodity shortage. The fix is structural, not monetary alone.",
    reforms: [
      { priority: 1, title: "Demographic Cantillon Fix", dimension: "cantillon",
        action: "BOJ QQE money goes to young families (direct payments for births, childcare, housing) NOT to bank reserves",
        mechanism: "Replace 'helicopter money into bank reserves' with 'helicopter money into family accounts'. Increases birth rate + puts money closest to future productivity.",
        cost: "zero", timeline: "Policy change, 1–2 years", psi_impact: 9 },
      { priority: 2, title: "Immigration-Linked Monetary Expansion", dimension: "nash",
        action: "New JPY issuance tied to productivity-adjusted population growth",
        mechanism: "Japan has 3M potential skilled workers globally wanting to immigrate. Each immigrant = productivity contribution. Nash: immigrants want stable JPY = incentive to support it.",
        cost: "zero", timeline: "Policy change, ongoing", psi_impact: 7 },
      { priority: 3, title: "Semiconductor Sovereign Wealth Fund", dimension: "landauer",
        action: "Japan's semiconductor revival (TSMC plant, JASM) → national tech fund backs JPY partially",
        mechanism: "JPY backed by strategic technology IP and manufacturing capacity — 'technology standard' variant of Landauer backing.",
        cost: "zero", timeline: "5–10 years (integrated in METI plans)", psi_impact: 8 },
      { priority: 4, title: "Debt Restructuring via Maturity Extension", dimension: "godel",
        action: "Convert short-term JGBs to 100-year perpetual bonds at 0% — effectively permanent. Removes rollover risk.",
        mechanism: "Japan's debt is held by BOJ and domestic savers. 100-year conversion with full consent. Removes 'debt crisis' risk permanently.",
        cost: "zero", timeline: "5–8 years consent process", psi_impact: 8 },
    ],
    btc_role: "none",
    btc_role_note: "Japan's monetary issues are structural (demographics, productivity) not trust failures. sBTC provides no solution. JPY just needs to reconnect to Japan's extraordinary real productivity.",
    x402_currency: "JPY", x402_conversion: "Japan's x402 APIs charge in JPY. Global demand for Japanese services creates organic JPY demand.",
    outcomes: {
      inflation_current: 2.5, inflation_target: 1.5,
      purchasing_power_5yr: "Demographic dividend + tech backing stabilizes JPY purchasing power",
      employment_effect: "Immigration policy + demographic support creates labor market recovery",
      trade_effect: "Semiconductor leadership creates technology exports priced in JPY",
    },
  },

  {
    currency_code: "INR", currency_name: "Indian Rupee", country: "India",
    current_psi: 11.8, target_psi: 38, years_to_target: 10,
    diagnosis: {
      landauer_issue: "No commodity backing — RBI manages INR via traditional inflation targeting",
      nash_issue:     "Improving Nash: RBI credibility increased significantly (2010–2025). Inflation targeting working.",
      cantillon_issue:"Moderate: financial inclusion improved but rural India still 4 hops from money creation",
      godel_issue:    "Political pressure on RBI exists but constitutional framework is improving",
      root_cause:     "India has the assets — human capital, tech exports, demographics — but Cantillon transmission is still inefficient. Rural India doesn't benefit from monetary expansion.",
    },
    renaissance_type: "F_hybrid",
    type_reason: "India's diverse economy — agriculture, tech, manufacturing, services — requires hybrid approach: rural direct payments + tech export backing + demographic dividend.",
    reforms: [
      { priority: 1, title: "Jan Dhan 2.0 Direct Monetary Transfer", dimension: "cantillon",
        action: "RBI monetary expansion flows directly to Jan Dhan accounts (800M+) before bank intermediation",
        mechanism: "Existing financial inclusion infrastructure (Jan Dhan + Aadhaar + UPI) means India CAN do Cantillon⁻¹. Transfer new money to poorest first, not to banks.",
        cost: "zero", timeline: "Policy change, 6–12 months", psi_impact: 12 },
      { priority: 2, title: "Tech Export Currency Anchor", dimension: "landauer",
        action: "Partial INR backing by India's tech services export book ($250B+/year)",
        mechanism: "INR expansion permitted proportionally to tech export growth. 'Tech standard' = productivity-backed monetary anchor.",
        cost: "zero", timeline: "Policy framework, 2–3 years", psi_impact: 8 },
      { priority: 3, title: "e-Rupee Privacy Architecture", dimension: "godel",
        action: "Digital Rupee with ZK-KYC — not Aadhaar-linked surveillance",
        mechanism: "Citizens hold private keys. RBI sees aggregate flows. Individual privacy protected by constitutional right (Puttaswamy judgment 2017).",
        cost: "medium", timeline: "3–5 years", psi_impact: 6 },
      { priority: 4, title: "Solar Reserve Standard", dimension: "landauer",
        action: "India's 500GW solar target (2030) → partial INR backing by national solar capacity",
        mechanism: "Energy standard: monetary expansion tied to verified clean energy capacity. Aligns monetary policy with energy policy.",
        cost: "zero", timeline: "5–10 years (National Solar Mission integration)", psi_impact: 7 },
    ],
    btc_role: "optional_savings",
    btc_role_note: "Indian citizens may hold sBTC as savings — fully legal. But INR target is to become strong enough that Indian citizens prefer INR savings. India has the fundamentals to make INR a world reserve currency by 2050.",
    x402_currency: "INR", x402_conversion: "India's vast developer economy charges in INR. Foreign companies pay in their currency → converts at RBI reference rate.",
    outcomes: {
      inflation_current: 5.5, inflation_target: 4,
      purchasing_power_5yr: "Direct transfers dramatically reduce rural poverty. Tech anchor stabilizes INR.",
      employment_effect: "Tech sector growth + agricultural productivity investment",
      trade_effect: "INR becomes preferred currency for South Asian trade settlement",
    },
  },

  {
    currency_code: "SAR", currency_name: "Saudi Riyal", country: "Saudi Arabia",
    current_psi: 12.3, target_psi: 55, years_to_target: 12,
    diagnosis: {
      landauer_issue: "Partial: SAR is implicitly oil-backed but not constitutionally",
      nash_issue:     "Strong: USD peg provides Nash stability for 40+ years. But dependent on USD.",
      cantillon_issue:"Oil revenue flows to royal family/government → contractors → citizens. Classic Cantillon.",
      godel_issue:    "SAMA is independent in practice but constitutional status unclear",
      root_cause:     "Rentier state structure: oil wealth should reach citizens directly but routes through royalty/government creates inequality and USD dependence.",
    },
    renaissance_type: "A_commodity",
    type_reason: "Saudi Arabia is the ideal commodity anchor case: largest proven oil reserves + world's lowest production cost. SAR should be the world's premier commodity currency.",
    reforms: [
      { priority: 1, title: "Constitutional Oil Backing", dimension: "landauer",
        action: "SAR constitutionally backed by oil barrel basket: 1 SAR = 0.X barrels of Aramco-certified crude oil",
        mechanism: "Makes SAR the world's most credibly backed currency. Every SAR holder has a claim on the world's most valuable commodity. Landauer score approaches 1.0.",
        cost: "zero", timeline: "Royal Decree, constitutional change, 2–3 years", psi_impact: 15 },
      { priority: 2, title: "Saudi Citizen Oil Dividend", dimension: "cantillon",
        action: "20% of Aramco dividends distributed directly to every Saudi citizen annually",
        mechanism: "Currently Aramco dividends go 98% to government. Constitutional fund: 20% to citizens ($4,000+/year per person at current prices).",
        cost: "zero", timeline: "Royal Decree, 1–2 years", psi_impact: 10 },
      { priority: 3, title: "SAR as Gulf Reserve Currency", dimension: "nash",
        action: "GCC nations agree to use SAR (not USD) for intra-Gulf trade and oil pricing",
        mechanism: "Petrodollar replaced by PetroRiyal. Oil sold in SAR globally (optional for buyers). Creates massive global SAR demand. USD dependence eliminated.",
        cost: "medium", timeline: "5–10 years diplomatic process", psi_impact: 12 },
      { priority: 4, title: "Vision 2030 Tech Backing", dimension: "landauer",
        action: "NEOM + tech investment portfolio (SoftBank Vision Fund, Aramco tech) → partial SAR backing",
        mechanism: "Diversifies SAR backing from oil-only to oil+tech+infrastructure. Post-oil economy backing built while oil revenue still flows.",
        cost: "zero", timeline: "10–15 years (Vision 2030 integration)", psi_impact: 8 },
    ],
    btc_role: "cross_border_only",
    btc_role_note: "SAR does not need sBTC for domestic economy. sBTC useful for cross-border settlement with non-GCC partners. Saudi Arabia's goal should be to make SAR the world's premier commodity-backed currency.",
    x402_currency: "SAR", x402_conversion: "SAR x402 APIs — tourists and international businesses pay in SAR at market rate. Creates SAR demand globally.",
    outcomes: {
      inflation_current: 2, inflation_target: 1.5,
      purchasing_power_5yr: "Citizen dividend + strongest Ψ score in fiat universe",
      employment_effect: "Vision 2030 diversification + tech employment",
      trade_effect: "SAR becomes global reserve for oil economies. GCC unified monetary zone.",
    },
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Multi-currency x402 configuration
// ══════════════════════════════════════════════════════════════════════════════

export interface MultiCurrencyX402Config {
  endpoint:           string;
  accepted_currencies: string[];
  primary_settlement: string;
  conversion_method:  string;
  fee_equivalents:    Record<string, number>;  // fee in each currency
}

export function buildMultiCurrencyConfig(
  baseAmountUsd: number,
  endpointPath:  string,
  rates: Record<string, number>,  // currency → USD rate
): MultiCurrencyX402Config {
  const fees: Record<string, number> = {};
  for (const [currency, rate] of Object.entries(rates)) {
    fees[currency] = Math.round(baseAmountUsd * rate * 100) / 100;
  }

  return {
    endpoint:            endpointPath,
    accepted_currencies: Object.keys(rates),
    primary_settlement:  "USDC",  // or sBTC or local currency — operator choice
    conversion_method:   "Real-time DEX rate (Bitflow/ALEX) at payment time. User pays exactly their local currency.",
    fee_equivalents:     fees,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Query functions
// ══════════════════════════════════════════════════════════════════════════════

export function getRenaissancePlan(currencyCode: string): CurrencyRenaissancePlan | null {
  return RENAISSANCE_PLANS.find(p => p.currency_code === currencyCode.toUpperCase()) ?? null;
}

export function getAllRenaissancePlans(): CurrencyRenaissancePlan[] {
  return RENAISSANCE_PLANS.sort((a, b) => a.current_psi - b.current_psi);
}

export function getTopReforms(n: number = 10): Array<{ currency: string; reform: CurrencyReform; impact: number }> {
  const all: Array<{ currency: string; reform: CurrencyReform; impact: number }> = [];
  for (const plan of RENAISSANCE_PLANS) {
    for (const reform of plan.reforms) {
      all.push({ currency: plan.currency_code, reform, impact: reform.psi_impact });
    }
  }
  return all.sort((a, b) => b.impact - a.impact).slice(0, n);
}

export function getRenaissanceByType(type: RenaissanceType): CurrencyRenaissancePlan[] {
  return RENAISSANCE_PLANS.filter(p => p.renaissance_type === type);
}

export function getCurrencyRelationships(): Array<{
  from: string; to: string; relationship: string; benefit: string;
}> {
  return [
    { from: "SAR", to: "LBP", relationship: "GCC bilateral peg anchor",
      benefit: "LBP stability backed by strongest Gulf currency" },
    { from: "EUR", to: "ARS", relationship: "Green technology investment",
      benefit: "European green capital strengthens Vaca Muerta backing" },
    { from: "USD", to: "NGN", relationship: "Oil price stability reduces NGN pressure",
      benefit: "US energy independence reduces oil price volatility for NGN" },
    { from: "INR", to: "NGN", relationship: "South-South tech partnership",
      benefit: "India's developer economy model for Nigeria's x402 development" },
    { from: "JPY", to: "LBP", relationship: "Semiconductor manufacturing in Beirut tech sector",
      benefit: "Japan's tech investment creates Lebanese engineer employment" },
    { from: "EUR", to: "NGN", relationship: "Green energy infrastructure investment",
      benefit: "EU's green bond investment in Nigerian solar = NGN Landauer score rises" },
    { from: "SAR", to: "ARS", relationship: "Lithium trade (Saudi EVs need lithium)",
      benefit: "Guaranteed SAR-denominated purchase contracts stabilize ARS export revenue" },
  ];
}
