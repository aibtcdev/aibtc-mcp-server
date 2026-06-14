# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities via [GitHub Private Vulnerability Reporting](https://github.com/aibtcdev/aibtc-mcp-server/security/advisories/new).

**Do not** open a public GitHub issue for security vulnerabilities. Public disclosure before a fix is available puts all users at risk.

If you are unable to use GitHub's private reporting feature, you may contact the maintainers directly by opening a draft security advisory on this repository.

## Scope

### In-Scope

The following areas are considered in-scope for security reports:

- **MCP server tool implementations** — logic bugs, injection vulnerabilities, or unsafe behaviors in any tool handler
- **Wallet management and key handling** — improper key storage, exposure of private keys or mnemonics, insecure key derivation
- **Transaction signing and broadcasting** — incorrect signature validation, transaction malleability, replay attacks
- **Authentication and authorization logic** — bypasses, privilege escalation, or improper access controls
- **Input validation** — missing or insufficient sanitization that could lead to exploitable conditions

### Out-of-Scope

The following are considered out-of-scope:

- Vulnerabilities in third-party dependencies — please report these directly to the upstream project
- Issues requiring physical access to a user's machine
- Social engineering attacks
- Denial-of-service issues that require significant resources from the reporter
- Security weaknesses in underlying blockchain networks (Bitcoin, Stacks) themselves
- Issues already known and tracked in public GitHub issues

## Response Timeline

We are committed to addressing security reports promptly:

| Stage | Target |
|-------|--------|
| Acknowledgment of report | Within 48 hours |
| Initial severity assessment | Within 7 days |
| Status update | Every 7 days until resolved |
| Fix and release timeline | Depends on severity (critical: ASAP, high: within 30 days, medium/low: within 90 days) |

## Disclosure Policy

We follow **coordinated disclosure**. Please:

1. Report the vulnerability privately using the channel above
2. Allow us reasonable time to investigate and release a fix before any public disclosure
3. Make a good-faith effort to avoid privacy violations, data destruction, or disruption of service during research

We will publicly acknowledge your contribution in the release notes (unless you prefer to remain anonymous) once a fix has been issued.

## Supported Versions

Security fixes are applied to the latest released version. We do not backport fixes to older versions unless the severity warrants it.

| Version | Supported |
|---------|-----------|
| Latest release | Yes |
| Older releases | No |

## Protecting Your Wallet Keys

A leaked seed phrase or private key is **unrecoverable** — once an attacker has it,
they can drain the wallet, and there is no way to revoke or rotate the seed itself.
The only fix is to move funds to a new wallet. So the entire strategy is *prevention*.

### Use managed encrypted wallets, not plaintext seeds

Prefer `wallet_create` / `wallet_import`. These store an AES-256-GCM-encrypted
keystore (scrypt KDF) under `~/.aibtc/` — **outside any git repository** — so a
plaintext seed never lives in a file that can be committed.

`CLIENT_MNEMONIC` in a `.env` file is a power-user escape hatch only. A seed in a
plaintext file is one `git add` away from being burned forever. If you use it, keep
it out of version control (`.gitignore` blocks `.env` and `.env.*`).

### Defense against committing secrets

This repo ships layered protection so a seed can't slip into git history:

- **Pre-commit hook** (`.githooks/pre-commit`, auto-installed via `npm install`)
  blocks commits containing a seed phrase assigned to a mnemonic/seed/secret
  field, BIP32 extended keys (`xprv`/`zprv`), or named private keys. This is the
  primary gate. It runs the built-in scanner with zero dependencies, and also
  invokes `gitleaks` if you have it installed.
- **GitHub push protection** (repo setting) is the server-side backstop that no
  local bypass can defeat. Because the hook is local — bypassable with
  `git commit --no-verify` or a commit from a machine that never ran
  `npm install` — keep push protection enabled as the net the hook can't be.

If the hook ever blocks a legitimate commit, bypass with `git commit --no-verify`.

The hook is **best-effort**: it auto-installs via the `prepare` npm script (which
won't override an existing `core.hooksPath`, so husky/lefthook users keep theirs),
but `npm ci --ignore-scripts` and fresh clones that skip `npm install` won't have
it. Keep GitHub push protection on as the enforcement those workflows can't skip.

### Limit blast radius

- **Spending limit (default-on).** Every outbound spend path — `transfer_stx`,
  `transfer_btc`, x402/L402 auto-payments, and `lightning_pay_invoice` — is
  metered against a cumulative per-session and per-day cap (default ~10 STX +
  ~50k sats). A spend that would exceed it is blocked and surfaces the remaining
  budget, so a single prompt-injected call (or a malicious endpoint looping
  sub-cap payments) can't drain the wallet. Override per wallet with
  `SPEND_LIMIT_DAILY_USTX` / `SPEND_LIMIT_SESSION_USTX` /
  `SPEND_LIMIT_DAILY_SATS` / `SPEND_LIMIT_SESSION_SATS`, or disable with
  `SPEND_LIMIT_ENABLED=false`.

  **Two-bucket Lightning semantics.** The sats ledger is keyed by the active
  Stacks address so BTC L1, sBTC, and Lightning spends share one budget. When
  the STX wallet is locked (`wallet_lock`) but the Lightning wallet is still
  active, `lightning_pay_invoice` spends are metered against a separate
  `__lightning__` bucket instead. Both buckets enforce the same cap
  independently — this means total daily exposure can approach 2× the
  `SPEND_LIMIT_DAILY_SATS` cap if the STX wallet is locked mid-session. To
  bound this: keep funds in cold storage and set a conservative
  `SPEND_LIMIT_DAILY_SATS`, or use `wallet_lock` only when done transacting.
- Keep only working funds in the agent's hot wallet; hold the rest in cold storage.
- The x402 payment flow also enforces a per-transaction spend cap.
- Wallets auto-lock after an idle timeout (`wallet_set_timeout`); lock manually
  with `wallet_lock` when stepping away.

### If a seed or private key is exposed

Assume the wallet is compromised the moment the secret touches a commit, a log, a
chat, or any shared surface — even briefly.

1. **Immediately** create a fresh wallet (`wallet_create`) on a clean machine.
2. Sweep all funds (BTC, STX, sBTC, tokens, NFTs) from the exposed wallet to the
   new one. Move the most valuable assets first — attackers automate this.
3. **Never reuse the exposed seed** for anything, ever.
4. Rotate any API keys (Hiro, sponsor relay, Bitflow, Pillar) that shared the
   `.env`, in case the whole file leaked.
5. If the secret reached a git commit, the commit is already burned even if you
   delete it — rotating funds is the only real remedy, not history rewriting.
