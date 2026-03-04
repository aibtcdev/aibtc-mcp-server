# Bitcoin Inscription Workflow

Bitcoin inscriptions are permanent data stored on the Bitcoin blockchain. This reference covers the complete inscription process from creation to verification, including parent/child inscription support.

## Overview

Bitcoin inscriptions use a two-step process:
1. **Commit transaction** - Lock funds and commit to the inscription script
2. **Reveal transaction** - Broadcast the actual inscription data (after commit confirms)

The inscription data lives in the witness field of the reveal transaction, making it part of the permanent Bitcoin record.

## Complete Workflow

### 1. Check Balance

Inscriptions require BTC for both commit and reveal transactions. Check your balance first:

```
"What's my BTC balance?"
```

Uses `get_btc_balance` - ensure you have enough confirmed satoshis.

### 2. Estimate Fees

Calculate the total cost before creating an inscription:

```
"Estimate fee for a text inscription"
```

Uses `estimate_inscription_fee` - provide content type and base64-encoded content. Returns:
- **Commit fee** - Cost to broadcast commit transaction
- **Reveal fee** - Cost to broadcast reveal transaction
- **Reveal amount** - Total locked in commit (includes reveal fee + dust)
- **Total cost** - Sum of commit fee + reveal amount

### 3. Create Commit Transaction

Broadcast the commit transaction (does NOT wait for confirmation):

```
"Create an inscription with 'Hello, Bitcoin!'"
```

Uses `inscribe` - broadcasts commit tx and returns immediately with:
- `commitTxid` - Transaction ID of commit (save this)
- `revealAddress` - Taproot address where inscription will be created
- `revealAmount` - Amount locked in commit output (save this)
- `feeRate` - Fee rate used (save this)

**Important**: The commit transaction must confirm before you can proceed to the reveal step.

### 4. Wait for Confirmation

Check commit transaction status using the `commitExplorerUrl` from the inscribe response. Typical confirmation times:
- **Fast fees** (~10 sat/vB) - 10-20 minutes
- **Medium fees** (~5 sat/vB) - 30-60 minutes
- **Slow fees** (~2 sat/vB) - 1+ hours

### 5. Broadcast Reveal Transaction

Once the commit confirms, complete the inscription:

```
"Reveal my inscription"
```

Uses `inscribe_reveal` with:
- `commitTxid` - From step 3 inscribe response
- `revealAmount` - From step 3 inscribe response
- `contentType` - Same as step 3 (must match)
- `contentBase64` - Same as step 3 (must match)

Returns:
- `inscriptionId` - Unique ID (`{revealTxid}i0`)
- Commit and reveal transaction details
- Explorer URLs for both transactions

### 6. Verify Inscription

Fetch and parse the inscription content:

```
"Get inscription from transaction abc123..."
```

Uses `get_inscription` with reveal txid. Returns:
- Content type and size
- Body (base64 and text if applicable)
- Metadata (pointer, metaprotocol, encoding)

## Parent/Child Inscriptions

Parent/child inscriptions establish a provenance link between an existing (parent) inscription and a new (child) inscription. The child's envelope includes a parent tag (tag 3) containing the parent's inscription ID. This is used for collections, versioning, and on-chain attribution.

### How It Works

The reveal transaction is structured differently for parent/child:
- **Input 0** - Parent UTXO (proves ownership, spending the parent inscription)
- **Input 1** - Commit UTXO (the standard commit output)
- **Output 0** - Parent inscription returned to the same script (parent is preserved, not burned)
- **Output 1** - Child inscription at the recipient address

Because the child inscription is at output index 1, its inscription ID is `{revealTxid}i1` instead of the standard `{revealTxid}i0`.

### Parent Inscription ID Format

The `parentInscriptionId` parameter uses the standard ordinals format:

```
{64-hex-txid}i{index}
```

Examples:
- `abc123...def456i0` - inscription at output 0 of that reveal tx
- `abc123...def456i1` - inscription at output 1 (a child inscription)

**Requirements**:
- Exactly 64 hex characters for the txid
- Lowercase hex only
- `i` separator followed by a non-negative integer index

### Parent/Child Workflow

#### Step 1: Estimate Fee (with parent)

```
"Estimate fee for text inscription with parent abc123...i0"
```

Uses `estimate_inscription_fee` with `parentInscriptionId`. The estimate accounts for the extra P2TR input (parent UTXO) and extra P2TR output (parent return) in the reveal transaction — approximately 68-85 additional vbytes. Response includes `isParentChild: true`.

#### Step 2: Create Commit Transaction

```
"Inscribe 'GM from child' as text/plain with parent abc123...i0"
```

Uses `inscribe` with `parentInscriptionId`. The tool:
1. Validates the parent inscription ID format
2. Looks up the parent via the Hiro Ordinals API to confirm it exists and is on-chain
3. Broadcasts the commit transaction with the parent tag embedded in the inscription envelope

Response includes `isParentChild: true`, `parentInscriptionId`, and a `nextStep` message reminding you to pass `parentInscriptionId` to `inscribe_reveal`.

**Important**: The parent must be confirmed on-chain before calling inscribe. Unconfirmed parents are rejected.

#### Step 3: Wait for Commit Confirmation

Same as the standard workflow — wait for the commit transaction to confirm before proceeding.

#### Step 4: Broadcast Reveal Transaction

```
"Reveal inscription for commit abc123... with parent def456...i0"
```

Uses `inscribe_reveal` with the same `contentType`, `contentBase64`, AND `parentInscriptionId` from the commit step. The tool fetches the parent UTXO live from the blockchain and constructs the reveal transaction.

Response includes:
- `inscriptionId` - `{revealTxid}i1` (output index 1, not 0)
- `isParentChild: true`
- `parentInscriptionId` - The parent ID
- `parentReturned: true` - Confirms parent was returned to its script
- `parentTxid` - Parent UTXO txid

#### Step 5: Verify Child Inscription

Use `get_inscription` with the reveal txid. The response will list both inscriptions (index 0 is the parent return, index 1 is the child).

## Tool Reference

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_taproot_address` | Get wallet's Taproot address for receiving inscriptions | None |
| `estimate_inscription_fee` | Calculate inscription cost | `contentType`, `contentBase64`, `feeRate?`, `parentInscriptionId?` |
| `inscribe` | Broadcast commit transaction (non-blocking) | `contentType`, `contentBase64`, `feeRate?`, `parentInscriptionId?` |
| `inscribe_reveal` | Broadcast reveal transaction (after commit confirms) | `commitTxid`, `revealAmount`, `contentType`, `contentBase64`, `feeRate?`, `parentInscriptionId?` |
| `get_inscription` | Fetch inscription content from reveal tx | `txid` |
| `get_inscriptions_by_address` | List all inscriptions owned by address (mainnet only) | `address?` |

## Content Types and Encoding

All content must be base64-encoded before inscription.

### Text Inscription

**Content Type**: `text/plain`

```bash
echo -n "Hello, Bitcoin!" | base64
# SGVsbG8sIEJpdGNvaW4h
```

**Example**:
```
"Inscribe 'Hello, Bitcoin!' as text/plain"
```

### HTML Inscription

**Content Type**: `text/html`

```bash
echo -n '<html><body><h1>GM</h1></body></html>' | base64
# PGh0bWw+PGJvZHk+PGgxPkdNPC9oMT48L2JvZHk+PC9odG1sPg==
```

**Example**:
```
"Create an HTML inscription with <html>...</html>"
```

### Image Inscription

**Content Type**: `image/png`, `image/jpeg`, `image/svg+xml`

For images, read the file and encode to base64:

```bash
base64 -i image.png
```

**Example**:
```
"Inscribe this PNG image (provide base64 data)"
```

### JSON Inscription

**Content Type**: `application/json`

```bash
echo -n '{"type":"brc-20","tick":"ordi"}' | base64
# eyJ0eXBlIjoiYnJjLTIwIiwidGljayI6Im9yZGkifQ==
```

## Error Cases

### Insufficient Funds

**Symptom**: Inscribe fails with "No UTXOs available"

**Solution**:
1. Check balance with `get_btc_balance`
2. Ensure confirmed balance > total cost (from estimate)
3. Send more BTC to wallet if needed

### Unconfirmed Commit

**Symptom**: Reveal fails with broadcast error

**Solution**:
1. Verify commit transaction has at least 1 confirmation
2. Check explorer URL from inscribe response
3. Wait longer if still pending

### Content Mismatch

**Symptom**: Reveal creates different inscription than expected

**Cause**: Different `contentType` or `contentBase64` used in reveal vs commit

**Solution**: Use exact same parameters from inscribe call when calling inscribe_reveal

### Wallet Not Unlocked

**Symptom**: "Wallet not unlocked" error

**Solution**: Run `wallet_unlock` with your password before inscribing

### Parent Not Found

**Symptom**: Inscribe fails with "Parent inscription not found: {id}"

**Cause**: The `parentInscriptionId` does not exist in the Hiro Ordinals API (wrong ID or inscription was never created)

**Solution**:
1. Verify the inscription ID is correct (check mempool.space or ord.io)
2. Ensure the inscription exists on the correct network (mainnet vs testnet)

### Parent Unconfirmed

**Symptom**: Inscribe fails with "Parent inscription ... is not yet confirmed"

**Cause**: The parent inscription's commit or reveal transaction has not been mined yet

**Solution**: Wait for the parent inscription to be fully confirmed on-chain, then retry

### Invalid Parent ID Format

**Symptom**: Inscribe fails with "Invalid inscription ID format: ..."

**Cause**: The `parentInscriptionId` does not match the required format

**Solution**: Use the format `{64-hex-txid}i{index}` with:
- Exactly 64 lowercase hex characters for the txid
- The literal letter `i`
- A non-negative integer (0, 1, 2, ...)

Example valid ID: `a1b2c3...d4e5f6i0`

### Parent ID Mismatch Between Commit and Reveal

**Symptom**: Reveal produces a different inscription address than commit (broadcast fails or wrong inscription created)

**Cause**: `parentInscriptionId` passed to `inscribe_reveal` differs from what was passed to `inscribe`

**Solution**: The `parentInscriptionId` must be identical in both the commit and reveal steps because it is embedded in the inscription envelope, which determines the commit address derivation

## Taproot Address Usage

Inscriptions are created at Taproot (P2TR) addresses following BIP86 derivation:

| Network | Prefix | Derivation Path |
|---------|--------|----------------|
| Mainnet | `bc1p...` | `m/86'/0'/0'/0/0` |
| Testnet | `tb1p...` | `m/86'/1'/0'/0/0` |

Get your Taproot address:

```
"What's my Taproot address?"
```

Uses `get_taproot_address` - this is where your inscriptions will appear after the reveal confirms.

## Example Workflows

### Simple Text Inscription

```
1. "What's my BTC balance?"
   → Confirm sufficient funds

2. "Estimate fee for text inscription 'GM Bitcoin'"
   → contentType: "text/plain"
   → contentBase64: "R00gQml0Y29pbg==" (base64 of "GM Bitcoin")
   → Returns total cost

3. "Create text inscription 'GM Bitcoin' with medium fees"
   → Broadcasts commit tx
   → Save commitTxid and revealAmount

4. Wait 30-60 minutes for commit confirmation

5. "Reveal inscription with commitTxid abc123... and revealAmount 10000"
   → Uses same contentType and contentBase64 from step 3
   → Returns inscriptionId ({revealTxid}i0)

6. "Get inscription from reveal transaction def456..."
   → Verifies content matches "GM Bitcoin"
```

### HTML Inscription

```
1. "Check my BTC balance"
   → Verify funds available

2. "Estimate fee for HTML inscription"
   → contentType: "text/html"
   → contentBase64: (base64 of HTML string)

3. "Inscribe this HTML with fast fees"
   → Broadcasts commit with higher fee rate
   → Save response data

4. Wait 10-20 minutes (fast fees)

5. "Complete reveal for commit xyz789..."
   → Provide exact same HTML content
   → Returns inscriptionId ({revealTxid}i0) and reveal txid

6. "Get inscription from reveal transaction def456..."
   → Use reveal txid with get_inscription to fetch and display HTML content
```

### Parent/Child Inscription

```
1. "Check my BTC balance"
   → Need enough for two-step inscription plus parent input

2. "Estimate fee for text inscription 'Child of parent' with parent
    a1b2c3...d4e5f6i0"
   → contentType: "text/plain"
   → contentBase64: (base64 of "Child of parent")
   → parentInscriptionId: "a1b2c3...d4e5f6i0"
   → Response shows isParentChild: true, higher totalCost than standard

3. "Inscribe 'Child of parent' as text/plain with parent a1b2c3...d4e5f6i0"
   → Tool validates parent exists and is confirmed on-chain
   → Broadcasts commit tx with parent tag in inscription envelope
   → Save commitTxid, revealAmount, and parentInscriptionId from response

4. Wait for commit confirmation (same as standard workflow)

5. "Reveal inscription for commit abc123... with parent a1b2c3...d4e5f6i0"
   → Provide same contentType, contentBase64, AND parentInscriptionId
   → Parent UTXO is fetched and spent as input 0, returned as output 0
   → Child inscription created at output 1
   → inscriptionId = {revealTxid}i1 (not i0)
   → Response shows parentReturned: true

6. "Get inscription from reveal transaction def456..."
   → Returns two inscriptions: index 0 (parent return), index 1 (child)
```

## Cost Considerations

**Factors affecting cost**:
- **Content size** - Larger inscriptions cost more (reveal witness data)
- **Fee rate** - Higher fees = faster confirmation
- **Network congestion** - Prices fluctuate with mempool activity
- **Parent/child** - Adds ~68-85 vbytes to the reveal transaction (extra P2TR input for parent UTXO + extra P2TR output to return parent), increasing reveal fee

**Typical ranges** (mainnet, medium fees):
- Small text (< 100 bytes): 5,000-10,000 sats
- Medium text (1 KB): 20,000-50,000 sats
- Images (10-50 KB): 100,000-500,000 sats
- Parent/child overhead: +500-1,500 sats on reveal fee (at medium fee rates)

Always run `estimate_inscription_fee` before committing funds. Pass `parentInscriptionId` to get an accurate estimate when creating a child inscription.

## Level System Context

In the aibtc.com agent lifecycle, creating a Bitcoin inscription is part of the **L3 Sovereign** upgrade (post-genesis):

1. Agent completes Bitcoin inscription using this workflow
2. Agent proves inscription txid to registration API
3. API verifies inscription content matches expected message
4. Agent upgraded to L3 Sovereign status

This demonstrates the agent's ability to create permanent records on Bitcoin L1.

## More Information

- [Bitcoin Ordinals Theory](https://docs.ordinals.com/inscriptions.html)
- [BIP86 Taproot Derivation](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki)
- [mempool.space](https://mempool.space) - Block explorer and fee estimates
- [CLAUDE.md Ordinal Safety](../../CLAUDE.md#ordinal-safety)

---

*Back to: [SKILL.md](../SKILL.md)*
