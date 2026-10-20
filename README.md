# Pi ProofKit

A **read-only, zero-dependency** library and CLI for **portable proof packs**: a
small, self-contained bundle of claims, the evidence each claim rests on, and a
**reproducible SHA-256 digest** over a canonical form that is *fully specified* —
so anyone can recompute the digest **by hand**, with any sha256 tool, without
trusting the author or using this project's code.

> **Plainly:** a number in a README cannot be checked. A *signed* number requires
> trusting a signer. A **proof pack** can be checked by anyone: it ships the exact
> bytes that were hashed, so you can hash them yourself and compare.

## The one thing this library is careful about

A digest proves **integrity**, not **truth**.

| A passing verification means | A passing verification does NOT mean |
|---|---|
| the bytes are **unaltered** since the digest was taken | that the claims are **correct** |
| the canonical form can be **recomputed** independently | that the claims are **complete** |
| any later edit is **detectable** | that the **evidence** is good — evidence is *referenced*, not hashed |

That distinction is the whole point, and it is carried on every pack and every
verification result. This repository never asserts that it proves the claim is true, and never asserts that it is mathematically proven: those are forbidden claims, and the test suite fails if the documentation asserts one.

## Anatomy of a pack

```json
{
  "format": "pi-proof-pack/1",
  "scope": { "endpoint": "...", "tool": "...", "version": "...", "measuredAt": "..." },
  "claims":  [ { "key": "node.version", "kind": "measured", "value": "28.0.1", "basis": "getVersionInfo.result.version" } ],
  "evidence": { "node.version": "how to obtain it yourself" },
  "canonical": { "bytes": "…", "byteLength": 711, "lineCount": 8 },
  "digest": { "algorithm": "sha256", "encoding": "hex", "sha256": "…" }
}
```

Three things are kept rigorously apart:

| Part | What it is |
|---|---|
| **claim** | a key, a kind, a value, and a **basis** stating how the value was obtained |
| **evidence** | the concrete way to reach the value (a command, a URL) — *referenced by basis, not hashed* |
| **canonical bytes** | the exact UTF-8 string the digest is over — the thing you hash yourself |

### The canonical form

```
{key}|{kind}|{value}|{basis}
```

One line per claim, in pack order; lines joined by `\n`, **no trailing newline**;
`null` written literally as `null`. Full specification in
[`docs/CANONICAL-FORM.md`](docs/CANONICAL-FORM.md).

## Verify it yourself, without this project

```bash
# 1. get the canonical bytes
node proofkit-cli.mjs --example --json | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>process.stdout.write(JSON.parse(s).pack.canonical.bytes))" > canonical.txt

# 2. hash them with ANY sha256 tool
certutil -hashfile canonical.txt SHA256     # Windows
sha256sum canonical.txt                     # Linux/macOS

# 3. compare to the pack's digest
```

Measured: the example pack's recorded digest is
`1e94219c8f934921edfdab37ed06f4b2874fe5830d86d67d7d702c8385a04876`, and
PowerShell's **independent** `SHA256` over the same bytes produces the **same**
string. No code from this repository was involved in the second computation.

## Usage

```bash
# build and show the example pack (from measured Pi RPC facts)
node proofkit-cli.mjs --example
node proofkit-cli.mjs --example --json

# build a pack from your own claims file
node proofkit-cli.mjs --build claims.json

# verify a pack's INTEGRITY
node proofkit-cli.mjs --verify pack.json

# print just the canonical bytes (to hash them yourself)
node proofkit-cli.mjs --canonical claims.json

# sha256 of any file, for by-hand checking
node proofkit-cli.mjs --hash somefile.txt

# every non-claim
node proofkit-cli.mjs --boundaries
```

Exit codes for `--verify`: `0` **intact**, `1` **tampered**, `2` **invalid**.

A **claims file** is JSON: `{ scope, claims:[{key,kind,value,basis}], evidence, label }`.

### Library

```js
import { buildPack, verifyPack } from "./pack.mjs";

const pack = buildPack({ scope, claims, evidence, label });
pack.digest.sha256;                  // the digest

const result = verifyPack(pack);
result.verdict;                      // "intact" | "tampered" | "invalid"
result.integrityNotTruth;            // always carried
```

## Claim kinds

| kind | meaning |
|---|---|
| `measured` | observed by a command against a recorded endpoint and version — **must carry a basis** |
| `documented` | stated by an official source cited by URL |
| `derived` | computed from measured values by a rule written down in the basis |
| `asserted` | stated with no measurement behind it — carried for completeness, visibly the **weakest** kind |
| `not-claimed` | explicitly out of scope |

A `measured` claim with **no basis** is rejected at build time: a measurement that
does not say how it was obtained cannot be reproduced, which defeats the point.

## The three verification verdicts

| verdict | meaning | what you may conclude |
|---|---|---|
| `intact` | the recomputed digest matches the recorded one | the bytes are **unaltered** — nothing more |
| `tampered` | the digests differ | the pack **was altered** after the digest was taken |
| `invalid` | the pack is malformed | **nothing** — no conclusion either way |

`invalid` is deliberately its own verdict. A pack whose claims are ambiguous cannot
be digested reproducibly, so it is *not* "tampered" — it is *uncheckable*, and the
tool says so rather than guessing.

## The measured example pack

`--example` builds a pack from facts this project family already measured on
**2026-10-19** (recorded in `pi-soroban-events` and `pi-api-contract-registry`),
with the endpoint, node version, protocol version, and date in the scope:

| claim | kind | value |
|---|---|---|
| `network.passphrase` | measured | `Pi Testnet` |
| `node.version` | measured | `28.0.1` |
| `protocol.version` | measured | `28` |
| `events.pageCap` | measured | `100` |
| `ledger.retentionWindow` | measured | `120960` |
| `ledger.retentionDays` | derived | `7` |
| `endLedger.exclusive` | measured | `true` |
| `mainnet.sorobanRpc.reachable` | measured | `false` |

## Boundaries (critical)

- A passing verification proves the bytes are **unaltered**, not that the claims are **true**.
- It does **not** claim a claim is complete, or that no other claim exists.
- It does **not** claim a pack holds at another endpoint, version or time; every pack is **scoped**.
- It does **not** authenticate the author; a digest is **not** a signature and names no authority.
- It does **not** hash the evidence — evidence can be a URL or a command, and its *content* is not covered by the digest.
- It does **not** make a claim checkable by itself; a reader must still read the basis and evidence.
- It does **not** claim Pi Network has reviewed, adopted or endorsed it.

## Documents

| Document | Contents |
|---|---|
| [`docs/PROOF-PACKS.md`](docs/PROOF-PACKS.md) | what a pack is, its parts, and what each part is for |
| [`docs/CANONICAL-FORM.md`](docs/CANONICAL-FORM.md) | the byte-level specification, and how to reimplement it |
| [`docs/VERIFICATION.md`](docs/VERIFICATION.md) | reproduce the digest with an independent tool |
| [`docs/BOUNDARIES.md`](docs/BOUNDARIES.md) | every non-claim, in full |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | D1–D10, including what was declined and why |
| [`docs/SOURCES.md`](docs/SOURCES.md) | official sources and the measured facts |
| [`docs/INDEX.md`](docs/INDEX.md) | everything, in reading order |

## Tests

```bash
node test/proofkit.test.mjs
```

Offline, clock-independent checks covering the canonical form, the claim rules,
all three verification verdicts, the honesty guard, doc/link integrity — and the
load-bearing one: that the digest is reproducible by an **independent** sha256
implementation, and matches a **hand-written** canonical string, so the form
cannot silently drift.
