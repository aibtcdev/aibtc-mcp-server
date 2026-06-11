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
  blocks commits containing BIP-39 seed phrases, BIP32 extended keys
  (`xprv`/`zprv`), a populated `CLIENT_MNEMONIC`, or named private keys.
- **CI secret scan** (`.github/workflows/secret-scan.yml`, gitleaks) catches
  anything pushed with `--no-verify` or from a machine without the hook.
- **GitHub push protection** (repo setting) is the server-side backstop that no
  local bypass can defeat — keep it enabled.

If the hook ever blocks a legitimate commit, bypass with `git commit --no-verify`.

### Limit blast radius

- Keep only working funds in the agent's hot wallet; hold the rest in cold storage.
- The x402 payment flow enforces a per-transaction spend cap.
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
