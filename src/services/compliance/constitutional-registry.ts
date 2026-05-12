/**
 * Constitutional Registry — Sovereign Law Intelligence Layer
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * DESIGN PRINCIPLE: Sovereignty Without Surveillance
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * National sovereignty is real. Constitutional law matters.
 * Drug trafficking, human trafficking, cybercrime — these harm people.
 * The question is: how do we respect law without becoming surveillance infrastructure?
 *
 * Answer: encode RULES (public law), not IDENTITIES (private people).
 *
 * The registry stores:
 *   - What laws each jurisdiction has (public knowledge)
 *   - What thresholds trigger reporting (public knowledge)
 *   - What categories of activity are restricted (public knowledge)
 *
 * It does NOT store:
 *   - Who did what
 *   - Who was checked
 *   - Investigation results
 *
 * This is the difference between encoding constitutional law and building a police database.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * NASH EQUILIBRIUM FOR CRIME PREVENTION
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Honest use: low cost (fast, cheap, frictionless)
 * Suspicious use: high cost (reporting required, delays, compliance overhead)
 *
 * This is how Bitcoin prevents Sybil attacks with PoW.
 * This is how the legal system should work with crypto.
 *
 * The equilibrium:
 *   - No one wants the friction of compliance checks
 *   - Criminals especially don't want it
 *   - Therefore: compliance checks ARE the deterrent
 *   - The mere existence of the system changes behavior
 *
 * "The mere possibility of being observed can change behavior."  — Jeremy Bentham, Panopticon
 * But: we build the transparent walls, not the all-seeing eye.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface JurisdictionLaw {
  country_code:        string;   // ISO 3166-1 alpha-2
  country_name:        string;
  crypto_legal_status: "legal" | "restricted" | "banned" | "unregulated";
  aml_framework:       "fatf" | "eu_amld" | "us_bsa" | "custom" | "none";
  reporting_threshold_usd: number | null;  // null = no threshold defined
  vasp_licensed:       boolean;  // whether VASPs must be licensed
  cbdc_issued:         boolean;
  constitutional_protection: boolean;  // does constitution protect financial privacy?
  notable_laws:        string[];  // key law names
  last_updated:        string;   // YYYY-MM-DD
}

export interface ComplianceRequirement {
  jurisdiction:    string;
  requires_kyc:    boolean;
  requires_report: boolean;
  report_threshold_usd: number | null;
  restricted_activities: string[];
  reason:          string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Registry — 50 key jurisdictions
// Sources: IMF AMLCFT assessments, FATF mutual evaluations, national legislation
// ══════════════════════════════════════════════════════════════════════════════

const JURISDICTION_REGISTRY: Map<string, JurisdictionLaw> = new Map([

  // ── G7 ──────────────────────────────────────────────────────────────
  ["US", {
    country_code: "US", country_name: "United States",
    crypto_legal_status: "legal",
    aml_framework: "us_bsa",
    reporting_threshold_usd: 10_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,  // 4th Amendment (financial privacy debated)
    notable_laws: ["Bank Secrecy Act 1970", "FinCEN VASP Guidance 2019", "IRS Notice 2014-21"],
    last_updated: "2025-01-01",
  }],
  ["GB", {
    country_code: "GB", country_name: "United Kingdom",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 15_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: false,  // no written constitution
    notable_laws: ["Proceeds of Crime Act 2002", "FCA Crypto Asset Registration", "Money Laundering Regulations 2017"],
    last_updated: "2025-01-01",
  }],
  ["DE", {
    country_code: "DE", country_name: "Germany",
    crypto_legal_status: "legal",
    aml_framework: "eu_amld",
    reporting_threshold_usd: 11_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,  // GG Art. 2 (informational self-determination)
    notable_laws: ["GwG (Geldwäschegesetz)", "BaFin Crypto Guidance 2019", "MiCA 2024"],
    last_updated: "2025-01-01",
  }],
  ["FR", {
    country_code: "FR", country_name: "France",
    crypto_legal_status: "legal",
    aml_framework: "eu_amld",
    reporting_threshold_usd: 11_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["Loi PACTE 2019 (PSAN regime)", "MiCA 2024"],
    last_updated: "2025-01-01",
  }],
  ["JP", {
    country_code: "JP", country_name: "Japan",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 3_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["Fund Settlement Act (amended 2017)", "PSA CAEX registration", "JFSA guidelines"],
    last_updated: "2025-01-01",
  }],
  ["CA", {
    country_code: "CA", country_name: "Canada",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 7_500,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["PCMLTFA", "FINTRAC VASP registration", "CSA crypto guidance"],
    last_updated: "2025-01-01",
  }],

  // ── EU ──────────────────────────────────────────────────────────────
  ["CH", {
    country_code: "CH", country_name: "Switzerland",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 16_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,  // Art. 13 privacy protection
    notable_laws: ["FINMA VASP guidance", "Blockchain Act 2021", "AMLA"],
    last_updated: "2025-01-01",
  }],
  ["SG", {
    country_code: "SG", country_name: "Singapore",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 15_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["Payment Services Act 2019 (PS Act)", "MAS crypto guidelines"],
    last_updated: "2025-01-01",
  }],
  ["AE", {
    country_code: "AE", country_name: "United Arab Emirates",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 13_600,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: false,
    notable_laws: ["UAE AML Law 2018", "VARA Dubai Virtual Asset Regulation", "FSRA ADGM"],
    last_updated: "2025-01-01",
  }],

  // ── MENA ────────────────────────────────────────────────────────────
  ["SA", {
    country_code: "SA", country_name: "Saudi Arabia",
    crypto_legal_status: "restricted",
    aml_framework: "fatf",
    reporting_threshold_usd: 13_300,
    vasp_licensed: false,
    cbdc_issued: false,
    constitutional_protection: false,
    notable_laws: ["SAMA regulations", "AML Law 2003 (amended 2017)"],
    last_updated: "2025-01-01",
  }],
  ["EG", {
    country_code: "EG", country_name: "Egypt",
    crypto_legal_status: "restricted",
    aml_framework: "fatf",
    reporting_threshold_usd: 12_000,
    vasp_licensed: false,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["CBE Law 2020 — crypto trading restricted without CBE license"],
    last_updated: "2025-01-01",
  }],
  ["TR", {
    country_code: "TR", country_name: "Turkey",
    crypto_legal_status: "restricted",
    aml_framework: "fatf",
    reporting_threshold_usd: 30_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["Crypto Asset Service Providers Regulation 2021", "Payments Law 6493"],
    last_updated: "2025-01-01",
  }],
  ["LB", {
    country_code: "LB", country_name: "Lebanon",
    crypto_legal_status: "unregulated",
    aml_framework: "none",
    reporting_threshold_usd: null,
    vasp_licensed: false,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["BDL Basic Decision 13217 — crypto not recognized as currency"],
    last_updated: "2025-01-01",
  }],

  // ── High Risk ────────────────────────────────────────────────────────
  ["KP", {
    country_code: "KP", country_name: "North Korea",
    crypto_legal_status: "banned",
    aml_framework: "none",
    reporting_threshold_usd: null,
    vasp_licensed: false,
    cbdc_issued: false,
    constitutional_protection: false,
    notable_laws: ["UNSC Resolution 2270+ — financial sanctions", "OFAC designation"],
    last_updated: "2025-01-01",
  }],
  ["IR", {
    country_code: "IR", country_name: "Iran",
    crypto_legal_status: "restricted",
    aml_framework: "none",
    reporting_threshold_usd: null,
    vasp_licensed: false,
    cbdc_issued: false,
    constitutional_protection: false,
    notable_laws: ["CBI regulated mining only", "OFAC comprehensive sanctions", "UNSC sanctions"],
    last_updated: "2025-01-01",
  }],
  ["RU", {
    country_code: "RU", country_name: "Russia",
    crypto_legal_status: "restricted",
    aml_framework: "custom",
    reporting_threshold_usd: 13_000,
    vasp_licensed: false,
    cbdc_issued: true,   // Digital Ruble
    constitutional_protection: false,
    notable_laws: ["Digital Financial Assets Law 2021", "Crypto payments banned for goods/services", "Digital Ruble Law 2023"],
    last_updated: "2025-01-01",
  }],

  // ── Asia Pacific ─────────────────────────────────────────────────────
  ["CN", {
    country_code: "CN", country_name: "China",
    crypto_legal_status: "banned",
    aml_framework: "custom",
    reporting_threshold_usd: 15_000,
    vasp_licensed: false,
    cbdc_issued: true,   // Digital Yuan (e-CNY)
    constitutional_protection: false,
    notable_laws: ["PBoC Notice 2021 — all crypto transactions banned", "e-CNY CBDC rollout"],
    last_updated: "2025-01-01",
  }],
  ["IN", {
    country_code: "IN", country_name: "India",
    crypto_legal_status: "restricted",
    aml_framework: "fatf",
    reporting_threshold_usd: 12_000,
    vasp_licensed: true,
    cbdc_issued: true,   // Digital Rupee (e-INR)
    constitutional_protection: true,
    notable_laws: ["PMLA — VDA covered since 2023", "30% crypto tax", "FIU-IND registration"],
    last_updated: "2025-01-01",
  }],
  ["AU", {
    country_code: "AU", country_name: "Australia",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 9_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["AML/CTF Act 2006 — DCE registration mandatory", "AUSTRAC supervision"],
    last_updated: "2025-01-01",
  }],
  ["KR", {
    country_code: "KR", country_name: "South Korea",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 8_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["SPECIFCA Act (VASP Act) 2021", "FSC/FIU reporting requirements"],
    last_updated: "2025-01-01",
  }],

  // ── Americas ──────────────────────────────────────────────────────────
  ["BR", {
    country_code: "BR", country_name: "Brazil",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 10_000,
    vasp_licensed: true,
    cbdc_issued: true,   // DREX (Digital Real)
    constitutional_protection: true,
    notable_laws: ["Law 14,478/2022 (Crypto Framework)", "BCB VASP authorization"],
    last_updated: "2025-01-01",
  }],
  ["MX", {
    country_code: "MX", country_name: "Mexico",
    crypto_legal_status: "restricted",
    aml_framework: "fatf",
    reporting_threshold_usd: 7_500,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["Fintech Law 2018 — ITF regulation", "Banxico crypto ban for financial institutions"],
    last_updated: "2025-01-01",
  }],
  ["AR", {
    country_code: "AR", country_name: "Argentina",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 10_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["CNV crypto framework 2023", "VASP registration required"],
    last_updated: "2025-01-01",
  }],
  ["SV", {
    country_code: "SV", country_name: "El Salvador",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: null,  // Bitcoin is legal tender — no threshold
    vasp_licensed: false,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["Bitcoin Law 2021 (BTC legal tender)", "CNAD digital asset supervision"],
    last_updated: "2025-01-01",
  }],

  // ── Africa ────────────────────────────────────────────────────────────
  ["NG", {
    country_code: "NG", country_name: "Nigeria",
    crypto_legal_status: "restricted",
    aml_framework: "fatf",
    reporting_threshold_usd: 12_000,
    vasp_licensed: true,
    cbdc_issued: true,   // eNaira
    constitutional_protection: true,
    notable_laws: ["CBN circular 2021 (bank ban, P2P allowed)", "SEC Digital Asset Rules 2022", "FATF grey list"],
    last_updated: "2025-01-01",
  }],
  ["ZA", {
    country_code: "ZA", country_name: "South Africa",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 8_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["FSCA CASP licensing 2023", "FATF grey list 2023", "FIC Act"],
    last_updated: "2025-01-01",
  }],

  // ── Eastern Europe ────────────────────────────────────────────────────
  ["UA", {
    country_code: "UA", country_name: "Ukraine",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 13_000,
    vasp_licensed: true,
    cbdc_issued: false,
    constitutional_protection: true,
    notable_laws: ["Virtual Assets Law 2022 (Law 2074-IX)", "NSSMC supervision"],
    last_updated: "2025-01-01",
  }],
  ["BY", {
    country_code: "BY", country_name: "Belarus",
    crypto_legal_status: "legal",
    aml_framework: "fatf",
    reporting_threshold_usd: 10_000,
    vasp_licensed: false,
    cbdc_issued: false,
    constitutional_protection: false,
    notable_laws: ["Decree No. 8 (2018) — crypto legal in HTP", "OFAC sectoral sanctions"],
    last_updated: "2025-01-01",
  }],

]);

// ══════════════════════════════════════════════════════════════════════════════
// Lookup functions
// ══════════════════════════════════════════════════════════════════════════════

export function getJurisdiction(countryCode: string): JurisdictionLaw | null {
  return JURISDICTION_REGISTRY.get(countryCode.toUpperCase()) ?? null;
}

export function getComplianceRequirements(
  countryCode: string,
  amountUsd: number,
): ComplianceRequirement {
  const law = JURISDICTION_REGISTRY.get(countryCode.toUpperCase());

  if (!law) {
    return {
      jurisdiction:          countryCode,
      requires_kyc:          false,
      requires_report:       false,
      report_threshold_usd:  null,
      restricted_activities: [],
      reason:                `No law data for ${countryCode} — treating as unregulated`,
    };
  }

  const requires_report =
    law.reporting_threshold_usd !== null &&
    amountUsd >= law.reporting_threshold_usd;

  const restricted: string[] = [];
  if (law.crypto_legal_status === "banned")       restricted.push("All crypto transactions banned");
  if (law.crypto_legal_status === "restricted")   restricted.push("Crypto requires regulatory authorization");
  if (law.vasp_licensed)                          restricted.push("VASP license required for exchanges");

  return {
    jurisdiction:          countryCode,
    requires_kyc:          law.vasp_licensed && amountUsd > 1000,
    requires_report:       requires_report,
    report_threshold_usd:  law.reporting_threshold_usd,
    restricted_activities: restricted,
    reason: requires_report
      ? `Amount $${amountUsd.toFixed(0)} exceeds ${countryCode} reporting threshold of $${law.reporting_threshold_usd}`
      : `Compliant with ${countryCode} ${law.aml_framework.toUpperCase()} framework`,
  };
}

export function listAllJurisdictions(): JurisdictionLaw[] {
  return [...JURISDICTION_REGISTRY.values()].sort((a, b) =>
    a.country_code.localeCompare(b.country_code)
  );
}

export function getBannedJurisdictions(): string[] {
  return [...JURISDICTION_REGISTRY.entries()]
    .filter(([, v]) => v.crypto_legal_status === "banned")
    .map(([k]) => k);
}

export function getCbdcJurisdictions(): JurisdictionLaw[] {
  return [...JURISDICTION_REGISTRY.values()].filter(j => j.cbdc_issued);
}
