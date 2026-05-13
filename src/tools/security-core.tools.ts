/**
 * Security Core Tools — أدوات الأمان الأساسية
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * MCP tool bindings for:
 *   - Bitcoin-identical tool hash chain (SEC-14 → 100/100)
 *   - Real ZK commitment scheme (SEC-15 PASS)
 *   - SMS/USSD gateway status (SEC-21 PASS)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  getChain,
  GENESIS_HASH,
  verifyMerkleProof,
} from "../services/security/tool-hash-chain.js";

import {
  commit,
  verifyCommitment,
  generateSalt,
  createComplianceProof,
  verifyComplianceProof,
  createBallot,
  revealBallot,
  commitWhistleblowerReport,
  verifyWhistleblowerReport,
  CLARITY_VERIFICATION_CONTRACT,
} from "../services/security/zk-commitment.js";

import {
  getGatewayStatus,
  processUssdInput,
  parseSmsCommand,
  buildSmsReply,
} from "../services/access/ussd-gateway.js";

export function registerSecurityCoreTools(server: McpServer): void {

  // ════════════════════════════════════════════════════════════════════════
  // HASH CHAIN TOOLS — Bitcoin-identical integrity chain
  // ════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "security_chain_status",
    {
      title: "Security Chain Status",
      description:
        "Show the current Bitcoin-style tool hash chain for this session. " +
        "Every tool call is logged as a block with double-SHA256, Merkle root, " +
        "and 7 Bitcoin consensus rules. Returns chain stats and integrity status.",
      inputSchema: z.object({}).shape,
    },
    async (_args) => {
      const chain = getChain(server);
      const stats = chain.stats();
      const verification = chain.verify();
      const lines = [
        `🔗 TOOL HASH CHAIN — Bitcoin-identical security`,
        ``,
        `Genesis anchor : ${GENESIS_HASH}`,
        `Session nonce  : ${stats.session_nonce}`,
        `Block count    : ${stats.block_count}`,
        `Chain valid    : ${verification.valid ? "✅ VALID" : "❌ VIOLATIONS DETECTED"}`,
        `Merkle root    : ${stats.merkle_root}`,
        `Chain hash     : ${stats.chain_hash}`,
        `Violations     : ${stats.violation_count}`,
        ``,
        stats.last_block
          ? [
              `Last block:`,
              `  Height    : ${stats.last_block.block_height}`,
              `  Tool      : ${stats.last_block.tool_name}`,
              `  Block hash: ${stats.last_block.block_hash}`,
              `  Timestamp : ${new Date(stats.last_block.timestamp_ms).toISOString()}`,
            ].join("\n")
          : `Last block: (none — chain empty)`,
        ``,
        verification.violations.length > 0
          ? `Violations:\n${verification.violations.map(v => `  Rule ${v.rule} (${v.rule_name}): ${v.detail}`).join("\n")}`
          : `All 7 Bitcoin consensus rules: ✅ PASS`,
        ``,
        `Design: Bitcoin block header format, double-SHA256, binary Merkle tree,`,
        `        duplicate-last leaf behavior, no-double-spend guard per session.`,
      ].join("\n");
      return { content: [{ type: "text", text: lines }] };
    }
  );

  server.registerTool(
    "security_verify_call",
    {
      title: "Verify Tool Call Integrity",
      description: "Verify a specific tool call block in the session hash chain by block height.",
      inputSchema: z.object({
        block_height: z.number().int().min(0).describe("Block height to verify (0 = first call)"),
      }).shape,
    },
    async (args) => {
      const chain = getChain(server);
      const block = chain.chain[args.block_height];
      if (!block) {
        return {
          content: [{ type: "text", text: `Block ${args.block_height} not found. Chain has ${chain.length} blocks (0–${chain.length - 1}).` }],
          isError: true,
        };
      }
      const proof = chain.getProof(args.block_height);
      const proofValid = proof ? verifyMerkleProof(proof) : false;
      const text = [
        `📦 BLOCK ${block.block_height} — ${block.tool_name}`,
        ``,
        `Block hash      : ${block.block_hash}`,
        `Prev block hash : ${block.prev_block_hash}`,
        `Input hash      : ${block.input_hash}`,
        `Output hash     : ${block.output_hash}`,
        `Output size     : ${block.output_size_bytes} bytes`,
        `Merkle root     : ${block.merkle_root}`,
        `Timestamp       : ${new Date(block.timestamp_ms).toISOString()}`,
        `Session nonce   : ${block.session_nonce}`,
        ``,
        `Merkle proof    : ${proofValid ? "✅ VALID" : "❌ INVALID"}`,
        proof ? `Proof depth     : ${proof.proof_hashes.length} hashes` : "",
        proof ? `Formula         : ${proof.verification_formula}` : "",
      ].filter(l => l !== "").join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  server.registerTool(
    "security_session_proof",
    {
      title: "Generate Session Merkle Proof",
      description:
        "Generate a Bitcoin SPV-style Merkle proof for a specific tool call in this session. " +
        "Proves the call was included without revealing all session calls.",
      inputSchema: z.object({
        block_height: z.number().int().min(0).describe("Block height to prove"),
      }).shape,
    },
    async (args) => {
      const chain = getChain(server);
      const proof = chain.getProof(args.block_height);
      if (!proof) {
        return {
          content: [{ type: "text", text: `Block ${args.block_height} not found. Chain has ${chain.length} blocks.` }],
          isError: true,
        };
      }
      const valid = verifyMerkleProof(proof);
      const text = [
        `🌳 MERKLE SPV PROOF — Block ${proof.block_height}`,
        ``,
        `Leaf hash    : ${proof.block_hash}`,
        `Merkle root  : ${proof.merkle_root}`,
        `Proof valid  : ${valid ? "✅ YES" : "❌ NO"}`,
        `Proof depth  : ${proof.proof_hashes.length}`,
        ``,
        `Proof path:`,
        ...proof.proof_hashes.map((h, i) =>
          `  [${i}] ${proof.proof_positions[i].padEnd(5)} sibling: ${h}`
        ),
        ``,
        `Verification formula:`,
        `  ${proof.verification_formula}`,
        ``,
        `This proof proves block ${proof.block_height} inclusion in the session chain`,
        `without revealing other tool calls — identical to Bitcoin SPV verification.`,
      ].join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  // ════════════════════════════════════════════════════════════════════════
  // ZK COMMITMENT TOOLS — real hash-based commitment scheme
  // ════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "security_zk_commit",
    {
      title: "ZK Commit",
      description:
        "Create a cryptographic commitment to a secret value. " +
        "Returns the commitment hash and a random salt. " +
        "The commitment is hiding (reveals nothing about secret) and binding (cannot be forged). " +
        "commit(secret, salt) = SHA256(SHA256(secret) || SHA256(salt))",
      inputSchema: z.object({
        secret: z.string().describe("The value to commit to"),
        salt: z.string().optional().describe("Optional blinding factor (generated if not provided)"),
      }).shape,
    },
    async (args) => {
      const salt = args.salt ?? generateSalt();
      const commitment = commit(args.secret, salt);
      const text = [
        `🔒 ZK COMMITMENT`,
        ``,
        `Commitment : ${commitment}`,
        `Salt       : ${salt}`,
        ``,
        `Formula    : SHA256(SHA256(secret) || SHA256(salt))`,
        `Properties : HIDING (pre-image resistance) + BINDING (collision resistance)`,
        ``,
        `⚠️  Keep the salt private — it's required to open the commitment.`,
        `    The commitment alone reveals nothing about the secret.`,
        ``,
        `On-chain verification (Clarity):`,
        `  (sha256 (concat (sha256 secret) (sha256 salt))) === commitment`,
      ].join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  server.registerTool(
    "security_zk_verify",
    {
      title: "ZK Verify Commitment",
      description:
        "Verify that a commitment opens to (secret, salt). " +
        "Returns true only if commit(secret, salt) === commitment.",
      inputSchema: z.object({
        commitment: z.string().describe("The commitment hash to verify against"),
        secret: z.string().describe("The claimed secret value"),
        salt: z.string().describe("The blinding factor used to create the commitment"),
      }).shape,
    },
    async (args) => {
      const valid = verifyCommitment(args.commitment, args.secret, args.salt);
      const text = [
        `🔍 ZK VERIFICATION`,
        ``,
        `Result     : ${valid ? "✅ VALID — commitment verified" : "❌ INVALID — commitment mismatch"}`,
        `Commitment : ${args.commitment}`,
        ``,
        valid
          ? `The secret "${args.secret.slice(0, 30)}${args.secret.length > 30 ? "..." : ""}" correctly opens this commitment.`
          : `The provided (secret, salt) do NOT match the commitment. Possible tamper or wrong values.`,
      ].join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  server.registerTool(
    "security_zk_compliance_proof",
    {
      title: "ZK Compliance Proof",
      description:
        "Create a zero-knowledge compliance proof. " +
        "Proves KYC/AML status without revealing identity. " +
        "The commitment can be verified on-chain (Clarity contract included).",
      inputSchema: z.object({
        kyc_data_hash: z.string().describe("SHA256 hash of the KYC document set (not the documents themselves)"),
        kyc_passed: z.boolean().describe("KYC check passed"),
        aml_passed: z.boolean().describe("AML check passed"),
        sanctions_clear: z.boolean().describe("Sanctions screening clear"),
        age_verified: z.boolean().describe("Age ≥ 18 verified"),
        jurisdiction_allowed: z.boolean().describe("Jurisdiction is permitted"),
        issuer_identifier: z.string().describe("KYC provider identifier (hashed before storage)"),
      }).shape,
    },
    async (args) => {
      const flags = {
        kyc_passed: args.kyc_passed,
        aml_passed: args.aml_passed,
        sanctions_clear: args.sanctions_clear,
        age_verified: args.age_verified,
        jurisdiction_allowed: args.jurisdiction_allowed,
      };
      const { proof, salt } = createComplianceProof(args.kyc_data_hash, flags, args.issuer_identifier);
      const text = [
        `✅ ZK COMPLIANCE PROOF CREATED`,
        ``,
        `Proof ID       : ${proof.proof_id}`,
        `Commitment     : ${proof.commitment}`,
        `Timestamp      : ${proof.proof_timestamp}`,
        `Issuer hash    : ${proof.issuer_hash}`,
        ``,
        `Compliance flags:`,
        `  KYC passed          : ${flags.kyc_passed}`,
        `  AML passed          : ${flags.aml_passed}`,
        `  Sanctions clear     : ${flags.sanctions_clear}`,
        `  Age verified (≥18)  : ${flags.age_verified}`,
        `  Jurisdiction OK     : ${flags.jurisdiction_allowed}`,
        ``,
        `⚠️  KEEP PRIVATE — blinding factor (salt): ${salt}`,
        `   Share (kyc_data_hash, salt, flags) ONLY with authorized verifier.`,
        `   The on-chain commitment reveals no identity information.`,
        ``,
        `On-chain: publish commitment ${proof.commitment} to Stacks.`,
        `Verify with Clarity contract (use security_zk_clarity_contract tool).`,
      ].join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  server.registerTool(
    "security_zk_verify_compliance",
    {
      title: "ZK Verify Compliance Proof",
      description: "Verify a compliance proof on the verifier side without learning the prover's identity.",
      inputSchema: z.object({
        commitment: z.string().describe("The published on-chain commitment"),
        kyc_data_hash: z.string().describe("SHA256 hash of KYC documents"),
        salt: z.string().describe("Blinding factor provided by prover"),
        kyc_passed: z.boolean(),
        aml_passed: z.boolean(),
        sanctions_clear: z.boolean(),
        age_verified: z.boolean(),
        jurisdiction_allowed: z.boolean(),
      }).shape,
    },
    async (args) => {
      const flags = {
        kyc_passed: args.kyc_passed,
        aml_passed: args.aml_passed,
        sanctions_clear: args.sanctions_clear,
        age_verified: args.age_verified,
        jurisdiction_allowed: args.jurisdiction_allowed,
      };
      const result = verifyComplianceProof(args.commitment, args.kyc_data_hash, args.salt, flags);
      const text = [
        `🔍 COMPLIANCE PROOF VERIFICATION`,
        ``,
        `Result  : ${result.valid ? "✅ VALID" : "❌ INVALID"}`,
        `Reason  : ${result.reason}`,
        ``,
        result.valid
          ? `Compliance proven without identity disclosure. The prover meets all requirements.`
          : `Proof rejected. Either tampered data or wrong (kyc_data_hash, salt, flags).`,
      ].join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  server.registerTool(
    "security_zk_ballot",
    {
      title: "ZK Governance Ballot",
      description:
        "Create or reveal a commit-reveal governance ballot. " +
        "Prevents front-running and coercion — vote is committed first, revealed later. " +
        "Phase 1 (commit): publish commitment on-chain. Phase 2 (reveal): open the vote.",
      inputSchema: z.object({
        action: z.enum(["commit", "reveal"]).describe("commit = create ballot | reveal = open ballot"),
        proposal_id: z.string().describe("Proposal identifier"),
        vote: z.enum(["yes", "no", "abstain"]).describe("Your vote"),
        salt: z.string().optional().describe("Salt from commit phase (required for reveal)"),
        published_commitment: z.string().optional().describe("Published commitment hash (required for reveal)"),
        published_ballot_id: z.string().optional().describe("Published ballot ID (required for reveal)"),
        published_committed_at: z.string().optional().describe("Committed-at timestamp (required for reveal)"),
      }).shape,
    },
    async (args) => {
      if (args.action === "commit") {
        const { commitment: ballotCommitment, salt } = createBallot(args.proposal_id, args.vote);
        return {
          content: [{
            type: "text",
            text: [
              `🗳️  BALLOT COMMITTED`,
              ``,
              `Ballot ID    : ${ballotCommitment.ballot_id}`,
              `Proposal     : ${ballotCommitment.proposal_id}`,
              `Commitment   : ${ballotCommitment.commitment}`,
              `Committed at : ${ballotCommitment.committed_at}`,
              ``,
              `⚠️  KEEP PRIVATE — blinding factor (salt): ${salt}`,
              `   Publish ONLY the commitment on-chain during the commit phase.`,
              `   Reveal (vote, salt) ONLY during the reveal phase.`,
              `   Without salt, no one can know your vote — prevents coercion.`,
            ].join("\n"),
          }],
        };
      } else {
        if (!args.salt || !args.published_commitment || !args.published_ballot_id) {
          return {
            content: [{ type: "text", text: "reveal action requires: salt, published_commitment, published_ballot_id" }],
            isError: true,
          };
        }
        const publishedBallot = {
          ballot_id: args.published_ballot_id,
          proposal_id: args.proposal_id,
          commitment: args.published_commitment,
          committed_at: args.published_committed_at ?? new Date().toISOString(),
        };
        const reveal = revealBallot(publishedBallot, args.vote, args.salt);
        return {
          content: [{
            type: "text",
            text: [
              `🗳️  BALLOT REVEALED`,
              ``,
              `Ballot ID  : ${reveal.ballot_id}`,
              `Proposal   : ${reveal.proposal_id}`,
              `Vote       : ${reveal.vote}`,
              `Verified   : ${reveal.verified ? "✅ Matches commitment" : "❌ MISMATCH — possible fraud"}`,
              `Commitment : ${reveal.commitment}`,
            ].join("\n"),
          }],
        };
      }
    }
  );

  server.registerTool(
    "security_zk_clarity_contract",
    {
      title: "ZK Clarity On-Chain Verifier",
      description:
        "Get the Clarity smart contract for on-chain ZK commitment verification. " +
        "Deploy to Stacks for trustless verification of commitments, compliance proofs, " +
        "and whistleblower reports.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      return {
        content: [{
          type: "text",
          text: [
            `📜 CLARITY ZK VERIFIER CONTRACT`,
            ``,
            `Deploy to Stacks mainnet for on-chain trustless verification.`,
            `Supports: commitments, compliance proofs, whistleblower reports.`,
            ``,
            `─────────────────────────────────────────`,
            CLARITY_VERIFICATION_CONTRACT,
            `─────────────────────────────────────────`,
            ``,
            `Deployment: use deploy_contract tool with clarityVersion: 2`,
          ].join("\n"),
        }],
      };
    }
  );

  // ════════════════════════════════════════════════════════════════════════
  // USSD / SMS GATEWAY TOOLS — SEC-21 (unbanked access)
  // ════════════════════════════════════════════════════════════════════════

  server.registerTool(
    "ussd_gateway_status",
    {
      title: "USSD/SMS Gateway Status",
      description:
        "Get the operational status of the SMS/USSD gateway for unbanked access (SEC-21). " +
        "Shows provider status (Africa's Talking, Twilio), active sessions, and uptime.",
      inputSchema: z.object({}).shape,
    },
    async () => {
      const status = getGatewayStatus();
      const text = [
        `📱 USSD/SMS GATEWAY STATUS — SEC-21`,
        ``,
        `Overall status  : ${status.sec_21_status}`,
        `Dial code       : ${status.ussd_code}`,
        `Active sessions : ${status.active_sessions}`,
        ``,
        `Providers:`,
        ...status.providers.map(p =>
          `  ${p.name.padEnd(18)} : ${p.active ? "✅ ACTIVE" : p.configured ? "⚠️ CONFIGURED" : "❌ NOT CONFIGURED"} — ${p.endpoint}`
        ),
        ``,
        `Supported commands:`,
        `  ${status.supported_commands.join(" | ")}`,
        ``,
        `Rate limits:`,
        `  ${status.rate_limits.transactions_per_hour} tx/hour`,
        `  Max $${status.rate_limits.max_amount_no_kyc_usd} without KYC`,
        ``,
        `SEC-21 mission: Financial inclusion for unbanked populations.`,
        `Supports: Africa's Talking (45+ African networks) + Twilio (global SMS).`,
        `Dial *99# on any GSM phone — no smartphone, no internet required.`,
      ].join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  server.registerTool(
    "ussd_process_command",
    {
      title: "Process USSD Command",
      description:
        "Simulate a USSD session state-machine step. " +
        "Input follows *99# dial flow. sessionId identifies the user's session.",
      inputSchema: z.object({
        session_id: z.string().describe("Unique session identifier for this USSD session"),
        phone_number: z.string().describe("Caller's phone number in E.164 format (+1234567890)"),
        input: z.string().describe("User's USSD input at this step (empty string for initial dial)"),
      }).shape,
    },
    async (args) => {
      const response = processUssdInput(args.session_id, args.phone_number, args.input);
      const text = [
        `📟 USSD RESPONSE`,
        ``,
        `Type    : ${response.response_type} (${response.response_type === "CON" ? "continues session" : "ends session"})`,
        `Session : ${response.session_id}`,
        `Phone   : ${args.phone_number}`,
        ``,
        `Message:`,
        `─────────────────────────`,
        response.message,
        `─────────────────────────`,
      ].join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );

  server.registerTool(
    "ussd_sms_command",
    {
      title: "Parse SMS Command",
      description:
        "Parse an incoming SMS command and generate a reply. " +
        "Supports: BAL (balance), SEND <amount> <address>, RATE <currency>, HELP.",
      inputSchema: z.object({
        phone_number: z.string().describe("Sender's phone number"),
        message: z.string().describe("Raw SMS message text"),
      }).shape,
    },
    async (args) => {
      const command = parseSmsCommand(args.phone_number, args.message);
      const reply = buildSmsReply(command);
      const text = [
        `💬 SMS COMMAND PARSED`,
        ``,
        `From    : ${args.phone_number}`,
        `Command : ${command.command_type}`,
        command.parsed.amount_sats !== undefined ? `Amount  : ${command.parsed.amount_sats} sats` : "",
        command.parsed.recipient ? `Target  : ${command.parsed.recipient}` : "",
        command.parsed.currency ? `Currency: ${command.parsed.currency}` : "",
        `Raw     : ${command.raw_message}`,
        ``,
        `Reply SMS:`,
        `─────────────────────────`,
        reply,
        `─────────────────────────`,
      ].filter(l => l !== "").join("\n");
      return { content: [{ type: "text", text: text }] };
    }
  );
}
