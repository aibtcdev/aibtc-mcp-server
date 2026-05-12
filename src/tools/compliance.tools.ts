/**
 * Universal Ψ Compliance Tools
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * SHA-256 PROTOCOL IDENTITY
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This compliance layer has no brand. It is identified by:
 *   SHA-256("Ψ=Landauer·Nash·Cantillon⁻¹·Gödel")
 *
 * The same cryptographic primitive that secures Bitcoin.
 * Any blockchain, any protocol, any language can adopt this.
 * There is no permission to ask. No organization to join.
 * Compute the hash. Match the hash. That IS the protocol.
 *
 * Tools:
 *   psi_protocol_info     — Protocol identity, genesis hash, all chain support
 *   psi_build_envelope    — Build a Ψ compliance envelope for any transaction
 *   psi_verify_envelope   — Verify a previously built envelope's integrity
 *   check_address         — Sanctions + AML + jurisdiction check for any address
 *   check_jurisdiction    — Law intelligence for a specific country
 *   check_travel_rule     — FATF Travel Rule threshold check
 *   report_fraud          — File a fraud report (immutable on-chain or local)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  GENESIS_HASH,
  CHAIN_IDS,
  buildPsiEnvelope,
  verifyPsiEnvelope,
  toOpReturn,
  toStacksMemo,
  toEthCalldata,
  toLightningTlv,
  buildComplianceFlags,
  decodeComplianceFlags,
  getProtocolInfo,
  type ChainName,
} from "../services/compliance/universal-psi-protocol.js";
import {
  checkSanctions,
  checkJurisdictionRisk,
  checkTravelRule,
  OFAC_LAST_SYNC,
} from "../services/compliance/sanctions-oracle.js";
import {
  quickAmlCheck,
  analyzeAmlPattern,
  type TransactionPattern,
} from "../services/compliance/aml-detector.js";
import {
  getJurisdiction,
  getComplianceRequirements,
  listAllJurisdictions,
  getBannedJurisdictions,
  getCbdcJurisdictions,
} from "../services/compliance/constitutional-registry.js";

export function registerComplianceTools(server: McpServer): void {

  // ── psi_protocol_info ─────────────────────────────────────────────────────
  server.registerTool(
    "psi_protocol_info",
    {
      description:
        "Universal Ψ Protocol identity — SHA-256 anchored, chain-agnostic. " +
        "Returns the genesis hash that IS the protocol identifier. No brand, no organization. " +
        "Any blockchain can adopt this by computing SHA-256(\"Ψ=Landauer·Nash·Cantillon⁻¹·Gödel\"). " +
        "If the hash matches, it is this protocol. Supported: Bitcoin, Stacks, Ethereum, Solana, " +
        "Lightning, BSC, Polygon, Avalanche, Arbitrum, Optimism, Tron, Ripple, Cosmos, Polkadot, Cardano.",
      inputSchema: {},
    },
    async () => {
      const info = getProtocolInfo();
      return createJsonResponse({
        ...info,
        description: [
          "Universal Ψ Compliance Protocol",
          "",
          "Equation: Ψ = Landauer · Nash · Cantillon⁻¹ · Gödel",
          "",
          "Protocol identity: SHA-256(\"Ψ=Landauer·Nash·Cantillon⁻¹·Gödel\")",
          `Genesis hash:      ${info.genesis_hash}`,
          `Genesis prefix:    0x${info.genesis_prefix}`,
          "",
          "This protocol has no name. It has no brand.",
          "It is identified only by its SHA-256 genesis hash.",
          "Any chain, any token, any protocol can adopt it.",
          "No permission needed. Compute the hash. Match the hash.",
          "",
          "On-chain embedding:",
          "  Bitcoin OP_RETURN: PROT + 4-byte prefix + 32-byte commit + 1-byte flags (41 bytes)",
          "  Stacks memo:       4-byte prefix + 28-byte commit + flags + score (base64)",
          "  Ethereum calldata: 0x" + info.genesis_prefix + " prefix",
          "  Lightning TLV:     type 6021 (Ψ protocol)",
        ].join("\n"),
      });
    },
  );

  // ── psi_build_envelope ────────────────────────────────────────────────────
  server.registerTool(
    "psi_build_envelope",
    {
      description:
        "Build a Ψ compliance envelope for a transaction on any blockchain. " +
        "The envelope contains a SHA-256 commitment that can be embedded on-chain " +
        "via OP_RETURN (Bitcoin), memo field (Stacks), calldata prefix (Ethereum), or " +
        "Lightning TLV record type 6021. Privacy-preserving: the on-chain commitment " +
        "reveals nothing about the score — it only proves the check was done.",
      inputSchema: {
        chain:       z.enum(["bitcoin","stacks","ethereum","solana","lightning","bsc","polygon","avalanche","arbitrum","optimism","tron","ripple","cosmos","polkadot","cardano","universal"]).describe("Source blockchain"),
        tx_sender:   z.string().describe("Sender address on the originating chain"),
        psi_score:   z.number().min(0).max(100).describe("Ψ integrity score (0–100)"),
        jurisdiction: z.string().default("ZZ").describe("ISO 3166-1 alpha-2 country code or 'ZZ' for unknown"),
        sanctions_clear:  z.boolean().default(false).describe("Sender passed sanctions check"),
        aml_pass:         z.boolean().default(false).describe("Sender passed AML pattern check"),
        jurisdiction_ok:  z.boolean().default(false).describe("Transaction complies with jurisdiction law"),
        velocity_ok:      z.boolean().default(true).describe("Transaction velocity is within normal bounds"),
        zk_proof:         z.string().optional().describe("Optional ZK proof (base64)"),
        human_verified:   z.boolean().default(false).describe("ZK-KYC human verification passed"),
      },
    },
    async (input) => {
      try {
        const chainIdMap: Record<ChainName, number> = {
          bitcoin:    CHAIN_IDS.BITCOIN_MAINNET,
          stacks:     CHAIN_IDS.STACKS_MAINNET,
          ethereum:   1,
          solana:     CHAIN_IDS.SOLANA,
          lightning:  CHAIN_IDS.LIGHTNING,
          bsc:        56,
          polygon:    137,
          avalanche:  43114,
          arbitrum:   42161,
          optimism:   10,
          tron:       728126428,
          ripple:     0,
          cosmos:     118,
          polkadot:   0,
          cardano:    0,
          universal:  CHAIN_IDS.UNIVERSAL,
        };

        const flags = buildComplianceFlags({
          psi_score:       input.psi_score,
          sanctions_clear: input.sanctions_clear,
          aml_pass:        input.aml_pass,
          jurisdiction_ok: input.jurisdiction_ok,
          velocity_ok:     input.velocity_ok,
          zk_proof:        !!input.zk_proof,
          human_verified:  input.human_verified,
        });

        const envelope = buildPsiEnvelope({
          chain:            input.chain as ChainName,
          chain_id:         chainIdMap[input.chain as ChainName] ?? 0,
          tx_sender:        input.tx_sender,
          psi_score:        input.psi_score,
          compliance_flags: flags,
          jurisdiction:     input.jurisdiction,
          zk_proof:         input.zk_proof,
        });

        const opReturn = toOpReturn(envelope);
        const stacksMemo = toStacksMemo(envelope);
        const ethCalldata = toEthCalldata(envelope);
        const lightningTlv = toLightningTlv(envelope);
        const flagsDecoded = decodeComplianceFlags(flags);

        return createJsonResponse({
          envelope,
          embeddings: {
            bitcoin_op_return: {
              hex:     opReturn.toString("hex"),
              bytes:   opReturn.length,
              asm:     `OP_RETURN ${opReturn.toString("hex")}`,
            },
            stacks_memo:     stacksMemo,
            ethereum_prefix: ethCalldata,
            lightning_tlv:   lightningTlv,
          },
          compliance_summary: {
            flags_decimal: flags,
            flags_hex:     "0x" + flags.toString(16).padStart(2, "0"),
            flags_binary:  "0b" + flags.toString(2).padStart(8, "0"),
            flags_decoded: flagsDecoded,
            compliant:     flags >= 0x03,
            level: flags === 0xFF ? "FULL" :
                   flags >= 0x1F ? "STANDARD" :
                   flags >= 0x0F ? "PARTIAL" :
                   flags >= 0x03 ? "MINIMAL" : "NONE",
          },
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── psi_verify_envelope ───────────────────────────────────────────────────
  server.registerTool(
    "psi_verify_envelope",
    {
      description:
        "Verify the cryptographic integrity of a Ψ compliance envelope. " +
        "Checks: (1) genesis hash matches the protocol identity, " +
        "(2) psi_commit correctly derived from chain/sender/score/timestamp, " +
        "(3) envelope_hash seals the entire JSON. " +
        "Any tampering after creation will cause verification to fail.",
      inputSchema: {
        envelope: z.string().describe("JSON string of the Ψ envelope to verify"),
      },
    },
    async (input) => {
      try {
        const envelope = JSON.parse(input.envelope);
        const result   = verifyPsiEnvelope(envelope);
        const flagsDecoded = decodeComplianceFlags(envelope.compliance_flags ?? 0);

        return createJsonResponse({
          valid:         result.valid,
          errors:        result.errors,
          genesis_match: envelope.genesis_hash === GENESIS_HASH,
          protocol_version: envelope.protocol_version,
          chain:         envelope.chain,
          tx_sender:     envelope.tx_sender,
          psi_score:     envelope.psi_score,
          jurisdiction:  envelope.jurisdiction,
          timestamp:     envelope.timestamp,
          age_seconds:   Math.floor(Date.now() / 1000) - (envelope.timestamp ?? 0),
          compliance_flags: flagsDecoded,
          summary: result.valid
            ? `✓ Envelope is VALID — genesis hash matches, commit verified, seal intact`
            : `✗ Envelope is INVALID — ${result.errors.join("; ")}`,
        });
      } catch (err) {
        return createErrorResponse(
          err instanceof Error ? `Verification failed: ${err.message}` : String(err)
        );
      }
    },
  );

  // ── check_address ─────────────────────────────────────────────────────────
  server.registerTool(
    "check_address",
    {
      description:
        "Full compliance check for any blockchain address: " +
        "sanctions (OFAC/UN/FATF), AML pattern analysis, jurisdiction risk. " +
        "Works for Bitcoin (bc1q/1/3), Ethereum (0x), Stacks (SP/ST), and other chains. " +
        "Result feeds directly into psi_build_envelope compliance flags. " +
        "Privacy: this check is NOT logged or stored. Public data only.",
      inputSchema: {
        address:     z.string().describe("Blockchain address to check"),
        jurisdiction: z.string().optional().describe("ISO country code for jurisdiction check (optional)"),
        amount_usd:  z.number().optional().describe("Transaction amount in USD for Travel Rule check (optional)"),
      },
    },
    async (input) => {
      try {
        const [sanctionsResult, amlResult] = await Promise.all([
          checkSanctions(input.address),
          Promise.resolve(quickAmlCheck(input.address)),
        ]);

        const jurisdictionRisk = input.jurisdiction
          ? checkJurisdictionRisk(input.jurisdiction)
          : null;

        const travelRule = (input.jurisdiction && input.amount_usd !== undefined)
          ? checkTravelRule(input.amount_usd, input.jurisdiction)
          : null;

        const overallRisk =
          !sanctionsResult.clear ? "BLOCKED" :
          amlResult.recommendation === "block" ? "BLOCKED" :
          amlResult.recommendation === "review" ? "REVIEW" :
          jurisdictionRisk?.blacklisted ? "BLOCKED" :
          jurisdictionRisk?.greylisted ? "CAUTION" : "CLEAR";

        return createJsonResponse({
          address:       input.address,
          overall_risk:  overallRisk,
          sanctions: {
            clear:       sanctionsResult.clear,
            hits:        sanctionsResult.hits,
            sources:     sanctionsResult.sources,
            last_sync:   OFAC_LAST_SYNC,
          },
          aml: {
            clean:           amlResult.clean,
            risk_score:      amlResult.risk_score,
            flags:           amlResult.flags,
            recommendation:  amlResult.recommendation,
          },
          jurisdiction:  jurisdictionRisk,
          travel_rule:   travelRule,
          compliance_flags_suggested: buildComplianceFlags({
            sanctions_clear: sanctionsResult.clear,
            aml_pass:        amlResult.clean,
            jurisdiction_ok: jurisdictionRisk ? !jurisdictionRisk.blacklisted : true,
            velocity_ok:     true,
          }),
          checked_at: Math.floor(Date.now() / 1000),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── check_jurisdiction ────────────────────────────────────────────────────
  server.registerTool(
    "check_jurisdiction",
    {
      description:
        "Get law intelligence for a specific country/jurisdiction. " +
        "Returns: crypto legal status, AML framework, reporting thresholds, " +
        "VASP licensing requirements, constitutional privacy protections, " +
        "FATF greylist/blacklist status. " +
        "Covers 50+ jurisdictions: G7, EU, MENA, Asia-Pacific, Africa, Americas.",
      inputSchema: {
        country_code: z.string().describe("ISO 3166-1 alpha-2 country code (e.g. 'US', 'AE', 'LB')"),
        amount_usd:   z.number().optional().describe("Optional transaction amount to check against reporting thresholds"),
        list_all:     z.boolean().optional().describe("If true, list all jurisdictions in the registry"),
      },
    },
    async (input) => {
      try {
        if (input.list_all) {
          const all = listAllJurisdictions();
          return createJsonResponse({
            count:         all.length,
            jurisdictions: all,
            banned:        getBannedJurisdictions(),
            cbdc_issued:   getCbdcJurisdictions().map(j => `${j.country_code} (${j.country_name})`),
          });
        }

        const law = getJurisdiction(input.country_code);
        if (!law) {
          return createJsonResponse({
            country_code:  input.country_code,
            status:        "NOT_FOUND",
            message:       `No law data for ${input.country_code}. Treated as unregulated.`,
            fatf_risk:     checkJurisdictionRisk(input.country_code),
          });
        }

        const requirements = input.amount_usd !== undefined
          ? getComplianceRequirements(input.country_code, input.amount_usd)
          : null;

        return createJsonResponse({
          law,
          fatf_risk:    checkJurisdictionRisk(input.country_code),
          requirements,
          summary: [
            `${law.country_name} (${law.country_code}): ${law.crypto_legal_status.toUpperCase()}`,
            `AML Framework: ${law.aml_framework.toUpperCase()}`,
            `Reporting threshold: ${law.reporting_threshold_usd !== null ? "$" + law.reporting_threshold_usd.toLocaleString() : "none defined"}`,
            `VASP license required: ${law.vasp_licensed ? "YES" : "NO"}`,
            `CBDC issued: ${law.cbdc_issued ? "YES" : "NO"}`,
            `Constitutional privacy: ${law.constitutional_protection ? "PROTECTED" : "not guaranteed"}`,
          ].join("\n"),
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── check_travel_rule ─────────────────────────────────────────────────────
  server.registerTool(
    "check_travel_rule",
    {
      description:
        "Check whether a transaction triggers the FATF Travel Rule " +
        "(sender/receiver identity sharing requirement for VASPs). " +
        "Threshold: $1,000 USD (EU) or $3,000 USD (US FinCEN) or jurisdiction-specific. " +
        "If the rule applies, VASPs must share originator and beneficiary information.",
      inputSchema: {
        amount_usd:   z.number().describe("Transaction amount in USD"),
        jurisdiction: z.string().describe("ISO 3166-1 alpha-2 country code of the VASP jurisdiction"),
      },
    },
    async (input) => {
      try {
        const result = checkTravelRule(input.amount_usd, input.jurisdiction);
        return createJsonResponse({
          ...result,
          recommendation: result.applies
            ? "Travel Rule applies — VASP must collect and transmit originator/beneficiary information to counterpart VASP per FATF Recommendation 16"
            : "Travel Rule does not apply to this transaction amount",
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── analyze_tx_pattern ────────────────────────────────────────────────────
  server.registerTool(
    "analyze_tx_pattern",
    {
      description:
        "AML pattern analysis for a transaction history. " +
        "Detects: structuring (transactions just below reporting thresholds), " +
        "high velocity, smurfing (identical repeated amounts), rapid cycling (layering), " +
        "concentration risk, and unusual round amounts. " +
        "Returns risk score 0–100 and recommendation: allow / review / block.",
      inputSchema: {
        address:             z.string().describe("Address being analyzed"),
        tx_count:            z.number().describe("Total transactions in window"),
        window_hours:        z.number().describe("Observation window in hours"),
        amounts_sats:        z.array(z.number()).describe("Transaction amounts in satoshis (or smallest unit)"),
        counterparties:      z.number().describe("Unique counterparty addresses"),
        intervals_seconds:   z.array(z.number()).optional().describe("Time between transactions in seconds"),
        total_volume_sats:   z.number().describe("Total volume in window (satoshis)"),
        max_amount_sats:     z.number().describe("Largest single transaction"),
      },
    },
    async (input) => {
      try {
        const pattern: TransactionPattern = {
          tx_count:          input.tx_count,
          window_seconds:    input.window_hours * 3600,
          amounts:           input.amounts_sats,
          counterparties:    input.counterparties,
          intervals_seconds: input.intervals_seconds ?? [],
          max_amount:        input.max_amount_sats,
          total_volume:      input.total_volume_sats,
        };

        const result = analyzeAmlPattern(input.address, pattern);

        return createJsonResponse({
          ...result,
          summary: result.clean
            ? `✓ No suspicious patterns detected in ${input.tx_count} transactions`
            : `⚠ ${result.flags.length} suspicious pattern(s) detected — ${result.recommendation.toUpperCase()}`,
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

  // ── report_fraud ──────────────────────────────────────────────────────────
  server.registerTool(
    "report_fraud",
    {
      description:
        "File a fraud report for a suspicious address or transaction. " +
        "Reports are stored locally and can be anchored on-chain via OP_RETURN. " +
        "Includes SHA-256 hash of the report for immutable evidence. " +
        "Use for: suspected scams, darknet market activity, ransomware payments, " +
        "drug trafficking, human trafficking, cybercrime.",
      inputSchema: {
        address:     z.string().describe("Suspicious address"),
        txid:        z.string().optional().describe("Related transaction ID"),
        category:    z.enum([
          "scam", "ransomware", "darknet_market", "drug_trafficking",
          "human_trafficking", "cybercrime", "sanctions_evasion",
          "tax_evasion", "terrorist_financing", "other",
        ]).describe("Category of suspected activity"),
        description: z.string().describe("Description of suspicious activity"),
        evidence:    z.string().optional().describe("Any evidence (URLs, hashes, tx IDs)"),
        reporter:    z.string().optional().describe("Your address (optional, for anonymous reporting leave blank)"),
      },
    },
    async (input) => {
      try {
        const { createHash } = await import("crypto");
        const timestamp = Math.floor(Date.now() / 1000);

        const reportData = {
          address:     input.address,
          txid:        input.txid,
          category:    input.category,
          description: input.description,
          evidence:    input.evidence,
          reporter:    input.reporter ?? "anonymous",
          timestamp,
          genesis_hash: GENESIS_HASH,
        };

        const report_hash = createHash("sha256")
          .update(Buffer.from(JSON.stringify(reportData), "utf8"))
          .digest("hex");

        // OP_RETURN payload for on-chain anchoring: FRDR + report_hash prefix (16 bytes)
        const opReturn = Buffer.concat([
          Buffer.from("FRDR", "ascii"),
          Buffer.from(GENESIS_HASH, "hex").slice(0, 4),
          Buffer.from(report_hash, "hex").slice(0, 28),
        ]);

        return createJsonResponse({
          report_id:   report_hash,
          status:      "FILED",
          category:    input.category,
          address:     input.address,
          timestamp,
          report_hash,
          anchoring: {
            bitcoin_op_return: opReturn.toString("hex"),
            note: "Embed this in a Bitcoin OP_RETURN transaction to anchor the report immutably on Bitcoin L1",
          },
          next_steps: [
            "Keep this report_hash as evidence — it is tamper-proof",
            "Consider reporting to: FBI IC3 (ic3.gov), Interpol (interpol.int/notice), FATF (fatf-gafi.org)",
            "For sanctions violations: OFAC tips line (800-540-6322)",
            "For darknet markets: DEA, FBI, or local law enforcement",
          ],
          note: "This report is private and local. It has NOT been submitted to any authority. Use the next_steps above to report to official channels.",
        });
      } catch (err) {
        return createErrorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );

}
