# Phases

## Phase 1: Skill Structure and Core SKILL.md
Goal: Create the skill directory structure with main SKILL.md focused on Bitcoin L1 wallet operations.
Status: `completed`

**Deliverables:**
- `skill/SKILL.md` - Main skill file with:
  - Frontmatter: name, description, license, metadata (author, version, npm, github)
  - Install instructions (npx and local)
  - Quick start workflows (balance, send, fees)
  - Tool reference table
  - Links to references
- `skill/references/` - Empty directory for reference docs

**Key Decisions:**
- Skill lives in `skill/` at repo root (not `.claude/`)
- Name: `aibtc-bitcoin-wallet`
- Keep main SKILL.md under 200 lines - light and linkable

## Phase 2: Reference Documents
Goal: Create modular reference documents for Pillar smart wallet and Stacks L2/DeFi.
Status: `completed`

**Deliverables:**
- `skill/references/pillar-wallet.md` - Pillar smart wallet reference:
  - Connection flow (passkey auth)
  - Send to BNS/wallet names
  - Funding methods
  - Yield via Zest boost
- `skill/references/stacks-defi.md` - Stacks L2 reference:
  - STX transfers
  - ALEX DEX swaps
  - Zest Protocol lending
  - x402 paid endpoints
- `skill/references/troubleshooting.md` - Common issues and solutions

**Key Decisions:**
- Each reference self-contained with its own context
- Link to CLAUDE.md sections and external docs
- Keep each under 150 lines

## Phase 3: Package Integration
Goal: Include skill in npm package distribution and update documentation.
Status: `completed`

**Deliverables:**
- Update `package.json`:
  - Add `skill` to `files` array
  - Add skill-related keywords
- Update `README.md`:
  - Add skill section explaining what it is
  - Installation alongside MCP
  - Link to ClawHub
- Update `CLAUDE.md`:
  - Reference skill for agent guidance

## Phase 4: GitHub Action for ClawHub Publishing
Goal: Automate skill publishing to ClawHub on release tags.
Status: `completed`

**Deliverables:**
- `.github/workflows/release.yml` - Add clawhub publish step:
  - Install clawhub CLI
  - Extract version from tag
  - Publish skill with changelog
- Add `CLAWHUB_API_KEY` to repo secrets documentation
- Test with a beta tag first

**Command Template:**
```bash
npx clawhub publish ./skill \
  --slug aibtc-bitcoin-wallet \
  --name "AIBTC Bitcoin Wallet" \
  --version ${VERSION} \
  --changelog "${CHANGELOG}" \
  --tags latest
```

## Phase 5: Testing and Documentation
Goal: Verify skill works across different agent platforms and document usage.
Status: `completed`

**Deliverables:**
- Test skill loading in Claude Code
- Test skill discovery via ClawHub search
- Document skill usage in README
- Create `skill/README.md` for standalone usage
- Update main README with badges (npm, clawhub)
