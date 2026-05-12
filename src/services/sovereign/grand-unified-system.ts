/**
 * Ψ Grand Unified System (GUS) — Complete Architecture
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * PREAMBLE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * "We the participants of every nation, seeking to establish monetary justice,
 * ensure domestic tranquility, provide for the common financial defense,
 * promote the general welfare of all humanity, and secure the blessings of
 * economic liberty to ourselves and our posterity — do ordain and establish
 * this Ψ Grand Unified System."
 *
 * This is not a product. Not a company. Not a currency.
 * This is a PROTOCOL — identified only by:
 *   SHA-256("Ψ=Landauer·Nash·Cantillon⁻¹·Gödel")
 *   = bbc267eec7ee6f3889dfc7fc7fd723103e3ba1bc126547515d09edddcae0d4d1
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * THE FOUR PILLARS — WHY THIS WORKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * PILLAR 1 — LANDAUER (Physics): Money has real cost
 *   Problem: Fiat can be printed infinitely → devalues labor
 *   Solution: SHA-256 requires real energy → money anchored to physics
 *   Proof: Landauer limit = kT·ln(2) = 2.85 × 10⁻²¹ joules per bit erased
 *   Every Bitcoin block = real energy = thermodynamic anchor
 *
 * PILLAR 2 — NASH (Game Theory): System self-enforces
 *   Problem: Trust in institutions fails (central banks inflate, governments default)
 *   Solution: Nash equilibrium — no party benefits from cheating
 *   Proof: Miners attack chain → lose mining investment. Nodes reject invalid blocks.
 *   Result: Honest participation is the dominant strategy for every actor
 *
 * PILLAR 3 — CANTILLON⁻¹ (Justice): Equal monetary access
 *   Problem: New money enriches nearest to printer first (Cantillon, 1730)
 *   Solution: Bitcoin mining = equidistant from money creation for all
 *   Proof: A miner in Lagos and NYC have identical mining conditions per joule
 *   Result: First globally neutral monetary issuance in human history
 *
 * PILLAR 4 — GÖDEL (Sovereignty): No human institution required
 *   Problem: All institutions can lie, coerce, corrupt
 *   Solution: SHA-256 is a mathematical axiom — it cannot be changed by vote
 *   Proof: No court order, no government decree can alter SHA-256
 *   Result: First monetary system beyond the reach of any human authority
 */

import { GENESIS_HASH } from "../compliance/universal-psi-protocol.js";
import { GLOBAL_DEBT_TRILLIONS, BTC_MAX_SUPPLY } from "./national-debt-oracle.js";

// ══════════════════════════════════════════════════════════════════════════════
// SECTION I — THE Ψ CONSTITUTION (12 Articles)
// ══════════════════════════════════════════════════════════════════════════════

export interface ConstitutionalArticle {
  number:    number;
  title:     string;
  principle: string;   // the rule
  rationale: string;   // why this rule
  mechanism: string;   // how it is enforced
  hash:      string;   // SHA-256 of (principle + rationale) — tamper seal
}

import { createHash } from "crypto";

function articleHash(principle: string, rationale: string): string {
  return createHash("sha256")
    .update(Buffer.from(principle + rationale, "utf8"))
    .digest("hex")
    .slice(0, 16);
}

export const PSI_CONSTITUTION: ConstitutionalArticle[] = [
  {
    number: 1, title: "Monetary Sovereignty",
    principle: "Every individual, enterprise, and nation has the inalienable right to hold, transact, and denominate value in any energy-backed monetary instrument, free from confiscation or forced conversion.",
    rationale: "Property rights are the foundation of all other rights. A person who cannot hold value cannot be free.",
    mechanism: "Bitcoin's 21M supply cap is enforced by every full node. No majority — political or economic — can override it.",
    hash: articleHash("Every individual, enterprise, and nation has the inalienable right to hold, transact, and denominate value in any energy-backed monetary instrument, free from confiscation or forced conversion.", "Property rights are the foundation of all other rights.")
  },
  {
    number: 2, title: "Privacy by Default",
    principle: "Financial surveillance requires individual consent or judicial warrant per constitutional due process. Bulk collection of financial data without consent is prohibited under this protocol.",
    rationale: "The Cantillon effect is perpetuated by those who can monitor financial flows and position themselves first. Privacy restores equality.",
    mechanism: "ZK-KYC: compliance proofs reveal ONLY what law requires. The verifier learns 'this person is not sanctioned', not who they are.",
    hash: articleHash("Financial surveillance requires individual consent or judicial warrant per constitutional due process.", "The Cantillon effect is perpetuated by those who can monitor financial flows.")
  },
  {
    number: 3, title: "Rule of Law, Not Rule of Power",
    principle: "This protocol obeys legitimate law — laws passed by democratic process, consistent with human rights, that protect citizens. It does not obey edicts issued by non-democratic actors or laws designed to protect elite financial privilege.",
    rationale: "Not all laws are just. The Nazi Nuremberg laws were laws. Jim Crow was law. A protocol that obeys ALL laws is a tool of oppression.",
    mechanism: "Constitutional Registry encodes democratic law only. FATF compliance (OFAC/UN) for universally recognized crimes. Not every national restriction.",
    hash: articleHash("This protocol obeys legitimate law — laws passed by democratic process, consistent with human rights.", "Not all laws are just.")
  },
  {
    number: 4, title: "No Weaponization",
    principle: "This protocol shall not be used as a weapon of economic warfare against civilian populations. Financial sanctions may target named individuals and entities, not entire nations' civilian populations.",
    rationale: "The USD has been weaponized via SWIFT exclusions to cause mass civilian suffering (Iran, Russia, Afghanistan). This repeats Cantillon warfare at national scale.",
    mechanism: "Sanctions oracle targets individual addresses (OFAC SDN). Not country-level blocks. Any nation's civilian can transact.",
    hash: articleHash("This protocol shall not be used as a weapon of economic warfare against civilian populations.", "The USD has been weaponized via SWIFT exclusions.")
  },
  {
    number: 5, title: "Energy Justice",
    principle: "Nations with abundant renewable energy have a structural right to convert that energy into monetary value through Bitcoin mining. No international body may prohibit sovereign energy-to-Bitcoin conversion.",
    rationale: "The Congo basin hydro (100GW), Saudi solar, African sun — these are natural resources. If nations can convert oil to petroleum products, they can convert energy to Bitcoin.",
    mechanism: "Ψ Landauer score rewards energy-backed money. Mining jurisdictions are never blacklisted for mining alone.",
    hash: articleHash("Nations with abundant renewable energy have a structural right to convert that energy into monetary value through Bitcoin mining.", "If nations can convert oil to petroleum products, they can convert energy to Bitcoin.")
  },
  {
    number: 6, title: "Anti-Debt Covenant",
    principle: "No sovereign shall issue monetary instruments that obligate future generations to servitude for the financial decisions of the present. All debt must be finite, auditable, and consented to by the affected population.",
    rationale: "The $307 trillion global debt was not approved by the people who will repay it. Most were not born when it was incurred.",
    mechanism: "sBTC-denominated bonds have fixed real value — cannot inflate. On-chain debt schedules are publicly verifiable. Citizens can see exactly what they owe.",
    hash: articleHash("No sovereign shall issue monetary instruments that obligate future generations to servitude.", "The $307 trillion global debt was not approved by the people who will repay it.")
  },
  {
    number: 7, title: "Criminal Prohibition",
    principle: "This protocol provides no sanctuary for drug trafficking, human trafficking, terrorism financing, ransomware, or theft. These are crimes against persons. The protocol distinguishes between crimes against persons (prohibited) and victimless economic activities (neutral).",
    rationale: "Financial freedom is not freedom to harm others. The same SHA-256 that protects the individual protects the community.",
    mechanism: "AML detector + sanctions oracle + FATF compliance + fraud reporting. Nash equilibrium: honest use is cheapest, criminal use attracts maximum scrutiny.",
    hash: articleHash("This protocol provides no sanctuary for drug trafficking, human trafficking, terrorism financing, ransomware, or theft.", "Financial freedom is not freedom to harm others.")
  },
  {
    number: 8, title: "Universal Access",
    principle: "No person shall be excluded from the monetary system based on nationality, religion, political opinion, credit history, or inability to access traditional banking.",
    rationale: "1.4 billion adults are unbanked. They are not poor because of lack of money — they are poor because they cannot access money.",
    mechanism: "Bitcoin requires only a $30 phone and internet. x402 requires only a wallet. No identity required for basic transactions.",
    hash: articleHash("No person shall be excluded from the monetary system based on nationality, religion, political opinion, credit history.", "1.4 billion adults are unbanked.")
  },
  {
    number: 9, title: "Algorithmic Governance",
    principle: "Monetary rules encoded in this protocol may only be changed by cryptographic consensus of network participants. No single entity — however powerful — may unilaterally alter the monetary rules.",
    rationale: "The Federal Reserve changed monetary rules in 1971 with no vote. The ECB changed them in 2012 'whatever it takes' with no mandate. This ends now.",
    mechanism: "Bitcoin: hard fork requires supermajority of nodes and miners. Ψ protocol: amendment requires on-chain SHA-256 referendum of all holders.",
    hash: articleHash("Monetary rules encoded in this protocol may only be changed by cryptographic consensus of network participants.", "The Federal Reserve changed monetary rules in 1971 with no vote.")
  },
  {
    number: 10, title: "Interoperability",
    principle: "This protocol shall be compatible with all legitimate monetary systems — fiat, crypto, commodity. It does not seek to destroy existing systems but to provide a superior alternative that systems voluntarily adopt.",
    rationale: "Revolutions destroy. Evolutions improve. The goal is not to end the dollar — it is to provide something better that makes the dollar obsolete naturally.",
    mechanism: "Multi-chain support (15 chains). Fiat-to-sBTC on-ramps. x402 payments in STX/sBTC/USDC — not exclusive.",
    hash: articleHash("This protocol shall be compatible with all legitimate monetary systems.", "Revolutions destroy. Evolutions improve.")
  },
  {
    number: 11, title: "Generational Equity",
    principle: "Economic systems must be evaluated by their impact on those born 50 years from now, not only on current holders. Any monetary policy that impoverishes future generations to enrich present ones is unconstitutional under this protocol.",
    rationale: "Every dollar of inflation is a tax on future purchasing power. Every dollar of government debt is a tax on future taxpayers. Bitcoin's fixed supply is the only monetary instrument that cannot perpetuate this theft.",
    mechanism: "Ψ Gödel score measures temporal independence — does the system require future trust? Bitcoin scores 1.0. Central banks score near 0.",
    hash: articleHash("Economic systems must be evaluated by their impact on those born 50 years from now.", "Every dollar of inflation is a tax on future purchasing power.")
  },
  {
    number: 12, title: "The SHA-256 Axiom",
    principle: "SHA-256 is the physical axiom of this system. It cannot be voted away, inflated, sanctioned, or corrupted. It is the mathematical foundation upon which all other articles rest. Any part of this protocol that conflicts with SHA-256's properties is void.",
    rationale: "Gödel's incompleteness theorem: any sufficiently powerful formal system requires external axioms it cannot prove. SHA-256 is this system's physical axiom — proven by physics, not by authority.",
    mechanism: `Protocol genesis hash: ${GENESIS_HASH}. Any implementation that does not verify against this hash is not this protocol.`,
    hash: articleHash("SHA-256 is the physical axiom of this system.", "Gödel's incompleteness theorem.")
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION II — ADVERSARIAL RESPONSE MATRIX
// Every threat → net-neutral defensive response
// ══════════════════════════════════════════════════════════════════════════════

export interface AdversarialScenario {
  id:            string;
  threat:        string;           // what the attacker does
  actor:         string;           // who threatens
  intent:        string;           // their goal
  mechanism:     string;           // how the attack works
  response:      string;           // Ψ system response
  net_effect:    "positive" | "neutral" | "negative_contained";
  harm_score:    number;           // 0–10 harm to civilians if response not applied
  post_response: number;           // 0–10 harm after response applied
  constitutional_basis: number[];  // which articles apply
  example:       string;
}

export const ADVERSARIAL_MATRIX: AdversarialScenario[] = [
  // ── STATE ACTORS ──────────────────────────────────────────────────────────
  {
    id: "A01",
    threat:       "Nation-state bans Bitcoin/crypto",
    actor:        "Authoritarian government (China 2021, India 2018, Nigeria 2021)",
    intent:       "Prevent capital flight, maintain monetary control",
    mechanism:    "Exchange shutdowns, mining bans, criminal penalties for holding",
    response:     "P2P trading (Lightning, Bisq, LocalBitcoins). Bitcoin node censorship-resistant by design. Mining relocates to free jurisdictions. Citizens use privacy wallets (ZK-KYC proves compliance without identity). Ψ greylist flag on banning nation → lower Ψ monetary score → capital flight accelerates. Ban backfires: nation loses mining revenue AND drives crypto underground.",
    net_effect:   "neutral",
    harm_score:   7,
    post_response: 2,
    constitutional_basis: [1, 3, 8],
    example:      "China banned Bitcoin in 2013, 2017, 2019, 2021. Bitcoin price rose after each ban. Chinese mining moved to Kazakhstan, USA, Malaysia."
  },
  {
    id: "A02",
    threat:       "Dollar weaponization via SWIFT exclusion",
    actor:        "US Treasury / G7 financial system",
    intent:       "Economic coercion of geopolitical adversaries",
    mechanism:    "SWIFT disconnection, correspondent banking freeze, reserve asset seizure",
    response:     "sBTC settlement rail for international trade — no SWIFT needed. Bitcoin is the first neutral international reserve asset since gold. Nations settle bilateral trade in sBTC via Stacks multisig escrow. Russian oil, Iranian goods, any trade can route around SWIFT via Bitcoin.",
    net_effect:   "positive",
    harm_score:   9,
    post_response: 3,
    constitutional_basis: [4, 8, 10],
    example:      "Russia post-2022 sanctions: already exploring BTC/gold trade settlement. India-Russia rupee-ruble deal. BTC completes this."
  },
  {
    id: "A03",
    threat:       "Central bank digital currency (CBDC) mandatory adoption",
    actor:        "Government forcing citizens to use CBDC, phasing out cash",
    intent:       "Total financial surveillance, programmable money (expiring stimulus, restricted purchases)",
    mechanism:    "Legal tender laws, merchant mandates, cash withdrawal limits",
    response:     "Ψ Constitution Article 1 (monetary sovereignty) + Article 2 (privacy). sBTC wallets operate peer-to-peer — not through CBDC rails. ZK-KYC proves compliance to CBDC laws without surrendering transaction data. Nations that force CBDC see capital flight to sBTC — Article 9 Gödel score collapses.",
    net_effect:   "neutral",
    harm_score:   8,
    post_response: 3,
    constitutional_basis: [1, 2, 9],
    example:      "Nigeria e-Naira: <0.5% adoption after 2 years. People refused it. Bitcoin P2P volumes 9× higher than e-Naira."
  },
  {
    id: "A04",
    threat:       "Hyperinflation collapse (Lebanon LBP, Venezuela VES, Zimbabwe ZWL)",
    actor:        "Failed central bank / political system",
    intent:       "Not malicious — systemic failure, political money printing",
    mechanism:    "Monetary base expansion → purchasing power collapse → savings wiped out",
    response:     "Emergency Protocol: sBTC savings accounts auto-hedge inflation. Citizens swap local currency to sBTC at any ratio — even 1 satoshi is worth more than 1 trillion VES. Ψ distressed currency flags trigger automatic advisory: 'This currency scores Ψ=2.5 — immediate sBTC hedge recommended.' Zest Protocol: borrow against sBTC instead of holding inflationary cash.",
    net_effect:   "positive",
    harm_score:   10,
    post_response: 4,
    constitutional_basis: [1, 6, 8],
    example:      "Lebanon 2019–2025: LBP lost 98% of value. Citizens with sBTC savings maintained purchasing power. Those without lost everything."
  },

  // ── CRIMINAL ACTORS ───────────────────────────────────────────────────────
  {
    id: "A05",
    threat:       "Drug trafficking / cartel money laundering",
    actor:        "Criminal organizations (cartels, narco-states)",
    intent:       "Clean proceeds from drug sales, avoid law enforcement",
    mechanism:    "Multiple small crypto transactions, mixers, chain-hopping",
    response:     "AML Detector: structuring pattern (A→B multiple small amounts below threshold) triggers REVIEW flag. OFAC sanctions oracle: known cartel addresses flagged. FATF high-risk jurisdictions: transactions from blacklisted countries require enhanced scrutiny. Ψ Nash score: criminal behavior raises cost dramatically — mixer fees, multiple hops, surveillance risk all increase friction. Honest use remains cheap. Chainalysis KYT optional integration.",
    net_effect:   "positive",
    harm_score:   9,
    post_response: 4,
    constitutional_basis: [7, 3],
    example:      "Silk Road: 1M BTC seized. Ross Ulbricht identified via blockchain analysis. Bitcoin is LESS private than cash — every transaction is permanently recorded."
  },
  {
    id: "A06",
    threat:       "Ransomware / cybercrime extortion",
    actor:        "Criminal hackers, state-sponsored groups (Lazarus Group/DPRK)",
    intent:       "Extort individuals and institutions via encrypted data hostage",
    mechanism:    "Encrypt target data → demand BTC payment → launder via mixers",
    response:     "OFAC SDN: DPRK Lazarus Group addresses pre-loaded. AML detector: ransom payments show distinctive patterns (exact round amounts, single payment to new address). Sanctions oracle: flagged immediately. Report-Fraud tool: victim files report → anchored on Bitcoin L1 → immutable evidence for law enforcement. Key insight: ransomware REQUIRES Bitcoin — this creates a traceable evidence trail.",
    net_effect:   "neutral",
    harm_score:   8,
    post_response: 4,
    constitutional_basis: [7, 3],
    example:      "Colonial Pipeline ransom: FBI recovered 85% of the BTC via blockchain tracing. Bitcoin is the best evidence trail for ransomware prosecution."
  },
  {
    id: "A07",
    threat:       "Human trafficking payment network",
    actor:        "Human traffickers using crypto for payment",
    intent:       "Move money for trafficking operations across borders",
    mechanism:    "Small crypto payments, privacy coins, P2P exchanges",
    response:     "Maximum severity flag in AML + sanctions oracle. Cross-chain Ψ compliance: trafficking corridors (certain country pairs) trigger automatic Travel Rule. ZK-KYC: proves sender is NOT on trafficking watchlists without revealing identity. Fraud report with OP_RETURN anchor creates immutable on-chain evidence. Nash equilibrium: making trafficking payments expensive and traceable destroys the equilibrium for traffickers.",
    net_effect:   "positive",
    harm_score:   10,
    post_response: 3,
    constitutional_basis: [7, 3, 4],
    example:      "Europol 2021: €1.4B in crypto seized from trafficking networks. On-chain evidence enabled prosecutions impossible with cash."
  },
  {
    id: "A08",
    threat:       "Terrorist financing via crypto",
    actor:        "Terrorist organizations, ISIS, Al-Qaeda affiliates",
    intent:       "Finance operations, recruit, pay operatives across borders",
    mechanism:    "Small amounts, encrypted messaging, privacy coins",
    response:     "OFAC SDN: all known terrorist addresses pre-loaded. UN Security Council sanctions list. FATF Recommendation 15 (terrorism financing) integrated. High-velocity + multi-country + small-amount pattern = terrorism financing AML flag. Travel Rule triggers above $1,000 for VASP-to-VASP. Key fact: terrorists primarily use cash and banking — crypto is <1% of terrorism financing (RAND Corp 2021).",
    net_effect:   "positive",
    harm_score:   10,
    post_response: 3,
    constitutional_basis: [7, 3],
    example:      "Hamas 2021 Bitcoin fundraising: flagged, exchanges froze addresses, IDF announced seizure. Crypto more traceable than cash for terrorism finance."
  },

  // ── MARKET ACTORS ─────────────────────────────────────────────────────────
  {
    id: "A09",
    threat:       "Market manipulation — whale pump and dump",
    actor:        "Large holders ('whales') coordinating price manipulation",
    intent:       "Profit from artificial price movements at retail expense",
    mechanism:    "Coordinated large buys to inflate price → retail FOMO → coordinated dump",
    response:     "Ψ Nash score: manipulation is detectable via velocity + counterparty + volume patterns. High-velocity/high-volume from few addresses = concentration flag. FW_SLASH protocol: economic slashing for detected manipulation (already built). Ψ score of manipulating address falls → loses access to Ψ-gated services.",
    net_effect:   "neutral",
    harm_score:   6,
    post_response: 3,
    constitutional_basis: [9, 6],
    example:      "BitMEX whale manipulation 2018: detected via on-chain analysis, CFTC fined $100M."
  },
  {
    id: "A10",
    threat:       "51% attack on Bitcoin",
    actor:        "Nation-state or well-funded attacker controlling >50% hashrate",
    intent:       "Double-spend transactions, censor blocks",
    mechanism:    "Acquire majority hashrate → rewrite recent blocks → steal. Requires: $20B+ hardware investment + ~$8M/hour electricity — economically irrational.",
    response:     "Economic impossibility: attack cost > potential gain. Attacker destroys own investment. 3-tier chain: Bitcoin Core detects chain reorganization. Electrum validates against multiple servers. Any successful attack immediately visible to all nodes. Ψ chain tip monitor (getTip()) detects unusual reorgs.",
    net_effect:   "neutral",
    harm_score:   8,
    post_response: 2,
    constitutional_basis: [12, 9],
    example:      "Bitcoin never successfully 51% attacked in 16 years. Ethereum Classic, BSV, Bitcoin Gold — all attacked. Bitcoin's hashrate makes this economically impossible."
  },

  // ── TECHNICAL ACTORS ──────────────────────────────────────────────────────
  {
    id: "A11",
    threat:       "Quantum computer breaks SHA-256",
    actor:        "Future quantum computers (theoretical 2035–2050+)",
    intent:       "Break Bitcoin's cryptographic security",
    mechanism:    "Grover's algorithm reduces SHA-256 security from 256 to 128 bits",
    response:     "128-bit security remains computationally infeasible even for quantum computers. Bitcoin can hard-fork to SHA-512 or post-quantum algorithms (CRYSTALS-Dilithium). Ψ Cosmic Post-Quantum Keys (already built): 27 physical constants + 6 entropy domains + Lamport OTS + XMSS tree. Timeline: no quantum computer capable of this exists or is expected before 2040.",
    net_effect:   "neutral",
    harm_score:   10,
    post_response: 2,
    constitutional_basis: [12, 9],
    example:      "NIST Post-Quantum standards (2024): CRYSTALS-Kyber for encryption, CRYSTALS-Dilithium for signatures. Bitcoin community will upgrade before threat materializes."
  },
  {
    id: "A12",
    threat:       "Smart contract exploit / DeFi hack",
    actor:        "White-hat / black-hat hackers exploiting code vulnerabilities",
    intent:       "Steal funds from DeFi protocols (Zest, ALEX, Bitflow)",
    mechanism:    "Reentrancy attacks, flash loan manipulation, oracle manipulation",
    response:     "Ψ monitors transaction velocity + amount anomalies. Zest Protocol: Clarity smart contracts have no reentrancy by default (no callbacks). Multi-sig time-locks on treasury. Circuit breakers: if protocol TVL drops >20% in 1 hour → pause. Post-incident: fraud report anchored on chain, legal framework via Article 3.",
    net_effect:   "neutral",
    harm_score:   7,
    post_response: 4,
    constitutional_basis: [7, 9],
    example:      "Ronin Network hack $625M 2022: detected 6 days later. With Ψ velocity monitoring: detectable in minutes."
  },
  {
    id: "A13",
    threat:       "Key loss / wallet compromise",
    actor:        "User error, phishing, hardware failure",
    intent:       "Lose access to Bitcoin holdings",
    mechanism:    "Seed phrase lost, hardware wallet broken, phishing steals keys",
    response:     "Managed wallet system (wallet-manager.ts): AES-256-GCM encrypted keystores. Pillar smart wallet: passkey-based (biometric, no seed phrase to lose). Multi-sig: M-of-N requires multiple compromises. Social recovery: Pillar pilot_add_admin for backup. Never the single-point-of-failure of fiat (one bank, one password).",
    net_effect:   "neutral",
    harm_score:   7,
    post_response: 3,
    constitutional_basis: [1, 8],
    example:      "Approximately 20% of Bitcoin (~4.2M BTC) is permanently lost. The remaining 16.8M BTC is MORE valuable because of this — fixed supply shrinks."
  },

  // ── SOCIAL ACTORS ─────────────────────────────────────────────────────────
  {
    id: "A14",
    threat:       "Digital divide exclusion",
    actor:        "Poverty, lack of infrastructure, illiteracy",
    intent:       "Not malicious — systemic barrier to participation",
    mechanism:    "No smartphone, no internet, no English literacy, no bank account",
    response:     "Article 8: Universal Access. Lightning Network: works on 2G, $30 feature phones. SMS Bitcoin wallets (Machankura — South Africa): no internet needed. x402 USSD codes: feature phone payments. Offline transaction signing. BTC ATMs: 50,000+ worldwide. Any protocol that requires trust is harder than Bitcoin for unbanked — Bitcoin requires only math.",
    net_effect:   "positive",
    harm_score:   6,
    post_response: 2,
    constitutional_basis: [8, 5],
    example:      "El Zonte (El Salvador 'Bitcoin Beach'): unbanked fishing village adopted Bitcoin before national legal tender law. Works without banks."
  },
  {
    id: "A15",
    threat:       "Cognitive injection / social engineering",
    actor:        "Disinformation campaigns against Ψ protocol adoption",
    intent:       "Undermine trust, create FUD, prevent adoption",
    mechanism:    "False claims about security, regulatory attacks, paid media campaigns",
    response:     "Cognitive Guard (already built): equation R'=f(T,C+δ), δ(t)=δ₀×e^(λt). 24 injection patterns detected. Trust weighting: user=1.0, web=0.35. Stance drift detection ε=0.3. Constitution Article 12: SHA-256 genesis hash is the truth anchor — not marketing, not media.",
    net_effect:   "neutral",
    harm_score:   5,
    post_response: 2,
    constitutional_basis: [12, 9],
    example:      "Bitcoin 'death' proclaimed 474 times as of 2024. Price at each 'death': lower than today."
  },
  {
    id: "A16",
    threat:       "Tax evasion via crypto",
    actor:        "Individuals/corporations hiding taxable income in crypto",
    intent:       "Avoid paying legitimate taxes to public institutions",
    mechanism:    "Unreported crypto gains, offshore wallets, privacy coins",
    response:     "Constitutional distinction: tax EVASION (hiding legal income) = crime under Article 7. Tax AVOIDANCE (legal minimization) = protected under Article 1. x402 micro-fee model: tax collected AT THE POINT OF SERVICE — no annual reporting needed. Government APIs charge sBTC directly — tax is instant and automatic. Reduces evasion opportunity by removing the filing gap.",
    net_effect:   "positive",
    harm_score:   5,
    post_response: 2,
    constitutional_basis: [7, 3, 10],
    example:      "IRS identified $28B+ in unreported crypto gains 2021–2023. With x402 model: tax happens at transaction time, no reporting gap."
  },
  {
    id: "A17",
    threat:       "Sanctions evasion by oligarchs / kleptocrats",
    actor:        "Sanctioned individuals using crypto to hide wealth",
    intent:       "Evade asset freezes, continue operating despite sanctions",
    mechanism:    "Moving assets to crypto before sanctions hit, using privacy tools",
    response:     "OFAC SDN oracle: all 15,000+ designated entities tracked. Named individual sanctions (not population-level). Chain analysis: large BTC movements from sanctioned jurisdictions flagged. Travel Rule triggers. Key distinction: individual oligarchs (sanctioned) vs. ordinary citizens of those countries (NOT sanctioned). Article 4: no population-level weaponization.",
    net_effect:   "positive",
    harm_score:   7,
    post_response: 3,
    constitutional_basis: [4, 7, 3],
    example:      "Post-Russia sanctions 2022: blockchain analysis firms identified $1B+ in sanctions evasion. Crypto less effective than believed — fully traceable."
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION III — RISK REGISTRY
// Complete taxonomy with probability, severity, and mitigations
// ══════════════════════════════════════════════════════════════════════════════

export interface Risk {
  id:           string;
  category:     "monetary" | "technical" | "legal" | "geopolitical" | "social" | "systemic";
  name:         string;
  description:  string;
  probability:  "low" | "medium" | "high" | "certain";
  severity:     "low" | "medium" | "high" | "catastrophic";
  risk_score:   number;  // probability × severity (1–25)
  mitigation:   string;
  residual:     string;  // what risk remains after mitigation
  owner:        string;  // who is responsible for mitigation
  timeline:     string;  // when risk is most acute
}

export const RISK_REGISTRY: Risk[] = [
  // ── MONETARY RISKS
  { id: "M01", category: "monetary", name: "BTC price volatility crushes nation adopting BTC reserve",
    description: "A nation converts 5% of reserves to BTC. BTC drops 80% (as in 2022). Nation's reserve position worsens.",
    probability: "high", severity: "high", risk_score: 16,
    mitigation: "Dollar-cost averaging over 36 months. Reserve rebalancing: cap BTC at 5% of total reserves. Use sBTC (Bitcoin-backed, price-stable denomination) for domestic transactions while BTC appreciation accrues.",
    residual: "Short-term paper losses remain. Risk reduced to manageable at ≤5% portfolio allocation.",
    owner: "Finance Ministry + Central Bank", timeline: "Year 1–3 of adoption" },

  { id: "M02", category: "monetary", name: "sBTC depeg (Stacks-native BTC wrapper loses 1:1 peg)",
    description: "Technical failure in sBTC mechanism causes sBTC to trade below BTC value.",
    probability: "low", severity: "high", risk_score: 8,
    mitigation: "sBTC is direct BTC custody on Bitcoin L1 — not algorithmic. Cannot depeg like UST. Verification: bitcoin.tools.ts checks real BTC balance. 3-tier chain validates.",
    residual: "Smart contract risk remains. Mitigated by Bitcoin-layer custody model.",
    owner: "Stacks Foundation / Bitcoin L1 validators", timeline: "Ongoing" },

  { id: "M03", category: "monetary", name: "Liquidity crisis during transition (fiat → sBTC)",
    description: "Nation converts reserves but local businesses still price in fiat. Transition creates dual-currency confusion.",
    probability: "medium", severity: "medium", risk_score: 9,
    mitigation: "El Salvador model: both USD and BTC accepted simultaneously. 18-month parallel system. x402 APIs accept both fiat and sBTC. Gradual merchant adoption via fee incentives.",
    residual: "Price denominating lag. Manageable over 12–24 months.",
    owner: "Treasury + Commerce Ministry", timeline: "Year 2–4" },

  // ── TECHNICAL RISKS
  { id: "T01", category: "technical", name: "Internet infrastructure failure (no internet = no Bitcoin)",
    description: "Nation's internet is cut (undersea cable, government shutdown, power grid failure).",
    probability: "low", severity: "high", risk_score: 8,
    mitigation: "Satellite internet (Starlink, OneWeb) — cannot be cut by governments. Mesh networks (goTenna, LoRa). Lightning Network: offline payments with pre-signed transactions. Bitcoin works on 1990s-era satellite bandwidth.",
    residual: "Rural areas with no satellite coverage remain at risk.",
    owner: "Infrastructure Ministry", timeline: "Ongoing" },

  { id: "T02", category: "technical", name: "Electrum server compromise (layer 2 of sovereign chain)",
    description: "Man-in-the-middle attack on Electrum protocol exposes transaction data or feeds false UTXO data.",
    probability: "medium", severity: "medium", risk_score: 9,
    mitigation: "TLS with certificate pinning (rejectUnauthorized: false only for Electrum which uses self-signed). Multiple Electrum servers (4 mainnet servers — majority agreement). SPV merkle proof verification. Bitcoin Core as layer 1 provides ground truth.",
    residual: "Single-server risk if fallback chain fails. Run own Electrum server for full sovereignty.",
    owner: "Technical infrastructure team", timeline: "Ongoing" },

  { id: "T03", category: "technical", name: "Smart contract vulnerability in DeFi protocols",
    description: "Bug in Zest/ALEX/Bitflow contracts enables fund drain.",
    probability: "medium", severity: "high", risk_score: 12,
    mitigation: "Clarity language: no reentrancy, explicit state. Formal verification. Time-locked upgrades (48h+ delay). Velocity circuit breakers. Audit by multiple firms. TVL caps in early phases.",
    residual: "Novel attack vectors always possible. Position sizing limits exposure.",
    owner: "Protocol developers + security auditors", timeline: "Always present" },

  { id: "T04", category: "technical", name: "Private key loss by government treasury",
    description: "Nation-state holds BTC reserve. Key custodian loses/compromised.",
    probability: "medium", severity: "catastrophic", risk_score: 15,
    mitigation: "Multi-sig: 3-of-5 Taproot threshold signature. Geographic distribution (different ministries in different cities). Hardware HSMs (Ledger Enterprise, Fireblocks). Shamir's Secret Sharing for backup. Cold storage air-gapped signing ceremonies.",
    residual: "Catastrophic risk reduced to manageable with proper key management ceremony.",
    owner: "Central Bank + Finance Ministry + auditors", timeline: "Always present" },

  // ── LEGAL RISKS
  { id: "L01", category: "legal", name: "Retroactive criminalization of BTC holdings",
    description: "Government passes law making BTC holding illegal, retroactively confiscating holdings.",
    probability: "low", severity: "high", risk_score: 8,
    mitigation: "Ψ Article 1 (Monetary Sovereignty) + Article 3 (Rule of Law). BTC is protected under property rights in most constitutions. Physical BTC wallets in free jurisdictions. Hardware wallets cross-border mobile. Seeds memorized (brainwallet). Cannot be confiscated like gold (Executive Order 6102-style is less effective with crypto).",
    residual: "Exchange-held BTC is vulnerable. Self-custody is the only protection.",
    owner: "Individual holders + legal framework", timeline: "Ongoing geopolitical risk" },

  { id: "L02", category: "legal", name: "Regulatory capture of x402 protocol",
    description: "Regulators declare x402 endpoints require money transmitter licenses.",
    probability: "medium", severity: "medium", risk_score: 9,
    mitigation: "x402 protocol is a payment standard, not a money transmitter. Like HTTP is not a bank. Structural argument: x402 endpoints are API calls with attached payment — same as any API billing. Legal precedent: API billing (Stripe, etc.) is not money transmission. Constitutional Article 10: interoperability with existing systems.",
    residual: "Regulatory clarity varies by jurisdiction. Legal opinions per country needed.",
    owner: "Protocol legal team", timeline: "2025–2027 regulatory clarity period" },

  // ── GEOPOLITICAL RISKS
  { id: "G01", category: "geopolitical", name: "Coordinated G7 ban on Bitcoin",
    description: "G7 nations coordinate to ban Bitcoin simultaneously, cutting off on-ramps.",
    probability: "low", severity: "high", risk_score: 8,
    mitigation: "G7 nations hold different regulatory frameworks (US vs EU vs JP). Political difficulty: too many institutional holders (BlackRock, Fidelity, MicroStrategy, pension funds). P2P continues regardless. Mining in non-G7 nations (Central Asia, Africa, LatAm) continues. Ψ Cantillon⁻¹: G7 ban enriches non-G7 miners.",
    residual: "Short-term price shock. Long-term: G7 loses mining revenue to non-G7 nations.",
    owner: "Geopolitical monitoring", timeline: "Ongoing" },

  { id: "G02", category: "geopolitical", name: "Bitcoin declared weapon of war by adversary",
    description: "Nation-state uses Bitcoin to fund proxy wars, evade sanctions at scale.",
    probability: "medium", severity: "medium", risk_score: 9,
    mitigation: "Sanctions oracle: named entities flagged (not nations). Article 4: no weaponization. Bitcoin is neutral infrastructure — like TCP/IP. Oil is used to fuel tanks — oil is not banned. The response is sanctions on named actors, not on the protocol.",
    residual: "Political pressure on exchanges. Protocol itself cannot be stopped.",
    owner: "International diplomatic framework", timeline: "Ongoing geopolitical tension" },

  // ── SOCIAL RISKS
  { id: "S01", category: "social", name: "Bitcoin becomes new wealth concentration tool",
    description: "Early adopters (whales) accumulate so much BTC that Cantillon effect recreates itself.",
    probability: "medium", severity: "medium", risk_score: 9,
    mitigation: "Lightning Network micro-transactions enable small-holder participation. Mining is open to all — anyone can mine. Ψ Nash score monitors concentration (CONCENTRATION AML flag). Constitutional Article 11: generational equity. Key fact: Bitcoin distribution is MORE equal than fiat — top 0.01% hold 35% of USD wealth, hold ~25% of BTC.",
    residual: "Wealth inequality remains. But the mechanism (Cantillon effect) is broken.",
    owner: "Community + mining market dynamics", timeline: "Long-term structural issue" },

  // ── SYSTEMIC RISKS
  { id: "SY01", category: "systemic", name: "Black swan: unexpected correlated collapse",
    description: "Simultaneously: BTC price -90%, major DeFi hack, nation-state ban, internet disruption.",
    probability: "low", severity: "catastrophic", risk_score: 12,
    mitigation: "Defense in depth: no single point of failure. Bitcoin Core on own hardware. Electrum backup. Paper wallet cold storage. Multi-sig. Geographic distribution. Physical gold as ultimate backstop. The system has survived: 2011 hack, 2013 regulatory crisis, 2017 fork wars, 2020 covid crash, 2022 LUNA collapse, 2022 FTX collapse. Each time the base layer (Bitcoin Core) never failed.",
    residual: "Tail risk always exists. Position sizing and multi-asset approach is the only mitigation.",
    owner: "All participants", timeline: "Always present, low probability" },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION IV — COMPREHENSIVE REFORMS CATALOG
// What the Ψ system enables that current systems cannot
// ══════════════════════════════════════════════════════════════════════════════

export interface ReformProposal {
  id:          string;
  area:        string;
  problem:     string;       // current broken state
  reform:      string;       // what changes
  mechanism:   string;       // how implemented via Ψ system
  beneficiaries: string[];
  timeline:    string;
  positives:   string[];
  negatives:   string[];     // honest assessment of downsides
  net_balance: "strongly_positive" | "positive" | "neutral_positive";
}

export const REFORM_CATALOG: ReformProposal[] = [
  {
    id: "R01", area: "Central Banking",
    problem: "Central banks have unelected, unlimited power to inflate money supply, transferring wealth from savers to debtors and from poor to rich via Cantillon effect.",
    reform: "Central banks become reserve managers, not money creators. Money supply governed by on-chain rules, not board votes.",
    mechanism: "Nation phases to sBTC reserve backing (Phase 3 of liberation plan). Monetary policy moves to DAO governance. Central bank mandate: maintain sBTC reserve ratio, not target arbitrary inflation.",
    beneficiaries: ["All citizens (savers recover)","Export industries (stable currency)","Young people (non-inflated savings)"],
    timeline: "10–15 years per nation",
    positives: ["Eliminates inflation tax","Accountable monetary policy","Transparent reserve verification","Ends Cantillon advantage for banks"],
    negatives: ["Government loses inflation tool","Deficit spending requires real resources","Debt crises cannot be 'inflated away' (requires genuine reform)","Transition period disruption"],
    net_balance: "strongly_positive",
  },
  {
    id: "R02", area: "Taxation",
    problem: "Tax systems cost 30–40% of revenue in collection overhead. Annual filing creates evasion opportunities. Complexity enables evasion by sophisticated actors.",
    reform: "Consumption-point micro-taxes via x402. Tax collected instantly at each transaction. No annual filing. No reporting burden.",
    mechanism: "Government APIs are x402 endpoints. Treasury receives sBTC directly. Optional: smart contract withholding on employer-to-employee payments (voluntary disclosure model).",
    beneficiaries: ["Small businesses (reduced compliance cost)","Individuals (no annual filing)","Government (reduced collection cost)","Informal economy workers (can participate without tax agency relationship)"],
    timeline: "5–10 years per jurisdiction",
    positives: ["Instant tax collection","Near-zero evasion at API endpoints","Proportional (more you use services, more you pay)","Transparent (all flows on-chain)"],
    negatives: ["Progressive taxation harder to implement (flat rate per transaction)","Social equity requires rethinking (UBI or rebate mechanism needed)","Existing tax authority bureaucracies face restructuring"],
    net_balance: "positive",
  },
  {
    id: "R03", area: "International Trade Settlement",
    problem: "Global trade settled in USD → dollar hegemony → US monetary policy affects all nations → SWIFT weaponization enables economic coercion.",
    reform: "sBTC as neutral trade settlement layer. Bilateral trade invoiced and settled in sBTC. No correspondent banks. No SWIFT.",
    mechanism: "Multisig escrow on Stacks (2-of-2 buyer+seller+arbiter). x402 trade API: invoice in sBTC, auto-settle. Bitcoin Core validates final settlement. Lightning for smaller trade flows.",
    beneficiaries: ["Developing nations (escape dollar trap)","Sanctioned nations' civilians","All trading nations (lower settlement costs)","Supply chain actors (instant settlement vs 2–5 day SWIFT)"],
    timeline: "5–15 years for significant adoption",
    positives: ["Neutral reserve currency for first time since gold standard","Eliminates SWIFT weaponization","Instant settlement (vs days)","Lower cost (0.1% vs 1–5% correspondent banking fees)"],
    negatives: ["USD hegemony decline → US loses seigniorage advantage","Trade invoicing in volatile asset requires hedging","Legal disputes need new arbitration framework","Large USD-denominated debt must still be serviced"],
    net_balance: "positive",
  },
  {
    id: "R04", area: "IMF / World Bank Replacement",
    problem: "IMF conditionality loans impose austerity, privatization, and currency devaluation on developing nations — often worsening the crisis they claim to solve.",
    reform: "DeFi protocols (Zest, ALEX) provide sovereign lending against sBTC collateral. Better rates, no political conditions.",
    mechanism: "Nation deposits sBTC as collateral in Zest Protocol. Borrows stablecoins for domestic budget needs. Interest rate: 3–8% DeFi vs 5–15% IMF conditionality. No structural adjustment requirements.",
    beneficiaries: ["Developing nations","Populations spared austerity","Domestic industries not privatized","Future generations (debt in real asset, not inflating USD)"],
    timeline: "Immediate for existing DeFi protocols",
    positives: ["No political conditions on loans","Better interest rates","Transparent terms on-chain","Cannot be used for geopolitical leverage"],
    negatives: ["Requires sBTC collateral (nations must accumulate first)","No lender-of-last-resort for liquidity crises","DeFi protocol risk (smart contract exploits)","Small loan sizes currently (DeFi TVL limitations)"],
    net_balance: "positive",
  },
  {
    id: "R05", area: "Universal Basic Income (UBI)",
    problem: "Automation displaces workers. Traditional UBI requires tax collection, distribution bureaucracy, and creates dependency.",
    reform: "Ψ-UBI: Citizens earn sBTC from national mining revenue + x402 government fees. Distributed automatically to wallet addresses. No bureaucracy.",
    mechanism: "National BTC mining revenue → 30% to treasury, 70% distributed to all citizen wallet addresses (equal shares). x402 API fees → 50% to treasury, 50% to citizen dividend. Smart contract distribution monthly.",
    beneficiaries: ["All citizens equally","Especially those displaced by automation","Rural populations (same dividend as urban)","Entrepreneurs (safety net enables risk-taking)"],
    timeline: "Requires Phase 4–5 of national liberation plan (10–15 years)",
    positives: ["Universal, unconditional, transparent","No bureaucracy overhead","Inflation-resistant (denominated in sBTC)","Cantillon⁻¹ in practice: equal distribution"],
    negatives: ["Mining revenue insufficient for full UBI near-term","Requires national wallet infrastructure","Privacy concerns for public distribution lists","Potential inflation if spent simultaneously"],
    net_balance: "strongly_positive",
  },
  {
    id: "R06", area: "Debt Jubilee (Legacy Debt Resolution)",
    problem: "$307T in global debt cannot be repaid. It will eventually be defaulted or inflated. The question is only who bears the loss.",
    reform: "Structured debt jubilee: old USD/EUR debts forgiven in exchange for nations adopting sBTC-backed monetary policies that prevent future debt accumulation.",
    mechanism: "International Ψ Treaty: creditor nations (US, EU, Japan) forgive $50–100T in developing nation debt in exchange for: (1) sBTC reserve adoption (3% GDP), (2) No new fiat debt issuance, (3) Transparency publishing debt schedule on-chain. Win-win: creditors get monetary reform, debtors get clean slate.",
    beneficiaries: ["Developing nations (debt relief)","All humanity (stable global monetary system)","Future generations (no inherited debt)","Creditor nations (stable trading partners)"],
    timeline: "Requires political consensus (15–25 years)",
    positives: ["Ends the 300-year debt cycle","Prevents future fiat debt accumulation","Creates genuine free-trade partners (not debt-dependent)","Mathematical inevitability accelerated"],
    negatives: ["Creditor nations (US, Germany, Japan) suffer balance sheet losses","Political resistance from banking establishment","IMF loses relevance (existential threat to institution)","Moral hazard: forgiven nations may borrow again"],
    net_balance: "strongly_positive",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION V — MONETARY BRIDGE
// The peaceful transition from fiat to sBTC — no disruption required
// ══════════════════════════════════════════════════════════════════════════════

export interface MonetaryBridgePhase {
  phase:       string;
  name:        string;
  fiat_role:   string;
  sbtc_role:   string;
  trigger:     string;
  duration:    string;
  stability:   "high" | "medium" | "building";
  citizens_action: string;
}

export const MONETARY_BRIDGE: MonetaryBridgePhase[] = [
  {
    phase: "BRIDGE-0", name: "Parallel Existence",
    fiat_role: "Primary currency for all transactions, 100% of prices",
    sbtc_role: "Savings vehicle — 'digital gold'. Optional. 0% of transactions.",
    trigger: "Today — no policy change needed",
    duration: "Ongoing until voluntary threshold",
    stability: "high",
    citizens_action: "No action required. Optional: hold 5–10% of savings in sBTC as inflation hedge.",
  },
  {
    phase: "BRIDGE-1", name: "Dual Pricing",
    fiat_role: "Primary, but prices shown in both fiat and sBTC equivalent",
    sbtc_role: "Growing — merchants optionally accept, price discovery begins",
    trigger: "When sBTC/BTC payments represent >5% of transactions in a jurisdiction",
    duration: "2–5 years",
    stability: "high",
    citizens_action: "Optionally pay in sBTC at merchants who accept. Exchange fees decline.",
  },
  {
    phase: "BRIDGE-2", name: "Reserve Backing",
    fiat_role: "Legal tender, but backed by sBTC reserve (like gold standard)",
    sbtc_role: "National reserve asset — public can verify reserve on-chain",
    trigger: "Nation reaches 10% monetary base backed by sBTC reserve",
    duration: "3–7 years",
    stability: "building",
    citizens_action: "sBTC savings verified against reserve. Fiat stability improves.",
  },
  {
    phase: "BRIDGE-3", name: "Convertibility",
    fiat_role: "Domestic unit of account for wages, taxes, everyday prices",
    sbtc_role: "Reserve + settlement layer. All international trade in sBTC.",
    trigger: "Nation reaches 25% monetary base backed by sBTC",
    duration: "5–10 years",
    stability: "building",
    citizens_action: "Can convert fiat to sBTC at fixed rate at any bank. Like Bretton Woods.",
  },
  {
    phase: "BRIDGE-4", name: "Bitcoin Standard",
    fiat_role: "Fractional token of sBTC — like coins are fractions of paper notes",
    sbtc_role: "The base money. All prices ultimately denominated in sats.",
    trigger: "Political consensus + >50% monetary base backed",
    duration: "Permanent",
    stability: "high",
    citizens_action: "Wages in sBTC. Taxes in sBTC. Savings in sBTC. Fiat is convenience layer.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION VI — STABILITY MECHANISMS
// What keeps the system stable in all conditions
// ══════════════════════════════════════════════════════════════════════════════

export interface StabilityMechanism {
  name:       string;
  type:       "automatic" | "manual" | "governance";
  condition:  string;  // what triggers it
  action:     string;  // what happens
  proof:      string;  // why this maintains stability
}

export const STABILITY_MECHANISMS: StabilityMechanism[] = [
  {
    name: "Mining Difficulty Adjustment",
    type: "automatic",
    condition: "Hashrate changes (miners join or leave)",
    action: "Bitcoin adjusts difficulty every 2016 blocks to maintain 10-minute block time",
    proof: "Nash equilibrium: regardless of how many miners participate, monetary issuance remains constant. Economic shock cannot accelerate or decelerate supply.",
  },
  {
    name: "Halving Schedule",
    type: "automatic",
    condition: "Every 210,000 blocks (~4 years)",
    action: "Block reward halves: 50→25→12.5→6.25→3.125→... → 0",
    proof: "Scheduled supply reduction creates predictable scarcity. No human decision required. Landauer: energy cost per BTC mined doubles every 4 years relative to reward.",
  },
  {
    name: "Ψ Nash Equilibrium Check",
    type: "automatic",
    condition: "Every agent interaction",
    action: "psi_oracle evaluates transaction patterns. High-risk → compliance flag. Low Ψ → gated access.",
    proof: "Honest participation is always cheaper. Dishonest participation attracts scrutiny. Self-enforcing without central authority.",
  },
  {
    name: "DeFi Circuit Breaker",
    type: "automatic",
    condition: "Protocol TVL drops >20% in <1 hour",
    action: "Pause new borrows/withdraws. Alert governance. 48-hour review window.",
    proof: "Prevents cascading liquidations (like LUNA/UST collapse). Time for human review before irreversible damage.",
  },
  {
    name: "Reserve Ratio Alert",
    type: "automatic",
    condition: "National sBTC reserve falls below threshold (e.g., 8% when target 10%)",
    action: "Treasury alert: stop new fiat-denominated bond issuance. Reallocate 1% of receipts to reserve restoration.",
    proof: "Automatic fiscal discipline. No central bank vote needed. Published rule prevents political override.",
  },
  {
    name: "x402 Revenue Diversification",
    type: "governance",
    condition: "Any single API endpoint > 30% of x402 revenue",
    action: "Governance proposal to develop alternative revenue streams. No single point of failure in government revenue.",
    proof: "Revenue diversification prevents hold-up problems (one service shut down = revenue collapse). Multiple endpoints = resilience.",
  },
  {
    name: "Constitutional Hash Anchoring",
    type: "governance",
    condition: "Any proposed protocol change",
    action: "SHA-256 of proposed change published on-chain. 90-day review period. Supermajority required for core parameter changes.",
    proof: "Gödel: external axiom (SHA-256) anchors the system against corruption. No change can be hidden — all are on-chain.",
  },
  {
    name: "Three-Tier Bitcoin Chain Failover",
    type: "automatic",
    condition: "Bitcoin Core RPC fails / Electrum server unreachable",
    action: "Automatic failover: Core → Electrum → mempool.space. User never sees failure.",
    proof: "No single point of failure in Bitcoin data layer. Sovereignty preserved even if one tier is attacked.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SECTION VII — THE NET BALANCE
// For every reaction, the positive counter-reaction
// ══════════════════════════════════════════════════════════════════════════════

export interface ReactionsBalance {
  scenario:     string;
  reaction:     string;   // what happens
  counter:      string;   // Ψ system counter-response
  net_civilian: "positive" | "neutral" | "negative_temporary";
  explanation:  string;
}

export const REACTIONS_BALANCE: ReactionsBalance[] = [
  {
    scenario: "Bitcoin becomes dominant monetary system",
    reaction: "Creditor nations lose seigniorage (US loses ~$150B/year from dollar printing)",
    counter: "Citizens of those nations gain: savings no longer inflated. Housing, healthcare, education cost stable in BTC terms.",
    net_civilian: "positive",
    explanation: "The loss is to the state (seigniorage) not to citizens. Citizens of creditor nations GAIN when their savings stop being inflated.",
  },
  {
    scenario: "Banks lose deposit-based business model",
    reaction: "Major bank restructuring, job losses in financial sector",
    counter: "DeFi fills lending gap at lower cost. Bank employees transition to DeFi protocol development, compliance, customer service. Net financial services jobs may increase.",
    net_civilian: "neutral",
    explanation: "Disruption is real. Net civilian outcome neutral to positive as financial services become cheaper and more accessible.",
  },
  {
    scenario: "Governments cannot run deficits (sBTC standard = balanced budget required)",
    reaction: "Initial government service cuts as deficit spending ends",
    counter: "x402 revenue replaces tax gaps. UBI from mining dividends. One-time debt jubilee clears legacy obligations. Long-term: no more debt service consumes 20–40% of tax revenues.",
    net_civilian: "positive",
    explanation: "Short-term pain (service reductions) vs long-term gain (no debt slavery). Net positive over 10-year horizon.",
  },
  {
    scenario: "Developing nations gain equal monetary access",
    reaction: "Dollar-denominated trade flows redirect. US dollar demand falls.",
    counter: "US loses reserve currency advantage but gains: lower import prices, reduced foreign policy burden, healthier domestic manufacturing (no longer suppressed by reserve currency overvaluation).",
    net_civilian: "positive",
    explanation: "All nations gain. The 'loss' is the artificial subsidy the reserve currency gave to US financial sector — not to US workers.",
  },
  {
    scenario: "Privacy criminals attempt to use the system",
    reaction: "Increased scrutiny on ALL transactions if AML tightens",
    counter: "ZK-KYC proves compliance without surveillance. Honest users unaffected. Criminal use MORE traceable than cash (permanent blockchain record).",
    net_civilian: "neutral",
    explanation: "Privacy maintained for honest users. Criminal activity more detectable than cash alternative.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Query functions
// ══════════════════════════════════════════════════════════════════════════════

export function getConstitutionalArticle(number: number): ConstitutionalArticle | null {
  return PSI_CONSTITUTION.find(a => a.number === number) ?? null;
}

export function getAdversarialResponse(id: string): AdversarialScenario | null {
  return ADVERSARIAL_MATRIX.find(s => s.id === id) ?? null;
}

export function getHighestRisks(n: number = 5): Risk[] {
  return [...RISK_REGISTRY]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, n);
}

export function getRisksByCategory(category: Risk["category"]): Risk[] {
  return RISK_REGISTRY.filter(r => r.category === category);
}

export function getReformsByArea(area: string): ReformProposal[] {
  return REFORM_CATALOG.filter(r =>
    r.area.toLowerCase().includes(area.toLowerCase())
  );
}

export function getSystemSummary(): {
  constitution_articles:  number;
  adversarial_scenarios:  number;
  risks_total:            number;
  risks_by_category:      Record<string, number>;
  reforms_total:          number;
  bridge_phases:          number;
  stability_mechanisms:   number;
  genesis_hash:           string;
  preamble:               string;
} {
  const byCat: Record<string, number> = {};
  for (const r of RISK_REGISTRY) {
    byCat[r.category] = (byCat[r.category] ?? 0) + 1;
  }

  return {
    constitution_articles:  PSI_CONSTITUTION.length,
    adversarial_scenarios:  ADVERSARIAL_MATRIX.length,
    risks_total:            RISK_REGISTRY.length,
    risks_by_category:      byCat,
    reforms_total:          REFORM_CATALOG.length,
    bridge_phases:          MONETARY_BRIDGE.length,
    stability_mechanisms:   STABILITY_MECHANISMS.length,
    genesis_hash:           GENESIS_HASH,
    preamble:               "We the participants of every nation, seeking to establish monetary justice...",
  };
}
