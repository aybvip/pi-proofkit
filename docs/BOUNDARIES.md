# Boundaries

Every non-claim, in full. These are carried on every pack and every verification
result, and the test suite fails if the documentation contradicts them.

## 1. Integrity is not truth

> A digest proves **INTEGRITY**, not **TRUTH**. A passing verification means the
> bytes are unaltered since the digest was taken. It does **not** mean the claims
> are correct, well-founded, or complete. To judge a claim you must read its
> **basis** and its **evidence**.

The single most important sentence in this repository. A tool that said "verified"
and let a reader infer "true" would be actively harmful.

## 2. A pack is scoped, never universal

> A proof pack is scoped to the endpoint, tool, version and date it records. A
> pack that verifies here says nothing about another endpoint, another version, or
> another time.

There is therefore no "universal" scope in this library, and a pack without a
scope is still printed with its scope fields shown as `(none)` rather than hidden.

## 3. Reproducibility beats trust

> The point of a pack is that you do **not** have to trust its author. Every basis
> field names how the value was obtained, so you can obtain it yourself and
> compare. A pack you cannot reproduce is a claim you cannot check.

This is why a `measured` claim with no basis is **refused** at build time.

## 4. What is NOT authenticated

- The **author** is not authenticated. A digest is not a signature and names no
  authority.
- The **time** is not proven. `measuredAt` is a recorded string, not a timestamp
  the digest vouches for.
- The **evidence** is not hashed. Evidence is referenced by basis; its *content*
  is not covered by the digest, so a URL that later changes or disappears does not
  change the digest.

## 5. What is NOT proven about the claims

- **Truth.** Only integrity.
- **Completeness.** A pack does not claim to list every claim that exists; it
  claims the listed ones are the ones that were hashed.
- **Sufficiency.** A pack does not claim its evidence is *enough* for a reader to
  reproduce a value; it claims the basis says how.

## 6. What the tool does not do

- It does **not** contact a network, spawn a process, sign, or submit — asserted by
  the test suite against the library sources.
- It does **not** store secrets or keys, and has no mechanism to.
- It does **not** cover Mainnet or any endpoint it has not been pointed at.
- It does **not** claim Pi Network has reviewed, adopted, or endorsed it. Adoption
  is `not-claimed`.

## 7. Stated limitations of the canonical form

These are limitations, written down rather than discovered the hard way:

- A string `"1"` and a number `1` produce the **same** canonical line. If that
  distinction matters, encode it in the key or the basis.
- The canonical string must be hashed as **UTF-8 without a BOM**, with **no
  trailing newline**. A BOM or a trailing newline changes the digest.
- Claim **order** is significant: reordering claims changes the digest.
