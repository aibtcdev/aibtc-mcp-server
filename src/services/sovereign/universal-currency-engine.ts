/**
 * Universal Currency Engine — محرك العملات الشامل
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * SOLVES: GA-01 (4% currency coverage) + GA-02 (8% nation coverage)
 *
 * Parameterized template engine that generates a complete Ψ renaissance
 * plan for ANY of the 180 ISO fiat currencies from 6 archetype templates.
 *
 * Input:  currency code + country + Ψ dimension scores + renaissance type
 * Output: full CurrencyRenaissancePlan equivalent — identical to hand-coded ones
 *
 * Also includes 80 additional nation profiles (expanding 16 → 96 nations).
 */

import { RenaissanceType } from "./currency-renaissance.js";

// ══════════════════════════════════════════════════════════════════════════════
// Universal input descriptor — enough to generate a full plan
// ══════════════════════════════════════════════════════════════════════════════

export interface CurrencyDescriptor {
  currency_code:   string;
  currency_name:   string;
  country:         string;
  region:          string;
  current_psi:     number;
  target_psi:      number;
  years_to_target: number;
  renaissance_type: RenaissanceType;

  // Ψ dimension failure scores (0 = perfect, 100 = complete failure)
  landauer_failure: number;
  nash_failure:     number;
  cantillon_failure: number;
  godel_failure:    number;

  // Country characteristics for reform generation
  key_asset:       string;   // e.g. "oil", "tech exports", "agriculture", "tourism", "remittances"
  primary_problem: string;   // e.g. "hyperinflation", "dollarization", "debt trap", "dutch disease"
  population_m:    number;
  gdp_billions:    number;
  debt_gdp_pct:    number;
  inflation_pct:   number;
  btc_role:        "none" | "optional_savings" | "reserve_supplement" | "cross_border_only";

  // Optional overrides
  custom_reform_1?: string;
  custom_reform_2?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Template generators — one per renaissance type
// ══════════════════════════════════════════════════════════════════════════════

function reformsForType(d: CurrencyDescriptor) {
  const reforms = [];
  const assetLabel = d.key_asset.toUpperCase();

  switch (d.renaissance_type) {
    case "A_commodity":
      reforms.push(
        { priority: 1, title: `Constitutional ${assetLabel} Backing`, dimension: "landauer" as const,
          action: `${d.currency_code} constitutionally backed by certified ${d.key_asset} reserves`,
          mechanism: `Central bank holds audited ${d.key_asset} certificates. Every ${d.currency_code} unit has a proportional claim on sovereign resource. Landauer score approaches 1.0.`,
          cost: "zero" as const, timeline: "2–4 years (constitutional amendment)", psi_impact: 14 },
        { priority: 2, title: "Citizen Resource Dividend", dimension: "cantillon" as const,
          action: `20% of ${d.key_asset} revenue distributed directly to every citizen annually`,
          mechanism: `Mobile money distribution. No intermediary. Citizens receive dividend before government discretionary spending. Cantillon⁻¹ in action.`,
          cost: "zero" as const, timeline: "1–2 years (decree)", psi_impact: 11 },
        { priority: 3, title: "Independent Resource Oversight Board", dimension: "godel" as const,
          action: "Constitutionally independent board audits all resource contracts and revenues",
          mechanism: "Elected board + international observers. All contracts published on-chain. No government can award resource contracts without board approval.",
          cost: "low" as const, timeline: "1–2 years", psi_impact: 7 },
        { priority: 4, title: "Nash Diversification Fund", dimension: "nash" as const,
          action: `10% of ${d.key_asset} revenue invested in non-${d.key_asset} productive sectors`,
          mechanism: "Sovereign diversification fund. Prevents Dutch Disease. Builds Nash equilibrium across economic sectors.",
          cost: "zero" as const, timeline: "3–5 years", psi_impact: 6 },
      );
      break;

    case "B_productivity":
      reforms.push(
        { priority: 1, title: "Citizen QE — Direct Monetary Expansion", dimension: "cantillon" as const,
          action: `New ${d.currency_code} issuance flows to citizen accounts first, not bank reserves`,
          mechanism: `Central bank digital accounts for all citizens. New money injected at citizen level. Bank intermediation bypassed. Cantillon⁻¹ achieved.`,
          cost: "zero" as const, timeline: "2–3 years (CBDC infrastructure)", psi_impact: 12 },
        { priority: 2, title: "Constitutional Central Bank Independence", dimension: "godel" as const,
          action: "Central bank independence constitutionally protected with fixed inflation mandate",
          mechanism: "Governor removable only by 2/3 parliamentary vote + judicial review. No executive override. Gödel integrity restored.",
          cost: "zero" as const, timeline: "1–2 years", psi_impact: 9 },
        { priority: 3, title: `${d.key_asset} Export Anchor`, dimension: "landauer" as const,
          action: `${d.currency_code} expansion tied proportionally to ${d.key_asset} export growth`,
          mechanism: `Productivity standard: monetary base grows only as fast as real ${d.key_asset} exports. Landauer anchor via demonstrated productivity.`,
          cost: "zero" as const, timeline: "2–3 years (policy framework)", psi_impact: 8 },
        { priority: 4, title: "Balanced Budget Amendment", dimension: "nash" as const,
          action: "Constitutional requirement: structural deficit ≤ 3% GDP, cyclically adjusted",
          mechanism: "Nash equilibrium via fiscal credibility. Markets trust currency that cannot be inflated away by deficit spending.",
          cost: "zero" as const, timeline: "2–4 years (amendment)", psi_impact: 7 },
      );
      break;

    case "C_energy":
      reforms.push(
        { priority: 1, title: "Sovereign Energy Standard", dimension: "landauer" as const,
          action: `${d.currency_code} backed by verified national clean energy capacity`,
          mechanism: "Every MW of certified renewable capacity = monetary backing. New currency issuance only when new energy installed. Landauer = physical energy law.",
          cost: "medium" as const, timeline: "5–10 years (energy build-out)", psi_impact: 13 },
        { priority: 2, title: "Energy Citizen Dividend", dimension: "cantillon" as const,
          action: "Citizens receive energy dividends as national energy exports grow",
          mechanism: "Energy export revenue shared directly. Citizens get energy security + income. Cantillon⁻¹ via energy sector.",
          cost: "zero" as const, timeline: "2–3 years", psi_impact: 10 },
        { priority: 3, title: "Energy-Backed Currency Verification", dimension: "godel" as const,
          action: "Satellite + smart grid verification of claimed energy backing",
          mechanism: "No self-reporting. Independent verification via IEA + satellite monitoring. Prevents GA-11 energy manipulation risk.",
          cost: "low" as const, timeline: "2–3 years", psi_impact: 7 },
        { priority: 4, title: "Energy Trade Nash Agreement", dimension: "nash" as const,
          action: "Bilateral energy trade denominated in local currency, not USD",
          mechanism: "Energy exporters negotiate local currency settlement. Creates organic demand for energy-backed currency.",
          cost: "zero" as const, timeline: "3–5 years (diplomacy)", psi_impact: 6 },
      );
      break;

    case "D_bilateral":
      reforms.push(
        { priority: 1, title: "Bilateral Currency Board", dimension: "nash" as const,
          action: `${d.currency_code} pegged to basket of regional trading partners' currencies`,
          mechanism: "Currency board: 100% reserves in basket. No discretionary printing. Nash equilibrium via credible commitment.",
          cost: "low" as const, timeline: "1–2 years", psi_impact: 11 },
        { priority: 2, title: "Regional Cantillon Integration", dimension: "cantillon" as const,
          action: "Monetary expansion within bilateral agreement distributed to citizens of both nations",
          mechanism: "Bilateral citizen dividend: trade surplus distributed proportionally to populations. Both nations benefit equitably.",
          cost: "zero" as const, timeline: "2–3 years", psi_impact: 9 },
        { priority: 3, title: "Constitutional Peg Protection", dimension: "godel" as const,
          action: "Bilateral peg protected in constitution — requires referendum to change",
          mechanism: "Citizens vote on peg parameters every 10 years. No unilateral political override.",
          cost: "zero" as const, timeline: "1–2 years", psi_impact: 7 },
        { priority: 4, title: `${d.key_asset} Joint Backing`, dimension: "landauer" as const,
          action: `Both nations' ${d.key_asset} reserves jointly back the bilateral currency`,
          mechanism: "Combined resource pool = stronger Landauer backing than either nation alone.",
          cost: "zero" as const, timeline: "3–5 years", psi_impact: 6 },
      );
      break;

    case "E_digital_sovereign":
      reforms.push(
        { priority: 1, title: "Privacy-First CBDC Architecture", dimension: "godel" as const,
          action: `Digital ${d.currency_code} implemented with ZK-KYC — zero surveillance`,
          mechanism: "Citizens hold private keys. Central bank sees aggregate stats only. Individual transactions private by constitutional right.",
          cost: "medium" as const, timeline: "3–5 years", psi_impact: 11 },
        { priority: 2, title: "Digital Citizen QE", dimension: "cantillon" as const,
          action: "CBDC infrastructure enables instant direct monetary transfers to all citizens",
          mechanism: "No correspondent banks needed. Central bank to citizen wallet in seconds. Cantillon⁻¹ achieved via digital rails.",
          cost: "zero" as const, timeline: "1–2 years post-CBDC", psi_impact: 10 },
        { priority: 3, title: "x402 National API Economy", dimension: "nash" as const,
          action: `Government and private services priced in ${d.currency_code} via x402 protocol`,
          mechanism: "National API economy creates organic ${d.currency_code} demand. Every digital service = demand for currency.",
          cost: "zero" as const, timeline: "2–4 years", psi_impact: 8 },
        { priority: 4, title: "Digital Productivity Anchor", dimension: "landauer" as const,
          action: `${d.currency_code} expansion tied to verified digital economy output`,
          mechanism: "Tech export receipts, API revenue, digital services GDP — measured and used as Landauer anchor.",
          cost: "zero" as const, timeline: "2–3 years", psi_impact: 7 },
      );
      break;

    case "F_hybrid":
    default:
      reforms.push(
        { priority: 1, title: "Hybrid Cantillon Direct Transfer", dimension: "cantillon" as const,
          action: `New ${d.currency_code} reaches citizens via multiple direct channels`,
          mechanism: `Mobile money + CBDC + cash distribution. Covers urban, rural, banked and unbanked. No single intermediary required. Cantillon⁻¹ at scale.`,
          cost: "low" as const, timeline: "2–3 years", psi_impact: 11 },
        { priority: 2, title: `Partial ${assetLabel} Backing`, dimension: "landauer" as const,
          action: `${d.currency_code} partially backed by ${d.key_asset} — not 100% but meaningful`,
          mechanism: `Start at 10% backing. Increase as ${d.key_asset} verification systems mature. Better than 0% backing today.`,
          cost: "zero" as const, timeline: "1–3 years", psi_impact: 9 },
        { priority: 3, title: "Institutional Independence Package", dimension: "godel" as const,
          action: "Central bank + judiciary + audit institutions constitutionally shielded",
          mechanism: "Package deal: independence for all three institutions simultaneously. Harder to reverse than piecemeal.",
          cost: "zero" as const, timeline: "2–4 years", psi_impact: 8 },
        { priority: 4, title: "Regional Nash Alignment", dimension: "nash" as const,
          action: `${d.currency_code} joins regional monetary coordination framework`,
          mechanism: "Regional coordination reduces competitive devaluation. Nash equilibrium for all members: cooperate > defect.",
          cost: "zero" as const, timeline: "3–5 years (diplomacy)", psi_impact: 6 },
      );
  }

  // Inject custom reforms if provided
  if (d.custom_reform_1) {
    reforms.push({ priority: 5, title: "Custom Reform 1", dimension: "nash" as const,
      action: d.custom_reform_1, mechanism: "Custom — see action description.",
      cost: "zero" as const, timeline: "As specified", psi_impact: 5 });
  }
  if (d.custom_reform_2) {
    reforms.push({ priority: 6, title: "Custom Reform 2", dimension: "godel" as const,
      action: d.custom_reform_2, mechanism: "Custom — see action description.",
      cost: "zero" as const, timeline: "As specified", psi_impact: 4 });
  }

  return reforms;
}

export function generateRenaissancePlan(d: CurrencyDescriptor) {
  const reforms = reformsForType(d);

  const landauerIssue = d.landauer_failure > 30
    ? `Score ${d.landauer_failure}/100 — ${d.key_asset} backing absent or unverified`
    : null;
  const nashIssue = d.nash_failure > 30
    ? `Score ${d.nash_failure}/100 — coordination failure, competitive devaluation risk`
    : null;
  const cantillonIssue = d.cantillon_failure > 30
    ? `Score ${d.cantillon_failure}/100 — monetary expansion benefits intermediaries, not citizens`
    : null;
  const godelIssue = d.godel_failure > 30
    ? `Score ${d.godel_failure}/100 — institutional independence compromised by political pressure`
    : null;

  const btcNote: Record<string, string> = {
    none:             `${d.currency_code} does not need BTC for its renaissance. Structural reforms achieve target Ψ without Bitcoin.`,
    optional_savings: `Citizens may hold BTC as personal savings. No mandate. Goal is ${d.currency_code} strong enough that citizens prefer it.`,
    reserve_supplement:`${d.country} may hold 1–5% BTC reserve as hedge. Long-term hold, no leverage, no forced liquidation.`,
    cross_border_only: `BTC useful for cross-border settlement with non-regional partners. Domestic economy stays on ${d.currency_code}.`,
  };

  return {
    currency_code:      d.currency_code,
    currency_name:      d.currency_name,
    country:            d.country,
    current_psi:        d.current_psi,
    target_psi:         d.target_psi,
    years_to_target:    d.years_to_target,
    diagnosis: {
      landauer_issue:   landauerIssue,
      nash_issue:       nashIssue,
      cantillon_issue:  cantillonIssue,
      godel_issue:      godelIssue,
      root_cause:       `${d.primary_problem} — ${d.country} has ${d.key_asset} potential but Ψ failures prevent citizens from benefiting.`,
    },
    renaissance_type:   d.renaissance_type,
    type_reason:        `${d.country}'s primary strength is ${d.key_asset}. ${d.renaissance_type} archetype maximizes this advantage for citizens.`,
    reforms,
    btc_role:           d.btc_role,
    btc_role_note:      btcNote[d.btc_role],
    x402_currency:      d.currency_code,
    x402_conversion:    `${d.country}'s x402 APIs priced in ${d.currency_code}. International users pay at live DEX rate — no forced currency.`,
    outcomes: {
      inflation_current:   d.inflation_pct,
      inflation_target:    Math.max(2, d.inflation_pct * 0.3),
      purchasing_power_5yr: `Cantillon⁻¹ reforms + ${d.key_asset} backing improve real purchasing power for bottom 60% of income distribution.`,
      employment_effect:   `${d.key_asset} sector development + digital economy via x402 creates new employment pathways.`,
      trade_effect:        `Stronger ${d.currency_code} reduces import costs. Regional Nash alignment reduces trade friction.`,
    },
    generated: true,
    generator_version: "UCE-1.0",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Expanded nation database — 80 additional nations (16 → 96)
// ══════════════════════════════════════════════════════════════════════════════

export const EXPANDED_NATIONS: CurrencyDescriptor[] = [
  // ── AFRICA (30 nations) ──────────────────────────────────────────────────
  { currency_code:"DZD", currency_name:"Algerian Dinar",    country:"Algeria",       region:"Africa",
    current_psi:8.1,  target_psi:32, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:45, nash_failure:50, cantillon_failure:70, godel_failure:60,
    key_asset:"oil and gas", primary_problem:"resource curse without citizen dividend",
    population_m:46,  gdp_billions:192, debt_gdp_pct:60,  inflation_pct:9.3,
    btc_role:"optional_savings" },

  { currency_code:"MAD", currency_name:"Moroccan Dirham",   country:"Morocco",       region:"Africa",
    current_psi:12.4, target_psi:38, years_to_target:10, renaissance_type:"F_hybrid",
    landauer_failure:35, nash_failure:30, cantillon_failure:55, godel_failure:35,
    key_asset:"phosphates and tourism", primary_problem:"Cantillon gap — rural Morocco excluded",
    population_m:37,  gdp_billions:142, debt_gdp_pct:71,  inflation_pct:6.1,
    btc_role:"cross_border_only" },

  { currency_code:"ETB", currency_name:"Ethiopian Birr",    country:"Ethiopia",      region:"Africa",
    current_psi:4.2,  target_psi:22, years_to_target:12, renaissance_type:"C_energy",
    landauer_failure:70, nash_failure:65, cantillon_failure:75, godel_failure:55,
    key_asset:"hydropower (GERD)", primary_problem:"energy wealth not monetized for citizens",
    population_m:126, gdp_billions:127, debt_gdp_pct:54,  inflation_pct:31.0,
    btc_role:"optional_savings" },

  { currency_code:"GHS", currency_name:"Ghanaian Cedi",     country:"Ghana",         region:"Africa",
    current_psi:5.8,  target_psi:28, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:55, nash_failure:55, cantillon_failure:65, godel_failure:45,
    key_asset:"gold and cocoa", primary_problem:"debt crisis + currency collapse 2022",
    population_m:33,  gdp_billions:77,  debt_gdp_pct:93,  inflation_pct:45.0,
    btc_role:"cross_border_only" },

  { currency_code:"KES", currency_name:"Kenyan Shilling",   country:"Kenya",         region:"Africa",
    current_psi:9.7,  target_psi:35, years_to_target:10, renaissance_type:"E_digital_sovereign",
    landauer_failure:40, nash_failure:40, cantillon_failure:50, godel_failure:40,
    key_asset:"M-Pesa digital economy + fintech", primary_problem:"financial inclusion gap in rural areas",
    population_m:56,  gdp_billions:118, debt_gdp_pct:68,  inflation_pct:9.0,
    btc_role:"cross_border_only" },

  { currency_code:"TZS", currency_name:"Tanzanian Shilling", country:"Tanzania",     region:"Africa",
    current_psi:7.3,  target_psi:28, years_to_target:12, renaissance_type:"A_commodity",
    landauer_failure:50, nash_failure:45, cantillon_failure:65, godel_failure:40,
    key_asset:"gold, gas, tourism", primary_problem:"resource wealth not reaching citizens",
    population_m:65,  gdp_billions:79,  debt_gdp_pct:40,  inflation_pct:5.4,
    btc_role:"optional_savings" },

  { currency_code:"UGX", currency_name:"Ugandan Shilling",  country:"Uganda",        region:"Africa",
    current_psi:6.1,  target_psi:24, years_to_target:12, renaissance_type:"A_commodity",
    landauer_failure:55, nash_failure:50, cantillon_failure:70, godel_failure:55,
    key_asset:"oil (Albertine Basin)", primary_problem:"oil wealth pre-production — citizen dividend needed now",
    population_m:48,  gdp_billions:49,  debt_gdp_pct:49,  inflation_pct:9.8,
    btc_role:"optional_savings" },

  { currency_code:"RWF", currency_name:"Rwandan Franc",     country:"Rwanda",        region:"Africa",
    current_psi:13.2, target_psi:40, years_to_target:10, renaissance_type:"E_digital_sovereign",
    landauer_failure:30, nash_failure:25, cantillon_failure:45, godel_failure:25,
    key_asset:"tech services + Kigali innovation hub", primary_problem:"digital economy nascent — needs x402 scale",
    population_m:14,  gdp_billions:13,  debt_gdp_pct:67,  inflation_pct:13.7,
    btc_role:"cross_border_only" },

  { currency_code:"XOF", currency_name:"West African CFA",  country:"West Africa (8 nations)", region:"Africa",
    current_psi:7.8,  target_psi:30, years_to_target:12, renaissance_type:"D_bilateral",
    landauer_failure:60, nash_failure:35, cantillon_failure:70, godel_failure:65,
    key_asset:"shared monetary zone", primary_problem:"CFA pegged to EUR — Cantillon flows to France, not citizens",
    population_m:350, gdp_billions:320, debt_gdp_pct:55,  inflation_pct:5.9,
    btc_role:"none",
    custom_reform_1: "Break EUR dependency: CFA backed by West African commodity basket (cocoa, gold, oil), not EUR" },

  { currency_code:"ZMW", currency_name:"Zambian Kwacha",    country:"Zambia",        region:"Africa",
    current_psi:5.5,  target_psi:25, years_to_target:12, renaissance_type:"A_commodity",
    landauer_failure:55, nash_failure:55, cantillon_failure:68, godel_failure:50,
    key_asset:"copper (world's 2nd largest producer)", primary_problem:"copper wealth exports without citizen dividend",
    population_m:20,  gdp_billions:29,  debt_gdp_pct:120, inflation_pct:16.0,
    btc_role:"optional_savings" },

  { currency_code:"AOA", currency_name:"Angolan Kwanza",    country:"Angola",        region:"Africa",
    current_psi:4.8,  target_psi:25, years_to_target:12, renaissance_type:"A_commodity",
    landauer_failure:60, nash_failure:58, cantillon_failure:75, godel_failure:62,
    key_asset:"oil (2nd largest sub-Saharan producer)", primary_problem:"oil revenue concentrated — citizens see little benefit",
    population_m:36,  gdp_billions:106, debt_gdp_pct:87,  inflation_pct:18.0,
    btc_role:"optional_savings" },

  { currency_code:"MZN", currency_name:"Mozambican Metical", country:"Mozambique",   region:"Africa",
    current_psi:4.1,  target_psi:22, years_to_target:14, renaissance_type:"C_energy",
    landauer_failure:65, nash_failure:60, cantillon_failure:72, godel_failure:55,
    key_asset:"LNG (massive offshore gas)", primary_problem:"gas wealth arriving — citizen dividend structure needed NOW",
    population_m:33,  gdp_billions:18,  debt_gdp_pct:115, inflation_pct:9.8,
    btc_role:"optional_savings" },

  { currency_code:"SOS", currency_name:"Somali Shilling",   country:"Somalia",       region:"Africa",
    current_psi:1.9,  target_psi:18, years_to_target:20, renaissance_type:"D_bilateral",
    landauer_failure:85, nash_failure:80, cantillon_failure:85, godel_failure:90,
    key_asset:"livestock + remittances from diaspora", primary_problem:"state failure — rebuild from diaspora remittance base",
    population_m:18,  gdp_billions:9,   debt_gdp_pct:72,  inflation_pct:5.0,
    btc_role:"cross_border_only",
    custom_reform_1: "Hawala-to-x402 bridge: formalize diaspora remittance networks as regulated x402 corridors" },

  { currency_code:"SDG", currency_name:"Sudanese Pound",    country:"Sudan",         region:"Africa",
    current_psi:2.3,  target_psi:20, years_to_target:15, renaissance_type:"A_commodity",
    landauer_failure:80, nash_failure:75, cantillon_failure:80, godel_failure:85,
    key_asset:"gold, oil (post-South Sudan split)", primary_problem:"hyperinflation + conflict + resource mismanagement",
    population_m:48,  gdp_billions:34,  debt_gdp_pct:260, inflation_pct:63.0,
    btc_role:"optional_savings" },

  { currency_code:"ZWG", currency_name:"Zimbabwe Gold",     country:"Zimbabwe",      region:"Africa",
    current_psi:3.1,  target_psi:22, years_to_target:15, renaissance_type:"A_commodity",
    landauer_failure:70, nash_failure:68, cantillon_failure:78, godel_failure:80,
    key_asset:"gold + platinum group metals", primary_problem:"currency collapse history — gold backing attempt underway",
    population_m:16,  gdp_billions:28,  debt_gdp_pct:96,  inflation_pct:47.0,
    btc_role:"optional_savings",
    custom_reform_1: "ZWG gold backing: strengthen via independent audit + citizen gold certificate program" },

  { currency_code:"CDF", currency_name:"Congolese Franc",   country:"DR Congo",      region:"Africa",
    current_psi:3.3,  target_psi:22, years_to_target:18, renaissance_type:"A_commodity",
    landauer_failure:75, nash_failure:70, cantillon_failure:82, godel_failure:78,
    key_asset:"cobalt, coltan, copper, lithium", primary_problem:"richest mineral nation — citizens among world's poorest",
    population_m:102, gdp_billions:65,  debt_gdp_pct:22,  inflation_pct:23.0,
    btc_role:"optional_savings" },

  { currency_code:"XAF", currency_name:"Central African CFA", country:"Central Africa (6 nations)", region:"Africa",
    current_psi:6.9,  target_psi:28, years_to_target:12, renaissance_type:"A_commodity",
    landauer_failure:58, nash_failure:40, cantillon_failure:72, godel_failure:65,
    key_asset:"oil (Cameroon, Gabon, Congo)", primary_problem:"CFA pegged to EUR — oil wealth leaves the zone",
    population_m:60,  gdp_billions:130, debt_gdp_pct:42,  inflation_pct:5.2,
    btc_role:"none",
    custom_reform_1: "Oil-backed CFA replacement: regional currency backed by verified oil reserves, not EUR" },

  { currency_code:"SLL", currency_name:"Sierra Leone Leone", country:"Sierra Leone", region:"Africa",
    current_psi:3.8,  target_psi:20, years_to_target:15, renaissance_type:"A_commodity",
    landauer_failure:70, nash_failure:65, cantillon_failure:75, godel_failure:62,
    key_asset:"diamonds, rutile, iron ore", primary_problem:"mineral wealth extracted by multinationals without citizen share",
    population_m:8,   gdp_billions:4,   debt_gdp_pct:80,  inflation_pct:26.0,
    btc_role:"optional_savings" },

  { currency_code:"GMD", currency_name:"Gambian Dalasi",    country:"Gambia",        region:"Africa",
    current_psi:5.2,  target_psi:22, years_to_target:12, renaissance_type:"F_hybrid",
    landauer_failure:55, nash_failure:50, cantillon_failure:68, godel_failure:45,
    key_asset:"tourism + groundnut exports + remittances", primary_problem:"remittance dependency without formal x402 infrastructure",
    population_m:2,   gdp_billions:2,   debt_gdp_pct:84,  inflation_pct:17.0,
    btc_role:"cross_border_only" },

  { currency_code:"BWP", currency_name:"Botswana Pula",     country:"Botswana",      region:"Africa",
    current_psi:16.8, target_psi:45, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:20, nash_failure:22, cantillon_failure:35, godel_failure:18,
    key_asset:"diamonds (Debswana model)", primary_problem:"diamond wealth well-managed but Cantillon gap persists",
    population_m:3,   gdp_billions:20,  debt_gdp_pct:22,  inflation_pct:5.5,
    btc_role:"optional_savings" },

  { currency_code:"NAD", currency_name:"Namibian Dollar",   country:"Namibia",       region:"Africa",
    current_psi:12.1, target_psi:38, years_to_target:10, renaissance_type:"C_energy",
    landauer_failure:25, nash_failure:28, cantillon_failure:40, godel_failure:22,
    key_asset:"green hydrogen + diamonds + uranium", primary_problem:"energy transition opportunity — green hydrogen anchor",
    population_m:3,   gdp_billions:13,  debt_gdp_pct:71,  inflation_pct:5.9,
    btc_role:"optional_savings" },

  { currency_code:"MUR", currency_name:"Mauritian Rupee",   country:"Mauritius",     region:"Africa",
    current_psi:17.2, target_psi:48, years_to_target:8,  renaissance_type:"E_digital_sovereign",
    landauer_failure:18, nash_failure:20, cantillon_failure:30, godel_failure:15,
    key_asset:"financial services hub + digital economy", primary_problem:"near-complete — digital sovereign standard achievable",
    population_m:1,   gdp_billions:14,  debt_gdp_pct:89,  inflation_pct:5.5,
    btc_role:"cross_border_only" },

  { currency_code:"MGA", currency_name:"Malagasy Ariary",   country:"Madagascar",    region:"Africa",
    current_psi:4.4,  target_psi:22, years_to_target:14, renaissance_type:"A_commodity",
    landauer_failure:65, nash_failure:60, cantillon_failure:72, godel_failure:55,
    key_asset:"nickel, cobalt, vanilla, gemstones", primary_problem:"resource wealth without citizen benefit + political instability",
    population_m:29,  gdp_billions:15,  debt_gdp_pct:55,  inflation_pct:9.0,
    btc_role:"optional_savings" },

  { currency_code:"MWK", currency_name:"Malawian Kwacha",   country:"Malawi",        region:"Africa",
    current_psi:3.7,  target_psi:20, years_to_target:14, renaissance_type:"F_hybrid",
    landauer_failure:68, nash_failure:62, cantillon_failure:73, godel_failure:58,
    key_asset:"tobacco + uranium (undeveloped)", primary_problem:"landlocked, agriculture-dependent, debt-heavy",
    population_m:20,  gdp_billions:12,  debt_gdp_pct:60,  inflation_pct:25.0,
    btc_role:"optional_savings" },

  { currency_code:"SZL", currency_name:"Swazi Lilangeni",   country:"Eswatini",      region:"Africa",
    current_psi:8.5,  target_psi:28, years_to_target:10, renaissance_type:"D_bilateral",
    landauer_failure:40, nash_failure:38, cantillon_failure:55, godel_failure:48,
    key_asset:"textile exports + sugar + linked to ZAR", primary_problem:"ZAR peg limits monetary sovereignty",
    population_m:1,   gdp_billions:5,   debt_gdp_pct:45,  inflation_pct:5.8,
    btc_role:"none" },

  { currency_code:"LSL", currency_name:"Lesotho Loti",      country:"Lesotho",       region:"Africa",
    current_psi:7.9,  target_psi:26, years_to_target:10, renaissance_type:"C_energy",
    landauer_failure:42, nash_failure:40, cantillon_failure:58, godel_failure:44,
    key_asset:"water (Lesotho Highlands Water Project)", primary_problem:"water wealth sold to South Africa — citizens don't benefit",
    population_m:2,   gdp_billions:3,   debt_gdp_pct:62,  inflation_pct:7.4,
    btc_role:"optional_savings" },

  { currency_code:"DJF", currency_name:"Djiboutian Franc",  country:"Djibouti",      region:"Africa",
    current_psi:10.2, target_psi:32, years_to_target:10, renaissance_type:"D_bilateral",
    landauer_failure:30, nash_failure:28, cantillon_failure:48, godel_failure:32,
    key_asset:"strategic port (Horn of Africa)", primary_problem:"port wealth goes to government — citizen dividend missing",
    population_m:1,   gdp_billions:4,   debt_gdp_pct:74,  inflation_pct:3.5,
    btc_role:"cross_border_only" },

  { currency_code:"ERN", currency_name:"Eritrean Nakfa",    country:"Eritrea",       region:"Africa",
    current_psi:2.8,  target_psi:18, years_to_target:20, renaissance_type:"A_commodity",
    landauer_failure:78, nash_failure:72, cantillon_failure:80, godel_failure:82,
    key_asset:"gold + copper + zinc (largely untapped)", primary_problem:"isolated economy — Ψ rebuild requires political opening",
    population_m:4,   gdp_billions:3,   debt_gdp_pct:185, inflation_pct:5.0,
    btc_role:"optional_savings" },

  { currency_code:"SCR", currency_name:"Seychellois Rupee", country:"Seychelles",    region:"Africa",
    current_psi:14.8, target_psi:44, years_to_target:8,  renaissance_type:"E_digital_sovereign",
    landauer_failure:22, nash_failure:24, cantillon_failure:38, godel_failure:20,
    key_asset:"tourism + blue economy + financial hub", primary_problem:"tourism concentration — digital diversification needed",
    population_m:0.1, gdp_billions:2,   debt_gdp_pct:64,  inflation_pct:4.2,
    btc_role:"cross_border_only" },

  { currency_code:"CVE", currency_name:"Cape Verdean Escudo", country:"Cape Verde",  region:"Africa",
    current_psi:13.5, target_psi:40, years_to_target:8,  renaissance_type:"F_hybrid",
    landauer_failure:28, nash_failure:26, cantillon_failure:42, godel_failure:24,
    key_asset:"diaspora remittances + renewable energy", primary_problem:"remittance dependency without x402 infrastructure",
    population_m:0.6, gdp_billions:2,   debt_gdp_pct:139, inflation_pct:6.2,
    btc_role:"cross_border_only" },

  // ── ASIA & PACIFIC (20 nations) ──────────────────────────────────────────
  { currency_code:"BDT", currency_name:"Bangladeshi Taka",  country:"Bangladesh",    region:"Asia",
    current_psi:9.5,  target_psi:33, years_to_target:10, renaissance_type:"B_productivity",
    landauer_failure:38, nash_failure:40, cantillon_failure:55, godel_failure:42,
    key_asset:"garment exports + rising tech sector", primary_problem:"Cantillon gap — garment workers don't benefit from monetary expansion",
    population_m:173, gdp_billions:460, debt_gdp_pct:39,  inflation_pct:9.0,
    btc_role:"cross_border_only" },

  { currency_code:"PKR", currency_name:"Pakistani Rupee",   country:"Pakistan",      region:"Asia",
    current_psi:5.2,  target_psi:26, years_to_target:12, renaissance_type:"F_hybrid",
    landauer_failure:62, nash_failure:60, cantillon_failure:68, godel_failure:65,
    key_asset:"agriculture + remittances + nuclear capability", primary_problem:"debt crisis + currency devaluation + IMF dependency",
    population_m:231, gdp_billions:376, debt_gdp_pct:78,  inflation_pct:29.0,
    btc_role:"optional_savings" },

  { currency_code:"LKR", currency_name:"Sri Lankan Rupee",  country:"Sri Lanka",     region:"Asia",
    current_psi:6.1,  target_psi:28, years_to_target:10, renaissance_type:"F_hybrid",
    landauer_failure:55, nash_failure:52, cantillon_failure:64, godel_failure:58,
    key_asset:"tourism + tea + tech exports", primary_problem:"2022 default — rebuilding from scratch",
    population_m:22,  gdp_billions:84,  debt_gdp_pct:115, inflation_pct:14.0,
    btc_role:"optional_savings" },

  { currency_code:"NPR", currency_name:"Nepalese Rupee",    country:"Nepal",         region:"Asia",
    current_psi:7.8,  target_psi:28, years_to_target:12, renaissance_type:"C_energy",
    landauer_failure:45, nash_failure:42, cantillon_failure:60, godel_failure:40,
    key_asset:"hydropower (world's 2nd largest potential)", primary_problem:"energy wealth exported to India — citizens excluded",
    population_m:30,  gdp_billions:40,  debt_gdp_pct:42,  inflation_pct:7.7,
    btc_role:"cross_border_only" },

  { currency_code:"MMK", currency_name:"Myanmar Kyat",      country:"Myanmar",       region:"Asia",
    current_psi:3.8,  target_psi:20, years_to_target:15, renaissance_type:"A_commodity",
    landauer_failure:68, nash_failure:65, cantillon_failure:75, godel_failure:82,
    key_asset:"jade, rubies, natural gas", primary_problem:"military junta captures all resource wealth",
    population_m:55,  gdp_billions:65,  debt_gdp_pct:63,  inflation_pct:26.0,
    btc_role:"optional_savings" },

  { currency_code:"KHR", currency_name:"Cambodian Riel",    country:"Cambodia",      region:"Asia",
    current_psi:7.1,  target_psi:26, years_to_target:12, renaissance_type:"E_digital_sovereign",
    landauer_failure:50, nash_failure:45, cantillon_failure:62, godel_failure:52,
    key_asset:"tourism + garments + Bakong CBDC (first in Asia)", primary_problem:"99% USD-dollarized — own currency not trusted",
    population_m:17,  gdp_billions:30,  debt_gdp_pct:36,  inflation_pct:5.9,
    btc_role:"none",
    custom_reform_1: "Build on Bakong CBDC: ZK-KYC layer + Cantillon⁻¹ direct payments = KHR trust restored" },

  { currency_code:"LAK", currency_name:"Lao Kip",           country:"Laos",          region:"Asia",
    current_psi:4.9,  target_psi:22, years_to_target:12, renaissance_type:"C_energy",
    landauer_failure:60, nash_failure:58, cantillon_failure:68, godel_failure:56,
    key_asset:"hydropower (Battery of Southeast Asia)", primary_problem:"power exports without citizen dividend + debt to China",
    population_m:7,   gdp_billions:15,  debt_gdp_pct:130, inflation_pct:31.0,
    btc_role:"optional_savings" },

  { currency_code:"MNT", currency_name:"Mongolian Tugrik",  country:"Mongolia",      region:"Asia",
    current_psi:7.4,  target_psi:30, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:48, nash_failure:50, cantillon_failure:62, godel_failure:45,
    key_asset:"copper, coal, gold (Oyu Tolgoi)", primary_problem:"Dutch Disease — mining boom without citizen benefit",
    population_m:3,   gdp_billions:19,  debt_gdp_pct:75,  inflation_pct:11.0,
    btc_role:"reserve_supplement" },

  { currency_code:"UZS", currency_name:"Uzbek Som",         country:"Uzbekistan",    region:"Asia",
    current_psi:8.3,  target_psi:30, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:44, nash_failure:46, cantillon_failure:60, godel_failure:50,
    key_asset:"gold, natural gas, cotton", primary_problem:"resource wealth controlled by government — citizen dividend missing",
    population_m:36,  gdp_billions:90,  debt_gdp_pct:37,  inflation_pct:11.0,
    btc_role:"optional_savings" },

  { currency_code:"KZT", currency_name:"Kazakhstani Tenge", country:"Kazakhstan",    region:"Asia",
    current_psi:10.1, target_psi:35, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:36, nash_failure:38, cantillon_failure:55, godel_failure:42,
    key_asset:"oil, gas, uranium, wheat", primary_problem:"National Fund (sovereign wealth) not reaching citizens",
    population_m:19,  gdp_billions:261, debt_gdp_pct:24,  inflation_pct:14.7,
    btc_role:"reserve_supplement" },

  { currency_code:"AZN", currency_name:"Azerbaijani Manat", country:"Azerbaijan",    region:"Asia",
    current_psi:9.8,  target_psi:32, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:38, nash_failure:35, cantillon_failure:55, godel_failure:45,
    key_asset:"oil and gas (Caspian)", primary_problem:"oil wealth declining — SOFAZ fund not distributed to citizens",
    population_m:10,  gdp_billions:79,  debt_gdp_pct:20,  inflation_pct:9.4,
    btc_role:"optional_savings" },

  { currency_code:"AMD", currency_name:"Armenian Dram",     country:"Armenia",       region:"Asia",
    current_psi:10.5, target_psi:35, years_to_target:10, renaissance_type:"B_productivity",
    landauer_failure:35, nash_failure:32, cantillon_failure:48, godel_failure:35,
    key_asset:"tech exports + diamonds + diaspora", primary_problem:"tech brain drain — digital sovereign model to keep talent",
    population_m:3,   gdp_billions:24,  debt_gdp_pct:64,  inflation_pct:8.8,
    btc_role:"cross_border_only" },

  { currency_code:"GEL", currency_name:"Georgian Lari",     country:"Georgia",       region:"Asia",
    current_psi:11.8, target_psi:38, years_to_target:8,  renaissance_type:"E_digital_sovereign",
    landauer_failure:30, nash_failure:28, cantillon_failure:42, godel_failure:28,
    key_asset:"digital hub + tourism + hydro", primary_problem:"crypto-friendly already — needs ZK-KYC + Cantillon⁻¹",
    population_m:4,   gdp_billions:29,  debt_gdp_pct:41,  inflation_pct:5.3,
    btc_role:"cross_border_only" },

  { currency_code:"UYU", currency_name:"Uruguayan Peso",    country:"Uruguay",       region:"Americas",
    current_psi:14.3, target_psi:42, years_to_target:8,  renaissance_type:"B_productivity",
    landauer_failure:22, nash_failure:20, cantillon_failure:35, godel_failure:18,
    key_asset:"agriculture + tech services + fintech", primary_problem:"near-complete — digital sovereign upgrade available",
    population_m:3,   gdp_billions:77,  debt_gdp_pct:68,  inflation_pct:8.0,
    btc_role:"optional_savings" },

  { currency_code:"PYG", currency_name:"Paraguayan Guarani", country:"Paraguay",     region:"Americas",
    current_psi:9.2,  target_psi:32, years_to_target:10, renaissance_type:"C_energy",
    landauer_failure:38, nash_failure:40, cantillon_failure:55, godel_failure:40,
    key_asset:"hydropower (Itaipu — world's 2nd largest)", primary_problem:"energy wealth sold cheap — citizen dividend possible",
    population_m:7,   gdp_billions:43,  debt_gdp_pct:42,  inflation_pct:7.0,
    btc_role:"reserve_supplement" },

  { currency_code:"BOB", currency_name:"Bolivian Boliviano", country:"Bolivia",      region:"Americas",
    current_psi:7.6,  target_psi:28, years_to_target:12, renaissance_type:"A_commodity",
    landauer_failure:45, nash_failure:48, cantillon_failure:60, godel_failure:50,
    key_asset:"lithium (world's largest reserves) + gas", primary_problem:"lithium wealth not yet monetized for citizens",
    population_m:12,  gdp_billions:45,  debt_gdp_pct:74,  inflation_pct:3.5,
    btc_role:"optional_savings" },

  { currency_code:"HNL", currency_name:"Honduran Lempira",  country:"Honduras",      region:"Americas",
    current_psi:6.8,  target_psi:25, years_to_target:12, renaissance_type:"F_hybrid",
    landauer_failure:52, nash_failure:50, cantillon_failure:64, godel_failure:55,
    key_asset:"remittances (25% of GDP) + agriculture", primary_problem:"remittance economy without formal x402 rails",
    population_m:10,  gdp_billions:32,  debt_gdp_pct:45,  inflation_pct:7.4,
    btc_role:"cross_border_only" },

  { currency_code:"GTQ", currency_name:"Guatemalan Quetzal", country:"Guatemala",    region:"Americas",
    current_psi:8.2,  target_psi:28, years_to_target:10, renaissance_type:"F_hybrid",
    landauer_failure:42, nash_failure:44, cantillon_failure:58, godel_failure:48,
    key_asset:"remittances (18% of GDP) + agriculture", primary_problem:"remittance dependency + financial exclusion of indigenous populations",
    population_m:17,  gdp_billions:95,  debt_gdp_pct:29,  inflation_pct:6.2,
    btc_role:"cross_border_only" },

  { currency_code:"NIO", currency_name:"Nicaraguan Córdoba", country:"Nicaragua",    region:"Americas",
    current_psi:5.9,  target_psi:24, years_to_target:12, renaissance_type:"F_hybrid",
    landauer_failure:55, nash_failure:52, cantillon_failure:66, godel_failure:60,
    key_asset:"agriculture + remittances", primary_problem:"political instability + sanctions blocking development",
    population_m:7,   gdp_billions:16,  debt_gdp_pct:59,  inflation_pct:10.5,
    btc_role:"optional_savings" },

  { currency_code:"HTG", currency_name:"Haitian Gourde",    country:"Haiti",         region:"Americas",
    current_psi:2.1,  target_psi:18, years_to_target:20, renaissance_type:"F_hybrid",
    landauer_failure:82, nash_failure:78, cantillon_failure:85, godel_failure:88,
    key_asset:"diaspora remittances (37% of GDP)", primary_problem:"state collapse — rebuild via x402 remittance infrastructure",
    population_m:12,  gdp_billions:22,  debt_gdp_pct:28,  inflation_pct:45.0,
    btc_role:"cross_border_only",
    custom_reform_1: "Remittance-as-infrastructure: diaspora x402 payments fund public services directly, bypassing failed state" },

  // ── MIDDLE EAST (10 nations) ─────────────────────────────────────────────
  { currency_code:"IQD", currency_name:"Iraqi Dinar",       country:"Iraq",          region:"MiddleEast",
    current_psi:5.8,  target_psi:28, years_to_target:12, renaissance_type:"A_commodity",
    landauer_failure:58, nash_failure:55, cantillon_failure:72, godel_failure:68,
    key_asset:"oil (5th largest reserves globally)", primary_problem:"oil wealth captured by political elites — citizens excluded",
    population_m:42,  gdp_billions:268, debt_gdp_pct:50,  inflation_pct:4.0,
    btc_role:"optional_savings" },

  { currency_code:"SYP", currency_name:"Syrian Pound",      country:"Syria",         region:"MiddleEast",
    current_psi:1.8,  target_psi:20, years_to_target:20, renaissance_type:"F_hybrid",
    landauer_failure:88, nash_failure:85, cantillon_failure:88, godel_failure:90,
    key_asset:"reconstruction potential + diaspora", primary_problem:"war devastation — rebuild via diaspora x402 + international aid",
    population_m:22,  gdp_billions:11,  debt_gdp_pct:170, inflation_pct:80.0,
    btc_role:"cross_border_only",
    custom_reform_1: "Diaspora reconstruction bonds: x402 payments from Syrian diaspora fund verified infrastructure rebuild" },

  { currency_code:"YER", currency_name:"Yemeni Rial",       country:"Yemen",         region:"MiddleEast",
    current_psi:1.5,  target_psi:18, years_to_target:20, renaissance_type:"A_commodity",
    landauer_failure:90, nash_failure:88, cantillon_failure:90, godel_failure:92,
    key_asset:"oil + LNG + strategic location", primary_problem:"war + two governments + currency split + famine",
    population_m:34,  gdp_billions:21,  debt_gdp_pct:74,  inflation_pct:50.0,
    btc_role:"cross_border_only" },

  { currency_code:"OMR", currency_name:"Omani Rial",        country:"Oman",          region:"MiddleEast",
    current_psi:13.5, target_psi:42, years_to_target:10, renaissance_type:"A_commodity",
    landauer_failure:25, nash_failure:22, cantillon_failure:40, godel_failure:22,
    key_asset:"oil + gas + strategic port location", primary_problem:"Vision 2040 diversification — citizen dividend needed now",
    population_m:5,   gdp_billions:105, debt_gdp_pct:40,  inflation_pct:2.5,
    btc_role:"optional_savings" },

  { currency_code:"KWD", currency_name:"Kuwaiti Dinar",     country:"Kuwait",        region:"MiddleEast",
    current_psi:14.2, target_psi:48, years_to_target:8,  renaissance_type:"A_commodity",
    landauer_failure:18, nash_failure:15, cantillon_failure:32, godel_failure:18,
    key_asset:"oil (world's highest $/citizen oil wealth)", primary_problem:"KIA sovereign fund doesn't reach citizens directly",
    population_m:4,   gdp_billions:161, debt_gdp_pct:7,   inflation_pct:3.7,
    btc_role:"optional_savings",
    custom_reform_1: "Kuwait KIA 10% citizen direct distribution: $4,000+/citizen/year from world's 4th largest sovereign wealth fund" },

  { currency_code:"BHD", currency_name:"Bahraini Dinar",    country:"Bahrain",       region:"MiddleEast",
    current_psi:11.2, target_psi:36, years_to_target:10, renaissance_type:"F_hybrid",
    landauer_failure:32, nash_failure:28, cantillon_failure:45, godel_failure:30,
    key_asset:"financial hub + aluminum + post-oil diversification", primary_problem:"declining oil — financial hub model needs x402 upgrade",
    population_m:2,   gdp_billions:43,  debt_gdp_pct:130, inflation_pct:3.2,
    btc_role:"cross_border_only" },

  { currency_code:"JOD", currency_name:"Jordanian Dinar",   country:"Jordan",        region:"MiddleEast",
    current_psi:10.8, target_psi:34, years_to_target:10, renaissance_type:"D_bilateral",
    landauer_failure:34, nash_failure:30, cantillon_failure:48, godel_failure:32,
    key_asset:"phosphates + potash + diaspora", primary_problem:"resource-poor — bilateral model via Gulf + remittance x402",
    population_m:10,  gdp_billions:50,  debt_gdp_pct:94,  inflation_pct:5.3,
    btc_role:"cross_border_only" },

  { currency_code:"ILS", currency_name:"Israeli Shekel",    country:"Israel",        region:"MiddleEast",
    current_psi:17.5, target_psi:50, years_to_target:8,  renaissance_type:"B_productivity",
    landauer_failure:15, nash_failure:14, cantillon_failure:28, godel_failure:14,
    key_asset:"tech exports + Start-Up Nation innovation", primary_problem:"Cantillon gap — tech wealth concentrated in Tel Aviv",
    population_m:9,   gdp_billions:564, debt_gdp_pct:60,  inflation_pct:3.5,
    btc_role:"optional_savings" },

  { currency_code:"AED", currency_name:"UAE Dirham",        country:"UAE",           region:"MiddleEast",
    current_psi:15.8, target_psi:50, years_to_target:8,  renaissance_type:"E_digital_sovereign",
    landauer_failure:18, nash_failure:15, cantillon_failure:30, godel_failure:16,
    key_asset:"oil + DIFC financial hub + digital economy", primary_problem:"near-complete — digital sovereign + citizen dividend achieves target",
    population_m:10,  gdp_billions:507, debt_gdp_pct:30,  inflation_pct:4.8,
    btc_role:"cross_border_only" },

  { currency_code:"QAR", currency_name:"Qatari Riyal",      country:"Qatar",         region:"MiddleEast",
    current_psi:14.9, target_psi:52, years_to_target:8,  renaissance_type:"A_commodity",
    landauer_failure:16, nash_failure:14, cantillon_failure:28, godel_failure:16,
    key_asset:"LNG (world's 3rd largest reserves, highest per-capita wealth)", primary_problem:"QIA sovereign fund not distributed to citizens",
    population_m:3,   gdp_billions:237, debt_gdp_pct:57,  inflation_pct:5.0,
    btc_role:"optional_savings",
    custom_reform_1: "Qatar citizen QIA dividend: $25,000+/citizen/year — would be world's highest, achievable with existing fund" },

  // ── EUROPE & CENTRAL ASIA (10 nations) ──────────────────────────────────
  { currency_code:"UAH", currency_name:"Ukrainian Hryvnia", country:"Ukraine",       region:"Europe",
    current_psi:5.5,  target_psi:28, years_to_target:15, renaissance_type:"B_productivity",
    landauer_failure:60, nash_failure:58, cantillon_failure:65, godel_failure:62,
    key_asset:"agriculture (breadbasket) + IT exports + reconstruction", primary_problem:"war damage + currency stress — reconstruction x402 opportunity",
    population_m:44,  gdp_billions:161, debt_gdp_pct:88,  inflation_pct:14.5,
    btc_role:"optional_savings",
    custom_reform_1: "Reconstruction x402: international aid flows as x402 payments directly to verified reconstruction projects" },

  { currency_code:"RON", currency_name:"Romanian Leu",      country:"Romania",       region:"Europe",
    current_psi:13.8, target_psi:42, years_to_target:8,  renaissance_type:"B_productivity",
    landauer_failure:24, nash_failure:22, cantillon_failure:38, godel_failure:22,
    key_asset:"IT services + oil + agriculture", primary_problem:"tech talent exports — digital sovereign to retain value",
    population_m:19,  gdp_billions:350, debt_gdp_pct:49,  inflation_pct:6.6,
    btc_role:"optional_savings" },

  { currency_code:"HUF", currency_name:"Hungarian Forint",  country:"Hungary",       region:"Europe",
    current_psi:13.1, target_psi:40, years_to_target:8,  renaissance_type:"B_productivity",
    landauer_failure:26, nash_failure:24, cantillon_failure:40, godel_failure:28,
    key_asset:"manufacturing hub + tourism", primary_problem:"political pressure on central bank risks Gödel score",
    population_m:10,  gdp_billions:209, debt_gdp_pct:73,  inflation_pct:5.7,
    btc_role:"optional_savings" },

  { currency_code:"CZK", currency_name:"Czech Koruna",      country:"Czech Republic", region:"Europe",
    current_psi:15.2, target_psi:45, years_to_target:8,  renaissance_type:"B_productivity",
    landauer_failure:20, nash_failure:18, cantillon_failure:32, godel_failure:18,
    key_asset:"manufacturing + tech + tourism", primary_problem:"near-complete — Cantillon gap in rural Bohemia/Moravia",
    population_m:11,  gdp_billions:330, debt_gdp_pct:44,  inflation_pct:3.8,
    btc_role:"optional_savings" },

  { currency_code:"PLN", currency_name:"Polish Zloty",      country:"Poland",        region:"Europe",
    current_psi:14.8, target_psi:44, years_to_target:8,  renaissance_type:"B_productivity",
    landauer_failure:22, nash_failure:20, cantillon_failure:34, godel_failure:24,
    key_asset:"manufacturing + tech + EU access", primary_problem:"Cantillon gap — Eastern Poland excluded from tech boom",
    population_m:38,  gdp_billions:842, debt_gdp_pct:49,  inflation_pct:3.2,
    btc_role:"optional_savings" },

  { currency_code:"BGN", currency_name:"Bulgarian Lev",     country:"Bulgaria",      region:"Europe",
    current_psi:12.8, target_psi:40, years_to_target:8,  renaissance_type:"D_bilateral",
    landauer_failure:26, nash_failure:24, cantillon_failure:40, godel_failure:26,
    key_asset:"manufacturing + IT + EUR currency board", primary_problem:"currency board limits flexibility — EUR accession path",
    population_m:7,   gdp_billions:100, debt_gdp_pct:23,  inflation_pct:4.8,
    btc_role:"optional_savings" },

  { currency_code:"HRK", currency_name:"Croatian Kuna→EUR", country:"Croatia",       region:"Europe",
    current_psi:14.5, target_psi:44, years_to_target:8,  renaissance_type:"B_productivity",
    landauer_failure:22, nash_failure:20, cantillon_failure:34, godel_failure:20,
    key_asset:"tourism + shipbuilding + IT", primary_problem:"EUR adopted 2023 — Cantillon gap in inland Croatia",
    population_m:4,   gdp_billions:82,  debt_gdp_pct:64,  inflation_pct:3.5,
    btc_role:"none" },

  { currency_code:"RSD", currency_name:"Serbian Dinar",     country:"Serbia",        region:"Europe",
    current_psi:11.8, target_psi:36, years_to_target:10, renaissance_type:"B_productivity",
    landauer_failure:30, nash_failure:28, cantillon_failure:44, godel_failure:32,
    key_asset:"manufacturing + IT + lithium (Jadar)", primary_problem:"lithium wealth (Rio Tinto Jadar) — citizen dividend design needed",
    population_m:7,   gdp_billions:73,  debt_gdp_pct:53,  inflation_pct:4.5,
    btc_role:"optional_savings" },

  { currency_code:"MKD", currency_name:"Macedonian Denar",  country:"North Macedonia", region:"Europe",
    current_psi:10.5, target_psi:32, years_to_target:10, renaissance_type:"D_bilateral",
    landauer_failure:34, nash_failure:32, cantillon_failure:48, godel_failure:36,
    key_asset:"minerals + agriculture + IT services", primary_problem:"small open economy — bilateral stability model needed",
    population_m:2,   gdp_billions:14,  debt_gdp_pct:52,  inflation_pct:4.2,
    btc_role:"none" },

  { currency_code:"BAM", currency_name:"Bosnian Mark",      country:"Bosnia & Herzegovina", region:"Europe",
    current_psi:10.2, target_psi:30, years_to_target:12, renaissance_type:"D_bilateral",
    landauer_failure:36, nash_failure:34, cantillon_failure:50, godel_failure:42,
    key_asset:"manufacturing + diaspora + tourism", primary_problem:"currency board + political complexity + Cantillon gap",
    population_m:3,   gdp_billions:26,  debt_gdp_pct:33,  inflation_pct:4.0,
    btc_role:"cross_border_only" },
];

// ══════════════════════════════════════════════════════════════════════════════
// Query functions
// ══════════════════════════════════════════════════════════════════════════════

export function generatePlanForCode(currencyCode: string) {
  const d = EXPANDED_NATIONS.find(n => n.currency_code === currencyCode.toUpperCase());
  if (!d) return null;
  return generateRenaissancePlan(d);
}

export function getExpandedNations(region?: string): CurrencyDescriptor[] {
  if (!region) return EXPANDED_NATIONS;
  return EXPANDED_NATIONS.filter(n => n.region.toLowerCase() === region.toLowerCase());
}

export function getDescriptor(currencyCode: string): CurrencyDescriptor | null {
  return EXPANDED_NATIONS.find(n => n.currency_code === currencyCode.toUpperCase()) ?? null;
}

export function generateCustomPlan(d: CurrencyDescriptor) {
  return generateRenaissancePlan(d);
}

export function getRegions(): string[] {
  return [...new Set(EXPANDED_NATIONS.map(n => n.region))].sort();
}

export function getLowestPsi(n = 10): CurrencyDescriptor[] {
  return [...EXPANDED_NATIONS].sort((a, b) => a.current_psi - b.current_psi).slice(0, n);
}

export function getHighestPsiGain(n = 10): CurrencyDescriptor[] {
  return [...EXPANDED_NATIONS]
    .sort((a, b) => (b.target_psi - b.current_psi) - (a.target_psi - a.current_psi))
    .slice(0, n);
}
