# Verification

Every figure quoted in this repository can be reproduced with the commands below.
The outputs are what was actually observed.

## 0. Tests (offline, no network)

```bash
node test/proofkit.test.mjs
```

Expected: `pass: 134  fail: 0`.

The suite is offline and clock-independent. Its load-bearing checks are that the
digest is reproducible by an **independent** sha256 implementation and matches a
**hand-written** canonical string, so the canonical form cannot silently drift.

## 1. Build the example pack

```bash
node proofkit-cli.mjs --example
```

Observed: the pack's scope, its digest, the eight claims with their kinds and
bases, the evidence, and the canonical bytes between `---8<---` markers.

## 2. The digest is reproducible by the project's own code

```bash
node proofkit-cli.mjs --example --json | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);const h=require('crypto').createHash('sha256').update(j.pack.canonical.bytes,'utf8').digest('hex');console.log('recorded:  ',j.pack.digest.sha256);console.log('recomputed:',h);console.log('match:',h===j.pack.digest.sha256)})"
```

Observed: `match: true`.

## 3. The digest is reproducible by an INDEPENDENT tool

This is the check that matters. The canonical bytes are written to a file, then
hashed with **PowerShell's own** `SHA256` — no code from this repository involved:

```powershell
node proofkit-cli.mjs --example --json | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);require('fs').writeFileSync('canonical.txt', j.pack.canonical.bytes, 'utf8');console.log('recorded digest:', j.pack.digest.sha256)})"

$bytes = [System.IO.File]::ReadAllBytes("canonical.txt")
$sha   = [System.Security.Cryptography.SHA256]::Create()
$hex   = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Output "powershell digest: $hex"
```

Observed on 2026-10-19:

```
recorded digest: 1e94219c8f934921edfdab37ed06f4b2874fe5830d86d67d7d702c8385a04876
wrote 711 bytes
powershell digest: 1e94219c8f934921edfdab37ed06f4b2874fe5830d86d67d7d702c8385a04876
```

The two strings are identical. **This is the point of the repository**: the digest
is not a signature only this tool can produce — it is a fact anyone can compute.

## 4. `--verify` reports the three verdicts

```bash
node proofkit-cli.mjs --example --json > pack.json
node proofkit-cli.mjs --verify pack.json
```

Observed: `[INTACT]`, exit `0`.

Editing one claim (for example changing `network.passphrase` from `Pi Testnet` to
anything else) and re-verifying:

```
[ TAMPERED ] the recomputed digest does NOT match the recorded one: the pack was altered after the digest was taken
```

exit `1`.

A structurally broken pack — an unknown `format`, missing claims, a `measured`
claim with no basis, or a malformed recorded digest — reports:

```
[ INVALID ]
```

exit `2`, and **no conclusion either way**. An uncheckable pack is never reported
as intact and never as tampered.

## 5. What the three verdicts mean, and do not

| verdict | conclude |
|---|---|
| `intact` | the bytes are **unaltered** — nothing more |
| `tampered` | the pack **was altered** after hashing |
| `invalid` | **nothing** — the pack is malformed |

A passing verification says **nothing** about whether the claims are true. The
result carries that disclaimer, and the test suite asserts it is present on every
result object.

## 6. The basis is inside the digest; the evidence is not

```bash
# after building a pack, change only a BASIS and re-verify  → TAMPERED
# change only an EVIDENCE string and re-verify             → INTACT
```

Observed, and asserted by the suite:

- changing a **basis** → `tampered` (provenance is inside the digest);
- changing an **evidence** string → `intact` (evidence is referenced, not hashed).

This is the design recorded in [`PROOF-PACKS.md`](PROOF-PACKS.md) and
[`DECISIONS.md`](DECISIONS.md) D5.

## 7. Boundaries

```bash
node proofkit-cli.mjs --boundaries
```

Lists every boundary and restates the integrity-not-truth, scope and
reproduce-not-trust principles. The test suite additionally scans every Markdown
file for forbidden-claim phrases and fails if one is asserted rather than quoted
or negated.

## 8. Purity

The test suite asserts that `lib.mjs` and `pack.mjs` contain no `fetch(` call and
no process-spawning primitive, so the library cannot reach a network or run a
command. Hashing is local (`node:crypto`) and nothing else.

## 9. Commit attribution

This repository's commits are authored with the project account's own address
(`86422631+aybvip@users.noreply.github.com`), so GitHub attributes them to this
account rather than to whoever happens to own another email.

```bash
git log --format="%ae" | sort -u
```

Expected: one email. GitHub attributes a commit to the account that **owns the
author email**, not to whoever authenticated the push.
