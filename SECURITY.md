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
