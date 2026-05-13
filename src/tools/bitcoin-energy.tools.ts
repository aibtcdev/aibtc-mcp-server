/**
 * Bitcoin Energy Tools — أدوات طاقة Bitcoin
 * The deepest layer: thermodynamics, Landauer, Nash ICPI, Proof of Work as physics.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildLandauerAnalysis,
  buildProofOfWorkThermodynamics,
  buildIcpiEquivalence,
  buildEnergySecurityModel,
  buildMiningEpochs,
  buildRenewableTransition,
  buildEnergyValueTheory,
  buildBitcoinEnergyComplete,
} from "../services/bitcoin-energy-engine.js";

export function registerBitcoinEnergyTools(server: McpServer): void {

  server.registerTool(
    "btc_landauer",
    {
      title: "Bitcoin Landauer Analysis",
      description:
        "Landauer's principle applied to Bitcoin: why Proof of Work is thermodynamically grounded. " +
        "Shows the physical minimum energy per hash, actual ASIC efficiency, and why valid hashes cannot be counterfeited.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildLandauerAnalysis(), null, 2) }] })
  );

  server.registerTool(
    "btc_pow_thermodynamics",
    {
      title: "Proof of Work Thermodynamics",
      description:
        "Deep analysis of Proof of Work as a thermodynamic arrow-of-time stamp. " +
        "Covers Szilard's demon, Maxwell's demon, entropy, and why Bitcoin defeated the central bank demon.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildProofOfWorkThermodynamics(), null, 2) }] })
  );

  server.registerTool(
    "btc_icpi_equivalence",
    {
      title: "Bitcoin as Nash ICPI",
      description:
        "Shows how Bitcoin's mining cost IS Nash's Industrial Consumption Price Index (ICPI). " +
        "The DAA replaces Nash's committee with math. The miracle energy problem is solved.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildIcpiEquivalence(), null, 2) }] })
  );

  server.registerTool(
    "btc_energy_security",
    {
      title: "Bitcoin Energy Security Model",
      description:
        "Security analysis: cost of 51% attack, annual TWh vs. comparable systems, " +
        "security-per-dollar, and why energy expenditure is the security budget.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildEnergySecurityModel(), null, 2) }] })
  );

  server.registerTool(
    "btc_mining_epochs",
    {
      title: "Bitcoin Mining Epochs (1-33)",
      description:
        "Full halving schedule from genesis (2009) to final epoch (2140). " +
        "Shows block reward, inflation, fee transition, and energy cost floor for each epoch.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildMiningEpochs(), null, 2) }] })
  );

  server.registerTool(
    "btc_renewable_transition",
    {
      title: "Bitcoin Renewable Energy Transition",
      description:
        "Analysis of Bitcoin mining's shift to renewable energy: current 54.5% renewable share, " +
        "structural incentives, stranded energy monetization, and grid stabilization role.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildRenewableTransition(), null, 2) }] })
  );

  server.registerTool(
    "btc_energy_value_theory",
    {
      title: "Bitcoin Energy-Value Theory",
      description:
        "The deepest layer: why energy is the only objective value anchor in the universe. " +
        "Compares fiat, gold, and Bitcoin energy costs. Validates Nash and Satoshi quotes.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildEnergyValueTheory(), null, 2) }] })
  );

  server.registerTool(
    "btc_energy_complete",
    {
      title: "Bitcoin Energy — Complete Analysis",
      description:
        "The complete Bitcoin energy synthesis: Landauer + thermodynamics + Nash ICPI + " +
        "security model + halving epochs + renewable transition + energy-value theory. " +
        "The deepest understanding of why Bitcoin's energy expenditure is not waste — it IS the value.",
    },
    async () => ({ content: [{ type: "text" as const, text: JSON.stringify(buildBitcoinEnergyComplete(), null, 2) }] })
  );
}
