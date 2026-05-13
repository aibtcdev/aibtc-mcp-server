/**
 * Sovereign Commons Engine
 *
 * Each nation keeps full sovereignty.
 * Humanity shares the commons.
 * The result: explosive prosperity + environmental healing + jobs for all.
 *
 * Three layers:
 *   Sovereignty   — nation controls its money, laws, culture, resources
 *   Commons       — atmosphere, oceans, biodiversity, knowledge belong to ALL
 *   Bridge        — sound money connects both without erasing either
 *
 * The equation:
 *   National Sovereignty × Global Commons Dividend = Universal Prosperity
 */

import { createHash } from "crypto";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SovereignProfile {
  nation:              string;
  population:          number;
  gdp_usd:             number;
  sovereignty_score:   number;      // 0-100
  monetary_control:    number;      // 0-100
  resource_control:    number;      // 0-100
  cultural_index:      number;      // 0-100
  commons_contribution: number;     // USD/year they add to global commons
  commons_dividend:    number;      // USD/year they receive from global commons
  net_commons_flow:    number;      // positive = net receiver, negative = net contributor
  annual_jobs_created: number;
  hash:                string;
}

export interface GlobalCommons {
  atmosphere:   CommonsAsset;
  oceans:       CommonsAsset;
  biodiversity: CommonsAsset;
  knowledge:    CommonsAsset;
  spectrum:     CommonsAsset;
  space:        CommonsAsset;
  total_annual_value_usd: number;
  per_human_dividend_usd: number;   // if distributed equally to 8B people
  current_depletion_rate: number;   // % per year being depleted
  restoration_rate:       number;   // % per year being restored
  hash:                   string;
}

export interface CommonsAsset {
  name:              string;
  total_value_usd:   number;        // annual economic value
  current_use_fee:   number;        // what's currently charged
  fair_fee:          number;        // what should be charged
  annual_gap:        number;        // uncaptured commons rent
  jobs_in_restoration: number;      // jobs if we restore this
}

export interface EconomicRevival {
  economy:             string;
  current_gdp:         number;
  revival_gdp_10y:     number;      // projected GDP in 10 years
  growth_multiplier:   number;
  drivers:             RevivalDriver[];
  jobs_created:        number;
  environmental_score_change: number; // +/- points
  hash:                string;
}

export interface RevivalDriver {
  sector:      string;
  mechanism:   string;
  gdp_boost:   number;    // USD
  jobs:        number;
  environment: "positive" | "neutral" | "requires_management";
}

export interface EnvironmentalPlan {
  planet_health_score:    number;   // 0-100 current
  target_score_50y:       number;   // target in 50 years
  annual_commons_revenue: number;   // from global commons fees
  restoration_projects:   RestorationProject[];
  jobs_created_global:    number;
  carbon_reduction_gt:    number;   // gigatons CO2 reduced over 50y
  species_protected:      number;
  ocean_restored_pct:     number;
  forest_restored_mha:    number;   // million hectares
  hash:                   string;
}

export interface RestorationProject {
  name:          string;
  scale:         string;
  cost_usd:      number;    // annual
  jobs:          number;
  impact:        string;
  funded_by:     string;
}

export interface UniversalEmployment {
  global_workforce:      number;    // billion
  currently_unemployed:  number;    // billion
  new_jobs_commons:      number;    // billion — from commons restoration
  new_jobs_digital:      number;    // billion — from open digital economy
  new_jobs_care:         number;    // billion — education, health, elderly
  new_jobs_innovation:   number;    // billion — science, research
  total_new_jobs:        number;    // billion
  commons_dividend_usd:  number;    // per person per year (floor income)
  hash:                  string;
}

// ── Global Commons Values (2024 research estimates) ──────────────────────────

const WORLD_POPULATION = 8_100_000_000;

function buildGlobalCommons(): Omit<GlobalCommons, "hash"> {
  const atmosphere: CommonsAsset = {
    name:              "Atmosphere / Climate Stability",
    total_value_usd:   54_000_000_000_000,  // $54T/year (Stern review)
    current_use_fee:   50_000_000_000,       // $50B actual carbon pricing globally
    fair_fee:          2_700_000_000_000,    // $2.7T at $50/tonne fair price
    annual_gap:        2_650_000_000_000,
    jobs_in_restoration: 85_000_000,
  };

  const oceans: CommonsAsset = {
    name:              "Oceans / Marine Ecosystems",
    total_value_usd:   24_000_000_000_000,  // $24T/year
    current_use_fee:   10_000_000_000,
    fair_fee:          800_000_000_000,
    annual_gap:        790_000_000_000,
    jobs_in_restoration: 40_000_000,
  };

  const biodiversity: CommonsAsset = {
    name:              "Biodiversity / Forests / Soil",
    total_value_usd:   33_000_000_000_000,  // $33T/year
    current_use_fee:   5_000_000_000,
    fair_fee:          1_000_000_000_000,
    annual_gap:        995_000_000_000,
    jobs_in_restoration: 120_000_000,
  };

  const knowledge: CommonsAsset = {
    name:              "Knowledge / Internet / Open Science",
    total_value_usd:   15_000_000_000_000,  // $15T/year
    current_use_fee:   0,
    fair_fee:          300_000_000_000,      // spectrum, domain, data fees
    annual_gap:        300_000_000_000,
    jobs_in_restoration: 50_000_000,
  };

  const spectrum: CommonsAsset = {
    name:              "Radio Spectrum / Orbital Slots",
    total_value_usd:   1_500_000_000_000,
    current_use_fee:   50_000_000_000,
    fair_fee:          600_000_000_000,
    annual_gap:        550_000_000_000,
    jobs_in_restoration: 5_000_000,
  };

  const space: CommonsAsset = {
    name:              "Near-Earth Orbit / Moon / Asteroids",
    total_value_usd:   10_000_000_000_000,
    current_use_fee:   0,
    fair_fee:          200_000_000_000,
    annual_gap:        200_000_000_000,
    jobs_in_restoration: 2_000_000,
  };

  const total = atmosphere.fair_fee + oceans.fair_fee + biodiversity.fair_fee +
    knowledge.fair_fee + spectrum.fair_fee + space.fair_fee;

  return {
    atmosphere,
    oceans,
    biodiversity,
    knowledge,
    spectrum,
    space,
    total_annual_value_usd: total,
    per_human_dividend_usd: Math.round(total / WORLD_POPULATION),
    current_depletion_rate: 2.3,
    restoration_rate:       0.4,
  };
}

export function computeGlobalCommons(): GlobalCommons {
  const commons = buildGlobalCommons();
  const hash = createHash("sha256")
    .update(`commons:global:${commons.total_annual_value_usd}:${Date.now()}`)
    .digest("hex");
  return { ...commons, hash };
}

// ── Sovereign Profile ─────────────────────────────────────────────────────────

export function computeSovereignProfile(params: {
  nation:            string;
  population:        number;
  gdp_usd:           number;
  has_sound_money:   boolean;
  resource_wealth:   "low" | "medium" | "high" | "exceptional";
  cultural_strength: "low" | "medium" | "high";
  commons_use:       "minimal" | "moderate" | "heavy";  // how much commons they consume
}): SovereignProfile {
  const { nation, population, gdp_usd, has_sound_money,
          resource_wealth, cultural_strength, commons_use } = params;

  const monetary_control  = has_sound_money ? 90 : 55;
  const resource_map      = { low: 30, medium: 55, high: 75, exceptional: 95 };
  const resource_control  = resource_map[resource_wealth];
  const cultural_map      = { low: 40, medium: 65, high: 90 };
  const cultural_index    = cultural_map[cultural_strength];
  const sovereignty_score = Math.round((monetary_control + resource_control + cultural_index) / 3);

  // Commons contribution: based on GDP (wealthy nations use + pay more)
  const commons_use_factor = { minimal: 0.005, moderate: 0.012, heavy: 0.025 };
  const commons_contribution = gdp_usd * commons_use_factor[commons_use];

  // Commons dividend: per-capita share of global commons revenue ($712/person/year)
  const per_capita_dividend = 712;
  const commons_dividend    = population * per_capita_dividend;
  const net_commons_flow    = commons_dividend - commons_contribution;

  // Jobs: sound money + commons dividend creates local demand
  const job_multiplier = has_sound_money ? 0.08 : 0.04;
  const annual_jobs    = Math.round(population * job_multiplier);

  const hash = createHash("sha256")
    .update(`sovereign:${nation}:${sovereignty_score}:${Date.now()}`)
    .digest("hex");

  return {
    nation,
    population,
    gdp_usd,
    sovereignty_score,
    monetary_control,
    resource_control,
    cultural_index,
    commons_contribution: Math.round(commons_contribution),
    commons_dividend:     Math.round(commons_dividend),
    net_commons_flow:     Math.round(net_commons_flow),
    annual_jobs_created:  annual_jobs,
    hash,
  };
}

// ── Economic Revival ──────────────────────────────────────────────────────────

export function computeEconomicRevival(params: {
  economy:          string;
  population:       number;
  current_gdp:      number;
  has_sound_money:  boolean;
  commons_dividend: number;   // annual USD flowing in from commons
  natural_resources: boolean;
  tech_capacity:    "low" | "medium" | "high";
}): EconomicRevival {
  const { economy, population, current_gdp, has_sound_money,
          commons_dividend, natural_resources, tech_capacity } = params;

  const tech_map = { low: 1.15, medium: 1.35, high: 1.65 };

  const drivers: RevivalDriver[] = [
    {
      sector:      "Sound Money Savings",
      mechanism:   "No inflation tax → people save → capital pools → investment rises",
      gdp_boost:   current_gdp * (has_sound_money ? 0.12 : 0),
      jobs:        Math.round(population * 0.015),
      environment: "neutral",
    },
    {
      sector:      "Commons Dividend Spending",
      mechanism:   `$${(commons_dividend/1e9).toFixed(1)}B flows to every citizen → local demand explodes`,
      gdp_boost:   commons_dividend * 1.7,  // Keynesian multiplier
      jobs:        Math.round(population * 0.03),
      environment: "positive",
    },
    {
      sector:      "Restoration Economy",
      mechanism:   "Forests, oceans, soil restoration — paid by commons fees",
      gdp_boost:   commons_dividend * 0.4,
      jobs:        Math.round(population * 0.02),
      environment: "positive",
    },
    {
      sector:      "Open Knowledge Economy",
      mechanism:   "Free access to global knowledge → anyone can build → innovation everywhere",
      gdp_boost:   current_gdp * 0.08 * tech_map[tech_capacity],
      jobs:        Math.round(population * 0.025),
      environment: "neutral",
    },
    {
      sector:      "Care Economy",
      mechanism:   "Commons revenue funds universal health, education, elderly care",
      gdp_boost:   commons_dividend * 0.3,
      jobs:        Math.round(population * 0.04),
      environment: "neutral",
    },
    ...(natural_resources ? [{
      sector:      "Resource Sovereignty",
      mechanism:   "Nation owns and manages its own resources → keeps full rent",
      gdp_boost:   current_gdp * 0.15,
      jobs:        Math.round(population * 0.02),
      environment: "requires_management" as const,
    }] : []),
  ];

  const total_boost     = drivers.reduce((s, d) => s + d.gdp_boost, 0);
  const total_jobs      = drivers.reduce((s, d) => s + d.jobs, 0);
  const revival_gdp_10y = (current_gdp + total_boost) * Math.pow(1.06, 10); // 6%/y compound

  const hash = createHash("sha256")
    .update(`revival:${economy}:${revival_gdp_10y}:${Date.now()}`)
    .digest("hex");

  return {
    economy,
    current_gdp,
    revival_gdp_10y: Math.round(revival_gdp_10y),
    growth_multiplier: parseFloat((revival_gdp_10y / current_gdp).toFixed(2)),
    drivers,
    jobs_created: total_jobs,
    environmental_score_change: +18,
    hash,
  };
}

// ── Environmental Plan ────────────────────────────────────────────────────────

export function computeEnvironmentalPlan(annual_commons_revenue: number): EnvironmentalPlan {
  const projects: RestorationProject[] = [
    {
      name:      "Global Reforestation",
      scale:     "1 trillion trees / 800M hectares",
      cost_usd:  300_000_000_000,
      jobs:      120_000_000,
      impact:    "Absorbs 200Gt CO2 over 50 years, restores rainfall cycles",
      funded_by: "Biodiversity commons fee",
    },
    {
      name:      "Ocean Plastic & Dead Zone Cleanup",
      scale:     "100% of major ocean gyres",
      cost_usd:  80_000_000_000,
      jobs:      40_000_000,
      impact:    "Restores 30% ocean productivity, revives fisheries",
      funded_by: "Ocean commons fee",
    },
    {
      name:      "Clean Energy Transition",
      scale:     "100% renewable electricity by 2050",
      cost_usd:  500_000_000_000,
      jobs:      85_000_000,
      impact:    "Eliminates 34Gt CO2/year by 2050",
      funded_by: "Atmosphere (carbon) commons fee",
    },
    {
      name:      "Soil Restoration & Regenerative Agriculture",
      scale:     "2 billion hectares degraded land",
      cost_usd:  120_000_000_000,
      jobs:      200_000_000,
      impact:    "Feeds 10B people sustainably, sequesters 3Gt CO2/year",
      funded_by: "Biodiversity commons fee",
    },
    {
      name:      "Universal Clean Water",
      scale:     "100% access for 8B people",
      cost_usd:  50_000_000_000,
      jobs:      10_000_000,
      impact:    "Eliminates 1.5M deaths/year from waterborne disease",
      funded_by: "Shared commons dividend — direct allocation",
    },
    {
      name:      "Biodiversity Corridors",
      scale:     "30% of land under protection by 2030",
      cost_usd:  100_000_000_000,
      jobs:      30_000_000,
      impact:    "Halts 6th mass extinction, protects 1M+ species",
      funded_by: "Biodiversity commons fee",
    },
  ];

  const total_cost = projects.reduce((s, p) => s + p.cost_usd, 0);
  const total_jobs = projects.reduce((s, p) => s + p.jobs, 0);
  const funded_pct = Math.min(100, (annual_commons_revenue / total_cost) * 100);

  const hash = createHash("sha256")
    .update(`environment:${total_cost}:${Date.now()}`)
    .digest("hex");

  return {
    planet_health_score:    38,    // current (based on Planetary Boundaries)
    target_score_50y:       72,    // achievable with this plan
    annual_commons_revenue,
    restoration_projects:   projects,
    jobs_created_global:    total_jobs,
    carbon_reduction_gt:    320,   // gigatons over 50 years
    species_protected:      1_000_000,
    ocean_restored_pct:     40,
    forest_restored_mha:    800,
    hash,
  };
}

// ── Universal Employment ──────────────────────────────────────────────────────

export function computeUniversalEmployment(): UniversalEmployment {
  const global_workforce      = 3.5e9;
  const currently_unemployed  = 0.7e9;   // ~20% underemployed + unemployed

  // New jobs from each sector (billions)
  const jobs_commons   = 0.485e9;  // reforestation, ocean, soil, clean energy, water
  const jobs_digital   = 0.200e9;  // open internet, open source, digital infrastructure
  const jobs_care      = 0.350e9;  // teachers, nurses, doctors, elderly care (unfunded today)
  const jobs_innovation = 0.050e9; // scientists, researchers, engineers

  const total_new = jobs_commons + jobs_digital + jobs_care + jobs_innovation;

  // Commons dividend = floor income
  // Global commons fair fees = ~$5.6T/year ÷ 8.1B people = $691/person/year
  const commons_dividend = 691;

  const hash = createHash("sha256")
    .update(`employment:global:${total_new}:${Date.now()}`)
    .digest("hex");

  return {
    global_workforce,
    currently_unemployed,
    new_jobs_commons:   jobs_commons,
    new_jobs_digital:   jobs_digital,
    new_jobs_care:      jobs_care,
    new_jobs_innovation: jobs_innovation,
    total_new_jobs:     total_new,
    commons_dividend_usd: commons_dividend,
    hash,
  };
}
