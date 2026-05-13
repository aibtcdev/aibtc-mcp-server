/**
 * Bitcoin Energy Engine — محرك طاقة Bitcoin
 *
 * The deepest layer: Proof of Work is physics, not policy.
 * Energy expenditure is the only objective anchor for value that exists.
 *
 * Theoretical foundation:
 *   Landauer (1961)  — erasing one bit costs kT·ln(2) joules minimum
 *   Szilard (1929)   — information and thermodynamics are unified
 *   Shannon (1948)   — entropy and information are dual
 *   Nash (1994-2002) — ideal money needs an objective standard; ICPI = energy basket
 *   Satoshi (2008)   — Proof of Work IS that standard, self-adjusting via DAA
 *
 * Key insight: Bitcoin mining is the only monetary system where the cost
 * of creating money equals the thermodynamic cost of the information it encodes.
 * Every other monetary system separates cost from value. Bitcoin cannot.
 */

import { createHash } from "crypto";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ── Physical constants ────────────────────────────────────────────────────────

const BOLTZMANN_K     = 1.380649e-23;  // J/K (exact, 2019 SI)
const ROOM_TEMP_K     = 298.15;        // 25°C standard
const LANDAUER_JOULES = BOLTZMANN_K * ROOM_TEMP_K * Math.LN2; // ~2.85e-21 J per bit erasure

// Bitcoin SHA-256 double-hash processes 256 bits per nonce attempt
const BITS_PER_HASH   = 512;           // 2× SHA-256, 256 bits each pass
const LANDAUER_PER_HASH = LANDAUER_JOULES * BITS_PER_HASH; // theoretical minimum

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LandauerAnalysis {
  principle:              string;
  landauer_joules_per_bit: number;
  landauer_per_btc_hash:  number;
  actual_joules_per_hash: number;
  efficiency_ratio:       number;  // actual / theoretical minimum
  interpretation:         string;
  thermodynamic_floor:    string;
  unforgeable_reason:     string;
}

export interface ProofOfWorkThermodynamics {
  what_pow_really_is:     string;
  energy_as_truth:        string;
  why_no_shortcut:        string;
  arrow_of_time:          string;
  bitcoin_vs_fiat:        { bitcoin: string; fiat: string; winner: string };
  szilard_connection:     string;
  maxwell_demon_defeated: string;
}

export interface IcpiEquivalence {
  nash_definition:        string;
  icpi_commodities:       Array<{ commodity: string; btc_parallel: string; why_objective: string }>;
  btc_is_icpi:            string;
  daa_mechanism:          string;
  miracle_problem_solved: string;
}

export interface EnergySecurityModel {
  current_twh_annual:     number;
  hashrate_ehs:           number;           // exahashes/sec
  cost_per_joule_usd:     number;
  cost_to_attack_usd:     number;           // 51% attack cost
  attack_duration_hours:  number;
  comparison: Array<{
    system:       string;
    twh_annual:   number;
    what_it_buys: string;
  }>;
  security_per_dollar:    string;
}

export interface MiningEconomics {
  epoch:              number;
  year:               number;
  block_reward_btc:   number;
  blocks_per_year:    number;
  new_btc_per_year:   number;
  inflation_pct:      number;
  fee_pct_of_revenue: number;
  energy_cost_floor:  string;
}

export interface RenewableTransition {
  current_renewable_pct:  number;
  trajectory:             string;
  why_bitcoin_goes_green: string[];
  stranded_energy:        string;
  grid_stabilization:     string;
  comparison:             Array<{ industry: string; renewable_pct: number }>;
}

export interface EnergyValueTheory {
  thesis:             string;
  landauer_axiom:     string;
  pow_as_money:       string;
  fiat_energy_cost:   string;
  gold_energy_cost:   string;
  btc_energy_cost:    string;
  why_energy_is_fair: string;
  nash_validation:    string;
  satoshi_validation: string;
}

export interface BitcoinEnergyComplete {
  landauer:           LandauerAnalysis;
  thermodynamics:     ProofOfWorkThermodynamics;
  icpi_equivalence:   IcpiEquivalence;
  security_model:     EnergySecurityModel;
  mining_epochs:      MiningEconomics[];
  renewable:          RenewableTransition;
  energy_value_theory: EnergyValueTheory;
  the_deepest_truth:  string;
  hash:               string;
}

// ── Builders ──────────────────────────────────────────────────────────────────

export function buildLandauerAnalysis(): LandauerAnalysis & { hash: string } {
  // Top ASIC (Bitmain S21 XP): ~13.5 J/TH → ~13.5e-12 J per hash
  const actual_joules_per_hash = 13.5e-12;
  const efficiency_ratio       = actual_joules_per_hash / LANDAUER_PER_HASH;

  const r = {
    principle:
      "Landauer's principle (1961): erasing one bit of information requires a minimum of kT·ln(2) joules of energy. " +
      "This is not an engineering limitation — it is a law of physics. Information and thermodynamics are unified.",
    landauer_joules_per_bit: LANDAUER_JOULES,
    landauer_per_btc_hash:   LANDAUER_PER_HASH,
    actual_joules_per_hash,
    efficiency_ratio,
    interpretation:
      `The best Bitcoin ASICs consume ~${efficiency_ratio.toExponential(2)}× the theoretical Landauer minimum per hash. ` +
      "Modern ASICs are within 8 orders of magnitude of the physical limit. " +
      "As ASICs approach the Landauer floor, mining approaches thermodynamic perfection.",
    thermodynamic_floor:
      "No computational improvement can reduce energy below kT·ln(2) per bit erasure. " +
      "Bitcoin's security floor is therefore set by the laws of thermodynamics, not by economics or politics.",
    unforgeable_reason:
      "You cannot fake a valid SHA-256 hash without doing the work. " +
      "The second law of thermodynamics guarantees this — entropy cannot spontaneously decrease. " +
      "A valid block hash IS physical proof that energy was spent. It cannot be counterfeited.",
    hash: "",
  };
  r.hash = sha256(JSON.stringify(r));
  return r;
}

export function buildProofOfWorkThermodynamics(): ProofOfWorkThermodynamics & { hash: string } {
  const r = {
    what_pow_really_is:
      "Proof of Work is an arrow-of-time stamp. Each block hash proves that a certain quantity of " +
      "thermodynamic work was performed BEFORE the block was found. The universe cannot be run backwards " +
      "to undo this work. The Bitcoin blockchain is therefore a physical record of irreversible events.",
    energy_as_truth:
      "Truth in the physical world costs energy. Lies are cheap — anyone can claim anything. " +
      "Bitcoin's genius: it makes truth-telling expensive (mining cost) and lying even more expensive " +
      "(you must outpace honest miners). The honest chain is always the cheapest to extend.",
    why_no_shortcut:
      "SHA-256 is a one-way function. There is no mathematical shortcut to find a hash below the target " +
      "other than trying nonces one by one. This is provably required by the hash function's design. " +
      "The only way to produce valid blocks faster is to spend more energy.",
    arrow_of_time:
      "The Bitcoin blockchain points in one direction: forward. Each block is timestamped and references " +
      "the previous block. To rewrite history, an attacker must redo all the work from the target block " +
      "forward AND outpace the current chain. This requires more energy than the honest network — " +
      "the thermodynamic arrow of time protects the ledger.",
    bitcoin_vs_fiat: {
      bitcoin:
        "Creating 1 BTC requires burning electricity. The cost is real, measurable, and unforgeable. " +
        "The supply schedule is mathematically fixed at 21 million total — no exception possible.",
      fiat:
        "Creating $1 trillion requires pressing a key on a keyboard. Energy cost: near zero. " +
        "Political cost: near zero. The supply is unlimited and adjusted by committee opinion.",
      winner:
        "Bitcoin — because its money creation is constrained by physics, not by politics. " +
        "Physics cannot be lobbied, bribed, or inflated away.",
    },
    szilard_connection:
      "Leo Szilard (1929) showed that Maxwell's Demon — a being that could sort molecules without " +
      "energy cost — cannot exist. To gain information, you must pay in entropy. " +
      "Bitcoin applies this at monetary scale: to gain the right to write to the ledger (information), " +
      "you must pay in energy (entropy). Szilard's demon is the central bank. Bitcoin defeated it.",
    maxwell_demon_defeated:
      "The central bank is Maxwell's Demon: it appears to create value (money) from nothing, " +
      "sorting purchasing power from the population into government accounts without apparent cost. " +
      "But Szilard proved the demon must pay. In fiat systems, the cost is paid by savers (inflation). " +
      "Bitcoin makes the energy cost explicit and upfront — the demon cannot hide.",
    hash: "",
  };
  (r as Record<string, unknown>).hash = sha256(JSON.stringify(r));
  return r as ProofOfWorkThermodynamics & { hash: string };
}

export function buildIcpiEquivalence(): IcpiEquivalence & { hash: string } {
  const r = {
    nash_definition:
      "Nash (1994): 'An Industrial Consumption Price Index (ICPI) based on a basket of internationally " +
      "traded commodities would serve as a stable reference for money.' Nash wanted money pegged to " +
      "physical reality — to things that cost real resources to produce.",
    icpi_commodities: [
      {
        commodity:    "Copper",
        btc_parallel: "Electricity (kWh consumed per terahash)",
        why_objective: "Both are globally traded, physically scarce, and priced by competitive markets — not committees.",
      },
      {
        commodity:    "Silver",
        btc_parallel: "Silicon (ASIC chip area per terahash)",
        why_objective: "Both require mining, refining, and industrial production — objective resource costs.",
      },
      {
        commodity:    "Tungsten",
        btc_parallel: "Cooling infrastructure (BTU/hr per megawatt)",
        why_objective: "Both represent engineering scarcity — thermally limited resources that cannot be wished into existence.",
      },
      {
        commodity:    "Palladium",
        btc_parallel: "Network bandwidth (TB/month for node operation)",
        why_objective: "Both represent logistics costs — irreducible overhead of operating at global scale.",
      },
      {
        commodity:    "Crude oil",
        btc_parallel: "ASIC manufacturing energy (kWh per unit produced)",
        why_objective: "Both are energy-dense commodities whose prices reflect real extraction costs.",
      },
    ],
    btc_is_icpi:
      "Bitcoin's mining cost IS a real-time ICPI. The electricity price, hardware cost, cooling cost, " +
      "and bandwidth cost are the basket. The market finds the efficient mining cost automatically. " +
      "No committee needed. No political adjustment. Pure market discovery of energy value.",
    daa_mechanism:
      "The Difficulty Adjustment Algorithm (every 2016 blocks, ~2 weeks) automatically rebalances " +
      "the energy basket. If electricity becomes cheaper → more miners → higher difficulty → " +
      "cost per block stays near equilibrium. This is Nash's ICPI committee replaced by math.",
    miracle_problem_solved:
      "Nash worried: who adjusts the ICPI basket when technology changes? " +
      "Bitcoin's answer: the DAA adjusts automatically. You cannot change the target without changing " +
      "the protocol (requiring consensus of 51%+ of nodes). The basket is self-updating and " +
      "manipulation-resistant. Nash's miracle problem has a mathematical solution.",
    hash: "",
  };
  (r as Record<string, unknown>).hash = sha256(JSON.stringify(r));
  return r as IcpiEquivalence & { hash: string };
}

export function buildEnergySecurityModel(): EnergySecurityModel & { hash: string } {
  // 2025 estimates: ~650 TWh/year, ~700 EH/s, ~0.05 USD/kWh average
  const twh         = 650;
  const hashrate_ehs = 700;
  const cost_kwh    = 0.05;
  const twh_joules  = twh * 1e12 * 3600;          // TWh → joules
  const cost_usd    = (twh * 1e9) * cost_kwh;     // total annual cost

  // 51% attack requires matching the honest hash rate for the duration
  // Attacker needs ~350 EH/s additional hardware + electricity
  // Hardware cost: ~$10/TH modern ASICs → 350e6 TH * $10 = $3.5T
  const attack_hardware_usd = 350e6 * 10;        // $3.5 trillion
  const attack_duration_h   = 6;                 // enough to rewrite 36 blocks
  const attack_elec_usd     = (attack_duration_h / 8760) * (cost_usd / 2); // pro-rated

  const r = {
    current_twh_annual:    twh,
    hashrate_ehs:          hashrate_ehs,
    cost_per_joule_usd:    cost_kwh / 3.6e6,
    cost_to_attack_usd:    attack_hardware_usd + attack_elec_usd,
    attack_duration_hours: attack_duration_h,
    comparison: [
      { system: "Bitcoin network security",     twh_annual: twh,  what_it_buys: "Immutable global monetary ledger, 700 EH/s attack resistance" },
      { system: "Global banking data centers",  twh_annual: 100,  what_it_buys: "KYC databases, settlement systems — still reversible by judges" },
      { system: "Gold mining (global)",         twh_annual: 130,  what_it_buys: "Physical commodity production — cannot be audited without assay" },
      { system: "US military (selected ops)",   twh_annual: 80,   what_it_buys: "Kinetic deterrence — geographic limitation" },
      { system: "Internet data centers (total)",twh_annual: 200,  what_it_buys: "General computation — serves billions of apps" },
      { system: "Christmas lights (US only)",   twh_annual: 6.6,  what_it_buys: "Decorative illumination — no ledger" },
    ],
    security_per_dollar:
      `$${(attack_hardware_usd / 1e9).toFixed(1)}B hardware + electricity required for a 6-hour 51% attack. ` +
      "This makes Bitcoin the most expensive system in history to attack. " +
      "Every dollar spent on mining adds to the attack cost permanently (hardware depreciates slowly). " +
      "The security budget grows with adoption — not with political will.",
    hash: "",
  };
  (r as Record<string, unknown>).hash = sha256(JSON.stringify(r));
  return r as EnergySecurityModel & { hash: string };
}

export function buildMiningEpochs(): MiningEconomics[] {
  const epochs: MiningEconomics[] = [];
  let reward = 50;
  let supply  = 0;
  const maxSupply = 21_000_000;
  const blocksPerYear = 52_560; // 6/hr × 8760 hr

  for (let epoch = 1; epoch <= 33; epoch++) {
    const year         = 2009 + (epoch - 1) * 4;
    const newBtc       = Math.min(reward * blocksPerYear, maxSupply - supply);
    const inflationPct = supply > 0 ? (newBtc / supply) * 100 : 100;
    const feeShare     = epoch <= 10 ? epoch * 3 : Math.min(100, 30 + (epoch - 10) * 7);

    epochs.push({
      epoch,
      year,
      block_reward_btc:   reward,
      blocks_per_year:    blocksPerYear,
      new_btc_per_year:   newBtc,
      inflation_pct:      parseFloat(inflationPct.toFixed(4)),
      fee_pct_of_revenue: epoch === 33 ? 100 : feeShare,
      energy_cost_floor:
        epoch <= 10  ? "Subsidy-dominant — miners need low fees to survive" :
        epoch <= 20  ? "Transition — fees supplement declining subsidy" :
        epoch <= 32  ? "Fee-dominant — market sets security budget" :
                       "Fee-only — 100% fee-funded; thermodynamic security floor permanent",
    });

    supply += newBtc;
    reward  = reward / 2;
    if (reward < 2e-8) reward = 0;   // below 1 satoshi (1e-8 BTC) → protocol rounds to 0
  }
  return epochs;
}

export function buildRenewableTransition(): RenewableTransition & { hash: string } {
  const r = {
    current_renewable_pct: 54.5,  // Cambridge Centre for Alternative Finance, 2024
    trajectory:
      "Bitcoin mining renewable share has grown from ~25% (2019) → ~54.5% (2024). " +
      "Structural incentives guarantee continued growth: renewables produce the cheapest electricity " +
      "at scale, and miners are the only industrial buyer that can relocate to the energy source.",
    why_bitcoin_goes_green: [
      "Miners are location-agnostic — they move to where electricity is cheapest, which is usually stranded renewables",
      "Renewable electricity has near-zero marginal cost once infrastructure is built — ideal for miners",
      "Bitcoin miners are the only interruptible load that can be profitable at any electricity price above zero",
      "Stranded hydro, geothermal, solar curtailment, and wind curtailment are monetized only by Bitcoin mining",
      "Hash rate follows cheap electrons globally — coal plants in China replaced by renewables in Iceland, Norway, Paraguay",
      "Mining companies issue sustainability reports and attract ESG capital — market incentive to go green",
    ],
    stranded_energy:
      "Stranded energy (curtailed renewables, remote hydro, flared gas) represents ~$30B/year globally " +
      "of wasted energy that cannot be transported or stored. Bitcoin mining monetizes this stranded energy " +
      "with zero additional infrastructure. A 100MW solar farm in the Atacama with no grid connection " +
      "can run Bitcoin miners profitably — the internet IS the grid.",
    grid_stabilization:
      "Bitcoin miners can be instantly curtailed (within milliseconds via software). " +
      "This makes them the ideal demand-response load for grid operators. " +
      "ERCOT (Texas grid) uses Bitcoin miners to absorb excess wind power and prevent grid overload. " +
      "Bitcoin mining is becoming a grid-stabilization tool — not a grid threat.",
    comparison: [
      { industry: "Bitcoin mining",          renewable_pct: 54.5 },
      { industry: "Global electricity mix",  renewable_pct: 30.0 },
      { industry: "Aluminium smelting",      renewable_pct: 48.0 },
      { industry: "Data centers (average)",  renewable_pct: 35.0 },
      { industry: "Gold mining",             renewable_pct: 12.0 },
      { industry: "Traditional banking",     renewable_pct: 22.0 },
    ],
    hash: "",
  };
  (r as Record<string, unknown>).hash = sha256(JSON.stringify(r));
  return r as RenewableTransition & { hash: string };
}

export function buildEnergyValueTheory(): EnergyValueTheory & { hash: string } {
  const r = {
    thesis:
      "Energy is the only objective measure of value in the physical universe. " +
      "All other value measures (gold, dollars, reputation) are socially constructed and therefore " +
      "subject to manipulation. Energy expenditure, governed by the laws of thermodynamics, " +
      "is the one thing that cannot be faked, inflated, or politically adjusted.",
    landauer_axiom:
      "Landauer's principle makes information physically real: creating or erasing information costs energy. " +
      "Bitcoin's blockchain IS information. Its creation cost is therefore thermodynamically grounded. " +
      "This is not true of any other monetary system.",
    pow_as_money:
      "Proof of Work is the first monetary system where the creation cost equals the thermodynamic " +
      "cost of the information it represents. One satoshi of purchasing power requires one satoshi " +
      "of mining cost to create. This 1:1 relationship between energy and value is unique in monetary history.",
    fiat_energy_cost:
      "Creating $1 trillion USD: ~$50,000 in server electricity (Fed wire transfers). " +
      "Energy cost as fraction of face value: 0.000000005%. " +
      "This means $1T can be created essentially for free by the issuer, " +
      "while costing real purchasing power to holders (inflation).",
    gold_energy_cost:
      "Mining 1 troy oz of gold: ~20 kWh electricity + heavy machinery + labor ≈ $1,200 all-in. " +
      "At $2,000/oz spot, cost-to-value ratio: ~60%. " +
      "Better than fiat but: cannot be audited without assay, cannot be transmitted digitally, " +
      "supply schedule unknown (new deposits may be discovered), storage is costly.",
    btc_energy_cost:
      "Mining 1 BTC: ~150,000 kWh at current difficulty (2025). " +
      "At $60,000/BTC and $0.05/kWh: mining cost ≈ $7,500. " +
      "Cost-to-market ratio: ~12.5% (healthy competitive margin). " +
      "Auditable on-chain, transmitted at near-zero cost, supply schedule is perfectly known, " +
      "storage cost: one private key (free).",
    why_energy_is_fair:
      "Energy is the universal currency of physics. A joule is a joule in Caracas, Beijing, " +
      "or New York. It cannot be printed, confiscated by decree, or inflated. " +
      "A monetary standard based on energy expenditure is equally fair to every participant — " +
      "rich or poor, powerful or weak, North or South.",
    nash_validation:
      "Nash (2002): 'Ideally the value of money should be based on the purchasing power over " +
      "a standardised basket of commodities.' Bitcoin's energy cost IS this basket — " +
      "it comprises electricity, silicon, cooling, bandwidth, and capital. " +
      "Nash's ideal money has been implemented in code.",
    satoshi_validation:
      "Satoshi (2008): 'The cost of production of a commodity puts a lower bound on its price.' " +
      "Bitcoin mining cost is the floor. The market sets the ceiling. " +
      "The spread is miners' profit margin — the same economics as gold, but digital.",
    hash: "",
  };
  (r as Record<string, unknown>).hash = sha256(JSON.stringify(r));
  return r as EnergyValueTheory & { hash: string };
}

export function buildBitcoinEnergyComplete(): BitcoinEnergyComplete {
  const landauer      = buildLandauerAnalysis();
  const thermodynamics = buildProofOfWorkThermodynamics();
  const icpi          = buildIcpiEquivalence();
  const security      = buildEnergySecurityModel();
  const epochs        = buildMiningEpochs();
  const renewable     = buildRenewableTransition();
  const theory        = buildEnergyValueTheory();

  const deepest_truth =
    "Bitcoin is the first monetary system constrained by the laws of thermodynamics. " +
    "Landauer proved information has energy cost. Shannon unified entropy and information. " +
    "Szilard showed Maxwell's Demon must pay. Satoshi implemented all three in code. " +
    "Nash showed ideal money needs an objective anchor. Bitcoin's energy expenditure IS that anchor. " +
    "The arrow of time protects the ledger. Physics, not politics, governs the supply. " +
    "This is not a feature — it is the deepest design decision in monetary history.";

  const payload = { landauer, thermodynamics, icpi, security, epoch_count: epochs.length, renewable, theory, deepest_truth };
  const hash    = sha256(JSON.stringify(payload));

  return { landauer, thermodynamics, icpi_equivalence: icpi, security_model: security, mining_epochs: epochs, renewable, energy_value_theory: theory, the_deepest_truth: deepest_truth, hash };
}
