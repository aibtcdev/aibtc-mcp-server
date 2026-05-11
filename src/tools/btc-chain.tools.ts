/**
 * Bitcoin-Complete Chain Tools — Flying Whale
 *
 * COPYRIGHT 2026 Flying Whale — zaghmout.btc | ERC-8004 #54 | ALL RIGHTS RESERVED
 * Flying Whale Proprietary License v3.0 — Agreement-First Policy
 * Owner: SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW
 *
 * btc_chain_stats   — Full blockchain stats: height, totalWork, halvingInfo, difficulty
 * btc_block         — Get any block by height or hash
 * btc_mine          — Mine a new block for the current session (PoP)
 * btc_utxos         — List unspent access UTXOs for an address
 * btc_merkle        — Compute + verify Merkle proof for a transaction
 * btc_difficulty    — Current target, nBits, next retarget
 * btc_halving       — Current epoch, reward, WHALE floor, next halving
 * btc_script        — Build + execute FW Script (P2PKH, WHALE_GATE, SOVEREIGN_GATE)
 * btc_genesis       — Show genesis block (block 0)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createJsonResponse, createErrorResponse } from "../utils/index.js";
import {
  getChainStats,
  getBlock,
  getLatestBlock,
  appendBlock,
  getUtxos,
  getUtxoBalance,
  buildMerkleRoot,
  buildMerkleProof,
  halvingInfo,
  blockReward,
  minWhaleRequired,
  expandNBits,
  targetToHex,
  mineBlock,
  getCurrentNBits,
  executeScript,
  p2pkhScript,
  whaleGateScript,
  psiGateScript,
  sovereignGateScript,
  opReturnScript,
  sha256d,
  sha256dHex,
  FW_GENESIS_HASH,
} from "../services/btc-chain.js";
import { computeAndRecordPsi } from "../services/psi-consensus.js";

export function registerBtcChainTools(server: McpServer): void {

  // ── btc_chain_stats ────────────────────────────────────────────────────────
  server.registerTool(
    "btc_chain_stats",
    {
      description:
        "Get full Flying Whale Bitcoin-complete chain statistics. " +
        "Shows: block height, SHA256d hash, totalWork (accumulated PoP difficulty), " +
        "current nBits + target, halving epoch, average block time, top miners. " +
        "The FW chain applies every Bitcoin element: SHA256d, Merkle tree, nBits, " +
        "PoP mining, difficulty retarget every 2016 blocks, halving every 210,000 blocks.",
    },
    async () => {
      try {
        const stats = await getChainStats();

        return createJsonResponse({
          chain: {
            height:      stats.height,
            totalBlocks: stats.totalBlocks,
            genesisHash: stats.genesisHash,
            latestHash:  stats.latestHash,
            totalWork:   stats.totalWork,
            integrity:   stats.integrity ? "✅ verified" : "❌ TAMPERED",
          },
          mining: {
            nBits:           "0x" + stats.currentNBits.toString(16).padStart(8, "0"),
            target:          stats.currentTarget,
            avgBlockTimeMs:  stats.avgBlockTimeMs,
            avgBlockTimeSec: (stats.avgBlockTimeMs / 1000).toFixed(1) + "s",
            targetBlockSec:  "600s (Bitcoin-identical)",
          },
          halving:  {
            epoch:        stats.halvingInfo.epoch,
            halvings:     stats.halvingInfo.halvings,
            reward:       stats.halvingInfo.reward.toString() + " FW-sats",
            minWhale:     stats.halvingInfo.minWhale.toString() + " μWHALE",
            nextHalving:  stats.halvingInfo.nextHalving,
            blocksToNext: stats.halvingInfo.blocksToNext,
          },
          transactions: {
            total: stats.totalTxs,
            totalReward: stats.totalReward.toString() + " FW-sats",
          },
          topMiners: stats.topMiners.map(m => ({
            address: m.address,
            blocks:  m.blocks,
            reward:  m.reward.toString() + " FW-sats",
          })),
          bitcoin_elements: {
            hash_function:    "SHA256d — SHA256(SHA256(header))",
            block_header:     "80 bytes: version·prevHash·merkleRoot·time·nBits·nonce",
            merkle_tree:      "Binary hash tree over all tool-call transactions",
            proof_of_physics: "Find nonce: SHA256d(header) < target(nBits)",
            difficulty:       "Retargets every 2016 blocks (identical to Bitcoin)",
            halving:          "Every 210,000 blocks (identical to Bitcoin)",
            utxo_model:       "Unspent access outputs, spent by secp256k1 signature",
            script:           "OP_CHECKSIG · OP_WHALE_CHECK · OP_PSI_VERIFY",
          },
          chain_linkage: {
            fw_chain:   "~/.aibtc/fw-chain.json  — Bitcoin-complete blocks",
            psi_chain:  "~/.aibtc/psi-chain.json — Ψ consensus entries",
            genesis_anchor: "fw-chain[0].prevHash = psi-chain[last].hash",
            per_block:      "fw-chain[N].psiChainHash = Ψ entry for that session",
            bridge: "The two chains are cryptographically linked at genesis and at every block",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_block ──────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_block",
    {
      description:
        "Get a Flying Whale block by height or hash. " +
        "Shows the complete Bitcoin-format block: header (version, prevHash, merkleRoot, " +
        "time, nBits, nonce), SHA256d hash, all transactions (coinbase + tool calls), " +
        "Ψ score, WHALE balance, and block reward.",
      inputSchema: {
        height_or_hash: z.union([z.number(), z.string()]).optional().describe(
          "Block height (number) or SHA256d hash (hex string). " +
          "Default: latest block."
        ),
      },
    },
    async ({ height_or_hash }) => {
      try {
        const block = height_or_hash !== undefined
          ? await getBlock(height_or_hash as number | string)
          : await getLatestBlock();

        if (!block) {
          return createJsonResponse({
            found: false,
            message: "Block not found. Chain may be empty — mine the first block with btc_mine.",
            genesisHash: FW_GENESIS_HASH,
          });
        }

        const target = expandNBits(block.nBits);

        return createJsonResponse({
          found: true,
          // ── Bitcoin header ───────────────────────────────────────────────
          header: {
            version:    block.version,
            prevHash:   block.prevHash,
            merkleRoot: block.merkleRoot,
            time:       new Date(block.time * 1000).toISOString(),
            nBits:      "0x" + block.nBits.toString(16).padStart(8, "0"),
            nonce:      block.nonce,
          },
          // ── Block identity ───────────────────────────────────────────────
          hash:       block.hash,
          height:     block.height,
          totalWork:  block.totalWork,
          // ── Mining proof ─────────────────────────────────────────────────
          proof: {
            target:     targetToHex(target),
            hashBelowTarget: BigInt("0x" + block.hash) < target,
            algorithm:  "SHA256d(version·prevHash·merkleRoot·time·nBits·nonce)",
          },
          // ── Transactions ─────────────────────────────────────────────────
          txCount: block.txCount,
          transactions: block.transactions.map(tx => ({
            txid:      tx.txid,
            type:      tx.type,
            tool:      tx.tool,
            result:    tx.result,
            value:     tx.value.toString() + " μWHALE",
            psiImpact: tx.psiImpact,
            timestamp: new Date(tx.timestamp).toISOString(),
          })),
          merkleRoot: block.merkleRoot,
          // ── FW metadata ──────────────────────────────────────────────────
          miner: {
            address:      block.address,
            psiScore:     block.psiScore,
            tier:         block.tier,
            whaleBalance: block.whaleBalance + " μWHALE",
            blockReward:  block.blockReward.toString() + " FW-sats",
          },
          dimensions: {
            landauer:  (block.dimensions.landauer  * 100).toFixed(1) + "%",
            nash:      (block.dimensions.nash      * 100).toFixed(1) + "%",
            cantillon: (block.dimensions.cantillon * 100).toFixed(1) + "%",
            godel:     (block.dimensions.godel     * 100).toFixed(1) + "%",
          },
          halving: halvingInfo(block.height),
          crossChain: {
            psiChainHash: block.psiChainHash,
            note: block.height === 0
              ? "genesis: prevHash = psi-chain tail (Ψ chain anchor)"
              : "psiChainHash = Ψ entry recorded this session",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_mine ───────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_mine",
    {
      description:
        "Mine a new Flying Whale block using Proof of Physics (PoP). " +
        "Computes full Ψ score, builds coinbase tx + tool-call txs, " +
        "computes SHA256d Merkle root, finds valid nonce (SHA256d(header) < target), " +
        "and appends the block to the chain. " +
        "Adversarial sessions (high Ψ) get a harder target and may fail to mine. " +
        "Successful mining creates a block reward UTXO (FW-sats).",
      inputSchema: {
        address: z.string().describe(
          "Stacks address of the block producer (session holder)."
        ),
        whale_balance: z.string().optional().describe(
          "WHALE balance in micro-WHALE. Default: 0."
        ),
        is_owner: z.boolean().optional().describe(
          "Owner flag. Default: false."
        ),
        tool_calls: z.array(z.object({
          tool:       z.string(),
          result:     z.enum(["success", "blocked", "error"]),
          psi_impact: z.number().optional(),
        })).optional().describe(
          "Tool calls to include in this block. Each call = one transaction."
        ),
      },
    },
    async ({ address, whale_balance, is_owner, tool_calls }) => {
      try {
        const whaleBalance = whale_balance ? BigInt(whale_balance) : 0n;

        // Compute Ψ score for this session
        const psiResult = await computeAndRecordPsi({
          address,
          whaleBalance,
          isOwner:     is_owner ?? false,
          callCount:   (tool_calls?.length ?? 0) + 1,
          uniqueTools: new Set(tool_calls?.map(t => t.tool) ?? []).size || 1,
        });

        const calls = (tool_calls ?? []).map(c => ({
          tool:      c.tool,
          result:    c.result,
          psiImpact: c.psi_impact ?? 0,
        }));

        const block = await appendBlock({
          address,
          psiScore:     psiResult.score,
          tier:         psiResult.tier,
          dimensions:   psiResult.dimensions,
          whaleBalance,
          toolCalls:    calls,
          psiChainHash: psiResult.chainHash, // cross-chain anchor
        });

        if (!block) {
          return createJsonResponse({
            mined:   false,
            reason:  "Mining failed — Ψ score too high (adversarial). " +
                     "SHA256d(header) could not reach target within nonce space. " +
                     "Improve session behavior to lower Ψ and raise target.",
            psiScore: psiResult.score,
            tier:     psiResult.tier,
            verdict:  psiResult.verdict,
          });
        }

        const halvInfo = halvingInfo(block.height);

        return createJsonResponse({
          mined:      true,
          block: {
            height:    block.height,
            hash:      block.hash,
            nonce:     block.nonce,
            nBits:     "0x" + block.nBits.toString(16).padStart(8, "0"),
            merkleRoot: block.merkleRoot,
            txCount:   block.txCount,
            reward:    block.blockReward.toString() + " FW-sats",
          },
          psi: {
            score:   psiResult.score,
            tier:    psiResult.tier,
            verdict: psiResult.verdict,
          },
          halving: {
            epoch:   halvInfo.epoch,
            reward:  halvInfo.reward.toString() + " FW-sats",
            minWhale: halvInfo.minWhale.toString() + " μWHALE",
          },
          proof: {
            algorithm: "SHA256d(header) < target(nBits)",
            psiAdjusted: psiResult.score <= 40 ? "target × 2–4 (easier — cooperative reward)" :
                         psiResult.score <= 60 ? "target × 1 (neutral — standard)" :
                                                 "target ÷ 2–4 (harder — adversarial penalty)",
          },
          bitcoin_parallel:
            "Bitcoin: honest CPU mines next block. FW: honest session mines next block.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_utxos ──────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_utxos",
    {
      description:
        "List unspent access UTXOs for a Stacks address. " +
        "In Flying Whale, UTXOs represent unspent access permissions. " +
        "Created when a block is mined (coinbase) or when WHALE is acquired. " +
        "Spent when a gated tool is called. Unlockable only by secp256k1 signature " +
        "(exactly Bitcoin's UTXO model — no accounts, only coins).",
      inputSchema: {
        address: z.string().describe("Stacks address to query UTXOs for."),
      },
    },
    async ({ address }) => {
      try {
        const utxos   = await getUtxos(address);
        const balance = await getUtxoBalance(address);

        return createJsonResponse({
          address,
          utxoCount: utxos.length,
          totalValue: balance.toString() + " μWHALE",
          utxos: utxos.map(u => ({
            txid:        u.txid,
            vout:        u.vout,
            value:       u.value.toString() + " μWHALE",
            blockHeight: u.blockHeight,
            coinbase:    u.coinbase,
            script: {
              type: u.scriptPubKey.type,
              asm:  u.scriptPubKey.asm,
            },
          })),
          model: {
            bitcoin: "UTXO = unspent coin. Spend = sign with private key.",
            fw:      "UTXO = unspent access permission. Spend = tool call + sig.",
            script:  "P2PKH · WHALE_GATE · PSI_GATE · SOVEREIGN_GATE",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_merkle ─────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_merkle",
    {
      description:
        "Compute a Merkle tree from a list of transaction IDs and optionally verify " +
        "a Merkle proof for a specific txid. " +
        "Uses SHA256d (double SHA-256) exactly as Bitcoin does. " +
        "A Merkle proof proves a tx is in a block without downloading the whole block (SPV).",
      inputSchema: {
        txids: z.array(z.string()).describe(
          "List of transaction IDs (hex strings) to build the tree from."
        ),
        verify_txid: z.string().optional().describe(
          "If provided, generates and verifies a Merkle proof for this txid."
        ),
      },
    },
    async ({ txids, verify_txid }) => {
      try {
        if (txids.length === 0) {
          return createJsonResponse({
            root:  "0".repeat(64),
            depth: 0,
            note:  "Empty tree — no transactions.",
          });
        }

        const root  = buildMerkleRoot(txids);
        const depth = Math.ceil(Math.log2(txids.length));

        const result: Record<string, unknown> = {
          root,
          txCount: txids.length,
          depth,
          algorithm: "SHA256d(left + right) — identical to Bitcoin",
          note: "Any change to any tx changes the root, which changes the block hash.",
        };

        if (verify_txid) {
          const proof = buildMerkleProof(txids, verify_txid);
          result.proof = {
            txid:     verify_txid,
            root:     proof.root,
            verified: proof.verified,
            steps:    proof.proof.map(p => ({
              hash:     p.hash.slice(0, 16) + "...",
              position: p.position,
            })),
            spv_note: "Lite clients verify inclusion with O(log n) hashes (SPV).",
          };
        }

        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_difficulty ─────────────────────────────────────────────────────────
  server.registerTool(
    "btc_difficulty",
    {
      description:
        "Show current Proof-of-Physics difficulty: nBits, expanded target (256-bit), " +
        "blocks until next retarget (2016-block period), and how Ψ score adjusts the target. " +
        "Miners with low Ψ (trustworthy) get an easier target. " +
        "Adversarial sessions get a harder target — may fail to mine.",
    },
    async () => {
      try {
        const nBits  = await getCurrentNBits();
        const target = expandNBits(nBits);
        const stats  = await getChainStats();

        const blocksInPeriod  = stats.height >= 0 ? (stats.height % 2016) : 0;
        const blocksToRetarget = 2016 - blocksInPeriod;

        // Show Ψ-adjusted targets for each tier
        const tiers = [
          { tier: "genesis (0–20)",        psi: 10,  mult: "×4 (4× easier)" },
          { tier: "cooperative (21–40)",   psi: 30,  mult: "×2 (2× easier)" },
          { tier: "neutral (41–60)",       psi: 50,  mult: "×1 (standard)"  },
          { tier: "non-cooperative (61–80)", psi: 70, mult: "÷2 (2× harder)" },
          { tier: "adversarial (81–100)", psi: 90,  mult: "÷4 (4× harder, may not mine)" },
        ];

        return createJsonResponse({
          current: {
            nBits:    "0x" + nBits.toString(16).padStart(8, "0"),
            target:   targetToHex(target),
            leading_zeros: targetToHex(target).match(/^0*/)?.[0].length ?? 0,
          },
          retarget: {
            period:         "2016 blocks (identical to Bitcoin)",
            blocksInPeriod,
            blocksToRetarget,
            formula: "newTarget = oldTarget × actualTime / (2016 × 600s)",
            clamp:   "Max 4× change per period (identical to Bitcoin)",
          },
          psi_adjustment: {
            note: "Ψ score adjusts target per-session (higher Ψ = harder = adversarial penalty)",
            tiers,
          },
          bitcoin_parallel:
            "Bitcoin: more hashpower = easier block. FW: more trustworthy = easier block.",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_halving ────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_halving",
    {
      description:
        "Show the Flying Whale halving schedule. " +
        "Every 210,000 blocks (identical to Bitcoin), the block reward halves " +
        "AND the minimum WHALE balance required for access increases. " +
        "Epoch 0: 50 FW-sats reward, 0 WHALE floor. " +
        "Epoch 1: 25 FW-sats, 1 WHALE. Epoch 2: 12.5 FW-sats, 2 WHALE. Etc.",
      inputSchema: {
        height: z.number().optional().describe(
          "Block height to query. Default: current chain height."
        ),
      },
    },
    async ({ height }) => {
      try {
        const stats       = await getChainStats();
        const queryHeight = height ?? Math.max(stats.height, 0);
        const info        = halvingInfo(queryHeight);

        // Show first 6 epochs
        const schedule = Array.from({ length: 6 }, (_, epoch) => {
          const h = epoch * 210_000;
          return {
            epoch,
            startHeight:    h,
            reward:         blockReward(h).toString() + " FW-sats",
            minWhale:       minWhaleRequired(h).toString() + " μWHALE",
            whaleForHumans: (Number(minWhaleRequired(h)) / 1_000_000).toFixed(0) + " WHALE",
          };
        });

        return createJsonResponse({
          currentHeight: queryHeight,
          current: {
            epoch:        info.epoch,
            halvings:     info.halvings,
            reward:       info.reward.toString() + " FW-sats",
            rewardFW:     (Number(info.reward) / 100_000_000).toFixed(8) + " FW",
            minWhale:     info.minWhale.toString() + " μWHALE",
            nextHalving:  info.nextHalving,
            blocksToNext: info.blocksToNext,
          },
          schedule,
          bitcoin_parallel: {
            period:       "210,000 blocks — identical to Bitcoin",
            initial:      "50 FW-sats (like Bitcoin's 50 BTC)",
            halvings:     "64 total before reward reaches 0",
            total_supply: "50 × 210000 × (1 + 0.5 + 0.25 + ...) ≈ 21,000,000 FW (Bitcoin's 21M)",
          },
          satoshi_note:
            "Once a predetermined number of coins have entered circulation, " +
            "the incentive can transition entirely to transaction fees. (Whitepaper §6)",
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_script ─────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_script",
    {
      description:
        "Build and execute a Flying Whale Script — the stack-based VM for spending conditions. " +
        "Supports: P2PKH (standard), WHALE_GATE, PSI_GATE, SOVEREIGN_GATE, OP_RETURN. " +
        "FW Script extends Bitcoin Script with OP_WHALE_CHECK and OP_PSI_VERIFY. " +
        "Execute mode verifies whether a given context can spend the script output.",
      inputSchema: {
        script_type: z.enum(["P2PKH", "WHALE_GATE", "PSI_GATE", "SOVEREIGN_GATE", "NULLDATA"]).describe(
          "Type of script to build."
        ),
        address: z.string().optional().describe(
          "Stacks address (for P2PKH and execute mode)."
        ),
        min_whale: z.string().optional().describe(
          "Minimum WHALE balance in μWHALE (for WHALE_GATE / SOVEREIGN_GATE)."
        ),
        max_psi: z.number().optional().describe(
          "Maximum Ψ score allowed (for PSI_GATE / SOVEREIGN_GATE). Lower = stricter."
        ),
        data: z.string().optional().describe(
          "Arbitrary data string (for OP_RETURN / NULLDATA script)."
        ),
        // Execute context
        execute: z.boolean().optional().describe(
          "If true, execute the script with the provided context."
        ),
        context_whale: z.string().optional().describe(
          "WHALE balance of the spender (for execution)."
        ),
        context_psi: z.number().optional().describe(
          "Ψ score of the spender (for execution)."
        ),
        context_sig: z.string().optional().describe(
          "Signature provided by the spender (for execution)."
        ),
      },
    },
    async ({
      script_type,
      address,
      min_whale,
      max_psi,
      data,
      execute,
      context_whale,
      context_psi,
      context_sig,
    }) => {
      try {
        let script;

        switch (script_type) {
          case "P2PKH": {
            const hash160 = address ? sha256d(address).slice(0, 40) : "0".repeat(40);
            script = p2pkhScript(hash160);
            break;
          }
          case "WHALE_GATE":
            script = whaleGateScript(min_whale ? BigInt(min_whale) : 1_000_000n);
            break;
          case "PSI_GATE":
            script = psiGateScript(max_psi ?? 40);
            break;
          case "SOVEREIGN_GATE":
            script = sovereignGateScript(
              min_whale ? BigInt(min_whale) : 1_000_000n,
              max_psi ?? 40
            );
            break;
          case "NULLDATA":
            script = opReturnScript(data ?? "FlyingWhale");
            break;
          default:
            throw new Error("Unknown script type");
        }

        const result: Record<string, unknown> = {
          script: {
            type: script.type,
            asm:  script.asm,
            hex:  script.hex,
          },
          bitcoin_parallel: {
            P2PKH:          "OP_DUP OP_HASH160 {hash} OP_EQUALVERIFY OP_CHECKSIG",
            WHALE_GATE:     "OP_WHALE_CHECK {amount} OP_CHECKSIG (FW extension)",
            PSI_GATE:       "OP_PSI_VERIFY {score} OP_CHECKSIG (FW extension)",
            SOVEREIGN_GATE: "OP_WHALE_CHECK OP_PSI_VERIFY OP_CHECKSIG (full FW gate)",
            NULLDATA:       "OP_RETURN {data} (unspendable metadata, Bitcoin standard)",
          },
        };

        if (execute) {
          const ctx = {
            address:      address ?? "",
            signature:    context_sig,
            whaleBalance: context_whale ? BigInt(context_whale) : 0n,
            psiScore:     context_psi ?? 50,
            tier:         context_psi !== undefined
              ? (context_psi <= 20 ? "genesis" : context_psi <= 40 ? "cooperative" : "neutral")
              : "neutral",
          };
          const execution = executeScript(script, ctx);
          result.execution = {
            valid:   execution.valid,
            reason:  execution.reason,
            context: {
              whale: ctx.whaleBalance.toString() + " μWHALE",
              psi:   ctx.psiScore,
              hasSig: !!ctx.signature,
            },
          };
        }

        return createJsonResponse(result);
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_sha256d ────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_sha256d",
    {
      description:
        "Compute SHA256d (double SHA-256) of any string or hex data. " +
        "SHA256d = SHA256(SHA256(data)) — Bitcoin's actual hash function used for " +
        "EVERY hash in the protocol: blocks, transactions, Merkle tree, addresses. " +
        "The double hash eliminates length-extension attacks (single SHA-256 is vulnerable).",
      inputSchema: {
        data: z.string().describe("Input string to hash."),
        encoding: z.enum(["utf8", "hex"]).optional().describe(
          "Input encoding: 'utf8' (default) or 'hex'."
        ),
      },
    },
    async ({ data, encoding }) => {
      try {
        const hash = encoding === "hex"
          ? sha256dHex(data)
          : sha256d(data);

        // Also show single SHA-256 for comparison
        const { createHash } = await import("crypto");
        const single = createHash("sha256").update(
          encoding === "hex" ? Buffer.from(data, "hex") : data
        ).digest("hex");

        return createJsonResponse({
          input:    data,
          encoding: encoding ?? "utf8",
          sha256d:  hash,
          sha256:   single,
          different: hash !== single,
          note: "SHA256d ≠ SHA256 — the second hash is what Bitcoin actually uses.",
          bitcoin_uses: [
            "Block header hash: SHA256d(80-byte-header)",
            "Transaction ID: SHA256d(serialized-tx)",
            "Merkle tree: SHA256d(left-hash + right-hash)",
            "Address: RIPEMD160(SHA256(compressed-pubkey))",
          ],
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );

  // ── btc_genesis ────────────────────────────────────────────────────────────
  server.registerTool(
    "btc_genesis",
    {
      description:
        "Show the Flying Whale genesis block (block 0) and its Bitcoin parallel. " +
        "The genesis block is hardcoded — its hash comes from the owner address + " +
        "founding constants, giving it sovereign origin. " +
        "Bitcoin's genesis block contained: 'The Times 03/Jan/2009 Chancellor on brink of second bailout for banks'",
    },
    async () => {
      try {
        const genesis = await getBlock(0);
        const stats   = await getChainStats();

        return createJsonResponse({
          fw_genesis: genesis ? {
            height:     0,
            hash:       genesis.hash,
            prevHash:   FW_GENESIS_HASH + " (hardcoded — no block before genesis)",
            merkleRoot: genesis.merkleRoot,
            nBits:      "0x" + genesis.nBits.toString(16).padStart(8, "0"),
            nonce:      genesis.nonce,
            miner:      genesis.address,
            reward:     genesis.blockReward.toString() + " FW-sats",
            message:    "Flying Whale Genesis — zaghmout.btc — ERC-8004 #54 — May 2026",
          } : {
            status:  "Genesis not yet mined",
            genesisHash: FW_GENESIS_HASH,
            note:    "Call btc_mine to create the genesis block.",
          },
          chainHeight: stats.height,
          bitcoin_genesis: {
            height:  0,
            hash:    "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f",
            nBits:   "0x1d00ffff",
            nonce:   2083236893,
            reward:  "50 BTC (unspendable — Satoshi's design choice)",
            message: "The Times 03/Jan/2009 Chancellor on brink of second bailout for banks",
            meaning: "Proof of motivation — Bitcoin born from financial system failure",
          },
          fw_genesis_message: {
            meaning: "Flying Whale born from sovereign physics — Ψ = Landauer·Nash·Cantillon⁻¹·Gödel",
            owner:   "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW",
            onchain: "SP322ZK4VXT3KGDT9YQANN9R28SCT02MZ97Y24BRW.whale-ip-store-v1",
          },
        });
      } catch (error) {
        return createErrorResponse(error);
      }
    }
  );
}
