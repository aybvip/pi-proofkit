# Proof packs

A **proof pack** is a small, self-contained bundle whose purpose is to make a
claim **checkable without trusting its author**.

A bare claim ("the retention window is 120960 ledgers") cannot be checked — you
either believe it or you do not. A *signed* claim requires trusting the signer,
which only moves the problem. A pack solves it differently: it ships the exact
bytes that were hashed, over a canonical form that is fully specified, so you can
hash those bytes yourself and compare.

## The four parts

| Part | Purpose | Inside the digest? |
|---|---|---|
| **scope** | the endpoint, tool, version and date — so the pack is never read as universal | no |
| **claims** | the key / kind / value / **basis** rows | **yes** |
| **evidence** | the concrete way to reach a value (a command, a URL) | **no** — referenced by basis only |
| **canonical bytes + digest** | the exact bytes hashed, and their SHA-256 | the digest is the result |

The last column is a deliberate design choice, and the most subtle one.

### Why the evidence is NOT in the digest

Evidence can be anything: a shell command, a URL, a paragraph. Hashing it would
mean:

- the digest changes when a URL's *formatting* changes, which proves nothing;
- large evidence makes packs unwieldy;
- and, worst of all, it would imply the digest **vouches for the evidence**,
  which it cannot — a digest over a command string says the string is unaltered,
  not that running it produces the claimed value.

So evidence is **referenced** by the claim's `basis`, and the reader follows that
reference. The suite asserts this explicitly: changing the evidence alone leaves
the pack **intact**, while changing a **basis** alone makes it **tampered** —
because the basis describes provenance and belongs inside the digest; the evidence
is the trail you walk yourself.

## Claims, and the basis rule

A claim is:

```json
{ "key": "node.version", "kind": "measured", "value": "28.0.1", "basis": "getVersionInfo.result.version" }
```

- **key** — a stable identifier (`a-zA-Z0-9`, then `a-zA-Z0-9._-`). Unique in a pack.
- **kind** — one of `measured`, `documented`, `derived`, `asserted`, `not-claimed`.
- **value** — a scalar, spelled as JSON. It may not contain a `|` or a newline,
  because that would make the canonical line ambiguous.
- **basis** — how the value was obtained. **Required for a `measured` claim.**

The basis rule is enforced at build time. A measurement that does not say how it
was obtained cannot be reproduced, which defeats the entire purpose, so a pack
carrying such a claim is **refused** — not warned about, refused.

## Why a pack refuses to build on malformed input

The canonical form is only useful if it is **unambiguous**: two different packs
with the same claims must produce the same bytes. A value containing the field
separator breaks that. So `buildPack()` either returns a valid pack or **throws**,
with the exact errors attached. There is no "build anyway" path, because a pack
that cannot be digested reproducibly is not a proof pack.

## What a pack is NOT

- It is **not** a signature. It names no authority and authenticates no author.
- It is **not** a truth certificate. It records that bytes are unaltered.
- It is **not** universal. It is scoped, and the scope is printed with it.
- It is **not** a replacement for reading the evidence. It is the *handle* that
  makes the evidence worth reading — because you now know it has not been edited.
