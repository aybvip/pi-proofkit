# Index

Everything in this repository, in reading order.

## Start here

| File | What it is |
|---|---|
| [`../README.md`](../README.md) | what a proof pack is, and what a passing verification does and does not mean |
| [`../llms.txt`](../llms.txt) | a compact machine-readable summary |

## The model

| Document | Contents |
|---|---|
| [`PROOF-PACKS.md`](PROOF-PACKS.md) | what a pack is, its four parts, and why the evidence is not hashed |
| [`CANONICAL-FORM.md`](CANONICAL-FORM.md) | the byte-level specification, with reference implementations |
| [`BOUNDARIES.md`](BOUNDARIES.md) | every non-claim, in full |

## Discipline

| Document | Contents |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | D1–D10, including what was declined and why |
| [`SOURCES.md`](SOURCES.md) | official sources and the measured facts |
| [`VERIFICATION.md`](VERIFICATION.md) | reproduce the digest with an independent tool |

## Code

| File | Role |
|---|---|
| `lib.mjs` | the canonical form, claim kinds, validation rules, and boundaries, as pure data |
| `pack.mjs` | build, digest and verify packs; render a pack and a verification (offline) |
| `proofkit-cli.mjs` | the CLI: example, build, verify, canonical, hash, boundaries |
| `fixtures.mjs` | the worked example pack's scope, claims and evidence |
| `test/proofkit.test.mjs` | offline checks, including a pin of the canonical form |

## Boundaries, at a glance

- A passing verification proves the bytes are **unaltered**, not that the claims are **true**.
- It does **not** claim a claim is complete, or that no other claim exists.
- It does **not** claim a pack holds at another endpoint, version or time; every pack is **scoped**.
- It does **not** authenticate the author; a digest is **not** a signature.
- It does **not** hash the evidence — its content is not covered by the digest.
- It does **not** contact a network or run a command.
- It does **not** claim Pi Network has reviewed, adopted or endorsed it.
