# Pillar Allow Mode - Planning Document

## Current State: "Handoff Model"

Today, all Pillar MCP operations require browser handoff:
1. MCP creates operation intent
2. Opens browser with `?op={opId}`
3. User signs via Privy passkey in browser
4. MCP polls for completion

**Why?** Privy's embedded wallet requires browser context for signing.

---

## Goal: "Allow Mode"

Let users approve certain operations without browser popup. MCP could sign and broadcast directly.

---

## Technical Constraints

### Why We Can't Sign from CLI Today

1. **Privy Embedded Wallet**
   - Private key is managed by Privy
   - Signing requires their browser SDK
   - No CLI/Node.js SDK for signing

2. **Passkeys/WebAuthn**
   - WebAuthn is a *browser* API
   - Requires browser's credential manager
   - Cannot trigger passkey prompt from terminal

3. **Security Model**
   - Passkeys are designed to prevent phishing
   - They bind to origin (domain)
   - CLI has no "origin" concept

---

## Does Clarity 5 + WebAuthn Change This?

### What Clarity 5 Brings
- Native `secp256k1-verify` for signature verification
- Direct webauthn signature verification on-chain
- No need for intermediate signing services

### What It Does NOT Change
- **Passkey creation/signing still requires browser**
- WebAuthn API is browser-only
- You still can't trigger a passkey prompt from terminal

### The Fundamental Problem
```
User's Passkey (in browser/OS) ←→ WebAuthn API (browser only) ←→ Stacks Transaction
                                        ↑
                                  CLI cannot access this
```

Clarity 5 helps with *verification* on-chain, but the *signing* still needs to happen where the passkey lives (browser/OS).

---

## Possible Solutions for Allow Mode

### Option A: Pre-Authorized Allowances (Smart Contract)

Add allowance system to Pillar smart wallet contract:

```clarity
;; Owner sets allowance for keeper to act on their behalf
(define-public (set-keeper-allowance
    (action (string-ascii 20))  ;; "boost", "unwind", "supply"
    (max-amount uint)           ;; Maximum sats per action
    (expires-at uint))          ;; Block height expiry
  ...)

;; Keeper can execute without owner signature (within limits)
(define-public (keeper-execute-boost
    (wallet principal)
    (amount uint))
  ;; Check allowance, execute boost
  ...)
```

**Pros:**
- True "set and forget" - no signing needed
- Works today with existing tech
- On-chain security guarantees

**Cons:**
- Requires contract upgrade
- User must do one-time browser signing to set allowance
- Trust in keeper system

---

### Option B: Session Keys (Temporary Delegation)

Create short-lived signing keys that MCP can use:

1. User signs (in browser) to create a session key
2. Session key is stored locally by MCP
3. MCP uses session key for subsequent operations
4. Session expires after N hours/days

```typescript
// One-time browser authorization
pillar_authorize_session({ duration: "24h", operations: ["boost", "supply"] })

// Then MCP can sign directly
pillar_boost({ amount: 10000 }) // No browser popup!
```

**Pros:**
- Good UX after initial setup
- Time-limited exposure

**Cons:**
- Session key must be stored securely
- Adds complexity
- Still needs initial browser auth

---

### Option C: Mobile Push Notifications

1. MCP requests action
2. Push notification to user's phone
3. User approves on phone (biometric)
4. Transaction broadcasts

**Pros:**
- Works from any device
- Modern UX (like bank apps)

**Cons:**
- Requires mobile app
- More infrastructure
- Still requires user action (just not browser)

---

### Option D: Local Signer with Hardware Key

1. User connects hardware wallet (Ledger) to their machine
2. MCP triggers signing via USB
3. User confirms on hardware device

**Pros:**
- High security
- Works from terminal

**Cons:**
- Requires hardware wallet
- Not passkey-based
- Different security model

---

## Recommended Path Forward

### Phase 1: Smart Contract Allowances (Works Today)

1. Add allowance functions to Pillar wallet contract
2. User sets allowances via browser (one-time)
3. Keeper/MCP can execute within allowances

This gives "allow mode" for:
- Auto-compound (already building this!)
- Auto-boost when price dips
- Scheduled operations

### Phase 2: Session Keys (Future)

Build secure session key infrastructure for more flexibility.

### What Clarity 5 Enables

With webauthn verification on-chain, we could:
- Verify passkey signatures directly in contract
- Support new signature schemes
- But signing still needs browser/OS passkey prompt

---

## Summary

| Approach | Browser Needed | Complexity | Security | UX |
|----------|---------------|------------|----------|-----|
| Current (Handoff) | Every time | Low | High | Medium |
| Allowances | Once (setup) | Medium | High | Good |
| Session Keys | Once (per session) | High | Medium | Great |
| Push Notifications | Never (phone) | High | High | Great |
| Hardware Wallet | Never | Medium | Very High | Niche |

**Recommendation:** Start with smart contract allowances (we're already building auto-compound this way). This gives "allow mode" semantics with minimal changes.

---

## Questions to Resolve

1. What operations should support allowances?
2. What limits make sense (max amount, frequency)?
3. Should allowances be revocable instantly?
4. Do we need a keeper reputation system?
